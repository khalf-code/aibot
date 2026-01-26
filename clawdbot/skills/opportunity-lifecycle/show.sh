#!/bin/bash
# Show opportunity details (using Python)

if [ $# -lt 1 ]; then
    echo "Usage: $0 <opportunity_id>"
    exit 1
fi

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"
OPP_ID="$1"

python3 - "$DB" "$OPP_ID" <<'PYEOF'
import sqlite3
import sys

db_path = sys.argv[1]
opp_id = sys.argv[2]

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if opportunity exists
cursor.execute('SELECT COUNT(*) FROM opportunities WHERE id = ?', (opp_id,))
if cursor.fetchone()[0] == 0:
    print(f"Error: Opportunity ID {opp_id} not found")
    sys.exit(1)

print("=" * 50)
print(f"Opportunity: {opp_id}")
print("=" * 50)

# Basic info
cursor.execute('''
SELECT title, type, stage, status, datetime(created_at), datetime(updated_at), notes
FROM opportunities
WHERE id = ?
''', (opp_id,))
row = cursor.fetchone()
if row:
    print(f"Title: {row[0]}")
    print(f"Type: {row[1]}")
    print(f"Stage: {row[2]}")
    print(f"Status: {row[3]}")
    print(f"Created: {row[4]}")
    print(f"Updated: {row[5]}")
    print()
    print("Notes:")
    if row[6]:
        print(f"  {row[6]}")
    else:
        print("  (no notes)")

print()
print("=" * 50)
print("Research Notes")
print("=" * 50)
cursor.execute('''
SELECT category, content, source
FROM research_notes
WHERE opportunity_id = ?
ORDER BY created_at
''', (opp_id,))
rows = cursor.fetchall()
if rows:
    for r in rows:
        print(f"[{r[0]}] {r[1]}")
        if r[2]:
            print(f"  (Source: {r[2]})")
else:
    print("  (no research notes)")

print()
print("=" * 50)
print("Preparations")
print("=" * 50)
cursor.execute('''
SELECT prep_type, content, status
FROM preparations
WHERE opportunity_id = ?
ORDER BY created_at
''', (opp_id,))
rows = cursor.fetchall()
if rows:
    for r in rows:
        print(f"[{r[0]}] {r[1]}")
        print(f"  Status: {r[2]}")
else:
    print("  (no preparations)")

print()
print("=" * 50)
print("Action Items")
print("=" * 50)
cursor.execute('''
SELECT action, status, due_date
FROM actions
WHERE opportunity_id = ?
ORDER BY
    CASE status
        WHEN 'completed' THEN 2
        ELSE 1
    END,
    CASE
        WHEN due_date IS NOT NULL THEN due_date
        ELSE '9999-12-31'
    END
''', (opp_id,))
rows = cursor.fetchall()
if rows:
    for r in rows:
        print(f"[{r[1]}] {r[0]}")
        if r[2]:
            print(f"  Due: {r[2]}")
else:
    print("  (no action items)")

print()
print("=" * 50)
print("Learnings")
print("=" * 50)
cursor.execute('''
SELECT learning_type, content
FROM learnings
WHERE opportunity_id = ?
ORDER BY created_at
''', (opp_id,))
rows = cursor.fetchall()
if rows:
    for r in rows:
        print(f"[{r[0]}] {r[1]}")
else:
    print("  (no learnings)")

conn.close()
PYEOF
