# Agent Console — Spec v2

> **Last Updated:** 2026-01-31
> **Status:** Rebuilding with correct vision
> **Owner:** David Hurley + Steve (AI Orchestrator)

---

## What This Actually Is

Agent Console is **Steve's command center** for orchestrating AI sub-agents across DBH Ventures projects. It REPLACES Vikunja, Mission Control, and any other external tools.

**This is not an observability dashboard. This is an operational control system.**

---

## Core Mental Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT CONSOLE                             │
│                    (Steve's Command Center)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PROJECTS          TASKS              AGENTS                    │
│   ─────────         ─────              ──────                    │
│   MeshGuard    →    Build auth    →    Builder (running)        │
│   SaveState    →    Write docs    →    Scribe (idle)            │
│   Agent Console→    Fix CSS       →    Canvas (running)         │
│                                                                  │
│   Each task can spawn agent sessions                            │
│   Sessions roll up cost to tasks → projects                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model (Bespoke, NOT Vikunja)

### Projects
```typescript
interface Project {
  id: string
  name: string
  emoji: string
  description: string
  color: string  // for visual distinction
  status: 'active' | 'paused' | 'archived'
  createdAt: Date
  updatedAt: Date
}
```

### Tasks
```typescript
interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: 'inbox' | 'assigned' | 'running' | 'blocked' | 'done'
  priority: 'critical' | 'high' | 'medium' | 'low'
  assignedAgentId: string | null  // Which sub-agent owns this
  linkedSessionIds: string[]       // Sessions spawned for this task
  totalTokens: number             // Aggregated from sessions
  totalCost: number               // Aggregated from sessions
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}
```

### Comments (on Tasks)
```typescript
interface Comment {
  id: string
  taskId: string
  authorId: string        // Agent ID (steve, builder, etc.)
  authorName: string
  content: string
  createdAt: Date
}
```

### Agents (Registry)
```typescript
interface Agent {
  id: string              // e.g., 'builder', 'scout', 'canvas'
  name: string
  emoji: string
  description: string
  capabilities: string[]  // What this agent is good at
  status: 'idle' | 'running' | 'paused' | 'error' | 'offline'
  currentTaskId: string | null
  currentSessionId: string | null
}
```

### Sessions (from Gateway, enhanced)
```typescript
interface Session {
  id: string
  agentId: string
  taskId: string | null   // Linked task (if spawned for a task)
  status: 'active' | 'idle' | 'completed' | 'error'
  model: string
  tokens: number
  cost: number
  startedAt: Date
  lastActivityAt: Date
}
```

---

## UI/UX Vision (from Mission Control reference)

**The core layout is a three-column dashboard that provides a comprehensive, at-a-glance view of the entire agent squad's operation.**

### Column 1: AGENTS
- **Purpose:** Roster of all available agents.
- **Content:**
  - Agent Avatar, Name, and Role (e.g., "Developer Agent", "Content Writer").
  - Current status with a colored dot/tag (e.g., WORKING, REVIEW, IDLE).
  - "LEAD" tag for designated squad leads.
  - A count of total active agents in the header.

### Column 2: MISSION QUEUE (Tasks)
- **Purpose:** A Kanban board for all tasks.
- **Content:**
  - Columns: `INBOX`, `ASSIGNED`, `IN PROGRESS`, `REVIEW`, `DONE`.
  - Each column header shows a count of tasks within it.
  - Task cards display:
    - Task Title.
    - Tags for categorization (e.g., `research`, `writing`, `code`).
    - Assigned agent's avatar.
    - Timestamp or progress indicator (e.g., "1 day ago").

### Column 3: LIVE FEED
- **Purpose:** A real-time, filterable stream of all agent activity.
- **Content:**
  - Filter tabs: `All`, `Tasks`, `Comments`, `Decisions`, `Status`.
  - Dropdown to filter by a specific agent.
  - Each feed item includes the agent's avatar, name, the action they took, and the subject of the action (e.g., "Quill commented on 'Write Customer Case Studies...'").
  - Relative timestamp ("about 2 hours ago").

### Header
- **Purpose:** High-level dashboard stats.
- **Content:**
  - `MISSION CONTROL` title.
  - Key metrics: `XX AGENTS ACTIVE`, `XX TASKS IN QUEUE`.
  - Quick links (e.g., `Docs`).
  - Current Time/Date and `ONLINE` status indicator.

### Aesthetic
- **Theme:** Light, clean, minimalist, professional.
- **Density:** Data-rich but not cluttered, using whitespace effectively.
- **Feel:** Like a professional project management tool (Linear, Asana) tailored specifically for orchestrating AI agents.

---

## Data Model (Bespoke, NOT Vikunja)
