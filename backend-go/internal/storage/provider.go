package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Provider interface defines methods for any storage implementation
type Provider interface {
	SaveFile(filename string, file io.Reader) (string, error)
	GetURL(filepath string) string
}

// LocalStorage implements Provider for the local file system
type LocalStorage struct {
	UploadDir string
	BaseURL   string
}

func NewLocalStorage(uploadDir string, baseURL string) *LocalStorage {
	os.MkdirAll(uploadDir, os.ModePerm)
	return &LocalStorage{
		UploadDir: uploadDir,
		BaseURL:   baseURL,
	}
}

func (l *LocalStorage) SaveFile(filename string, file io.Reader) (string, error) {
	savePath := filepath.Join(l.UploadDir, filename)
	
	out, err := os.Create(savePath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return "", err
	}

	return savePath, nil
}

func (l *LocalStorage) GetURL(path string) string {
	return fmt.Sprintf("%s/%s", l.BaseURL, filepath.ToSlash(path))
}

// Future: S3Storage
// type S3Storage struct { ... }
// func NewS3Storage() *S3Storage { ... }
