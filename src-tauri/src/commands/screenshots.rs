use tauri::State;
use tauri::ipc::{InvokeBody, Request};

use super::ShotView;
use crate::error::{AppError, AppResult};
use crate::services::screenshots;
use crate::state::AppState;

#[tauri::command]
pub fn list_screenshots(state: State<AppState>, folder_id: i64) -> AppResult<Vec<ShotView>> {
    let shots = screenshots::list(&state, folder_id)?;
    Ok(shots
        .into_iter()
        .map(|shot| ShotView::new(shot, &state))
        .collect())
}

/// Raw image bytes as the body, with `folder-id` and `source` headers (see api.upload).
#[tauri::command]
pub fn add_screenshot(state: State<AppState>, request: Request) -> AppResult<ShotView> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::invalid("Upload an image file"));
    };
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default()
    };
    let folder_id = header("folder-id")
        .parse()
        .map_err(|_| AppError::NotFound("Folder"))?;
    let shot = screenshots::upload(&state, folder_id, header("source"), bytes)?;
    Ok(ShotView::new(shot, &state))
}

#[tauri::command]
pub fn add_text(state: State<AppState>, folder_id: i64, text: String) -> AppResult<ShotView> {
    Ok(ShotView::new(
        screenshots::add_text(&state, folder_id, &text)?,
        &state,
    ))
}

#[tauri::command]
pub fn delete_screenshot(state: State<AppState>, id: i64) -> AppResult<()> {
    screenshots::delete(&state, id)
}

#[tauri::command]
pub fn combine_screenshots(state: State<AppState>, ids: Vec<i64>) -> AppResult<ShotView> {
    Ok(ShotView::new(screenshots::combine(&state, &ids)?, &state))
}
