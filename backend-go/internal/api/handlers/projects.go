package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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
	
	filename := fmt.Sprintf("%s_%s", uuid.New().String(), file.Filename)
	savePath := filepath.Join(uploadDir, filename)
	
	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
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

func DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	// Unlink clips instead of deleting them
	if err := repository.DB.Model(&models.Clip{}).Where("project_id = ?", id).Update("project_id", nil).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unlink clips from project"})
	}

	if err := repository.DB.Delete(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete project"})
	}

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
