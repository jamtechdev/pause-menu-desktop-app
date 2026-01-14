use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_meeting_window(app: AppHandle, url: String, title: String) -> Result<(), String> {
    println!("[Meeting] Opening meeting window: {} - {}", title, url);
    
    // Hide all app windows first (so app appears closed)
    println!("[Meeting] Hiding all app windows...");
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    
    // Also hide any monitor windows
    for i in 0..10 {
        if let Some(window) = app.get_webview_window(&format!("overlay_monitor_{}", i)) {
            let _ = window.hide();
        }
    }
    
    // Small delay to ensure windows are hidden
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Create a unique window label
    let window_label = format!("meeting_{}", chrono::Utc::now().timestamp_millis());
    
    let url_parsed = url.parse::<url::Url>()
        .map_err(|e| format!("Invalid URL: {}", e))?;
    
    match WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::External(url_parsed)
    )
    .title(&title)
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(true)
    .always_on_top(false)
    .visible(true)
    .build() {
        Ok(window) => {
            println!("[Meeting] ✓ Meeting window created: {}", window_label);
            // Center the window
            if let Err(e) = window.center() {
                eprintln!("[Meeting] Warning: Failed to center window: {}", e);
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("[Meeting] ✗ Failed to create meeting window: {}", e);
            Err(format!("Failed to open meeting window: {}", e))
        }
    }
}

