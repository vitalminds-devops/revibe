//! Queries on the folders table, with each folder's screenshot, report and pending counts.
use rusqlite::{Connection, OptionalExtension, Result, Row, params};

use crate::domain::{Folder, FolderSort};

const SELECT: &str = "SELECT f.id, f.name, f.created_at, f.archived_at IS NOT NULL,
  COUNT(s.id), COUNT(s.report), COUNT(s.id) FILTER (WHERE s.report IS NULL AND s.error IS NULL)
  FROM folders f LEFT JOIN screenshots s ON s.folder_id = f.id";

fn from_row(r: &Row) -> Result<Folder> {
    Ok(Folder {
        id: r.get(0)?,
        name: r.get(1)?,
        created_at: r.get(2)?,
        archived: r.get(3)?,
        screenshots: r.get(4)?,
        reports: r.get(5)?,
        pending: r.get(6)?,
    })
}

pub fn list(db: &Connection, sort: FolderSort, archived: bool) -> Result<Vec<Folder>> {
    let filter = if archived { "IS NOT NULL" } else { "IS NULL" };
    let order = match sort {
        FolderSort::Newest => "f.created_at DESC, f.id DESC",
        FolderSort::Name => "f.name COLLATE NOCASE, f.id",
    };
    let sql = format!("{SELECT} WHERE f.archived_at {filter} GROUP BY f.id ORDER BY {order}");
    db.prepare(&sql)?.query_map([], from_row)?.collect()
}

pub fn find(db: &Connection, id: i64) -> Result<Option<Folder>> {
    db.query_row(
        &format!("{SELECT} WHERE f.id = ?1 GROUP BY f.id"),
        [id],
        from_row,
    )
    .optional()
}

pub fn insert(db: &Connection, name: &str) -> Result<i64> {
    db.execute("INSERT INTO folders (name) VALUES (?1)", [name])?;
    Ok(db.last_insert_rowid())
}

pub fn rename(db: &Connection, id: i64, name: &str) -> Result<()> {
    db.execute(
        "UPDATE folders SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    Ok(())
}

pub fn set_archived(db: &Connection, id: i64, archived: bool) -> Result<()> {
    let sql = if archived {
        "UPDATE folders SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1"
    } else {
        "UPDATE folders SET archived_at = NULL WHERE id = ?1"
    };
    db.execute(sql, [id])?;
    Ok(())
}
