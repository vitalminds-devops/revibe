//! Core types shared by every layer.
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// Fields read from a technician's report, in report order (also the Excel column order).
pub const REPORT_FIELDS: [&str; 25] = [
    "technician",
    "report_date",
    "team",
    "members",
    "cdz",
    "task_no",
    "category",
    "service_type",
    "jo_number",
    "jo_date",
    "pms_ticket",
    "trouble_ticket",
    "channel",
    "issue_type",
    "maintenance_activity_type",
    "location",
    "street_address",
    "nap_code",
    "remarks",
    "work_done",
    "arrival",
    "departure",
    "done_rectification",
    "rfo",
    "action_taken",
];

/// Field name -> extracted value, in REPORT_FIELDS order.
pub type Fields = Map<String, Value>;

#[derive(Debug, Serialize)]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub archived: bool,
    pub screenshots: i64,
    pub reports: i64,
    pub pending: i64,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FolderSort {
    Newest,
    Name,
}

/// A screenshot (one or more images of the same message) or a pasted text, and its report.
#[derive(Debug)]
pub struct Shot {
    pub id: i64,
    pub folder_id: i64,
    /// None for pasted text.
    pub image_key: Option<String>,
    /// More images of the same message, after image_key in reading order.
    pub extra_image_keys: Vec<String>,
    pub source: String,
    pub text: Option<String>,
    pub created_at: String,
    pub fields: Option<Fields>,
    pub report: Option<String>,
    pub error: Option<String>,
}

impl Shot {
    pub fn image_keys(&self) -> Vec<String> {
        self.image_key
            .iter()
            .chain(&self.extra_image_keys)
            .cloned()
            .collect()
    }
}

/// Where an item came from.
pub const SOURCE_UPLOAD: &str = "upload";
pub const SOURCE_SCREEN: &str = "screen";
pub const SOURCE_TEXT: &str = "text";
