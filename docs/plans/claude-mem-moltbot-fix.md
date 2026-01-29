# Claude-Mem Moltbot Plugin Fix Plan

## Status Assessment

**Current State:**
- Plugin loads from: `/Users/alexnewman/clawd/plugins/claude-mem/index.ts`
- Observations: Working correctly (recorded via `tool_result_persist` hook)
- Prompts: Being recorded BUT with `[message_id: ...]` suffix appended
- MEMORY.md sync: Working (on `session_start`)
- Context injection: NOT implemented (only MEMORY.md file approach)

**Root Cause:**
Moltbot's messaging system adds `[message_id: UUID]` to prompts for WhatsApp/Discord reactions and replies (see `src/auto-reply/reply/body.ts:42`). This metadata is being passed through to claude-mem without stripping.

## Phase 1: Strip message_id from prompts

### Problem
Line 304 in `/Users/alexnewman/clawd/plugins/claude-mem/index.ts`:
```typescript
const result = await client.initSession(contentSessionId, event.prompt);
```
Sends the full prompt including `[message_id: UUID]`.

### Fix
Add a utility function to strip the message_id line before sending:

**Copy pattern from:** `src/gateway/chat-sanitize.ts:18-38`

```typescript
const MESSAGE_ID_LINE = /^\s*\[message_id:\s*[^\]]+\]\s*$/im;

function stripMessageIdFromPrompt(text: string): string {
  if (!text.includes("[message_id:")) return text;
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter((line) => !MESSAGE_ID_LINE.test(line));
  return filtered.join("\n").trim();
}
```

### Implementation
Update `before_agent_start` hook (around line 297-310):

```typescript
api.on("before_agent_start", async (event, ctx) => {
  if (!event.prompt || event.prompt.length < 10) return;
  if (!(await client.isHealthy())) return;

  const contentSessionId = getContentSessionId(ctx.sessionKey);

  // Strip [message_id: ...] metadata before recording
  const cleanPrompt = stripMessageIdFromPrompt(event.prompt);

  const result = await client.initSession(contentSessionId, cleanPrompt);
  if (result) {
    api.logger.debug?.(
      `claude-mem: session initialized (dbId: ${result.sessionDbId}, prompt#: ${result.promptNumber})`
    );
  }
});
```

### Verification
1. Run moltbot with a test message
2. Check `/api/prompts` endpoint - prompts should NOT contain `[message_id: ...]`
3. Check claude-mem UI - prompts should display cleanly

---

## Phase 2: (Optional) Add context injection via prependContext

The current plugin only syncs to `MEMORY.md` file. For real-time context injection (like the `extensions/memory-claudemem` approach), add:

```typescript
api.on("before_agent_start", async (event, ctx) => {
  // ... existing prompt recording code ...

  // Optional: inject recent context
  const observations = await client.getObservations(5);
  if (observations.length === 0) return;

  const memoryContext = observations
    .map((obs) => `- [#${obs.id}] ${obs.title || obs.type}: ${obs.narrative || obs.text?.slice(0, 100)}`)
    .join("\n");

  return {
    prependContext: `<claude-mem-context>\nRecent memories:\n${memoryContext}\n</claude-mem-context>`,
  };
});
```

**Note:** This is optional since MEMORY.md file approach is already working.

---

## Files to Modify

| File | Change |
|------|--------|
| `/Users/alexnewman/clawd/plugins/claude-mem/index.ts` | Add `stripMessageIdFromPrompt()` utility, update `before_agent_start` hook |

---

## Verification Checklist

- [ ] Prompts recorded without `[message_id: ...]` suffix
- [ ] Prompts display cleanly in claude-mem UI at localhost:37777
- [ ] Observations still being recorded correctly
- [ ] MEMORY.md still syncing on session_start
- [ ] No regressions in existing functionality
