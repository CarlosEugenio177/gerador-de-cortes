package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"clipforge-gateway/internal/ai"
	"clipforge-gateway/internal/config"
	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
	websocket_pkg "clipforge-gateway/pkg/websocket"

	"github.com/redis/go-redis/v9"
)

type PipelineService struct {
	cfg          *config.Config
	redisClient  *redis.Client
	transcriber  *ai.CloudTranscriptionService
	analyzer     *ai.ViralAnalyzerService
	subtitles    *ai.SubtitleGenerator
	cancelFuncs  map[uint]context.CancelFunc
	cancelMutex  sync.Mutex
}

var GlobalPipeline *PipelineService

func InitPipelineService(cfg *config.Config, rdb *redis.Client) *PipelineService {
	GlobalPipeline = &PipelineService{
		cfg:         cfg,
		redisClient: rdb,
		transcriber: ai.NewCloudTranscriptionService(cfg.OpenAIKey, cfg.GroqKey),
		analyzer:    ai.NewViralAnalyzerService(cfg.GeminiKey, cfg.OpenAIKey, cfg.GroqKey, cfg.OpenRouterKey, cfg.OpenRouterModel),
		subtitles:   ai.NewSubtitleGenerator(),
		cancelFuncs: make(map[uint]context.CancelFunc),
	}
	return GlobalPipeline
}

func (p *PipelineService) RegisterCancel(projectID uint, cancel context.CancelFunc) {
	p.cancelMutex.Lock()
	p.cancelFuncs[projectID] = cancel
	p.cancelMutex.Unlock()
}

func (p *PipelineService) CancelProject(projectID uint) {
	p.cancelMutex.Lock()
	if cancel, ok := p.cancelFuncs[projectID]; ok {
		cancel()
		delete(p.cancelFuncs, projectID)
	}
	p.cancelMutex.Unlock()

	// Update DB
	repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", models.StatusFailed)
	p.broadcastProgress(projectID, models.StatusFailed, "Processamento cancelado pelo usuário", 0)
}

func (p *PipelineService) RunPipelineAsync(projectID uint, videoPath, prompt, aspectRatio, subtitleStyle string, clipQuantity int) {
	go func() {
		ctx, cancel := context.WithCancel(context.Background())
		p.RegisterCancel(projectID, cancel)
		defer func() {
			p.cancelMutex.Lock()
			delete(p.cancelFuncs, projectID)
			p.cancelMutex.Unlock()
		}()

		if err := p.executePipeline(ctx, projectID, videoPath, prompt, aspectRatio, subtitleStyle, clipQuantity); err != nil {
			if ctx.Err() != nil {
				log.Printf("[Pipeline] Project %d cancelled", projectID)
				return
			}
			log.Printf("[Pipeline] Project %d failed with error: %v", projectID, err)
			repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", models.StatusFailed)
			p.broadcastProgress(projectID, models.StatusFailed, fmt.Sprintf("Erro no processamento: %v", err), 0)
		}
	}()
}

func (p *PipelineService) executePipeline(ctx context.Context, projectID uint, videoPath, prompt, aspectRatio, subtitleStyle string, clipQuantity int) error {
	log.Printf("[Pipeline] Starting pipeline for project %d (Video: %s)", projectID, videoPath)

	if aspectRatio == "" {
		aspectRatio = "9:16"
	}
	if subtitleStyle == "" {
		subtitleStyle = "Neon"
	}
	if clipQuantity <= 0 {
		clipQuantity = 3
	}

	// ----------------------------------------------------
	// Step 1: Preprocessing (Extract MP3 Audio)
	// ----------------------------------------------------
	p.updateStatus(projectID, models.StatusPreprocessing, "Extraindo áudio do vídeo...", 30)

	ext := filepath.Ext(videoPath)
	base := strings.TrimSuffix(videoPath, ext)
	audioPath := base + "_audio.mp3"
	proxyPath := base + "_proxy.mp4"

	// 1.1 Extract MP3 audio (lightweight, ultra-fast and capped to 2 CPU threads)
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		cmdAudio := exec.CommandContext(ctx, "ffmpeg", "-y", "-threads", "2", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-q:a", "5", "-ar", "16000", "-ac", "1", audioPath)
		if err := cmdAudio.Run(); err != nil {
			return fmt.Errorf("failed to extract audio: %w", err)
		}
	}

	// 1.2 Generate preview proxy asynchronously in background so transcription starts immediately
	go func() {
		if _, err := os.Stat(proxyPath); os.IsNotExist(err) {
			cmdProxy := exec.Command("ffmpeg", "-y", "-i", videoPath, "-vf", "scale=-2:480", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-c:a", "aac", "-b:a", "96k", proxyPath)
			_ = cmdProxy.Run()
		}
	}()

	// Save initial proxy and audio in DB
	repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Updates(map[string]interface{}{
		"proxy_file": proxyPath,
		"audio_file": audioPath,
	})

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// ----------------------------------------------------
	// Step 2: Cloud Transcription (with Local Disk Cache)
	// ----------------------------------------------------
	transcriptPath := videoPath + ".transcript.json"
	var transcript *ai.TranscriptionResult

	if data, err := os.ReadFile(transcriptPath); err == nil && len(data) > 0 {
		log.Printf("[Pipeline] Project %d using cached transcript from %s", projectID, transcriptPath)
		p.updateStatus(projectID, models.StatusTranscribing, "Transcrição carregada do cache instantaneamente!", 55)
		var cached ai.TranscriptionResult
		if err := json.Unmarshal(data, &cached); err == nil && (len(cached.Words) > 0 || len(cached.Segments) > 0) {
			transcript = &cached
		}
	}

	if transcript == nil {
		p.updateStatus(projectID, models.StatusTranscribing, "Transcrevendo fala com timestamps exatos...", 50)
		var err error
		transcript, err = p.transcriber.TranscribeAudio(audioPath)
		if err != nil {
			return fmt.Errorf("transcription failed: %w", err)
		}

		// Save transcript JSON to disk for instant future reprocessing
		if data, err := json.MarshalIndent(transcript, "", "  "); err == nil {
			_ = os.WriteFile(transcriptPath, data, 0644)
		}
	}

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// ----------------------------------------------------
	// Step 3: LLM Viral Moment Discovery
	// ----------------------------------------------------
	p.updateStatus(projectID, models.StatusAnalyzing, "Descobrindo momentos virais e ganchos com IA...", 75)

	viralClips, err := p.analyzer.AnalyzeViralClips(transcript, prompt, clipQuantity)
	if err != nil {
		return fmt.Errorf("viral analysis failed: %w", err)
	}

	log.Printf("[Pipeline] Project %d found %d viral clips", projectID, len(viralClips))

	// Pre-create Clip records in DB
	var project models.Project
	repository.DB.First(&project, projectID)

	for _, vc := range viralClips {
		pid := projectID
		clip := models.Clip{
			ProjectID:   &pid,
			ProjectName: project.Title,
			Title:       vc.Title,
			Description: fmt.Sprintf("%s\n\nLegenda sugerida: %s\nHashtags: %s", vc.HookSummary, vc.SuggestedCaptions, strings.Join(vc.SuggestedHashtags, " ")),
			Score:       float64(vc.ViralScore),
			StartTime:   vc.StartTime,
			EndTime:     vc.EndTime,
			VideoURL:    "",
		}
		repository.DB.Create(&clip)
	}

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// ----------------------------------------------------
	// Step 4: Generate ASS Subtitles & Dispatch Render Jobs
	// ----------------------------------------------------
	p.updateStatus(projectID, models.StatusRendering, "Renderizando cortes em 9:16 e aplicando legendas animadas...", 88)

	os.MkdirAll(p.cfg.ClipsDir, os.ModePerm)

	for idx, vc := range viralClips {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		progressPct := 75 + int(float64(idx)/float64(len(viralClips))*20)
		p.updateStatus(projectID, models.StatusRendering, fmt.Sprintf("Renderizando corte %d de %d: %s", idx+1, len(viralClips), vc.Title), progressPct)

		// 4.1 Generate ASS Subtitle File for this clip
		subPath := filepath.Join(p.cfg.UploadDir, fmt.Sprintf("project_%d_clip_%d.ass", projectID, vc.ID))
		_ = p.subtitles.GenerateASSForClip(transcript.Words, vc.StartTime, vc.EndTime, subtitleStyle, subPath)

		// 4.2 Build EditPlan
		plan := ai.EditPlan{
			ProjectID:    projectID,
			OriginalFile: videoPath,
			VideoFormat:  aspectRatio,
			Operations: []ai.EditOperation{
				{
					Type:  "clip",
					Start: vc.StartTime,
					End:   vc.EndTime,
					Title: vc.Title,
					Score: float64(vc.ViralScore),
				},
				{
					Type: "subtitle",
					File: subPath,
				},
			},
		}

		// 4.3 Dispatch to Redis Stream stream:render (or render directly if Redis is not used)
		if p.redisClient != nil {
			planBytes, _ := json.Marshal(plan)
			p.redisClient.XAdd(ctx, &redis.XAddArgs{
				Stream: "stream:render",
				Values: map[string]interface{}{
					"payload": string(planBytes),
				},
			})
		} else {
			// Fallback: Local direct render
			outputPath := filepath.Join(p.cfg.ClipsDir, fmt.Sprintf("clip_%d_%d.mp4", projectID, vc.ID))
			p.renderDirect(ctx, videoPath, subPath, outputPath, vc.StartTime, vc.EndTime, aspectRatio)
			
			// Update DB clip record
			repository.DB.Model(&models.Clip{}).
				Where("project_id = ? AND title = ?", projectID, vc.Title).
				Update("file_path", outputPath)
		}
	}

	// If using Redis, the render engine will emit stream:events:clip_completed and mark as COMPLETED
	// If direct rendering, mark completed now
	if p.redisClient == nil {
		p.updateStatus(projectID, models.StatusCompleted, "Todos os cortes foram gerados com sucesso!", 100)
	}

	return nil
}

func (p *PipelineService) renderDirect(ctx context.Context, inputVideo, subPath, outputPath string, start, end float64, aspectRatio string) {
	duration := end - start
	if duration <= 0 {
		duration = 15.0
	}

	var cropFilter string
	switch aspectRatio {
	case "1:1":
		cropFilter = "crop=ih:ih:(iw-ow)/2:0,scale=1080:1080"
	case "16:9":
		cropFilter = "scale=1920:1080"
	default: // 9:16
		cropFilter = "crop=ih*(9/16):ih:(iw-ow)/2:0,scale=1080:1920"
	}

	vf := cropFilter
	if subPath != "" {
		cleanSub := filepath.ToSlash(subPath)
		vf += fmt.Sprintf(",subtitles='%s'", cleanSub)
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", "-y",
		"-ss", fmt.Sprintf("%.2f", start),
		"-i", inputVideo,
		"-t", fmt.Sprintf("%.2f", duration),
		"-vf", vf,
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "22",
		"-c:a", "aac",
		"-b:a", "128k",
		outputPath,
	)

	_ = cmd.Run()
}

func (p *PipelineService) UpdateStatus(projectID uint, status models.ProjectStatus, message string, progress int) {
	p.updateStatus(projectID, status, message, progress)
}

func (p *PipelineService) updateStatus(projectID uint, status models.ProjectStatus, message string, progress int) {
	repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", status)
	p.broadcastProgress(projectID, status, message, progress)
}

func (p *PipelineService) broadcastProgress(projectID uint, status models.ProjectStatus, message string, progress int) {
	if websocket_pkg.DefaultHub == nil {
		return
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"project_id": projectID,
		"status":     string(status),
		"message":    message,
		"progress":   progress,
		"timestamp":  time.Now().Format(time.RFC3339),
	})

	websocket_pkg.DefaultHub.Broadcast(fmt.Sprintf("%d", projectID), string(payload))
}
