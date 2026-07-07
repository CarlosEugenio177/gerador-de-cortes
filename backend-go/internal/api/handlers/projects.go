package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
	"clipforge-gateway/internal/worker"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

func CreateProject(c *fiber.Ctx) error {
	// Parse multipart form
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Video file is required"})
	}

	title := c.FormValue("title", "Untitled Project")
	prompt := c.FormValue("prompt", "")

	// Save file locally (in production this should go to S3/Cloud Storage)
	uploadDir := "./uploads"
	os.MkdirAll(uploadDir, os.ModePerm)
	
	tempFilename := fmt.Sprintf("temp_%s_%s", uuid.New().String(), file.Filename)
	tempPath := filepath.Join(uploadDir, tempFilename)
	
	if err := c.SaveFile(file, tempPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
	}

	// Calculate SHA256 hash
	f, err := os.Open(tempPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read saved file"})
	}
	h := sha256.New()
	io.Copy(h, f)
	f.Close()
	hashStr := hex.EncodeToString(h.Sum(nil))

	// Determine final path
	finalFilename := hashStr + filepath.Ext(file.Filename)
	savePath := filepath.Join(uploadDir, finalFilename)

	// Check if already exists (Deduplication)
	if _, err := os.Stat(savePath); err == nil {
		// File already exists, reuse it and delete temp file
		os.Remove(tempPath)
	} else {
		// Move temp file to final destination
		os.Rename(tempPath, savePath)
	}

	// Create DB Record
	project := models.Project{
		Title:        title,
		Prompt:       prompt,
		OriginalFile: savePath,
		Status:       models.StatusPreprocessing,
	}

	if err := repository.DB.Create(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create project record"})
	}

	// Dispatch async preprocessing and extraction
	go worker.PreprocessVideoAsync(project.ID, savePath, prompt)

	return c.Status(fiber.StatusCreated).JSON(project)
}

func GetProjects(c *fiber.Ctx) error {
	var projects []models.Project
	if err := repository.DB.Preload("Clips").Order("created_at desc").Find(&projects).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list projects"})
	}

	return c.JSON(projects)
}

func GetProject(c *fiber.Ctx) error {
	id := c.Params("id")
	var project models.Project
	
	if err := repository.DB.Preload("Clips").First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	return c.JSON(project)
}

func GetProjectState(c *fiber.Ctx) error {
	id := c.Params("id")
	var project models.Project
	
	if err := repository.DB.Preload("Clips").First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	var transcript interface{} = nil
	if project.OriginalFile != "" {
		transcriptPath := project.OriginalFile + ".transcript.json"
		if data, err := os.ReadFile(transcriptPath); err == nil {
			var t interface{}
			if json.Unmarshal(data, &t) == nil {
				transcript = t
			}
		}
	}

	return c.JSON(fiber.Map{
		"project": project,
		"transcript": transcript,
	})
}

func DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	// Unlink clips instead of deleting them (or delete them if preferred, but unlinking is safer if clips are shared)
	if err := repository.DB.Model(&models.Clip{}).Where("project_id = ?", id).Update("project_id", nil).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unlink clips from project"})
	}

	if err := repository.DB.Delete(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete project"})
	}

	// Deep Deletion - Remove associated files
	go func(p models.Project) {
		if p.OriginalFile != "" {
			os.Remove(p.OriginalFile)
			os.Remove(p.OriginalFile + ".transcript.json")
			os.Remove(p.OriginalFile + ".thumb.jpg")
			os.Remove(p.OriginalFile + ".waveform.png")
		}
		if p.ProxyFile != "" {
			os.Remove(p.ProxyFile)
		}
		if p.AudioFile != "" {
			os.Remove(p.AudioFile)
		}
	}(project)

	return c.JSON(fiber.Map{"status": "deleted"})
}

func ReprocessProject(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.Preload("Clips").First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	type ReprocessReq struct {
		Prompt string `json:"prompt"`
	}
	var req ReprocessReq
	if err := c.BodyParser(&req); err == nil && req.Prompt != "" {
		project.Prompt = req.Prompt
	}

	// Update project status to processing
	project.Status = models.StatusPreprocessing
	if err := repository.DB.Save(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update project status"})
	}

	// Tell AI to avoid existing clips
	prompt := project.Prompt
	if len(project.Clips) > 0 {
		prompt += "\n\nIMPORTANT INSTRUCTION: The following clips have already been generated for this video. Do NOT generate these exact same clips again. Find NEW, different, and interesting moments to highlight. Previously generated clips:\n"
		for _, clip := range project.Clips {
			prompt += fmt.Sprintf("- '%s' (from %.2fs to %.2fs)\n", clip.Title, clip.StartTime, clip.EndTime)
		}
	}

	// Dispatch to Python AI Worker via Redis with the extended prompt
	err := worker.DispatchExtractClips(project.ID, project.OriginalFile, project.ProxyFile, project.AudioFile, prompt)
	if err != nil {
		fmt.Printf("Warning: failed to dispatch to worker: %v\n", err)
	}

	return c.JSON(fiber.Map{"status": "processing"})
}

// CancelProject cancels an ongoing project processing
func CancelProject(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	project.Status = models.StatusFailed
	if err := repository.DB.Save(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update project status"})
	}

	// Trigger cancellation of FFmpeg processes if they are running
	worker.TriggerCancel(project.ID)

	// Set a cancel flag in Redis for the Python worker to check
	worker.RedisClient.Set(context.Background(), fmt.Sprintf("cancel:%d", project.ID), "1", 24*time.Hour)

	return c.JSON(fiber.Map{"message": "Project cancelled"})
}

func TranscribeProject(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	project.Status = models.StatusTranscribing
	repository.DB.Save(&project)

	// Dispatch to Redis
	payload := fiber.Map{
		"project_id": project.ID,
		"file_path":  project.OriginalFile,
		"type":       "transcribe",
	}
	bytes, _ := json.Marshal(payload)
	worker.RedisClient.XAdd(context.Background(), &redis.XAddArgs{
		Stream: "stream:analyze",
		Values: map[string]interface{}{
			"payload": string(bytes),
		},
	})

	return c.JSON(fiber.Map{"status": "transcribing"})
}

func GetTranscript(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	transcriptPath := project.OriginalFile + ".transcript.json"
	if _, err := os.Stat(transcriptPath); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Transcript not found"})
	}

	return c.SendFile(transcriptPath)
}

func SaveTranscript(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	// We assume body is raw JSON array/object of the transcript
	body := c.Body()
	transcriptPath := project.OriginalFile + ".transcript.json"
	
	err := os.WriteFile(transcriptPath, body, 0644)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save transcript"})
	}

	return c.JSON(fiber.Map{"status": "saved"})
}

func RenderCustomProject(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	type StyleConfig struct {
		SubtitleStyle string `json:"subtitle_style"`
		PrimaryColor  string `json:"primary_color"`
		FontSize      int    `json:"font_size"`
		Animation     string `json:"animation"`
		VideoFormat   string `json:"video_format"`
		RemoveNoise   bool   `json:"remove_noise"`
	}

	var styleConfig StyleConfig
	if err := c.BodyParser(&styleConfig); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	project.Status = models.StatusRendering
	repository.DB.Save(&project)

	// Dispatch to Redis
	payload := fiber.Map{
		"project_id":   project.ID,
		"file_path":    project.OriginalFile,
		"type":         "render_custom",
		"style_config": styleConfig,
	}
	bytes, _ := json.Marshal(payload)
	worker.RedisClient.XAdd(context.Background(), &redis.XAddArgs{
		Stream: "stream:analyze",
		Values: map[string]interface{}{
			"payload": string(bytes),
		},
	})

	return c.JSON(fiber.Map{"status": "processing"})
}
