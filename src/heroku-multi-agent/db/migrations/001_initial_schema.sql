-- OpenClaw Multi-Agent Heroku SaaS Schema
-- Migration: 001_initial_schema
-- Description: Initial database schema for multi-tenant agent management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
CREATE TYPE customer_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE customer_plan AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE agent_status AS ENUM ('created', 'ready', 'running', 'stopped', 'error');
CREATE TYPE audit_action AS ENUM (
    'customer.create', 'customer.update', 'customer.delete', 'customer.rotate_key',
    'agent.create', 'agent.update', 'agent.delete', 'agent.start', 'agent.stop',
    'credentials.set', 'credentials.delete', 'credentials.validate',
    'session.create', 'session.delete',
    'webhook.create', 'webhook.delete'
);

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,

    -- API authentication
    api_key_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash
    api_key_prefix VARCHAR(11) NOT NULL, -- "oc_" + 8 chars for identification

    -- Subscription
    plan customer_plan DEFAULT 'free',
    max_agents INTEGER DEFAULT 1,

    -- Status
    status customer_status DEFAULT 'active',

    -- Metadata
    metadata JSONB DEFAULT '{}',
    webhook_url TEXT,
    webhook_secret VARCHAR(64),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Identification
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,

    -- Status
    status agent_status DEFAULT 'created',

    -- Configuration (restricted - only these fields can be modified)
    system_prompt TEXT,
    model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
    max_tokens INTEGER DEFAULT 4096 CHECK (max_tokens >= 256 AND max_tokens <= 8192),
    temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),

    -- Telegram-specific config
    telegram_allow_from TEXT[] DEFAULT '{}',
    telegram_group_policy VARCHAR(50) DEFAULT 'disabled',
    telegram_dm_policy VARCHAR(50) DEFAULT 'allowlist',

    -- Runtime metrics
    last_active_at TIMESTAMPTZ,
    message_count BIGINT DEFAULT 0,
    error_count INTEGER DEFAULT 0,

    -- Worker assignment
    worker_id VARCHAR(255),
    worker_assigned_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(customer_id, slug)
);

-- Agent credentials table (encrypted)
CREATE TABLE agent_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Telegram credentials (AES-256-GCM encrypted)
    telegram_bot_token_encrypted BYTEA,
    telegram_bot_token_iv BYTEA,
    telegram_bot_token_tag BYTEA,
    telegram_bot_username VARCHAR(255),
    telegram_webhook_configured BOOLEAN DEFAULT FALSE,

    -- Claude API credentials (AES-256-GCM encrypted)
    claude_api_key_encrypted BYTEA,
    claude_api_key_iv BYTEA,
    claude_api_key_tag BYTEA,

    -- Encryption key version (for key rotation)
    encryption_key_version INTEGER DEFAULT 1,

    -- Validation timestamps
    telegram_validated_at TIMESTAMPTZ,
    claude_validated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id)
);

-- Agent sessions table
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Session identification
    session_key VARCHAR(512) NOT NULL,
    peer_id VARCHAR(255),
    peer_type VARCHAR(50),  -- 'user', 'group', 'channel'
    peer_name VARCHAR(255),

    -- Session state
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,

    -- Context (conversation history summary)
    context JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id, session_key)
);

-- Customer webhooks table
CREATE TABLE customer_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Webhook configuration
    url TEXT NOT NULL,
    secret VARCHAR(64) NOT NULL,

    -- Event subscriptions
    events TEXT[] DEFAULT ARRAY['agent.started', 'agent.stopped', 'agent.error', 'message.received'],

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

    -- Action details
    action audit_action NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),

    -- Request context
    ip_address INET,
    user_agent TEXT,

    -- Request/response data
    request_data JSONB,
    response_status INTEGER,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Limit type
    limit_type VARCHAR(50) NOT NULL,  -- 'api', 'messages'

    -- Window tracking
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    request_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id, limit_type, window_start)
);

-- Indexes for performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_api_key_prefix ON customers(api_key_prefix);
CREATE INDEX idx_customers_status ON customers(status);

CREATE INDEX idx_agents_customer_id ON agents(customer_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_slug ON agents(slug);
CREATE INDEX idx_agents_worker_id ON agents(worker_id);

CREATE INDEX idx_agent_credentials_agent_id ON agent_credentials(agent_id);

CREATE INDEX idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX idx_agent_sessions_session_key ON agent_sessions(session_key);
CREATE INDEX idx_agent_sessions_peer_id ON agent_sessions(peer_id);

CREATE INDEX idx_customer_webhooks_customer_id ON customer_webhooks(customer_id);
CREATE INDEX idx_customer_webhooks_is_active ON customer_webhooks(is_active);

CREATE INDEX idx_audit_logs_customer_id ON audit_logs(customer_id);
CREATE INDEX idx_audit_logs_agent_id ON audit_logs(agent_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_rate_limits_customer_id ON rate_limits(customer_id);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start, window_end);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_credentials_updated_at
    BEFORE UPDATE ON agent_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_sessions_updated_at
    BEFORE UPDATE ON agent_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_webhooks_updated_at
    BEFORE UPDATE ON customer_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE customers IS 'SaaS customer accounts with API authentication';
COMMENT ON TABLE agents IS 'AI agents owned by customers with restricted configuration';
COMMENT ON TABLE agent_credentials IS 'Encrypted credentials for Telegram and Claude API';
COMMENT ON TABLE agent_sessions IS 'Conversation sessions for each agent';
COMMENT ON TABLE customer_webhooks IS 'Webhook endpoints for customer notifications';
COMMENT ON TABLE audit_logs IS 'Audit trail for all API operations';
COMMENT ON TABLE rate_limits IS 'API and message rate limiting per customer';
