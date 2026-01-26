#!/bin/bash
# Add preparation notes (using Python)

if [ $# -lt 3 ]; then
    echo "Usage: $0 <opportunity_id> <prep_type> <content>"
    echo "Prep types: interview, proposal, project, meeting, other"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
OPP_ID="$1"
PREP_TYPE="$2"
CONTENT="$3"

python3 - "$DB" "$OPP_ID" "$PREP_TYPE" "$CONTENT" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
opp_id = sys.argv[2]
prep_type = sys.argv[3]
content = sys.argv[4]

valid_preps = ['interview', 'proposal', 'project', 'meeting', 'other']
if prep_type not in valid_preps:
    print(f"Error: Invalid prep type '{prep_type}'")
    print(f"Valid prep types: {', '.join(valid_preps)}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if opportunity exists
cursor.execute('SELECT COUNT(*) FROM opportunities WHERE id = ?', (opp_id,))
if cursor.fetchone()[0] == 0:
    print(f"Error: Opportunity ID {opp_id} not found")
    sys.exit(1)

# Add preparation
cursor.execute('''
INSERT INTO preparations (opportunity_id, prep_type, content)
VALUES (?, ?, ?)
''', (opp_id, prep_type, content))

# Update opportunity timestamp
cursor.execute('''
UPDATE opportunities
SET updated_at = datetime('now')
WHERE id = ?
''', (opp_id,))

conn.commit()
conn.close()

print(f"Preparation added to opportunity {opp_id}")
print(f"Type: {prep_type}")
PYEOF
