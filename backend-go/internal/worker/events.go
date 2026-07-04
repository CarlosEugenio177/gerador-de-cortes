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
	go listenToStream("stream:events:progress", handleProgress)
	go listenToStream("stream:events:clips_ready", handleClipsReady)
	go listenToStream("stream:events:clip_completed", handleClipCompleted)
	go listenToStream("stream:events:failed", handleFailed)
	go listenToStream("stream:events:transcript_ready", handleTranscriptReady)
}

func listenToStream(stream string, handler func(payload EventPayload, rawMsg string)) {
	ctx := context.Background()
	group := "go_gateway_group"
	consumer := "go_gateway_consumer_1"

	err := RedisClient.XGroupCreateMkStream(ctx, stream, group, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		log.Printf("Notice on group creation %s: %v", stream, err)
	}

	log.Printf("Listening to Redis stream: %s", stream)

	for {
		streams, err := RedisClient.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    group,
			Consumer: consumer,
			Streams:  []string{stream, ">"},
			Count:    10,
			Block:    0,
		}).Result()

		if err != nil {
			log.Printf("Error reading from stream %s: %v", stream, err)
			continue
		}

		for _, streamMsg := range streams {
			for _, msg := range streamMsg.Messages {
				payloadStr, ok := msg.Values["payload"].(string)
				if !ok {
					bytes, _ := json.Marshal(msg.Values)
					payloadStr = string(bytes)
				}
				
				var payload EventPayload
				if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
					log.Printf("Failed to unmarshal event on %s: %v (payload: %s)", stream, err, payloadStr)
				} else {
					handler(payload, payloadStr)
					
					if payload.ProjectID != nil && websocket_pkg.DefaultHub != nil {
						projectIDStr := getProjectIDStr(payload.ProjectID)
						websocket_pkg.DefaultHub.Broadcast(projectIDStr, payloadStr)
					}
				}

				RedisClient.XAck(ctx, stream, group, msg.ID)
			}
		}
	}
}

func handleProgress(payload EventPayload, rawMsg string) {
	log.Printf("[events:progress] Project %v: %s (%d%%)", payload.ProjectID, payload.Message, payload.Progress)
	if payload.Status != "" {
		repository.DB.Model(&models.Project{}).Where("id = ?", getProjectIDUint(payload.ProjectID)).Update("status", payload.Status)
	}
}

func handleTranscriptReady(payload EventPayload, rawMsg string) {
	log.Printf("[events:transcript_ready] Project %v transcript generated.", payload.ProjectID)
}

func handleClipsReady(payload EventPayload, rawMsg string) {
	log.Printf("[events:clips_ready] Project %v has %d clips planned.", payload.ProjectID, len(payload.Clips))
	projectID := getProjectIDUint(payload.ProjectID)
	
	repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", models.StatusRendering)

	var project models.Project
	repository.DB.First(&project, projectID)

	for _, c := range payload.Clips {
		pid := projectID
		clip := models.Clip{
			ProjectID:   &pid,
			ProjectName: project.Title,
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
		repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", models.StatusCompleted)
		
		// Broadcast final completion
		if websocket_pkg.DefaultHub != nil {
			finalMsg, _ := json.Marshal(map[string]interface{}{
				"status":   string(models.StatusCompleted),
				"message":  "All clips rendered successfully!",
				"progress": 100,
			})
			websocket_pkg.DefaultHub.Broadcast(getProjectIDStr(payload.ProjectID), string(finalMsg))
		}
	}
}

func handleFailed(payload EventPayload, rawMsg string) {
	log.Printf("[events:failed] Project %v failed: %s", payload.ProjectID, payload.Error)
	repository.DB.Model(&models.Project{}).Where("id = ?", getProjectIDUint(payload.ProjectID)).Update("status", models.StatusFailed)
}
