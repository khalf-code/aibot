# Blogwatcher Setup Needed

**Date:** 2026-01-25 20:00
**Triggered by:** Cron job `Blogwatcher-Check` (every 2 hours)

## Issue

Blogwatcher skill is listed in STATUS.md as "OK", but the CLI tool isn't installed:
- `blogwatcher` command not found
- `go` command not found (needed to install blogwatcher)

## Resolution Options

1. **Install Go + blogwatcher now:**
   ```bash
   sudo apt install golang-go
   go install github.com/Hyaxia/blogwatcher/cmd/blogwatcher@latest
   ```

2. **Handle in Cursor session:** Configure during next config update session

3. **Manual setup:** Simon installs and configures himself

## Next Steps

- Need list of RSS feeds/URLs to monitor
- Configure blogwatcher with feeds
- Test scan functionality

## Status

**BLOCKED** - Waiting for Go installation and feed configuration
