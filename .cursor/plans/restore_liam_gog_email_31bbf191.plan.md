---
name: Restore Liam GOG Email
overview: Install the GOG CLI on WSL2 and restore Liam's email access by setting up OAuth authentication for clawdbot@puenteworks.com.
todos:
  - id: install-gog
    content: Download and install gogcli v0.9.0 Linux binary to ~/.local/bin
    status: completed
  - id: configure-keyring
    content: Set up encrypted file keyring backend for WSL2
    status: completed
  - id: obtain-creds
    content: User provides OAuth client credentials (client_secret.json)
    status: pending
  - id: auth-setup
    content: Store credentials and authorize clawdbot@puenteworks.com
    status: in_progress
  - id: env-config
    content: Add GOG environment variables to ~/.profile
    status: completed
  - id: verify
    content: Test email access with gog gmail commands
    status: pending
isProject: false
---

# Restore Liam's GOG Email Access

## Problem
Liam lost access to his email (`clawdbot@puenteworks.com`) when migrated from Mac Mini to NucBoxEVO-X2 (WSL2 Ubuntu). The `gog` CLI tool was never installed on the new system, and no OAuth credentials exist.

## Solution

### Step 1: Install gogcli

Download the pre-built Linux binary from GitHub releases:

```bash
# Download and extract
curl -L https://github.com/steipete/gogcli/releases/download/v0.9.0/gogcli_0.9.0_linux_amd64.tar.gz | tar xz

# Install to user's bin
mkdir -p ~/.local/bin
mv gog ~/.local/bin/

# Ensure ~/.local/bin is in PATH (add to ~/.profile if needed)
export PATH="$HOME/.local/bin:$PATH"
```

### Step 2: Configure Keyring Backend

Since WSL2 doesn't have a system keyring, use the encrypted file backend:

```bash
gog auth keyring file
```

Set password via environment (add to `~/.profile`):
```bash
export GOG_KEYRING_PASSWORD="<secure-password>"
```

### Step 3: Obtain OAuth Client Credentials

**You need to provide the OAuth client credentials file** (`client_secret_*.json`) from the Google Cloud project. Options:

- **If you have access to the Mac Mini**: Copy from `~/Library/Application Support/gogcli/credentials.json`
- **If you have Google Cloud Console access**: Download from [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
- **Create new credentials** if needed (Desktop app OAuth client)

### Step 4: Store Credentials and Authorize

Once you have the client secret JSON:

```bash
# Store OAuth client credentials
gog auth credentials /path/to/client_secret.json

# Authorize the clawdbot account (opens browser for OAuth)
gog auth add clawdbot@puenteworks.com --services gmail,calendar,drive,contacts,docs,sheets
```

### Step 5: Set Default Account

Add to `~/.profile`:
```bash
export GOG_ACCOUNT=clawdbot@puenteworks.com
```

### Step 6: Verify Access

```bash
# List labels to verify Gmail access
gog gmail labels list

# Test email search
gog gmail messages search "in:inbox is:unread" --max 5
```

## Files to Modify

- [`~/.profile`](/home/liam/.profile) - Add PATH and GOG environment variables
- New: `~/.local/bin/gog` - Binary installation
- New: `~/.config/gogcli/` - Config and encrypted credentials

## Required from User

Before I can execute, I need:
1. The OAuth client credentials file (`client_secret_*.json`) - either from Mac Mini backup or Google Cloud Console
2. A secure password for the keyring encryption
