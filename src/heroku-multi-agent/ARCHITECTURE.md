# OpenClaw Multi-Agent Heroku SaaS Architecture

## Overview

This architecture enables deploying OpenClaw as a multi-tenant SaaS platform on Heroku, where each customer gets their own isolated AI agent with pre-configured Telegram bot and Claude API credentials.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HEROKU PLATFORM                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────┐     ┌────────────────────┐    ┌─────────────────────┐  │
│  │    API Gateway     │     │   Agent Manager    │    │   Config Service    │  │
│  │   (Web Dyno x N)   │────▶│   (Worker Dyno)    │◀───│   (Internal)        │  │
│  │                    │     │                    │    │                     │  │
│  │  - REST API        │     │  - Agent Lifecycle │    │  - Encryption       │  │
│  │  - Auth Middleware │     │  - Health Checks   │    │  - Validation       │  │
│  │  - Rate Limiting   │     │  - Auto-scaling    │    │  - Schema Mgmt      │  │
│  └────────────────────┘     └────────────────────┘    └─────────────────────┘  │
│           │                          │                          │               │
│           │                          │                          │               │
│           ▼                          ▼                          ▼               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         PostgreSQL (Heroku Postgres)                     │   │
│  │                                                                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │   │
│  │  │  Customers  │  │   Agents    │  │ Credentials │  │  AgentLogs   │   │   │
│  │  │             │  │             │  │ (encrypted) │  │              │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│           │                          │                                          │
│           │                          ▼                                          │
│           │         ┌────────────────────────────────────┐                     │
│           │         │      Agent Runtime Pool            │                     │
│           │         │       (Worker Dynos x M)           │                     │
│           │         │                                    │                     │
│           │         │  ┌─────────┐ ┌─────────┐          │                     │
│           │         │  │ Agent 1 │ │ Agent 2 │  ...     │                     │
│           │         │  │(Cust A) │ │(Cust B) │          │                     │
│           │         │  └─────────┘ └─────────┘          │                     │
│           │         └────────────────────────────────────┘                     │
│           │                          │                                          │
│           ▼                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          Redis (Heroku Redis)                            │   │
│  │                                                                          │   │
│  │  - Session State        - Rate Limiting         - Pub/Sub Events        │   │
│  │  - Agent Health         - Lock Coordination     - Message Queues        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────┐     ┌────────────────────┐    ┌─────────────────────┐  │
│  │   Telegram API     │     │   Claude API       │    │   Customer Apps     │  │
│  │                    │     │   (Anthropic)      │    │                     │  │
│  │  - Bot webhooks    │     │                    │    │  - Webhooks         │  │
│  │  - Message relay   │     │  - AI completions  │    │  - Status updates   │  │
│  └────────────────────┘     └────────────────────┘    └─────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. **Multi-Tenancy Isolation**
- Each customer has isolated database records
- Credentials encrypted per-customer with unique keys
- Agent processes run in isolated contexts
- No cross-tenant data leakage possible

### 2. **Restricted Configuration**
- Customers CANNOT add new skills
- Customers CANNOT edit existing skills
- Customers CAN configure: Telegram bot, Claude API key, agent name, system prompt
- All configuration changes validated against whitelist

### 3. **Horizontal Scalability**
- Stateless API layer scales via web dynos
- Agent workers scale independently
- Redis handles distributed state
- PostgreSQL handles persistent data

### 4. **Security First**
- AES-256-GCM encryption for credentials
- API key authentication with rate limiting
- Audit logging for all operations
- No plain-text secrets in database

## Data Model

### Customers Table
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    api_key_prefix VARCHAR(8) NOT NULL,  -- For identification
    plan VARCHAR(50) DEFAULT 'free',
    max_agents INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Agents Table
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,  -- URL-friendly identifier
    status VARCHAR(50) DEFAULT 'inactive',

    -- Agent configuration (restricted)
    system_prompt TEXT,
    model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
    max_tokens INTEGER DEFAULT 4096,
    temperature DECIMAL(3,2) DEFAULT 0.7,

    -- Runtime state
    last_active_at TIMESTAMPTZ,
    message_count BIGINT DEFAULT 0,
    error_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id, slug)
);
```

### Credentials Table (Encrypted)
```sql
CREATE TABLE agent_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Telegram credentials (encrypted)
    telegram_bot_token_encrypted BYTEA,
    telegram_bot_token_iv BYTEA,
    telegram_bot_username VARCHAR(255),

    -- Claude API credentials (encrypted)
    claude_api_key_encrypted BYTEA,
    claude_api_key_iv BYTEA,

    -- Encryption metadata
    encryption_key_id VARCHAR(255) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id)
);
```

### Agent Sessions Table
```sql
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_key VARCHAR(512) NOT NULL,
    peer_id VARCHAR(255),
    peer_type VARCHAR(50),  -- 'user', 'group', 'channel'

    -- Session state
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    context JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id, session_key)
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    agent_id UUID REFERENCES agents(id),

    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),

    ip_address INET,
    user_agent TEXT,

    request_data JSONB,
    response_status INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### Authentication
All API requests require an `Authorization: Bearer <api_key>` header.

### Customer Management (Admin Only)
```
POST   /api/v1/admin/customers           - Create customer
GET    /api/v1/admin/customers           - List customers
GET    /api/v1/admin/customers/:id       - Get customer
PATCH  /api/v1/admin/customers/:id       - Update customer
DELETE /api/v1/admin/customers/:id       - Delete customer
POST   /api/v1/admin/customers/:id/rotate-key - Rotate API key
```

### Agent Management (Customer Scope)
```
POST   /api/v1/agents                    - Create agent
GET    /api/v1/agents                    - List customer's agents
GET    /api/v1/agents/:id                - Get agent details
PATCH  /api/v1/agents/:id                - Update agent config
DELETE /api/v1/agents/:id                - Delete agent
POST   /api/v1/agents/:id/start          - Start agent
POST   /api/v1/agents/:id/stop           - Stop agent
POST   /api/v1/agents/:id/restart        - Restart agent
GET    /api/v1/agents/:id/status         - Get agent runtime status
GET    /api/v1/agents/:id/logs           - Get agent logs
GET    /api/v1/agents/:id/stats          - Get agent statistics
```

### Credentials Management (Customer Scope)
```
PUT    /api/v1/agents/:id/credentials/telegram  - Set Telegram credentials
PUT    /api/v1/agents/:id/credentials/claude    - Set Claude API credentials
DELETE /api/v1/agents/:id/credentials/telegram  - Remove Telegram credentials
DELETE /api/v1/agents/:id/credentials/claude    - Remove Claude credentials
GET    /api/v1/agents/:id/credentials/status    - Check credentials status (not values)
POST   /api/v1/agents/:id/credentials/validate  - Validate credentials
```

### Sessions & Analytics (Customer Scope)
```
GET    /api/v1/agents/:id/sessions       - List agent sessions
GET    /api/v1/agents/:id/sessions/:sid  - Get session details
DELETE /api/v1/agents/:id/sessions/:sid  - Clear session
GET    /api/v1/analytics/usage           - Get usage analytics
GET    /api/v1/analytics/messages        - Get message statistics
```

### Webhooks (Customer Scope)
```
POST   /api/v1/webhooks                  - Register webhook
GET    /api/v1/webhooks                  - List webhooks
DELETE /api/v1/webhooks/:id              - Remove webhook
```

## Configuration Restrictions

### Allowed Configuration Fields
Customers can ONLY modify these fields:

```typescript
const ALLOWED_AGENT_CONFIG = {
  // Basic info
  name: true,

  // System prompt customization
  systemPrompt: true,

  // Model selection (from approved list)
  model: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-5-20241022'],

  // Generation parameters
  maxTokens: { min: 256, max: 8192 },
  temperature: { min: 0, max: 1 },

  // Channel-specific
  telegram: {
    allowFrom: true,       // Whitelist users
    groupPolicy: true,     // open/disabled/allowlist
    dmPolicy: true,        // pairing/allowlist/open/disabled
  }
};
```

### Blocked Configuration
- Adding new tools/skills
- Modifying existing tools/skills
- Changing tool permissions
- Accessing file system outside sandbox
- Modifying routing rules directly
- Accessing other customers' data

## Security Architecture

### Credential Encryption
```typescript
// Each customer gets a unique encryption context
const encryptCredential = (value: string, customerId: string): EncryptedData => {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  const derivedKey = deriveKey(masterKey, customerId); // HKDF
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag };
};
```

### API Key Generation
```typescript
const generateApiKey = (): { key: string; hash: string; prefix: string } => {
  const key = `oc_${crypto.randomBytes(32).toString('base64url')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 11); // "oc_" + 8 chars
  return { key, hash, prefix };
};
```

### Rate Limiting
```typescript
const rateLimits = {
  api: {
    free: { requests: 100, window: '1h' },
    pro: { requests: 1000, window: '1h' },
    enterprise: { requests: 10000, window: '1h' },
  },
  agents: {
    free: { messages: 100, window: '24h' },
    pro: { messages: 1000, window: '24h' },
    enterprise: { messages: 10000, window: '24h' },
  },
};
```

## Heroku Deployment

### Dyno Configuration
```yaml
# Procfile
web: node dist/heroku-multi-agent/api-server.js
worker: node dist/heroku-multi-agent/agent-worker.js
scheduler: node dist/heroku-multi-agent/scheduler.js
```

### Environment Variables
```bash
# Database
DATABASE_URL=postgres://...

# Redis
REDIS_URL=redis://...

# Security
ENCRYPTION_MASTER_KEY=<32-byte-base64>
JWT_SECRET=<random-string>
ADMIN_API_KEY=<admin-key>

# Heroku
HEROKU_API_KEY=<for-scaling>
HEROKU_APP_NAME=<app-name>

# External
TELEGRAM_WEBHOOK_BASE_URL=https://your-app.herokuapp.com
```

### Add-ons Required
- Heroku Postgres (Standard-0 or higher for production)
- Heroku Redis (Premium-0 or higher for production)
- Papertrail (logging)
- Heroku Scheduler (cron jobs)

### Scaling Strategy
```bash
# API layer (stateless, scale horizontally)
heroku ps:scale web=2:standard-1x

# Agent workers (one per ~50 concurrent agents)
heroku ps:scale worker=4:standard-2x

# Scheduler (single instance)
heroku ps:scale scheduler=1:standard-1x
```

## Agent Lifecycle

### State Machine
```
                 ┌─────────┐
                 │ CREATED │
                 └────┬────┘
                      │ configure credentials
                      ▼
                 ┌─────────┐
            ┌────│ READY   │────┐
            │    └────┬────┘    │
     error  │         │ start   │ delete
            │         ▼         │
            │    ┌─────────┐    │
            └───▶│ RUNNING │◀───┘
                 └────┬────┘
                      │ stop/error
                      ▼
                 ┌─────────┐
                 │ STOPPED │
                 └─────────┘
```

### Health Monitoring
- Heartbeat every 30 seconds
- Auto-restart on 3 consecutive failures
- Alert webhook on extended downtime
- Metrics collected: response time, error rate, message count

## Message Flow

```
1. Telegram Message Received
   │
   ▼
2. Webhook Handler (API Dyno)
   │
   ├─▶ Validate webhook signature
   │
   ├─▶ Lookup agent by bot token hash
   │
   └─▶ Publish to Redis queue

3. Agent Worker (Worker Dyno)
   │
   ├─▶ Consume from Redis queue
   │
   ├─▶ Load agent config + credentials
   │
   ├─▶ Decrypt Claude API key
   │
   ├─▶ Process with OpenClaw agent runtime
   │
   └─▶ Send response via Telegram API

4. Response Delivery
   │
   ├─▶ Update session state
   │
   ├─▶ Log to audit trail
   │
   └─▶ Emit webhook to customer (optional)
```

## Integration Example

See `examples/integration-example.ts` for a complete working example of:
1. Creating a customer account
2. Setting up an agent with Telegram + Claude credentials
3. Starting the agent
4. Handling webhooks for real-time updates

## File Structure

```
src/heroku-multi-agent/
├── api/
│   ├── server.ts           # Express server setup
│   ├── routes/
│   │   ├── admin.ts        # Admin routes
│   │   ├── agents.ts       # Agent CRUD
│   │   ├── credentials.ts  # Credential management
│   │   ├── sessions.ts     # Session management
│   │   └── webhooks.ts     # Webhook management
│   ├── middleware/
│   │   ├── auth.ts         # API key validation
│   │   ├── rate-limit.ts   # Rate limiting
│   │   └── audit.ts        # Audit logging
│   └── validators/
│       └── schemas.ts      # Zod schemas
├── db/
│   ├── client.ts           # Database client
│   ├── migrations/         # SQL migrations
│   └── repositories/       # Data access layer
├── services/
│   ├── encryption.ts       # Credential encryption
│   ├── agent-manager.ts    # Agent lifecycle
│   ├── config-builder.ts   # OpenClaw config generation
│   └── telegram-webhook.ts # Telegram webhook handling
├── worker/
│   ├── index.ts            # Worker entry point
│   ├── agent-runner.ts     # Agent execution
│   └── health-monitor.ts   # Health checks
├── scheduler/
│   └── index.ts            # Scheduled tasks
└── examples/
    └── integration-example.ts
```
