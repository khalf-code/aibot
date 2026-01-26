---
name: Z.AI Comorbidity Fix
overview: "The Z.AI 404 error stems from a single root cause: an agent-specific models.json file that overrides the correctly-configured built-in zai provider. The fix is to delete this override file."
todos:
  - id: delete-override
    content: Delete /home/liam/.clawdbot/agents/main/agent/models.json (the root cause override file)
    status: pending
  - id: restart-verify
    content: Restart gateway and verify zai/glm-4.7 uses built-in provider
    status: pending
isProject: false
---

# Z.AI Configuration Comorbidity Analysis

## Root Cause

The built-in `pi-ai` library already has the correct Z.AI configuration:

```javascript
// From node_modules/@mariozechner/pi-ai/dist/models.generated.js
"glm-4.7": {
    id: "glm-4.7",
    api: "openai-completions",      // Correct - uses /chat/completions
    provider: "zai",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",  // Correct endpoint
    ...
}
```

**The problem**: `/home/liam/.clawdbot/agents/main/agent/models.json` was created (did NOT exist at initial commit 31518fd) and contains a custom `zai` provider that OVERRIDES the built-in one.

## Comorbidity Chain

```mermaid
flowchart TD
    A[Initial Working State] --> B[No agent models.json]
    B --> C[Built-in zai provider used]
    C --> D[Correct URL construction]
    
    E[Agent models.json Created] --> F[Custom zai provider defined]
    F --> G[Overrides built-in provider]
    G --> H[URL construction differs]
    H --> I[HTTP 404 Error]
    
    J[Multiple fix attempts] --> K[Changed api type]
    J --> L[Changed baseUrl format]
    J --> M[Changed model ID casing]
    K --> I
    L --> I
    M --> I
```

## Related Issues (Checked)

| Component | Status | Issue |
|-----------|--------|-------|
| [.clawdbot/clawdbot.json](.clawdbot/clawdbot.json) | OK | Has correct `env.ZAI_API_KEY` and `zai/glm-4.7` references |
| [.clawdbot/cron/jobs.json](.clawdbot/cron/jobs.json) | OK | Uses `zai/glm-4.7` (lowercase) |
| [.clawdbot/agents/main/agent/models.json](.clawdbot/agents/main/agent/models.json) | **PROBLEM** | Overrides built-in zai provider |
| Built-in pi-ai library | OK | Has correct `glm-4.7` with `openai-completions` API |
| ZAI_API_KEY value | OK | Present and valid (curl test succeeded) |

## The Fix

**Delete the override file**: [.clawdbot/agents/main/agent/models.json](.clawdbot/agents/main/agent/models.json)

This file did not exist in the working state (commit 31518fd). Deleting it will:
1. Remove the custom zai provider override
2. Let clawdbot use the built-in zai provider from pi-ai
3. Use the correct `openai-completions` API type and URL construction

The ollama provider config in this file is redundant - it's already defined in the main [clawdbot.json](.clawdbot/clawdbot.json).

## Verification Steps

After deleting the file:
1. Restart gateway: `systemctl --user restart clawdbot-gateway.service`
2. Verify model discovery: `clawdbot models list | grep zai`
3. Test message to Liam
