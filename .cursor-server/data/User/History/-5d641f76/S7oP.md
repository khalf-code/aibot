---
name: Restore APEX Rules and Bug Comorbidity Skill
overview: Restore the APEX v4.4.1 ruleset and the bug-comorbidity skill from the migration bundle to the local workspace as specified in SOUL.md.
todos:
  - id: create-apex-dir
    content: Create ~/clawd/apex directory
    status: pending
  - id: copy-apex-vault
    content: Copy APEX vault from migration bundle
    status: pending
  - id: verify-skill
    content: Verify bug-comorbidity skill is present
    status: pending
isProject: false
---

# Restore APEX Rules and Bug Comorbidity Skill

## Problem

The APEX v4.4.1 ruleset and several advanced skills (including `bug-comorbidity`) are missing from the local workspace (`~/clawd/apex/`). These were located in the migration bundle on the Windows desktop but were not fully transferred during the initial migration.

## Solution

Copy the full `apex` directory from the migration bundle to its expected location in the Linux home directory.

### Step 1: Copy APEX Vault

Copy the entire `apex` folder from the Windows desktop bundle to `~/clawd/apex/`.

```bash
mkdir -p ~/clawd/apex
cp -r "/mnt/c/Users/Simon/Desktop/liam-export-bundle-20260124/apex/"* ~/clawd/apex/
```

### Step 2: Verify Restoration

Confirm that the APEX rules and skills are correctly placed.

```bash
ls -la ~/clawd/apex/
ls -la ~/clawd/apex/skills/bug-comorbidity/
```

### Step 3: Update Search Indices (If needed)

Once restored, the `clawdbot memory search` should be able to index these files if configured to watch `~/clawd`.

## Files Impacted

- New directory: `/home/liam/clawd/apex/`
- Includes: `APEX_CORE.md`, `APEX_DESIGN.md`, `APEX_SDLC.md`, and all skills in `~/clawd/apex/skills/`.