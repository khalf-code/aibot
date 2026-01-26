---
name: Liam Full Remediation
overview: "Consolidated plan covering: (1) Telegram setup to replace Slack, (2) Voice call capabilities, (3) SMS options clarification, (4) All original audit remediation items (Z.AI fix, STATUS.md update, Calendar API, upstream sync)."
todos:
  - id: telegram-setup
    content: "Set up Telegram channel: create bot with BotFather, configure clawdbot.json, pair account"
    status: pending
  - id: fix-zai-endpoint
    content: "Fix Z.AI search skill: change open.z.ai to api.z.ai, update model to glm-4.7"
    status: pending
  - id: update-status-md
    content: Update STATUS.md to reflect actual system state (Browser/Calendar/Blogwatcher all broken)
    status: pending
  - id: enable-calendar-api
    content: Enable Google Calendar API in project 1091316374889
    status: pending
  - id: add-upstream-remote
    content: Add upstream git remote and review v2026.1.24 changes
    status: pending
  - id: install-clawdhub
    content: Install clawdhub CLI globally
    status: pending
  - id: voice-call-setup
    content: (Optional) Set up voice-call plugin with Twilio/Telnyx
    status: pending
isProject: false
---

# Liam Full Remediation Plan

## BLUF (Bottom Line Up Front)

This plan consolidates all pending work:

- **Communication:** Set up Telegram (replaces Slack), clarify voice/SMS options
- **Bug Fixes:** Fix Z.AI search endpoint, update stale STATUS.md
- **Capabilities:** Enable Calendar API
- **Maintenance:** Add upstream remote, install clawdhub CLI

---

## Part 1: Communication Channels

### 1.1 Telegram Setup (RECOMMENDED - Replaces Slack)

**Why Telegram over Slack:**

- Surpasses Slack features (voice notes, inline buttons, draft streaming)
- 5-minute setup vs Slack's complexity
- No phone number required
- See Liam typing in real-time

**Step-by-step instructions:**

**Step 1: Create Telegram Bot**

1. Open Telegram app (phone or desktop)
2. Search for `@BotFather` and start a chat
3. Send `/newbot`
4. Choose a name (e.g., "Liam Assistant")
5. Choose a username (must end in `bot`, e.g., `liam_puenteworks_bot`)
6. Copy the token BotFather gives you (format: `123456789:ABCdefGHI...`)

**Step 2: Configure Clawdbot**

Add to `~/.clawdbot/clawdbot.json`:

```json5
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_TOKEN_HERE",
      "dmPolicy": "pairing"
    }
  }
}
```

**Step 3: Restart Gateway**

```bash
clawdbot daemon restart
```

**Step 4: Pair Your Account**

1. Open Telegram and message your new bot
2. It will reply with a pairing code
3. Approve: `clawdbot pairing approve telegram <CODE>`

**Step 5: Test**

- Send a message to your bot
- Liam should respond

### 1.2 Voice Calls (AVAILABLE)

Liam CAN make and receive voice calls with the voice-call plugin.

**What's possible:**

- Liam calls you with urgent alerts (outbound)
- You call Liam for hands-free queries (inbound)
- Full voice conversation with AI responses

**Requirements:**

- Phone number from Twilio/Telnyx/Plivo (~$1-2/month)
- Public webhook URL (ngrok or Tailscale funnel)
- Plugin: `clawdbot plugins install @clawdbot/voice-call`

**Basic config:**

```json5
{
  "plugins": {
    "entries": {
      "voice-call": {
        "enabled": true,
        "config": {
          "provider": "twilio",
          "fromNumber": "+1XXXXXXXXXX",
          "twilio": {
            "accountSid": "ACxxxxxxxx",
            "authToken": "..."
          },
          "tunnel": { "provider": "ngrok" }
        }
      }
    }
  }
}
```

### 1.3 SMS Options (LIMITED)

| Option | Viable? | Notes |

|--------|---------|-------|

| Google Voice | NO | No public API |

| Virtual Android | NO | Emulators can't send real SMS |

| Android Phone Node | YES | Requires physical phone |

| Twilio SMS | NOT YET | Requires plugin development |

**Recommendation:** If SMS is critical, either:

1. Pair a spare Android phone as a Clawdbot node
2. Add "Twilio SMS plugin" to EVOLUTION-QUEUE.md as feature request

---

## Part 2: Bug Fixes (From Original Audit)

### 2.1 Fix Z.AI Search Endpoint

**File:** `/home/liam/clawdbot/skills/zai-search/search.sh`

**Change:**

```bash
# FROM (broken):
curl -s -X POST "https://open.z.ai/api/paas/v4/chat/completions"

# TO (working):
curl -s -X POST "https://api.z.ai/api/coding/paas/v4/chat/completions"
```

Also update the model from `glm-4-flash` to `glm-4.7`.

### 2.2 Update STATUS.md

Current STATUS.md has false claims. Update to reflect reality:

| Component | Current Claim | Actual State | Fix |

|-----------|---------------|--------------|-----|

| Browser | OK | NOT AVAILABLE | Update to "NOT AVAILABLE (no browser in WSL2)" |

| Calendar | OK | BLOCKED | Update to "BLOCKED (API not enabled)" |

| Blogwatcher | OK | BLOCKED | Update to "BLOCKED (Go not installed)" |

---

## Part 3: Enable Capabilities

### 3.1 Enable Google Calendar API

**Steps:**

1. Go to: `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1091316374889`
2. Click "Enable API"
3. Test: `gog calendar upcoming`

---

## Part 3: Maintenance

### 3.2 Add Upstream Git Remote

```bash
cd /home/liam/clawdbot
git remote add upstream https://github.com/clawdbot/clawdbot.git
git fetch upstream
git log --oneline upstream/main -10
```

Latest upstream: v2026.1.24 (Jan 25, 2026)

### 3.3 Install ClawdHub CLI

```bash
npm i -g clawdhub
```

Note: Hub is currently empty ("No skills yet"), but CLI is useful for future.

---

## Execution Order

| Priority | Task | Time |

|----------|------|------|

| 1 | Set up Telegram | 10 min |

| 2 | Fix Z.AI search endpoint | 2 min |

| 3 | Update STATUS.md | 5 min |

| 4 | Enable Calendar API | 5 min |

| 5 | Add upstream remote | 2 min |

| 6 | Install clawdhub CLI | 1 min |

| 7 | (Optional) Set up voice calls | 30 min |

---

## What You Need to Provide

Before execution, please confirm:

1. **Telegram:** Will you create the bot via BotFather, or should I provide more detailed instructions?
2. **Calendar API:** Do you have access to enable APIs in Google Cloud Console project 1091316374889?
3. **Voice calls:** Do you want to set this up now, or defer?