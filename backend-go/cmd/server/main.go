package main

import (
	"log"
	"clipforge-gateway/internal/api/handlers"
	"clipforge-gateway/internal/config"
	"clipforge-gateway/internal/repository"
	"clipforge-gateway/internal/worker"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/contrib/websocket"
	websocket_pkg "clipforge-gateway/pkg/websocket"
)

func main() {
	// Load Configuration
	cfg := config.LoadConfig()

	// Connect to Database & Redis
	repository.ConnectDB(cfg)
	worker.ConnectRedis(cfg)

	// Setup Fiber
	app := fiber.New(fiber.Config{
		AppName:       "ClipForge API Gateway",
		BodyLimit:     1024 * 1024 * 1024, // 1GB limit for videos
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Setup WebSocket Hub
	wsHub := websocket_pkg.InitHub(worker.RedisClient)
	
	// Start Event Listeners
	worker.StartEventListeners()

	// Routes
	v1 := app.Group("/api/v1")

	// WebSockets Upgrade Middleware
	v1.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// WebSocket Endpoint
	app.Get("/api/v1/ws/projects/:id", websocket.New(func(c *websocket.Conn) {
		projectID := c.Params("id")
		wsHub.AddConnection(projectID, c)
		defer wsHub.RemoveConnection(projectID, c)

		// Keep connection alive, listen for ping/close
		for {
			mt, msg, err := c.ReadMessage()
			if err != nil {
				break
			}
			if mt == websocket.TextMessage && string(msg) == "ping" {
				c.WriteMessage(websocket.TextMessage, []byte("pong"))
			}
		}
	}))
	
	// Health
	v1.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "healthy", "service": "go-gateway"})
	})

	// Static Files
	app.Static("/uploads", "./uploads", fiber.Static{
		ByteRange: true,
	})

	// Projects
	projects := v1.Group("/projects")
	projects.Post("/", handlers.CreateProject)
	projects.Get("/", handlers.GetProjects)
	projects.Get("/:id", handlers.GetProject)
	projects.Delete("/:id", handlers.DeleteProject)
	projects.Post("/:id/reprocess", handlers.ReprocessProject)
	projects.Post("/:id/cancel", handlers.CancelProject)
	projects.Post("/:id/transcribe", handlers.TranscribeProject)
	projects.Get("/:id/transcript", handlers.GetTranscript)
	projects.Put("/:id/transcript", handlers.SaveTranscript)
	projects.Post("/:id/render-custom", handlers.RenderCustomProject)

	// Clips
	clips := v1.Group("/clips")
	clips.Get("/", handlers.GetAllClips)
	clips.Delete("/:id", handlers.DeleteClip)

	// Listen
	log.Printf("Starting API Gateway on port %s...", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
