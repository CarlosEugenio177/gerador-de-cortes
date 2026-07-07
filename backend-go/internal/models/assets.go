package models

import (
	"time"
)

type BrandKit struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"size:255" json:"name"`
	PrimaryColor string    `gorm:"size:50" json:"primary_color"`
	LogoURL      string    `gorm:"size:255" json:"logo_url"`
	CustomFont   string    `gorm:"size:255" json:"custom_font"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (BrandKit) TableName() string {
	return "brand_kits"
}

type SubtitlePreset struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:255" json:"name"`
	Style       string    `gorm:"size:50" json:"style"`
	FontSize    int       `json:"font_size"`
	Color       string    `gorm:"size:50" json:"color"`
	StrokeColor string    `gorm:"size:50" json:"stroke_color"`
	Animation   string    `gorm:"size:50" json:"animation"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (SubtitlePreset) TableName() string {
	return "subtitle_presets"
}

type ExportProfile struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:255" json:"name"`
	Resolution  string    `gorm:"size:50" json:"resolution"` // e.g. "1080x1920"
	Bitrate     string    `gorm:"size:50" json:"bitrate"`    // e.g. "8M"
	Format      string    `gorm:"size:50" json:"format"`     // e.g. "mp4"
	Framerate   int       `json:"framerate"`                 // e.g. 60
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (ExportProfile) TableName() string {
	return "export_profiles"
}
