#!/bin/bash
# Update opportunity stage (using Python)

if [ $# -lt 2 ]; then
    echo "Usage: $0 <opportunity_id> <new_stage>"
    echo "Stages: identify, research, prepare, monitor, document, complete, declined"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
OPP_ID="$1"
NEW_STAGE="$2"

python3 - "$DB" "$OPP_ID" "$NEW_STAGE" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
opp_id = sys.argv[2]
new_stage = sys.argv[3]

valid_stages = ['identify', 'research', 'prepare', 'monitor', 'document', 'complete', 'declined']
if new_stage not in valid_stages:
    print(f"Error: Invalid stage '{new_stage}'")
    print(f"Valid stages: {', '.join(valid_stages)}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if opportunity exists
cursor.execute('SELECT COUNT(*) FROM opportunities WHERE id = ?', (opp_id,))
if cursor.fetchone()[0] == 0:
    print(f"Error: Opportunity ID {opp_id} not found")
    sys.exit(1)

# Update stage
cursor.execute('''
UPDATE opportunities
SET stage = ?, updated_at = datetime('now')
WHERE id = ?
''', (new_stage, opp_id))

conn.commit()
conn.close()

print(f"Opportunity {opp_id} updated to stage: {new_stage}")
PYEOF
