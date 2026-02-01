---
name: web-scraper
description: "Playwright-based web scraper with RSS/Atom parsing and SSRF protection. Use when: scrape rss, parse feed, scrape webpage, extract article content, web scraping"
metadata: {"moltbot":{"emoji":"🕸️"}}
---

# Web Scraper

Fetch RSS/Atom feeds or scrape JavaScript-rendered pages with SSRF protection.

## Usage

```bash
/Users/koed/moltbot/skills/web-scraper/scripts/scraper.sh rss <feed-url>
/Users/koed/moltbot/skills/web-scraper/scripts/scraper.sh web <url>
/Users/koed/moltbot/skills/web-scraper/scripts/scraper.sh help
```

## Output

### RSS/Atom

```json
[
  {
    "title": "Example title",
    "link": "https://example.com",
    "pubDate": "Mon, 01 Jan 2026 00:00:00 GMT",
    "description": "Summary or description"
  }
]
```

### Web

```json
{
  "title": "Example title",
  "content": "Main article text...",
  "links": ["https://example.com/about"]
}
```

## Notes

- All URLs are validated with SSRF protection before fetching.
- RSS/Atom parsing uses Bun's built-in fetch and DOMParser.
- Use `--selector` with `web` to target custom content containers.
