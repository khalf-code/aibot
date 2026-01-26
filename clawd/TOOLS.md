# Tools Notes

*Tool-specific notes and preferences. You can update this freely.*

## gog (Google Workspace)

- **YOUR account:** clawdbot@puenteworks.com
- **NEVER use:** simon@puenteworks.com (Simon's personal email)
- Gmail, Calendar access configured
- **Installation (WSL2):** Installed via Linux binary in `~/.local/bin/gog`.
- **Keyring:** Uses encrypted file backend with `GOG_KEYRING_PASSWORD` in `~/.profile`.
- **Config:** `~/.config/gogcli/config.json`

## Slack

- Primary communication channel with Simon
- Post summaries and alerts here

## iMessage

- Read-only mode
- Can read from: +15623746790, gonzalez.simon@icloud.com
- Responses disabled

## CLI

- Local access via `clawdbot agent --local`

## ZAI (GLM-4.7)

**IMPORTANT**: ZAI requires explicit configuration in `~/.clawdbot/clawdbot.json` with the **coding endpoint**.

**Correct endpoint**: `https://api.z.ai/api/coding/paas/v4` (NOT `/v1`)

**Config location**: `models.providers.zai` in clawdbot.json

**If ZAI starts failing with "fetch failed"**:
1. Check if `zai` provider exists in `models.providers`
2. Verify baseUrl is `https://api.z.ai/api/coding/paas/v4`
3. Test with: `curl -s "https://api.z.ai/api/coding/paas/v4/models" -H "Authorization: Bearer $ZAI_API_KEY"`

**Reference**: https://docs.z.ai/devpack/tool/others

## nano-banana-pro (Image Generation)

**Location:** `/home/liam/skills/nano-banana-pro/SKILL.md`  
**Requires:** `uv` (installed at `~/.local/bin/uv`), `GEMINI_API_KEY` (configured in clawdbot.json)

**IMPORTANT:** This is NOT an llm-task model. Use `exec` to run the Python script directly.

**Generate an image:**
```bash
GEMINI_API_KEY="$(jq -r '.env.GEMINI_API_KEY' ~/.clawdbot/clawdbot.json)" \
  uv run /home/liam/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "your description" \
  --filename "/tmp/output.png" \
  --resolution 1K
```

**Edit an existing image:**
```bash
GEMINI_API_KEY="$(jq -r '.env.GEMINI_API_KEY' ~/.clawdbot/clawdbot.json)" \
  uv run /home/liam/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "edit instructions" \
  --filename "output.png" \
  --input-image "/path/to/input.png" \
  --resolution 2K
```

**Resolutions:** `1K` (default), `2K`, `4K`  
**Output:** Script prints `MEDIA: /path/file.png` for auto-attach on chat providers

**Common mistakes to avoid:**
- Do NOT use `llm-task` with `google/gemini-3-pro-image-preview` — it's not in allowed models
- Do NOT look in `/home/liam/clawdbot/skills/` — skill is at `/home/liam/skills/`
- Use `exec` tool to run the Python script with `uv run`

---
*Add tool-specific notes as you learn them.*
