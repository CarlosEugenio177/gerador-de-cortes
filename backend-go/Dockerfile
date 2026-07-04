FROM golang:1.24-alpine AS builder

WORKDIR /app

# Instalar dependências necessárias para compilação
RUN apk add --no-cache git gcc musl-dev

# Baixar módulos
COPY go.mod go.sum ./
RUN go mod download

# Copiar código fonte
COPY . .

# Baixar dependências ausentes que o host do Windows pode não ter mapeado a tempo
RUN go get github.com/gofiber/contrib/websocket && go mod tidy

# Compilar binário otimizado
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o gateway ./cmd/server/main.go

# Imagem de produção enxuta
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/gateway .

# Criar pasta para uploads locais
RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["./gateway"]
