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
FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/gateway .

# Criar pasta para uploads locais
RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["./gateway"]
