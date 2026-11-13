//! ReVibe desktop: folders of screenshots -> local OCR/LLM accomplishment reports.
//!
//! Layers, each calling only the ones below it:
//!   commands  (Tauri API for the UI)
//!   services  (rules and validation)
//!   db, storage, inference, excel  (SQLite, image files, local models, export)
//!   domain, error  (shared types)
mod commands;
mod db;
mod domain;
mod error;
mod excel;
mod inference;
mod services;
mod state;
mod storage;

use tauri::Manager;

use inference::Engine;
use state::AppState;
use storage::ImageStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let state = AppState::new(
                db::open(&data.join("revibe.db"))?,
                ImageStore::new(data.join("images")),
                Engine::new(app.path().resource_dir()?.join("models")),
            );
            app.manage(state);
            // In the background: the window answers while the models load.
            let handle = app.handle().clone();
            std::thread::spawn(move || handle.state::<AppState>().engine.warm_up());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::folders::list_folders,
            commands::folders::create_folder,
            commands::folders::rename_folder,
            commands::folders::set_archived,
            commands::screenshots::list_screenshots,
            commands::screenshots::add_screenshot,
            commands::screenshots::add_text,
            commands::screenshots::delete_screenshot,
            commands::screenshots::combine_screenshots,
            commands::reports::generate_report,
            commands::reports::export_excel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ReVibe");
}
