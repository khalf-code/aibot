# Clawdbot Calendar Solution Plan

## Overview

Build a native calendar solution for Clawdbot, inspired by nettu-scheduler's architecture but optimized for Simon's workflow and integrated into the Clawdbot ecosystem. **Core requirement: Two-way sync with Google Calendar (clawdbot@puenteworks.com)**.

## Why Build Instead of Use nettu-scheduler Directly?

**nettu-scheduler advantages:**
- Mature, battle-tested codebase
- Rich features (booking, recurrence, integrations)
- Good documentation

**Why we should build our own:**
- **Full control** over Clawdbot integration
- **No Rust dependency** - keep the stack consistent (Node.js/TypeScript)
- **Tailored to Simon's needs** - not over-engineered
- **Learning opportunity** - understand calendar systems deeply
- **No external service** to manage (no Rust build chain)
- **Single database** - use existing SQLite/para.sqlite approach
- **Tight Google Calendar integration** - use existing gog CLI authentication

## Architecture

### Tech Stack

**Core:**
- **Language:** TypeScript / Node.js
- **Framework:** Hono.js (fast, edge-compatible, similar to Actix)
- **Database:** SQLite with Drizzle ORM (matches PARA system)
- **Auth:** API keys (server-to-server), JWT (optional for future web UI)
- **Google Calendar Integration:** gog CLI (existing auth) + googleapis library

**Why Hono?**
- Fast (similar performance to Rust/Actix)
- TypeScript-first
- Edge-ready (can deploy to Cloudflare Workers if needed)
- Simple routing (Actix-like)
- Middleware support

### Data Model

```typescript
// Core Entities
type Account = {
  id: string
  name: string
  apiKey: string
  settings: AccountSettings
}

type AccountSettings = {
  timezone: string
  defaultCalendarId?: string
  googleSyncEnabled: boolean
  googleSyncInterval: number // minutes
}

type User = {
  id: string
  accountId: string
  email: string
  timezone: string
  googleCalendarId?: string // Link to Google Calendar
  metadata: Record<string, any>
}

type Calendar = {
  id: string
  accountId: string
  userId: string
  name: string
  timezone: string
  weekStart: number // 0 = Monday, 6 = Sunday
  color?: string
  googleCalendarId?: string // For two-way sync
  syncDirection: 'none' | 'import' | 'export' | 'both'
  lastSyncTs?: number
}

type CalendarEvent = {
  id: string
  accountId: string
  userId: string
  calendarId: string
  googleEventId?: string // For sync tracking
  title: string
  description?: string
  startTs: number // Unix timestamp
  duration: number // milliseconds
  recurrence?: RecurrenceRule
  location?: string
  metadata: Record<string, any>
  busy: boolean
  reminders: Reminder[]
  syncStatus: 'synced' | 'pending_sync' | 'conflict' | 'local_only'
  lastSyncTs?: number
  createdAt: number
  updatedAt: number
}

type RecurrenceRule = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  until?: number // Unix timestamp
  count?: number
  byDay?: number[] // 0-6 (Sunday-Saturday)
  byMonth?: number[]
}

type Reminder = {
  delta: number // minutes before event
  identifier?: string
  sent: boolean
}

type Webhook = {
  id: string
  accountId: string
  url: string
  secret: string
  events: string[] // ['event.created', 'reminder.triggered']
}

type SyncLog = {
  id: string
  accountId: string
  calendarId: string
  direction: 'import' | 'export' | 'both'
  eventsSynced: number
  errors: number
  startedAt: number
  completedAt: number
}
```

### API Routes

```
POST   /api/v1/account                    - Create account
GET    /api/v1/account/:id                - Get account
PATCH  /api/v1/account/:id                - Update account settings

POST   /api/v1/user                       - Create user
GET    /api/v1/user/:id                   - Get user
GET    /api/v1/user/meta                  - Query users by metadata
PATCH  /api/v1/user/:id                   - Update user
DELETE /api/v1/user/:id                   - Delete user

POST   /api/v1/calendar                   - Create calendar
GET    /api/v1/calendar/:id               - Get calendar
GET    /api/v1/calendar/:id/events        - Get calendar events
PATCH  /api/v1/calendar/:id               - Update calendar
DELETE /api/v1/calendar/:id               - Delete calendar
POST   /api/v1/calendar/:id/sync-google   - Sync with Google Calendar
GET    /api/v1/calendar/:id/sync-log      - Get sync history

POST   /api/v1/event                      - Create event
GET    /api/v1/event/:id                  - Get event
GET    /api/v1/event/:id/instances        - Get recurrence instances
PATCH  /api/v1/event/:id                  - Update event
DELETE /api/v1/event/:id                  - Delete event
GET    /api/v1/event/meta                 - Query events by metadata

POST   /api/v1/reminder/sync              - Sync reminders (cron job)
GET    /api/v1/reminder/pending           - Get pending reminders

POST   /api/v1/webhook                    - Create webhook
GET    /api/v1/webhook                    - List webhooks
DELETE /api/v1/webhook/:id                - Delete webhook
```

## Implementation Plan

### Phase 1: Foundation (3-5 days)

**Goal:** Basic CRUD for accounts, users, calendars, events

**Tasks:**
1. **Database Setup**
   - Create `calendar.sqlite` (separate from para.sqlite)
   - Define Drizzle schema (with sync fields)
   - Run migrations

2. **Server Setup**
   - Initialize Hono.js project
   - Configure TypeScript
   - Set up development environment (nodemon)
   - Add API key middleware

3. **Core API Endpoints**
   - Account CRUD
   - User CRUD
   - Calendar CRUD
   - Event CRUD (single events only)

4. **Testing**
   - Write unit tests for core models
   - Integration tests for API
   - Test with curl/Postman

**Files:**
```
~/clawdbot/skills/calendar/
├── SKILL.md                    # Documentation
├── src/
│   ├── server.ts              # Hono server
│   ├── middleware/
│   │   └── auth.ts            # API key validation
│   ├── routes/
│   │   ├── account.ts
│   │   ├── user.ts
│   │   ├── calendar.ts
│   │   ├── event.ts
│   │   └── google-sync.ts     # Google Calendar sync
│   ├── models/
│   │   ├── account.ts
│   │   ├── user.ts
│   │   ├── calendar.ts
│   │   └── event.ts
│   ├── sync/
│   │   ├── google-client.ts   # Google Calendar API wrapper
│   │   ├── import.ts          # Import from Google
│   │   ├── export.ts          # Export to Google
│   │   └── mapper.ts          # Map between schemas
│   └── db/
│       ├── schema.ts          # Drizzle schema
│       └── client.ts          # Database client
├── db/
│   └── calendar.sqlite        # Database file
└── scripts/
    ├── start.sh               # Start server
    ├── migrate.sh             # Run migrations
    └── sync-google.sh         # Manual Google sync trigger
```

### Phase 2: Recurrence & Querying (2-3 days)

**Goal:** Support recurring events and flexible queries

**Tasks:**
1. **Recurrence Rules**
   - Implement RRULE parsing (or use library)
   - Generate instances for date ranges
   - Handle exceptions (skip specific instances)

2. **Event Queries**
   - Query events by date range
   - Query events by metadata
   - Filter by calendar, user, tags

3. **Testing**
   - Test recurrence expansion
   - Test complex queries

**Libraries to consider:**
- `rrule` - Recurrence rule library
- `date-fns-tz` - Timezone handling

### Phase 3: Reminders (2-3 days)

**Goal:** Send event reminders via Slack

**Tasks:**
1. **Reminder System**
   - Add reminders to event model
   - Create cron job to check for upcoming reminders
   - Send notifications via Clawdbot Slack integration

2. **Reminder Worker**
   - Run every 1-5 minutes
   - Query events with reminders due
   - Mark reminders as sent
   - Send to Slack

3. **Testing**
   - Test reminder triggering
   - Test duplicate prevention

**Integration:**
- Use Clawdbot's `message` tool for Slack delivery
- Store "sent" flag to prevent duplicates

### Phase 4: Google Calendar Integration (5-7 days) **CORE REQUIREMENT**

**Goal:** Two-way sync between Clawdbot Calendar and Google Calendar (clawdbot@puenteworks.com)

**Approach:** Leverage existing gog CLI authentication credentials

#### 4.1 Google Calendar API Setup (1 day)

**Tasks:**
1. **Enable Google Calendar API**
   - Enable API in Google Cloud Console (currently disabled)
   - Create OAuth 2.0 credentials
   - Configure redirect URI

2. **Test Access**
   - Use gog CLI to list calendars
   - Verify `clawdbot@puenteworks.com` access
   - Test basic API calls

**Verification:**
```bash
gog calendar list --account clawdbot@puenteworks.com
```

#### 4.2 Google Calendar Client (1-2 days)

**Tasks:**
1. **Create Google Calendar Wrapper**
   - Use `googleapis` npm package
   - Implement authentication using gog's token store
   - Handle token refresh automatically

2. **Core Operations**
   - List calendars
   - Get calendar events
   - Create event
   - Update event
   - Delete event

**File:** `src/sync/google-client.ts`

```typescript
import { calendar_v3 } from 'googleapis';
import { authenticate } from './auth';

export class GoogleCalendarClient {
  private client: calendar_v3.Calendar;

  constructor() {
    this.client = authenticate();
  }

  async listCalendars() {
    const res = await this.client.calendars.list();
    return res.data.items;
  }

  async getEvents(calendarId: string, timeMin: Date, timeMax: Date) {
    const res = await this.client.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items;
  }

  async createEvent(calendarId: string, event: calendar_v3.Schema$Event) {
    const res = await this.client.events.insert({
      calendarId,
      requestBody: event,
    });
    return res.data;
  }

  async updateEvent(calendarId: string, eventId: string, event: calendar_v3.Schema$Event) {
    const res = await this.client.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });
    return res.data;
  }

  async deleteEvent(calendarId: string, eventId: string) {
    await this.client.events.delete({
      calendarId,
      eventId,
    });
  }
}
```

#### 4.3 Schema Mapping (1 day)

**Tasks:**
1. **Google to Clawdbot Mapper**
   - Map Google Event → CalendarEvent
   - Handle recurrence rules (RRULE → RecurrenceRule)
   - Handle reminders
   - Preserve metadata

2. **Clawdbot to Google Mapper**
   - Map CalendarEvent → Google Event
   - Handle timezone conversions
   - Map recurrence rules

**File:** `src/sync/mapper.ts`

```typescript
export function googleEventToCalendarEvent(googleEvent: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: generateId(),
    googleEventId: googleEvent.id,
    title: googleEvent.summary || '(No title)',
    description: googleEvent.description,
    startTs: new Date(googleEvent.start?.dateTime || googleEvent.start?.date).getTime(),
    duration: calculateDuration(googleEvent.start, googleEvent.end),
    recurrence: parseRecurrence(googleEvent.recurrence),
    location: googleEvent.location,
    reminders: mapReminders(googleEvent.reminders),
    syncStatus: 'synced',
    lastSyncTs: Date.now(),
    // ... other fields
  };
}

export function calendarEventToGoogleEvent(event: CalendarEvent): calendar_v3.Schema$Event {
  return {
    id: event.googleEventId,
    summary: event.title,
    description: event.description,
    start: { dateTime: new Date(event.startTs).toISOString() },
    end: { dateTime: new Date(event.startTs + event.duration).toISOString() },
    location: event.location,
    recurrence: mapRecurrence(event.recurrence),
    reminders: mapRemindersToGoogle(event.reminders),
    // ... other fields
  };
}
```

#### 4.4 Import from Google (1 day)

**Tasks:**
1. **Import Endpoint**
   - `POST /api/v1/calendar/:id/sync-google?direction=import`
   - Fetch events from Google Calendar
   - Map to Clawdbot events
   - Upsert (create or update) in database
   - Track sync status

2. **Conflict Resolution**
   - Prefer local changes if `lastSyncTs` > Google updated
   - Otherwise, prefer Google changes
   - Flag conflicts for manual review

**File:** `src/sync/import.ts`

#### 4.5 Export to Google (1 day)

**Tasks:**
1. **Export Endpoint**
   - `POST /api/v1/calendar/:id/sync-google?direction=export`
   - Find events with `syncStatus: pending_sync`
   - Map to Google format
   - Push to Google Calendar
   - Update sync status

2. **Auto-Export Trigger**
   - Export on event create/update/delete
   - Queue for async processing

**File:** `src/sync/export.ts`

#### 4.6 Two-Way Sync (1 day)

**Tasks:**
1. **Sync Engine**
   - `POST /api/v1/calendar/:id/sync-google?direction=both`
   - Compare local and remote events
   - Import new/updated from Google
   - Export new/updated to Google
   - Handle deletions (sync direction configurable)

2. **Sync Schedule**
   - Add cron job for auto-sync
   - Configurable interval (default: 15 minutes)

**File:** `src/routes/google-sync.ts`

```typescript
app.post('/api/v1/calendar/:id/sync-google', async (c) => {
  const { id } = c.req.param();
  const direction = c.req.query('direction') || 'both';

  const syncResult = await syncWithGoogle({
    calendarId: id,
    direction,
  });

  return c.json(syncResult);
});
```

#### 4.7 Testing (1 day)

**Tasks:**
1. **Test Import**
   - Create event in Google Calendar
   - Run import
   - Verify event appears in Clawdbot
   - Test recurring events

2. **Test Export**
   - Create event in Clawdbot
   - Run export
   - Verify event appears in Google Calendar
   - Test updates and deletions

3. **Test Two-Way Sync**
   - Create events in both calendars
   - Run sync
   - Verify bidirectional updates
   - Test conflict resolution

4. **Test Edge Cases**
   - Very long recurrence rules
   - Events across DST boundaries
   - Timezone changes
   - Large calendars (1000+ events)

### Phase 5: Clawdbot Integration (2-3 days)

**Goal:** Tight integration with Slack, heartbeats, PARA

**Tasks:**
1. **Slack Commands**
   - `/cal add <title> <date>` - Add event (syncs to Google)
   - `/cal list [date]` - List events (from Clawdbot + Google)
   - `/cal upcoming` - Show upcoming events
   - `/cal delete <id>` - Delete event (syncs to Google)
   - `/cal sync` - Manual trigger Google sync

2. **Heartbeat Integration**
   - Update HEARTBEAT.md to use local calendar API
   - Query both Clawdbot and Google for events
   - 24h alerts, 2h reminders, post-meeting summaries

3. **PARA Integration**
   - Link events to PARA projects (metadata)
   - Add project tags to events
   - Query events by project

4. **Natural Language**
   - Parse "meeting with Simon tomorrow at 3pm"
   - Extract title, date, time from natural text
   - Create event with proper timezone

## Database Schema (Drizzle)

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull().unique(),
  settings: text('settings'), // JSON: { timezone, defaultCalendarId, googleSyncEnabled, googleSyncInterval }
  createdAt: integer('created_at').notNull(),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  email: text('email'),
  timezone: text('timezone').notNull().default('UTC'),
  googleCalendarId: text('google_calendar_id'), // Link to Google Calendar
  metadata: text('metadata'), // JSON
  createdAt: integer('created_at').notNull(),
})

export const calendars = sqliteTable('calendars', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  weekStart: integer('week_start').notNull().default(0),
  color: text('color'),
  googleCalendarId: text('google_calendar_id'), // For two-way sync
  syncDirection: text('sync_direction', { enum: ['none', 'import', 'export', 'both'] }).notNull().default('both'),
  lastSyncTs: integer('last_sync_ts'),
  createdAt: integer('created_at').notNull(),
})

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  userId: text('user_id').notNull(),
  calendarId: text('calendar_id').notNull(),
  googleEventId: text('google_event_id'), // For sync tracking
  title: text('title').notNull(),
  description: text('description'),
  startTs: integer('start_ts').notNull(),
  duration: integer('duration').notNull(),
  recurrence: text('recurrence'), // JSON
  location: text('location'),
  metadata: text('metadata'), // JSON
  busy: integer('busy', { mode: 'boolean' }).notNull().default(true),
  reminders: text('reminders'), // JSON array
  syncStatus: text('sync_status', { enum: ['synced', 'pending_sync', 'conflict', 'local_only'] }).notNull().default('local_only'),
  lastSyncTs: integer('last_sync_ts'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').notNull(), // JSON array
  createdAt: integer('created_at').notNull(),
})

export const syncLogs = sqliteTable('sync_logs', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  calendarId: text('calendar_id').notNull(),
  direction: text('direction', { enum: ['import', 'export', 'both'] }).notNull(),
  eventsSynced: integer('events_synced').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
})
```

## API Key Management

**Approach:** Store API keys in `~/.clawdbot/calendar-keys.json`

```json
{
  "accounts": [
    {
      "id": "acc-xxx",
      "name": "Simon's Calendar",
      "apiKey": "clk_xxx",
      "userId": "user-xxx",
      "defaultCalendarId": "cal-xxx",
      "googleCalendarId": "clawdbot@puenteworks.com"
    }
  ]
}
```

**Middleware:** Validate `x-api-key` header on all requests

## Cron Jobs

Add to `~/.clawdbot/cron/jobs.json`:

```json
[
  {
    "id": "calendar-reminders",
    "text": "Check calendar reminders and send to Slack",
    "schedule": "*/5 * * * *",
    "model": "ollama/glm-4.7-flash",
    "systemEvent": true
  },
  {
    "id": "calendar-google-sync",
    "text": "Sync calendar with Google Calendar (clawdbot@puenteworks.com)",
    "schedule": "*/15 * * * *",
    "model": "ollama/glm-4.7-flash",
    "systemEvent": true
  }
]
```

## Examples

### Create Event (Auto-syncs to Google)

```bash
curl -X POST http://localhost:3000/api/v1/event \
  -H "Content-Type: application/json" \
  -H "x-api-key: clk_xxx" \
  -d '{
    "title": "Meeting with Simon",
    "description": "Discuss calendar project",
    "startTs": 1737830400,
    "duration": 3600000,
    "calendarId": "cal-xxx",
    "location": "Zoom",
    "reminders": [{"delta": 60, "identifier": "meeting-alert"}]
  }'
```

Response includes `syncStatus: pending_sync` - will auto-sync to Google.

### Query Events (Includes Google-synced)

```bash
curl "http://localhost:3000/api/v1/calendar/cal-xxx/events?startTs=$(date +%s)&endTs=$(($(date +%s)+86400))" \
  -H "x-api-key: clk_xxx"
```

Returns events from both Clawdbot storage and Google Calendar (merged view).

### Manual Google Sync

```bash
# Import from Google
curl -X POST "http://localhost:3000/api/v1/calendar/cal-xxx/sync-google?direction=import" \
  -H "x-api-key: clk_xxx"

# Export to Google
curl -X POST "http://localhost:3000/api/v1/calendar/cal-xxx/sync-google?direction=export" \
  -H "x-api-key: clk_xxx"

# Two-way sync
curl -X POST "http://localhost:3000/api/v1/calendar/cal-xxx/sync-google?direction=both" \
  -H "x-api-key: clk_xxx"
```

### Get Sync History

```bash
curl "http://localhost:3000/api/v1/calendar/cal-xxx/sync-log?limit=10" \
  -H "x-api-key: clk_xxx"
```

## Google Calendar Authentication

**Approach:** Leverage existing gog CLI credentials

**Location:** `~/.config/gogcli/credentials/` (encrypted store)

**Integration:**
- gog CLI handles OAuth token storage and refresh
- Read gog's token file for access tokens
- Use tokens with `googleapis` library
- Fallback to manual auth if gog tokens unavailable

**Alternative:** Use Google Cloud Service Account for server-to-server access (simpler for cron jobs)

## Testing Strategy

1. **Unit Tests** - Test models, recurrence logic, mappers
2. **Integration Tests** - Test API endpoints, Google sync
3. **E2E Tests** - Test full workflows (create event, sync, reminder)
4. **Load Tests** - Test performance with many events
5. **Sync Tests** - Test bidirectional sync, conflicts, edge cases

## Migration from Google Calendar

One-time import process:

```bash
# Link calendar to Google
curl -X POST http://localhost:3000/api/v1/calendar/cal-xxx/link-google \
  -H "Content-Type: application/json" \
  -H "x-api-key: clk_xxx" \
  -d '{
    "googleCalendarId": "clawdbot@puenteworks.com"
  }'

# Import all events
curl -X POST "http://localhost:3000/api/v1/calendar/cal-xxx/sync-google?direction=import&full=true" \
  -H "x-api-key: clk_xxx"
```

## Sync Conflict Resolution

**Strategy:**
- Compare `lastSyncTs` (local) vs Google's `updated` timestamp
- Prefer newer timestamp
- If timestamps match (< 1 min diff), prefer local changes
- Flag conflicts within 1 minute for manual review

**Manual Conflict Resolution:**
- API endpoint to list conflicts
- Choose local or remote version
- Merge manually (if needed)

## Risks & Considerations

**Google Calendar API:**
- Rate limits (10,000 requests/day per project)
- Quotas may need adjustment for frequent sync
- Consider using Service Account for higher limits

**Complexity:**
- Recurrence rules are complex (Google RRULE vs custom format)
- Timezone handling can be tricky (use libraries, not manual code)
- Two-way sync adds complexity (conflict resolution)

**Performance:**
- SQLite may slow with millions of events
- Consider indexing on `startTs`, `calendarId`, `accountId`, `googleEventId`
- Sync large calendars may be slow (batch imports)

**Security:**
- API keys should be rotated periodically
- Google tokens stored securely (use gog's encrypted store)
- Webhook secrets must be validated

## Next Steps

1. **Approve plan** - Simon reviews and approves
2. **Enable Google Calendar API** - Simon enables in Google Cloud Console
3. **Start Phase 1** - Begin foundation work
4. **Iterate** - Adjust based on Simon's feedback

## Timeline Estimate

- **Phase 1 (Foundation):** 3-5 days
- **Phase 2 (Recurrence):** 2-3 days
- **Phase 3 (Reminders):** 2-3 days
- **Phase 4 (Google Sync):** 5-7 days **CORE REQUIREMENT**
- **Phase 5 (Integration):** 2-3 days

**Total:** 14-21 days to full calendar system with Google Calendar two-way sync.

---

*Created: 2026-01-25*
*Updated: 2026-01-25 (added Google Calendar integration as core requirement)*
*Inspired by: nettu-scheduler (https://github.com/fmeringdal/nettu-scheduler)*
*Status: Plan pending approval*
