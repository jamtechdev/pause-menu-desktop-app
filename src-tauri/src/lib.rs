mod commands;
mod models;
mod services;
mod utils;

use commands::*;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};
use std::sync::atomic::{AtomicBool, Ordering};

// Flag to prevent concurrent window operations
static WINDOW_OPERATION_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

// Simple toggle state to track overlay visibility (fallback if visibility check fails)
static OVERLAY_IS_VISIBLE: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file if it exists (for development)
    // This allows using .env file instead of system environment variables
    // Try loading from project root (parent directory of src-tauri)
    let mut loaded = false;
    
    // Log current working directory for debugging
    if let Ok(cwd) = std::env::current_dir() {
        println!("[Env] Current working directory: {}", cwd.display());
    }
    
    // Try current directory first12242465
    if let Ok(path) = dotenv::dotenv() {
        println!("[Env] ✓ Loaded .env file from: {}", path.display());
        loaded = true;
    } else {
        // Try parent directory (project root)
        if let Ok(current_dir) = std::env::current_dir() {
            if let Some(parent) = current_dir.parent() {
                let env_path = parent.join(".env");
                println!("[Env] Trying .env file at: {}", env_path.display());
                if env_path.exists() {
                    if dotenv::from_path(&env_path).is_ok() {
                        println!("[Env] ✓ Loaded .env file from: {}", env_path.display());
                        loaded = true;
                    } else {
                        eprintln!("[Env] ✗ Failed to load .env file from: {}", env_path.display());
                    }
                } else {
                    eprintln!("[Env] ✗ .env file does not exist at: {}", env_path.display());
                }
            }
        }
    }
    // Verify environment variables are loaded
    if let Ok(client_id) = std::env::var("GOOGLE_CLIENT_ID") {
        println!("[Env] ✓ GOOGLE_CLIENT_ID is set (length: {})", client_id.len());
    } else {
        eprintln!("[Env] ✗ GOOGLE_CLIENT_ID is NOT set after .env loading");
    }
    
    if !loaded {
        // .env file not found is OK - we'll use system environment variables instead
        eprintln!("[Env] Note: .env file not found. Using system environment variables.");
    }

    // Set up panic handler to prevent crashes and system-wide issues
    std::panic::set_hook(Box::new(|panic_info| {
        eprintln!("═══════════════════════════════════════════════════════════");
        eprintln!("PANIC CAUGHT - Attempting to prevent crash");
        eprintln!("Location: {:?}", panic_info.location());
        eprintln!("Message: {:?}", panic_info.payload().downcast_ref::<&str>());
        eprintln!("═══════════════════════════════════════════════════════════");
        // Don't exit - let the app continue if possible
        // The panic hook prevents the default behavior of aborting
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(
                    |app: &tauri::AppHandle,
                     shortcut: &tauri_plugin_global_shortcut::Shortcut,
                     event: tauri_plugin_global_shortcut::ShortcutEvent| {
                        // Check if this is an arrow key (with or without Alt modifier)
                        let is_arrow_key = matches!(
                            shortcut.key,
                            Code::ArrowUp | Code::ArrowDown | Code::ArrowLeft | Code::ArrowRight
                        );
                        
                        if is_arrow_key && event.state == ShortcutState::Pressed {
                            println!("[Shortcut] Arrow key pressed (global shortcut): {:?}", shortcut.key);
                            
                            // Check if overlay is visible
                            let is_visible = if let Some(state) = app.try_state::<std::sync::Mutex<Vec<String>>>() {
                                if let Ok(window_labels) = state.lock() {
                                    use crate::services::multi_monitor::MultiMonitorManager;
                                    MultiMonitorManager::is_any_window_visible(&app, &window_labels)
                                } else {
                                    false
                                }
                            } else {
                                false
                            };
                            
                            if is_visible {
                                // Emit arrow key event to frontend
                                let direction = match shortcut.key {
                                    Code::ArrowUp => "up",
                                    Code::ArrowDown => "down",
                                    Code::ArrowLeft => "left",
                                    Code::ArrowRight => "right",
                                    _ => {
                                        WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                                        return;
                                    }
                                };
                                
                                println!("[Shortcut] Emitting arrow-key-pressed event: {}", direction);
                                let _ = app.emit("arrow-key-pressed", direction);
                            }
                            
                            WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return; // Handled
                        }
                        
                        // Check if this is Escape key (with or without Ctrl modifier)
                        let is_escape = shortcut.key == Code::Escape;
                        
                        if is_escape && event.state == ShortcutState::Pressed {
                            println!("[Shortcut] Escape key pressed (global shortcut)");
                            
                            // Check if overlay is visible
                            let is_visible = if let Some(state) = app.try_state::<std::sync::Mutex<Vec<String>>>() {
                                if let Ok(window_labels) = state.lock() {
                                    use crate::services::multi_monitor::MultiMonitorManager;
                                    MultiMonitorManager::is_any_window_visible(&app, &window_labels)
                                } else {
                                    false
                                }
                            } else {
                                false
                            };
                            
                            if is_visible {
                                println!("[Shortcut] Overlay visible, closing via Escape");
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    use crate::commands::overlay::hide_overlay;
                                    if let Err(e) = hide_overlay(app_handle.clone()).await {
                                        eprintln!("Error hiding overlay: {}", e);
                                    } else {
                                        let _ = app_handle.emit("shortcut-triggered", false);
                                    }
                                    WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                                });
                                return; // Handled
                            }
                            
                            WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return; // Not visible, ignore
                        }
                        
                        // Check if this is a number key shortcut (Alt+1 through Alt+7)
                        let is_number_key = shortcut.mods.contains(Modifiers::ALT) && matches!(
                            shortcut.key,
                            Code::Digit1 | Code::Digit2 | Code::Digit3 | Code::Digit4 |
                            Code::Digit5 | Code::Digit6 | Code::Digit7
                        );
                        
                        if is_number_key && event.state == ShortcutState::Pressed {
                            // Handle number key navigation
                            let screen_num = match shortcut.key {
                                Code::Digit1 => 1,
                                Code::Digit2 => 2,
                                Code::Digit3 => 3,
                                Code::Digit4 => 4,
                                Code::Digit5 => 5,
                                Code::Digit6 => 6,
                                Code::Digit7 => 7,
                                _ => {
                                    WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                                    return;
                                }
                            };
                            
                            println!("[Shortcut] Number key Alt+{} pressed, navigating to screen {}", screen_num, screen_num);
                            let _ = app.emit("number-key-pressed", screen_num);
                            WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return; // Handled by number key shortcut
                        }
                        
                        // Check if this is a Windows system shortcut that should be blocked
                        // IMPORTANT: Do NOT block Win+Shift+S (screenshot) or Print Screen
                        let is_windows_shortcut = {
                            // Win key alone (MetaLeft/MetaRight)
                            let is_win_key = shortcut.key == Code::MetaLeft || shortcut.key == Code::MetaRight;
                            
                            // Win+letter combinations (SUPER modifier with letter keys)
                            // BUT: Allow Win+Shift+S (screenshot tool) - check for Shift modifier
                            let is_win_combo = shortcut.mods.contains(Modifiers::SUPER) 
                                && !shortcut.mods.contains(Modifiers::SHIFT) // Don't block if Shift is pressed (allows Win+Shift+S)
                                && matches!(
                                    shortcut.key,
                                    Code::KeyA | Code::KeyI | Code::KeyX | Code::KeyK | Code::KeyN | Code::KeyS | Code::KeyT
                                );
                            
                            is_win_key || is_win_combo
                        };
                        
                        // Also check for Print Screen - always allow it
                        let is_print_screen = shortcut.key == Code::PrintScreen;
                        
                        // If it's a Windows system shortcut (but not screenshot), consume it
                        if is_windows_shortcut && !is_print_screen && event.state == ShortcutState::Pressed {
                            println!("[Shortcut] Blocked Windows system shortcut: mods={:?}, key={:?}", shortcut.mods, shortcut.key);
                            WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return; // Consume the shortcut, preventing Windows from handling it
                        }
                        
                        // Allow screenshot shortcuts to pass through (don't block them)
                        if (is_print_screen || (shortcut.mods.contains(Modifiers::SUPER) && shortcut.mods.contains(Modifiers::SHIFT) && shortcut.key == Code::KeyS)) && event.state == ShortcutState::Pressed {
                            println!("[Shortcut] Allowing screenshot shortcut to pass through: mods={:?}, key={:?}", shortcut.mods, shortcut.key);
                            WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return; // Don't consume - let Windows handle it
                        }
                        
                        // Prevent concurrent operations - if one is in progress, skip
                        if WINDOW_OPERATION_IN_PROGRESS.swap(true, Ordering::SeqCst) {
                            eprintln!("Window operation already in progress, skipping...");
                            return;
                        }
                        
                        // Wrap everything in catch_unwind to prevent crashes
                        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                            if event.state == ShortcutState::Pressed {
                                // Check if any overlay window is visible
                                // First check multi-monitor windows, then fallback to main window
                                let mut is_visible = false;
                                
                                // Check for multi-monitor windows in state
                                let mut window_labels_to_check = Vec::new();
                                if let Some(state) = app.try_state::<std::sync::Mutex<Vec<String>>>() {
                                    if let Ok(labels) = state.lock() {
                                        window_labels_to_check = labels.clone();
                                        println!("[Shortcut] Found {} windows in state: {:?}", labels.len(), labels);
                                    }
                                }
                                
                                // If state is empty, scan for monitor windows directly
                                if window_labels_to_check.is_empty() {
                                    println!("[Shortcut] State empty, scanning for monitor windows...");
                                    for i in 0..10 {
                                        let label = format!("overlay_monitor_{}", i);
                                        if app.get_webview_window(&label).is_some() {
                                            println!("[Shortcut] Found monitor window: {}", label);
                                            window_labels_to_check.push(label);
                                        }
                                    }
                                }
                                
                                // Check visibility of all found windows
                                if !window_labels_to_check.is_empty() {
                                    println!("[Shortcut] Checking visibility of {} windows", window_labels_to_check.len());
                                    use crate::services::multi_monitor::MultiMonitorManager;
                                    is_visible = MultiMonitorManager::is_any_window_visible(&app, &window_labels_to_check);
                                    println!("[Shortcut] Multi-monitor windows visible: {}", is_visible);
                                }
                                
                                // If no multi-monitor windows are visible, check main window
                                if !is_visible {
                                    if let Some(main_window) = app.get_webview_window("main") {
                                        if let Ok(visible) = main_window.is_visible() {
                                            is_visible = visible;
                                            println!("[Shortcut] Main window visibility: {}", visible);
                                        }
                                    }
                                }
                                
                                // If visibility check failed or returned false but we think overlay should be visible,
                                // use the toggle state as fallback
                                if !is_visible && OVERLAY_IS_VISIBLE.load(Ordering::SeqCst) {
                                    println!("[Shortcut] Visibility check says hidden but toggle state says visible - using toggle state");
                                    is_visible = true;
                                }
                                
                                println!("[Shortcut] Final visibility check: {} -> {}", is_visible, if is_visible { "HIDE" } else { "SHOW" });
                                
                                if is_visible {
                                    // Update toggle state
                                    OVERLAY_IS_VISIBLE.store(false, Ordering::SeqCst);
                                    // HIDE - use overlay command to hide all windows
                                    println!("[Shortcut] HIDE command triggered");
                                    let app_handle = app.clone();
                                    tauri::async_runtime::spawn(async move {
                                        use crate::commands::overlay::hide_overlay;
                                        println!("[Shortcut] Calling hide_overlay...");
                                        match hide_overlay(app_handle.clone()).await {
                                            Ok(_) => {
                                                println!("[Shortcut] hide_overlay succeeded");
                                                let _ = app_handle.emit("shortcut-triggered", false);
                                                
                                                // Unmute in background
                                                use crate::services::focus_service::get_focus_service;
                                                let is_manually_muted = {
                                                    let focus_service = get_focus_service().await;
                                                    let service = focus_service.lock().await;
                                                    service.is_notifications_muted().await
                                                };
                                                if !is_manually_muted {
                                                    #[cfg(windows)]
                                                    {
                                                        use crate::utils::notification_suppression::unmute_notifications_windows_api;
                                                        if let Err(e) = unmute_notifications_windows_api() {
                                                            eprintln!("Error unmuting notifications: {}", e);
                                                        }
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                eprintln!("[Shortcut] Error hiding overlay: {}", e);
                                                // Still update toggle state even if hide failed
                                                OVERLAY_IS_VISIBLE.store(false, Ordering::SeqCst);
                                            }
                                        }
                                        WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                                    });
                                } else {
                                    // Update toggle state
                                    OVERLAY_IS_VISIBLE.store(true, Ordering::SeqCst);
                                    
                                    // SHOW - use overlay command to show all windows
                                    let app_handle = app.clone();
                                    tauri::async_runtime::spawn(async move {
                                        println!("[Shortcut] Starting show_overlay in async task...");
                                        use crate::commands::overlay::show_overlay;
                                        
                                        // Add detailed logging before each step
                                        println!("[Shortcut] About to call show_overlay...");
                                        
                                        match show_overlay(app_handle.clone()).await {
                                            Ok(_) => {
                                                println!("[Shortcut] show_overlay succeeded");
                                                // Successfully shown - emit event
                                                let _ = app_handle.emit("shortcut-triggered", true);
                                                
                                                // Clear flag immediately after synchronous operations
                                                WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                                                
                                                // Mute in background (async, non-blocking)
                                                println!("[Shortcut] Starting mute notifications check...");
                                                use crate::services::focus_service::get_focus_service;
                                                let is_manually_muted = {
                                                    let focus_service = get_focus_service().await;
                                                    let service = focus_service.lock().await;
                                                    service.is_notifications_muted().await
                                                };
                                                if !is_manually_muted {
                                                    #[cfg(windows)]
                                                    {
                                                        println!("[Shortcut] Muting notifications...");
                                                        use crate::utils::notification_suppression::mute_notifications_windows_api;
                                                        if let Err(e) = mute_notifications_windows_api() {
                                                            eprintln!("Error muting notifications: {}", e);
                                                        } else {
                                                            println!("[Shortcut] Notifications muted successfully");
                                                        }
                                                    }
                                                }
                                                println!("[Shortcut] show_overlay task completed successfully");
                                            }
                                            Err(e) => {
                                                eprintln!("[Shortcut] Error showing overlay: {}", e);
                                                OVERLAY_IS_VISIBLE.store(false, Ordering::SeqCst);
                                                WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                                            }
                                        }
                                    });
                                }
                            } else {
                                // Not pressed state - clear flag immediately
                                WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                            }
                        }));
                        
                        if let Err(e) = result {
                            eprintln!("Panic caught in shortcut handler: {:?}", e);
                            // Try to hide window as emergency measure
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                            // Clear flag on panic
                            WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                        } else if event.state != ShortcutState::Pressed {
                            // If not pressed and no async operation started, clear flag
                            WINDOW_OPERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                        }
                    },
                )
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Try different shortcuts that don't conflict with Windows system shortcuts
            // Ctrl+Space is the primary shortcut (works reliably)
            // Win+Space may conflict with Windows, Win+P opens Project menu
            let shortcuts_to_try: Vec<(Shortcut, &str)> = vec![
                (Shortcut::new(Some(Modifiers::CONTROL), Code::Space), "Ctrl+Space"),
                (Shortcut::new(Some(Modifiers::SUPER), Code::Space), "Win+Space"),
                (Shortcut::new(Some(Modifiers::SUPER), Code::KeyO), "Win+O"),
            ];
            
            let global_shortcut = app.handle().global_shortcut();
            let mut registered = false;
            
            for (shortcut, name) in shortcuts_to_try {
                // Try to unregister first (ignore errors)
                let _ = global_shortcut.unregister(shortcut.clone());
                std::thread::sleep(std::time::Duration::from_millis(500));
                
                match global_shortcut.register(shortcut.clone()) {
                    Ok(_) => {
                        println!("✓ Successfully registered {} global shortcut!", name);
                        registered = true;
                        break;
                    }
                    Err(e) => {
                        eprintln!("⚠ Failed to register {}: {}", name, e);
                        // Continue to next shortcut - don't crash
                    }
                }
            }
            
            if !registered {
                eprintln!("❌ Failed to register any shortcut!");
                eprintln!("  This is likely because Windows is holding the hotkey from a previous instance.");
                eprintln!("  Solutions:");
                eprintln!("    1. Restart your computer (recommended)");
                eprintln!("    2. Wait 5-10 minutes for Windows to release the hotkey");
                eprintln!("    3. Use Escape key to close overlay manually");
                eprintln!("  The app will continue running, but shortcuts won't work until hotkey is released.");
            }

            // Initialize multi-monitor state BEFORE creating windows
            use crate::services::multi_monitor::MultiMonitorManager;
            use std::sync::{Arc, Mutex};
            
            // Initialize empty state first
            let window_labels: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
            app.manage(window_labels.clone());
            
            // Create overlay windows for each monitor asynchronously
            let app_handle = app.handle().clone();
            let window_labels_clone = window_labels.clone();
            tauri::async_runtime::spawn(async move {
                // Minimal delay to ensure app is initialized
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                
                match MultiMonitorManager::create_monitor_windows(&app_handle).await {
                    Ok(labels) => {
                        println!("Created {} overlay window(s)", labels.len());
                        if let Ok(mut state) = window_labels_clone.lock() {
                            *state = labels.clone();
                        }
                        
                        // If we have multi-monitor windows, hide the main window and keep it hidden
                        if !labels.is_empty() && labels.iter().any(|l| l.starts_with("overlay_monitor_")) {
                            if let Some(main_window) = app_handle.get_webview_window("main") {
                                // Force hide main window multiple times to ensure it stays hidden
                                let _ = main_window.hide();
                                let _ = main_window.set_fullscreen(false);
                                
                                // Wait a bit and check again
                                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                                
                                if let Ok(is_visible) = main_window.is_visible() {
                                    if is_visible {
                                        eprintln!("⚠ Main window still visible after hide, forcing hide again...");
                                        let _ = main_window.hide();
                                        let _ = main_window.set_fullscreen(false);
                                    }
                                }
                                
                                println!("✓ Hidden main window (using monitor-specific windows)");
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to create monitor windows: {}", e);
                        // Fallback: use main window only
                        if let Ok(mut state) = window_labels_clone.lock() {
                            state.push("main".to_string());
                        }
                    }
                }
            });

            // Configure overlay window properties with comprehensive error handling
            if let Some(window) = app.get_webview_window("main") {
                println!("✓ Main window found during setup");
                
                // Initially hide main window - it will only be used if multi-monitor windows fail
                if let Err(e) = window.hide() {
                    eprintln!("Warning: Failed to hide main window initially: {}", e);
                } else {
                    println!("✓ Main window hidden initially (will use monitor-specific windows)");
                }
                
                // Set always on top with error handling
                match window.set_always_on_top(true) {
                    Ok(_) => println!("✓ Set always on top"),
                    Err(e) => {
                        eprintln!("Warning: Failed to set always on top: {}", e);
                        // Continue anyway - not critical
                    }
                }
                
                // For multi-monitor: Detect monitors and prepare for spanning
                #[cfg(windows)]
                {
                    use crate::utils::windows_api::{get_all_monitors, get_virtual_desktop_bounds};
                    match get_all_monitors() {
                        Ok(monitors) => {
                            println!("Found {} monitor(s)", monitors.len());
                            if monitors.len() > 1 {
                                match get_virtual_desktop_bounds() {
                                    Ok(bounds) => {
                                        println!("Multi-monitor setup detected!");
                                        println!("Virtual desktop bounds: {}x{} at ({}, {})", 
                                            bounds.right - bounds.left, 
                                            bounds.bottom - bounds.top,
                                            bounds.left,
                                            bounds.top);
                                        println!("Overlay will span all {} monitors", monitors.len());
                                    }
                                    Err(e) => {
                                        eprintln!("Warning: Could not get virtual desktop bounds: {}", e);
                                    }
                                }
                            } else {
                                println!("Single monitor setup detected");
                            }
                        }
                        Err(e) => {
                            eprintln!("Warning: Could not enumerate monitors: {}", e);
                        }
                    }
                }
                
                // Always hide main window initially - it will only be shown if multi-monitor windows fail
                println!("Keeping main window hidden initially...");
                if let Err(e) = window.hide() {
                    eprintln!("Warning: Failed to hide main window: {}", e);
                } else {
                    println!("✓ Main window hidden initially");
                }
                
                println!("Overlay window configured successfully");
            } else {
                eprintln!("✗✗✗ ERROR: Main window not found during setup! ✗✗✗");
            }

            // Set app handle for focus service so it can emit events
            use crate::services::focus_service::get_focus_service;
            let app_handle_for_focus = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let focus_service = get_focus_service().await;
                let mut service = focus_service.lock().await;
                service.set_app_handle(app_handle_for_focus);
                println!("[Focus] App handle set for focus service");
            });

            // Add window close handler to prevent app exit during OAuth
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(|event| {
                    use tauri::WindowEvent;
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        // Check if OAuth is in progress
                        use crate::commands::calendar::OAUTH_IN_PROGRESS;
                        use std::sync::atomic::Ordering;
                        if OAUTH_IN_PROGRESS.load(Ordering::SeqCst) {
                            println!("[OAuth] Window close requested during OAuth - preventing exit");
                            // Prevent the window from closing (app will stay running for OAuth callback)
                            api.prevent_close();
                        }
                    }
                });
            }

            // Always return Ok - don't fail setup if anything goes wrong
            // The app should continue running even if shortcuts or window operations fail
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::shortcuts::register_escape_shortcut,
            commands::shortcuts::unregister_escape_shortcut,
            commands::shortcuts::register_arrow_key_shortcuts,
            commands::shortcuts::unregister_arrow_key_shortcuts,
            commands::shortcuts::block_windows_shortcuts,
            commands::shortcuts::unblock_windows_shortcuts,
            get_windows,
            get_windows_info,
            get_visible_windows,
            get_active_window,
            get_window_titles,
            get_process_names,
            bring_window_to_front,
            register_shortcut,
            register_number_key_shortcuts,
            unregister_number_key_shortcuts,
            show_overlay,
            hide_overlay,
            get_recent_files,
            get_recent_files_by_type,
            refresh_recent_files,
            get_calendar_events,
            get_next_meeting,
            time_until_next_meeting,
            refresh_calendar_events,
            get_google_auth_url,
            get_gmail_drafts,
            get_gmail_draft,
            send_gmail_email,
            reply_to_gmail_email,
            delete_gmail_draft,
            get_microsoft_auth_url,
            handle_oauth_callback,
            is_calendar_authenticated,
            start_google_oauth_flow,
            start_focus_mode,
            stop_focus_mode,
            get_current_focus_session,
            get_focus_remaining_seconds,
            is_focus_active,
            get_meeting_suggestions,
            open_focus_assist_settings,
            temporarily_mute_notifications,
            unmute_notifications,
            get_temporary_mute_remaining,
            is_notifications_muted,
            launch_app,
            launch_file,
            open_folder,
            launch_url,
            get_installed_apps,
            refresh_app_list_cache,
            commands::meeting::open_meeting_window,
            commands::upload::upload_file_to_letmesell,
            commands::upload::upload_file_bytes_to_letmesell,
            commands::upload::pick_note_files,
            commands::documents::open_documents_viewer,
            commands::documents::get_uploaded_documents,
            commands::documents::open_document
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Fatal error running Tauri application: {}", e);
            std::process::exit(1);
        });
}
