package worker

import (
	"context"
	"encoding/json"
	"log"
	"clipforge-gateway/internal/config"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

func ConnectRedis(cfg *config.Config) {
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}

	RedisClient = redis.NewClient(opts)

	_, err = RedisClient.Ping(context.Background()).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis successfully")
}

// CeleryTask represents the payload Celery expects (Protocol v1)
type CeleryTask struct {
	ID         string                 `json:"id"`
	Task       string                 `json:"task"`
	Args       []interface{}          `json:"args"`
	Kwargs     interface{}            `json:"kwargs"`
	Retries    int                    `json:"retries"`
	ETA        interface{}            `json:"eta"`
	Properties map[string]interface{} `json:"properties"`
	Headers    map[string]interface{} `json:"headers"`
}

// DispatchExtractClips sends a task to the Python worker via queue:analyze
func DispatchExtractClips(projectID uint, videoPath string, proxyPath string, audioPath string, prompt string) error {
	payload := map[string]interface{}{
		"project_id": projectID,
		"file_path":  videoPath,
		"proxy_path": proxyPath,
		"audio_path": audioPath,
		"prompt":     prompt,
	}
	
	bytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	err = RedisClient.XAdd(context.Background(), &redis.XAddArgs{
		Stream: "stream:analyze",
		Values: map[string]interface{}{
			"payload": string(bytes),
		},
	}).Err()
	if err != nil {
		log.Printf("Failed to dispatch task to stream: %v\n", err)
		return err
	}
	log.Printf("Task dispatched for project %d to stream:analyze\n", projectID)
	return nil
}
