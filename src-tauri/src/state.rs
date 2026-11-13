//! What every command can reach: the database, the image files and the local models.
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::inference::Engine;
use crate::storage::ImageStore;

pub struct AppState {
    db: Mutex<Connection>,
    pub images: ImageStore,
    pub engine: Engine,
}

impl AppState {
    pub fn new(db: Connection, images: ImageStore, engine: Engine) -> Self {
        Self {
            db: Mutex::new(db),
            images,
            engine,
        }
    }

    /// Hold it only for quick queries, never across report generation.
    pub fn db(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.db.lock().map_err(|_| AppError::Poisoned)
    }
}
