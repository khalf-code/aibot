# Clawdbot Docker Stack

A complete Docker Compose stack for local development and testing of the Clawdbot project. Includes PostgreSQL, Redis, n8n workflow automation, and an nginx reverse proxy.

## Services

### PostgreSQL 16

- **Port:** 5432
- **Username:** `clawdbot`
- **Password:** `clawdbot_password`
- **Database:** `clawdbot`
- **Volume:** `postgres_data` (persistent storage)
- **Purpose:** Primary database for application and n8n metadata

### Redis 7

- **Port:** 6379
- **Volume:** `redis_data` (persistent storage)
- **Purpose:** Caching and session management

### n8n (Workflow Automation)

- **Port:** 5678 (direct), 8080/workflows (via nginx)
- **Image:** `n8nio/n8n:latest`
- **Database:** PostgreSQL (shared with application)
- **Configuration:**
  - DB: PostgreSQL at `postgres:5432`
  - X-Frame-Options disabled for embedding
  - Base URL: `/workflows`
  - Basic auth disabled (for local dev)
- **Volume:** `n8n_data` (workflow definitions and user data)
- **Purpose:** Visual workflow automation and integration platform

### nginx (Reverse Proxy)

- **Port:** 8080
- **Configuration:** `./nginx/default.conf`
- **Routes:**
  - `/workflows/` → n8n (5678) with WebSocket support
  - `/` → Dashboard at localhost:3000 (configurable)
  - `/health` → Health check endpoint
- **Purpose:** Single entry point for web services with request routing

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- macOS: Docker Desktop configured with `host.docker.internal` support

### Start the Stack

```bash
cd docker
make up
```

### Check Status

```bash
make status
```

### View Logs

```bash
# Follow all logs in real-time
make logs-follow

# View specific service logs
make logs-n8n
make logs-postgres
make logs-nginx

# View last 50 lines of all logs
make logs
```

### Stop the Stack

```bash
make down
```

## Access Services

Once the stack is running:

- **n8n Workflows:** http://localhost:8080/workflows/
- **Dashboard (placeholder):** http://localhost:8080/ (requires service at localhost:3000)
- **PostgreSQL:** `localhost:5432` (from host or other containers)
- **Redis:** `localhost:6379` (from host or other containers)

## Database Connection

### From Host Machine

```bash
# PostgreSQL
psql -h localhost -U clawdbot -d clawdbot

# Redis
redis-cli -h localhost -p 6379
```

### From Inside Containers

```bash
# PostgreSQL
psql -h postgres -U clawdbot -d clawdbot

# Redis
redis-cli -h redis -p 6379
```

### Connection Strings

- **PostgreSQL:** `postgresql://clawdbot:clawdbot_password@postgres:5432/clawdbot`
- **Redis:** `redis://redis:6379`

## Environment Variables

The stack uses hardcoded credentials suitable for local development. For production, consider:

1. Creating a `.env` file in the `docker/` directory
2. Using Docker secrets for sensitive data
3. Implementing environment-specific overrides

To use environment variables:

```bash
# Create docker/.env
POSTGRES_USER=custom_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=custom_db

# Then docker-compose will use these values
docker-compose -f docker-compose.yml up -d
```

## Persistent Data

All services store data in Docker volumes:

- `postgres_data` → PostgreSQL data directory
- `redis_data` → Redis persistent store
- `n8n_data` → n8n workflows and user configuration

These volumes survive container restarts but are removed with `make clean`.

## Networking

All services are connected via the `clawdbot-network` bridge network:

- Service-to-service communication uses container names (e.g., `postgres:5432`)
- From the host, services are accessible via `localhost:<port>`

## Configuration

### nginx Routes

Edit `./nginx/default.conf` to:

- Change proxy destinations
- Add new endpoints
- Modify WebSocket behavior
- Update timeouts

After changes, restart nginx:

```bash
docker-compose restart nginx
```

### n8n Settings

n8n stores configuration in the `n8n_data` volume. To reset:

```bash
docker-compose down -v  # Remove all volumes
make up                  # Rebuild from scratch
```

## Troubleshooting

### Port Already in Use

If ports 5432, 6379, 5678, or 8080 are occupied:

1. Edit `docker-compose.yml` and change the host port (left side of `:`)
2. Restart the stack: `make restart`

### PostgreSQL Connection Failures

1. Check PostgreSQL is healthy: `make status`
2. View logs: `make logs-postgres`
3. Verify credentials in `docker-compose.yml`

### n8n Not Responding

1. Wait 30 seconds for initialization
2. Check logs: `make logs-n8n`
3. Verify PostgreSQL is running: `docker-compose ps`

### nginx Upstream Issues

1. Ensure n8n is healthy: `make logs-n8n`
2. Check nginx config: `docker-compose exec nginx cat /etc/nginx/conf.d/default.conf`
3. Restart nginx: `docker-compose restart nginx`

### Docker Network Issues

On macOS, `host.docker.internal` must resolve correctly. If the dashboard (localhost:3000) is unreachable:

1. Verify your service is running on port 3000
2. Test from inside a container:
   ```bash
   docker-compose exec nginx ping host.docker.internal
   ```

## Makefile Targets

| Target               | Description                       |
| -------------------- | --------------------------------- |
| `make help`          | Show available commands           |
| `make up`            | Start all services                |
| `make down`          | Stop all services                 |
| `make restart`       | Restart all services              |
| `make status`        | Show service status               |
| `make logs`          | Show last 50 lines of all logs    |
| `make logs-follow`   | Follow all logs in real-time      |
| `make logs-n8n`      | Follow n8n logs                   |
| `make logs-postgres` | Follow PostgreSQL logs            |
| `make logs-nginx`    | Follow nginx logs                 |
| `make clean`         | Remove all containers and volumes |

## Development Workflow

### Local Development with OpenClaw

1. **Start the stack:**

   ```bash
   cd docker
   make up
   ```

2. **Run OpenClaw CLI in another terminal:**

   ```bash
   cd ..
   pnpm dev
   ```

3. **Monitor services:**

   ```bash
   # In docker directory
   make logs-follow
   ```

4. **Stop everything:**
   ```bash
   # Stop OpenClaw (Ctrl+C in its terminal)
   # Stop Docker stack
   make down
   ```

### Database Inspection

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U clawdbot -d clawdbot

# List tables
\dt

# Exit
\q
```

### Redis Inspection

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# List all keys
KEYS *

# Get a value
GET key_name

# Exit
EXIT
```

## Performance Tuning

For production or performance testing:

### PostgreSQL

Edit `docker-compose.yml` and add to postgres environment:

```yaml
POSTGRES_INITDB_ARGS: "-c shared_buffers=256MB -c max_connections=200"
```

### Redis

Add to redis command:

```yaml
command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### Resource Limits

Uncomment or add to services:

```yaml
deploy:
  resources:
    limits:
      cpus: "2"
      memory: 2G
    reservations:
      cpus: "1"
      memory: 1G
```

## Cleanup

### Remove Stopped Containers Only

```bash
docker-compose -f docker-compose.yml down
```

### Remove Everything (Including Volumes)

```bash
make clean
```

### Prune System

```bash
docker system prune -a
```

## Notes

- The stack is configured for **local development** with relaxed security settings
- PostgreSQL credentials are in plain text; never use in production
- n8n basic auth is disabled for ease of access
- nginx allows requests from `host.docker.internal` for local dashboard access
- Consider adding `.env` file support for sensitive data in production environments

## Further Reading

- [n8n Documentation](https://docs.n8n.io/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL Docker Guide](https://hub.docker.com/_/postgres)
- [Redis Docker Guide](https://hub.docker.com/_/redis)
- [nginx Docker Guide](https://hub.docker.com/_/nginx)
