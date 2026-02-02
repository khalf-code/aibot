# SKILLS.md - Reusable Skills & Commands

If you do a task more than once a day, it should be a skill here. Skills are
pre-defined workflows that save context and reduce errors.

## Handicapping Skills

### /gameday [sport]

Full game-day analysis workflow for all games in a sport today.

```
1. get_odds sport=[sport] → pull today's lines
2. For each game:
   a. get_weather for outdoor venues
   b. get_injuries for both teams
   c. get_social for both teams
   d. get_situational for the matchup
   e. check_edge depth=full for the game
3. Rank all edges by score (descending)
4. Present: top 3 edges with full reasoning + caveats
5. track_pick for any edge > 50
```

### /sunday-review

Weekly recursive learning cycle. Run every Sunday after games resolve.

```
1. track_pick action=pending → list unresolved picks
2. For each resolved game: track_pick action=result → backfill outcomes
3. review_accuracy action=weekly → full performance review
4. review_accuracy action=model_performance → per-model stats
5. review_accuracy action=calibration → probability accuracy check
6. review_accuracy action=regimes → degradation detection
7. review_accuracy action=weights → suggest/apply weight changes
8. calibrate action=correct → update calibration factors (if 20+ picks)
9. Save key insights to memory/YYYY-MM-DD.md
10. Update HANDICAPPING.md if significant lessons learned
```

### /edge-check [game]

Quick single-game edge analysis.

```
1. Parse [game] as AWAY@HOME
2. get_odds for the sport
3. check_edge depth=full game=[game]
4. If edge > 50: track_pick to record it
5. Present: edge score, direction, reasoning, caveats
```

### /clv-report [period]

Track how our closing line value is trending.

```
1. review_accuracy action=weekly period=[period]
2. Focus on CLV metrics specifically
3. If CLV negative: flag as concern, recommend model review
4. If CLV positive: note which models are driving value
```

### /health-check

System health diagnostic. Run daily.

```
1. review_accuracy action=regimes → check for degradation
2. review_accuracy action=portfolio → check for correlated exposure
3. calibrate action=report → calibration status
4. openclaw sharps costs → budget burn rate
5. Present: green/yellow/orange/red status with recommended actions
```

## Development Skills

### /build [feature]

Standard build workflow for new features.

```
1. Enter Plan Mode. Design the approach.
2. Adversarial review: spawn second session to find holes.
3. Create git worktree: git worktree add ../openclaw-build -b work/[feature]
4. Write implementation in the worktree.
5. Write tests. Run tests. Fix failures.
6. Run full test suite: pnpm test
7. Run linting: pnpm lint
8. Verify: hit endpoints / run the feature / prove it works.
9. Merge worktree back to main.
10. Update BUILD_STATUS.md and TASKS.md.
```

### /fix [error]

Automated bug fixing workflow.

```
1. Read the error message / logs / report.
2. Search codebase for relevant code.
3. Identify root cause (don't guess - trace it).
4. Write the fix.
5. Write a test that would have caught this.
6. Run all tests.
7. Verify the fix resolves the original error.
8. Update memory with the lesson learned.
```

### /techdebt

Find and catalog technical debt. Run weekly.

```
1. Search for TODO/FIXME/HACK comments in codebase
2. Check for duplicate code patterns
3. Check for stale/unused imports
4. Run linting with strict mode
5. Present: prioritized list of debt items with estimated effort
6. Add top 3 to TASKS.md if not already there
```

### /deploy [target]

Deployment workflow with verification.

```
1. Run pnpm lint → must pass
2. Run pnpm build → must pass
3. Run pnpm test → must pass
4. If all pass: wrangler deploy --env [target]
5. After deploy: hit health endpoint to verify
6. Log deployment to logs/decisions/YYYY-MM-DD.md
```

### /parallel [task-a] [task-b] [task-c]

Set up parallel work sessions for independent tasks.

```
1. Create worktrees:
   git worktree add ../openclaw-a -b work/[task-a]
   git worktree add ../openclaw-b -b work/[task-b]
   git worktree add ../openclaw-c -b work/[task-c]
2. Launch Claude Code in each:
   (cd ../openclaw-a && claude "[task-a instructions]") &
   (cd ../openclaw-b && claude "[task-b instructions]") &
   (cd ../openclaw-c && claude "[task-c instructions]") &
3. Monitor completion.
4. Merge results back to main one at a time.
5. Clean up worktrees after merge.
```

## Creating New Skills

When you do something more than once a day:

1. Document the steps here in the same format
2. Give it a clear `/name`
3. Include the exact command sequence
4. Note any prerequisites or dependencies
5. This file is read at session start - new skills are immediately available

Skills compound. Every skill you add saves context and prevents mistakes
across every future session.
