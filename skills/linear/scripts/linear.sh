#!/usr/bin/env bash
set -euo pipefail

# Linear CLI wrapper
# Requires: LINEAR_API_KEY, curl, jq

API="https://api.linear.app/graphql"

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "Error: LINEAR_API_KEY not set" >&2
  exit 1
fi

gql() {
  local query="$1"
  curl -s -X POST "$API" \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d "{\"query\": \"$query\"}"
}

# Team IDs (hardcoded for speed)
declare -A TEAMS=(
  ["MED"]="2b0f15e8-f6b9-4dd2-a3c9-1a48c8a077c3"
  ["ONC"]="1d5ad559-ab28-42a5-b50d-65fbf15307d2"
)

# Status name to ID mapping (fetched dynamically when needed)
get_state_id() {
  local team_key="$1"
  local state_name="$2"
  local team_id="${TEAMS[$team_key]:-}"
  
  # Map friendly names to actual state names
  case "$state_name" in
    todo) state_name="Todo" ;;
    progress) state_name="In Progress" ;;
    review) state_name="In Review" ;;
    done) state_name="Done" ;;
    blocked) state_name="Blocked" ;;
    backlog) state_name="Backlog" ;;
  esac
  
  gql "{ workflowStates(filter: { team: { id: { eq: \\\"$team_id\\\" } }, name: { eq: \\\"$state_name\\\" } }) { nodes { id } } }" | jq -r '.data.workflowStates.nodes[0].id'
}

format_issues() {
  jq -r '.data | .. | .nodes? // empty | .[] | select(.identifier) | 
    "[\(.priorityLabel // "—")] \(.identifier): \(.title) (\(.state.name)) \(if .assignee then "→ " + .assignee.name else "" end)"' 2>/dev/null || echo "No issues found"
}

format_issue_detail() {
  jq -r '.data.issue | "
\(.identifier): \(.title)
State: \(.state.name) | Priority: \(.priorityLabel // "None") | Assignee: \(.assignee.name // "Unassigned")
Project: \(.project.name // "None") | Team: \(.team.name)
Created: \(.createdAt | split("T")[0])
\(if .dueDate then "Due: " + .dueDate else "" end)

\(.description // "No description")
"'
}

cmd="${1:-help}"
shift || true

case "$cmd" in
  my-issues)
    gql "{ viewer { assignedIssues(first: 20, filter: { state: { type: { nin: [\\\"completed\\\", \\\"canceled\\\"] } } }) { nodes { identifier title state { name } priority priorityLabel } } } }" | format_issues
    ;;
    
  my-todos)
    gql "{ viewer { assignedIssues(first: 20, filter: { state: { type: { eq: \\\"unstarted\\\" } } }) { nodes { identifier title state { name } priority priorityLabel } } } }" | format_issues
    ;;
    
  urgent)
    gql "{ issues(filter: { priority: { lte: 2 }, state: { type: { nin: [\\\"completed\\\", \\\"canceled\\\"] } } }, first: 20) { nodes { identifier title state { name } priority priorityLabel assignee { name } } } }" | format_issues
    ;;
    
  team)
    team_key="${1:-MED}"
    team_id="${TEAMS[$team_key]:-}"
    if [[ -z "$team_id" ]]; then
      echo "Unknown team: $team_key (use MED or ONC)" >&2
      exit 1
    fi
    gql "{ team(id: \\\"$team_id\\\") { issues(first: 30, filter: { state: { type: { nin: [\\\"completed\\\", \\\"canceled\\\"] } } }) { nodes { identifier title state { name } priority priorityLabel assignee { name } } } } }" | format_issues
    ;;
    
  project)
    project_name="${1:-}"
    if [[ -z "$project_name" ]]; then
      echo "Usage: linear.sh project <name>" >&2
      exit 1
    fi
    gql "{ projects(filter: { name: { containsIgnoreCase: \\\"$project_name\\\" } }, first: 1) { nodes { issues(first: 30, filter: { state: { type: { nin: [\\\"completed\\\", \\\"canceled\\\"] } } }) { nodes { identifier title state { name } priority priorityLabel assignee { name } } } } } }" | format_issues
    ;;
    
  issue)
    issue_id="${1:-}"
    if [[ -z "$issue_id" ]]; then
      echo "Usage: linear.sh issue <MED-123>" >&2
      exit 1
    fi
    team_key="${issue_id%%-*}"
    issue_num="${issue_id##*-}"
    gql "{ issues(filter: { number: { eq: $issue_num }, team: { key: { eq: \\\"$team_key\\\" } } }) { nodes { identifier title description state { name } priority priorityLabel assignee { name } project { name } team { name } createdAt dueDate } } }" | jq -r '.data.issues.nodes[0] | "
\(.identifier): \(.title)
State: \(.state.name) | Priority: \(.priorityLabel // "None") | Assignee: \(.assignee.name // "Unassigned")
Project: \(.project.name // "None") | Team: \(.team.name)
Created: \(.createdAt | split("T")[0])
\(if .dueDate then "Due: " + .dueDate else "" end)

\(.description // "No description")
"'
    ;;
    
  create)
    team_key="${1:-}"
    title="${2:-}"
    description="${3:-}"
    if [[ -z "$team_key" || -z "$title" ]]; then
      echo "Usage: linear.sh create <MED|ONC> \"Title\" [\"Description\"]" >&2
      exit 1
    fi
    team_id="${TEAMS[$team_key]:-}"
    if [[ -z "$team_id" ]]; then
      echo "Unknown team: $team_key" >&2
      exit 1
    fi
    # Escape quotes in title and description
    title="${title//\"/\\\"}"
    description="${description//\"/\\\"}"
    result=$(gql "mutation { issueCreate(input: { teamId: \\\"$team_id\\\", title: \\\"$title\\\", description: \\\"$description\\\" }) { success issue { identifier title url } } }")
    echo "$result" | jq -r 'if .data.issueCreate.success then "Created: \(.data.issueCreate.issue.identifier) - \(.data.issueCreate.issue.title)\n\(.data.issueCreate.issue.url)" else "Error: " + (.errors[0].message // "Unknown error") end'
    ;;
    
  comment)
    issue_id="${1:-}"
    body="${2:-}"
    if [[ -z "$issue_id" || -z "$body" ]]; then
      echo "Usage: linear.sh comment <MED-123> \"Comment text\"" >&2
      exit 1
    fi
    body="${body//\"/\\\"}"
    # First get the issue UUID from the identifier
    issue_uuid=$(gql "{ issueVcsBranchSearch(branchName: \\\"$issue_id\\\") { id } }" | jq -r '.data.issueVcsBranchSearch.id // empty')
    if [[ -z "$issue_uuid" ]]; then
      # Try direct lookup by identifier  
      issue_uuid=$(gql "{ issues(filter: { number: { eq: ${issue_id##*-} } }) { nodes { id identifier } } }" | jq -r ".data.issues.nodes[] | select(.identifier == \"$issue_id\") | .id")
    fi
    if [[ -z "$issue_uuid" ]]; then
      echo "Could not find issue: $issue_id" >&2
      exit 1
    fi
    result=$(gql "mutation { commentCreate(input: { issueId: \\\"$issue_uuid\\\", body: \\\"$body\\\" }) { success comment { id } } }")
    echo "$result" | jq -r 'if .data.commentCreate.success then "Comment added" else "Error: " + (.errors[0].message // "Unknown error") end'
    ;;
    
  status)
    issue_id="${1:-}"
    new_status="${2:-}"
    if [[ -z "$issue_id" || -z "$new_status" ]]; then
      echo "Usage: linear.sh status <MED-123> <todo|progress|review|done|blocked>" >&2
      exit 1
    fi
    team_key="${issue_id%%-*}"
    state_id=$(get_state_id "$team_key" "$new_status")
    if [[ -z "$state_id" || "$state_id" == "null" ]]; then
      echo "Could not find state: $new_status for team $team_key" >&2
      exit 1
    fi
    # Get issue UUID
    issue_num="${issue_id##*-}"
    issue_uuid=$(gql "{ issues(filter: { number: { eq: $issue_num }, team: { key: { eq: \\\"$team_key\\\" } } }) { nodes { id } } }" | jq -r '.data.issues.nodes[0].id')
    result=$(gql "mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { stateId: \\\"$state_id\\\" }) { success issue { identifier state { name } } } }")
    echo "$result" | jq -r 'if .data.issueUpdate.success then "Updated \(.data.issueUpdate.issue.identifier) → \(.data.issueUpdate.issue.state.name)" else "Error: " + (.errors[0].message // "Unknown error") end'
    ;;

  priority)
    issue_id="${1:-}"
    priority="${2:-}"
    if [[ -z "$issue_id" || -z "$priority" ]]; then
      echo "Usage: linear.sh priority <MED-123> <urgent|high|medium|low|none>" >&2
      exit 1
    fi
    case "$priority" in
      urgent) pval=1 ;;
      high) pval=2 ;;
      medium) pval=3 ;;
      low) pval=4 ;;
      none) pval=0 ;;
      *) echo "Unknown priority: $priority" >&2; exit 1 ;;
    esac
    team_key="${issue_id%%-*}"
    issue_num="${issue_id##*-}"
    issue_uuid=$(gql "{ issues(filter: { number: { eq: $issue_num }, team: { key: { eq: \\\"$team_key\\\" } } }) { nodes { id } } }" | jq -r '.data.issues.nodes[0].id')
    result=$(gql "mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { priority: $pval }) { success issue { identifier priorityLabel } } }")
    echo "$result" | jq -r 'if .data.issueUpdate.success then "Updated \(.data.issueUpdate.issue.identifier) → \(.data.issueUpdate.issue.priorityLabel)" else "Error: " + (.errors[0].message // "Unknown error") end'
    ;;
    
  assign)
    issue_id="${1:-}"
    user_name="${2:-}"
    if [[ -z "$issue_id" || -z "$user_name" ]]; then
      echo "Usage: linear.sh assign <MED-123> <userName>" >&2
      exit 1
    fi
    # Get user ID
    user_id=$(gql "{ users(filter: { name: { containsIgnoreCase: \\\"$user_name\\\" } }) { nodes { id name } } }" | jq -r '.data.users.nodes[0].id')
    if [[ -z "$user_id" || "$user_id" == "null" ]]; then
      echo "Could not find user: $user_name" >&2
      exit 1
    fi
    team_key="${issue_id%%-*}"
    issue_num="${issue_id##*-}"
    issue_uuid=$(gql "{ issues(filter: { number: { eq: $issue_num }, team: { key: { eq: \\\"$team_key\\\" } } }) { nodes { id } } }" | jq -r '.data.issues.nodes[0].id')
    result=$(gql "mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { assigneeId: \\\"$user_id\\\" }) { success issue { identifier assignee { name } } } }")
    echo "$result" | jq -r 'if .data.issueUpdate.success then "Assigned \(.data.issueUpdate.issue.identifier) → \(.data.issueUpdate.issue.assignee.name)" else "Error: " + (.errors[0].message // "Unknown error") end'
    ;;
    
  projects)
    gql "{ projects(first: 20) { nodes { name state progress startDate targetDate teams { nodes { name } } } } }" | jq -r '.data.projects.nodes[] | "\(.name) [\(.state)] - \((.progress * 100) | floor)% complete \(if .targetDate then "(due " + .targetDate + ")" else "" end)"'
    ;;
    
  branch)
    issue_id="${1:-}"
    if [[ -z "$issue_id" ]]; then
      echo "Usage: linear.sh branch <MED-123>" >&2
      exit 1
    fi
    team_key="${issue_id%%-*}"
    issue_num="${issue_id##*-}"
    gql "{ issues(filter: { number: { eq: $issue_num }, team: { key: { eq: \\\"$team_key\\\" } } }) { nodes { branchName } } }" | jq -r '.data.issues.nodes[0].branchName'
    ;;
    
  standup)
    echo "=== 📊 Daily Standup ==="
    echo ""
    echo "🎯 YOUR TODOS:"
    gql "{ viewer { assignedIssues(first: 10, filter: { state: { type: { eq: \\\"unstarted\\\" } } }) { nodes { identifier title priorityLabel } } } }" | jq -r '.data.viewer.assignedIssues.nodes // [] | sort_by(.priorityLabel) | .[] | "  [\(.priorityLabel // "—")] \(.identifier): \(.title)"'
    echo ""
    echo "🚧 IN PROGRESS (yours):"
    gql "{ viewer { assignedIssues(first: 10, filter: { state: { type: { eq: \\\"started\\\" } } }) { nodes { identifier title state { name } } } } }" | jq -r '.data.viewer.assignedIssues.nodes // [] | .[] | "  \(.identifier): \(.title) (\(.state.name))"'
    echo ""
    echo "🔴 BLOCKED (team-wide):"
    gql "{ issues(filter: { state: { name: { in: [\\\"Blocked\\\", \\\"Paused\\\"] } } }, first: 10) { nodes { identifier title assignee { name } } } }" | jq -r '.data.issues.nodes // [] | .[] | "  \(.identifier): \(.title) → \(.assignee.name // "unassigned")"'
    echo ""
    echo "✅ RECENTLY DONE (last 7 days):"
    week_ago=$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)
    gql "{ issues(filter: { state: { type: { eq: \\\"completed\\\" } }, completedAt: { gte: \\\"$week_ago\\\" } }, first: 10) { nodes { identifier title completedAt assignee { name } } } }" | jq -r '.data.issues.nodes // [] | .[] | "  \(.identifier): \(.title) → \(.assignee.name // "unassigned")"'
    ;;
    
  help|*)
    echo "Linear CLI - Manage issues and projects"
    echo ""
    echo "Commands:"
    echo "  my-issues          Your assigned open issues"
    echo "  my-todos           Your Todo items"
    echo "  urgent             Urgent/High priority issues (all)"
    echo "  team <MED|ONC>     Team issues"
    echo "  project <name>     Project issues"
    echo "  issue <ID>         Issue details"
    echo "  branch <ID>        Get Linear branch name for GitHub integration"
    echo "  create <team> \"title\" [\"desc\"]   Create issue"
    echo "  comment <ID> \"text\"               Add comment"
    echo "  status <ID> <state>               Update status"
    echo "  priority <ID> <level>             Set priority"
    echo "  assign <ID> <user>                Assign to user"
    echo "  projects           List all projects"
    echo "  standup            Daily standup summary"
    ;;
esac
