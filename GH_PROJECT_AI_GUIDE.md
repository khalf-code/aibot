# GH_PROJECT_AI_GUIDE.md

This document provides guidance for AI assistants (Claude Code) on working with GitHub Projects, creating issues, managing relationships, and following best practices for project management.

## Table of Contents

- [Overview](#overview)
- [Finding GitHub Projects](#finding-github-projects)
- [Discovering Project Structure](#discovering-project-structure)
- [Working with Labels](#working-with-labels)
- [Understanding Project Fields](#understanding-project-fields)
- [Creating Issues: The Process](#creating-issues-the-process)
- [Issue Relationships](#issue-relationships)
- [Issue Detail Requirements](#issue-detail-requirements)
- [Task Templates](#task-templates)
- [Important Distinctions](#important-distinctions)
- [Common Commands Reference](#common-commands-reference)

---

## Overview

When asked to create GitHub issues or work with GitHub Projects, follow a structured approach:

1. **Review code first** - Always understand the current implementation
2. **Create comprehensive tasks** - Not the fixes themselves
3. **Link relationships** - Establish parent-child hierarchies and blocking relationships
4. **Add metadata** - Labels, priorities, sizes, and other fields
5. **Provide context** - Include file paths, line numbers, and code references

**Key principle**: Create well-documented tasks for engineers to execute, not implement the changes directly (unless explicitly asked).

---

## Finding GitHub Projects

### Discover Available Projects

```bash
# List projects in an organization
gh project list --owner <org-name>
```

**Example Output**:

```
NUMBER  TITLE           STATE   ID
2       DevOps          open    PVT_kwDOCBMiBs4BGAwY
1       Engineering     open    PVT_kwDOCBMiBs4BFpB9
```

**Capture the project number for subsequent commands**:

```bash
PROJECT_NUMBER=2  # The project you want to work with
ORG_NAME="YourOrg"
```

### Get Project ID Programmatically

The Project ID (starting with `PVT_`) is needed for GraphQL API operations:

```bash
# Extract project ID from list output
PROJECT_ID=$(gh project list --owner "$ORG_NAME" --format json | \
  jq -r ".projects[] | select(.number == $PROJECT_NUMBER) | .id")

echo "Project ID: $PROJECT_ID"
# Output: Project ID: PVT_kwDOCBMiBs4BGAwY
```

---

## Discovering Project Structure

### List All Project Fields

```bash
# Basic list
gh project field-list $PROJECT_NUMBER --owner $ORG_NAME

# JSON format for programmatic access
gh project field-list $PROJECT_NUMBER --owner $ORG_NAME --format json
```

**Example Output**:

```
NAME                  TYPE                           ID
Title                 ProjectV2Field                 PVTF_...
Status                ProjectV2SingleSelectField     PVTSSF_...
Priority              ProjectV2SingleSelectField     PVTSSF_...
Size                  ProjectV2SingleSelectField     PVTSSF_...
Parent issue          ProjectV2Field                 PVTF_...
Labels                ProjectV2Field                 PVTF_...
```

### Extract Specific Field Details

For single-select fields (like Priority, Size, Status), you need both the field ID and option IDs:

```bash
# Get Priority field details
gh project field-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
  jq '.fields[] | select(.name == "Priority")'
```

**Example Output**:

```json
{
  "id": "PVTSSF_lADOCBMiBs4BGAwYzg3LooI",
  "name": "Priority",
  "options": [
    { "id": "97d00555", "name": "P0" },
    { "id": "932e33ae", "name": "P1" },
    { "id": "b2f94673", "name": "P2" }
  ],
  "type": "ProjectV2SingleSelectField"
}
```

**Capture field ID and option IDs**:

```bash
# Get Priority field ID
PRIORITY_FIELD_ID=$(gh project field-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
  jq -r '.fields[] | select(.name == "Priority") | .id')

# Get P1 option ID
P1_OPTION_ID=$(gh project field-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
  jq -r '.fields[] | select(.name == "Priority") | .options[] | select(.name == "P1") | .id')

echo "Priority Field ID: $PRIORITY_FIELD_ID"
echo "P1 Option ID: $P1_OPTION_ID"
```

### Common Project Fields

| Field Name          | Type          | Typical Values          | Purpose                |
| ------------------- | ------------- | ----------------------- | ---------------------- |
| Status              | Single Select | Todo, In Progress, Done | Track work state       |
| Priority            | Single Select | P0, P1, P2              | Urgency level          |
| Size                | Single Select | XS, S, M, L, XL         | Effort estimate        |
| Parent issue        | Reference     | Issue link              | Hierarchical structure |
| Sub-issues progress | Calculated    | Auto (e.g., "2/4")      | Progress tracking      |
| Assignees           | Multi-select  | User list               | Ownership              |
| Labels              | Multi-select  | Label list              | Categorization         |
| Iteration           | Iteration     | Sprint name             | Time boxing            |

---

## Working with Labels

### Discover Existing Labels

```bash
gh label list
```

**Example Output**:

```
NAME              DESCRIPTION                     COLOR
bug               Something isn't working         #d73a4a
enhancement       New feature or request          #a2eeef
documentation     Improvements to docs            #0075ca
```

### Create Labels

```bash
gh label create "<label-name>" \
  --description "<description>" \
  --color "<hex-color-without-hash>"
```

**Examples**:

```bash
# Infrastructure-related labels
gh label create "infrastructure" \
  --description "Infrastructure changes" \
  --color "D4C5F9"

gh label create "breaking-change" \
  --description "Breaking change requiring coordination" \
  --color "D93F0B"

# Component-specific labels
gh label create "backend" \
  --description "Backend service changes" \
  --color "0E8A16"

gh label create "frontend" \
  --description "Frontend application changes" \
  --color "1D76DB"
```

### Apply Labels to Issues

```bash
# Single label
gh issue edit <issue-number> --add-label "<label-name>"

# Multiple labels (comma-separated, no spaces)
gh issue edit <issue-number> --add-label "label1,label2,label3"
```

**Example**:

```bash
gh issue edit 1 --add-label "Epic,infrastructure,breaking-change"
```

### Label Selection Guidelines

Consider these dimensions when selecting labels:

- **Change type**: bug, enhancement, Epic, breaking-change
- **Component**: frontend, backend, database, infrastructure
- **Domain**: security, performance, documentation
- **Impact**: breaking-change, help wanted, good first issue
- **Status**: blocked, waiting-for-review

---

## Understanding Project Fields

### Setting Project Fields via GraphQL API

#### Step 1: Get Project Item ID

When you add an issue to a project, it gets a unique item ID:

```bash
# List all items in the project
gh project item-list $PROJECT_NUMBER --owner $ORG_NAME --format json

# Extract specific issue's item ID
ISSUE_NUMBER=1
ITEM_ID=$(gh project item-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
  jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")

echo "Item ID for issue #$ISSUE_NUMBER: $ITEM_ID"
# Output: Item ID for issue #1: PVTI_lADOCBMiBs4BGAwYzggJlJM
```

#### Step 2: Set Single-Select Field (Priority, Size, Status)

```bash
# Set Priority to P1
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "'"$PROJECT_ID"'"
    itemId: "'"$ITEM_ID"'"
    fieldId: "'"$PRIORITY_FIELD_ID"'"
    value: { singleSelectOptionId: "'"$P1_OPTION_ID"'" }
  }) {
    projectV2Item {
      id
    }
  }
}'
```

#### Step 3: Set Multiple Fields at Once

```bash
# Get Size field and option IDs
SIZE_FIELD_ID=$(gh project field-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
  jq -r '.fields[] | select(.name == "Size") | .id')

SIZE_M_OPTION_ID=$(gh project field-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
  jq -r '.fields[] | select(.name == "Size") | .options[] | select(.name == "M") | .id')

# Set both Priority and Size in one mutation
gh api graphql -f query='
mutation {
  setPriority: updateProjectV2ItemFieldValue(input: {
    projectId: "'"$PROJECT_ID"'"
    itemId: "'"$ITEM_ID"'"
    fieldId: "'"$PRIORITY_FIELD_ID"'"
    value: { singleSelectOptionId: "'"$P1_OPTION_ID"'" }
  }) {
    projectV2Item { id }
  }

  setSize: updateProjectV2ItemFieldValue(input: {
    projectId: "'"$PROJECT_ID"'"
    itemId: "'"$ITEM_ID"'"
    fieldId: "'"$SIZE_FIELD_ID"'"
    value: { singleSelectOptionId: "'"$SIZE_M_OPTION_ID"'" }
  }) {
    projectV2Item { id }
  }
}'
```

### Moving Issues Through Project Status

When updating an issue's status in a project (e.g., moving from "In Progress" to "Done"), you need to update the Status field value.

#### Step 1: Get Project Item ID for an Existing Issue

If the issue is already in the project, get its project item ID:

```bash
# Method 1: Using GraphQL API (most reliable)
gh api graphql -f query='
query {
  repository(owner: "ORG_NAME", name: "REPO_NAME") {
    issue(number: ISSUE_NUMBER) {
      projectItems(first: 5) {
        nodes {
          id
          project {
            id
            title
          }
        }
      }
    }
  }
}' --jq '.data.repository.issue.projectItems.nodes[]'

# Example output:
# {
#   "id": "PVTI_lADOCBMiBs4BGAwYzggJlMc",
#   "project": {
#     "id": "PVT_kwDOCBMiBs4BGAwY",
#     "title": "DevOps"
#   }
# }

# Capture the IDs
ITEM_ID="PVTI_lADOCBMiBs4BGAwYzggJlMc"
PROJECT_ID="PVT_kwDOCBMiBs4BGAwY"
```

**Alternative**: If you have the project number, use `gh project item-list`:

```bash
# List all items and filter for your issue
ITEM_ID=$(gh project item-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
  jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
```

#### Step 2: Get Status Field and Option IDs

```bash
# Get the Status field configuration
gh api graphql -f query='
query {
  node(id: "'"$PROJECT_ID"'") {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field {
            id
            name
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}' --jq '.data.node.fields.nodes[] | select(.name == "Status")'

# Example output:
# {
#   "id": "PVTSSF_lADOCBMiBs4BGAwYzg3Loks",
#   "name": "Status",
#   "options": [
#     {"id": "f75ad846", "name": "Todo"},
#     {"id": "47fc9ee4", "name": "In Progress"},
#     {"id": "98236657", "name": "Done"}
#   ]
# }

# Capture the IDs
STATUS_FIELD_ID="PVTSSF_lADOCBMiBs4BGAwYzg3Loks"
DONE_OPTION_ID="98236657"  # The "Done" status
```

#### Step 3: Update Status Field

```bash
# Move issue to "Done"
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "'"$PROJECT_ID"'"
      itemId: "'"$ITEM_ID"'"
      fieldId: "'"$STATUS_FIELD_ID"'"
      value: {
        singleSelectOptionId: "'"$DONE_OPTION_ID"'"
      }
    }
  ) {
    projectV2Item {
      id
    }
  }
}'

# Success output:
# {"data":{"updateProjectV2ItemFieldValue":{"projectV2Item":{"id":"PVTI_..."}}}}
```

#### Common Status Transitions

```bash
# Move to "In Progress"
IN_PROGRESS_OPTION_ID="47fc9ee4"
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "'"$PROJECT_ID"'"
      itemId: "'"$ITEM_ID"'"
      fieldId: "'"$STATUS_FIELD_ID"'"
      value: { singleSelectOptionId: "'"$IN_PROGRESS_OPTION_ID"'" }
    }
  ) {
    projectV2Item { id }
  }
}'

# Move back to "Todo"
TODO_OPTION_ID="f75ad846"
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "'"$PROJECT_ID"'"
      itemId: "'"$ITEM_ID"'"
      fieldId: "'"$STATUS_FIELD_ID"'"
      value: { singleSelectOptionId: "'"$TODO_OPTION_ID"'" }
    }
  ) {
    projectV2Item { id }
  }
}'
```

#### Troubleshooting Status Updates

**Error: `gh project item-edit` doesn't support `--owner` flag**

- The `gh project item-edit` command has limited functionality
- Use the GraphQL API method shown above instead
- The CLI doesn't properly support updating project fields for organization projects

**Error: Field ID or Option ID not found**

- Verify you're using the correct project ID (starts with `PVT_`)
- Ensure the field name matches exactly (case-sensitive: "Status" not "status")
- Check option names match exactly (case-sensitive: "Done" not "done")

**Error: Item not in project**

- Verify the issue is actually in the project: `gh issue view <number> --json projectItems`
- Add it first: `gh project item-add $PROJECT_NUMBER --owner $ORG_NAME --url <issue-url>`

**Changes not visible immediately**

- Project UI may take a few seconds to reflect changes
- Refresh the browser if the change doesn't appear
- Check the GraphQL response for confirmation

### Field Value Guidelines

#### Size Estimation

| Size | Complexity | Examples                                             |
| ---- | ---------- | ---------------------------------------------------- |
| XS   | Trivial    | Config value change, typo fix                        |
| S    | Simple     | Single function update, simple script change         |
| M    | Moderate   | Multiple file changes, moderate testing              |
| L    | Large      | Cross-component changes, infrastructure coordination |
| XL   | Epic       | Multi-phase projects, architectural redesign         |

#### Priority Levels

| Priority | Urgency  | Examples                                             |
| -------- | -------- | ---------------------------------------------------- |
| P0       | Critical | Production outage, security vulnerability, data loss |
| P1       | High     | Breaking changes, feature delivery, significant bugs |
| P2       | Normal   | Technical debt, improvements, minor bugs             |

---

## Creating Issues: The Process

### Step 1: Review the Code

**ALWAYS review relevant code before creating issues** (unless explicitly told not to).

```bash
# Read implementation files
Read <path/to/file>

# Search for patterns
Glob "**/*<pattern>*"
Grep "<search-term>"

# Understand dependencies
Read <related-config-file>
```

### Step 2: Create the Main Issue (Epic)

For complex work, create a parent epic first:

```bash
gh issue create \
  --title "<Epic Title>" \
  --body "$(cat <<'EOF'
## Overview
[High-level description of the goal]

## Current State
### Current Implementation
- File: `path/to/current/file`
- Current behavior: [description]
- Current configuration: [key details]

## Target Architecture
[What needs to change and why]

## Implementation Strategy
### Phase 1: [Phase name]
1. [Step]
2. [Step]

### Phase 2: [Phase name]
1. [Step]
2. [Step]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Subtasks
- [ ] #<subtask-1>
- [ ] #<subtask-2>
- [ ] #<subtask-3>

## Related Files
- `path/to/file1`
- `path/to/file2`

## Notes
[Important context, risks, or considerations]
EOF
)"
```

**Capture the issue number**:

```bash
# GitHub CLI returns the URL
# Output: https://github.com/org/repo/issues/1
PARENT_ISSUE=1
```

### Step 3: Create Detailed Subtasks

Each subtask should be focused and actionable:

````bash
gh issue create \
  --title "<Specific Subtask Title>" \
  --body "$(cat <<'EOF'
## Parent Task
Part of #<parent-issue-number> - <parent title>

## Objective
[Clear, specific goal for this subtask]

## Current Implementation
**File**: `path/to/file`

**Current code** (lines X-Y):
```language
# Current implementation
````

## Required Changes

### 1. [Change Description]

**Before** (line X):

```language
# Current code
```

**After**:

```language
# New code
```

### 2. [Another Change]

[Details...]

## Testing Requirements

### Prerequisites

- [ ] [Prerequisite 1]
- [ ] [Prerequisite 2]

### Test Plan

1. [Test step with command]: ```bash

   <actual command to run>
   ```

2. [Verification step]: ```bash
   <verification command>
   ```

### Success Criteria

- [ ] [Specific success criterion]
- [ ] [Another criterion]

## Rollback Plan

If changes cause issues:

```bash
# Rollback command
```

## Related Files

- `path/to/file1`
- `path/to/file2`

## Notes

[Important context specific to this subtask]
EOF
)"

````

### Step 4: Add Issues to Project

```bash
# Add parent issue
gh project item-add $PROJECT_NUMBER --owner $ORG_NAME \
  --url https://github.com/$ORG_NAME/$REPO_NAME/issues/$PARENT_ISSUE

# Add subtasks
for ISSUE in 2 3 4 5; do
  gh project item-add $PROJECT_NUMBER --owner $ORG_NAME \
    --url https://github.com/$ORG_NAME/$REPO_NAME/issues/$ISSUE
done
````

### Step 5: Apply Labels

```bash
# Parent epic
gh issue edit $PARENT_ISSUE --add-label "Epic,infrastructure,breaking-change"

# Subtasks
gh issue edit 2 --add-label "backend,infrastructure"
gh issue edit 3 --add-label "frontend,enhancement"
gh issue edit 4 --add-label "infrastructure,breaking-change"
```

### Step 6: Set Project Fields

```bash
# Get item IDs for all issues
for ISSUE in $PARENT_ISSUE 2 3 4; do
  ITEM_ID=$(gh project item-list $PROJECT_NUMBER --owner $ORG_NAME --format json | \
    jq -r ".items[] | select(.content.number == $ISSUE) | .id")

  # Set appropriate priority and size
  # (See "Setting Project Fields via GraphQL API" section)
done
```

---

## Issue Relationships

GitHub supports multiple relationship types beyond parent-child hierarchies.

### Parent-Child Relationships (Sub-Issues)

Used for breaking epics into subtasks.

#### Get Issue Node IDs

```bash
# Get node ID for an issue (needed for relationship operations)
PARENT_NODE_ID=$(gh issue view $PARENT_ISSUE --json id -q .id)
CHILD_NODE_ID=$(gh issue view $CHILD_ISSUE --json id -q .id)

echo "Parent: $PARENT_NODE_ID"
echo "Child: $CHILD_NODE_ID"
# Output:
# Parent: I_kwDOP7O8Ts7S2yGu
# Child: I_kwDOP7O8Ts7S2ykn
```

#### Add Sub-Issue Relationship

```bash
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
mutation {
  addSubIssue(input: {
    issueId: "'"$PARENT_NODE_ID"'"
    subIssueId: "'"$CHILD_NODE_ID"'"
  }) {
    issue {
      title
    }
    subIssue {
      title
    }
  }
}'
```

**Example: Link Multiple Subtasks**:

```bash
PARENT_NODE_ID=$(gh issue view 1 --json id -q .id)

# Link issues 2, 3, 4, 5 as children of issue 1
for CHILD in 2 3 4 5; do
  CHILD_NODE_ID=$(gh issue view $CHILD --json id -q .id)

  gh api graphql -H "GraphQL-Features: sub_issues" -f query='
  mutation {
    addSubIssue(input: {
      issueId: "'"$PARENT_NODE_ID"'"
      subIssueId: "'"$CHILD_NODE_ID"'"
    }) {
      subIssue { number title }
    }
  }'
done
```

### Blocking Relationships

Use when one issue blocks progress on another.

**Note**: GitHub added native issue dependency support in August 2025. This feature is available via REST API and provides native "blocked by" and "blocking" relationships visible in the GitHub UI.

#### Create "Blocked By" Relationship

**Recommended Method: GitHub UI**

The most reliable way to set blocking relationships is through the GitHub web interface:

1. Open the blocked issue in GitHub
2. Click on the "Development" section in the right sidebar
3. Under "Relationships", click "Add dependency"
4. Select "Blocked by" and enter the blocking issue number
5. The relationship will appear in both issues

**Alternative: REST API (Recommended for Automation)**

GitHub's REST API provides issue dependency endpoints. The `issue_id` parameter requires the **global GitHub database ID** (`.id` field), not the issue number.

```bash
# Get the database ID of the blocking issue
BLOCKING_ISSUE_DB_ID=$(gh api repos/OWNER/REPO/issues/BLOCKING_ISSUE_NUMBER --jq .id)

# Add the blocking relationship
echo '{"issue_id":'$BLOCKING_ISSUE_DB_ID'}' | \
  gh api -X POST repos/OWNER/REPO/issues/BLOCKED_ISSUE_NUMBER/dependencies/blocked_by --input -

# Example: Issue #2 blocked by Issue #3
ISSUE_3_DB_ID=$(gh api repos/Glidance/omni/issues/3 --jq .id)
echo '{"issue_id":'$ISSUE_3_DB_ID'}' | \
  gh api -X POST repos/Glidance/omni/issues/2/dependencies/blocked_by --input -
```

**Important**:

- Use the `.id` field (large integer like `3538442134`), NOT the issue `.number` or `.node_id`
- The `--jq .id` extracts the correct database ID
- Do NOT pass issue numbers directly (1, 2, 3) - they will resolve to random issues across GitHub

**How to get the database ID**:

```bash
# Get database ID for issue #5
gh api repos/OWNER/REPO/issues/5 --jq .id
# Returns: 3538471204 (example)

# Or get multiple IDs at once
gh api repos/OWNER/REPO/issues/5 | jq '{number: .number, id: .id, node_id: .node_id}'
```

#### List Blocking Dependencies

```bash
# List all issues that block a specific issue
gh api repos/OWNER/REPO/issues/ISSUE_NUMBER/dependencies/blocked_by

# Example: See what blocks issue #6
gh api repos/Glidance/omni/issues/6/dependencies/blocked_by
```

#### Remove Blocking Dependency

```bash
# Remove a blocking relationship
gh api -X DELETE repos/OWNER/REPO/issues/BLOCKED_ISSUE_NUMBER/dependencies/blocked_by/BLOCKING_ISSUE_ID

# Example: Remove issue #3 from blocking issue #6
ISSUE_3_ID=$(gh api repos/Glidance/omni/issues/3 --jq .id)
gh api -X DELETE repos/Glidance/omni/issues/6/dependencies/blocked_by/$ISSUE_3_ID
```

#### Verify Dependency Status

```bash
# Check dependency summary for an issue
gh api repos/OWNER/REPO/issues/ISSUE_NUMBER | jq '.issue_dependencies_summary'

# Example output:
# {
#   "blocked_by": 0,           # Currently blocked by count
#   "total_blocked_by": 3,     # Total blocking issues
#   "blocking": 0,             # Currently blocking count
#   "total_blocking": 1        # Total issues this blocks
# }
```

#### Batch Add Blocking Relationships

```bash
# Add multiple blocking issues at once
# Example: Issue #6 is blocked by issues #1, #2, #3, #9

for BLOCKING_ISSUE in 1 2 3 9; do
  echo "{\"issue_id\":$BLOCKING_ISSUE}" | \
    gh api -X POST repos/Glidance/omni/issues/6/dependencies/blocked_by --input -
done
```

#### Troubleshooting

**Error: "Invalid property /issue_id: `"3"` is not of type `integer`"**

- Cause: Using `-f` flag which quotes values as strings
- Solution: Use `--input -` with JSON: `echo '{"issue_id":3}' | gh api ... --input -`

**Error: "The provided blocking issue does not exist" (404)**

- Cause: Issue number doesn't exist or is in a different repository
- Solution: Verify issue exists in same repo: `gh issue view ISSUE_NUM --repo OWNER/REPO`

**Error: "Not Found" (404)**

- Cause: Feature may not be enabled for repository or insufficient permissions
- Solution: Verify repository has issue dependencies enabled, check permissions

#### Fallback: Comments and Labels

If the REST API doesn't work (permissions, feature not enabled, etc.), use comments and labels:

```bash
# Add comment and label to indicate blocking relationship
gh issue comment $ISSUE_A --body "Blocked by #$ISSUE_B"
gh issue edit $ISSUE_A --add-label "blocked"
```

#### Track Blocking in Project Fields

Some projects have custom "Blocked By" fields. Check field list:

```bash
gh project field-list $PROJECT_NUMBER --owner $ORG_NAME | grep -i block
```

If a "Blocked By" field exists, set it via GraphQL (syntax varies by field type).

### Related/Depends-On Relationships

For looser relationships between issues:

```bash
# Add to issue description
gh issue edit $ISSUE_A --body "$(cat <<EOF
## Related Issues
- Depends on: #$ISSUE_B
- Related to: #$ISSUE_C
- See also: #$ISSUE_D

[Rest of issue body]
EOF
)"
```

### Cross-Repository Relationships

Reference issues across repositories:

```bash
# In issue body or comments
"Blocked by OrgName/other-repo#123"
"Depends on OrgName/infrastructure#45"
```

### Relationship Best Practices

1. **Parent-Child**: Use for breaking work into logical subtasks
   - One parent, multiple children
   - Parent tracks overall progress
   - Children are independently completable

2. **Blocked By**: Use when work cannot proceed
   - Add "blocked" label for visibility
   - Update description with blocking reason
   - Remove label when unblocked

3. **Related/Depends**: Use for context and coordination
   - Helps engineers understand broader context
   - Useful for cross-team coordination
   - Can be one-way or bi-directional

4. **Documentation**: Always document WHY relationships exist
   - Why is it blocked? What's the dependency?
   - What happens when the blocker is resolved?

---

## Issue Detail Requirements

### Essential Components

Every issue should include:

#### 1. File References with Line Numbers

````markdown
**File**: `src/services/api.ts`
**Function**: `processData()` (lines 45-67)
**Current implementation**:

```typescript
function processData(input: string): Result {
  // Current logic
}
```
````

````

#### 2. Before/After Examples
```markdown
### Change Required

**Before** (line 52):
```typescript
const timeout = 30000; // 30 seconds
````

**After**:

```typescript
const timeout = 60000; // 60 seconds - increased for large files
```

````

#### 3. Executable Test Commands
```markdown
## Testing

1. Run unit tests:
   ```bash
   npm test -- --grep "processData"
````

2. Manual verification:

   ```bash
   curl -X POST http://localhost:3000/api/process \
     -H "Content-Type: application/json" \
     -d '{"data": "test"}'
   ```

3. Expected output:
   ```json
   { "status": "success", "processed": true }
   ```

````

#### 4. Success Criteria Checklist
```markdown
## Success Criteria
- [ ] All unit tests pass
- [ ] Integration test covers new timeout scenario
- [ ] No regression in existing functionality
- [ ] Documentation updated in README.md
- [ ] Code review approved
````

#### 5. Rollback Instructions

````markdown
## Rollback Plan

If deployment causes issues:

1. Revert the commit:
   ```bash
   git revert <commit-sha>
   git push origin main
   ```
````

2. Or roll back to previous version:

   ```bash
   git reset --hard <previous-commit>
   git push --force origin main
   ```

3. Verify service health:
   ```bash
   curl http://localhost:3000/health
   ```

````

#### 6. Prerequisites and Dependencies
```markdown
## Prerequisites

**Must complete before starting**:
- [ ] Issue #42 merged (database migration)
- [ ] Infrastructure ticket INF-123 deployed
- [ ] Stakeholder approval received

**Required access**:
- [ ] Production deployment permissions
- [ ] AWS console access (if needed)
````

---

## Task Templates

GitHub supports issue templates for consistency.

### Template Location

`.github/ISSUE_TEMPLATE/`

### Example: Feature Request Template

**File**: `.github/ISSUE_TEMPLATE/feature_request.md`

```markdown
---
name: Feature Request
about: Propose a new feature
title: "[FEATURE] "
labels: "enhancement"
assignees: ""
---

## Problem Statement

<!-- What problem does this solve? -->

## Proposed Solution

<!-- How would this feature work? -->

## Alternatives Considered

<!-- What other approaches did you consider? -->

## Implementation Notes

<!-- Technical considerations -->

## Success Criteria

- [ ]
- [ ]

## Related Issues

<!-- Links to related issues -->
```

### Example: Bug Report Template

**File**: `.github/ISSUE_TEMPLATE/bug_report.md`

```markdown
---
name: Bug Report
about: Report a bug
title: "[BUG] "
labels: "bug"
assignees: ""
---

## Description

<!-- Clear description of the bug -->

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

<!-- What should happen? -->

## Actual Behavior

<!-- What actually happens? -->

## Environment

- OS:
- Version:
- Browser (if applicable):

## Logs/Screenshots

<!-- Paste relevant logs or screenshots -->

## Possible Fix

<!-- If you have ideas on how to fix this -->
```

### Using Templates

```bash
# Interactive creation with template selection
gh issue create

# Programmatic with template
gh issue create --template feature_request.md \
  --title "[FEATURE] Add dark mode" \
  --label "enhancement,frontend"
```

---

## Important Distinctions

### "Create Tasks" vs "Implement Changes"

#### When User Says: "Create tasks for X"

- ✅ Review code to understand current state
- ✅ Create comprehensive issue descriptions
- ✅ Include file paths, line numbers, before/after examples
- ✅ Provide testing and rollback instructions
- ❌ **DO NOT** modify files (no Edit/Write tools)
- ❌ **DO NOT** commit changes
- ❌ **DO NOT** create pull requests

#### When User Says: "Implement X" or "Fix X"

- ✅ Review code
- ✅ Apply changes using Edit/Write tools
- ✅ Test changes
- ✅ Commit and push (if requested)
- ❌ **DO NOT** create issues unless explicitly asked

### "Review Code First" vs "Just Create the Issue"

#### Default Behavior: Review First

Unless told otherwise, **always review code** before creating issues:

```bash
Read <relevant-files>
Grep <patterns>
Glob <file-patterns>
```

This ensures issues have:

- Accurate file paths and line numbers
- Current implementation context
- Realistic scope estimates

#### Exception: User Provides Full Context

If user provides complete details:

```
"Create an issue titled 'Update API timeout' with body: [detailed body]"
```

Then create directly without code review.

### Issue Granularity

#### Too Broad (Bad)

```
Title: Fix the backend
Body: The backend has some issues that need fixing.
```

#### Too Narrow (Bad)

```
Title: Change line 42 in api.ts from 30000 to 60000
Body: Update the timeout value.
```

#### Just Right (Good)

```
Title: Increase API timeout for large file processing

Body:
## Objective
Update API timeout from 30s to 60s to support large file uploads.

## Current Implementation
File: `src/services/api.ts` (line 42)
Current timeout: 30000ms

## Required Change
Increase timeout to 60000ms and add configuration option.

[...rest of detailed issue]
```

---

## Common Commands Reference

### GitHub Projects

```bash
# List projects
gh project list --owner <org>

# Get project ID
PROJECT_ID=$(gh project list --owner <org> --format json | \
  jq -r ".projects[] | select(.number == <num>) | .id")

# List fields
gh project field-list <project-num> --owner <org>

# Get field details
gh project field-list <project-num> --owner <org> --format json | \
  jq '.fields[] | select(.name == "<field-name>")'

# Add issue to project
gh project item-add <project-num> --owner <org> --url <issue-url>

# List project items
gh project item-list <project-num> --owner <org> --format json
```

### Issues

```bash
# Create issue
gh issue create --title "<title>" --body "<body>"

# Edit issue
gh issue edit <number> --add-label "label1,label2"

# View issue
gh issue view <number>

# Get issue node ID
gh issue view <number> --json id -q .id

# Add comment
gh issue comment <number> --body "<comment>"
```

### Labels

```bash
# List labels
gh label list

# Create label
gh label create "<name>" --description "<desc>" --color "<hex>"

# Add to issue
gh issue edit <number> --add-label "label1,label2"
```

### Relationships

```bash
# Get node IDs
PARENT_ID=$(gh issue view <parent-num> --json id -q .id)
CHILD_ID=$(gh issue view <child-num> --json id -q .id)

# Add sub-issue relationship
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
mutation {
  addSubIssue(input: {
    issueId: "'"$PARENT_ID"'"
    subIssueId: "'"$CHILD_ID"'"
  }) {
    issue { title }
    subIssue { title }
  }
}'
```

### Setting Fields

```bash
# Get item ID (Method 1: from project item list)
ITEM_ID=$(gh project item-list <proj-num> --owner <org> --format json | \
  jq -r ".items[] | select(.content.number == <issue-num>) | .id")

# Get item ID (Method 2: from issue directly via GraphQL)
gh api graphql -f query='
query {
  repository(owner: "<org>", name: "<repo>") {
    issue(number: <num>) {
      projectItems(first: 5) {
        nodes {
          id
          project { id title }
        }
      }
    }
  }
}' --jq '.data.repository.issue.projectItems.nodes[]'

# Get field and option IDs
FIELD_ID=$(gh project field-list <proj-num> --owner <org> --format json | \
  jq -r '.fields[] | select(.name == "<field-name>") | .id')

OPTION_ID=$(gh project field-list <proj-num> --owner <org> --format json | \
  jq -r '.fields[] | select(.name == "<field>") | .options[] | select(.name == "<option>") | .id')

# Get Status field via GraphQL (alternative method)
gh api graphql -f query='
query {
  node(id: "<project-id>") {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}' --jq '.data.node.fields.nodes[] | select(.name == "Status")'

# Set field value
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "<project-id>"
    itemId: "<item-id>"
    fieldId: "<field-id>"
    value: { singleSelectOptionId: "<option-id>" }
  }) {
    projectV2Item { id }
  }
}'

# Move issue to "Done" status (complete example)
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "<project-id>"
      itemId: "<item-id>"
      fieldId: "<status-field-id>"
      value: { singleSelectOptionId: "<done-option-id>" }
    }
  ) {
    projectV2Item { id }
  }
}'
```

---

## Complete Workflow Example

```bash
# 1. Find the project
ORG="MyOrg"
PROJECT_NUMBER=2
PROJECT_ID=$(gh project list --owner $ORG --format json | \
  jq -r ".projects[] | select(.number == $PROJECT_NUMBER) | .id")

# 2. Get field IDs
PRIORITY_FIELD_ID=$(gh project field-list $PROJECT_NUMBER --owner $ORG --format json | \
  jq -r '.fields[] | select(.name == "Priority") | .id')

P1_OPTION_ID=$(gh project field-list $PROJECT_NUMBER --owner $ORG --format json | \
  jq -r '.fields[] | select(.name == "Priority") | .options[] | select(.name == "P1") | .id')

# 3. Create parent issue
gh issue create --title "Epic: Implement feature X" --body "..."
PARENT_ISSUE=1

# 4. Create subtasks
gh issue create --title "Subtask 1" --body "Part of #$PARENT_ISSUE ..."
CHILD_1=2

gh issue create --title "Subtask 2" --body "Part of #$PARENT_ISSUE ..."
CHILD_2=3

# 5. Add to project
for ISSUE in $PARENT_ISSUE $CHILD_1 $CHILD_2; do
  gh project item-add $PROJECT_NUMBER --owner $ORG \
    --url https://github.com/$ORG/$REPO/issues/$ISSUE
done

# 6. Apply labels
gh issue edit $PARENT_ISSUE --add-label "Epic,infrastructure"
gh issue edit $CHILD_1 --add-label "backend"
gh issue edit $CHILD_2 --add-label "frontend"

# 7. Link relationships
PARENT_NODE_ID=$(gh issue view $PARENT_ISSUE --json id -q .id)

for CHILD in $CHILD_1 $CHILD_2; do
  CHILD_NODE_ID=$(gh issue view $CHILD --json id -q .id)

  gh api graphql -H "GraphQL-Features: sub_issues" -f query='
  mutation {
    addSubIssue(input: {
      issueId: "'"$PARENT_NODE_ID"'"
      subIssueId: "'"$CHILD_NODE_ID"'"
    }) {
      subIssue { title }
    }
  }'
done

# 8. Set priority for all issues
for ISSUE in $PARENT_ISSUE $CHILD_1 $CHILD_2; do
  ITEM_ID=$(gh project item-list $PROJECT_NUMBER --owner $ORG --format json | \
    jq -r ".items[] | select(.content.number == $ISSUE) | .id")

  gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "'"$PROJECT_ID"'"
      itemId: "'"$ITEM_ID"'"
      fieldId: "'"$PRIORITY_FIELD_ID"'"
      value: { singleSelectOptionId: "'"$P1_OPTION_ID"'" }
    }) {
      projectV2Item { id }
    }
  }'
done
```

---

## Summary

When asked to create GitHub issues:

1. **Understand the request** - Tasks or implementations? Review code or use provided info?
2. **Find the project** - Use `gh project list` to identify the target project
3. **Discover structure** - Get field IDs, option IDs, and understand available metadata
4. **Review code** - Read current implementation (unless told not to)
5. **Create issues** - Comprehensive parent + detailed subtasks
6. **Add to project** - Use `gh project item-add`
7. **Apply labels** - Based on component, type, and impact
8. **Set fields** - Priority, Size via GraphQL API
9. **Link relationships** - Parent-child, blocking, depends-on as appropriate
10. **Verify** - Check that issues appear correctly in project UI

The goal is to create **actionable, well-documented tasks** that engineers can execute without needing additional context.
