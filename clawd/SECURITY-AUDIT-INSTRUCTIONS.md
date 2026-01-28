# Security Audit Instructions (APEX 6.2)

This document provides step-by-step instructions for conducting a comprehensive security audit of the Moltbot codebase following APEX 6.2 protocols.

## Prerequisites

Before starting, load these APEX skills:
- `/home/liam/clawd/apex-vault/apex/skills/security-guard/COMPACT.md`
- `/home/liam/clawd/apex-vault/apex/skills/bug-comorbidity/COMPACT.md`
- `/home/liam/clawd/apex-vault/apex/skills/code-review/COMPACT.md`
- `/home/liam/clawd/apex-vault/apex/skills/project-audit/COMPACT.md`

## Audit Categories (Weighted)

| Category | Weight | Key Checks |
|----------|--------|------------|
| Security | 25% | OWASP, secrets, input validation |
| Code Patterns | 20% | Error handling, null safety |
| Testing | 20% | Coverage, quality |
| Architecture | 15% | Structure, separation |
| Dependencies | 10% | Outdated, vulnerabilities |
| Documentation | 5% | README, API docs |
| APEX Adoption | 5% | Which skills followed |

## Step 1: Hardcoded Secrets Scan

Search for credentials, API keys, tokens, and passwords in source code.

### Patterns to Search

```bash
# API keys and tokens
rg -i "(api_key|apikey|api-key|secret|password|token|private_key|credentials)\s*[=:]\s*['\"][^'\"]+['\"]" src/ extensions/ apps/

# Bearer tokens
rg "Bearer\s+[A-Za-z0-9._-]{20,}" src/ extensions/

# Known API key formats
rg "sk-[A-Za-z0-9]{20,}" src/ extensions/  # OpenAI
rg "ghp_[A-Za-z0-9]{36}" src/ extensions/  # GitHub
rg "AKIA[A-Z0-9]{16}" src/ extensions/     # AWS

# Base64 encoded secrets
rg "Buffer\.from\(['\"][A-Za-z0-9+/=]{20,}['\"],\s*['\"]base64['\"]" src/ extensions/

# .env files (should not be committed)
find . -name ".env" -not -path "./node_modules/*" -type f
```

### Exclusions (Expected)
- Test files (`*.test.ts`) with mock tokens
- `.env.example` templates
- Placeholder values like `"n/a"` or `"test-token"`

## Step 2: Injection Vulnerabilities

### Command Injection

```bash
# exec/spawn with potential user input
rg "(exec|execSync|spawn|spawnSync)\s*\(" src/ extensions/ --type ts

# Check each finding for:
# - Is the command string user-controlled?
# - Is input sanitized before execution?
# - Can shell metacharacters (;|&&$()) reach the shell?
```

### SQL Injection

```bash
# Raw SQL queries
rg "\.query\s*\(" src/ --type ts
rg "\.exec\s*\(" src/ --type ts | grep -i sql

# Check for parameterized queries (SAFE):
# .prepare() with ? placeholders
# Template literals should NOT contain user input
```

### Eval Injection

```bash
rg "eval\s*\(" src/ extensions/ --type ts
rg "new\s+Function\s*\(" src/ extensions/ --type ts
rg "setTimeout\s*\([^,]+," src/ --type ts  # Check if first arg is string
```

## Step 3: Authentication & Authorization

### Find Auth Mechanisms

```bash
# Auth-related files
rg -l "auth|login|session|permission|role" src/ --type ts

# Timing-safe comparisons (SAFE)
rg "timingSafeEqual" src/ extensions/ --type ts

# Unsafe string comparisons for secrets
rg "===.*token|token.*===" src/ extensions/ --type ts
rg "===.*secret|secret.*===" src/ extensions/ --type ts
```

### Check for Missing Auth

```bash
# HTTP handlers - verify each has auth check
rg "app\.(get|post|put|delete|patch)\s*\(" src/ --type ts
rg "router\.(get|post|put|delete|patch)\s*\(" src/ --type ts

# WebSocket handlers
rg "\.on\s*\(['\"]message" src/ --type ts
```

## Step 4: Input Validation & XSS

### XSS Patterns

```bash
# Dangerous DOM manipulation
rg "innerHTML\s*=" src/ ui/ --type ts
rg "dangerouslySetInnerHTML" src/ ui/ --type ts
rg "document\.write\s*\(" src/ ui/ --type ts

# URL parameters without validation
rg "URLSearchParams|\.get\s*\(" ui/ --type ts
```

### Input Validation

```bash
# File operations with user paths
rg "fs\.(readFile|writeFile|unlink|rmdir)" src/ --type ts
rg "path\.join\s*\(" src/ --type ts  # Check if user input reaches this

# Check for path traversal prevention
rg "\.\./" src/ --type ts  # Look for explicit checks
rg "openFileWithinRoot" src/ --type ts  # SAFE pattern
```

## Step 5: Path Traversal

```bash
# File path construction
rg "path\.(join|resolve)\s*\(" src/ --type ts -A 2

# Check each for:
# - Does user input reach this path construction?
# - Is there validation for ".." sequences?
# - Is there a root directory restriction?

# Safe pattern to look for:
rg "openFileWithinRoot|fs-safe" src/ --type ts
```

## Step 6: Cryptography

```bash
# Weak hash algorithms
rg "createHash\s*\(['\"]md5['\"]" src/ --type ts
rg "createHash\s*\(['\"]sha1['\"]" src/ --type ts  # OK for non-security use

# Insecure random
rg "Math\.random\s*\(" src/ --type ts  # Verify not used for security

# TLS issues
rg "rejectUnauthorized\s*[=:]\s*false" src/ --type ts
```

## Step 7: Error Handling & Info Disclosure

```bash
# Stack trace exposure
rg "\.stack" src/ --type ts | grep -v test

# Full error object logging
rg "console\.(log|error)\s*\([^)]*err\s*\)" src/ extensions/ --type ts

# Debug endpoints
rg "debug|/debug" src/ --type ts
```

## Step 8: Dependencies

```bash
# Check for known vulnerable packages
pnpm audit

# Manual check for problematic packages
cat package.json | jq '.dependencies' | grep -E "(lodash|axios|serialize-javascript|minimist|node-forge|vm2)"
```

## Step 9: Recent Changes Review

```bash
# List recent commits
git log --oneline -30 --since="30 days ago"

# Files changed recently
git diff --name-only HEAD~30

# Focus security review on:
# - Auth changes
# - Session handling
# - Webhook endpoints
# - New API endpoints
```

## Severity Classification

| Severity | Criteria | Action |
|----------|----------|--------|
| CRITICAL | RCE, auth bypass, credential exposure | Fix immediately |
| HIGH | Significant security impact, data exposure | Fix this sprint |
| MEDIUM | Limited impact, defense-in-depth | Fix next sprint |
| LOW | Minor issues, hardening | Track in backlog |

## Grading

| Grade | Criteria |
|-------|----------|
| A | 0 critical, ≤2 high |
| B | 0 critical, ≤5 high |
| C | ≤2 critical, multiple high |
| D | 3+ critical |
| F | Active security vulnerabilities |

## Report Template

```markdown
# APEX Security Audit: [Project]

## Executive Summary
| Grade | CRITICAL | HIGH | MEDIUM | LOW |
|-------|----------|------|--------|-----|
| [X]   | [n]      | [n]  | [n]    | [n] |

## CRITICAL Findings
### 1. [Issue Name]
**Location:** `path/to/file.ts:line`
**Issue:** Description
**Fix:** Remediation steps

## HIGH Severity Findings
...

## MEDIUM Severity Findings
1. **[Issue]** - `location` - Description
...

## LOW Severity Findings
...

## Positive Findings
- Safe patterns found
...

## Remediation Priority
### Phase 1: Critical (Immediate)
### Phase 2: High (This Sprint)
### Phase 3: Medium (Next Sprint)

## Files Requiring Attention
1. `file.ts` - Issue
...
```

## Comorbidity Protocol

When you find a bug, search for related issues:

| If You Find | Also Check For |
|-------------|----------------|
| Hardcoded secrets | Debug endpoints, verbose errors, log exposure |
| Command injection | Path traversal, SQL injection, eval |
| Missing auth | Authorization bypass, session issues |
| Path traversal | File upload issues, symlink attacks |
| Timing attacks | Other comparison vulnerabilities |
| Null/undefined | Missing validation, async timing |

## Automation

Run the built-in security audit:
```bash
moltbot security audit --deep
```

Run detect-secrets:
```bash
pip install detect-secrets==1.5.0
detect-secrets scan --baseline .secrets.baseline
```

---

*Last updated: 2026-01-28*
*APEX Version: 6.2*
