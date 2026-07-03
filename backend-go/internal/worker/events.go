package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
	websocket_pkg "clipforge-gateway/pkg/websocket"
)

type EventPayload struct {
	ProjectID interface{} `json:"project_id"`
	Status    string      `json:"status"`
	Message   string      `json:"message,omitempty"`
	Progress  int         `json:"progress,omitempty"`
	Error     string      `json:"error,omitempty"`
	Files     []string    `json:"files,omitempty"`
	Clips     []ClipData  `json:"clips,omitempty"`
}

type ClipData struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Score       float64 `json:"score"`
	StartTime   float64 `json:"start_time"`
	EndTime     float64 `json:"end_time"`
	VideoURL    string  `json:"video_url"`
}

func getProjectIDStr(id interface{}) string {
	return fmt.Sprintf("%v", id)
}

func getProjectIDUint(id interface{}) uint {
	switch v := id.(type) {
	case float64:
		return uint(v)
	case int:
		return uint(v)
	case uint:
		return v
	default:
		return 0
	}
}

func StartEventListeners() {
	go listenToChannel("events:progress", handleProgress)
	go listenToChannel("events:clips_ready", handleClipsReady)
	go listenToChannel("events:clip_completed", handleClipCompleted)
	go listenToChannel("events:failed", handleFailed)
}

func listenToChannel(channel string, handler func(payload EventPayload, rawMsg string)) {
	ctx := context.Background()
	pubsub := RedisClient.Subscribe(ctx, channel)
	defer pubsub.Close()

	log.Printf("Listening to Redis channel: %s", channel)

	for msg := range pubsub.Channel() {
		var payload EventPayload
		if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
			log.Printf("Failed to unmarshal event on %s: %v", channel, err)
			continue
		}
		
		handler(payload, msg.Payload)
		
		if payload.ProjectID != nil && websocket_pkg.DefaultHub != nil {
			projectIDStr := getProjectIDStr(payload.ProjectID)
			websocket_pkg.DefaultHub.Broadcast(projectIDStr, msg.Payload)
		}
	}
}

func handleProgress(payload EventPayload, rawMsg string) {
	log.Printf("[events:progress] Project %v: %s (%d%%)", payload.ProjectID, payload.Message, payload.Progress)
	if payload.Status != "" {
		repository.DB.Model(&models.Project{}).Where("id = ?", getProjectIDUint(payload.ProjectID)).Update("status", payload.Status)
	}
}

func handleClipsReady(payload EventPayload, rawMsg string) {
	log.Printf("[events:clips_ready] Project %v has %d clips planned.", payload.ProjectID, len(payload.Clips))
	projectID := getProjectIDUint(payload.ProjectID)
	
	repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", "rendering")

	for _, c := range payload.Clips {
		clip := models.Clip{
			ProjectID:   projectID,
			Title:       c.Title,
			Description: c.Description,
			Score:       c.Score,
			StartTime:   c.StartTime,
			EndTime:     c.EndTime,
			VideoURL:    "", // Will be updated when rendered
		}
		repository.DB.Create(&clip)
	}
}

func handleClipCompleted(payload EventPayload, rawMsg string) {
	log.Printf("[events:clip_completed] Project %v clip rendered.", payload.ProjectID)
	projectID := getProjectIDUint(payload.ProjectID)

	// Update the specific clip with its output path
	if len(payload.Files) > 0 && len(payload.Clips) > 0 {
		file := payload.Files[0]
		clipTitle := payload.Clips[0].Title
		repository.DB.Model(&models.Clip{}).
			Where("project_id = ? AND title = ?", projectID, clipTitle).
			Update("file_path", file)
	}

	// Check if all clips for this project have a video URL
	var pendingCount int64
	repository.DB.Model(&models.Clip{}).Where("project_id = ? AND (file_path IS NULL OR file_path = '')", projectID).Count(&pendingCount)
	
	if pendingCount == 0 {
		log.Printf("All clips rendered for Project %v. Marking as completed.", projectID)
		repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", "completed")
		
		// Broadcast final completion
		if websocket_pkg.DefaultHub != nil {
			finalMsg, _ := json.Marshal(map[string]interface{}{
				"status": "completed",
				"message": "All clips rendered successfully!",
				"progress": 100,
			})
			websocket_pkg.DefaultHub.Broadcast(getProjectIDStr(payload.ProjectID), string(finalMsg))
		}
	}
}

func handleFailed(payload EventPayload, rawMsg string) {
	log.Printf("[events:failed] Project %v failed: %s", payload.ProjectID, payload.Error)
	repository.DB.Model(&models.Project{}).Where("id = ?", getProjectIDUint(payload.ProjectID)).Update("status", "failed")
}
