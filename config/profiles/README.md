# OpenClaw Clawdbot Configuration Profiles

This directory contains environment profiles for different deployment and development scenarios. Each profile is a pre-configured `.env` file that establishes safe defaults for its context.

## Philosophy

- **Safe by Default**: Development profiles cannot access production secrets or affect real accounts
- **Explicit Enablement**: Production features are explicitly enabled only in production contexts
- **Clear Intent**: Each profile clearly communicates its safety boundaries

## Available Profiles

### Development Profile (`dev.env`)

**Purpose**: Local development and testing with zero risk of touching production

**Key Safety Characteristics**:

- `CLAWDBOT_SAFE_MODE=true` — Global safety flag
- `CLAWDBOT_ALLOW_EXTERNAL_SEND=false` — No outbound messages to real channels
- `CLAWDBOT_ALLOW_EXTERNAL_CALLS=false` — No external API calls
- `CLAWDBOT_ALLOW_PAYMENTS=false` — No payment processing
- `CLAWDBOT_SECRETS_SCOPE=dev-only` — Dev-only credentials, no prod access
- `CLAWDBOT_N8N_DRY_RUN=true` — n8n runs in dry-run (no side effects)
- `CLAWDBOT_LOG_LEVEL=debug` — Verbose logging for troubleshooting

**Additional Settings**:

- Local gateway mode on port 18789
- Telemetry and crash reporting disabled
- Limited to 2 worker threads for dev efficiency
- Production channels and real-time sync disabled

**When to Use**:

- Daily development work
- Testing features locally
- Debugging issues
- Running test suites

### Production Profile (`prod.env`)

**Purpose**: Safe production deployment with proper oversight and guardrails

**Key Characteristics**:

- `CLAWDBOT_SAFE_MODE=false` — Full functionality enabled
- `CLAWDBOT_ALLOW_EXTERNAL_SEND=true` — Messages sent to real channels
- `CLAWDBOT_ALLOW_EXTERNAL_CALLS=true` — External API calls enabled
- `CLAWDBOT_ALLOW_PAYMENTS=true` — Payment processing enabled
- `CLAWDBOT_SECRETS_SCOPE=prod` — Production credentials via secrets manager
- `CLAWDBOT_N8N_DRY_RUN=false` — n8n executes workflows fully
- `CLAWDBOT_LOG_LEVEL=info` — Standard logging for production

**Safety Guardrails**:

- `CLAWDBOT_REQUIRE_CHANNEL_ALLOWLIST=true` — Restrict to approved channels
- `CLAWDBOT_REQUIRE_COMMAND_ALLOWLIST=true` — Restrict to approved commands
- `CLAWDBOT_REQUIRE_PAYMENT_ALLOWLIST=true` — Restrict payment recipients
- Telemetry and crash reporting enabled for monitoring
- 8 worker threads for production throughput
- Managed gateway mode on port 443

**When to Use**:

- Production deployments
- Staging environments that mirror production
- Release testing with real endpoints
- Customer-facing instances

## Usage

### Environment Variable Precedence

The configuration system follows this precedence order (highest to lowest):

1. **Command-line flags** and explicit env vars set in shell
2. **`.env` file in working directory** (if present)
3. **Profile file** (explicitly loaded via `CLAWDBOT_PROFILE` or `--profile`)
4. **Built-in defaults** in the application code

### Loading a Profile

#### Method 1: Environment Variable

```bash
export CLAWDBOT_PROFILE=dev
# Application loads config/profiles/dev.env
node app.js
```

#### Method 2: Command-line Flag

```bash
node app.js --profile=dev
```

#### Method 3: Explicit Sourcing

```bash
source config/profiles/dev.env
node app.js
```

### Overriding Profile Settings

You can override specific settings from a profile:

```bash
# Load dev profile, but enable external sends for testing
CLAWDBOT_PROFILE=dev CLAWDBOT_ALLOW_EXTERNAL_SEND=true node app.js
```

## Creating Custom Profiles

If you need a custom profile (e.g., staging, integration testing), create a new `.env` file:

```bash
# Create staging.env
cp config/profiles/prod.env config/profiles/staging.env
# Edit staging.env and adjust settings for staging environment
```

**Naming Convention**: Use lowercase, hyphen-separated names (e.g., `staging.env`, `e2e-test.env`)

## Environment Variables Reference

### Safety Flags

| Variable                        | Type    | Dev           | Prod         | Description                                   |
| ------------------------------- | ------- | ------------- | ------------ | --------------------------------------------- |
| `CLAWDBOT_ENV`                  | string  | `development` | `production` | Environment mode                              |
| `CLAWDBOT_SAFE_MODE`            | boolean | `true`        | `false`      | Global safety flag; disables external effects |
| `CLAWDBOT_ALLOW_EXTERNAL_SEND`  | boolean | `false`       | `true`       | Allow sending messages to real channels       |
| `CLAWDBOT_ALLOW_EXTERNAL_CALLS` | boolean | `false`       | `true`       | Allow outbound API calls                      |
| `CLAWDBOT_ALLOW_PAYMENTS`       | boolean | `false`       | `true`       | Allow payment processing                      |

### Secrets & Credentials

| Variable                 | Type   | Dev        | Prod   | Description                 |
| ------------------------ | ------ | ---------- | ------ | --------------------------- |
| `CLAWDBOT_SECRETS_SCOPE` | string | `dev-only` | `prod` | Scope for credential lookup |

### Service Behaviors

| Variable                          | Type    | Dev     | Prod    | Description                        |
| --------------------------------- | ------- | ------- | ------- | ---------------------------------- |
| `CLAWDBOT_N8N_DRY_RUN`            | boolean | `true`  | `false` | n8n dry-run mode (no side effects) |
| `CLAWDBOT_LOG_LEVEL`              | string  | `debug` | `info`  | Logging verbosity                  |
| `CLAWDBOT_ENABLE_TELEMETRY`       | boolean | `false` | `true`  | Enable telemetry collection        |
| `CLAWDBOT_ENABLE_CRASH_REPORTING` | boolean | `false` | `true`  | Enable crash reporting             |

### Gateway Settings

| Variable                | Type   | Dev                     | Prod                      | Description             |
| ----------------------- | ------ | ----------------------- | ------------------------- | ----------------------- |
| `CLAWDBOT_GATEWAY_MODE` | string | `local`                 | `managed`                 | Gateway deployment mode |
| `CLAWDBOT_GATEWAY_PORT` | number | `18789`                 | `443`                     | Gateway listening port  |
| `CLAWDBOT_API_BASE_URL` | string | `http://localhost:3000` | `https://api.openclaw.ai` | API endpoint URL        |

### Feature Flags

| Variable                         | Type    | Dev     | Prod   | Description                              |
| -------------------------------- | ------- | ------- | ------ | ---------------------------------------- |
| `CLAWDBOT_ENABLE_PROD_CHANNELS`  | boolean | `false` | `true` | Enable production channel integrations   |
| `CLAWDBOT_ENABLE_REAL_TIME_SYNC` | boolean | `false` | `true` | Enable real-time message synchronization |
| `CLAWDBOT_MAX_WORKERS`           | number  | `2`     | `8`    | Maximum concurrent worker threads        |

### Allowlists (Production Only)

| Variable                             | Type    | Default       | Description                         |
| ------------------------------------ | ------- | ------------- | ----------------------------------- |
| `CLAWDBOT_REQUIRE_CHANNEL_ALLOWLIST` | boolean | `true` (prod) | Require approved channel list       |
| `CLAWDBOT_REQUIRE_COMMAND_ALLOWLIST` | boolean | `true` (prod) | Require approved command list       |
| `CLAWDBOT_REQUIRE_PAYMENT_ALLOWLIST` | boolean | `true` (prod) | Require approved payment recipients |

## Best Practices

### For Developers

1. **Always use `dev` profile for development** unless testing specific production behavior
2. **Never commit production credentials** to version control
3. **Test with `--profile=dev` first**, then with production settings only when necessary
4. **Use `.env` file for local overrides** that shouldn't be committed (add to `.gitignore`)

### For Operations

1. **Never disable safety features unnecessarily**
2. **Always enable allowlists in production** to restrict outbound effects
3. **Monitor logs for safety flag violations** (check `CLAWDBOT_SAFE_MODE` logs)
4. **Rotate credentials frequently** and use a secrets manager
5. **Test profile changes in staging** before applying to production

### For Security

1. **Never set `CLAWDBOT_SAFE_MODE=false` in dev** — if you need to test prod behavior, use a staging profile
2. **Encrypt production `.env` files** at rest using your secrets manager
3. **Audit allowlist changes** before applying to production
4. **Log all external sends** (messages, calls, payments) for compliance
5. **Require approval** for any changes to production profiles

## Troubleshooting

### Q: How do I test production behavior without risking side effects?

**A**: Create a staging profile with the same settings as `prod.env`, but point to staging endpoints:

```bash
cp config/profiles/prod.env config/profiles/staging.env
# Edit staging.env: CLAWDBOT_API_BASE_URL=https://staging-api.openclaw.ai
CLAWDBOT_PROFILE=staging node app.js
```

### Q: How do I allow external sends only for testing?

**A**: Override the profile setting:

```bash
CLAWDBOT_PROFILE=dev CLAWDBOT_ALLOW_EXTERNAL_SEND=true node app.js
```

### Q: How do I verify which profile is active?

**A**: Check the startup logs for `CLAWDBOT_ENV` and `CLAWDBOT_SAFE_MODE` values, or:

```bash
echo $CLAWDBOT_ENV
echo $CLAWDBOT_SAFE_MODE
```

### Q: Can I use profiles with Docker?

**A**: Yes! Pass the profile via environment variable:

```bash
docker run -e CLAWDBOT_PROFILE=prod my-openclaw-image
```

Or bind-mount a custom profile:

```bash
docker run -v /path/to/custom.env:/config/profiles/custom.env \
  -e CLAWDBOT_PROFILE=custom my-openclaw-image
```

## Maintenance

### Updating Profiles

If you add new environment variables to the application:

1. Add the variable to both `dev.env` and `prod.env` with appropriate defaults
2. Update this README with the variable in the reference table
3. Document safety implications (especially if it affects external effects)
4. Test both profiles in CI/CD

### Version Control

- **Commit**: `dev.env`, `prod.env`, `README.md`, custom staging/test profiles
- **Do NOT commit**: `.env.local`, credentials, API keys, or personal overrides
- **Add to `.gitignore`**: `config/profiles/*.local.env`, `config/profiles/.env`

## Related Documentation

- Issue RF-002: "Create a default dev profile that cannot touch prod secrets or real accounts"
- Application Configuration: See `src/config/` for TypeScript configuration handling
- Secrets Management: See docs on credential storage and rotation
- Deployment Guide: See ops documentation for production deployment procedures
