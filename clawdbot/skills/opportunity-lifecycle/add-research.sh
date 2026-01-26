#!/bin/bash
# Add research notes (using Python)

if [ $# -lt 3 ]; then
    echo "Usage: $0 <opportunity_id> <category> <content> [source]"
    echo "Categories: who, what, required, context, fit"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
OPP_ID="$1"
CATEGORY="$2"
CONTENT="$3"
SOURCE="${4:-}"

python3 - "$DB" "$OPP_ID" "$CATEGORY" "$CONTENT" "$SOURCE" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
opp_id = sys.argv[2]
category = sys.argv[3]
content = sys.argv[4]
source = sys.argv[5] if len(sys.argv) > 5 else None

valid_categories = ['who', 'what', 'required', 'context', 'fit']
if category not in valid_categories:
    print(f"Error: Invalid category '{category}'")
    print(f"Valid categories: {', '.join(valid_categories)}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if opportunity exists
cursor.execute('SELECT COUNT(*) FROM opportunities WHERE id = ?', (opp_id,))
if cursor.fetchone()[0] == 0:
    print(f"Error: Opportunity ID {opp_id} not found")
    sys.exit(1)

# Add research note
cursor.execute('''
INSERT INTO research_notes (opportunity_id, category, content, source)
VALUES (?, ?, ?, ?)
''', (opp_id, category, content, source))

# Update opportunity timestamp
cursor.execute('''
UPDATE opportunities
SET updated_at = datetime('now')
WHERE id = ?
''', (opp_id,))

conn.commit()
conn.close()

print(f"Research note added to opportunity {opp_id}")
print(f"Category: {category}")
PYEOF
