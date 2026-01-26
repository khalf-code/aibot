#!/bin/bash
# List opportunities (using Python)

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
FILTER="${1:-active}"

python3 - "$DB" "$FILTER" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
filter_arg = sys.argv[2]

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

if filter_arg == "active":
    where = "status = 'active'"
elif filter_arg == "all":
    where = "1=1"
elif filter_arg.startswith("stage:"):
    stage = filter_arg.split(":", 1)[1]
    where = f"stage = '{stage}'"
else:
    where = "status = 'active'"

cursor.execute(f'''
SELECT
    id,
    title,
    type,
    stage,
    status,
    datetime(updated_at)
FROM opportunities
WHERE {where}
ORDER BY updated_at DESC
''')

rows = cursor.fetchall()
if not rows:
    print("No opportunities found.")
else:
    # Print header
    print(f"{'ID':<5} {'Title':<30} {'Type':<10} {'Stage':<10} {'Status':<10} {'Updated':<20}")
    print("-" * 85)
    for row in rows:
        print(f"{row[0]:<5} {row[1][:30]:<30} {row[2]:<10} {row[3]:<10} {row[4]:<10} {row[5][:20]:<20}")

conn.close()
PYEOF
