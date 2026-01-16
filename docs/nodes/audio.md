---
summary: "How inbound audio/voice notes are downloaded, transcribed, and injected into replies"
read_when:
  - Changing audio transcription or media handling
---
# Audio / Voice Notes — 2026-01-16

## What works
- **Provider-based transcription**: If `tools.audio.transcription.provider` is set, Clawdbot will:
  1) Locate the first audio attachment (local path or URL) and download it if needed.
  2) Enforce `maxBytes` (default 20MB) before sending to the provider.
  3) Call the provider (e.g. `openai`, `groq`) and capture the transcript.
  4) Replace `Body` with an `[Audio]` block, set `{{Transcript}}`, and set `CommandBody`/`RawBody` to the transcript for command parsing.
  5) Continue through the normal auto-reply pipeline (templating, sessions, Pi command).
- **CLI fallback (optional)**: If `tools.audio.transcription.args` is set and provider transcription fails (or no provider is configured), Clawdbot will run the configured CLI args (templated with `{{MediaPath}}`) and use stdout as the transcript.
- **Verbose logging**: In `--verbose`, we log when transcription runs and when it replaces the body.

## Config examples

### Provider-based transcription (OpenAI/Groq)
```json5
{
  tools: {
    audio: {
      transcription: {
        enabled: true,
        provider: "openai", // or "groq"
        model: "whisper-1",
        maxBytes: 20971520,
        scope: {
          default: "allow",
          rules: [
            { action: "deny", match: { chatType: "group" } }
          ]
        }
      }
    }
  }
}
```

### CLI transcription (Whisper binary)
Requires `whisper` CLI installed:
```json5
{
  tools: {
    audio: {
      transcription: {
        args: ["--model", "base", "{{MediaPath}}"],
        timeoutSeconds: 45
      }
    }
  }
}
```

## Notes & limits
- Provider auth follows the standard model auth order (auth profiles, env vars, `models.providers.*.apiKey`).
- Default size cap is 20MB (`tools.audio.transcription.maxBytes`). Oversize audio is skipped.
- If provider transcription succeeds, the CLI args path does not run. If the provider fails and args exist, CLI fallback runs.
- Transcript is available to templates as `{{Transcript}}`; `Body` is replaced with an `[Audio]` block that can include caption text as `User text:`.
- CLI stdout is capped (5MB); keep CLI output concise.

## Gotchas
- Scope rules use first-match wins. `chatType` is normalized to `direct`, `group`, or `room`.
- Ensure your CLI exits 0 and prints plain text; JSON needs to be massaged via `jq -r .text`.
- Keep timeouts reasonable (`timeoutSeconds`, default 45s) to avoid blocking the reply queue.
