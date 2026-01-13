use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct File {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub modified: String,
}

/// Recent file information from Windows Recent folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub name: String,
    pub path: String,
    pub last_accessed: DateTime<Utc>,
    pub file_type: String,
}

impl From<File> for RecentFile {
    fn from(file: File) -> Self {
        RecentFile {
            name: file.name.clone(),
            path: file.path.clone(),
            last_accessed: DateTime::parse_from_rfc3339(&file.modified)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            file_type: file.extension.clone(),
        }
    }
}

