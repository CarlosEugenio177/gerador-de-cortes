package websocket

import (
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/redis/go-redis/v9"
)

type Hub struct {
	// Maps projectID to a slice of websocket connections
	Connections map[string][]*websocket.Conn
	mu          sync.RWMutex
	RedisClient *redis.Client
}

var DefaultHub *Hub

func InitHub(redisClient *redis.Client) *Hub {
	DefaultHub = &Hub{
		Connections: make(map[string][]*websocket.Conn),
		RedisClient: redisClient,
	}
	
	return DefaultHub
}

func (h *Hub) AddConnection(projectID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.Connections[projectID] = append(h.Connections[projectID], conn)
	log.Printf("Client connected to project %s", projectID)
}

func (h *Hub) RemoveConnection(projectID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	conns := h.Connections[projectID]
	for i, c := range conns {
		if c == conn {
			h.Connections[projectID] = append(conns[:i], conns[i+1:]...)
			break
		}
	}
	log.Printf("Client disconnected from project %s", projectID)
}

func (h *Hub) Broadcast(projectID string, message string) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	conns, ok := h.Connections[projectID]
	if !ok {
		return
	}

	for _, conn := range conns {
		err := conn.WriteMessage(websocket.TextMessage, []byte(message))
		if err != nil {
			log.Printf("Error sending message to project %s: %v", projectID, err)
			// Connection removal is usually handled by the reader loop in the handler
			// so we just log it here
		}
	}
}
