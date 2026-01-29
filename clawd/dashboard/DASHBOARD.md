# Dashboard Design System Rules

**Version:** 1.0  
**Date:** 2026-01-29  
**Status:** ACTIVE

---

## THE RULE

> **All dashboard additions MUST use the existing design system. No exceptions.**

When adding anything to the dashboard:
- ❌ NO new CSS files
- ❌ NO inline `<style>` blocks
- ❌ NO inline `style="..."` attributes
- ❌ NO new color values (use CSS vars only)
- ❌ NO new spacing values (use CSS vars only)
- ❌ NO gradients
- ❌ NO arbitrary border-radius values
- ✅ ONLY `design-system.css` classes
- ✅ ONLY CSS custom properties from the system
- ✅ ONLY utility classes defined in the system

---

## DESIGN SYSTEM REFERENCE

**Single Source of Truth:** `/static/design-system.css`

### CSS Variables (The Only Colors Allowed)
```css
/* Backgrounds */
--bg-primary: #0a0a0a
--bg-secondary: #141414
--bg-tertiary: #1a1a1a
--bg-elevated: #222222

/* Borders */
--border-subtle: #1f1f1f
--border-default: #2a2a2a
--border-strong: #333333

/* Text */
--text-primary: #f0f0f0
--text-secondary: #a0a0a0
--text-muted: #666666
--text-disabled: #444444

/* Module Accents */
--accent-system: #0088ff   /* Dashboard */
--accent-cis: #00d4aa      /* CIS */
--accent-sticker: #ff6b6b  /* Stickers */
--accent-ceramics: #c9a87c /* Ceramics */
--accent-capture: #7ec8a0  /* Natural Capture */
--accent-warning: #ffaa00
--accent-error: #ff4444
--accent-success: #00cc66

/* Spacing (rem only) */
--space-xs: 0.25rem
--space-sm: 0.5rem
--space-md: 1rem
--space-lg: 1.5rem
--space-xl: 2rem

/* Radius (px only) */
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
```

### Layout Classes
```
.app, .app-header, .app-body, .app-content
.main-nav, .nav-link
.stats-bar, .stat-card
.grid-2, .grid-3, .grid-4
.card, .card-header, .card-body, .card-title
.card-subdued (muted background variant)
.table-container
table, th, td
```

### Component Classes
```
.badge           (base)
.badge-pill      (rounded)
.badge-subtle    (muted)
.badge-cis, .badge-sticker, .badge-ceramics, .badge-capture
.badge-pending, .badge-success, .badge-error, .badge-info

.btn
.btn-primary, .btn-secondary, .btn-subtle
.btn-sm, .btn-lg

.form-group, .form-label
.form-input, .form-select, .form-textarea
```

### Utility Classes
```
/* Text */
.text-primary, .text-secondary, .text-muted
.text-center, .text-right

/* Spacing */
.mb-0, .mb-sm, .mb-md, .mb-lg, .mb-xl

/* Flex */
.flex, .flex-col
.items-center, .justify-between
.gap-sm, .gap-md, .gap-lg
```

---

## PAGE TEMPLATE

Every new page MUST follow this exact structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Module Name] - Clawd Dashboard</title>
    <link rel="stylesheet" href="/static/design-system.css">
</head>
<body>
    <div class="app">
        <header class="app-header">
            <div class="app-header-content">
                <nav class="main-nav">
                    <a href="/" class="nav-link" data-module="dashboard">🦞 Dashboard</a>
                    <a href="/cis.html" class="nav-link" data-module="cis">CIS</a>
                    <a href="/sticker-business.html" class="nav-link" data-module="sticker">Stickers</a>
                    <a href="/ceramics-intelligence.html" class="nav-link" data-module="ceramics">Ceramics</a>
                    <a href="/natural-capture.html" class="nav-link active" data-module="capture">Capture</a>
                </nav>
                <h1 class="app-title">[Module Title]</h1>
                <p class="app-subtitle">[Subtitle]</p>
            </div>
        </header>
        <main class="app-body">
            <div class="app-content">
                <!-- Content here -->
            </div>
        </main>
    </div>
</body>
</html>
```

---

## VIOLATION DETECTION

If you see any of these, it's a violation:

| Violation | Correct Fix |
|-----------|-------------|
| `style="color: #fff"` | Add to design-system.css as utility class |
| `<style> ... </style>` | Extract to design-system.css |
| `newfile.css` | Move contents to design-system.css |
| `border-radius: 12px` | Use `--radius-md` (6px) or `--radius-lg` (8px) |
| `margin: 20px` | Use `--space-md` (1rem) |
| `background: linear-gradient(...)` | Use flat `--bg-*` colors |
| `color: #667eea` | Use accent variable like `--accent-system` |

---

## MODULE ACCENT ASSIGNMENT

New modules get an accent. Use these in order:
1. Already assigned: Dashboard (blue), CIS (teal), Stickers (coral), Ceramics (gold), Capture (sage)
2. Available: Use a new color in the muted pastel range

Apply accents via:
- `.accent-[module]` on stat cards
- `.badge-[module]` on badges
- Border-left on cards with accent color

---

## EXPANDING THE SYSTEM

If you NEED something not in the system:

1. **Check if it exists** - Look through design-system.css thoroughly
2. **Consider if it's needed** - Can existing classes work?
3. **If truly needed:**
   - Add to `design-system.css` in the appropriate section
   - Follow existing naming conventions
   - Use CSS variables for values
   - Document in this file
   - Keep it minimal

---

## PRE-COMMIT CHECKLIST

Before committing dashboard changes:

- [ ] No new CSS files created
- [ ] No inline style attributes
- [ ] No inline style blocks
- [ ] No hardcoded colors (only CSS vars)
- [ ] No hardcoded spacing (only CSS vars)
- [ ] All pages use same nav structure
- [ ] All cards use .card classes
- [ ] Stats use .stats-bar pattern
- [ ] Tables use .table-container

---

## FILES THAT MATTER

| File | Purpose | Protected? |
|------|---------|------------|
| `templates/*.html` | Page templates | No - use system |
| `static/design-system.css` | **Canonical styles** | **Yes - extend only** |
| `static/app.js` | Shared JS | No - use system |
| `start.py` | Server | No |

---

*This rule is binding. Violations will be rejected.*
