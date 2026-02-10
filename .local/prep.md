# PR Prep: #13069 - fix(memory): default batch embeddings to off

PR: https://github.com/openclaw/openclaw/pull/13069

## What I changed

- Rebased `fix/voyage-batch-default-off` onto current `origin/main`.
- Kept the behavior change: `agents.defaults.memorySearch.remote.batch.enabled` default is now `false` (opt-in).
- Docs:
  - Updated the memory docs section heading to include Voyage.
  - Reverted `docs/zh-CN/**` back to match `origin/main` (repo policy: generated).
- Added a changelog entry for the user-facing default change (`CHANGELOG.md`).

## Verification

- `bunx vitest run --config vitest.unit.config.ts src/infra/unhandled-rejections.test.ts src/agents/memory-search.test.ts`
- `pnpm build`
- `pnpm check`

## Current head

- Branch: `fix/voyage-batch-default-off`
- HEAD: `bbd672e26`
