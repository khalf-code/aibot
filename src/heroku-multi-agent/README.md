# OpenClaw Multi-Agent Heroku Platform

A production-ready, scalable multi-tenant AI agent platform built on OpenClaw, deployable to Heroku. This platform enables you to provision isolated AI agents for your SaaS customers, each with their own Telegram bot and Claude API credentials.

## Features

- **Multi-Tenant Architecture**: Complete isolation between customers
- **Secure Credential Storage**: AES-256-GCM encryption with per-customer key derivation
- **Horizontal Scaling**: Stateless API, distributed workers with Redis coordination
- **Restricted Configuration**: Customers can configure agents without accessing skills/tools
- **Comprehensive API**: RESTful API for all operations
- **Webhook Support**: Real-time event notifications
- **Rate Limiting**: Tiered limits by subscription plan

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 14+
- Redis 6+
- Heroku CLI (for deployment)

### Local Development

```bash
# Clone the repository
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Install dependencies
pnpm install

# Set up environment variables
cp src/heroku-multi-agent/.env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm run migrate

# Start the API server
pnpm run dev:api

# In another terminal, start the worker
pnpm run dev:worker
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/openclaw

# Redis
REDIS_URL=redis://localhost:6379

# Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_MASTER_KEY=<32-byte-base64-encoded-key>
ADMIN_API_KEY=<strong-random-string>

# Optional
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=*
TELEGRAM_WEBHOOK_BASE_URL=https://your-domain.com
```

## Heroku Deployment

### One-Click Deploy

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/openclaw/openclaw)

### Manual Deployment

```bash
# Create Heroku app
heroku create your-app-name

# Add required add-ons
heroku addons:create heroku-postgresql:essential-0
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set ENCRYPTION_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
heroku config:set ADMIN_API_KEY=$(openssl rand -hex 32)
heroku config:set TELEGRAM_WEBHOOK_BASE_URL=https://your-app-name.herokuapp.com

# Deploy
git push heroku main

# Scale dynos
heroku ps:scale web=1 worker=1

# Run migrations
heroku run node dist/heroku-multi-agent/scripts/run-migrations.js
```

## API Reference

### Authentication

All API requests require an `Authorization: Bearer <api_key>` header.

### Admin Endpoints (requires admin API key)

#### Create Customer
```http
POST /api/v1/admin/customers
Content-Type: application/json
Authorization: Bearer <admin-api-key>

{
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "plan": "pro",
  "maxAgents": 5
}
```

Response:
```json
{
  "customer": {
    "id": "uuid",
    "name": "Acme Corp",
    "email": "admin@acme.com",
    "apiKeyPrefix": "oc_abc12345",
    "plan": "pro",
    "maxAgents": 5,
    "status": "active"
  },
  "apiKey": "oc_full-api-key-here"
}
```

#### List Customers
```http
GET /api/v1/admin/customers?plan=pro&limit=10
Authorization: Bearer <admin-api-key>
```

#### Rotate Customer API Key
```http
POST /api/v1/admin/customers/:id/rotate-key
Authorization: Bearer <admin-api-key>
```

### Customer Endpoints (requires customer API key)

#### Create Agent
```http
POST /api/v1/agents
Content-Type: application/json
Authorization: Bearer <customer-api-key>

{
  "name": "Support Bot",
  "systemPrompt": "You are a helpful support assistant.",
  "model": "claude-sonnet-4-20250514",
  "telegramDmPolicy": "open"
}
```

#### Set Telegram Credentials
```http
PUT /api/v1/agents/:id/credentials/telegram
Content-Type: application/json
Authorization: Bearer <customer-api-key>

{
  "botToken": "123456:ABC-DEF...",
  "botUsername": "MySupportBot"
}
```

#### Set Claude API Credentials
```http
PUT /api/v1/agents/:id/credentials/claude
Content-Type: application/json
Authorization: Bearer <customer-api-key>

{
  "apiKey": "sk-ant-api..."
}
```

#### Validate Credentials
```http
POST /api/v1/agents/:id/credentials/validate
Authorization: Bearer <customer-api-key>
```

#### Start Agent
```http
POST /api/v1/agents/:id/start
Authorization: Bearer <customer-api-key>
```

#### Stop Agent
```http
POST /api/v1/agents/:id/stop
Authorization: Bearer <customer-api-key>
```

#### Get Agent Status
```http
GET /api/v1/agents/:id/status
Authorization: Bearer <customer-api-key>
```

## Configuration Restrictions

Customers can modify only these agent settings:

| Setting | Type | Description |
|---------|------|-------------|
| `name` | string | Agent display name |
| `systemPrompt` | string | AI system instructions (max 10KB) |
| `model` | enum | `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-haiku-3-5-20241022` |
| `maxTokens` | number | 256-8192 |
| `temperature` | number | 0-1 |
| `telegramAllowFrom` | string[] | Allowed user IDs/usernames |
| `telegramGroupPolicy` | enum | `open`, `disabled`, `allowlist` |
| `telegramDmPolicy` | enum | `pairing`, `allowlist`, `open`, `disabled` |

**Customers CANNOT**:
- Add or modify tools/skills
- Access the file system
- Change routing rules
- Access other customers' data

## Rate Limits

| Plan | API Requests | Messages |
|------|-------------|----------|
| Free | 100/hour | 100/day |
| Pro | 1,000/hour | 1,000/day |
| Enterprise | 10,000/hour | 10,000/day |

## Webhooks

Configure a webhook URL to receive real-time events:

```http
PATCH /api/v1/admin/customers/:id
{
  "webhookUrl": "https://your-app.com/webhooks/openclaw"
}
```

### Event Types

- `agent.started` - Agent began running
- `agent.stopped` - Agent stopped
- `agent.error` - Agent encountered an error
- `message.processed` - Agent processed a message

### Webhook Payload

```json
{
  "type": "agent.started",
  "agentId": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {}
}
```

### Signature Verification

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

## SDK Usage

```typescript
import { OpenClawClient } from './examples/sdk-client';

// Admin client for customer management
const admin = new OpenClawClient({
  baseUrl: 'https://your-app.herokuapp.com',
  apiKey: process.env.ADMIN_API_KEY,
});

// Create a customer
const { customer, apiKey } = await admin.createCustomer({
  name: 'Acme Corp',
  email: 'admin@acme.com',
  plan: 'pro',
});

// Customer client for agent management
const client = new OpenClawClient({
  baseUrl: 'https://your-app.herokuapp.com',
  apiKey: apiKey,
});

// Create and configure an agent
const { agent } = await client.createAgent({
  name: 'Support Bot',
  systemPrompt: 'You are a helpful assistant.',
});

await client.setTelegramCredentials(agent.id, {
  botToken: process.env.TELEGRAM_TOKEN,
});

await client.setClaudeCredentials(agent.id, {
  apiKey: process.env.CLAUDE_API_KEY,
});

// Start the agent
await client.startAgent(agent.id);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HEROKU PLATFORM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  API Server  │    │    Worker    │    │   Scheduler  │  │
│  │  (Web Dyno)  │───▶│(Worker Dyno) │◀───│   (Cron)     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PostgreSQL + Redis                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Telegram │  │  Claude  │  │ Customer │
        │   API    │  │   API    │  │   Apps   │
        └──────────┘  └──────────┘  └──────────┘
```

## Monitoring

### Health Check
```http
GET /health
```

### Metrics
- Dyno metrics: Heroku dashboard
- Database: `heroku pg:info`
- Redis: `heroku redis:info`

### Logs
```bash
heroku logs --tail
heroku logs --dyno web
heroku logs --dyno worker
```

## Security

- All credentials encrypted with AES-256-GCM
- Per-customer encryption keys derived via HKDF
- API key hashed with SHA-256 (never stored plain)
- Rate limiting prevents abuse
- Audit logging for all operations
- No cross-tenant data access

## License

MIT License. See LICENSE file.

## Support

- Documentation: https://docs.openclaw.ai/multi-agent
- Issues: https://github.com/openclaw/openclaw/issues
- Email: support@openclaw.ai
