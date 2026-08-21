package ai

type Word struct {
	Word  string  `json:"word"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

type Segment struct {
	ID    int     `json:"id"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
}

type TranscriptionResult struct {
	Text     string    `json:"text"`
	Duration float64   `json:"duration,omitempty"`
	Segments []Segment `json:"segments"`
	Words    []Word    `json:"words"`
}

type ViralClip struct {
	ID                int      `json:"id"`
	Title             string   `json:"title"`
	HookSummary       string   `json:"hook_summary"`
	StartTime         float64  `json:"start_time"`
	EndTime           float64  `json:"end_time"`
	ViralScore        int      `json:"viral_score"`
	SuggestedCaptions string   `json:"suggested_captions"`
	SuggestedHashtags []string `json:"suggested_hashtags"`
}

type EditOperation struct {
	Type         string      `json:"type"` // "clip", "subtitle", "crop"
	Start        float64     `json:"start,omitempty"`
	End          float64     `json:"end,omitempty"`
	Style        string      `json:"style,omitempty"`
	File         string      `json:"file,omitempty"`
	KeepSegments [][]float64 `json:"keep_segments,omitempty"`
	Title        string      `json:"title,omitempty"`
	Description  string      `json:"description,omitempty"`
	Score        float64     `json:"score,omitempty"`
}

type EditPlan struct {
	ProjectID    uint            `json:"project_id"`
	OriginalFile string          `json:"original_file"`
	VideoFormat  string          `json:"video_format,omitempty"` // "9:16", "1:1", "16:9"
	RemoveNoise  bool            `json:"remove_noise,omitempty"`
	Operations   []EditOperation `json:"operations"`
}
