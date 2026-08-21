package services

import (
	"context"
	"testing"
	"time"

	"clipforge-gateway/internal/config"
)

func TestPipelineServiceCancellation(t *testing.T) {
	cfg := &config.Config{
		UploadDir: t.TempDir(),
		ClipsDir:  t.TempDir(),
	}

	pipeline := InitPipelineService(cfg, nil)

	var projectID uint = 999
	ctx, cancel := context.WithCancel(context.Background())
	pipeline.RegisterCancel(projectID, cancel)

	// Verify project can be cancelled
	go func() {
		time.Sleep(10 * time.Millisecond)
		pipeline.cancelMutex.Lock()
		if c, ok := pipeline.cancelFuncs[projectID]; ok {
			c()
		}
		pipeline.cancelMutex.Unlock()
	}()

	select {
	case <-ctx.Done():
		// Success: context was cancelled properly
	case <-time.After(500 * time.Millisecond):
		t.Error("Pipeline cancellation timed out")
	}
}

func TestDownloaderVideoInfoFallback(t *testing.T) {
	downloader := NewDownloaderService(t.TempDir())
	info, err := downloader.GetVideoInfo("https://invalid-url.example.com")
	if err != nil {
		t.Errorf("GetVideoInfo should return safe fallback on error, got err: %v", err)
	}

	if info == nil || info.Title == "" {
		t.Error("GetVideoInfo returned empty fallback info")
	}
}
