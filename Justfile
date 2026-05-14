# Docker
dev:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait

prod: build-ui
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --wait

build-ui:
    cd web && just build

down:
    docker compose -f docker-compose.yml -f docker-compose.prod.yml down || true
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down || true
    docker compose down || true

clean:
    docker compose -f docker-compose.yml -f docker-compose.prod.yml down --rmi local -v || true
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down --rmi local -v || true
    docker compose down --rmi local -v || true
    rm -rf web/dist
