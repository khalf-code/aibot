---
name: pptx-creator
description: Create professional PowerPoint presentations from outlines, data sources, or AI-generated content. Supports custom templates, style presets, charts/tables from data, and AI-generated images via nano-banana-pro. Pull content from CRM (Twenty), SharePoint, or any knowledge source. Use when asked to create slides, pitch decks, reports, or presentations.
homepage: https://python-pptx.readthedocs.io
metadata: {"clawdbot":{"emoji":"📽️","requires":{"bins":["uv"]}}}
---

# PowerPoint Creator

Create professional presentations from outlines, topics, or data sources.

## Quick Start

### From Outline/Markdown
```bash
uv run {baseDir}/scripts/create_pptx.py --outline outline.md --output deck.pptx
```

### From Topic (AI-generated)
```bash
uv run {baseDir}/scripts/create_pptx.py --topic "Q4 Sales Review" --slides 8 --output q4-review.pptx
```

### With Template
```bash
uv run {baseDir}/scripts/create_pptx.py --outline outline.md --template corporate --output deck.pptx
```

### From JSON Structure
```bash
uv run {baseDir}/scripts/create_pptx.py --json slides.json --output deck.pptx
```

## Outline Format (Markdown)

```markdown
# Presentation Title
subtitle: Company Overview 2026
author: David Hurley

## Slide 1: Introduction
- Welcome and agenda
- Key objectives for today
- ![image](generate: modern office building, minimalist style)

## Slide 2: Market Analysis
- chart: bar
- data: sales_by_region.csv
- Market grew 15% YoY
- We captured 23% share

## Slide 3: Financial Summary
- table: quarterly_results
- source: twenty://opportunities?status=won
- Strong Q4 performance
```

## JSON Structure

```json
{
  "title": "Q4 Review",
  "subtitle": "Sales Performance",
  "author": "David Hurley",
  "template": "corporate",
  "slides": [
    {
      "title": "Introduction",
      "layout": "title_and_content",
      "bullets": ["Welcome", "Agenda", "Goals"],
      "notes": "Speaker notes here"
    },
    {
      "title": "Revenue Chart",
      "layout": "chart",
      "chart_type": "bar",
      "data_source": "twenty://opportunities"
    },
    {
      "title": "Team",
      "layout": "image_and_text",
      "image": "generate: professional team photo, corporate style",
      "bullets": ["Leadership", "Sales", "Operations"]
    }
  ]
}
```

## Templates

### Built-in Styles
- `minimal` — Clean white, Helvetica Neue, blue accent (default)
- `corporate` — Professional blue, Arial, business-ready
- `creative` — Bold orange accents, Avenir, modern feel
- `dark` — Dark background, SF Pro, cyan accents
- `executive` — Gold accents, Georgia/Calibri, refined elegance
- `startup` — Purple accents, Poppins/Inter, pitch-deck ready

### Custom Templates
Store `.pptx` templates in `{baseDir}/templates/`:
```bash
# List available templates
uv run {baseDir}/scripts/create_pptx.py --list-templates

# Use custom template
uv run {baseDir}/scripts/create_pptx.py --template my-company --outline deck.md
```

### Save as Template
```bash
uv run {baseDir}/scripts/create_pptx.py --save-template "client-name" --from existing.pptx
```

### Analyze Existing Template
```bash
uv run {baseDir}/scripts/analyze_template.py existing.pptx
uv run {baseDir}/scripts/analyze_template.py existing.pptx --json
```

### Use Complex Template (preserve branding)
```bash
# Keep first 2 slides (title + nav), add new content
uv run {baseDir}/scripts/use_template.py \
  --template onepoint-reference \
  --slides content.json \
  --keep-slides 2 \
  --output client-deck.pptx
```

## Data Sources

### Twenty CRM
```markdown
## Pipeline Overview
- table: opportunities
- source: twenty://opportunities?stage=negotiation
- columns: name, amount, probability, closeDate
```

### SharePoint
```markdown
## Document Summary
- source: sharepoint://sites/clients/docs/report.docx
- extract: executive_summary
```

### CSV/Excel
```markdown
## Regional Sales
- chart: pie
- data: /path/to/sales.csv
- columns: region, revenue
```

### Inline Data
```markdown
## Comparison
- chart: bar
- data:
  - Q1: 120
  - Q2: 145  
  - Q3: 132
  - Q4: 178
```

## Image Generation

Use nano-banana-pro to generate images inline:

```markdown
## Our Vision
- ![hero](generate: futuristic cityscape, clean energy, optimistic, corporate presentation style)
- Building tomorrow's solutions
```

Or via JSON:
```json
{
  "title": "Innovation",
  "image": {
    "generate": "abstract technology visualization, blue tones, professional",
    "position": "right",
    "size": "half"
  }
}
```

## Layouts

- `title` — Title slide
- `title_and_content` — Title + bullet points (default)
- `two_column` — Side-by-side content
- `image_and_text` — Image with text
- `chart` — Full chart slide
- `table` — Data table
- `section` — Section divider
- `blank` — Empty slide for custom content

## Charts

Supported chart types:
- `bar` / `bar_stacked`
- `column` / `column_stacked`
- `line` / `line_markers`
- `pie` / `doughnut`
- `area` / `area_stacked`
- `scatter`

## Examples

### Pitch Deck from Topic
```bash
uv run {baseDir}/scripts/create_pptx.py \
  --topic "Series A pitch for AI-powered CRM startup" \
  --slides 10 \
  --template minimal \
  --generate-images \
  --output pitch-deck.pptx
```

### CRM Report
```bash
uv run {baseDir}/scripts/create_pptx.py \
  --topic "Monthly sales report" \
  --data-source "twenty://opportunities" \
  --template corporate \
  --output monthly-report.pptx
```

### From Existing Outline
```bash
uv run {baseDir}/scripts/create_pptx.py \
  --outline /path/to/outline.md \
  --template client-acme \
  --output presentation.pptx
```

## Environment Variables

- `TWENTY_API_URL` — Twenty CRM endpoint
- `TWENTY_API_TOKEN` — Twenty API key
- `SHAREPOINT_*` — SharePoint credentials (see sharepoint skill)
- `GEMINI_API_KEY` — For nano-banana-pro image generation
