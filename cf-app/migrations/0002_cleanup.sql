-- BIAI Corporate Intelligence — data-cleaning support (migration 0002).
-- cleanup_log stores a full snapshot of every lead row BEFORE a cleaning
-- action (edit, delete, merge, bulk clean) so any action can be undone.

CREATE TABLE IF NOT EXISTS cleanup_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  action       TEXT NOT NULL,              -- 'edit' | 'delete' | 'merge' | 'bulk_clean'
  summary      TEXT NOT NULL,              -- human-readable one-liner for the UI
  target_ids   TEXT NOT NULL,              -- JSON array of lead ids affected
  deleted_ids  TEXT NOT NULL DEFAULT '[]', -- JSON array of lead ids removed
  snapshot     TEXT NOT NULL,              -- JSON array of full pre-action lead rows
  performed_by TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cleanup_log_created ON cleanup_log(created_at);
