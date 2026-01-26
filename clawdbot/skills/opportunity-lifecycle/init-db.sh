#!/bin/bash
# Initialize opportunities.sqlite database with schema (using Python)

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$DB_DIR/opportunities.sqlite"

python3 <<'PYEOF'
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'opportunities.sqlite')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create opportunities table
cursor.execute('''
CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('career', 'business', 'project', 'creative')),
    stage TEXT NOT NULL CHECK(stage IN ('identify', 'research', 'prepare', 'monitor', 'document', 'complete', 'declined')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
)
''')

# Create research_notes table
cursor.execute('''
CREATE TABLE IF NOT EXISTS research_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('who', 'what', 'required', 'context', 'fit')),
    content TEXT NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
)
''')

# Create preparations table
cursor.execute('''
CREATE TABLE IF NOT EXISTS preparations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    prep_type TEXT NOT NULL CHECK(prep_type IN ('interview', 'proposal', 'project', 'meeting', 'other')),
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'done')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
)
''')

# Create actions table
cursor.execute('''
CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
)
''')

# Create learnings table
cursor.execute('''
CREATE TABLE IF NOT EXISTS learnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    learning_type TEXT NOT NULL CHECK(learning_type IN ('what_worked', 'what_didnt', 'insights', 'patterns')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
)
''')

# Create indexes
cursor.execute('CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_research_opportunity ON research_notes(opportunity_id)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_prep_opportunity ON preparations(opportunity_id)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_actions_opportunity ON actions(opportunity_id)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_actions_due ON actions(due_date)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_learnings_opportunity ON learnings(opportunity_id)')

conn.commit()
conn.close()

print(f"Database initialized: {db_path}")
PYEOF

echo "Run 'make-scripts-executable.sh' to make all scripts executable"
