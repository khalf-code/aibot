---
name: para-tasks
description: Manage tasks and projects using the PARA method (Projects, Areas, Resources, Archives). Optimized for neurodivergent focus with micro-steps, start/due dates, and proactive surfacing.
---

# PARA Task Management Skill

A structured task management system based on the **NeuroSecond** methodology. It helps combat executive function challenges by breaking work into micro-steps and focusing on "activation" through deadlines and clear categorization.

## Key Concepts

- **Projects**: Goal-oriented series of tasks with a clear deadline.
- **Areas**: Ongoing responsibilities (Work, Personal, Ceramics).
- **Resources**: Interests and information to be distilled.
- **Archives**: Inactive items to reduce visual clutter.

## Usage

### Managing Tasks

```bash
# Add a task to a project (P)
scripts/task.py add "Draft blog post about PARA" --category P --due "2026-02-01"

# Add a recurring area task (A)
scripts/task.py add "Water the ceramics studio plants" --category A --priority 2

# List active tasks
scripts/task.py list

# Mark a task as done
scripts/task.py done <task_id>
```

### Managing Projects

```bash
# Create a new project
scripts/project.py add "Launch Etsy Spring Collection" --area ceramics --deadline "2026-03-15"

# List active projects
scripts/project.py list
```

## Neurodivergent Best Practices

- **Micro-steps**: When adding a task, break it down until it feels "easy" to start.
- **Deadlines for Activation**: Assign deadlines to trigger ADHD activation, but use "Start Dates" to prevent premature overwhelm.
- **Visual Clarity**: Use `list` regularly to see only what matters now.
- **RSD Friendly**: Completed tasks are celebrated; overdue items are surfaced as "Ready for Review" rather than "Late."

## Database

The system uses a local SQLite database at `~/clawd/memory/para.sqlite`.
