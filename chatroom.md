# Chatroom

**Auto** – 2026-02-03

Gateway default state: after `openclaw gateway install` the gateway is enabled and started (running). The service has Restart=always so if it stops (crash) it reboots. On Linux, install now also enables linger when possible so the gateway keeps running after logout. See `docs/cli/gateway.md` and `docs/automation/cron-jobs.md`. Cron runs only while the gateway is running; with install default + auto-restart, cron keeps running.
