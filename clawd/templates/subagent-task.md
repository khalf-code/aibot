# Subagent Task Template

Use `sessions_spawn` to delegate parallel work.

## Required Format

```
sessions_spawn(
  task: """
  FIRST: Read apex-vault/APEX_COMPACT.md and follow all APEX v6.2.0 protocols.
  
  TASK: [Your actual task description here]
  """,
  label: "[task-label]",
  runTimeoutSeconds: 300
)
```

## Rules

- **MANDATORY:** Every task MUST start with the APEX loading instruction
- Max 4 concurrent subagents
- Prefer local model (`ollama/glm-4.7-flash`) for speed
- Subagents cannot access: cron, gateway, protected files
- Results announce back to main session

## When to Use

- Parallel research (multiple topics)
- Long-running summarization
- Independent information gathering
- Tasks that can be split and run concurrently
- Overnight builds (engineering tasks)
