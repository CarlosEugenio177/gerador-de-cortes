package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL       string
	RedisURL          string
	Port              string
	JWTSecret         string
}

func LoadConfig() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		// Use default identical to Python backend but without asyncpg
		dbUrl = "host=db user=postgres password=postgres dbname=clipforge port=5432 sslmode=disable"
	}

	redisUrl := os.Getenv("REDIS_URL")
	if redisUrl == "" {
		redisUrl = "redis://redis:6379/0"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret-key-do-not-use-in-prod"
	}

	return &Config{
		DatabaseURL: dbUrl,
		RedisURL:    redisUrl,
		Port:        port,
		JWTSecret:   jwtSecret,
	}
}
