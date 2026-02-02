# Fix for Issue #7069: Dashboard Logo 403 Error

## Problem
The issue reported that the dashboard header logo was failing to load with HTTP 403 because it referenced an external CDN URL:
```
https://mintcdn.com/clawhub/4rYvG-uuZrMK_URE/assets/pixel-lobster.svg
```

This was hardcoded in compiled dist files and caused the alt text "OpenClaw" to overlap with the header title.

## Root Cause Analysis

### Timeline
1. **Commit 9fbee0859** (Jan 25, 2026): UI refresh introduced the CDN URL
   - Changed from local assets to Mintlify CDN URL
   - This was hardcoded in `ui/src/ui/app-render.ts`

2. **Commit 615ccf641** (Jan 26, 2026): Stopped tracking dist artifacts
   - Removed `dist/control-ui/` from git tracking
   - Last tracked version still contained the CDN URL

3. **Commit fd00d5688** (Jan 30, 2026): Fixed the issue
   - Changed from CDN URL to local `/favicon.svg`
   - Updated branding from "Clawdbot" to "OpenClaw"

## Current Status

**✅ The source code is already fixed!**

The code in `ui/src/ui/app-render.ts` (line ~112) now correctly uses:
```typescript
<img src="/favicon.svg" alt="OpenClaw" />
```

The local `favicon.svg` file exists at `ui/public/favicon.svg` and contains a proper SVG lobster logo.

## Why the Issue Was Reported

The issue was reported because:
1. Old compiled dist files with the CDN URL were distributed before commit 615ccf641
2. Users with cached or pre-built versions still had the problematic URL
3. The Mintlify CDN URL became inaccessible (403 error)

## Solution

For users experiencing this issue:
1. **Pull latest code**: The source is already fixed in main branch
2. **Rebuild the UI**: Run `pnpm build` or equivalent to regenerate dist files
3. **Clear browser cache**: Ensure old cached assets are not used

## Prevention

Since commit 615ccf641, `dist/control-ui/` is no longer tracked in git, which:
- Reduces repo bloat
- Ensures users always build from source
- Prevents distributing stale compiled artifacts

## Verification

Confirmed no remaining references to external CDN:
```bash
# No references to mintcdn in source code
grep -r "mintcdn" --include="*.ts" --include="*.tsx" --include="*.js"
# Returns: (no matches)
```

## Recommendation

This issue requires **no code changes** - the fix was already committed on Jan 30, 2026.

Close the issue with a note that:
1. Source code is fixed as of commit fd00d5688
2. Users should rebuild from source
3. Old dist files are no longer tracked in git
