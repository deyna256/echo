# ===== Stage 1: Go Builder =====
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
    -o /server ./cmd/server

# ===== Stage 2: Frontend Builder =====
FROM node:20-alpine AS frontend-builder

WORKDIR /src/web

COPY web/package*.json ./
COPY web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# ===== Stage 3: Runtime =====
FROM scratch AS runtime

WORKDIR /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server ./
COPY --from=builder /src/migrations ./migrations

EXPOSE 8000
CMD ["./server"]