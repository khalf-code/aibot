#!/bin/bash
# Add learning (using Python)

if [ $# -lt 3 ]; then
    echo "Usage: $0 <opportunity_id> <learning_type> <content>"
    echo "Learning types: what_worked, what_didnt, insights, patterns"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
OPP_ID="$1"
LEARNING_TYPE="$2"
CONTENT="$3"

python3 - "$DB" "$OPP_ID" "$LEARNING_TYPE" "$CONTENT" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
opp_id = sys.argv[2]
learning_type = sys.argv[3]
content = sys.argv[4]

valid_types = ['what_worked', 'what_didnt', 'insights', 'patterns']
if learning_type not in valid_types:
    print(f"Error: Invalid learning type '{learning_type}'")
    print(f"Valid learning types: {', '.join(valid_types)}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if opportunity exists
cursor.execute('SELECT COUNT(*) FROM opportunities WHERE id = ?', (opp_id,))
if cursor.fetchone()[0] == 0:
    print(f"Error: Opportunity ID {opp_id} not found")
    sys.exit(1)

# Add learning
cursor.execute('''
INSERT INTO learnings (opportunity_id, learning_type, content)
VALUES (?, ?, ?)
''', (opp_id, learning_type, content))

# Update opportunity timestamp
cursor.execute('''
UPDATE opportunities
SET updated_at = datetime('now')
WHERE id = ?
''', (opp_id,))

conn.commit()
conn.close()

print(f"Learning added to opportunity {opp_id}")
print(f"Type: {learning_type}")
PYEOF
