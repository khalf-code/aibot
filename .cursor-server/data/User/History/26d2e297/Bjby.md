---
name: github-monitor
description: Proactively monitor GitHub activity for Pastorsimon1798, including notifications, PRs, and issues. Use when Liam needs to give Simon a daily digest or urgent alerts about his code repositories.
---

# GitHub Monitor Skill

This skill allows Liam to proactively track GitHub activity for Simon (`Pastorsimon1798`).

## Usage

Run the activity monitor script to see a summary of notifications, PRs, and issues:

```bash
scripts/check-activity.sh
```

## Features

- **Notifications**: Lists all unread GitHub notifications across all repositories.
- **Pull Requests**: Tracks PRs created by Simon and those awaiting his review.
- **Issues**: Surfaces issues assigned to Simon.
- **Neurodivergent Friendly**: Provides a concise, high-level summary to prevent notification overwhelm.

## Configuration

- **User**: `Pastorsimon1798`
- **Tool**: Uses the `gh` CLI authenticated with a Personal Access Token.
