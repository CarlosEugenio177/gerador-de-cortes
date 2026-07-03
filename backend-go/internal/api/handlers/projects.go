package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
	"clipforge-gateway/internal/worker"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
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
		Status:       "processing",
	}

	if err := repository.DB.Create(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create project record"})
	}

	// Dispatch to Python AI Worker via Redis
	err = worker.DispatchExtractClips(project.ID, savePath, prompt)
	if err != nil {
		// Log error but don't fail request, worker might be down temporarily
		fmt.Printf("Warning: failed to dispatch to celery: %v\n", err)
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

func DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var project models.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
	}

	// Tell GORM to also delete the associated Clips (avoids foreign key constraints)
	if err := repository.DB.Select("Clips").Delete(&project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete project"})
	}

	return c.JSON(fiber.Map{"status": "deleted"})
}
