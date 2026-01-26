-- PARA Task Management Schema

CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active', -- active, archived
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    area_id TEXT,
    goal TEXT,
    deadline INTEGER,
    status TEXT DEFAULT 'active', -- active, completed, cancelled, archived
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER,
    FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- P (Project), A (Area), R (Resource), X (Archive)
    project_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    priority INTEGER DEFAULT 3, -- 1 (high) to 4 (low)
    start_date INTEGER, -- when to start showing the task
    due_date INTEGER, -- deadline
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Seed some default areas
INSERT OR IGNORE INTO areas (id, name, description) VALUES ('work', 'PuenteWorks', 'Business and professional growth');
INSERT OR IGNORE INTO areas (id, name, description) VALUES ('personal', 'Personal', 'Health, family, and hobbies');
INSERT OR IGNORE INTO areas (id, name, description) VALUES ('learning', 'Learning', 'Skills and knowledge acquisition');
INSERT OR IGNORE INTO areas (id, name, description) VALUES ('ceramics', 'Cerafica Design', 'Tactile ceramic work');
