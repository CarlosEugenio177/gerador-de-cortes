package services

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"

	"clipforge-gateway/internal/ai"
	"clipforge-gateway/internal/models"
)

func TestGenerateEDL(t *testing.T) {
	exporter := &ExportService{}

	clip := models.Clip{
		Title:     "Corte Viral",
		StartTime: 10.0,
		EndTime:   40.0,
		Score:     95.0,
	}

	originalFile := "/uploads/source.mp4"
	edlContent := exporter.GenerateEDL(clip, originalFile, 30.0)

	if !strings.Contains(edlContent, "TITLE: Corte Viral") {
		t.Error("EDL missing title")
	}

	if !strings.Contains(edlContent, "001  AX") {
		t.Error("EDL missing event 001 line")
	}

	if !strings.Contains(edlContent, "* FROM CLIP NAME: source.mp4") {
		t.Error("EDL missing source clip name comment")
	}
}

func TestGenerateSRT(t *testing.T) {
	exporter := &ExportService{}

	words := []ai.Word{
		{Word: "Teste", Start: 5.0, End: 5.5},
		{Word: "de", Start: 5.5, End: 6.0},
		{Word: "legenda", Start: 6.0, End: 7.0},
	}

	srt := exporter.GenerateSRT(words, 5.0, 10.0)

	if !strings.Contains(srt, "-->") {
		t.Error("SRT missing timecode arrow")
	}

	if !strings.Contains(srt, "Teste") || !strings.Contains(srt, "legenda") {
		t.Error("SRT missing transcribed words")
	}
}

func TestCreateEditorBundleZip(t *testing.T) {
	exporter := &ExportService{}

	clip := models.Clip{
		ID:          1,
		Title:       "Corte Top",
		Description: "Descrição do corte",
		StartTime:   0.0,
		EndTime:     30.0,
		Score:       92.0,
	}

	project := models.Project{
		Title:        "Projeto Master",
		OriginalFile: "/uploads/video.mp4",
	}

	words := []ai.Word{
		{Word: "Corte", Start: 0.0, End: 1.0},
		{Word: "Top", Start: 1.0, End: 2.0},
	}

	zipBytes, err := exporter.CreateEditorBundleZip(clip, project, words)
	if err != nil {
		t.Fatalf("CreateEditorBundleZip failed: %v", err)
	}

	if len(zipBytes) == 0 {
		t.Fatal("Generated ZIP is empty")
	}

	// Verify zip contents
	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		t.Fatalf("Invalid zip archive generated: %v", err)
	}

	expectedFiles := map[string]bool{
		"clip_1_premiere.edl":             false,
		"clip_1_subtitles.srt":            false,
		"clip_1_subtitles_animated.ass":   false,
		"social_media_info.json":          false,
	}

	for _, f := range zipReader.File {
		if _, ok := expectedFiles[f.Name]; ok {
			expectedFiles[f.Name] = true
		}
	}

	for filename, found := range expectedFiles {
		if !found {
			t.Errorf("Missing expected file in zip package: %s", filename)
		}
	}
}
