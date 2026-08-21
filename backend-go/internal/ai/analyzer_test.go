package ai

import (
	"testing"
)

func TestParseClipsJSON(t *testing.T) {
	analyzer := NewViralAnalyzerService("", "", "", "", "")

	// 1. Raw JSON array
	rawJSON := `[
		{
			"id": 1,
			"title": "🔥 O MOMENTO MAIS INSANO!",
			"hook_summary": "Gancho magnético nos primeiros segundos.",
			"start_time": 10.5,
			"end_time": 45.0,
			"viral_score": 95,
			"suggested_captions": "Veja isso!",
			"suggested_hashtags": ["#viral", "#shorts"]
		}
	]`

	clips, err := analyzer.parseClipsJSON(rawJSON)
	if err != nil {
		t.Fatalf("Failed to parse raw JSON: %v", err)
	}
	if len(clips) != 1 || clips[0].Title != "🔥 O MOMENTO MAIS INSANO!" {
		t.Errorf("Unexpected clip output: %+v", clips)
	}

	// 2. Markdown wrapped JSON block
	markdownJSON := "```json\n" + rawJSON + "\n```"
	clipsMd, err := analyzer.parseClipsJSON(markdownJSON)
	if err != nil {
		t.Fatalf("Failed to parse markdown wrapped JSON: %v", err)
	}
	if len(clipsMd) != 1 {
		t.Errorf("Expected 1 clip from markdown JSON, got %d", len(clipsMd))
	}

	// 3. Object-wrapped JSON: {"clips": [...]}
	wrappedJSON := `{"clips": ` + rawJSON + `}`
	clipsWrapped, err := analyzer.parseClipsJSON(wrappedJSON)
	if err != nil {
		t.Fatalf("Failed to parse object wrapped JSON: %v", err)
	}
	if len(clipsWrapped) != 1 {
		t.Errorf("Expected 1 clip from wrapped JSON, got %d", len(clipsWrapped))
	}
}

func TestGenerateSmartFallbackClips(t *testing.T) {
	analyzer := NewViralAnalyzerService("", "", "", "", "")

	mockTranscription := &TranscriptionResult{
		Duration: 300.0,
		Segments: []Segment{
			{ID: 1, Start: 0.0, End: 150.0, Text: "Primeira metade do vídeo."},
			{ID: 2, Start: 150.0, End: 300.0, Text: "Segunda metade do vídeo."},
		},
	}

	requestedClips := 4
	clips := analyzer.generateSmartFallbackClips(mockTranscription, requestedClips)

	if len(clips) != requestedClips {
		t.Fatalf("Expected %d fallback clips, got %d", requestedClips, len(clips))
	}

	for i, c := range clips {
		if c.EndTime <= c.StartTime {
			t.Errorf("Clip %d has invalid timestamps: [%v - %v]", i, c.StartTime, c.EndTime)
		}
		if c.ViralScore < 85 || c.ViralScore > 100 {
			t.Errorf("Clip %d has invalid viral score: %v", i, c.ViralScore)
		}
	}
}
