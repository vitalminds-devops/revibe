//! Excel export: one row per report with its extracted fields.
use std::path::Path;

use rust_xlsxwriter::{Workbook, XlsxError};

use crate::domain::{REPORT_FIELDS, Shot};

pub fn write(shots: &[Shot], path: &Path) -> Result<(), XlsxError> {
    let mut book = Workbook::new();
    let sheet = book.add_worksheet().set_name("Reports")?;
    let header = ["id", "captured_at", "source"]
        .into_iter()
        .chain(REPORT_FIELDS)
        .chain(["report"]);
    for (col, title) in header.enumerate() {
        sheet.write_string(0, col as u16, title)?;
    }
    for (row, shot) in (1u32..).zip(shots) {
        sheet.write_number(row, 0, shot.id as f64)?;
        let field = |key: &str| {
            let value = shot.fields.as_ref().and_then(|fields| fields.get(key));
            value.and_then(|v| v.as_str()).unwrap_or_default()
        };
        let values = [shot.created_at.as_str(), shot.source.as_str()]
            .into_iter()
            .chain(REPORT_FIELDS.iter().map(|key| field(key)))
            .chain([shot.report.as_deref().unwrap_or_default()]);
        for (col, value) in (1u16..).zip(values) {
            // write_string, never write: OCR text starting with "=" must stay text, not become a formula.
            sheet.write_string(row, col, value)?;
        }
    }
    book.save(path)
}
