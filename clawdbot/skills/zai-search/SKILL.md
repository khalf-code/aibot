# Z.AI Search & Web Reader Skill

## Purpose
Search the web and read webpage content using Z.AI's Web Search and Web Reader APIs. Provides real-time information retrieval and content extraction.

## Prerequisites
- Z.AI API key configured in `~/.clawdbot/clawdbot.json` (env.ZAI_API_KEY)
- `curl` and `jq` installed
- Z.AI Max Plan (coding plan) for Web Search/Reader MCP access

## Commands

### Web Search
```bash
./search.sh search <query>
```
Search the web for real-time information (news, prices, weather, facts, etc.)

### Read URL
```bash
./search.sh read <url>
```
Fetch and parse a webpage, returning clean text content with metadata.

### Search and Summarize
```bash
./search.sh research <query>
```
Search the web and return a summarized answer with sources.

## API Details
- **Search Endpoint:** `https://open.z.ai/v4/web/search`
- **Reader Endpoint:** `https://open.z.ai/v4/web/read`
- **Auth:** Bearer token via ZAI_API_KEY

## Example Usage

```bash
# Search for current information
./search.sh search "latest AI news January 2026"

# Read a specific webpage
./search.sh read "https://example.com/article"

# Research a topic with summary
./search.sh research "best practices for React 19"
```

## Integration with Liam
Liam can use these commands via Slack:
- "Liam, search for upcoming events in LA"
- "Liam, read this article: [url]"
- "Liam, research [topic] and summarize"

## Response Format

### Search Results
Returns JSON with:
- `results[]` - Array of search results
  - `title` - Page title
  - `url` - Source URL
  - `snippet` - Content preview

### Read Results
Returns JSON with:
- `title` - Page title
- `url` - Source URL
- `content` - Extracted text content
- `links[]` - Relevant links found
- `metadata` - Page metadata (author, date, etc.)

## Rate Limits
- Web Search: 60 requests/minute (Max Plan)
- Web Reader: 30 requests/minute (Max Plan)
- Recommended: Cache frequently accessed content

## Error Handling
- Missing API key: Check `~/.clawdbot/clawdbot.json` env.ZAI_API_KEY
- 429 Too Many Requests: Wait and retry with backoff
- 403 Forbidden: URL may be blocked or require authentication
- Timeout: URL may be slow or unresponsive
