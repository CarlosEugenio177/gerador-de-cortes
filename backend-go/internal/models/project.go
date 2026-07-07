package models

import (
	"time"
	"gorm.io/gorm"
)

type ProjectStatus string

const (
	StatusUploading      ProjectStatus = "UPLOADING"
	StatusUploaded       ProjectStatus = "UPLOADED"
	StatusQueuedAI       ProjectStatus = "QUEUED_AI"
	StatusPreprocessing  ProjectStatus = "PREPROCESSING"
	StatusTranscribing   ProjectStatus = "TRANSCRIBING"
	StatusTranscribed    ProjectStatus = "TRANSCRIBED"
	StatusAnalyzing      ProjectStatus = "ANALYZING"
	StatusAnalyzed       ProjectStatus = "ANALYZED"
	StatusBuildingTimeline ProjectStatus = "BUILDING_TIMELINE"
	StatusTimelineReady  ProjectStatus = "TIMELINE_READY"
	StatusQueuedRender   ProjectStatus = "QUEUED_RENDER"
	StatusRendering      ProjectStatus = "RENDERING"
	StatusExporting      ProjectStatus = "EXPORTING"
	StatusCompleted      ProjectStatus = "COMPLETED"
	StatusFailed         ProjectStatus = "FAILED"
)

type AuditLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ProjectID  uint      `gorm:"index" json:"project_id"`
	WorkerID   string    `gorm:"size:255" json:"worker_id"`
	Stage      string    `gorm:"size:255" json:"stage"`
	Status     string    `gorm:"size:255" json:"status"`
	DurationMs int64     `json:"duration_ms,omitempty"`
	Error      string    `gorm:"type:text" json:"error,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}

type Clip struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ProjectID   *uint          `gorm:"index" json:"project_id"`
	ProjectName string         `gorm:"size:255" json:"project_name"`
	Title       string         `gorm:"size:255" json:"title"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	VideoURL    string         `gorm:"column:file_path;size:500" json:"video_url"`
	StartTime   float64        `gorm:"column:start_time" json:"start_time"`
	EndTime     float64        `gorm:"column:end_time" json:"end_time"`
	Duration    float64        `gorm:"-" json:"duration"`
	Score       float64        `gorm:"column:viral_score" json:"score,omitempty"`
}

func (c *Clip) AfterFind(tx *gorm.DB) (err error) {
	c.Duration = c.EndTime - c.StartTime
	return
}

func (Clip) TableName() string {
	return "clips"
}

type Project struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Title        string         `gorm:"size:255" json:"title"`
	Status       ProjectStatus  `gorm:"size:50;default:'UPLOADING'" json:"status"`
	Prompt       string         `gorm:"type:text" json:"prompt,omitempty"`
	OriginalFile string         `gorm:"size:255" json:"original_file,omitempty"`
	ProxyFile    string         `gorm:"size:255" json:"proxy_file,omitempty"`
	AudioFile    string         `gorm:"size:255" json:"audio_file,omitempty"`
	Duration     float64        `json:"duration,omitempty"`
	Clips        []Clip         `json:"clips,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

func (Project) TableName() string {
	return "projects"
}
