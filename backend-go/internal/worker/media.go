package worker

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"clipforge-gateway/internal/models"
	"clipforge-gateway/internal/repository"
	websocket_pkg "clipforge-gateway/pkg/websocket"
)

// PreprocessVideoAsync creates a proxy video and extracts audio, then updates DB and sends to Redis Queue
func PreprocessVideoAsync(projectID uint, originalPath string, prompt string) {
	log.Printf("Starting preprocessing for project %d: %s", projectID, originalPath)
	
	// Notify frontend we are preprocessing
	if websocket_pkg.DefaultHub != nil {
		progressMsg, _ := json.Marshal(map[string]interface{}{
			"status":   string(models.StatusPreprocessing),
			"message":  "Extracting audio and generating proxies...",
			"progress": 5,
		})
		websocket_pkg.DefaultHub.Broadcast(fmt.Sprintf("%d", projectID), string(progressMsg))
	}
	
	// Create paths
	ext := filepath.Ext(originalPath)
	base := strings.TrimSuffix(originalPath, ext)
	proxyPath := base + "_proxy.mp4"
	audioPath := base + "_audio.wav"

	// Check if proxy and audio already exist (Deduplication cache)
	_, errProxy := os.Stat(proxyPath)
	_, errAudio := os.Stat(audioPath)
	filesExist := errProxy == nil && errAudio == nil

	if filesExist {
		log.Printf("Proxy and audio already exist for project %d, skipping FFmpeg extraction (Global Cache Hit)", projectID)
		if websocket_pkg.DefaultHub != nil {
			progressMsg, _ := json.Marshal(map[string]interface{}{
				"status":   string(models.StatusPreprocessing),
				"message":  "Using globally cached video proxy...",
				"progress": 15,
			})
			websocket_pkg.DefaultHub.Broadcast(fmt.Sprintf("%d", projectID), string(progressMsg))
		}
	} else {
		// 1. Extract Audio
		log.Printf("Extracting audio for project %d...", projectID)
		// ffmpeg -i original.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav
		audioCmd := exec.Command("ffmpeg", "-y", "-i", originalPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", audioPath)
		if err := audioCmd.Run(); err != nil {
			log.Printf("Error extracting audio for project %d: %v", projectID, err)
			failProject(projectID, "Failed to extract audio")
			return
		}

		// Notify frontend
		if websocket_pkg.DefaultHub != nil {
			progressMsg, _ := json.Marshal(map[string]interface{}{
				"status":   string(models.StatusPreprocessing),
				"message":  "Generating fast preview proxy...",
				"progress": 15,
			})
			websocket_pkg.DefaultHub.Broadcast(fmt.Sprintf("%d", projectID), string(progressMsg))
		}

		// 2. Create Proxy (360p, fast hardware encode)
		log.Printf("Creating proxy video for project %d on GPU (NVENC)...", projectID)
		// ffmpeg -i original.mp4 -vf scale=-2:360 -c:v h264_nvenc -preset p4 -cq 28 -c:a aac -b:a 128k proxy.mp4
		proxyCmd := exec.Command("ffmpeg", "-y", "-i", originalPath, "-vf", "scale=-2:360", "-c:v", "h264_nvenc", "-preset", "p4", "-cq", "28", "-c:a", "aac", "-b:a", "128k", proxyPath)
		if err := proxyCmd.Run(); err != nil {
			log.Printf("Error creating proxy for project %d: %v", projectID, err)
			failProject(projectID, "Failed to create proxy video")
			return
		}
	}

	// 3. Update Project Database
	if err := repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Updates(map[string]interface{}{
		"proxy_file": proxyPath,
		"audio_file": audioPath,
	}).Error; err != nil {
		log.Printf("Error updating project %d in DB: %v", projectID, err)
		failProject(projectID, "Database error during preprocessing")
		return
	}

	// 4. Dispatch to Redis for Python Worker
	err := DispatchExtractClips(projectID, originalPath, proxyPath, audioPath, prompt)
	if err != nil {
		log.Printf("Failed to dispatch to python worker for project %d: %v", projectID, err)
		failProject(projectID, "Failed to dispatch to queue")
		return
	}

	log.Printf("Preprocessing completed successfully for project %d", projectID)
}

func failProject(projectID uint, message string) {
	repository.DB.Model(&models.Project{}).Where("id = ?", projectID).Update("status", models.StatusFailed)
	if websocket_pkg.DefaultHub != nil {
		finalMsg, _ := json.Marshal(map[string]interface{}{
			"status":  string(models.StatusFailed),
			"error":   message,
		})
		websocket_pkg.DefaultHub.Broadcast(fmt.Sprintf("%d", projectID), string(finalMsg))
	}
}
