package handlers

import (
	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"

	"github.com/gofiber/fiber/v2"
)

func GetBrandKits(c *fiber.Ctx) error {
	var kits []models.BrandKit
	if err := repository.DB.Find(&kits).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch brand kits"})
	}
	return c.JSON(kits)
}

func GetSubtitlePresets(c *fiber.Ctx) error {
	var presets []models.SubtitlePreset
	if err := repository.DB.Find(&presets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch subtitle presets"})
	}
	return c.JSON(presets)
}

func GetExportProfiles(c *fiber.Ctx) error {
	var profiles []models.ExportProfile
	if err := repository.DB.Find(&profiles).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch export profiles"})
	}
	return c.JSON(profiles)
}
