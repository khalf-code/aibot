#!/bin/bash
# Create new opportunity (using Python)

if [ $# -lt 2 ]; then
    echo "Usage: $0 <title> <type>"
    echo "Types: career, business, project, creative"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
TITLE="$1"
TYPE="$2"

python3 - "$DB" "$TITLE" "$TYPE" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
title = sys.argv[2]
type_val = sys.argv[3]

valid_types = ['career', 'business', 'project', 'creative']
if type_val not in valid_types:
    print(f"Error: Invalid type '{type_val}'")
    print(f"Valid types: {', '.join(valid_types)}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute('''
INSERT INTO opportunities (title, type, stage)
VALUES (?, ?, 'identify')
''', (title, type_val))

conn.commit()
opp_id = cursor.lastrowid
conn.close()

print(f"Opportunity created: ID={opp_id}")
print(f"Title: {title}")
print(f"Type: {type_val}")
print(f"Stage: identify")
print()
print("Next steps:")
print(f"  ./update-stage.sh {opp_id} research    - Start researching")
print(f"  ./add-research.sh {opp_id} <category> <content> [source]")
PYEOF
