use crate::models::window::{Window, WindowInfo};

#[tauri::command]
pub async fn get_windows() -> Result<Vec<Window>, String> {
    let tracker = crate::services::window_tracker::WindowTracker::new();
    let windows = tracker.enumerate_windows()?;
    Ok(windows.into_iter().map(Window::from).collect())
}

#[tauri::command]
pub async fn get_windows_info() -> Result<Vec<WindowInfo>, String> {
    let tracker = crate::services::window_tracker::WindowTracker::new();
    tracker.enumerate_windows()
}

#[tauri::command]
pub async fn get_visible_windows() -> Result<Vec<WindowInfo>, String> {
    let tracker = crate::services::window_tracker::WindowTracker::new();
    tracker.get_visible_windows()
}

#[tauri::command]
pub async fn get_active_window() -> Result<Option<WindowInfo>, String> {
    let tracker = crate::services::window_tracker::WindowTracker::new();
    tracker.get_active_window()
}

#[tauri::command]
pub async fn get_window_titles() -> Result<Vec<String>, String> {
    let tracker = crate::services::window_tracker::WindowTracker::new();
    tracker.get_window_titles()
}

#[tauri::command]
pub async fn get_process_names() -> Result<Vec<String>, String> {
    let tracker = crate::services::window_tracker::WindowTracker::new();
    tracker.get_process_names()
}

