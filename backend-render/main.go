package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
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

var ctx = context.Background()

func main() {
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	log.Println("ClipForge Render Engine started. Listening on 'queue:render'...")

	for {
		result, err := rdb.BLPop(ctx, 0, "queue:render").Result()
		if err != nil {
			log.Printf("Error pulling from Redis: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		payload := result[1]
		var plan EditPlan
		if err := json.Unmarshal([]byte(payload), &plan); err != nil {
			log.Printf("Failed to unmarshal EditPlan: %v", err)
			continue
		}

		log.Printf("Received render task for Project %d", plan.ProjectID)
		publishProgress(rdb, plan.ProjectID, "rendering", "Iniciando renderização da inteligência artificial...", 85)

		// Parse operations to build FFmpeg command
		var startTime, endTime float64
		var subtitleFile string
		var keepSegments [][]float64
		var clipTitle string
		hasClip := false

		for _, op := range plan.Operations {
			switch op.Type {
			case "clip":
				startTime = op.Start
				endTime = op.End
				keepSegments = op.KeepSegments
				clipTitle = op.Title
				hasClip = true
			case "subtitle":
				subtitleFile = op.File
			}
		}

		if !hasClip {
			log.Printf("No clip operation found for Project %d. Skipping.", plan.ProjectID)
			publishFailed(rdb, plan.ProjectID, "Nenhuma operação de corte (clip) encontrada no plano.")
			continue
		}

		// Idempotency Lock: Prevent duplicate renders of the same clip timeframe
		lockKey := fmt.Sprintf("lock:render:project_%d:t_%.2f_%.2f:fmt_%s", plan.ProjectID, startTime, endTime, plan.VideoFormat)
		locked, err := rdb.SetNX(ctx, lockKey, "1", 1*time.Hour).Result()
		if err != nil || !locked {
			log.Printf("Clip '%s' for Project %d is already being rendered (lock exists on timeframe). Skipping duplicate job.", clipTitle, plan.ProjectID)
			continue
		}

		duration := endTime - startTime
		// Use a unique name based on title AND timestamps to prevent collision if titles are identical
		safeTitle := strings.ReplaceAll(clipTitle, ":", "x")
		outputPath := filepath.Join("uploads", fmt.Sprintf("project_%d_t%.0f_%.0f_%s_final.mp4", plan.ProjectID, startTime, endTime, safeTitle))
		
		// 1. Determine base crop from video_format
		var cropFilter string
		switch plan.VideoFormat {
		case "16:9":
			cropFilter = "" // Keep original (assuming horizontal)
		case "1:1":
			cropFilter = "crop=ih:ih"
		case "9:16":
			fallthrough
		default:
			cropFilter = "crop=ih*(9/16):ih"
		}

		vfFilters := cropFilter

		// 2. Add hardsubs if requested
		if subtitleFile != "" {
			safePath := filepath.ToSlash(subtitleFile)
			if vfFilters != "" {
				vfFilters += ","
			}
			vfFilters += fmt.Sprintf("ass='%s'", safePath)
		}

		// 3. Build Jump-Cut complex filters if keep_segments exists
		var afFilters string
		if plan.RemoveNoise {
			afFilters = "afftdn=nf=-25"
		}

		if len(keepSegments) > 0 {
			var selectParts []string
			for _, seg := range keepSegments {
				if len(seg) == 2 {
					selectParts = append(selectParts, fmt.Sprintf("between(t,%f,%f)", seg[0], seg[1]))
				}
			}
			
			if len(selectParts) > 0 {
				selectExpr := ""
				for i, p := range selectParts {
					if i > 0 {
						selectExpr += "+"
					}
					selectExpr += p
				}
				
				jumpCutV := fmt.Sprintf("select='%s',setpts=N/FRAME_RATE/TB", selectExpr)
				jumpCutA := fmt.Sprintf("aselect='%s',asetpts=N/SR/TB", selectExpr)
				
				if vfFilters != "" {
					vfFilters = jumpCutV + "," + vfFilters
				} else {
					vfFilters = jumpCutV
				}

				if afFilters != "" {
					afFilters = afFilters + "," + jumpCutA
				} else {
					afFilters = jumpCutA
				}
			}
		}

		ffmpegArgs := []string{
			"-y",
			"-ss", fmt.Sprintf("%f", startTime),
			"-i", plan.OriginalFile,
			"-t", fmt.Sprintf("%f", duration),
		}

		if vfFilters != "" {
			ffmpegArgs = append(ffmpegArgs, "-vf", vfFilters)
		}
		if afFilters != "" {
			ffmpegArgs = append(ffmpegArgs, "-af", afFilters)
		}

		ffmpegArgs = append(ffmpegArgs, 
			"-c:v", "h264_nvenc",
			"-preset", "fast",
			"-c:a", "aac",
			outputPath,
		)

		// Optimization: Check if the exact same file already exists (from a previous process)
		if _, err := os.Stat(outputPath); err == nil {
			log.Printf("Optimization: File %s already exists. Skipping GPU render.", outputPath)
			rdb.Del(ctx, lockKey)
			publishClipCompleted(rdb, plan.ProjectID, []string{outputPath}, clipTitle)
			continue
		}

		cmd := exec.Command("ffmpeg", ffmpegArgs...)
		
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		
		log.Printf("Running FFmpeg (GPU NVENC): %s", cmd.String())
		if err := cmd.Run(); err != nil {
			log.Printf("FFmpeg failed: %v", err)
			publishFailed(rdb, plan.ProjectID, "Falha na renderização de vídeo pelo FFmpeg.")
			rdb.Del(ctx, lockKey) // Remove lock if failed so it can be retried
			continue
		}

		log.Printf("Project %d - Clip '%s' completed successfully.", plan.ProjectID, clipTitle)
		rdb.Del(ctx, lockKey)
		
		publishClipCompleted(rdb, plan.ProjectID, []string{outputPath}, clipTitle)
	}
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

func publishClipCompleted(rdb *redis.Client, projectID uint, files []string, title string) {
	payload, _ := json.Marshal(map[string]interface{}{
		"project_id": projectID,
		"status":     "rendering",
		"files":      files,
		"clips": []map[string]interface{}{
			{"title": title},
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
