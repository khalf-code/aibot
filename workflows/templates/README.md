# Workflow Templates

Pre-built n8n workflow templates for common business automation patterns. Each template is a complete workflow JSON file that can be imported into the embedded n8n editor or deployed via the Clawdbot dashboard.

## Directory Structure

```
workflows/templates/
  sales/
    lead-intake.json       Lead capture, enrichment, scoring, CRM push
  support/
    ticket-triage.json     Ticket classification, routing, SLA escalation
  finance/
    invoice-processing.json  Invoice parsing, PO matching, approval, posting
```

## Template Format

Each template is a standard n8n workflow JSON file with additional metadata fields:

| Field         | Type   | Description                                          |
| ------------- | ------ | ---------------------------------------------------- |
| `name`        | string | Human-readable template name                         |
| `description` | string | What the template automates                          |
| `area`        | string | Business area (`sales`, `support`, `finance`, `ops`) |
| `version`     | string | Semver version of the template                       |
| `nodes`       | array  | n8n node definitions                                 |
| `connections` | object | n8n connection map                                   |
| `settings`    | object | n8n workflow settings                                |

## Clawdbot Custom Nodes

Templates may use nodes from the `n8n-nodes-clawdbot` package:

- **clawdbotSkill** -- invoke a registered Clawdbot skill by name
- **clawdbotApprovalGate** -- pause for human approval via the dashboard
- **clawdbotArtifact** -- store a file, screenshot, or transcript as a run artifact

These nodes are automatically available when n8n runs inside the Clawdbot Docker stack.

## Deploying a Template

### From the Dashboard

1. Open the Clawdbot dashboard
2. Navigate to Workflows
3. Click "New from Template"
4. Select the template and click "Deploy"

### Via the CLI

```bash
openclaw workflows deploy --template workflows/templates/sales/lead-intake.json
```

### Via the n8n API

```bash
curl -X POST http://localhost:8080/workflows/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @workflows/templates/sales/lead-intake.json
```

## Customising Templates

Templates are starting points. After deploying:

1. Open the workflow in the n8n editor
2. Update webhook URLs, API endpoints, and credentials
3. Adjust branching conditions and approval roles to match your org
4. Test with dry-run mode before enabling triggers

## Adding a New Template

1. Create the workflow in the n8n editor
2. Export it as JSON (Workflow menu > Download)
3. Add the metadata fields (`name`, `description`, `area`, `version`)
4. Place the file in the appropriate subdirectory
5. Test with `openclaw workflows dry-run --template <path>`

## Related Docs

- [Workflows Guide](/clawdbot/workflows/guide)
- [Embedded n8n Setup](/clawdbot/workflows/embedded-n8n-setup)
- [Template Library](/clawdbot/workflows/template-library)
