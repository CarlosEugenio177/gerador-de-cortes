package handlers

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
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

	// Deep Deletion - Remove associated file from disk
	if clip.VideoURL != "" {
		err := os.Remove(clip.VideoURL)
		if err != nil {
			log.Printf("Warning: Failed to delete physical file %s: %v", clip.VideoURL, err)
		} else {
			log.Printf("Successfully deleted physical file: %s", clip.VideoURL)
		}
	}

	return c.JSON(fiber.Map{"status": "deleted"})
}
