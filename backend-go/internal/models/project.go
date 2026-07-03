package models

import (
	"time"
	"gorm.io/gorm"
)

type Clip struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ProjectID   uint           `gorm:"index" json:"project_id"`
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
	Status       string         `gorm:"size:50;default:'processing'" json:"status"`
	Prompt       string         `gorm:"type:text" json:"prompt,omitempty"`
	OriginalFile string         `gorm:"size:255" json:"original_file,omitempty"`
	Duration     float64        `json:"duration,omitempty"`
	Clips        []Clip         `json:"clips,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

func (Project) TableName() string {
	return "projects"
}
