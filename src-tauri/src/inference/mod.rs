//! Local OCR + LLM pipeline: screenshots or pasted text -> extracted fields + written report.
mod llm;
mod ocr;
mod parser;

use std::path::PathBuf;
use std::sync::Mutex;

use crate::domain::Fields;
use llm::Llm;
use ocr::Ocr;
pub use parser::{join_parts, parse_fields};

const MAX_TEXT_CHARS: usize = 12000;
const REPORT_PROMPT: &str = "Write a formal accomplishment report in plain English, at most 180 words, from the JSON below. \
Use short sections: Summary, Job Details, Site, Timeline, Root Cause (RFO), Action Taken. \
Copy job numbers, site codes, names and times exactly. \
Do not invent facts or claim success beyond the supplied data; if a value is empty, omit it. \
End after Action Taken; do not add an evaluation of the technician.\n\nJSON:\n";

#[derive(Debug)]
pub enum Error {
    /// The input itself can't be used; stored on the item.
    Unreadable(String),
    /// Model or machine failure; the item stays pending so it can be retried.
    Failed(anyhow::Error),
}

impl Error {
    fn unreadable(message: &str) -> Self {
        Self::Unreadable(message.into())
    }
}

impl From<anyhow::Error> for Error {
    fn from(err: anyhow::Error) -> Self {
        Self::Failed(err)
    }
}

pub enum Source {
    Text(String),
    /// Screenshots of one message, in reading order.
    Images(Vec<Vec<u8>>),
}

pub struct Report {
    pub fields: Fields,
    pub text: String,
}

struct Models {
    ocr: Ocr,
    llm: Llm,
}

pub struct Engine {
    dir: PathBuf,
    /// Loaded on first use; the lock also keeps generation to one report at a time.
    models: Mutex<Option<Models>>,
}

impl Engine {
    pub fn new(dir: PathBuf) -> Self {
        Self {
            dir,
            models: Mutex::new(None),
        }
    }

    /// Loads the models ahead of time so the first report doesn't wait for them.
    pub fn warm_up(&self) {
        if let Err(err) = self.with_models(|_| Ok(())) {
            eprintln!("Loading the local models failed: {err:?}");
        }
    }

    pub fn generate(&self, source: &Source) -> Result<Report, Error> {
        self.with_models(|models| {
            let fields = parse_fields(&source_text(&models.ocr, source)?);
            // Empty fields only make the model write blank lines, and every word costs time on CPU.
            let filled: Fields = fields
                .iter()
                .filter(|(_, v)| v.as_str() != Some(""))
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect();
            let prompt = format!("{REPORT_PROMPT}{}", pretty(&filled));
            let text = models.llm.chat(&prompt)?;
            if text.is_empty() {
                return Err(anyhow::anyhow!("the model returned an empty report").into());
            }
            Ok(Report { fields, text })
        })
    }

    fn with_models<T>(
        &self,
        run: impl FnOnce(&mut Models) -> Result<T, Error>,
    ) -> Result<T, Error> {
        let mut models = self
            .models
            .lock()
            .map_err(|_| anyhow::anyhow!("an earlier generation crashed"))?;
        if models.is_none() {
            *models = Some(Models {
                ocr: Ocr::load(&self.dir)?,
                llm: Llm::load(&self.dir.join("qwen"))?,
            });
        }
        run(models.as_mut().expect("loaded above"))
    }
}

fn pretty(fields: &Fields) -> String {
    serde_json::to_string_pretty(fields).expect("a JSON map serializes")
}

fn source_text(ocr: &Ocr, source: &Source) -> Result<String, Error> {
    let text = match source {
        Source::Text(text) => text.clone(),
        Source::Images(images) => {
            let parts = images
                .iter()
                .map(|image| ocr.read_text(image))
                .collect::<Result<Vec<_>, _>>()?;
            let text = join_parts(&parts);
            if text.trim().is_empty() {
                let what = if images.len() == 1 { "image" } else { "images" };
                return Err(Error::Unreadable(format!(
                    "No readable text found in the {what}"
                )));
            }
            text
        }
    };
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err(Error::unreadable(
            "Too much text; upload one report at a time",
        ));
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// cargo test --release -- --ignored --nocapture
    #[test]
    #[ignore = "needs models/ and about two minutes of CPU"]
    fn offline_integration() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let started = std::time::Instant::now();
        let image = std::fs::read(root.join("sample.png")).unwrap();
        let report = Engine::new(root.join("models"))
            .generate(&Source::Images(vec![image]))
            .unwrap();
        let fields = &report.fields;
        println!(
            "{}\n\n{}\n\nPassed in {:.1?}",
            pretty(fields),
            report.text,
            started.elapsed()
        );
        assert!(
            fields["jo_number"]
                .as_str()
                .unwrap()
                .contains("20261031-0005"),
            "{fields:?}"
        );
        assert_eq!(fields["task_no"], "1");
        assert!(report.text.contains("NAP"), "{}", report.text);
    }
}
