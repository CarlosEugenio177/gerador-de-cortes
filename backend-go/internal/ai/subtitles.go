package ai

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
)

type SubtitleGenerator struct{}

func NewSubtitleGenerator() *SubtitleGenerator {
	return &SubtitleGenerator{}
}

// GenerateASSForClip creates an animated .ass subtitle file with seamless word-by-word highlighting
func (g *SubtitleGenerator) GenerateASSForClip(words []Word, clipStart, clipEnd float64, style string, outputPath string) error {
	// 1. Filter words within the clip range and calculate relative timestamps
	var clipWords []Word
	for _, w := range words {
		if w.End >= clipStart && w.Start <= clipEnd {
			relStart := math.Max(0, w.Start-clipStart)
			relEnd := math.Min(clipEnd-clipStart, w.End-clipStart)
			if relEnd > relStart {
				clipWords = append(clipWords, Word{
					Word:  strings.TrimSpace(w.Word),
					Start: relStart,
					End:   relEnd,
				})
			}
		}
	}

	if len(clipWords) == 0 {
		return os.WriteFile(outputPath, []byte(getASSHeader("Neon")), 0644)
	}

	var sb strings.Builder
	sb.WriteString(getASSHeader(style))

	// Group into short, punchy 3-word chunks (optimal for TikTok/Reels readability)
	chunkSize := 3
	for i := 0; i < len(clipWords); i += chunkSize {
		endIdx := i + chunkSize
		if endIdx > len(clipWords) {
			endIdx = len(clipWords)
		}

		chunk := clipWords[i:endIdx]
		if len(chunk) == 0 {
			continue
		}

		// Distinct highlight tags depending on style
		var activeTag, inactiveTag string
		switch strings.ToLower(style) {
		case "fire":
			activeTag = "{\\c&H000055FF&\\3c&H0000FFFF&\\fscx115\\fscy115\\b1}"   // Fire Orange with Yellow outline & Pop zoom
			inactiveTag = "{\\c&H00FFFFFF&\\3c&H00000000&\\fscx100\\fscy100\\b1}" // Crisp White
		case "clean":
			activeTag = "{\\c&H0044D4FF&\\3c&H00000000&\\b1}"                     // Soft Gold
			inactiveTag = "{\\c&H00E0E0E0&\\3c&H00000000&\\b0}"                    // Muted Silver
		default: // "neon"
			activeTag = "{\\c&H0000FFFF&\\3c&H00000000&\\fscx115\\fscy115\\b1}"   // TikTok Yellow/Cyan with Pop zoom
			inactiveTag = "{\\c&H00FFFFFF&\\3c&H00000000&\\fscx100\\fscy100\\b1}" // Bright White
		}

		// Generate non-overlapping dialogue lines for each word in chunk
		for activeIdx := 0; activeIdx < len(chunk); activeIdx++ {
			wStart := chunk[activeIdx].Start
			var wEnd float64

			if activeIdx+1 < len(chunk) {
				wEnd = chunk[activeIdx+1].Start
			} else {
				wEnd = chunk[activeIdx].End
			}

			if wEnd <= wStart {
				wEnd = wStart + 0.35
			}

			var lineBuilder strings.Builder
			for idx, w := range chunk {
				cleanWord := strings.ToUpper(strings.TrimSpace(w.Word))
				if idx == activeIdx {
					lineBuilder.WriteString(fmt.Sprintf("%s%s ", activeTag, cleanWord))
				} else {
					lineBuilder.WriteString(fmt.Sprintf("%s%s ", inactiveTag, cleanWord))
				}
			}

			startStr := formatASSTimestamp(wStart)
			endStr := formatASSTimestamp(wEnd)

			sb.WriteString(fmt.Sprintf("Dialogue: 0,%s,%s,Default,,0,0,0,,%s\n", startStr, endStr, strings.TrimSpace(lineBuilder.String())))
		}
	}

	os.MkdirAll(filepath.Dir(outputPath), 0755)
	return os.WriteFile(outputPath, []byte(sb.String()), 0644)
}

func getASSHeader(style string) string {
	var fontName string
	var fontSize int
	var primaryColor, outlineColor string
	var outlineWidth, shadowWidth float64
	var marginV int

	switch strings.ToLower(style) {
	case "fire":
		fontName = "DejaVu Sans Bold"
		fontSize = 72
		primaryColor = "&H00FFFFFF" // White
		outlineColor = "&H00000000" // Black
		outlineWidth = 5.0
		shadowWidth = 2.0
		marginV = 360
	case "clean":
		fontName = "DejaVu Sans"
		fontSize = 58
		primaryColor = "&H00FFFFFF"
		outlineColor = "&H00000000"
		outlineWidth = 2.5
		shadowWidth = 2.0
		marginV = 320
	default: // "neon"
		fontName = "DejaVu Sans Bold"
		fontSize = 68
		primaryColor = "&H00FFFFFF"
		outlineColor = "&H00000000"
		outlineWidth = 4.5
		shadowWidth = 2.5
		marginV = 360
	}

	return fmt.Sprintf(`[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,%s,%d,%s,&H000000FF,%s,&H80000000,-1,0,0,0,100,100,1,0,1,%.1f,%.1f,2,60,60,%d,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`, fontName, fontSize, primaryColor, outlineColor, outlineWidth, shadowWidth, marginV)
}

func formatASSTimestamp(seconds float64) string {
	if seconds < 0 {
		seconds = 0
	}
	hours := int(seconds) / 3600
	minutes := (int(seconds) % 3600) / 60
	secs := int(seconds) % 60
	centis := int(math.Round((seconds - math.Floor(seconds)) * 100))
	if centis >= 100 {
		centis = 99
	}
	return fmt.Sprintf("%01d:%02d:%02d.%02d", hours, minutes, secs, centis)
}
