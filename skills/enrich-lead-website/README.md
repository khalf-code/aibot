# enrich-lead-website

Scrape a lead's website and extract structured information about the company or individual.

## What It Does

Given a URL, this skill fetches the page content and extracts:

- **Company/site name** from title tags, meta tags, or headings
- **Description** from meta description or tagline
- **Industry** signals from page content
- **Social links** (Twitter, LinkedIn, GitHub, etc.)
- **Contact emails** found on the page
- **Tech stack signals** from script tags, meta generators, and headers
- **Text excerpt** from the main content area

## Manifest

See `manifest.yaml` for permissions and configuration. This skill requires access to the `browser-runner` tool and unrestricted domain access (`"*"`).

## Usage

### Input

```json
{
  "url": "https://example.com",
  "timeoutMs": 30000
}
```

| Field       | Type   | Required | Description                             |
| ----------- | ------ | -------- | --------------------------------------- |
| `url`       | string | yes      | The website URL to scrape               |
| `timeoutMs` | number | no       | Timeout override in ms (default: 30000) |

### Output

```json
{
  "url": "https://example.com",
  "name": "Example Corp",
  "description": "A sample company for demonstration purposes",
  "industry": "Technology",
  "socialLinks": ["https://twitter.com/example"],
  "emails": ["contact@example.com"],
  "techSignals": ["React", "Node.js"],
  "excerpt": "Example Corp builds tools that help teams...",
  "enrichedAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample input payload
- `fixtures/output.json` -- sample enriched output

## Testing

```bash
# Run tests for this skill
pnpm vitest run skills/enrich-lead-website/tests/
```

## Failure Modes

- **Timeout**: The target site may be slow or unresponsive. The skill respects `timeout_ms` from the manifest (default 30s).
- **Blocked by robots/WAF**: Some sites block automated scrapers. The skill returns null fields rather than failing hard.
- **No structured data found**: If the page has minimal meta tags, most fields will be `null` or empty arrays. The `excerpt` field provides raw text as a fallback.

## Status

Stub implementation. The `enrichLeadWebsite` function returns a skeleton result. Integration with the `browser-runner` tool is needed for production use.
