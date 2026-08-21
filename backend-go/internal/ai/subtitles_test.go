package ai

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGenerateASSForClip(t *testing.T) {
	generator := NewSubtitleGenerator()

	sampleWords := []Word{
		{Word: "Olá", Start: 10.0, End: 10.5},
		{Word: "pessoal", Start: 10.5, End: 11.0},
		{Word: "vamos", Start: 11.0, End: 11.4},
		{Word: "aprender", Start: 11.4, End: 12.0},
		{Word: "a", Start: 12.0, End: 12.2},
		{Word: "viralizar", Start: 12.2, End: 13.0},
	}

	clipStart := 10.0
	clipEnd := 15.0

	styles := []string{"Neon", "Fire", "Clean"}

	for _, style := range styles {
		t.Run("Style_"+style, func(t *testing.T) {
			tmpDir := t.TempDir()
			outputPath := filepath.Join(tmpDir, style+".ass")

			err := generator.GenerateASSForClip(sampleWords, clipStart, clipEnd, style, outputPath)
			if err != nil {
				t.Fatalf("GenerateASSForClip failed for style %s: %v", style, err)
			}

			contentBytes, err := os.ReadFile(outputPath)
			if err != nil {
				t.Fatalf("Failed to read generated ASS file: %v", err)
			}

			content := string(contentBytes)

			// Validate ASS Headers
			if !strings.Contains(content, "[Script Info]") || !strings.Contains(content, "[Events]") {
				t.Error("Missing required ASS sections")
			}

			// Validate resolution
			if !strings.Contains(content, "PlayResX: 1080") || !strings.Contains(content, "PlayResY: 1920") {
				t.Error("Invalid 9:16 vertical resolution in ASS header")
			}

			// Validate words rendered in uppercase
			if !strings.Contains(content, "VIRALIZAR") {
				t.Error("Expected words to be formatted in uppercase")
			}

			// Validate Dialogue lines exist
			if !strings.Contains(content, "Dialogue:") {
				t.Error("No dialogue lines were written to ASS file")
			}
		})
	}
}

func TestGenerateASSForClipEmptyWords(t *testing.T) {
	generator := NewSubtitleGenerator()
	tmpDir := t.TempDir()
	outputPath := filepath.Join(tmpDir, "empty.ass")

	err := generator.GenerateASSForClip([]Word{}, 0.0, 30.0, "Neon", outputPath)
	if err != nil {
		t.Fatalf("Empty words should not return error: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Empty ASS file was not created")
	}
}
