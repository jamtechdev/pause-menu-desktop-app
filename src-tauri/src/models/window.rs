use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub handle: isize,
    pub title: String,
    pub process_name: String,
    pub executable_path: String,
    pub last_active: DateTime<Utc>,
    pub is_visible: bool,
}

// Legacy Window struct for backward compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Window {
    pub id: String,
    pub title: String,
    pub process_name: String,
    pub icon: Option<String>,
}

impl From<WindowInfo> for Window {
    fn from(info: WindowInfo) -> Self {
        Window {
            id: format!("{}", info.handle),
            title: info.title,
            process_name: info.process_name,
            icon: None,
        }
    }
}

