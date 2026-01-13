use crate::models::file::RecentFile;
use crate::services::file_tracker::FileTracker;

#[tauri::command]
pub async fn get_recent_files() -> Result<Vec<RecentFile>, String> {
    let tracker = FileTracker::new().map_err(|e| e.to_string())?;
    Ok(tracker.get_recent_files_sorted())
}

#[tauri::command]
pub async fn get_recent_files_by_type(file_type: String) -> Result<Vec<RecentFile>, String> {
    let tracker = FileTracker::new().map_err(|e| e.to_string())?;
    Ok(tracker.get_recent_files_by_type_sorted(&file_type))
}

#[tauri::command]
pub async fn refresh_recent_files() -> Result<Vec<RecentFile>, String> {
    let tracker = FileTracker::new().map_err(|e| e.to_string())?;
    tracker.refresh().map_err(|e| e.to_string())?;
    Ok(tracker.get_recent_files_sorted())
}

