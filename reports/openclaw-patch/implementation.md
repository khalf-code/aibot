# safe_call implementation log

## Branch and baseline

- Working branch: `fix/compact-content-normalize`
- Main divergence check: branch is ahead `main` and not behind (`0	8`), so no rebase was required.

## Implemented built-in tool

### 1) New built-in: `safe_call`

- File: `src/agents/tools/safe-call-tool.ts`
- Factory: `createSafeCallTool(options)`
- Tool name: `safe_call`
- Parameters schema:
  - `tool: string`
  - `params?: object`
  - `maxChars?: number`
  - `offset?: number`
  - `limit?: number`
  - `fields?: string[]`

Code references:

- Schema: `src/agents/tools/safe-call-tool.ts:14`
- Factory and execute: `src/agents/tools/safe-call-tool.ts:198`

### 2) Core logic implemented

- Resolve target tool by name, reject unknown tool and self-wrap.
- Execute wrapped tool with `params`.
- Extract payload (prefer `.details`, fallback to text blocks in `.content`).
- Apply field filtering (supports nested dotted paths like `a.b.c`).
- Paginate:
  - arrays by element count
  - non-array payload serialized and paginated by lines
- Truncate by `maxChars` using head+tail strategy with explicit offset hint.
- Return normalized metadata:
  - `totalItems`
  - `hasMore`
  - `nextOffset`
  - plus `mode`, `offset`, `limit`, `maxChars`, `fields`, `truncated`, `output`

Code references:

- Field filtering: `src/agents/tools/safe-call-tool.ts:89`
- Pagination: `src/agents/tools/safe-call-tool.ts:108`, `src/agents/tools/safe-call-tool.ts:122`
- Truncation: `src/agents/tools/safe-call-tool.ts:148`
- Metadata return: `src/agents/tools/safe-call-tool.ts:245`

### 3) Registration into built-ins

- Added import and registration in central tool registry.
- Registered after plugin tools so it can wrap both core + plugin tools.
- Added plugin conflict guard by reserving `safe_call` in `existingToolNames`.

Code references:

- Import: `src/agents/openclaw-tools.ts:14`
- Plugin conflict guard: `src/agents/openclaw-tools.ts:176`
- Wrapper registration: `src/agents/openclaw-tools.ts:181`

### 4) Tests

- Added dedicated tests for:
  - fields + array pagination
  - line pagination for object payloads
  - head+tail truncation with offset hint
  - unknown tool + self-wrap rejection
- Added schema assertions for `safe_call` numeric fields in sessions tool schema compatibility test.

Code references:

- Tool tests: `src/agents/tools/safe-call-tool.test.ts:18`
- Schema assertions: `src/agents/openclaw-tools.sessions.test.ts:76`

Executed verification:

- `pnpm vitest run src/agents/tools/safe-call-tool.test.ts src/agents/openclaw-tools.sessions.test.ts --reporter=dot`
- Result: `2 passed`, `14 passed` tests total.

## Commit record

- Implementation commit already present on branch:
  - `4e70e4abb feat(tools): add safe_call wrapper for bounded tool output`
- Conventional Commits compliance:
  - type: `feat`
  - scope: `tools`
  - imperative lowercase description
