#!/bin/bash
# Liam's GitHub Monitor
# Proactively checks for activity on Pastorsimon1798

USER="Pastorsimon1798"
GH_PATH="/home/liam/.local/bin/gh"

echo "=== GitHub Activity Monitor for $USER ==="
echo "Date: $(date)"
echo ""

# 1. Check Notifications
echo "## Notifications"
$GH_PATH api notifications --jq '.[] | "- \(.repository.full_name): \(.subject.title) (\(.reason))"' || echo "No new notifications."
echo ""

# 2. Check Recent Pull Requests (Created by Simon)
echo "## Your Recent PRs"
$GH_PATH pr list --author $USER --limit 5 --json number,title,state,headRepository --jq '.[] | "[\(.headRepository.name)] #\(.number): \(.title) (\(.state))"' || echo "No recent PRs found."
echo ""

# 3. Check PRs Awaiting Review (Mentioning Simon)
echo "## Awaiting Your Review"
$GH_PATH search prs --review-requested=$USER --state=open --json number,title,headRepository --jq '.[] | "[\(.headRepository.name)] #\(.number): \(.title)"' || echo "No pending reviews."
echo ""

# 4. Check Issues Assigned to Simon
# Note: gh issue list doesn't have headRepository, using a different search approach or just listing fields
echo "## Issues Assigned to You"
$GH_PATH search issues --assignee=$USER --state=open --json number,title,repository --jq '.[] | "[\(.repository.name)] #\(.number): \(.title)"' || echo "No assigned issues."
echo ""

echo "=== Check Complete ==="
