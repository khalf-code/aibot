---
summary: "Schedule a weekly synthesis digest"
read_when:
  - You want a Sunday 9pm weekly summary
  - You need a lightweight digest without health data
---
# Weekly synthesis

Clawdbot can run a weekly digest via the Gateway cron scheduler. The MVP does
**not** require health data; it will skip that section when unavailable.

## Quick setup (script)

```bash
scripts/weekly-synthesis.sh
```

This creates (or updates) a cron job named **Weekly Synthesis** scheduled for
Sunday 21:00 (local timezone).

### Optional env vars

- `WEEKLY_SYNTHESIS_TZ` — IANA timezone (e.g. `America/Los_Angeles`)
- `WEEKLY_SYNTHESIS_PROVIDER` — delivery provider (`last`, `telegram`, `whatsapp`, ...)
- `WEEKLY_SYNTHESIS_TO` — delivery target (provider-specific)
- `WEEKLY_SYNTHESIS_MESSAGE_FILE` — override prompt text
- `WEEKLY_SYNTHESIS_THINKING` — thinking level (`off|minimal|low|medium|high`)

Example (Telegram):

```bash
WEEKLY_SYNTHESIS_PROVIDER=telegram \
WEEKLY_SYNTHESIS_TO="-1001234567890:topic:123" \
WEEKLY_SYNTHESIS_TZ="Atlantic/Reykjavik" \
scripts/weekly-synthesis.sh
```

## Manual cron add

```bash
clawdbot cron add \
  --name "Weekly Synthesis" \
  --cron "0 21 * * 0" \
  --session isolated \
  --wake now \
  --message "<your prompt>" \
  --deliver \
  --provider last \
  --best-effort-deliver \
  --post-prefix "Weekly Synthesis"
```

## Notes

- If delivery cannot resolve a target, the job skips delivery but still runs.
- Health data is optional; omit the section when unavailable.
- Cron runs inside the Gateway process. Ensure the Gateway stays online.
