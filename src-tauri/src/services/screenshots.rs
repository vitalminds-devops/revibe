//! Adding, deleting and combining items: screenshot images and pasted report texts.
use rusqlite::Connection;

use crate::db;
use crate::domain::{SOURCE_SCREEN, SOURCE_TEXT, SOURCE_UPLOAD, Shot};
use crate::error::{AppError, AppResult};
use crate::services::folders;
use crate::state::AppState;

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const MAX_TEXT_CHARS: usize = 12000;
const COMBINE_RANGE: std::ops::RangeInclusive<usize> = 2..=10;

pub fn list(state: &AppState, folder_id: i64) -> AppResult<Vec<Shot>> {
    let db = state.db()?;
    folders::get(&db, folder_id)?;
    Ok(db::screenshots::list(&db, folder_id)?)
}

pub fn upload(state: &AppState, folder_id: i64, source: &str, bytes: &[u8]) -> AppResult<Shot> {
    if source != SOURCE_UPLOAD && source != SOURCE_SCREEN {
        return Err(AppError::invalid("unknown source"));
    }
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(AppError::invalid("Image must be at most 10 MB"));
    }
    let not_image = |_| AppError::invalid("Upload a valid image file");
    let format = image::guess_format(bytes).map_err(not_image)?;
    image::load_from_memory_with_format(bytes, format).map_err(not_image)?;

    let db = state.db()?;
    folders::get(&db, folder_id)?;
    let key = state
        .images
        .save(folder_id, bytes, format.extensions_str()[0])?;
    let id = db::screenshots::insert(&db, folder_id, Some(&key), source, None)?;
    get(&db, id)
}

pub fn add_text(state: &AppState, folder_id: i64, text: &str) -> AppResult<Shot> {
    let text = text.trim();
    if text.is_empty() || text.chars().count() > MAX_TEXT_CHARS {
        return Err(AppError::invalid(format!(
            "Text must be 1 to {MAX_TEXT_CHARS} characters"
        )));
    }
    let db = state.db()?;
    folders::get(&db, folder_id)?;
    let id = db::screenshots::insert(&db, folder_id, None, SOURCE_TEXT, Some(text))?;
    get(&db, id)
}

pub fn delete(state: &AppState, id: i64) -> AppResult<()> {
    let db = state.db()?;
    let shot = get(&db, id)?;
    // Files first: if one can't be removed, the record stays and can be deleted again.
    for key in shot.image_keys() {
        state.images.delete(&key)?;
    }
    Ok(db::screenshots::delete(&db, id)?)
}

/// Merges screenshots of one long message into the oldest one, in the order they were added.
pub fn combine(state: &AppState, ids: &[i64]) -> AppResult<Shot> {
    if !COMBINE_RANGE.contains(&ids.len()) {
        return Err(AppError::invalid("Select 2 to 10 screenshots"));
    }
    let mut db = state.db()?;
    let mut shots = ids
        .iter()
        .map(|id| get(&db, *id))
        .collect::<AppResult<Vec<_>>>()?;
    shots.sort_by(|a, b| (&a.created_at, a.id).cmp(&(&b.created_at, b.id)));
    shots.dedup_by_key(|shot| shot.id);
    if shots.iter().any(|shot| shot.image_key.is_none()) {
        return Err(AppError::invalid(
            "Only screenshots can be combined, not pasted text",
        ));
    }
    if shots
        .iter()
        .any(|shot| shot.folder_id != shots[0].folder_id)
    {
        return Err(AppError::invalid("Screenshots must be in the same folder"));
    }
    let (first, rest) = shots.split_first().expect("at least two ids");
    let extra_keys: Vec<String> = shots.iter().flat_map(Shot::image_keys).skip(1).collect();
    let merged: Vec<i64> = rest.iter().map(|shot| shot.id).collect();
    db::screenshots::merge(&mut db, first.id, &extra_keys, &merged)?;
    get(&db, first.id)
}

/// The item, or NotFound.
pub fn get(db: &Connection, id: i64) -> AppResult<Shot> {
    db::screenshots::find(db, id)?.ok_or(AppError::NotFound("Screenshot"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{inference::Engine, storage::ImageStore};

    fn state() -> AppState {
        let images = ImageStore::new(std::env::temp_dir().join("revibe-tests"));
        AppState::new(
            db::open_in_memory().unwrap(),
            images,
            Engine::new(Default::default()),
        )
    }

    #[test]
    fn folder_names_are_unique_ignoring_case() {
        let state = state();
        folders::create(&state, "Team 5").unwrap();
        let err = folders::create(&state, " team 5 ").unwrap_err();
        assert_eq!(err.to_string(), "A folder named \"team 5\" already exists");
        assert_eq!(
            folders::create(&state, "  ").unwrap_err().to_string(),
            "Folder name must be 1 to 80 characters"
        );
    }

    #[test]
    fn counts_follow_added_and_reported_items() {
        let state = state();
        let folder = folders::create(&state, "Team 5").unwrap();
        let text = add_text(&state, folder.id, "Task: 1").unwrap();
        add_text(&state, folder.id, "Task: 2").unwrap();
        db::screenshots::save_result(&state.db().unwrap(), text.id, None, Some("Done"), None)
            .unwrap();
        let folder = folders::get(&state.db().unwrap(), folder.id).unwrap();
        assert_eq!(
            (folder.screenshots, folder.reports, folder.pending),
            (2, 1, 1)
        );
    }

    #[test]
    fn invalid_uploads_and_text_combines_are_rejected() {
        let state = state();
        let folder = folders::create(&state, "Team 5").unwrap();
        let err = upload(&state, folder.id, SOURCE_UPLOAD, b"bad").unwrap_err();
        assert_eq!(err.to_string(), "Upload a valid image file");
        let a = add_text(&state, folder.id, "Task: 1").unwrap();
        let b = add_text(&state, folder.id, "Task: 2").unwrap();
        let err = combine(&state, &[a.id, b.id]).unwrap_err();
        assert_eq!(
            err.to_string(),
            "Only screenshots can be combined, not pasted text"
        );
    }
}
