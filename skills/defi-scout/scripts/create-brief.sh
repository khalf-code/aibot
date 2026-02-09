#!/usr/bin/env bash
set -euo pipefail

# Create a structured opportunity brief from JSON on stdin
# Usage: echo '{"type":"yield_gap",...}' | ./create-brief.sh

BRIEFS_DIR="${OPENCLAW_HOME:-$HOME/.openclaw}/briefs"
mkdir -p "$BRIEFS_DIR"

INPUT=$(cat)

node -e "
const input = JSON.parse('${INPUT//\'/\\\'}');
const id = require('crypto').randomUUID();
const brief = {
  id,
  ...input,
  createdAt: new Date().toISOString(),
  status: 'draft',
};

const required = ['type','title','summary','riskScore','confidence','protocols','chains','reasoning'];
const missing = required.filter(k => !(k in brief));
if (missing.length) {
  console.error(JSON.stringify({ error: 'Missing fields: ' + missing.join(', ') }));
  process.exit(1);
}

const fs = require('fs');
const dir = '${BRIEFS_DIR}';
fs.writeFileSync(dir + '/' + id + '.json', JSON.stringify(brief, null, 2));
console.log(JSON.stringify({ success: true, id, path: dir + '/' + id + '.json' }));
"
