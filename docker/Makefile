.PHONY: help up down logs clean restart logs-follow logs-n8n logs-postgres logs-nginx

help:
	@echo "Clawdbot Docker Stack Management"
	@echo "================================="
	@echo ""
	@echo "Available targets:"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make logs            - Show logs from all services (last 50 lines)"
	@echo "  make logs-follow     - Follow logs from all services in real-time"
	@echo "  make logs-n8n        - Show n8n service logs"
	@echo "  make logs-postgres   - Show PostgreSQL service logs"
	@echo "  make logs-nginx      - Show nginx service logs"
	@echo "  make clean           - Remove all containers and volumes (WARNING: destroys data)"
	@echo "  make status          - Show status of all services"
	@echo ""

up:
	@echo "Starting Clawdbot Docker stack..."
	docker-compose -f docker-compose.yml up -d
	@echo "Stack is starting up. Run 'make logs-follow' to watch progress."
	@echo ""
	@echo "Services will be available at:"
	@echo "  - n8n workflows: http://localhost:8080/workflows/"
	@echo "  - Dashboard: http://localhost:8080/"
	@echo "  - PostgreSQL: localhost:5432"
	@echo "  - Redis: localhost:6379"

down:
	@echo "Stopping Clawdbot Docker stack..."
	docker-compose -f docker-compose.yml down
	@echo "Stack stopped."

restart: down up

logs:
	@docker-compose -f docker-compose.yml logs --tail=50

logs-follow:
	@docker-compose -f docker-compose.yml logs -f

logs-n8n:
	@docker-compose -f docker-compose.yml logs -f n8n

logs-postgres:
	@docker-compose -f docker-compose.yml logs -f postgres

logs-nginx:
	@docker-compose -f docker-compose.yml logs -f nginx

status:
	@echo "Clawdbot Docker Stack Status"
	@echo "============================="
	@docker-compose -f docker-compose.yml ps
	@echo ""
	@echo "Network Status:"
	@docker network inspect clawdbot-network 2>/dev/null | grep -E '(Name|Containers)' || echo "Network not found"

clean:
	@echo "WARNING: This will remove all containers and volumes (destroys data)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f docker-compose.yml down -v; \
		echo "Stack cleaned up."; \
	else \
		echo "Aborted."; \
	fi

.PHONY: help up down logs logs-follow logs-n8n logs-postgres logs-nginx clean status restart
