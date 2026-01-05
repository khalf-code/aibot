[[appended]]

---

## Web Search Integration (SSOT)

**Single Source of Truth:** `skills/web-search-with-gemini/`

### Usage

```bash
# Direct script usage
./scripts/web_search_with_gemini.sh "your query"

# With model selection
./scripts/web_search_with_gemini.sh --model gemini-3-flash-preview "query"

# Simple gemini CLI (underlying tool)
NODE_NO_WARNINGS=1 gemini "your query" -m gemini-3-flash-preview
```

### When to Use Web Search

**DO use when:**
- Current information needed (weather, news, prices)
- User explicitly requests: "погугли", "search", "google"
- Time-sensitive data (exchange rates, events)

**DON'T use when:**
- Historical facts (already in training data)
- Simple calculations
- Creative tasks

### Architecture

```
User Query
  |
  v
Pi Agent (src/agents/pi-tools.ts)
  |
  v
executeWebSearch() [src/web-search/executor.ts]
  |
  v
scripts/web_search_with_gemini.sh [SSOT]
  |
  v
gemini CLI -> Google Gemini API
```

### Files

| File | Purpose |
|------|---------|
| `skills/web-search-with-gemini/SKILL.md` | Skill metadata |
| `scripts/web_search_with_gemini.sh` | Main script |
| `src/web-search/executor.ts` | TypeScript integration |
| `src/web-search/messages.ts` | Russian messages |
| `prompts/web-search-tail.yaml` | Prompt instructions |
