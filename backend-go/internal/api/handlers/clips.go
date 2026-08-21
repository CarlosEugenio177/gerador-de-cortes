package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"clipforge-gateway/internal/ai"
	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
	"clipforge-gateway/internal/services"

	"github.com/gofiber/fiber/v2"
)

func GetAllClips(c *fiber.Ctx) error {
	var clips []models.Clip
	if err := repository.DB.Order("id desc").Find(&clips).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch clips"})
	}
	return c.JSON(clips)
}

func DeleteClip(c *fiber.Ctx) error {
	id := c.Params("id")
	var clip models.Clip
	if err := repository.DB.First(&clip, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Clip not found"})
	}

	if err := repository.DB.Delete(&clip).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete clip"})
	}

	if clip.VideoURL != "" {
		_ = os.Remove(clip.VideoURL)
	}

	return c.JSON(fiber.Map{"status": "deleted"})
}

func ExportClipEDL(c *fiber.Ctx) error {
	id := c.Params("id")
	var clip models.Clip
	if err := repository.DB.First(&clip, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Clip not found"})
	}

	var project models.Project
	if clip.ProjectID != nil {
		repository.DB.First(&project, *clip.ProjectID)
	}

	edlContent := services.GlobalExporter.GenerateEDL(clip, project.OriginalFile, 30.0)
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"clip_%s.edl\"", id))
	c.Set("Content-Type", "text/plain; charset=utf-8")
	return c.SendString(edlContent)
}

func ExportClipSRT(c *fiber.Ctx) error {
	id := c.Params("id")
	var clip models.Clip
	if err := repository.DB.First(&clip, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Clip not found"})
	}

	var project models.Project
	var words []ai.Word
	if clip.ProjectID != nil {
		repository.DB.First(&project, *clip.ProjectID)
		if project.OriginalFile != "" {
			transcriptPath := project.OriginalFile + ".transcript.json"
			if data, err := os.ReadFile(transcriptPath); err == nil {
				var t ai.TranscriptionResult
				if json.Unmarshal(data, &t) == nil {
					words = t.Words
				}
			}
		}
	}

	srtContent := services.GlobalExporter.GenerateSRT(words, clip.StartTime, clip.EndTime)
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"clip_%s.srt\"", id))
	c.Set("Content-Type", "text/plain; charset=utf-8")
	return c.SendString(srtContent)
}

func ExportClipBundle(c *fiber.Ctx) error {
	id := c.Params("id")
	var clip models.Clip
	if err := repository.DB.First(&clip, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Clip not found"})
	}

	var project models.Project
	var words []ai.Word
	if clip.ProjectID != nil {
		repository.DB.First(&project, *clip.ProjectID)
		if project.OriginalFile != "" {
			transcriptPath := project.OriginalFile + ".transcript.json"
			if data, err := os.ReadFile(transcriptPath); err == nil {
				var t ai.TranscriptionResult
				if json.Unmarshal(data, &t) == nil {
					words = t.Words
				}
			}
		}
	}

	zipBytes, err := services.GlobalExporter.CreateEditorBundleZip(clip, project, words)
	if err != nil {
		log.Printf("Failed to generate zip bundle: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create editor zip bundle"})
	}

	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"clip_%s_editor_pack.zip\"", id))
	c.Set("Content-Type", "application/zip")
	return c.Send(zipBytes)
}
