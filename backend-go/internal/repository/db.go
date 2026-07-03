package repository

import (
	"log"
	"clipforge-gateway/internal/config"
	"clipforge-gateway/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB(cfg *config.Config) {
	var err error
	
	// Convert URL format if necessary. GORM postgres driver prefers DSN, 
	// but it can also parse postgres:// URLs if configured properly.
	// In config we set a DSN.
	dsn := cfg.DatabaseURL

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Auto-migrate tables
	err = DB.AutoMigrate(&models.Project{}, &models.Clip{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
}
