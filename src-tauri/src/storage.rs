//! Screenshot image files under the app data folder, addressed by a relative key.
use std::io;
use std::path::PathBuf;

pub struct ImageStore {
    root: PathBuf,
}

impl ImageStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn path(&self, key: &str) -> PathBuf {
        self.root.join(key)
    }

    /// Saves the bytes under a new key and returns it.
    pub fn save(&self, folder_id: i64, bytes: &[u8], extension: &str) -> io::Result<String> {
        let key = format!(
            "folders/{folder_id}/{}.{extension}",
            uuid::Uuid::new_v4().simple()
        );
        let path = self.path(&key);
        std::fs::create_dir_all(path.parent().expect("key has a folder"))?;
        std::fs::write(path, bytes)?;
        Ok(key)
    }

    pub fn read(&self, key: &str) -> io::Result<Vec<u8>> {
        std::fs::read(self.path(key))
    }

    /// Already gone counts as deleted.
    pub fn delete(&self, key: &str) -> io::Result<()> {
        match std::fs::remove_file(self.path(key)) {
            Err(err) if err.kind() != io::ErrorKind::NotFound => Err(err),
            _ => Ok(()),
        }
    }
}
