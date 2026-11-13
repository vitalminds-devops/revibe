//! Report generation for one item, and the folder's Excel export.
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use crate::db;
use crate::domain::Shot;
use crate::error::{AppError, AppResult};
use crate::excel;
use crate::inference::{self, Source};
use crate::services::{folders, screenshots};
use crate::state::AppState;

/// Runs OCR and the model on one item and stores the outcome. Takes minutes: call it off the UI thread.
pub fn generate(state: &AppState, id: i64) -> AppResult<Shot> {
    let shot = screenshots::get(&*state.db()?, id)?; // the lock is released before the long work
    let source = match &shot.text {
        Some(text) => Source::Text(text.clone()),
        None => Source::Images(
            shot.image_keys()
                .iter()
                .map(|key| state.images.read(key))
                .collect::<Result<_, _>>()?,
        ),
    };
    let outcome = state.engine.generate(&source);
    let db = state.db()?;
    match outcome {
        Ok(report) => {
            db::screenshots::save_result(&db, id, Some(&report.fields), Some(&report.text), None)?
        }
        Err(inference::Error::Unreadable(reason)) => {
            db::screenshots::save_result(&db, id, None, None, Some(&reason))?
        }
        Err(inference::Error::Failed(cause)) => {
            eprintln!("Local inference failed: {cause:?}"); // the UI message hides the cause
            return Err(AppError::Inference(
                "Local inference failed. Verify the installed model files and available memory."
                    .into(),
            ));
        }
    }
    screenshots::get(&db, id)
}

/// Writes `<folder name>.xlsx` into `dir` and returns its path.
pub fn export_excel(state: &AppState, folder_id: i64, dir: &Path) -> AppResult<PathBuf> {
    let db = state.db()?;
    let folder = folders::get(&db, folder_id)?;
    let shots = db::screenshots::list_reported(&db, folder_id)?;
    let path = dir.join(format!("{}.xlsx", file_name(&folder.name)));
    excel::write(&shots, &path)?;
    Ok(path)
}

fn file_name(folder: &str) -> String {
    static UNSAFE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^\w\- ]+").unwrap());
    let name = UNSAFE.replace_all(folder, "_").trim().to_string();
    if name.is_empty() {
        "reports".into()
    } else {
        name
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_name_is_safe() {
        assert_eq!(file_name("Team 5 / Nov"), "Team 5 _ Nov");
        assert_eq!(file_name("///"), "_");
        assert_eq!(file_name(" "), "reports");
    }
}
