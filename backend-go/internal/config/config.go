package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL     string
	RedisURL        string
	Port            string
	JWTSecret       string
	OpenAIKey       string
	GroqKey         string
	GeminiKey       string
	OpenRouterKey   string
	OpenRouterModel string
	UploadDir       string
	ClipsDir        string
}

func LoadConfig() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
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

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	clipsDir := os.Getenv("CLIPS_DIR")
	if clipsDir == "" {
		clipsDir = "./uploads/clips"
	}

	openRouterModel := os.Getenv("OPENROUTER_MODEL")
	if openRouterModel == "" {
		openRouterModel = "meta-llama/llama-3.3-70b-instruct:free"
	}

	return &Config{
		DatabaseURL:     dbUrl,
		RedisURL:        redisUrl,
		Port:            port,
		JWTSecret:       jwtSecret,
		OpenAIKey:       os.Getenv("OPENAI_API_KEY"),
		GroqKey:         os.Getenv("GROQ_API_KEY"),
		GeminiKey:       os.Getenv("GEMINI_API_KEY"),
		OpenRouterKey:   os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterModel: openRouterModel,
		UploadDir:       uploadDir,
		ClipsDir:        clipsDir,
	}
}
