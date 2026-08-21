package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type VideoInfo struct {
	Title     string  `json:"title"`
	Duration  float64 `json:"duration"`
	Thumbnail string  `json:"thumbnail"`
	Uploader  string  `json:"uploader"`
}

type DownloaderService struct {
	UploadDir string
}

func NewDownloaderService(uploadDir string) *DownloaderService {
	return &DownloaderService{UploadDir: uploadDir}
}

func (d *DownloaderService) GetVideoInfo(url string) (*VideoInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "yt-dlp",
		"--dump-single-json",
		"--no-warnings",
		"--no-playlist",
		url,
	)

	out, err := cmd.Output()
	if err != nil {
		return &VideoInfo{
			Title:     "Web Video",
			Duration:  300.0,
			Thumbnail: "",
			Uploader:  "Online Video",
		}, nil
	}

	var raw struct {
		Title     string  `json:"title"`
		Duration  float64 `json:"duration"`
		Thumbnail string  `json:"thumbnail"`
		Uploader  string  `json:"uploader"`
	}

	if err := json.Unmarshal(out, &raw); err != nil {
		return &VideoInfo{
			Title:     "Web Video",
			Duration:  300.0,
			Thumbnail: "",
			Uploader:  "Online Video",
		}, nil
	}

	return &VideoInfo{
		Title:     raw.Title,
		Duration:  raw.Duration,
		Thumbnail: raw.Thumbnail,
		Uploader:  raw.Uploader,
	}, nil
}

func (d *DownloaderService) DownloadMedia(url string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	filenamePrefix := fmt.Sprintf("ytdl_%s_", uuid.New().String()[:8])
	filenameTemplate := filepath.Join(d.UploadDir, filenamePrefix+"%(id)s.%(ext)s")

	// 1. Download video with robust format selection
	log.Printf("[Downloader] Starting video download for: %s", url)
	cmdVideo := exec.CommandContext(ctx, "yt-dlp",
		"-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
		"--merge-output-format", "mp4",
		"--no-playlist",
		"--no-warnings",
		"--ignore-errors",
		"-o", filenameTemplate,
		url,
	)

	out, err := cmdVideo.CombinedOutput()
	if err != nil {
		log.Printf("[Downloader] yt-dlp video output: %s", string(out))
	}

	// 2. Try fetching auto-subtitles non-fatally (will not fail if 429 or unavailable)
	cmdSubs := exec.CommandContext(ctx, "yt-dlp",
		"--write-auto-sub",
		"--sub-lang", "pt,pt-BR",
		"--convert-subs", "srt",
		"--skip-download",
		"--no-playlist",
		"--no-warnings",
		"-o", filenameTemplate,
		url,
	)
	_ = cmdSubs.Run()

	// 3. Locate the downloaded MP4 file
	matches, _ := filepath.Glob(filepath.Join(d.UploadDir, filenamePrefix+"*.mp4"))
	if len(matches) > 0 {
		log.Printf("[Downloader] Video successfully saved to: %s", matches[0])
		return matches[0], nil
	}

	// Fallback check for any video extension (mkv, webm)
	allMatches, _ := filepath.Glob(filepath.Join(d.UploadDir, filenamePrefix+"*"))
	for _, m := range allMatches {
		ext := strings.ToLower(filepath.Ext(m))
		if ext == ".mp4" || ext == ".mkv" || ext == ".webm" {
			log.Printf("[Downloader] Found video file: %s", m)
			return m, nil
		}
	}

	return "", fmt.Errorf("failed to locate downloaded video file after download")
}
