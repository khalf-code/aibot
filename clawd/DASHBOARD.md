# DASHBOARD.md - Design System Rules

> This is the single source of truth for dashboard styling.
> **RULE: No new CSS. No inline styles. NO EXCEPTIONS.**

## The Rule

Every dashboard page must use **only**:
1. The existing CSS variables in `design-system.css`
2. The existing utility classes (`.card`, `.btn`, `.grid-*`, etc.)
3. The page template structure below

**Forbidden:**
- Creating new CSS files
- Adding inline `style="..."` attributes
- Hardcoding colors, spacing, or typography
- Adding new classes to CSS

## CSS Variables Reference

### Backgrounds
| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-primary` | `#0a0a0a` | Page background |
| `--bg-secondary` | `#141414` | Cards, sections |
| `--bg-tertiary` | `#1a1a1a` | Elevated elements |
| `--bg-elevated` | `#222222` | Hover states |

### Borders
| Variable | Value | Usage |
|----------|-------|-------|
| `--border-subtle` | `#1f1f1f` | Very light borders |
| `--border-default` | `#2a2a2a` | Standard borders |
| `--border-strong` | `#333333` | Emphasized borders |

### Text
| Variable | Value | Usage |
|----------|-------|-------|
| `--text-primary` | `#f0f0f0` | Main text |
| `--text-secondary` | `#a0a0a0` | Subtitles, descriptions |
| `--text-muted` | `#666666` | Disabled, hints |
| `--text-disabled` | `#444444` | Inactive |

### Accents (Module-Specific)
| Variable | Value | Module |
|----------|-------|--------|
| `--accent-cis` | `#00d4aa` | CIS |
| `--accent-sticker` | `#ff6b6b` | Stickers |
| `--accent-ceramics` | `#c9a87c` | Ceramics |
| `--accent-capture` | `#7ec8a0` | Natural Capture |
| `--accent-system` | `#0088ff` | Dashboard/System |
| `--accent-warning` | `#ffaa00` | Warnings |
| `--accent-error` | `#ff4444` | Errors |
| `--accent-success` | `#00cc66` | Success |

### Spacing
| Variable | Value |
|----------|-------|
| `--space-xs` | `0.25rem` |
| `--space-sm` | `0.5rem` |
| `--space-md` | `1rem` |
| `--space-lg` | `1.5rem` |
| `--space-xl` | `2rem` |

### Border Radius
| Variable | Value |
|----------|-------|
| `--radius-sm` | `4px` |
| `--radius-md` | `6px` |
| `--radius-lg` | `8px` |

## Layout Classes

### Container Structure
```html
<div class="app">
  <header class="app-header">...</header>
  <main class="app-body">...</main>
</div>
```

### Navigation
```html
<nav class="main-nav">
  <a href="/" class="nav-link" data-module="dashboard">🦞 Dashboard</a>
  <a href="/cis.html" class="nav-link active" data-module="cis">CIS</a>
  ...
</nav>
```

### Stats Bar
```html
<div class="stats-bar">
  <div class="stat-card accent-[module]">
    <div class="stat-value">0</div>
    <div class="stat-label">Label</div>
  </div>
</div>
```

### Grid Layouts
| Class | Columns |
|-------|---------|
| `.grid-2` | 2 columns |
| `.grid-3` | 3 columns |
| `.grid-4` | 4 columns |

### Cards
```html
<div class="card mb-lg">
  <div class="card-header">
    <div class="card-title">Title</div>
  </div>
  <div class="card-body">Content</div>
</div>
```

### Buttons
| Class | Style |
|-------|-------|
| `.btn .btn-primary` | Blue filled |
| `.btn .btn-secondary` | Gray outline |
| `.btn .btn-subtle` | Transparent |
| `.btn .btn-sm` | Small size |

### Status Badges
| Class | Color |
|-------|-------|
| `.badge .badge-cis` | Teal |
| `.badge .badge-sticker` | Red |
| `.badge .badge-ceramics` | Gold |
| `.badge .badge-capture` | Green |
| `.badge .badge-pending` | Yellow/Orange |
| `.badge .badge-success` | Green |
| `.badge .badge-error` | Red |
| `.badge .badge-info` | Blue |

### Forms
```html
<div class="form-group">
  <label class="form-label">Label</label>
  <input type="text" class="form-input" placeholder="...">
</div>
<select class="form-select">...</select>
<textarea class="form-textarea">...</textarea>
```

## Page Template

Every new page should follow this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Module - Clawd Dashboard</title>
    <link rel="stylesheet" href="/static/design-system.css">
</head>
<body>
    <div class="app">
        <header class="app-header">
            <div class="app-header-content">
                <nav class="main-nav">
                    <a href="/" class="nav-link">🦞 Dashboard</a>
                    <a href="/module.html" class="nav-link active" data-module="module">Module</a>
                </nav>
                <h1 class="app-title">Module Title</h1>
                <p class="app-subtitle">Subtitle description</p>
            </div>
        </header>

        <main class="app-body">
            <div class="app-content">
                <!-- Stats Bar -->
                <div class="stats-bar">...</div>
                
                <!-- Content Cards -->
                <div class="card mb-lg">...</div>
            </div>
        </main>
    </div>
</body>
</html>
```

## Utility Classes

### Margins
| Class | Effect |
|-------|--------|
| `.mb-0` | No bottom margin |
| `.mb-sm` | Small bottom margin |
| `.mb-md` | Medium bottom margin |
| `.mb-lg` | Large bottom margin |
| `.mb-xl` | Extra large bottom margin |

### Flexbox
| Class | Effect |
|-------|--------|
| `.flex` | Display flex |
| `.flex-col` | Column direction |
| `.items-center` | Center align items |
| `.justify-between` | Space between |
| `.gap-sm` | Small gap |
| `.gap-md` | Medium gap |
| `.gap-lg` | Large gap |

### Text
| Class | Effect |
|-------|--------|
| `.text-muted` | Muted color |
| `.text-secondary` | Secondary color |
| `.text-primary` | Primary color |
| `.text-center` | Center aligned |
| `.text-right` | Right aligned |

## Violation Detection

**Signs someone broke the rules:**
- New CSS files in `dashboard/static/`
- `style="..."` attributes in HTML
- Colors like `#fff` or `white` hardcoded
- New margin/padding values not using `--space-*`
- Inline `<style>` tags

**Pre-commit checklist:**
- [ ] No new CSS files created
- [ ] No inline `style=` attributes
- [ ] All colors use CSS variables
- [ ] All spacing uses `--space-*`
- [ ] Navigation uses `.nav-link` classes
- [ ] Cards use `.card` structure
- [ ] Buttons use `.btn` classes

## Examples

### Good (follows rules):
```html
<div class="card mb-lg">
  <div class="card-body">
    <div class="flex gap-md">
      <button class="btn btn-primary">Save</button>
      <button class="btn btn-subtle">Cancel</button>
    </div>
  </div>
</div>
```

### Bad (violates rules):
```html
<div style="background:#1a1a1a; margin-bottom:20px; border-radius:8px">
  <div style="padding:20px">
    <button style="background:#0088ff; color:white">Save</button>
  </div>
</div>
```

## Enforcement

This file is self-documenting and enforced by convention.
When adding new pages:
1. Copy the page template above
2. Use only existing classes
3. Reference CSS variables from this doc
4. Check against pre-commit checklist
5. Never create new CSS

**Violations should be caught in code review.**
