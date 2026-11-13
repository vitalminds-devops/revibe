//! The one error type commands return; the UI receives its message as a string.
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0} not found")]
    NotFound(&'static str),
    /// Bad input from the UI; the message is shown to the user as is.
    #[error("{0}")]
    Invalid(String),
    /// Model or machine failure while generating; the item stays pending for a retry.
    #[error("{0}")]
    Inference(String),
    #[error(transparent)]
    Database(#[from] rusqlite::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Excel(#[from] rust_xlsxwriter::XlsxError),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error("internal state is unusable after an earlier crash")]
    Poisoned,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::Invalid(message.into())
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
