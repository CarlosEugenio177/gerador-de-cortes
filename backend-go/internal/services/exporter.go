package services

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strings"

	"clipforge-gateway/internal/ai"
	"clipforge-gateway/internal/models"
)

type ExportService struct{}

var GlobalExporter = &ExportService{}

// GenerateEDL creates a standard CMX 3600 Edit Decision List for Premiere Pro / DaVinci Resolve
func (e *ExportService) GenerateEDL(clip models.Clip, originalFile string, fps float64) string {
	if fps <= 0 {
		fps = 30.0
	}

	reelName := "AX"
	clipName := filepath.Base(originalFile)
	if clipName == "" {
		clipName = "source_media.mp4"
	}

	srcInTC := formatTimecode(clip.StartTime, fps)
	srcOutTC := formatTimecode(clip.EndTime, fps)
	dstInTC := formatTimecode(0, fps)
	dstOutTC := formatTimecode(clip.EndTime-clip.StartTime, fps)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("TITLE: %s\n", sanitizeTitle(clip.Title)))
	sb.WriteString("FCM: NON-DROP FRAME\n\n")
	sb.WriteString(fmt.Sprintf("001  %-8s V     C        %s %s %s %s\n", reelName, srcInTC, srcOutTC, dstInTC, dstOutTC))
	sb.WriteString(fmt.Sprintf("* FROM CLIP NAME: %s\n", clipName))
	sb.WriteString(fmt.Sprintf("* CLIP TITLE: %s\n", clip.Title))
	sb.WriteString(fmt.Sprintf("* VIRAL SCORE: %.0f\n", clip.Score))

	return sb.String()
}

// GenerateSRT creates standard SubRip subtitle track from word-level transcript
func (e *ExportService) GenerateSRT(words []ai.Word, clipStart, clipEnd float64) string {
	var clipWords []ai.Word
	for _, w := range words {
		if w.End >= clipStart && w.Start <= clipEnd {
			relStart := math.Max(0, w.Start-clipStart)
			relEnd := math.Min(clipEnd-clipStart, w.End-clipStart)
			clipWords = append(clipWords, ai.Word{
				Word:  strings.TrimSpace(w.Word),
				Start: relStart,
				End:   relEnd,
			})
		}
	}

	if len(clipWords) == 0 {
		return "1\n00:00:00,000 --> 00:00:05,000\n[Legenda]\n\n"
	}

	var sb strings.Builder
	chunkSize := 4
	counter := 1

	for i := 0; i < len(clipWords); i += chunkSize {
		endIdx := i + chunkSize
		if endIdx > len(clipWords) {
			endIdx = len(clipWords)
		}
		chunk := clipWords[i:endIdx]
		if len(chunk) == 0 {
			continue
		}

		startStr := formatSRTTimestamp(chunk[0].Start)
		endStr := formatSRTTimestamp(chunk[len(chunk)-1].End)

		var phrase []string
		for _, w := range chunk {
			phrase = append(phrase, w.Word)
		}

		sb.WriteString(fmt.Sprintf("%d\n%s --> %s\n%s\n\n", counter, startStr, endStr, strings.Join(phrase, " ")))
		counter++
	}

	return sb.String()
}

// CreateEditorBundleZip builds a complete ZIP bundle with video, EDL, SRT, ASS, and metadata
func (e *ExportService) CreateEditorBundleZip(clip models.Clip, project models.Project, transcriptWords []ai.Word) ([]byte, error) {
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// 1. Add EDL
	edlContent := e.GenerateEDL(clip, project.OriginalFile, 30.0)
	if err := addFileToZip(zipWriter, fmt.Sprintf("clip_%d_premiere.edl", clip.ID), []byte(edlContent)); err != nil {
		return nil, err
	}

	// 2. Add SRT Subtitles
	srtContent := e.GenerateSRT(transcriptWords, clip.StartTime, clip.EndTime)
	if err := addFileToZip(zipWriter, fmt.Sprintf("clip_%d_subtitles.srt", clip.ID), []byte(srtContent)); err != nil {
		return nil, err
	}

	// 3. Add ASS Subtitles
	assGen := ai.NewSubtitleGenerator()
	tempAssPath := filepath.Join(os.TempDir(), fmt.Sprintf("temp_%d.ass", clip.ID))
	_ = assGen.GenerateASSForClip(transcriptWords, clip.StartTime, clip.EndTime, "Neon", tempAssPath)
	if assData, err := os.ReadFile(tempAssPath); err == nil {
		_ = addFileToZip(zipWriter, fmt.Sprintf("clip_%d_subtitles_animated.ass", clip.ID), assData)
		os.Remove(tempAssPath)
	}

	// 4. Add Social Media Metadata JSON
	meta := map[string]interface{}{
		"clip_id":     clip.ID,
		"title":       clip.Title,
		"description": clip.Description,
		"viral_score": clip.Score,
		"start_time":  clip.StartTime,
		"end_time":    clip.EndTime,
		"duration":    clip.EndTime - clip.StartTime,
		"project":     project.Title,
	}
	if metaBytes, err := json.MarshalIndent(meta, "", "  "); err == nil {
		_ = addFileToZip(zipWriter, "social_media_info.json", metaBytes)
	}

	// 5. Add rendered MP4 if available
	if clip.VideoURL != "" && fileExists(clip.VideoURL) {
		if fileData, err := os.ReadFile(clip.VideoURL); err == nil {
			_ = addFileToZip(zipWriter, fmt.Sprintf("clip_%d_rendered.mp4", clip.ID), fileData)
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func addFileToZip(zw *zip.Writer, filename string, data []byte) error {
	w, err := zw.Create(filename)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, bytes.NewReader(data))
	return err
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func formatTimecode(seconds, fps float64) string {
	if seconds < 0 {
		seconds = 0
	}
	totalFrames := int(math.Round(seconds * fps))
	frames := totalFrames % int(fps)
	totalSeconds := totalFrames / int(fps)
	secs := totalSeconds % 60
	mins := (totalSeconds / 60) % 60
	hours := totalSeconds / 3600
	return fmt.Sprintf("%02d:%02d:%02d:%02d", hours, mins, secs, frames)
}

func formatSRTTimestamp(seconds float64) string {
	if seconds < 0 {
		seconds = 0
	}
	hours := int(seconds) / 3600
	minutes := (int(seconds) % 3600) / 60
	secs := int(seconds) % 60
	millis := int(math.Round((seconds - math.Floor(seconds)) * 1000))
	if millis >= 1000 {
		millis = 999
	}
	return fmt.Sprintf("%02d:%02d:%02d,%03d", hours, minutes, secs, millis)
}

func sanitizeTitle(title string) string {
	replacer := strings.NewReplacer("\n", " ", "\r", " ", ":", "-", "/", "-")
	return replacer.Replace(title)
}
