package handlers

import (
	"context"
	"time"

	"clipforge-gateway/internal/worker"
	"github.com/gofiber/fiber/v2"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

type SystemMetrics struct {
	CPUUsage    float64 `json:"cpu_usage"`
	MemoryUsage float64 `json:"memory_usage"`
	MemoryTotal uint64  `json:"memory_total"`
	MemoryFree  uint64  `json:"memory_free"`
	RedisPing   string  `json:"redis_ping"`
	Uptime      int64   `json:"uptime"`
}

var startTime = time.Now()

func GetSystemMetrics(c *fiber.Ctx) error {
	var metrics SystemMetrics

	// CPU
	cpuPercent, err := cpu.Percent(0, false)
	if err == nil && len(cpuPercent) > 0 {
		metrics.CPUUsage = cpuPercent[0]
	}

	// Memory
	vm, err := mem.VirtualMemory()
	if err == nil {
		metrics.MemoryUsage = vm.UsedPercent
		metrics.MemoryTotal = vm.Total
		metrics.MemoryFree = vm.Available
	}

	// Redis Ping
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	pong, err := worker.RedisClient.Ping(ctx).Result()
	if err == nil {
		metrics.RedisPing = pong
	} else {
		metrics.RedisPing = "FAILED"
	}

	metrics.Uptime = int64(time.Since(startTime).Seconds())

	return c.JSON(metrics)
}
