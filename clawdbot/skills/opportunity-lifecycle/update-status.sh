#!/bin/bash
# Update opportunity status (using Python)

if [ $# -lt 2 ]; then
    echo "Usage: $0 <opportunity_id> <new_status>"
    echo "Statuses: active, paused, closed"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
OPP_ID="$1"
NEW_STATUS="$2"

python3 - "$DB" "$OPP_ID" "$NEW_STATUS" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
opp_id = sys.argv[2]
new_status = sys.argv[3]

valid_statuses = ['active', 'paused', 'closed']
if new_status not in valid_statuses:
    print(f"Error: Invalid status '{new_status}'")
    print(f"Valid statuses: {', '.join(valid_statuses)}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if opportunity exists
cursor.execute('SELECT COUNT(*) FROM opportunities WHERE id = ?', (opp_id,))
if cursor.fetchone()[0] == 0:
    print(f"Error: Opportunity ID {opp_id} not found")
    sys.exit(1)

# Update status
cursor.execute('''
UPDATE opportunities
SET status = ?, updated_at = datetime('now')
WHERE id = ?
''', (new_status, opp_id))

conn.commit()
conn.close()

print(f"Opportunity {opp_id} status updated to: {new_status}")
PYEOF
