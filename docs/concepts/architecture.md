# Steve Architecture Blueprint

> Last updated: January 6, 2026

## Overview

Steve is an AI executive assistant built on the **Clawdis** platform, running locally on David's MacBook Pro. He serves the Hurley family and the One Point Partners team.

<<<<<<< HEAD:docs/architecture.md
=======
### TypeScript Gateway ([`src/gateway/server.ts`](https://github.com/clawdbot/clawdbot/blob/main/src/gateway/server.ts))
- Single HTTP + WebSocket server (default `18789`); bind policy `loopback|lan|tailnet|auto`. Refuses non-loopback binds without auth; Tailscale serve/funnel requires loopback.
- Handshake: first frame must be a `connect` request; AJV validates request + params against TypeBox schemas; protocol negotiated via `minProtocol`/`maxProtocol`.
- `hello-ok` includes snapshot (presence/health/stateVersion/uptime/configPath/stateDir), features (methods/events), policy (max payload/buffer/tick), and `canvasHostUrl` when available.
- Events emitted: `agent`, `chat`, `presence`, `tick`, `health`, `heartbeat`, `cron`, `talk.mode`, `node.pair.requested`, `node.pair.resolved`, `voicewake.changed`, `shutdown`.
- Idempotency keys are required for `send`, `agent`, `chat.send`, and node invokes; the dedupe cache avoids double-sends on reconnects. Payload sizes are capped per connection.
- Optional node bridge ([`src/infra/bridge/server.ts`](https://github.com/clawdbot/clawdbot/blob/main/src/infra/bridge/server.ts)): TCP JSONL frames (`hello`, `pair-request`, `req/res`, `event`, `invoke`, `ping`). Node connect/disconnect updates presence and flows into the session bus.
- Control UI + Canvas host: HTTP serves Control UI (base path configurable) and can host the A2UI canvas via [`src/canvas-host/server.ts`](https://github.com/clawdbot/clawdbot/blob/main/src/canvas-host/server.ts) (live reload). Canvas host URL is advertised to nodes + clients.

### iOS node (`apps/ios`)
- Discovery + pairing: `BridgeDiscoveryModel` uses `NWBrowser` Bonjour discovery and reads TXT fields for LAN/tailnet host hints plus gateway/bridge/canvas ports.
- Auto-connect: `BridgeConnectionController` uses stored `node.instanceId` + Keychain token; supports manual host/port; performs `pair-and-hello`.
- Bridge runtime: `BridgeSession` actor owns an `NWConnection`, JSONL frames, `hello`/`hello-ok`, ping/pong, `req/res`, server `event`s, and `invoke` callbacks; stores `canvasHostUrl`.
- Commands: `NodeAppModel` executes `canvas.*`, `canvas.a2ui.*`, `camera.*`, `screen.record`, `location.get`. Canvas/camera/screen are blocked when backgrounded.
- Canvas + actions: `WKWebView` with A2UI action bridge; accepts actions from local-network or trusted file URLs; intercepts `clawdbot://` deep links and forwards `agent.request` to the bridge.
- Voice/talk: voice wake sends `voice.transcript` events and syncs triggers via `voicewake.get` + `voicewake.changed`; Talk Mode attaches to the bridge.

### Android node (`apps/android`)
- Discovery + pairing: `BridgeDiscovery` uses mDNS/NSD to find `_clawdbot-bridge._tcp`, with manual host/port fallback.
- Auto-connect: `NodeRuntime` restores a stored token, performs `pair-and-hello`, and reconnects to the last discovered or manual bridge.
- Bridge runtime: `BridgeSession` owns the TCP JSONL session (`hello`/`hello-ok`, ping/pong, `req/res`, `event`, `invoke`); stores `canvasHostUrl`.
- Commands: `NodeRuntime` executes `canvas.*`, `canvas.a2ui.*`, `camera.*`, and chat/session events; foreground-only for canvas/camera.

## Components and flows
- **Gateway (daemon)**  
  - Maintains WhatsApp (Baileys), Telegram (grammY), Slack (Bolt), Discord (discord.js), Signal (signal-cli), and iMessage (imsg) connections.  
  - Exposes a typed WS API (req/resp + server push events).  
  - Validates every inbound frame against JSON Schema; rejects anything before a mandatory `connect`.
- **Clients (mac app / CLI / web admin)**  
  - One WS connection per client.  
  - Send requests (`health`, `status`, `send`, `agent`, `system-presence`, toggles) and subscribe to events (`tick`, `agent`, `presence`, `shutdown`).
  - On macOS, the app can also be invoked via deep links (`clawdbot://agent?...`) which translate into the same Gateway `agent` request path (see [`docs/macos.md`](/platforms/macos)).
- **Agent process (Pi)**  
  - Spawned by the Gateway on demand for `agent` calls; streams events back over the same WS connection.
- **WebChat**  
  - Serves static assets locally.  
  - Holds a single WS connection to the Gateway for control/data; all sends/agent runs go through the Gateway WS.  
  - Remote use goes through the same SSH/Tailscale tunnel as other clients.

## Connection lifecycle (single client)
>>>>>>> upstream/main:docs/concepts/architecture.md
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STEVE (AI Agent)                                │
│                     "Executive Assistant for Hurleys"                        │
│                        Model: Claude Opus 4.5                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
           ┌───────────────┐                   ┌───────────────┐
           │   MESSAGING   │                   │    MEMORY     │
           │   SURFACES    │                   │    LAYER      │
           └───────────────┘                   └───────────────┘
```

---

## System Diagram

```mermaid
flowchart TB
    subgraph Gateway["🖥️ Clawdis Gateway (MacBook Pro)"]
        Steve["🤖 Steve<br/>Claude Opus 4.5"]
        Hooks["Webhooks<br/>:18789"]
        Cron["Cron Engine"]
    end

    subgraph Messaging["💬 Messaging Surfaces"]
        WA["📱 WhatsApp<br/>(Baileys)"]
        Discord["💜 Discord"]
        Web["🌐 Web UI<br/>:18789"]
    end

    subgraph Memory["🧠 Memory Layer"]
        Soul["SOUL.md<br/>Identity & Values"]
        User["USER.md<br/>David's Context"]
        Daily["memory/*.md<br/>Daily Notes"]
        Long["memory.md<br/>Long-term Facts"]
        QMD["qmd<br/>Semantic Search"]
    end

    subgraph CRM["📊 CRM Systems"]
        Twenty["Twenty CRM<br/>api.mollified.app<br/>(One Point Team)"]
        PPL["ppl.gift<br/>(Personal Contacts)"]
    end

    subgraph Google["📧 Google Workspace"]
        Gmail["Gmail<br/>dbh.today@gmail.com"]
        GCal["Calendar"]
        GDrive["Drive"]
        Contacts["Contacts"]
    end

    subgraph Media["🎬 Media Server (Synology)"]
        Plex["Plex :32400"]
        Radarr["Radarr :7878"]
        Sonarr["Sonarr :8989"]
        SAB["SABnzbd :8080"]
    end

    subgraph SmartHome["🏠 Smart Home"]
        Hue["Philips Hue<br/>192.168.4.95"]
        Eight["Eight Sleep"]
        HA["Home Assistant"]
    end

    subgraph External["🌐 External APIs"]
        Twitter["X/Twitter<br/>(bird)"]
        Brave["Brave Search"]
        Spotify["Spotify"]
        GitHub["GitHub"]
        Vercel["Vercel"]
        GoDaddy["GoDaddy"]
    end

    %% Connections
    WA <--> Steve
    Discord <--> Steve
    Web <--> Steve
    
    Steve --> Soul
    Steve --> User
    Steve --> Daily
    Steve --> Long
    Steve <--> QMD
    
    Steve <--> Twenty
    Steve <--> PPL
    
    Steve <--> Gmail
    Steve <--> GCal
    Steve <--> GDrive
    
    Steve <--> Plex
    Steve <--> Radarr
    Steve <--> Sonarr
    
    Steve <--> Hue
    Steve <--> Eight
    
    Steve <--> Twitter
    Steve <--> Brave
    Steve <--> Spotify
    Steve <--> GitHub
    
    Hooks --> Steve
    Cron --> Steve
```

---

## Components

### 🤖 Core Platform

| Component | Description |
|-----------|-------------|
| **Clawdis Gateway** | Local runtime on MacBook Pro, port 18789 |
| **Agent: Steve** | Claude Opus 4.5, executive assistant persona |
| **Workspace** | `/Users/dbhurley/clawd/` |
| **Skills** | 69 skill modules in `skills/` |

### 💬 Messaging Surfaces

| Surface | Status | Notes |
|---------|--------|-------|
| **WhatsApp** | ✅ Active | Primary channel, via Baileys |
| **Discord** | ✅ Active | For specific servers |
| **Web UI** | ✅ Active | localhost:18789 |

### 🧠 Memory System

```
/Users/dbhurley/clawd/
├── SOUL.md          # Who Steve is, values, behavior
├── USER.md          # David's info, family, preferences
├── IDENTITY.md      # Name, emoji, avatar
├── AGENTS.md        # Workspace rules & guidelines
├── TOOLS.md         # Local tool notes (IPs, hosts)
├── memory.md        # Long-term persistent facts
└── memory/
    ├── 2026-01-06.md           # Today's notes
    ├── heartbeat-state.json    # Proactive check tracking
    └── ...                     # Historical daily notes
```

**Semantic Search:** `qmd` indexes memory for natural language recall.

### ⏰ Scheduled Jobs (Crons)

| Job | Schedule | Description |
|-----|----------|-------------|
| **crypto-alert-check** | Every 15 min | Check BTC/ETH price thresholds |
| **daily-verse** | 6:05 AM ET | Bible.com verse to WhatsApp |
| **sync-skills** | Every 4 hours | Git sync workspace → repo |
| **kate-airport-thu** | Thu Jan 9 | One-time reminder |

### 📊 CRM Systems

| System | Purpose | Integration |
|--------|---------|-------------|
| **Twenty CRM** | One Point Partners team CRM | API at api.mollified.app |
| **ppl.gift** | Personal contacts & relationships | API |

### 🔧 Key Skills (69 total)

#### Communication
- `gog` - Google Workspace (Gmail, Calendar, Drive, Contacts)
- `wacli` - WhatsApp CLI (send to others)
- `imsg` - iMessage/SMS
- `bird` - X/Twitter
- `slack` - Slack integration
- `discord` - Discord control

#### CRM & Data
- `twenty` - Twenty CRM for One Point
- `ppl` - ppl.gift personal CRM
- `pptx` - PowerPoint parsing + Twenty sync
- `otter` - Otter.ai transcription

#### Media & Entertainment
- `plex` - Plex media control
- `radarr` - Movie management
- `sonarr` - TV show management
- `spotify-player` - Spotify playback
- `sag` - ElevenLabs TTS

#### Smart Home
- `openhue` - Philips Hue lights
- `eightctl` - Eight Sleep pod
- `homeassistant` - Home Assistant

#### Development
- `github` - GitHub CLI
- `vercel` - Deployments
- `godaddy` - Domain management
- `coding-agent` - Spawn coding assistants

#### Utilities
- `brave-search` - Web search
- `weather` - Forecasts
- `bible` - Verse of the day
- `crypto-tracker` - Price alerts
- `summarize` - URL/file summaries
- `qmd` - Semantic search

### 🔌 Webhooks

| Endpoint | Purpose |
|----------|---------|
| `/hooks/tradingview` | TradingView alerts → WhatsApp |

### 🏠 Network Topology

```
Home Network (192.168.4.x)
├── MacBook Pro (Gateway host)
├── Synology NAS (.84)
│   ├── Plex :32400
│   ├── Radarr :7878
│   ├── Sonarr :8989
│   └── SABnzbd :8080
├── Hue Bridge (.95)
└── Mac Mini (coming Jan 13-15)
```

---

## Data Flow Examples

### 1. WhatsApp Message → Response

```
User sends WhatsApp message
    → Baileys receives
    → Gateway routes to Steve
    → Steve processes (reads memory, uses skills)
    → Response sent back via Baileys
```

### 2. PPTX → Twenty CRM

```
User sends PPTX file
    → pptx skill parses community data
    → Extracts contacts, team, goals, market analysis
    → sync_to_twenty.py creates:
        - Updates engagement (manager, community link)
        - Creates People records
        - Creates Notes linked to engagement
```

### 3. Crypto Alert Check (Cron)

```
Every 15 minutes:
    → Cron triggers crypto-alert-check
    → Script checks BTC/ETH vs thresholds
    → If triggered: Steve sends WhatsApp alert
    → If not: Silent "ok"
```

---

## Multi-Tenant Access (One Point)

Steve serves multiple users with permission tiers:

| Tier | Access |
|------|--------|
| **Owner** (David) | Full access to everything |
| **Family** | All skills |
| **Work** (One Point) | twenty, gog, brave-search, github |
| **Extended Family** | brave-search, weather, ppl |

Permissions checked via `steve-auth` skill using ppl.gift tags.

---

## Future Additions

- [ ] Mac Mini as dedicated "brain" (Jan 13-15)
- [ ] Otter.ai transcription integration
- [ ] More One Point team members in Twenty
- [ ] SharePoint document indexing for One Point

---

*This document auto-generated by Steve. Update as architecture evolves.*
