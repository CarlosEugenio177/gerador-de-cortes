package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/semaphore"
)

type EditOperation struct {
	Type         string      `json:"type"`
	Start        float64     `json:"start,omitempty"`
	End          float64     `json:"end,omitempty"`
	Style        string      `json:"style,omitempty"`
	File         string      `json:"file,omitempty"`
	KeepSegments [][]float64 `json:"keep_segments,omitempty"`
	Title        string      `json:"title,omitempty"`
	Description  string      `json:"description,omitempty"`
	Score        float64     `json:"score,omitempty"`
}

type EditPlan struct {
	ProjectID    uint            `json:"project_id"`
	OriginalFile string          `json:"original_file"`
	VideoFormat  string          `json:"video_format,omitempty"`
	RemoveNoise  bool            `json:"remove_noise,omitempty"`
	Operations   []EditOperation `json:"operations"`
}

var (
	ctx        = context.Background()
	semLimit   *semaphore.Weighted
	uploadDir  = "uploads"
	clipsDir   = "uploads/clips"
)

func main() {
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	maxConcurrent := 2
	if envMax := os.Getenv("MAX_CONCURRENT_RENDERS"); envMax != "" {
		if val, err := strconv.Atoi(envMax); err == nil && val > 0 {
			maxConcurrent = val
		}
	}
	semLimit = semaphore.NewWeighted(int64(maxConcurrent))

	if dir := os.Getenv("UPLOAD_DIR"); dir != "" {
		uploadDir = dir
	}
	if dir := os.Getenv("CLIPS_DIR"); dir != "" {
		clipsDir = dir
	}
	os.MkdirAll(uploadDir, os.ModePerm)
	os.MkdirAll(clipsDir, os.ModePerm)

	log.Printf("ClipForge Render Engine started (Max Concurrency: %d). Listening on 'stream:render'...", maxConcurrent)

	streamName := "stream:render"
	groupName := "render_engine_group"
	hostname, _ := os.Hostname()
	consumerName := fmt.Sprintf("render_worker_%s", hostname)

	err := rdb.XGroupCreateMkStream(ctx, streamName, groupName, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		log.Printf("Notice on group creation %s: %v", streamName, err)
	}

	for {
		streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    groupName,
			Consumer: consumerName,
			Streams:  []string{streamName, ">"},
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil && err != redis.Nil {
			log.Printf("Error reading from stream: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		if len(streams) == 0 {
			continue
		}

		for _, msg := range streams[0].Messages {
			payloadStr, ok := msg.Values["payload"].(string)
			if !ok {
				log.Printf("Failed to get payload from message %v", msg.ID)
				rdb.XAck(ctx, streamName, groupName, msg.ID)
				continue
			}

			var plan EditPlan
			if err := json.Unmarshal([]byte(payloadStr), &plan); err != nil {
				log.Printf("Failed to unmarshal EditPlan: %v", err)
				rdb.XAck(ctx, streamName, groupName, msg.ID)
				continue
			}

			// Process render task with concurrency limiting
			go processRenderTask(rdb, streamName, groupName, msg.ID, plan)
		}
	}
}

func processRenderTask(rdb *redis.Client, streamName, groupName, msgID string, plan EditPlan) {
	defer rdb.XAck(ctx, streamName, groupName, msgID)

	// Acquire semaphore lock to protect GPU/CPU
	if err := semLimit.Acquire(ctx, 1); err != nil {
		log.Printf("Failed to acquire render semaphore: %v", err)
		return
	}
	defer semLimit.Release(1)

	log.Printf("[Render Engine] Processing project %d with %d operations", plan.ProjectID, len(plan.Operations))

	var startTime, endTime float64
	var subtitleFile string
	var keepSegments [][]float64
	var clipTitle string
	var clipScore float64
	hasClip := false

	for _, op := range plan.Operations {
		switch op.Type {
		case "clip":
			startTime = op.Start
			endTime = op.End
			keepSegments = op.KeepSegments
			clipTitle = op.Title
			clipScore = op.Score
			hasClip = true
		case "subtitle":
			subtitleFile = op.File
		}
	}

	if !hasClip {
		log.Printf("No clip operation found for Project %d. Skipping.", plan.ProjectID)
		publishFailed(rdb, plan.ProjectID, "Nenhuma operação de corte (clip) encontrada no plano.")
		return
	}

	duration := endTime - startTime
	if duration <= 0 {
		duration = 15.0
	}

	// Output clip path
	clipSlug := fmt.Sprintf("clip_%d_t%.0f_%.0f.mp4", plan.ProjectID, startTime, endTime)
	outputPath := filepath.Join(clipsDir, clipSlug)

	// Idempotency check: if file already exists, reuse it
	if _, err := os.Stat(outputPath); err == nil {
		log.Printf("[Render Engine] Optimization: File %s already exists. Skipping render.", outputPath)
		publishClipCompleted(rdb, plan.ProjectID, outputPath, clipTitle, clipScore, startTime, endTime)
		return
	}

	publishProgress(rdb, plan.ProjectID, "rendering", fmt.Sprintf("Renderizando corte: %s...", clipTitle), 85)

	// Build FFmpeg Video Filter (Aspect Ratio Crop + Subtitles)
	var vfFilters string
	switch plan.VideoFormat {
	case "1:1":
		vfFilters = "crop=ih:ih:(iw-ow)/2:0,scale=1080:1080"
	case "16:9":
		vfFilters = "scale=1920:1080"
	case "9:16":
		fallthrough
	default:
		vfFilters = "crop=ih*(9/16):ih:(iw-ow)/2:0,scale=1080:1920"
	}

	if subtitleFile != "" && fileExists(subtitleFile) {
		cleanSub := filepath.ToSlash(subtitleFile)
		vfFilters += fmt.Sprintf(",subtitles='%s'", cleanSub)
	}

	// Build audio filters if requested
	var afFilters string
	if plan.RemoveNoise {
		afFilters = "afftdn=nf=-25"
	}

	// Support jump cuts if segments are defined
	if len(keepSegments) > 0 {
		var selectParts []string
		for _, seg := range keepSegments {
			if len(seg) == 2 {
				selectParts = append(selectParts, fmt.Sprintf("between(t,%f,%f)", seg[0], seg[1]))
			}
		}
		if len(selectParts) > 0 {
			selectExpr := strings.Join(selectParts, "+")
			jumpCutV := fmt.Sprintf("select='%s',setpts=N/FRAME_RATE/TB", selectExpr)
			jumpCutA := fmt.Sprintf("aselect='%s',asetpts=N/SR/TB", selectExpr)
			vfFilters = jumpCutV + "," + vfFilters
			if afFilters != "" {
				afFilters = afFilters + "," + jumpCutA
			} else {
				afFilters = jumpCutA
			}
		}
	}

	// Base args (threads capped to 2 to prevent CPU saturation)
	baseArgs := []string{
		"-y",
		"-threads", "2",
		"-ss", fmt.Sprintf("%.2f", startTime),
		"-i", plan.OriginalFile,
		"-t", fmt.Sprintf("%.2f", duration),
	}
	if vfFilters != "" {
		baseArgs = append(baseArgs, "-vf", vfFilters)
	}
	if afFilters != "" {
		baseArgs = append(baseArgs, "-af", afFilters)
	}

	// 1. Try Hardware NVENC first
	nvencArgs := append([]string{}, baseArgs...)
	nvencArgs = append(nvencArgs,
		"-c:v", "h264_nvenc",
		"-preset", "p4",
		"-cq", "24",
		"-c:a", "aac",
		"-b:a", "128k",
		outputPath,
	)

	cmdNVENC := exec.Command("ffmpeg", nvencArgs...)
	cmdNVENC.Stdout = os.Stdout
	cmdNVENC.Stderr = os.Stderr

	log.Printf("[Render Engine] Attempting NVENC render: %s", cmdNVENC.String())
	err := cmdNVENC.Run()
	if err != nil {
		log.Printf("[Render Engine] NVENC failed (%v). Falling back to CPU libx264...", err)

		cpuArgs := append([]string{}, baseArgs...)
		cpuArgs = append(cpuArgs,
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-threads", "2",
			"-crf", "23",
			"-c:a", "aac",
			"-b:a", "128k",
			outputPath,
		)

		cmdCPU := exec.Command("ffmpeg", cpuArgs...)
		cmdCPU.Stdout = os.Stdout
		cmdCPU.Stderr = os.Stderr
		if errCPU := cmdCPU.Run(); errCPU != nil {
			log.Printf("[Render Engine] CPU Render failed: %v", errCPU)
			publishFailed(rdb, plan.ProjectID, fmt.Sprintf("Erro ao renderizar com FFmpeg: %v", errCPU))
			return
		}
	}

	log.Printf("[Render Engine] Clip '%s' rendered successfully: %s", clipTitle, outputPath)
	publishClipCompleted(rdb, plan.ProjectID, outputPath, clipTitle, clipScore, startTime, endTime)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func publishProgress(rdb *redis.Client, projectID uint, status, message string, progress int) {
	payload, _ := json.Marshal(map[string]interface{}{
		"project_id": projectID,
		"status":     status,
		"message":    message,
		"progress":   progress,
	})
	rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: "stream:events:progress",
		Values: map[string]interface{}{"payload": string(payload)},
	})
}

func publishClipCompleted(rdb *redis.Client, projectID uint, outputPath, title string, score, start, end float64) {
	payload, _ := json.Marshal(map[string]interface{}{
		"project_id": projectID,
		"status":     "rendering",
		"files":      []string{outputPath},
		"clips": []map[string]interface{}{
			{
				"title":      title,
				"score":      score,
				"start_time": start,
				"end_time":   end,
				"video_url":  outputPath,
			},
		},
	})
	rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: "stream:events:clip_completed",
		Values: map[string]interface{}{"payload": string(payload)},
	})
}

func publishFailed(rdb *redis.Client, projectID uint, errorMsg string) {
	payload, _ := json.Marshal(map[string]interface{}{
		"project_id": projectID,
		"status":     "failed",
		"error":      errorMsg,
	})
	rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: "stream:events:failed",
		Values: map[string]interface{}{"payload": string(payload)},
	})
}
