package main

import (
	"flag"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"
)

type Result struct {
	Duration   time.Duration
	StatusCode int
	Error      error
}

func main() {
	targetURL := flag.String("target", "http://localhost:8000/api/v1/projects", "Target URL to benchmark")
	concurrency := flag.Int("c", 10, "Number of concurrent workers")
	totalRequests := flag.Int("n", 100, "Total number of requests to execute")
	flag.Parse()

	fmt.Printf("====================================================\n")
	fmt.Printf("🚀 ClipForge AI - Benchmark & Load Testing Tool\n")
	fmt.Printf("Target:      %s\n", *targetURL)
	fmt.Printf("Concurrency: %d workers\n", *concurrency)
	fmt.Printf("Total Reqs:  %d requests\n", *totalRequests)
	fmt.Printf("====================================================\n\n")

	jobs := make(chan int, *totalRequests)
	results := make(chan Result, *totalRequests)
	var wg sync.WaitGroup

	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 100,
		},
	}

	startTime := time.Now()

	// Spawn workers
	for w := 0; w < *concurrency; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range jobs {
				reqStart := time.Now()
				resp, err := client.Get(*targetURL)
				reqDuration := time.Since(reqStart)

				status := 0
				if resp != nil {
					status = resp.StatusCode
					resp.Body.Close()
				}

				results <- Result{
					Duration:   reqDuration,
					StatusCode: status,
					Error:      err,
				}
			}
		}()
	}

	// Send jobs
	for i := 0; i < *totalRequests; i++ {
		jobs <- i
	}
	close(jobs)

	wg.Wait()
	close(results)

	totalTime := time.Since(startTime)

	// Analyze results
	var durations []time.Duration
	successCount := 0
	errorCount := 0
	statusCodes := make(map[int]int)

	for r := range results {
		if r.Error != nil {
			errorCount++
		} else {
			durations = append(durations, r.Duration)
			statusCodes[r.StatusCode]++
			if r.StatusCode >= 200 && r.StatusCode < 300 {
				successCount++
			}
		}
	}

	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})

	rps := float64(*totalRequests) / totalTime.Seconds()

	var p50, p95, p99 time.Duration
	if len(durations) > 0 {
		p50 = durations[len(durations)*50/100]
		p95 = durations[len(durations)*95/100]
		p99 = durations[len(durations)*99/100]
	}

	fmt.Printf("------------------ RESULTS ------------------\n")
	fmt.Printf("Total Time Elapsed: %v\n", totalTime)
	fmt.Printf("Throughput:         %.2f req/s\n", rps)
	fmt.Printf("Success Rate:       %.1f%% (%d / %d)\n", float64(successCount)/float64(*totalRequests)*100, successCount, *totalRequests)
	fmt.Printf("Errors:             %d\n", errorCount)
	fmt.Printf("Latency (p50):      %v\n", p50)
	fmt.Printf("Latency (p95):      %v\n", p95)
	fmt.Printf("Latency (p99):      %v\n", p99)
	fmt.Printf("HTTP Status Breakdown:\n")
	for code, count := range statusCodes {
		fmt.Printf("  [%d]: %d responses\n", code, count)
	}
	fmt.Printf("====================================================\n")
}
