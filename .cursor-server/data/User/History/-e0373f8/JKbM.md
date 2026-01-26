---
name: Liam Communication Channels
overview: Comprehensive analysis of SMS capabilities for Liam and evaluation of all Slack alternatives, with detailed pros/cons and setup requirements for each channel option.
todos:
  - id: choose-channel
    content: Choose primary communication channel (Telegram recommended)
    status: pending
  - id: configure-telegram
    content: Configure Telegram bot if selected - get token from @BotFather
    status: pending
  - id: evaluate-sms
    content: "Decide SMS approach: Android node or request Twilio SMS enhancement"
    status: pending
  - id: test-channel
    content: Test bidirectional communication on new channel
    status: pending
  - id: update-cron
    content: Update cron jobs and heartbeat to use new channel
    status: pending
  - id: update-status
    content: Update STATUS.md with new channel configuration
    status: pending
isProject: false
---

# Liam Communication Channels - APEX v4.4.1 Compliant Plan

## BLUF (Bottom Line Up Front)

**SMS Options Available:**

1. **Android Node SMS** - Requires Android phone with SMS permission
2. **iMessage SMS** - Requires macOS with Messages app (not applicable to WSL2)
3. **Twilio SMS** - NOT currently supported (voice-call plugin is voice-only)

**Recommended Slack Alternatives (ranked by ease + utility):**

1. **Telegram** - Easiest setup, most flexible, no phone number needed
2. **WhatsApp** - Popular but requires dedicated phone number
3. **Signal** - Privacy-focused, requires signal-cli daemon

---

## Section 1: SMS Capability Analysis

### 1.1 Current State

Liam runs on WSL2 (Linux). This limits SMS options:

| SMS Method | Platform | Available to Liam? | Notes |

|------------|----------|-------------------|-------|

| Android Node | Android device | YES (if you have one) | Requires Android phone paired as node |

| iMessage SMS | macOS only | NO | WSL2 is Linux, not macOS |

| Twilio SMS | Any | NOT IMPLEMENTED | voice-call plugin is voice-only |

### 1.2 Option A: Android Node SMS (Viable)

**How it works:**

- Pair an Android phone as a Clawdbot node
- Phone sends/receives SMS on Liam's behalf
- Commands route through gateway to phone

**Setup Requirements:**

1. Android phone with Clawdbot app installed
2. SMS permission granted in app
3. Phone must have cellular/telephony capability (not Wi-Fi only tablet)
4. Phone paired to gateway via Bonjour/mDNS

**Configuration:**

```json5
// No config needed - capability auto-advertised when phone is paired
// Use via CLI:
// clawdbot nodes invoke --node <phone> --command sms.send --params '{"to":"+15555550123","message":"Hello"}'
```

**Pros:**

- Uses your existing phone number
- Bidirectional (can receive SMS replies)
- No monthly cost beyond your phone plan

**Cons:**

- Requires dedicated Android phone
- Phone must stay powered and connected
- SMS rate limits apply

### 1.3 Option B: Twilio SMS (Not Currently Available)

The voice-call plugin (`@clawdbot/voice-call`) supports Twilio for **voice calls only**.

**Current Plugin Capabilities:**

- Twilio Programmable Voice + Media Streams
- Telnyx Call Control v2
- Plivo Voice API

**SMS is NOT implemented** in the current plugin. This would require:

- New plugin development or
- Plugin extension to add SMS endpoints

**If SMS were added, it would provide:**

- Dedicated phone number (Twilio number)
- No personal phone required
- Scalable (multiple numbers possible)
- Cost: ~$1/month/number + $0.0075/SMS

### 1.4 Option C: iMessage SMS (Not Available for WSL2)

iMessage channel can send SMS when configured with `service: "sms"`, but requires:

- macOS host (not WSL2)
- Messages app signed in
- `imsg` CLI installed
- Full Disk Access permission

**Not applicable** to current Liam setup.

---

## Section 2: Slack Alternatives - Deep Analysis

### 2.1 Comparison Matrix

| Channel | Setup Difficulty | Platform | Phone Required | Groups | Media | E2EE | Monthly Cost |

|---------|------------------|----------|----------------|--------|-------|------|--------------|

| **Telegram** | Easy | Any | No | Yes | Yes | No* | Free |

| **WhatsApp** | Medium | Any | Yes | Yes | Yes | Yes | Free |

| **Signal** | Medium | Any | Yes | Yes | Yes | Yes | Free |

| **Discord** | Medium | Any | No | Yes | Yes | No | Free |

| **Matrix** | Medium | Any | No | Yes | Yes | Optional | Free** |

| **iMessage** | Hard | macOS | No | Yes | Yes | Yes | Free |

| **MS Teams** | Hard | Any | No | Yes | Yes | No | Free*** |

| **Google Chat** | Hard | Any | No | Yes | Yes | No | Workspace |

*Telegram has optional Secret Chats with E2EE but bots cannot use them

**Matrix requires homeserver (self-host or use matrix.org)

***Teams requires Azure setup

### 2.2 Detailed Channel Analysis

#### Telegram (RECOMMENDED)

**Setup:**

1. Message @BotFather on Telegram
2. Create bot with `/newbot`
3. Copy token to config

**Config:**

```json5
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123456:ABC-DEF...",
      "dmPolicy": "pairing"
    }
  }
}
```

**Pros:**

- Fastest setup (5 minutes)
- No phone number required for bot
- Long-polling works (no public URL needed)
- Rich features: buttons, reactions, threading, draft streaming
- Works on all platforms (phone, desktop, web)
- Free, no rate limits for personal use
- Supports voice notes, images, files
- Bot can be added to groups

**Cons:**

- Not end-to-end encrypted for bot messages
- Requires Telegram account to message bot
- Privacy mode quirks for groups
- Less common in enterprise settings

**Best For:** Personal assistant, quick setup, cross-platform access

---

#### WhatsApp

**Setup:**

1. Get a dedicated phone number (prepaid SIM works)
2. Run `clawdbot channels login` to scan QR code
3. Configure allowlist

**Config:**

```json5
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"],
      "dmPolicy": "allowlist"
    }
  }
}
```

**Pros:**

- Most popular messaging app globally
- End-to-end encrypted
- Full feature support (voice notes, images, reactions)
- Works on all platforms
- Free

**Cons:**

- Requires dedicated phone number (not VoIP)
- QR pairing can expire/break
- WhatsApp may ban automation accounts
- No native threading
- State stored on disk (backup important)

**Best For:** If you already use WhatsApp heavily, want E2EE

---

#### Signal

**Setup:**

1. Get dedicated phone number
2. Install signal-cli (Java required)
3. Register number with Signal
4. Configure channel

**Config:**

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "number": "+1234567890",
      "allowFrom": ["+0987654321"]
    }
  }
}
```

**Pros:**

- Best privacy/security reputation
- End-to-end encrypted
- Open source
- Supports groups, media, reactions
- Typing indicators, read receipts

**Cons:**

- Requires signal-cli daemon (Java dependency)
- Requires dedicated phone number
- More complex setup
- Less feature-rich than Telegram
- signal-cli can be finicky

**Best For:** Privacy-conscious users, security-focused workflows

---

#### Discord

**Setup:**

1. Create bot at Discord Developer Portal
2. Enable Message Content Intent
3. Add bot to server
4. Configure token

**Config:**

```json5
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "MTIzNDU2Nzg5...",
      "dmPolicy": "pairing"
    }
  }
}
```

**Pros:**

- Rich features (threads, reactions, stickers, polls)
- No phone number required
- Great for communities/teams
- Slash commands, native integrations
- Free

**Cons:**

- Requires Discord account
- Mention-gated by default in groups
- Intents must be enabled in portal
- Not end-to-end encrypted
- Gaming-oriented reputation

**Best For:** Teams, communities, developers, gamers

---

#### Matrix (Decentralized)

**Setup:**

1. Install plugin: `clawdbot plugins install @clawdbot/matrix`
2. Create Matrix account or use existing
3. Get access token
4. Configure homeserver

**Config:**

```json5
{
  "plugins": {
    "entries": {
      "matrix": {
        "enabled": true,
        "config": {
          "homeserver": "https://matrix.org",
          "userId": "@liam:matrix.org",
          "accessToken": "syt_..."
        }
      }
    }
  }
}
```

**Pros:**

- Decentralized (self-host or use public server)
- Optional E2EE
- Open protocol (bridges to other platforms)
- No phone number required
- Supports rooms, threads, reactions

**Cons:**

- Requires homeserver setup or trust third-party
- E2EE requires device verification
- Less polished than commercial options
- Plugin installation required

**Best For:** Privacy advocates, self-hosters, open-source enthusiasts

---

#### Microsoft Teams

**Setup:**

1. Create Azure Bot resource
2. Create Teams app manifest
3. Install plugin: `clawdbot plugins install @clawdbot/msteams`
4. Configure App ID, secret, tenant ID
5. Set up public webhook endpoint

**Config:**

```json5
{
  "plugins": {
    "entries": {
      "msteams": {
        "enabled": true,
        "config": {
          "appId": "...",
          "appSecret": "...",
          "tenantId": "..."
        }
      }
    }
  }
}
```

**Pros:**

- Enterprise standard
- Integrates with Microsoft 365
- Rich cards (Adaptive Cards)
- No phone number required

**Cons:**

- Complex setup (Azure, manifest, webhook)
- Requires public HTTPS endpoint
- Graph API permissions for full features
- Webhook timeout issues
- Plugin required

**Best For:** Enterprise/corporate environments already using Teams

---

### 2.3 Feature Comparison

| Feature | Telegram | WhatsApp | Signal | Discord | Matrix |

|---------|----------|----------|--------|---------|--------|

| **Setup time** | 5 min | 15 min | 30 min | 15 min | 20 min |

| **Public URL needed** | No | No | No | No | No |

| **Phone number needed** | No | Yes | Yes | No | No |

| **E2EE** | No | Yes | Yes | No | Optional |

| **Groups** | Yes | Yes | Yes | Yes | Yes |

| **Threads** | Yes | No | No | Yes | Yes |

| **Reactions** | Yes | Yes | Yes | Yes | Yes |

| **Voice notes** | Yes | Yes | Yes | Yes | Yes |

| **Inline buttons** | Yes | No | No | Yes | No |

| **Typing indicator** | Yes | Yes | Yes | Yes | Yes |

| **Read receipts** | No | Yes | Yes | No | Yes |

| **Draft streaming** | Yes | No | No | No | No |

---

## Section 3: Recommendations

### 3.1 For SMS to Liam

**Recommended: Android Node SMS**

If you have a spare Android phone:

1. Install Clawdbot app
2. Grant SMS permission
3. Pair to gateway
4. Send SMS via: `clawdbot nodes invoke --node <phone> --command sms.send`

**Alternative: Request Twilio SMS plugin enhancement**

Add to EVOLUTION-QUEUE.md:

```markdown
## Twilio SMS Support
- Extend voice-call plugin to support SMS
- Or create dedicated @clawdbot/sms plugin
- Would enable: dedicated phone number, no hardware needed
```

### 3.2 For Slack Alternative

**Primary Recommendation: Telegram**

Reasons:

- Easiest setup (no phone number, no public URL)
- Rich features match or exceed Slack
- Works immediately with long-polling
- Draft streaming for real-time feedback
- Inline buttons for interactive workflows

**Secondary: WhatsApp or Signal**

If privacy/E2EE is priority, choose Signal or WhatsApp.

### 3.3 Migration Path from Slack

| Current Slack Usage | Recommended Alternative |

|---------------------|------------------------|

| Personal DMs | Telegram |

| Team collaboration | Discord or Matrix |

| Enterprise/corporate | MS Teams |

| Privacy-critical | Signal |

| Already use WhatsApp | WhatsApp |

---

## Section 4: Action Items

### Immediate

1. **Choose primary channel** - Telegram recommended
2. **Configure channel** - Add to `~/.clawdbot/clawdbot.json`
3. **Test bidirectional** - Send message, verify response

### If SMS Required

4. **Option A:** Pair Android phone as node
5. **Option B:** Add Twilio SMS to EVOLUTION-QUEUE.md

### Configuration

6. **Update STATUS.md** with new channel status
7. **Test heartbeat delivery** to new channel
8. **Configure cron jobs** to use new channel

---

## Appendix: Quick Start Commands

### Telegram Setup

```bash
# 1. Get token from @BotFather
# 2. Add to config:
clawdbot config set channels.telegram.enabled true
clawdbot config set channels.telegram.botToken "YOUR_TOKEN"
clawdbot config set channels.telegram.dmPolicy "pairing"

# 3. Restart gateway
clawdbot daemon restart

# 4. Message your bot on Telegram, approve pairing code
clawdbot pairing approve telegram <CODE>
```

### Android SMS Setup

```bash
# 1. Install Clawdbot app on Android
# 2. Grant SMS permission in app
# 3. Pair device (auto-discovery via Bonjour)
clawdbot nodes list

# 4. Send SMS
clawdbot nodes invoke --node <phone-name> --command sms.send \
  --params '{"to":"+1234567890","message":"Hello from Liam"}'
```