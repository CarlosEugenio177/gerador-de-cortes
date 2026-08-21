package repository

import (
	"log"
	"time"
	"clipforge-gateway/internal/config"
	"clipforge-gateway/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB(cfg *config.Config) {
	var err error
	
	// Convert URL format if necessary. GORM postgres driver prefers DSN.
	dsn := cfg.DatabaseURL

	// Connect with retry
	for i := 0; i < 15; i++ {
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("Waiting for database connection (attempt %d/15)...", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to database after retries: %v", err)
	}

	log.Println("Connected to database successfully")

	// Auto-migrate tables
	err = DB.AutoMigrate(
		&models.Project{},
		&models.Clip{},
		&models.AuditLog{},
		&models.BrandKit{},
		&models.SubtitlePreset{},
		&models.ExportProfile{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
}
