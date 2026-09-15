-- Çizelge oy veritabanı (D1).
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school TEXT NOT NULL,
  code TEXT NOT NULL,
  instructor TEXT,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  workload INTEGER NOT NULL CHECK (workload BETWEEN 1 AND 5),
  again INTEGER NOT NULL CHECK (again IN (0, 1)),
  device TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (school, code, device)
);
CREATE INDEX IF NOT EXISTS votes_school_code ON votes (school, code);
CREATE INDEX IF NOT EXISTS votes_ip ON votes (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS votes_device ON votes (device);
