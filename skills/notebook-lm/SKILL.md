# notebook-lm

Automate Google NotebookLM uploads using Playwright (Bun runtime).

## Security Notice

This skill stores a persistent Chrome profile containing Google session cookies.

**Security measures implemented:**
- Directory permissions enforced to 700 (owner-only)
- Runtime permission validation before accessing profile
- Access logging to `~/.config/moltbot/notebook-lm-access.log`
- Fail-fast if permissions are insecure

**Security requirements:**
- Profile directory: `~/.config/moltbot/notebook-lm-chrome/` (mode 700)
- Config directory: `~/.config/moltbot/` (mode 700)
- Run `tests/test-security.sh` to verify security posture

**WARNING**: The Chrome profile contains Google authentication cookies that could allow full account access if stolen. Ensure proper file permissions are maintained.

## Usage

```bash
# Show help
./scripts/notebook.sh help

# One-time auth setup (opens a browser)
./scripts/notebook.sh auth

# Upload a file
./scripts/notebook.sh upload --notebook-url="https://notebooklm.google.com/..." --file="/path/to/file.md"

# Upload text with a title
./scripts/notebook.sh upload --notebook-url="https://notebooklm.google.com/..." --text="Hello" --title="Source Title"
```

## Configuration

Edit `references/config.json` to set the auth state path, default notebook URL, and upload timeout.

## Dependencies

- Bun
- Playwright
- jq (for the bash orchestrator)
