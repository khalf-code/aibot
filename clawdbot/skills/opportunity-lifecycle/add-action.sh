#!/bin/bash
# Add action item (using Python)

if [ $# -lt 2 ]; then
    echo "Usage: $0 <opportunity_id> <action> [due_date]"
    echo "Due date format: YYYY-MM-DD (optional)"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
OPP_ID="$1"
ACTION="$2"
DUE_DATE="${3:-}"

python3 - "$DB" "$OPP_ID" "$ACTION" "$DUE_DATE" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
opp_id = sys.argv[2]
action = sys.argv[3]
due_date = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '' else None

# Validate due date if provided
if due_date:
    import re
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', due_date):
        print("Error: Invalid due date format. Use YYYY-MM-DD")
        sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if opportunity exists
cursor.execute('SELECT COUNT(*) FROM opportunities WHERE id = ?', (opp_id,))
if cursor.fetchone()[0] == 0:
    print(f"Error: Opportunity ID {opp_id} not found")
    sys.exit(1)

# Add action
cursor.execute('''
INSERT INTO actions (opportunity_id, action, due_date)
VALUES (?, ?, ?)
''', (opp_id, action, due_date))

# Update opportunity timestamp
cursor.execute('''
UPDATE opportunities
SET updated_at = datetime('now')
WHERE id = ?
''', (opp_id,))

conn.commit()
conn.close()

print(f"Action added to opportunity {opp_id}")
print(f"Action: {action}")
if due_date:
    print(f"Due: {due_date}")
PYEOF
