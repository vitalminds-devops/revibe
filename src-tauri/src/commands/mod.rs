//! Tauri commands: the API the UI calls (src/lib/api.ts). Each one only unpacks its
//! arguments, calls a service and shapes the answer.
pub mod folders;
pub mod reports;
pub mod screenshots;

use serde::Serialize;

use crate::domain::{Fields, Shot};
use crate::state::AppState;

/// A Shot as the UI sees it: image keys become file paths, which api.ts turns into asset URLs.
#[derive(Serialize)]
pub struct ShotView {
    id: i64,
    folder_id: i64,
    image_url: Option<String>,
    extra_image_urls: Vec<String>,
    source: String,
    text: Option<String>,
    created_at: String,
    fields: Option<Fields>,
    report: Option<String>,
    error: Option<String>,
}

impl ShotView {
    fn new(shot: Shot, state: &AppState) -> Self {
        let path = |key: &String| state.images.path(key).to_string_lossy().into_owned();
        Self {
            image_url: shot.image_key.as_ref().map(path),
            extra_image_urls: shot.extra_image_keys.iter().map(path).collect(),
            id: shot.id,
            folder_id: shot.folder_id,
            source: shot.source,
            text: shot.text,
            created_at: shot.created_at,
            fields: shot.fields,
            report: shot.report,
            error: shot.error,
        }
    }
}
