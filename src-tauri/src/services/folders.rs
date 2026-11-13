//! Named folders that group screenshots; names are unique ignoring case.
use rusqlite::Connection;

use crate::db;
use crate::domain::{Folder, FolderSort};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const MAX_NAME_CHARS: usize = 80;

pub fn list(state: &AppState, sort: FolderSort, archived: bool) -> AppResult<Vec<Folder>> {
    Ok(db::folders::list(&*state.db()?, sort, archived)?)
}

pub fn create(state: &AppState, name: &str) -> AppResult<Folder> {
    let name = valid_name(name)?;
    let db = state.db()?;
    let id = db::folders::insert(&db, name).map_err(|err| name_conflict(err, name))?;
    get(&db, id)
}

pub fn rename(state: &AppState, id: i64, name: &str) -> AppResult<Folder> {
    let name = valid_name(name)?;
    let db = state.db()?;
    get(&db, id)?;
    db::folders::rename(&db, id, name).map_err(|err| name_conflict(err, name))?;
    get(&db, id)
}

pub fn set_archived(state: &AppState, id: i64, archived: bool) -> AppResult<Folder> {
    let db = state.db()?;
    get(&db, id)?;
    db::folders::set_archived(&db, id, archived)?;
    get(&db, id)
}

/// The folder, or NotFound.
pub fn get(db: &Connection, id: i64) -> AppResult<Folder> {
    db::folders::find(db, id)?.ok_or(AppError::NotFound("Folder"))
}

fn valid_name(name: &str) -> AppResult<&str> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > MAX_NAME_CHARS {
        return Err(AppError::invalid(format!(
            "Folder name must be 1 to {MAX_NAME_CHARS} characters"
        )));
    }
    Ok(name)
}

fn name_conflict(err: rusqlite::Error, name: &str) -> AppError {
    if db::is_unique_violation(&err) {
        AppError::invalid(format!("A folder named \"{name}\" already exists"))
    } else {
        err.into()
    }
}
