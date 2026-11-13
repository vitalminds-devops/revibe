//! Queries on the screenshots table (screenshots and pasted texts, with their reports).
use rusqlite::{Connection, OptionalExtension, Result, Row, params};

use crate::domain::{Fields, Shot};

const SELECT: &str = "SELECT id, folder_id, image_key, extra_image_keys, source, text, created_at, fields, report, error
  FROM screenshots";

fn from_row(r: &Row) -> Result<Shot> {
    // JSON columns: a value that doesn't parse reads as empty rather than failing the whole list.
    let json = |i: usize| -> Result<Option<String>> { r.get(i) };
    Ok(Shot {
        id: r.get(0)?,
        folder_id: r.get(1)?,
        image_key: r.get(2)?,
        extra_image_keys: json(3)?
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default(),
        source: r.get(4)?,
        text: r.get(5)?,
        created_at: r.get(6)?,
        fields: json(7)?.and_then(|s| serde_json::from_str(&s).ok()),
        report: r.get(8)?,
        error: r.get(9)?,
    })
}

/// Newest first, as the item grid shows them.
pub fn list(db: &Connection, folder_id: i64) -> Result<Vec<Shot>> {
    let sql = format!("{SELECT} WHERE folder_id = ?1 ORDER BY created_at DESC, id DESC");
    db.prepare(&sql)?
        .query_map([folder_id], from_row)?
        .collect()
}

/// Items with a report, oldest first, as the Excel export lists them.
pub fn list_reported(db: &Connection, folder_id: i64) -> Result<Vec<Shot>> {
    let sql =
        format!("{SELECT} WHERE folder_id = ?1 AND report IS NOT NULL ORDER BY created_at, id");
    db.prepare(&sql)?
        .query_map([folder_id], from_row)?
        .collect()
}

pub fn find(db: &Connection, id: i64) -> Result<Option<Shot>> {
    db.query_row(&format!("{SELECT} WHERE id = ?1"), [id], from_row)
        .optional()
}

pub fn insert(
    db: &Connection,
    folder_id: i64,
    image_key: Option<&str>,
    source: &str,
    text: Option<&str>,
) -> Result<i64> {
    db.execute(
        "INSERT INTO screenshots (folder_id, image_key, source, text) VALUES (?1, ?2, ?3, ?4)",
        params![folder_id, image_key, source, text],
    )?;
    Ok(db.last_insert_rowid())
}

pub fn delete(db: &Connection, id: i64) -> Result<()> {
    db.execute("DELETE FROM screenshots WHERE id = ?1", [id])?;
    Ok(())
}

/// Stores a generation outcome: fields and report, or the reason the item couldn't be read.
pub fn save_result(
    db: &Connection,
    id: i64,
    fields: Option<&Fields>,
    report: Option<&str>,
    error: Option<&str>,
) -> Result<()> {
    let fields = fields.map(|f| serde_json::to_string(f).expect("a JSON map serializes"));
    db.execute(
        "UPDATE screenshots SET fields = ?1, report = ?2, error = ?3 WHERE id = ?4",
        params![fields, report, error, id],
    )?;
    Ok(())
}

/// Gives `into` the extra image keys and removes the merged items, clearing the old report.
pub fn merge(
    db: &mut Connection,
    into: i64,
    extra_image_keys: &[String],
    merged: &[i64],
) -> Result<()> {
    let tx = db.transaction()?;
    tx.execute(
        "UPDATE screenshots SET extra_image_keys = ?1, fields = NULL, report = NULL, error = NULL WHERE id = ?2",
        params![serde_json::to_string(extra_image_keys).expect("strings serialize"), into],
    )?;
    for id in merged {
        tx.execute("DELETE FROM screenshots WHERE id = ?1", [id])?;
    }
    tx.commit()
}
