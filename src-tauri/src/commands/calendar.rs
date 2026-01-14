use crate::models::action::CalendarEvent;
use crate::services::calendar_service::{get_calendar_service, CalendarProvider};
use tauri::Manager;
use std::sync::atomic::{AtomicBool, Ordering};

// Flag to track if OAuth is in progress (prevents app exit when window closes)
pub static OAUTH_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn get_calendar_events() -> Result<Vec<CalendarEvent>, String> {
    // Direct call with error handling - we're already in async context
    match get_calendar_service().await.lock().await.get_events().await {
        Ok(events) => Ok(events),
        Err(e) => {
            eprintln!("[Calendar] Error in get_calendar_events: {}", e);
            // Return empty events on error instead of crashing
            Ok(Vec::new())
        }
    }
}

#[tauri::command]
pub async fn get_next_meeting() -> Result<Option<CalendarEvent>, String> {
    // Direct call with error handling
    Ok(get_calendar_service().await.lock().await.get_next_meeting().await)
}

#[tauri::command]
pub async fn time_until_next_meeting() -> Result<Option<i64>, String> {
    // Direct call with error handling
    Ok(get_calendar_service().await.lock().await
        .time_until_next_meeting()
        .await
        .map(|d| d.num_seconds()))
}

#[tauri::command]
pub async fn refresh_calendar_events() -> Result<(), String> {
    // Direct call with error handling
    match get_calendar_service().await.lock().await.refresh_events().await {
        Ok(()) => Ok(()),
        Err(e) => {
            eprintln!("[Calendar] Error in refresh_calendar_events: {}", e);
            // Return Ok on error instead of crashing
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn get_google_auth_url() -> Result<String, String> {
    let service = get_calendar_service().await;
    let service = service.lock().await;
    service.get_google_auth_url()
}

#[tauri::command]
pub async fn start_google_oauth_flow(app: tauri::AppHandle) -> Result<String, String> {
    use crate::services::calendar_service::CalendarProvider;
    use crate::services::oauth_server::OAuthServer;
    
    println!("[OAuth] ========== start_google_oauth_flow COMMAND CALLED ==========");
    eprintln!("[OAuth] This log should appear in the TERMINAL, not browser console!");
    
    let service = get_calendar_service().await;
    let service_guard = service.lock().await;
    
    // Get auth URL
    println!("[OAuth] Getting auth URL from service...");
    let auth_url = match service_guard.get_google_auth_url() {
        Ok(url) => {
            println!("[OAuth] ✓ Auth URL obtained successfully");
            url
        }
        Err(e) => {
            eprintln!("[OAuth] ✗✗✗ ERROR getting auth URL: {}", e);
            eprintln!("[OAuth] This error will be returned to frontend");
            drop(service_guard);
            return Err(format!("Failed to get OAuth URL: {}", e));
        }
    };
    
    println!("[OAuth] Auth URL length: {} characters", auth_url.len());
    println!("[OAuth] Auth URL preview: {}...", &auth_url[..auth_url.len().min(100)]);
    drop(service_guard);
    
    // Set OAuth in progress flag
    OAUTH_IN_PROGRESS.store(true, Ordering::SeqCst);
    
    // Hide all windows so app appears closed
    println!("[OAuth] Hiding all windows - app will appear closed");
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    
    // Also hide any monitor windows
    for i in 0..10 {
        if let Some(window) = app.get_webview_window(&format!("overlay_monitor_{}", i)) {
            let _ = window.hide();
        }
    }
    
    // Start OAuth flow in background task
    // The app will stay running in background to handle OAuth callback
    let app_clone = app.clone();
    tokio::spawn(async move {
        println!("[OAuth] Starting OAuth flow in background...");
        match OAuthServer::start_oauth_flow(auth_url).await {
            Ok(code) => {
                println!("[OAuth] OAuth callback received, code length: {}", code.len());
                // Handle the callback
                let service = get_calendar_service().await;
                let service = service.lock().await;
                if let Err(e) = service.handle_oauth_callback(CalendarProvider::Google, code).await {
                    println!("[OAuth] Error handling callback: {}", e);
                    // Show windows again even on error so user can see the error
                    println!("[OAuth] Showing windows after OAuth error...");
                    show_all_windows(&app_clone);
                } else {
                    println!("[OAuth] OAuth successful!");
                    
                    // Refresh events before showing windows
                    let _ = service.refresh_events().await;
                    
                    // Show all windows to reopen the app
                    println!("[OAuth] Showing windows to reopen app...");
                    show_all_windows(&app_clone);
                }
            }
            Err(e) => {
                println!("[OAuth] OAuth flow error: {}", e);
                // Show windows even on error so user can see the error
                println!("[OAuth] Showing windows after OAuth error...");
                show_all_windows(&app_clone);
            }
        }
        
        // Clear OAuth flag
        OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
    });
    
    println!("[OAuth] All windows hidden. App will reopen automatically after authentication.");
    
    // This line should never be reached, but included for type safety
    Ok(format!("OAuth flow started. App will close and reopen after authentication."))
}

fn show_all_windows(app: &tauri::AppHandle) {
    // Show main window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        println!("[OAuth] ✓ Main window shown");
    }
    
    // Show monitor windows
    for i in 0..10 {
        if let Some(window) = app.get_webview_window(&format!("overlay_monitor_{}", i)) {
            let _ = window.show();
            println!("[OAuth] ✓ Monitor window {} shown", i);
        }
    }
}

#[tauri::command]
pub async fn get_microsoft_auth_url() -> Result<String, String> {
    let service = get_calendar_service().await;
    let service = service.lock().await;
    service.get_microsoft_auth_url()
}

#[tauri::command]
pub async fn handle_oauth_callback(provider: String, code: String) -> Result<(), String> {
    let service = get_calendar_service().await;
    let service = service.lock().await;
    
    let calendar_provider = match provider.as_str() {
        "google" => CalendarProvider::Google,
        "microsoft" => CalendarProvider::Microsoft,
        _ => return Err("Invalid provider".to_string()),
    };
    
    service.handle_oauth_callback(calendar_provider, code).await
}

#[tauri::command]
pub async fn is_calendar_authenticated() -> Result<bool, String> {
    // Direct call with error handling
    use crate::services::calendar_service::CalendarService;
    let is_auth = CalendarService::is_authenticated(CalendarProvider::Google).await;
    println!("[Calendar] is_calendar_authenticated check: {}", is_auth);
    Ok(is_auth)
}

