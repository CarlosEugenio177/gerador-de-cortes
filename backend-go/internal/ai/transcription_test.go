package ai

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseFlexibleTimestamp(t *testing.T) {
	tests := []struct {
		input    string
		expected float64
	}{
		{"00:00:05.500", 5.5},
		{"00:01:30.250", 90.25},
		{"01:00:00.000", 3600.0},
		{"01:23,456", 83.456},
		{"02:15.50", 135.5},
		{"00:00:10,000 position:50% line:0", 10.0},
	}

	for _, tt := range tests {
		got := parseFlexibleTimestamp(tt.input)
		diff := got - tt.expected
		if diff < -0.01 || diff > 0.01 {
			t.Errorf("parseFlexibleTimestamp(%q) = %v; want %v", tt.input, got, tt.expected)
		}
	}
}

func TestParseSRTFile(t *testing.T) {
	srtContent := `1
00:00:01,000 --> 00:00:04,000
Olá este é o primeiro corte.

2
00:00:04,500 --> 00:00:08,000
Preste atenção nesta dica incrível!
`
	tmpDir := t.TempDir()
	srtPath := filepath.Join(tmpDir, "test.srt")
	if err := os.WriteFile(srtPath, []byte(srtContent), 0644); err != nil {
		t.Fatalf("Failed to write srt file: %v", err)
	}

	res, err := ParseSRTFile(srtPath)
	if err != nil {
		t.Fatalf("ParseSRTFile returned error: %v", err)
	}

	if len(res.Segments) != 2 {
		t.Fatalf("Expected 2 segments, got %d", len(res.Segments))
	}

	if res.Segments[0].Start != 1.0 || res.Segments[0].End != 4.0 {
		t.Errorf("Segment 0 times mismatch: got [%v - %v]", res.Segments[0].Start, res.Segments[0].End)
	}

	if len(res.Words) == 0 {
		t.Error("Expected words to be extracted from segments, got 0 words")
	}
}

func TestParseVTTFile(t *testing.T) {
	vttContent := `WEBVTT
Kind: captions
Language: pt

00:00:02.000 --> 00:00:05.500
Este é um teste em formato WebVTT.

00:00:06.000 --> 00:00:09.000
Validando timestamps com pontos e headers.
`
	tmpDir := t.TempDir()
	vttPath := filepath.Join(tmpDir, "test.vtt")
	if err := os.WriteFile(vttPath, []byte(vttContent), 0644); err != nil {
		t.Fatalf("Failed to write vtt file: %v", err)
	}

	res, err := ParseVTTFile(vttPath)
	if err != nil {
		t.Fatalf("ParseVTTFile returned error: %v", err)
	}

	if len(res.Segments) != 2 {
		t.Fatalf("Expected 2 segments, got %d", len(res.Segments))
	}

	if res.Segments[0].Start != 2.0 || res.Segments[0].End != 5.5 {
		t.Errorf("Segment 0 times mismatch: got [%v - %v]", res.Segments[0].Start, res.Segments[0].End)
	}
}
