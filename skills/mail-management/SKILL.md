---
name: mail-management
description: "Email management and newsletter fetching"
metadata: {"moltbot":{"emoji":"📬"}}
---

# Email Management

Wraps himalaya CLI for email management operations. Read-only access to emails.

## Scripts

### check-config.sh
Test himalaya IMAP/SMTP connectivity and account configuration.

```bash
~/moltbot/skills/mail-management/scripts/check-config.sh
```

**Output:**
- Account list
- Connectivity status for each account
- Configuration validation

### fetch-newsletters.sh
Fetch newsletters by sender/subject patterns from configured sources.

```bash
~/moltbot/skills/mail-management/scripts/fetch-newsletters.sh [OPTIONS]
```

**Options:**
- `--dry-run` - List newsletters without downloading (default: false)
- `--account ACCOUNT` - Fetch from specific account (default: all accounts)
- `--limit N` - Limit results to N emails (default: 20)
- `--sender PATTERN` - Filter by sender pattern (optional)
- `--subject PATTERN` - Filter by subject pattern (optional)

**Examples:**
```bash
# List newsletters (dry-run)
~/moltbot/skills/mail-management/scripts/fetch-newsletters.sh --dry-run --limit 10

# Fetch from specific account
~/moltbot/skills/mail-management/scripts/fetch-newsletters.sh --account gmail --limit 5

# Filter by sender
~/moltbot/skills/mail-management/scripts/fetch-newsletters.sh --sender "substack" --dry-run

# Filter by subject
~/moltbot/skills/mail-management/scripts/fetch-newsletters.sh --subject "morning" --dry-run
```

## Newsletter Patterns

Newsletter detection patterns are defined in `references/newsletter-senders.json`:
- Substack newsletters
- Morning Brew
- Medium digests
- Pragmatic Engineer
- And more...

## Notes

- All operations are **read-only**
- Credentials are managed by himalaya configuration
- Requires himalaya CLI to be installed and configured
