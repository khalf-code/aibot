---
name: claude-code
description: Claude Code CLI integration with Ralph Loop for autonomous development. Use for complex coding tasks requiring iterative development, overnight autonomous work, or when "build X from scratch" requests need sustained multi-hour effort. Triggers on "ralph loop", "autonomous development", "build project autonomously", or long-running coding tasks.
---

# Claude Code with Ralph Loop

Autonomous iterative development using Claude Code CLI and the Ralph Loop pattern.

## When to Use

| Scenario | Approach |
|----------|----------|
| Quick fix (<10 min) | Direct Claude Code: `claude "fix X"` |
| Feature (30min-2hr) | Background Claude Code with monitoring |
| Complex project (2hr+) | Ralph Loop for autonomous iteration |
| Overnight development | Ralph Loop with monitoring |

## Quick Start: Direct Claude Code

```bash
# One-shot task (always use pty!)
bash pty:true workdir:/path/to/project command:"claude 'Your task here'"

# Background for longer tasks
bash pty:true workdir:/path/to/project background:true command:"claude 'Build feature X'"
```

## Ralph Loop: Autonomous Development

Ralph Loop enables Claude Code to work autonomously for hours, iterating on a project until complete.

### Setup New Project

```bash
# Install ralph (if not installed)
pip install ralph-loop

# Create new ralph project
ralph-setup my-project
cd my-project
```

### Project Structure

```
my-project/
├── .ralph/
│   ├── PROMPT.md      # Project requirements (Claude reads this)
│   ├── config.yaml    # Loop settings (optional)
│   └── session.json   # Progress state (auto-managed)
└── [your project files]
```

### PROMPT.md Template

```markdown
# Project: [Name]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Success Criteria
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Ready for review

## Constraints
- Use [specific patterns/frameworks]
- Follow [coding standards]
```

### Start Ralph Loop

```bash
# Start autonomous development
ralph --monitor

# Options
ralph --calls 50        # Limit API calls/hour
ralph --timeout 30      # Set call timeout (minutes)
ralph --live            # Stream Claude output
ralph --verbose         # Detailed progress
```

### Monitor Progress

```bash
# Check status
ralph --status

# View logs
tail -f .ralph/execution.log

# Circuit breaker (if loop gets stuck)
ralph --circuit-status
ralph --reset-circuit
```

## Integration with OpenClaw

### Background Ralph with Notifications

```bash
bash pty:true workdir:/path/to/project background:true command:"ralph --monitor 2>&1 | tee ralph.log; openclaw gateway wake --text 'Ralph complete' --mode now"
```

### Monitoring from OpenClaw

```bash
# Check ralph status
process action:log sessionId:XXX

# Send input if needed
process action:submit sessionId:XXX data:"y"
```

## Best Practices

1. **Always use `pty:true`** for Claude Code sessions
2. **Isolate workdir** - Don't run in your main workspace (reads all files!)
3. **Clear success criteria** - Ralph loops until PROMPT.md criteria are met
4. **Monitor overnight** - Use `--monitor` flag for tmux-based supervision
5. **Set call limits** - Prevent runaway loops with `--calls` flag

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Loop stuck | `ralph --reset-circuit` then restart |
| Session lost | `ralph --reset-session` to clear state |
| High token usage | Add clearer criteria to PROMPT.md |
| Tests failing | Add test commands to success criteria |

## Example: Full-Stack App

```bash
# 1. Setup project
ralph-setup todo-app
cd todo-app

# 2. Write requirements
mkdir -p .ralph
cat > .ralph/PROMPT.md << 'EOF'
# Todo App

## Requirements
- React frontend with TypeScript
- Express backend with REST API
- SQLite database
- CRUD operations for todos

## Success Criteria
- [ ] npm install works
- [ ] npm test passes
- [ ] npm start launches app
- [ ] Can create, read, update, delete todos

## Constraints
- Use functional components with hooks
- Follow REST conventions
- Include basic error handling
EOF

# 3. Start autonomous development
ralph --monitor --calls 100

# 4. Review when complete
```

## See Also

- `coding-agent` skill for basic Claude Code usage
- `github` skill for PR workflows after development
