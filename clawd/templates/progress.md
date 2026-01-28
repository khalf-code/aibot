# Progress File Template

For multi-step tasks spanning sessions, use `~/clawd/progress/[task-name].txt`.

## Format

```markdown
# Task: [Name]
Started: [Date]
Status: in-progress | blocked | complete

## Completed Steps
- [Date] Step description

## Next Steps
- [ ] Pending item

## Learnings
- [Pattern discovered]
```

## Protocol

1. **Start:** Create progress file
2. **Each step:** Read progress first, append after completing
3. **Complete:** Archive to `~/clawd/progress/archive/`

## When to Use

- Tasks with 3+ distinct steps
- Research spanning multiple sources
- Multi-file skill creation
- Any task that might exceed one session
