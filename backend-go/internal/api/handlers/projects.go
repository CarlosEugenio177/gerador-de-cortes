package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
	"clipforge-gateway/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ProcessURLRequest struct {
	URL           string `json:"url"`
	AspectRatio   string `json:"aspect_ratio"`
	SubtitleStyle string `json:"subtitle_style"`
	ClipQuantity  int    `json:"clip_quantity"`
	Prompt        string `json:"prompt"`
}

type AnalyzeURLRequest struct {
	URL string `json:"url"`
}

func AnalyzeURL(c *fiber.Ctx) error {
	var req AnalyzeURLRequest
	if err := c.BodyParser(&req); err != nil || req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid URL parameter"})
	}

	downloader := services.NewDownloaderService("./uploads")
	info, err := downloader.GetVideoInfo(req.URL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(info)
}

func ProcessURL(c *fiber.Ctx) error {
	var req ProcessURLRequest
	if err := c.BodyParser(&req); err != nil || req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid URL request body"})
	}

	uploadDir := "./uploads"
	os.MkdirAll(uploadDir, os.ModePerm)

	downloader := services.NewDownloaderService(uploadDir)
	info, _ := downloader.GetVideoInfo(req.URL)

	title := "Video Web"
	if info != nil && info.Title != "" {
		title = info.Title
	}

	// Create project in DB
	project := models.Project{
		Title:    title,
		Prompt:   req.Prompt,
		Status:   models.ProjectStatus("DOWNLOADING"),
		Duration: 0,
	}
	if info != nil {
		project.Duration = info.Duration
	}

	if err := repository.DB.Create(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create project"})
	}

	// Download async and trigger pipeline
	go func() {
		// Emit initial downloading event
		if services.GlobalPipeline != nil {
			services.GlobalPipeline.UpdateStatus(project.ID, models.ProjectStatus("DOWNLOADING"), "Baixando vídeo do YouTube em alta resolução...", 15)
		}

		downloadedPath, err := downloader.DownloadMedia(req.URL)
		if err != nil {
			log.Printf("Failed to download video for project %d: %v", project.ID, err)
			repository.DB.Model(&models.Project{}).Where("id = ?", project.ID).Update("status", models.StatusFailed)
			if services.GlobalPipeline != nil {
				services.GlobalPipeline.UpdateStatus(project.ID, models.StatusFailed, fmt.Sprintf("Erro ao baixar vídeo: %v", err), 0)
			}
			return
		}

		repository.DB.Model(&models.Project{}).Where("id = ?", project.ID).Updates(map[string]interface{}{
			"original_file": downloadedPath,
			"status":        models.StatusPreprocessing,
		})

		if services.GlobalPipeline != nil {
			services.GlobalPipeline.RunPipelineAsync(
				project.ID,
				downloadedPath,
				req.Prompt,
				req.AspectRatio,
				req.SubtitleStyle,
				req.ClipQuantity,
			)
		}
	}()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"project_id": project.ID,
		"status":     "queued",
		"project":    project,
	})
}

func CreateProject(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Video file is required"})
	}

	title := c.FormValue("title", file.Filename)
	prompt := c.FormValue("prompt", "")
	aspectRatio := c.FormValue("aspect_ratio", "9:16")
	subtitleStyle := c.FormValue("subtitle_style", "Neon")
	clipQuantity, _ := strconv.Atoi(c.FormValue("clip_quantity", "3"))

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{
		".mp4": true, ".mov": true, ".mkv": true, ".avi": true,
		".webm": true, ".flv": true, ".wmv": true, ".m4v": true,
	}
	if !allowedExts[ext] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Formato de arquivo não suportado. Por favor envie um vídeo (.mp4, .mov, .mkv, .avi, .webm).",
		})
	}

	uploadDir := "./uploads"
	os.MkdirAll(uploadDir, os.ModePerm)

	tempFilename := fmt.Sprintf("temp_%s_%s", uuid.New().String()[:8], file.Filename)
	tempPath := filepath.Join(uploadDir, tempFilename)

	if err := c.SaveFile(file, tempPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
	}

	// Calculate SHA256 hash for deduplication
	f, err := os.Open(tempPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read file"})
	}
	h := sha256.New()
	io.Copy(h, f)
	f.Close()
	hashStr := hex.EncodeToString(h.Sum(nil))

	finalFilename := hashStr + filepath.Ext(file.Filename)
	savePath := filepath.Join(uploadDir, finalFilename)

	if _, err := os.Stat(savePath); err == nil {
		os.Remove(tempPath)
	} else {
		os.Rename(tempPath, savePath)
	}

	project := models.Project{
		Title:        title,
		Prompt:       prompt,
		OriginalFile: savePath,
		Status:       models.StatusPreprocessing,
	}

	if err := repository.DB.Create(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create project"})
	}

	// Trigger Pipeline in pure Go
	if services.GlobalPipeline != nil {
		services.GlobalPipeline.RunPipelineAsync(
			project.ID,
			savePath,
			prompt,
			aspectRatio,
			subtitleStyle,
			clipQuantity,
		)
	}

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
		"project":    project,
		"transcript": transcript,
	})
}

func DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	// Delete associated clips
	repository.DB.Where("project_id = ?", id).Delete(&models.Clip{})
	repository.DB.Delete(&project)

	// Clean physical files
	go func(p models.Project) {
		if p.OriginalFile != "" {
			os.Remove(p.OriginalFile)
			os.Remove(p.OriginalFile + ".transcript.json")
			os.Remove(p.OriginalFile + "_audio.mp3")
			os.Remove(p.OriginalFile + "_audio.wav")
			os.Remove(p.OriginalFile + "_proxy.mp4")
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
		Prompt        string `json:"prompt"`
		AspectRatio   string `json:"aspect_ratio"`
		SubtitleStyle string `json:"subtitle_style"`
		ClipQuantity  int    `json:"clip_quantity"`
	}
	var req ReprocessReq
	if err := c.BodyParser(&req); err == nil {
		if req.Prompt != "" {
			project.Prompt = req.Prompt
		}
	}

	project.Status = models.StatusPreprocessing
	repository.DB.Save(&project)

	if services.GlobalPipeline != nil {
		services.GlobalPipeline.RunPipelineAsync(
			project.ID,
			project.OriginalFile,
			project.Prompt,
			req.AspectRatio,
			req.SubtitleStyle,
			req.ClipQuantity,
		)
	}

	return c.JSON(fiber.Map{"status": "processing"})
}

func CancelProject(c *fiber.Ctx) error {
	id := c.Params("id")
	pid, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid project ID"})
	}

	if services.GlobalPipeline != nil {
		services.GlobalPipeline.CancelProject(uint(pid))
	}

	return c.JSON(fiber.Map{"message": "Project cancelled"})
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

	body := c.Body()
	transcriptPath := project.OriginalFile + ".transcript.json"
	if err := os.WriteFile(transcriptPath, body, 0644); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save transcript"})
	}

	return c.JSON(fiber.Map{"status": "saved"})
}
