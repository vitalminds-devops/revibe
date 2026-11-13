//! Screenshot -> text with the bundled ocrs models.
use std::path::Path;

use image::imageops::FilterType;
use ocrs::{ImageSource, OcrEngine, OcrEngineParams};

use super::Error;

const MAX_PIXELS: u64 = 20_000_000;

pub struct Ocr {
    engine: OcrEngine,
}

impl Ocr {
    pub fn load(models: &Path) -> anyhow::Result<Self> {
        let engine = OcrEngine::new(OcrEngineParams {
            detection_model: Some(rten::Model::load_file(models.join("text-detection.onnx"))?),
            recognition_model: Some(rten::Model::load_file(
                models.join("text-recognition.onnx"),
            )?),
            ..Default::default()
        })?;
        Ok(Self { engine })
    }

    pub fn read_text(&self, bytes: &[u8]) -> Result<String, Error> {
        let image = image::load_from_memory(bytes)
            .map_err(|_| Error::unreadable("Upload a valid image file"))?;
        if u64::from(image.width()) * u64::from(image.height()) > MAX_PIXELS {
            return Err(Error::unreadable("Image must be at most 20 megapixels"));
        }
        // Small phone screenshots read better enlarged: the recognizer misses short words like "1" otherwise.
        let image = if image.width().max(image.height()) < 1600 {
            image.resize(image.width() * 2, image.height() * 2, FilterType::Lanczos3)
        } else {
            image
        };
        let rgb = image.into_rgb8();
        let source =
            ImageSource::from_bytes(rgb.as_raw(), rgb.dimensions()).map_err(anyhow::Error::from)?;
        let input = self
            .engine
            .prepare_input(source)
            .map_err(anyhow::Error::from)?;
        let text = self.engine.get_text(&input).map_err(anyhow::Error::from)?;
        Ok(drop_icon_noise(&text))
    }
}

/// Chat-app icons and avatars come out of OCR as lines of one or two stray letters.
fn drop_icon_noise(text: &str) -> String {
    // shortcut: a real line of only 1-2 letters is dropped too; none of the report labels are that short.
    let keep = |line: &&str| {
        line.chars().any(|c| c.is_ascii_digit())
            || line.chars().filter(|c| c.is_alphanumeric()).count() >= 3
    };
    text.lines().filter(keep).collect::<Vec<_>>().join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icon_noise_lines_are_dropped() {
        assert_eq!(
            drop_icon_noise("J\nLuke Marino\nTask 1\n@~\nKN\n0\nA/T: Resplice"),
            "Luke Marino\nTask 1\n0\nA/T: Resplice"
        );
    }
}
