# 🚀 Quick Start: Agent Collaboration

**Get your 67 agents working together NOW**

---

## What Just Happened?

Your agents went from:

```
❌ Siloed workers (each gets a task, works alone)
```

To:

```
✅ Collaborative team (debate together, reach consensus, implement aligned)
```

---

## 5-Minute Example

### Scenario: Design a User Profile System

**Before (The Old Way):**

1. You tell Backend: "Design the API"
2. Backend designs: `GET /user/{id}` returns everything
3. You tell Frontend: "Build the UI"
4. Frontend tries to use API, finds it's too slow
5. You tell Backend: "Optimize it"
6. Backend redesigns with selective fields
7. Everyone reworks 🤦

**After (The New Way):**

1. Backend + Frontend + Security sit down (virtually)
2. They discuss:
   - Backend: "What fields does Frontend need?"
   - Frontend: "I need name, avatar, profile but NOT full history"
   - Security: "Don't expose internal IDs, use opaque UUIDs"
3. **Consensus:** API returns name+avatar+profile, caches result
4. Everyone builds the same design, first time ✅

---

## How to Use It

### Option 1: Simple Python/Node Script

```typescript
import { callGateway } from "./src/gateway/call.js";

// Step 1: Start a team debate
const debate = await callGateway({
  method: "collab.session.init",
  params: {
    topic: "User Profile System Design",
    agents: ["backend-architect", "frontend-architect", "security-engineer"],
    moderator: "cto",
  },
});

console.log("Debate started:", debate.sessionKey);

// Step 2: Backend publishes first proposal
await callGateway({
  method: "collab.proposal.publish",
  params: {
    sessionKey: debate.sessionKey,
    agentId: "backend-architect",
    decisionTopic: "Profile API Fields",
    proposal: "GET /users/{id} returns all fields (name, email, profile, history, settings)",
    reasoning: "Keep API simple, let clients filter",
  },
});

// Step 3: Security challenges
await callGateway({
  method: "collab.proposal.challenge",
  params: {
    sessionKey: debate.sessionKey,
    decisionId: "...", // from previous response
    agentId: "security-engineer",
    challenge: "Exposing all fields is security risk",
    suggestedAlternative: "Split into /profile (public) and /settings (private)",
  },
});

// Step 4: Backend agrees and updates
await callGateway({
  method: "collab.proposal.publish",
  params: {
    sessionKey: debate.sessionKey,
    agentId: "backend-architect",
    decisionTopic: "Profile API Fields",
    proposal: "Two endpoints: /profile (name, avatar) and /settings (private, requires auth)",
    reasoning: "Incorporates security feedback",
  },
});

// Step 5: Everyone agrees
await callGateway({
  method: "collab.proposal.agree",
  params: {
    sessionKey: debate.sessionKey,
    decisionId: "...",
    agentId: "frontend-architect",
  },
});

// Step 6: CTO finalizes
await callGateway({
  method: "collab.decision.finalize",
  params: {
    sessionKey: debate.sessionKey,
    decisionId: "...",
    finalDecision:
      "Two endpoints: GET /profile (public, no auth) and GET /settings (private, requires auth)",
    moderatorId: "cto",
  },
});
```

### Option 2: Using the Orchestrator (Recommended)

```typescript
import { createAgentOrchestrator } from "./src/agents/agent-orchestrator.js";

const orchestrator = createAgentOrchestrator();

// Start team debate
const sessionKey = await orchestrator.startTeamDebate({
  topic: "User Profile System Design",
  agents: [
    { id: "backend-architect", role: "Backend", expertise: "API design" },
    { id: "frontend-architect", role: "Frontend", expertise: "UX" },
    { id: "security-engineer", role: "Security", expertise: "Security" },
  ],
  moderator: { id: "cto", role: "CTO" },
  context: "Design user profile system for web + mobile",
});

// After debate completes...

// Get all decisions
const decisions = await orchestrator.getDebateDecisions(sessionKey);

// Spawn implementation with full context
sessions_spawn({
  task: `Implement User Profile based on team design:
  
DESIGN (Consensus):
${decisions[0].consensus.finalDecision}

BUILD THE API:
- POST /profile endpoint
- GET /settings endpoint  
- Implement auth for /settings
  `,
  agentId: "backend-architect",
  label: "Profile API Implementation",
});
```

---

## Real-World Patterns

### Pattern A: Pre-Implementation Review (15 mins)

```
User: "I need OAuth2 for this app"
  ↓
orchestrator.startTeamDebate({
  agents: [Backend, Frontend, Security, Database]
})
  ↓
[Agents debate for 3-5 rounds]
  ↓
User gets: Design doc + consensus
  ↓
Builder implements (knows exactly what to do)
```

### Pattern B: Fix Complex Issues (30 mins)

```
User: "Users can't log in on mobile"
  ↓
orchestrator.startTeamDebate({
  agents: [Backend, Frontend-Mobile, Security, Database]
  topic: "Mobile OAuth2 Issue"
})
  ↓
[Team debates root cause]
  ↓
User gets: RCA + agreed solution
  ↓
Builders implement fix
```

### Pattern C: Technology Decision (1 hour)

```
User: "Choose our database"
  ↓
orchestrator.startTeamDebate({
  agents: [Backend, Database, DevOps, DataEngineer],
  topic: "Database Selection for Analytics"
})
  ↓
[Full debate of options]
  ↓
User gets: Decision matrix + consensus choice
  ↓
Team implements new architecture
```

---

## Key Concepts

### Collaborative Session

Container for a debate with:

- `topic`: What are we discussing?
- `members`: Which agents participate?
- `moderator`: Who finalizes decisions?
- `decisions`: What did we decide?
- `messages`: Full discussion thread

### Decision Flow

```
proposal → challenge → revised → agreement → finalized
   ↓         ↓          ↓         ↓          ↓
Backend   Security   Backend   Frontend   CTO
publishes questions  updates    agrees   confirms
```

### What Gets Documented

Everything:

```
✅ Each agent's perspective
✅ Challenges raised
✅ How proposals evolved
✅ Who agreed/disagreed
✅ Final consensus
✅ Moderator confirmation
```

---

## Your 67 Agents Can Now

| Capability            | Before | Now |
| --------------------- | ------ | --- |
| Work in isolation     | ✅     | ✅  |
| Communicate           | ❌     | ✅  |
| Debate ideas          | ❌     | ✅  |
| Reach consensus       | ❌     | ✅  |
| Document decisions    | ❌     | ✅  |
| Build aligned to plan | ❌     | ✅  |

---

## Testing It

### Run the demo:

```bash
pnpm run demo:collab
```

This shows:

- Team debate initialization
- Multiple rounds of proposals/challenges
- Consensus formation
- Implementation spawning

### Try it yourself:

```bash
# In your OpenClaw session or script
const result = await callGateway({
  method: "collab.session.init",
  params: {
    topic: "Test Collaboration",
    agents: ["backend-architect", "frontend-architect"],
    moderator: "cto"
  }
});
```

---

## Common Use Cases

### Use Case 1: Feature Design Review

**Who:** Product + Backend + Frontend + Design
**Time:** 20 mins
**Output:** Approved design document
**Benefit:** No "design by committee" chaos, structured consensus

### Use Case 2: Architecture Decision

**Who:** All architects + relevant specialists
**Time:** 30-60 mins
**Output:** Technology decision with trade-offs documented
**Benefit:** Everyone understands why decision was made

### Use Case 3: Security Review

**Who:** Security + Backend + Frontend + DevOps
**Time:** 30 mins
**Output:** Security checklist for implementation
**Benefit:** Security concerns addressed upfront, not after build

### Use Case 4: Performance Optimization

**Who:** Backend + Database + Performance + DevOps
**Time:** 30 mins
**Output:** Optimization plan with targets
**Benefit:** Coordinated optimization, not random guessing

### Use Case 5: Incident RCA

**Who:** Who was involved + on-call + architects
**Time:** 15 mins
**Output:** Root cause consensus + prevention plan
**Benefit:** Team alignment on lesson learned

---

## Next Steps

1. **Today:** Try `collab.session.init` with 2-3 agents
2. **Tomorrow:** Run a full debate on a real design question
3. **This week:** Integrate into your workflow for all major decisions
4. **Next week:** Build team reputation tracking (who proposes good ideas)

---

## What Changed in the Code?

**New Files:**

- `src/gateway/server-methods/collaboration.ts` - Core collaboration API
- `src/agents/agent-orchestrator.ts` - High-level orchestration
- `src/scripts/demo-agent-collaboration.ts` - Demo script
- `AGENT_COLLABORATION.md` - Full documentation

**Modified Files:**

- `src/gateway/server-methods.ts` - Registered collaboration handlers

**Total:** 1400+ lines of new collaboration infrastructure

---

## Questions?

Refer to:

- `AGENT_COLLABORATION.md` - Full architecture & examples
- `src/gateway/server-methods/collaboration.ts` - API implementation
- `src/agents/agent-orchestrator.ts` - Orchestrator patterns

Your agents are now ready to **collaborate, debate, and decide together**. 🚀
