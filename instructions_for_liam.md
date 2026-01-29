# Systems Diagnostic Process - Repeatable Instructions for Liam

**Created**: 2026-01-29  
**Purpose**: Document the full process for diagnosing and fixing Telegram stalling, Discord context overflow, and related infrastructure issues  
**APEX 6.2 Compliant**: Yes

---

## Overview

When you encounter issues like:
- Telegram messages stalling/not processing
- Discord "context overflow" errors
- Sessions accumulating without cleanup
- Gateway instability

Follow this systematic diagnostic process using APEX 6.2 bug-comorbidity protocol.

---

## Phase 1: Symptom Collection (5 min)

### What to Document

1. **Specific error messages** - Exact text from logs/UI
2. **When it happens** - Timing, frequency, patterns
3. **Affected channels** - Telegram, Discord, both, other?
4. **Dashboard state** - Screenshot of active sessions, connection counts
5. **Recent changes** - New configs, code changes, updates?

### Commands to Run

```bash
# Check gateway health
moltbot status

# Check active sessions
moltbot sessions --json | jq 'length'

# Check recent logs
moltbot logs --tail 100

# Check system resources
ps aux | grep moltbot
free -h
df -h ~/.clawdbot
```

---

## Phase 2: Parallel Investigation (15 min)

### Use Cursor Task Tool for Parallel Exploration

Launch 3 explore agents simultaneously to investigate different areas:

```
Agent 1: Investigate [Telegram/Discord] [stalling/overflow] issues
- Search for message handling code
- Look for recent changes
- Find potential blocking operations
- Identify error handling patterns

Agent 2: Review gateway and routing infrastructure
- Message queue handling
- Memory leak patterns
- Connection pool management
- Rate limiting

Agent 3: Search for error patterns in codebase
- Grep for "context overflow", "stalling", "timeout", "deadlock"
- Find relevant error handling code
- Trace error flow from detection to user
```

---

## Phase 3: Bug Comorbidity Analysis (10 min)

### Load APEX Bug-Comorbidity Skill

```bash
# Read the bug-comorbidity skill
cat ~/clawd/apex-vault/apex/skills/bug-comorbidity/COMPACT.md
```

### Apply Comorbidity Protocol

| Step | Action |
|------|--------|
| 1. PAUSE | Don't fix immediately — analyze first |
| 2. CLASSIFY | What type? (null, security, race, memory, boundary, etc.) |
| 3. IDENTIFY | What bugs travel with this type? |
| 4. SEARCH | Look for those patterns in similar code |
| 5. TRIAGE | Critical=fix now, Medium=ask, Low=todo |
| 6. ITERATE | Repeat until no new Critical/High found |
| 7. DOCUMENT | Show reasoning chain |

### Common Clusters to Check

| If You Find | Also Check For |
|-------------|----------------|
| Promise chaining blocking | Missing timeouts, unbounded buffers |
| Context overflow | History accumulation, fallback not triggering |
| Memory leaks | Map/Set never cleared, unbounded queues |
| No connection limits | No circuit breaker, cascading failures |

---

## Phase 4: Root Cause Verification (10 min)

### For Each Bug Found

1. **Read the source code** - Always read before editing
2. **Trace the data flow** - From input to error
3. **Identify the exact line** - Where does it break?
4. **Check for siblings** - Are there 3+ similar patterns?
5. **Verify impact** - What breaks if we fix this?

### Example: Promise Chain Blocking

```typescript
// BROKEN PATTERN (found in 4 locations)
textFragmentProcessing = textFragmentProcessing
  .then(async () => { await flush(); })
  .catch(() => undefined);
await textFragmentProcessing;  // ⚠️ Waits for ENTIRE chain

// FIX PATTERN
void safeFlushWithTimeout({
  operationId: key,
  timeoutMs: 30000,
  operation: () => flush(),
});
```

---

## Phase 5: Create APEX-Compliant Plan (20 min)

### Plan Structure

```markdown
# [Problem] Diagnostic & Remediation Plan

## Executive Summary
- X critical issues
- Y high-severity infrastructure issues
- Root causes identified via bug-comorbidity analysis

## Comorbidity Analysis
- Original bug
- Category
- Searched patterns
- Findings table with severity/action

## Critical Issues (Priority Order)
### Issue 1: [Name]
- Root Cause
- Problem Pattern (code snippet)
- Impact
- Solution (bullet points)

## Implementation Order
### Phase 0: CRITICAL (Immediate)
### Phase 1: HIGH (Today)
### Phase 2: MEDIUM (Next)

## Testing Strategy
- Regression tests
- Load tests
- Integration tests

## Success Criteria
- User-visible improvements
- Technical metrics

## Rollback Plan
- Non-breaking changes only
- Safe defaults
- Independent phases
```

### Use CreatePlan Tool

- Include 10-20 specific, actionable todos
- Mark critical items as CRITICAL/HIGH in content
- Group todos by phase
- Add success criteria for each phase

---

## Phase 6: Verification Before Execution (5 min)

### APEX 6.2 Quality Gates

Before starting execution, verify plan includes:

| Gate | Check |
|------|-------|
| Read-First | All files identified to read? |
| Architecture-First | Data flow mapped? |
| Regression Guard | Tests identified? |
| Single Source | No duplicate state? |
| Non-Destructive | Rollback plan included? |
| File Minimalism | Edit existing, don't create new? |

---

## Phase 7: Execution (Implementation)

### For Each Phase

```bash
# 1. Mark todo as in_progress
# 2. Read relevant files
# 3. Make minimal, surgical changes
# 4. Check linter errors
# 5. Run affected tests
# 6. Mark todo as completed
# 7. Move to next todo
```

### APEX Rules During Execution

- **Never break working code**
- **Never reintroduce fixed bugs**
- **Read before editing** (always)
- **Test before AND after** changes
- **Build/lint/types must pass** before marking complete
- **Max 3 attempts** - after 3 failures, STOP and ask

### Type Error Fixes

When you hit type errors during build:

```bash
# 1. Read the error carefully
pnpm build 2>&1 | grep "error TS"

# 2. Check function signatures
rg "export.*function functionName" --type ts -A 5

# 3. Fix imports/types
# 4. Rebuild
pnpm build

# 5. If still failing after 3 attempts, STOP and investigate
```

---

## Phase 8: Test Verification (30 min)

### Run Test Suite

```bash
# 1. Build first
pnpm build

# 2. Run affected tests
pnpm test path/to/test.ts

# 3. Run full test suite
pnpm test

# 4. Check coverage
pnpm test:coverage
```

### Expected Failures vs Regressions

**Expected**: Tests checking old behavior (e.g., error payload returns) will fail if you changed behavior (e.g., now throws). Update these tests to match new behavior.

**Regressions**: Tests that were passing and are unrelated to your changes now fail. STOP and investigate.

### Fixing Expected Test Failures

```typescript
// OLD TEST (expects error payload)
expect(result.meta.error?.kind).toBe("context_overflow");

// NEW TEST (expects throw)
await expect(fn()).rejects.toThrow("context overflow");
```

---

## Phase 9: Create Liam Instructions (10 min)

### Document for Future Liam

Create a markdown file with:

1. **What was wrong** - Root causes found
2. **How we found it** - Investigation steps
3. **What we fixed** - Specific changes made
4. **How to verify** - Tests to run
5. **How to repeat** - This process document

Save as: `~/instructions_for_liam.md` or `~/clawd/diagnostics/YYYY-MM-DD-issue-name.md`

---

## Common Pitfalls to Avoid

| Pitfall | Why Bad | Instead |
|---------|---------|---------|
| Fix symptoms, not root cause | Issue returns later | Use comorbidity analysis |
| Edit without reading | Wrong assumptions | Always read first |
| Skip tests | Regressions slip through | Test before+after |
| Create new files | Codebase bloat | Edit existing files |
| Assume working code | Context rot | Re-read current state |
| Rush through phases | Miss clustered bugs | Follow protocol |

---

## Emergency Rollback

If changes cause critical failures:

```bash
# 1. Identify the problematic commit
git log --oneline -10

# 2. Revert the specific commit (not entire branch)
git revert <commit-hash>

# 3. Or revert specific file changes
git checkout HEAD~1 -- path/to/file.ts

# 4. Rebuild and test
pnpm build && pnpm test

# 5. Push fix
git push
```

---

## Success Verification Checklist

After completing all fixes, verify:

- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Linter passes (`pnpm lint`)
- [ ] Gateway starts without errors
- [ ] Telegram processes 100+ rapid messages without stalling
- [ ] Discord handles long threads without overflow
- [ ] Session count stays < 20 after 24 hours
- [ ] Memory growth = 0 after 7 days
- [ ] No connection/queue exhaustion under load

---

## Key Files Reference

### Telegram Stalling
- `src/telegram/bot-handlers.ts` - Message handling, buffer processing
- `src/telegram/monitor.ts` - Polling and retry logic

### Discord Context Overflow
- `src/discord/monitor/message-handler.process.ts` - History inclusion
- `src/discord/monitor/provider.ts` - History limit configuration
- `src/agents/pi-embedded-helpers/errors.ts` - Error classification

### Fallback Mechanism
- `src/agents/model-fallback.ts` - Fallback loop
- `src/agents/failover-error.ts` - FailoverError type
- `src/agents/pi-embedded-runner/run.ts` - Context overflow handling
- `src/auto-reply/reply/agent-runner-execution.ts` - Session reset logic

### Infrastructure
- `src/process/command-queue.ts` - Lane queues and limits
- `src/infra/system-events.ts` - System event queues
- `src/gateway/server/ws-connection.ts` - WebSocket connections
- `src/infra/circuit-breaker.ts` - Circuit breaker utility

### Sessions
- `src/config/sessions/gc.ts` - Session garbage collection
- `src/config/sessions/store.ts` - Session store management
- `src/config/sessions/types.ts` - Session entry schema

---

## Metrics to Monitor Post-Fix

| Metric | What It Means | Alert Threshold |
|--------|---------------|-----------------|
| `telegram.buffer.flush.duration` | How long buffer flushes take | p99 > 5s |
| `telegram.buffer.flush.timeout` | Count of timeout events | > 0 per hour |
| `discord.history.tokens` | Token usage by history | > 4000 |
| `session.total_count` | Total sessions across agents | > 50 |
| `session.gc.deleted` | Sessions cleaned per run | Expected > 0 daily |
| `command_queue.size` | Queue depth per lane | > 100 |
| `gateway.connections.active` | Active WebSocket connections | > 900 |
| `circuit_breaker.opens` | Circuit opens (service failures) | > 1 per day |

---

## When to Use This Process

✅ **Use this process when**:
- Multiple symptoms appear together
- Issues are intermittent or timing-dependent
- Simple fixes don't work
- Need to understand full system impact

❌ **Don't use for**:
- Single, obvious bugs with clear fix
- Syntax errors or typos
- Configuration mistakes
- Simple feature additions

---

## Tools Required

- **Cursor**: For running explore agents, reading code
- **APEX 6.2 Rules**: Must be loaded (`~/.cursor/rules/apex-v6.mdc`)
- **Bug-Comorbidity Skill**: `~/clawd/apex-vault/apex/skills/bug-comorbidity/COMPACT.md`
- **Terminal access**: For running tests, checking logs
- **Git**: For commits, reverts, history

---

## Estimated Time

| Phase | Duration |
|-------|----------|
| Symptom Collection | 5 min |
| Parallel Investigation | 15 min |
| Comorbidity Analysis | 10 min |
| Root Cause Verification | 10 min |
| Create Plan | 20 min |
| Verification | 5 min |
| Execution | 2-4 hours (depends on complexity) |
| Test Verification | 30 min |
| Documentation | 10 min |
| **TOTAL** | 3-5 hours for complex multi-bug clusters |

---

## Real Example: 2026-01-29 Telegram/Discord Issues

### Symptoms
- Telegram stalling on messages
- Discord context overflow errors
- Fallbacks not triggering
- 22 sessions accumulated

### Bugs Found (Comorbidity)
1. **Telegram**: Promise chain blocking (4 locations)
2. **Telegram**: No buffer timeout guards
3. **Discord**: Unbounded history inclusion (20 messages default)
4. **Discord**: No token budget management
5. **Fallback**: `classifyFailoverReason()` ignores context overflow (Bug 1 of 3)
6. **Fallback**: Error payload returned instead of thrown (Bug 2 of 3)
7. **Fallback**: Session reset intercepts before fallback (Bug 3 of 3)
8. **Sessions**: No garbage collection (indefinite accumulation)
9. **Infrastructure**: Unbounded queue growth
10. **Infrastructure**: Lane state Map never cleared
11. **Infrastructure**: System events Map never cleared
12. **Infrastructure**: No connection limits
13. **Infrastructure**: No circuit breaker

### Fixes Applied
- 13 bugs fixed across 15 files
- 0 new files created (except circuit-breaker.ts, session GC)
- 0 regressions introduced
- All tests passing

### Time Taken
- Investigation: 30 min
- Planning: 20 min
- Implementation: 2.5 hours
- Testing: 30 min
- **Total**: ~4 hours

---

## Notes for Future Liam

1. **Always use bug-comorbidity**: When you find 1 bug, search for its siblings
2. **Trust your past self**: If we fixed it before, don't reintroduce it
3. **Read code, don't guess**: Verify assumptions by reading source
4. **Test everything**: Before+after, regressions matter
5. **Document your work**: Future Liam will thank you
6. **Follow APEX 6.2**: The rules exist for a reason - they prevent pain

---

## When to Ask for Help

Stop and escalate if:
- Stuck after 3 attempts on same issue
- Found > 20 related bugs (too large for one session)
- Fix requires breaking changes (need user approval)
- Tests fail in unexpected ways after fixes
- System behavior changes in unpredictable ways

---

## Post-Fix Verification (Required)

After implementation, verify:

```bash
# 1. Build succeeds
pnpm build

# 2. Lint passes
pnpm lint

# 3. Tests pass
pnpm test

# 4. Gateway starts
moltbot gateway run --bind loopback --port 18789 &
sleep 5
moltbot health

# 5. Send test messages on each channel
# 6. Monitor for 24 hours
# 7. Check metrics dashboard

# 8. Verify session cleanup runs
# Wait 1 hour, then check logs for:
# [session-gc] completed: N sessions deleted
```

---

## Appendix: File Patterns

### Where to Look for Common Issues

| Issue Type | File Patterns |
|------------|---------------|
| Message handling | `src/{channel}/monitor/*.ts`, `src/{channel}/bot-handlers.ts` |
| Error handling | `src/agents/pi-embedded-helpers/errors.ts`, `src/agents/failover-error.ts` |
| Session management | `src/config/sessions/*.ts`, `src/auto-reply/reply/session.ts` |
| Queue/buffer issues | `src/process/command-queue.ts`, `src/{channel}/bot-handlers.ts` |
| Memory leaks | Any file with `Map` or `Set` that never calls `.delete()` or `.clear()` |
| Connection issues | `src/gateway/server/ws-connection.ts`, `src/infra/rate-limit.ts` |
| Retry/fallback | `src/infra/retry.ts`, `src/agents/model-fallback.ts` |

---

## Quick Reference Commands

```bash
# Read APEX rules
cat ~/.cursor/rules/apex-v6.mdc

# Load bug-comorbidity skill
cat ~/clawd/apex-vault/apex/skills/bug-comorbidity/COMPACT.md

# Search for error patterns
rg "context overflow|stalling|timeout" --type ts

# Find similar code patterns
rg "promise chaining pattern" --type ts -A 5

# Check test coverage
pnpm test:coverage

# Run specific test
pnpm test path/to/test.ts

# Check for memory leaks
rg "new Map|new Set" --type ts -A 10 | rg -v "delete|clear"

# Find unbounded queues
rg "\.push\(|\.shift\(" --type ts -A 5 | rg -v "MAX_|limit|size"

# Check for missing timeouts
rg "setTimeout|setInterval" --type ts -A 5 | rg -v "clearTimeout|clearInterval|unref"
```

---

**END OF INSTRUCTIONS**

Next time you encounter similar issues, start here at Phase 1 and work through systematically.
