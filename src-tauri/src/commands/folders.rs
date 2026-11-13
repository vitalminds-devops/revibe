use tauri::State;

use crate::domain::{Folder, FolderSort};
use crate::error::AppResult;
use crate::services::folders;
use crate::state::AppState;

#[tauri::command]
pub fn list_folders(
    state: State<AppState>,
    sort: FolderSort,
    archived: bool,
) -> AppResult<Vec<Folder>> {
    folders::list(&state, sort, archived)
}

#[tauri::command]
pub fn create_folder(state: State<AppState>, name: String) -> AppResult<Folder> {
    folders::create(&state, &name)
}

#[tauri::command]
pub fn rename_folder(state: State<AppState>, id: i64, name: String) -> AppResult<Folder> {
    folders::rename(&state, id, &name)
}

#[tauri::command]
pub fn set_archived(state: State<AppState>, id: i64, archived: bool) -> AppResult<Folder> {
    folders::set_archived(&state, id, archived)
}
