# Support Runbooks — Business Skill Packs

Runbooks for all Support workflows in the Clawdbot Business Skill Packs.

Covers:

- BIZ-057 (#147) Ticket triage and routing docs + runbook
- BIZ-060 (#150) Auto-response drafting docs + runbook
- BIZ-063 (#153) SLA escalation alert docs + runbook

---

## Ticket Triage and Routing

**Workflow ID:** `support-ticket-triage`
**Trigger:** Event-driven (new ticket created) or scheduled batch
**Approval gate:** Support lead (for low-confidence routing decisions)

### Overview

Analyses incoming support tickets using NLP to determine priority, category, and optimal routing. Routes high-confidence tickets automatically and pauses for support lead approval on low-confidence decisions. Updates triage metrics after routing.

### Prerequisites

- Helpdesk system integration configured (e.g. Zendesk, Intercom, Freshdesk)
- NLP/AI model for ticket analysis available
- Team/queue routing rules defined (category-to-team mapping)
- Agent notification channel configured
- Auto-route confidence threshold configured (e.g. 0.85)

### Steps

1. **Fetch new tickets** -- Pull unprocessed tickets from the helpdesk system (batch or event-driven).
2. **Analyse content** -- Run NLP analysis on ticket subject and body to extract intent, sentiment, and topic.
3. **Detect priority** -- Classify the ticket priority (low, normal, high, urgent) based on content analysis and customer tier.
4. **Categorise ticket** -- Assign a category (billing, technical, feature request, account, etc.) based on intent detection.
5. **Propose routing** -- Select the target team/queue and optionally a specific agent based on category, priority, and agent workload.
6. **Approval gate** -- For tickets below the auto-route confidence threshold, pause for support lead review. Above-threshold tickets are auto-routed.
7. **Route tickets** -- Apply the approved routing: assign to team/queue and optionally to a specific agent.
8. **Notify agents** -- Send notifications to assigned agents or team channels about new ticket assignments.
9. **Update metrics** -- Record triage decisions, routing confidence, and processing time for analytics.

### Failure handling

- Helpdesk API failures are retried 3 times with exponential backoff.
- NLP analysis failures fall back to rule-based categorisation (keyword matching).
- Routing failures (agent not found, queue full) escalate to the support lead.

### Rollback

- Routed tickets can be reassigned manually in the helpdesk system. The workflow logs all routing decisions for audit.

---

## Auto-Response Drafting

**Workflow ID:** `support-auto-response`
**Trigger:** Event-driven (ticket categorised as auto-respondable) or scheduled batch
**Approval gate:** Support agent

### Overview

Generates draft responses for common support queries using the knowledge base and historical resolutions. Scores each draft's confidence and pauses for agent approval on responses below the auto-send threshold. Tracks whether the response resolved the customer's issue.

### Prerequisites

- Knowledge base integration configured (help centre, documentation site, or internal wiki)
- Historical resolution data available (past tickets and their successful responses)
- AI response generation model configured
- Brand voice/tone guidelines for support responses documented
- Auto-send confidence threshold configured (e.g. 0.90)

### Steps

1. **Fetch tickets for response** -- Identify tickets eligible for auto-response (common categories, no prior response, not escalated).
2. **Search knowledge base** -- Query the knowledge base for articles relevant to each ticket's topic.
3. **Generate draft** -- Use AI to compose a response referencing relevant KB articles, following brand tone guidelines.
4. **Score confidence** -- Evaluate the generated response's relevance and completeness. Assign a confidence score.
5. **Approval gate** -- For drafts below the auto-send threshold, pause for agent review. Above-threshold drafts are sent automatically.
6. **Send responses** -- Deliver approved responses to customers via the helpdesk system.
7. **Track resolution** -- Monitor ticket status after response. If the customer replies or reopens, flag for human follow-up.
8. **Notify agents** -- Alert agents about sent auto-responses and any that need follow-up.

### Failure handling

- Knowledge base search failures fall back to generic response templates.
- Response generation failures skip the ticket and flag it for manual response.
- Helpdesk send failures are retried once; persistent failures are logged and the agent is notified.

### Rollback

- Sent responses cannot be retracted from the customer, but the agent can send a follow-up correction. The workflow logs all sent responses for review.

---

## SLA Escalation Alert

**Workflow ID:** `support-sla-escalation`
**Trigger:** Scheduled (every 15 minutes or configurable) or manual
**Approval gate:** Support manager

### Overview

Monitors open tickets against SLA targets, identifies tickets that are at risk of breaching or have already breached their SLA, and proposes escalation actions. Pauses for support manager approval before executing escalation actions (reassignment, on-call page, priority bump).

### Prerequisites

- SLA targets defined per customer tier and ticket priority
- Helpdesk system integration with SLA tracking
- On-call rotation configured
- Escalation action scripts/integrations available
- SLA dashboard for real-time visibility

### Steps

1. **Fetch open tickets** -- Pull all open tickets from the helpdesk system with their creation time and current assignment.
2. **Check SLA targets** -- Look up the SLA response/resolution target for each ticket based on priority and customer tier.
3. **Identify breaches** -- Flag tickets that have breached their SLA target or are within the at-risk threshold.
4. **Calculate severity** -- Classify each flagged ticket as "at risk", "breached", or "critical breach" based on elapsed time.
5. **Propose escalations** -- For each flagged ticket, propose an escalation action (reassign, page on-call, bump priority, notify account manager).
6. **Approval gate** -- Pause for support manager review. The manager sees all flagged tickets, their severity, and proposed actions.
7. **Execute escalations** -- Apply approved actions: reassign tickets, send pages, update priorities in the helpdesk.
8. **Notify managers** -- Send an escalation summary to the support management channel.
9. **Update SLA dashboard** -- Refresh the SLA dashboard with current breach/at-risk counts and actions taken.

### Failure handling

- Helpdesk API failures are retried 3 times. If the helpdesk is unavailable, the workflow pages the on-call team directly.
- On-call paging failures fall back to secondary notification channels (email, SMS).
- Dashboard update failures are logged but do not block escalation actions.

### Rollback

- Escalation actions (reassignment, priority changes) can be reverted manually in the helpdesk. The workflow logs all actions for audit and rollback.
