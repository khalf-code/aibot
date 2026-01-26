---
name: Restore Liam GOG Email
overview: Install the GOG CLI on WSL2 and restore Liam's email access by setting up OAuth authentication for clawdbot@puenteworks.com, plus fix migration-related scripts.
todos:
  - id: install-gog
    content: Download and install gogcli v0.9.0 Linux binary to ~/.local/bin
    status: completed
  - id: configure-keyring
    content: Set up encrypted file keyring backend for WSL2
    status: completed
  - id: env-config
    content: Add GOG environment variables to ~/.profile
    status: completed
  - id: obtain-creds
    content: User provides OAuth client credentials (client_secret.json)
    status: pending
  - id: auth-setup
    content: Store credentials and authorize clawdbot@puenteworks.com
    status: pending
  - id: fix-health-check
    content: Update health-check.sh with Linux paths
    status: pending
  - id: fix-restore-liam
    content: Update restore-liam.sh with Linux paths
    status: pending
  - id: fix-troubleshooting
    content: Update TROUBLESHOOTING.md with Linux paths
    status: pending
  - id: fix-liam-lib
    content: Update overnight-builds/cli-library/liam-lib.sh
    status: pending
  - id: update-tools-md
    content: Update TOOLS.md with new gog setup details
    status: pending
  - id: verify
    content: Test email access and run health-check.sh
    status: pending
isProject: false
---

# Restore Liam's GOG Email Access

## Problem

Liam lost access to his email (`clawdbot@puenteworks.com`) when migrated from Mac Mini to NucBoxEVO-X2 (WSL2 Ubuntu). Multiple issues discovered:

1. The `gog` CLI tool was never installed on the new system
2. No OAuth credentials exist (`~/.gog` or `~/.config/gogcli/` missing)
3. `health-check.sh` references old Mac paths (`/Volumes/Personal AI Assistant Brain/...`)
4. `restore-liam.sh` references old Mac paths and user (`/Users/simongonzalezdecruz/...`)

## Pre-flight Checklist

Before execution, confirm:

- [ ] User has OAuth client credentials file (`client_secret_*.json`)
- [ ] User has chosen a secure keyring password
- [ ] User can access a browser for OAuth flow (see note below)

**WSL2 Browser Note:** The OAuth flow requires opening a browser. In WSL2, this typically opens the Windows default browser automatically. If it doesn't work:

```bash
# Test browser opening
sensible-browser https://google.com
# Or set BROWSER explicitly
export BROWSER="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
```

---

## Solution

### Step 1: Install gogcli

Download the pre-built Linux binary from GitHub releases:

```bash
# Create bin directory (already exists per ~/.profile)
mkdir -p ~/.local/bin

# Download, extract, and install in one step
curl -L https://github.com/steipete/gogcli/releases/download/v0.9.0/gogcli_0.9.0_linux_amd64.tar.gz | tar xz -C ~/.local/bin

# Verify installation
~/.local/bin/gog --version
```

**Note:** `~/.local/bin` is already in PATH per existing `~/.profile`.

### Step 2: Configure Keyring Backend

WSL2 lacks a system keyring (GNOME Keyring/KWallet). Must use encrypted file backend:

```bash
# Set keyring to file-based encryption
gog auth keyring file
```

**Config location:** `~/.config/gogcli/config.json`

### Step 3: Set Environment Variables

Add to `~/.profile` (idempotent - check before adding):

```bash
# GOG (Google Workspace CLI) configuration
export GOG_KEYRING_BACKEND="file"
export GOG_KEYRING_PASSWORD="<secure-password>"
export GOG_ACCOUNT="clawdbot@puenteworks.com"
```

Then reload:

```bash
source ~/.profile
```

### Step 4: Obtain OAuth Client Credentials

**User must provide** the OAuth client credentials file (`client_secret_*.json`).

**Options to obtain:**

1. **Mac Mini backup** - Copy from `~/Library/Application Support/gogcli/credentials.json`
2. **Google Cloud Console** - Download from [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
3. **Create new** - Create a "Desktop app" OAuth client in Google Cloud Console

**Required APIs to enable in Google Cloud project:**

- Gmail API
- Google Calendar API
- Google Drive API
- People API (Contacts)
- Google Sheets API
- Google Docs API

### Step 5: Store Credentials and Authorize

Once credentials file is available:

```bash
# Store OAuth client credentials
gog auth credentials /path/to/client_secret_*.json

# Verify credentials stored
gog auth credentials list

# Authorize clawdbot account (opens browser for OAuth)
gog auth add clawdbot@puenteworks.com --services gmail,calendar,drive,contacts,docs,sheets

# Verify authorization
gog auth list --check
gog auth status
```

### Step 6: Fix Migration Scripts and Files

Multiple files contain hardcoded Mac paths that need updating:

**Critical scripts to fix:**

| File | Changes Needed |

|------|----------------|

| `~/clawd/health-check.sh` | `/Volumes/...` → `/home/liam/clawdbot`, `/Users/simongonzalezdecruz/clawd` → `/home/liam/clawd`, fix log path |

| `~/clawd/restore-liam.sh` | Same path fixes, update clawdbot invocation |

| `~/clawd/TROUBLESHOOTING.md` | Update all path references |

| `~/clawd/overnight-builds/cli-library/liam-lib.sh` | Update CLAWDBOT_DIR path |

**Documentation to update (low priority):**

| File | Notes |

|------|-------|

| `~/clawd/MEMORY.md` | Historical references (may leave as-is) |

| `~/clawd/SELF-NOTES.md` | Historical references (may leave as-is) |

| `~/clawd/memory/session-log.md` | Historical log (leave as-is) |

| `~/clawd/overnight-builds/cli-library/README.md` | Update if actively used |

### Step 7: Verify Email Access

```bash
# Test 1: List Gmail labels
gog gmail labels list --account clawdbot@puenteworks.com

# Test 2: Search inbox
gog gmail messages search "in:inbox is:unread" --account clawdbot@puenteworks.com --max 5

# Test 3: Calendar access
gog calendar events primary --today --account clawdbot@puenteworks.com
```

### Step 8: Update Documentation

Update [`~/clawd/TOOLS.md`](/home/liam/clawd/TOOLS.md):

- Note gog is installed via binary (not Homebrew)
- Document keyring backend configuration
- Add troubleshooting notes for WSL2

---

## Files to Modify

**New files created:**

- `~/.local/bin/gog` - Binary installation
- `~/.config/gogcli/config.json` - GOG configuration
- `~/.config/gogcli/credentials.json` - OAuth client credentials
- `~/.config/gogcli/keyring.enc` - Encrypted token storage

**Files to edit:**

- [`~/.profile`](/home/liam/.profile) - Add GOG environment variables
- [`~/clawd/health-check.sh`](/home/liam/clawd/health-check.sh) - Fix paths for Linux
- [`~/clawd/restore-liam.sh`](/home/liam/clawd/restore-liam.sh) - Fix paths for Linux
- [`~/clawd/TROUBLESHOOTING.md`](/home/liam/clawd/TROUBLESHOOTING.md) - Fix paths for Linux
- [`~/clawd/TOOLS.md`](/home/liam/clawd/TOOLS.md) - Document new setup
- [`~/clawd/overnight-builds/cli-library/liam-lib.sh`](/home/liam/clawd/overnight-builds/cli-library/liam-lib.sh) - Fix CLAWDBOT_DIR

---

## Rollback Plan

If something goes wrong:

```bash
# Remove gog binary
rm -f ~/.local/bin/gog

# Remove gog config
rm -rf ~/.config/gogcli

# Remove GOG lines from ~/.profile (manual edit)

# Restore scripts from git
cd ~/clawd && git checkout -- health-check.sh restore-liam.sh TOOLS.md
```

---

## Required from User

Before I can execute, I need:

1. **OAuth client credentials file** (`client_secret_*.json`) - either from Mac Mini backup or Google Cloud Console
2. **Keyring password** - A secure password for encrypting OAuth tokens on disk

---

## Post-Completion Verification

After all steps complete, verify:

```bash
# 1. gog is in PATH
which gog

# 2. Auth is configured
gog auth list --check

# 3. Email works
gog gmail labels list

# 4. Health check passes
bash ~/clawd/health-check.sh
```