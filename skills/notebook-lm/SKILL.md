# notebook-lm

Automate Google NotebookLM uploads using Playwright (Bun runtime).

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
