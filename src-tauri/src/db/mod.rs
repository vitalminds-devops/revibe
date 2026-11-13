//! SQLite access: the schema here, one module of queries per table.
pub mod folders;
pub mod screenshots;

use std::path::Path;

use rusqlite::Connection;

const SCHEMA: &str = "
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at TEXT -- hidden from the main list
);
CREATE TABLE IF NOT EXISTS screenshots (
  id INTEGER PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  image_key TEXT,        -- NULL for pasted text
  source TEXT NOT NULL,  -- upload | screen | text
  text TEXT,             -- pasted report text, read instead of an image
  extra_image_keys TEXT, -- JSON list: more images of the same message, after image_key in reading order
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  fields TEXT,           -- JSON object
  report TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS screenshots_folder_id ON screenshots(folder_id);
";

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    migrate(Connection::open(path)?)
}

#[cfg(test)]
pub fn open_in_memory() -> rusqlite::Result<Connection> {
    migrate(Connection::open_in_memory()?)
}

fn migrate(db: Connection) -> rusqlite::Result<Connection> {
    db.execute_batch(SCHEMA)?;
    Ok(db)
}

pub fn is_unique_violation(err: &rusqlite::Error) -> bool {
    matches!(err, rusqlite::Error::SqliteFailure(f, _) if f.code == rusqlite::ErrorCode::ConstraintViolation)
}
