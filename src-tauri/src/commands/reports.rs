use tauri::{AppHandle, Manager, State};

use super::ShotView;
use crate::error::AppResult;
use crate::services::reports;
use crate::state::AppState;

#[tauri::command]
pub async fn generate_report(app: AppHandle, id: i64) -> AppResult<ShotView> {
    // Minutes of CPU work: on a blocking thread, so the window stays responsive.
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        Ok(ShotView::new(reports::generate(&state, id)?, &state))
    })
    .await?
}

/// Saves the folder's reports to the Downloads folder and returns the file path.
#[tauri::command]
pub fn export_excel(app: AppHandle, state: State<AppState>, folder_id: i64) -> AppResult<String> {
    let path = reports::export_excel(&state, folder_id, &app.path().download_dir()?)?;
    Ok(path.to_string_lossy().into_owned())
}
