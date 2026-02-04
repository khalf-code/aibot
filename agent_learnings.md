# Agent learnings

## Gateway default state: running + auto-restart (2026-02-03)

- **Context:** User wanted the default state to be "gateway running" and if it stops it should reboot, so cron and other features work without manual steps.
- **Problem:** After install the gateway was already enabled + started (systemd/launchd) and the unit has Restart=always, but on Linux when running `openclaw gateway install` directly (not via onboard), linger was not enabled, so the gateway could stop on logout.
- **Solution:** In `cli/daemon-cli/install.ts`, after successful `service.install()` on Linux, call `ensureSystemdUserLingerNonInteractive({ runtime })` so linger is enabled (or the user gets the manual hint). Docs updated: gateway CLI and cron-jobs state that after install the gateway is enabled + started and restarts automatically if it stops.

## Cron "not working" – scheduler runs only with gateway (2026-02-03)

- **Context:** User reported cron "definitely not working"; they wanted the agent to run every 15 min or "when I write it."
- **Problem:** Runtime logs showed the cron scheduler was working (timer armed, onTimer fired, runDueJobs had dueCount 1, run log showed job finishing with status ok). So the code was fine; the issue was operational.
- **Solution:** Cron runs **only while the OpenClaw Gateway process is running**. If you only run the TUI or never start the gateway, no cron jobs run. Fix: start the gateway (e.g. `openclaw gateway` or enable and start the `openclaw-gateway` user service). For "when I write it" (run on demand): `openclaw cron run <job-id> --force`. Docs updated in `docs/automation/cron-jobs.md` (TL;DR).
