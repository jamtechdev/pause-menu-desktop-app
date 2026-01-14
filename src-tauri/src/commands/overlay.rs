use tauri::Manager;
use crate::services::multi_monitor::MultiMonitorManager;
use std::sync::Mutex;

#[cfg(windows)]
use crate::utils::windows_api::{get_virtual_desktop_bounds, position_window_for_all_monitors};
#[cfg(windows)]
use ::windows::Win32::Foundation::HWND;

#[tauri::command]
pub async fn show_overlay(app: tauri::AppHandle) -> Result<(), String> {
    println!("[Overlay] show_overlay called - starting...");
    
    // Block Windows system shortcuts when overlay is shown
    println!("[Overlay] Step 1: Blocking Windows shortcuts...");
    use crate::commands::shortcuts::{block_windows_shortcuts, register_number_key_shortcuts};
    if let Err(e) = block_windows_shortcuts(app.clone()).await {
        eprintln!("Warning: Failed to block Windows shortcuts: {}", e);
    } else {
        println!("[Overlay] Blocked Windows system shortcuts");
    }
    
    // Register Escape key as global shortcut
    println!("[Overlay] Step 2: Registering Escape shortcut...");
    use crate::commands::shortcuts::register_escape_shortcut;
    use crate::commands::shortcuts::register_arrow_key_shortcuts;
    if let Err(e) = register_escape_shortcut(app.clone()).await {
        eprintln!("Warning: Failed to register Escape shortcut: {}", e);
    } else {
        println!("[Overlay] Registered Escape key global shortcut");
    }
    
    // Register arrow keys as global shortcuts (work without window focus)
    println!("[Overlay] Step 3: Registering arrow key shortcuts...");
    if let Err(e) = register_arrow_key_shortcuts(app.clone()).await {
        eprintln!("Warning: Failed to register arrow key shortcuts: {}", e);
    } else {
        println!("[Overlay] Registered arrow key global shortcuts");
    }
    
    // Register number key shortcuts (Alt+1 to Alt+7) for screen navigation
    println!("[Overlay] Step 4: Registering number key shortcuts...");
    if let Err(e) = register_number_key_shortcuts(app.clone()).await {
        eprintln!("Warning: Failed to register number key shortcuts: {}", e);
    } else {
        println!("[Overlay] Registered number key shortcuts (Alt+1 to Alt+7)");
    }
    
    println!("[Overlay] Step 5: Getting window labels...");
    // Try to get window labels from app state
    let window_labels: Vec<String> = if let Some(state) = app.try_state::<Mutex<Vec<String>>>() {
        if let Ok(labels) = state.lock() {
            println!("[Overlay] Found window_labels in state: {:?}", labels);
            labels.clone()
        } else {
            println!("[Overlay] Failed to lock window_labels state");
            Vec::new()
        }
    } else {
        println!("[Overlay] No window_labels state found - checking for monitor windows directly...");
        Vec::new()
    };
    
    // If window_labels is empty, try to find monitor windows directly and rebuild the list
    let mut final_window_labels = window_labels.clone();
    if final_window_labels.is_empty() || !final_window_labels.iter().any(|l| l.starts_with("overlay_monitor_")) {
        println!("[Overlay] window_labels empty or no monitor windows found, scanning for monitor windows...");
        final_window_labels.clear();
        for i in 0..10 {
            let label = format!("overlay_monitor_{}", i);
            if app.get_webview_window(&label).is_some() {
                println!("[Overlay] Found monitor window: {}", label);
                final_window_labels.push(label);
            }
        }
        
        // Update state if we found windows
        if !final_window_labels.is_empty() {
            if let Some(state) = app.try_state::<Mutex<Vec<String>>>() {
                if let Ok(mut labels) = state.lock() {
                    *labels = final_window_labels.clone();
                    println!("[Overlay] Updated window_labels state with {} windows", labels.len());
                }
            }
        }
    }
    
    // If we have multiple monitor windows, show all of them (and hide main window)
    if !final_window_labels.is_empty() && final_window_labels.iter().any(|l| l.starts_with("overlay_monitor_")) {
        println!("[Overlay] Showing {} multi-monitor windows: {:?}", final_window_labels.len(), final_window_labels);
        
        // FIRST: Aggressively hide main window to prevent it from showing
        if let Some(window) = app.get_webview_window("main") {
            // Force hide and ensure it stays hidden
            let _ = window.hide();
            let _ = window.set_fullscreen(false);
            
            #[cfg(windows)]
            {
                // Use Windows API to force hide if needed
                if let Ok(hwnd_ptr) = window.hwnd() {
                    use ::windows::Win32::Foundation::HWND;
                    use ::windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
                    let hwnd = HWND(hwnd_ptr.0 as isize);
                    unsafe {
                        let _ = ShowWindow(hwnd, SW_HIDE);
                    }
                }
            }
            
            println!("✓ Main window hidden before showing monitor windows");
            
            // Wait a bit and verify it's still hidden
            std::thread::sleep(std::time::Duration::from_millis(100));
            if let Ok(is_visible) = window.is_visible() {
                if is_visible {
                    eprintln!("⚠⚠⚠ CRITICAL: Main window is still visible after hide! ⚠⚠⚠");
                    // Try one more time
                    let _ = window.hide();
                    #[cfg(windows)]
                    {
                        if let Ok(hwnd_ptr) = window.hwnd() {
                            use ::windows::Win32::Foundation::HWND;
                            use ::windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
                            let hwnd = HWND(hwnd_ptr.0 as isize);
                            unsafe {
                                let _ = ShowWindow(hwnd, SW_HIDE);
                            }
                        }
                    }
                }
            }
        }
        
        // THEN: Show monitor-specific windows
        println!("[Overlay] Step 6: Showing monitor windows...");
        match MultiMonitorManager::show_all_windows(&app, &final_window_labels) {
            Ok(_) => {
                println!("[Overlay] Successfully showed all monitor windows");
            }
            Err(e) => {
                eprintln!("[Overlay] Error showing monitor windows: {}", e);
                return Err(format!("Failed to show monitor windows: {}", e));
            }
        }
        
        // FINALLY: Double-check main window is still hidden
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(is_visible) = window.is_visible() {
                if is_visible {
                    eprintln!("⚠⚠⚠ WARNING: Main window is still visible! Forcing hide...");
                    let _ = window.hide();
                    let _ = window.set_fullscreen(false);
                }
            }
        }
    } else {
        // Fallback: use main window only (original behavior)
        println!("[Overlay] Using main window only (no multi-monitor windows found)");
        let window = app
            .get_webview_window("main")
            .ok_or("Main window not found")?;
        
        // Set always on top first
        window.set_always_on_top(true).map_err(|e: tauri::Error| e.to_string())?;
        
        #[cfg(windows)]
        {
            // For multi-monitor support: try to position window to span all monitors
            use crate::utils::windows_api::get_all_monitors;
            
            // Check if we have multiple monitors
            match get_all_monitors() {
                Ok(monitors) => {
                    if monitors.len() > 1 {
                        println!("Multi-monitor detected: {} monitors", monitors.len());
                        
                        // Try to get virtual desktop bounds
                        match get_virtual_desktop_bounds() {
                            Ok(bounds) => {
                                println!("Virtual desktop: {}x{} at ({}, {})", 
                                    bounds.right - bounds.left,
                                    bounds.bottom - bounds.top,
                                    bounds.left,
                                    bounds.top);
                                
                                // Try to get HWND and position window
                                if let Ok(hwnd_ptr) = window.hwnd() {
                                    let hwnd = HWND(hwnd_ptr.0 as isize);
                                    if let Err(e) = position_window_for_all_monitors(hwnd) {
                                        eprintln!("Warning: Failed to position for all monitors: {}", e);
                                        // Fallback to fullscreen
                                        window.set_fullscreen(true).map_err(|e: tauri::Error| e.to_string())?;
                                    } else {
                                        println!("✓ Window positioned to span all {} monitors", monitors.len());
                                    }
                                } else {
                                    eprintln!("HWND not available, using fullscreen fallback");
                                    window.set_fullscreen(true).map_err(|e: tauri::Error| e.to_string())?;
                                }
                            }
                            Err(e) => {
                                eprintln!("Warning: Could not get virtual desktop bounds: {}", e);
                                window.set_fullscreen(true).map_err(|e: tauri::Error| e.to_string())?;
                            }
                        }
                    } else {
                        // Single monitor - use fullscreen
                        window.set_fullscreen(true).map_err(|e: tauri::Error| e.to_string())?;
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Could not enumerate monitors: {}", e);
                    window.set_fullscreen(true).map_err(|e: tauri::Error| e.to_string())?;
                }
            }
        }
        
        #[cfg(not(windows))]
        {
            // Non-Windows: use fullscreen
            window.set_fullscreen(true).map_err(|e: tauri::Error| e.to_string())?;
        }
        
        // Show window
        window.show().map_err(|e: tauri::Error| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    println!("[Overlay] hide_overlay called");
    
    // Unblock Windows system shortcuts when overlay is hidden
    use crate::commands::shortcuts::{unblock_windows_shortcuts, unregister_number_key_shortcuts};
    if let Err(e) = unblock_windows_shortcuts(app.clone()).await {
        eprintln!("Warning: Failed to unblock Windows shortcuts: {}", e);
    } else {
        println!("[Overlay] Unblocked Windows system shortcuts");
    }
    
    // Unregister Escape key global shortcut
    use crate::commands::shortcuts::{unregister_escape_shortcut, unregister_arrow_key_shortcuts};
    if let Err(e) = unregister_escape_shortcut(app.clone()).await {
        eprintln!("Warning: Failed to unregister Escape shortcut: {}", e);
    } else {
        println!("[Overlay] Unregistered Escape key global shortcut");
    }
    
    // Unregister arrow key shortcuts
    if let Err(e) = unregister_arrow_key_shortcuts(app.clone()).await {
        eprintln!("Warning: Failed to unregister arrow key shortcuts: {}", e);
    } else {
        println!("[Overlay] Unregistered arrow key global shortcuts");
    }
    
    // Unregister number key shortcuts when overlay is hidden
    if let Err(e) = unregister_number_key_shortcuts(app.clone()).await {
        eprintln!("Warning: Failed to unregister number key shortcuts: {}", e);
    } else {
        println!("[Overlay] Unregistered number key shortcuts");
    }
    
    // Try to get window labels from app state
    let mut window_labels: Vec<String> = if let Some(state) = app.try_state::<Mutex<Vec<String>>>() {
        if let Ok(labels) = state.lock() {
            labels.clone()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };
    
    // If window_labels is empty, scan for monitor windows
    if window_labels.is_empty() || !window_labels.iter().any(|l| l.starts_with("overlay_monitor_")) {
        println!("[Overlay] Scanning for monitor windows...");
        for i in 0..10 {
            let label = format!("overlay_monitor_{}", i);
            if app.get_webview_window(&label).is_some() {
                println!("[Overlay] Found monitor window to hide: {}", label);
                if !window_labels.contains(&label) {
                    window_labels.push(label);
                }
            }
        }
    }
    
    // If we have multiple monitor windows, hide all of them
    if !window_labels.is_empty() && window_labels.iter().any(|l| l.starts_with("overlay_monitor_")) {
        println!("[Overlay] Hiding {} multi-monitor windows: {:?}", window_labels.len(), window_labels);
        MultiMonitorManager::hide_all_windows(&app, &window_labels)?;
        
        // Verify they're actually hidden
        std::thread::sleep(std::time::Duration::from_millis(200));
        for label in &window_labels {
            if let Some(window) = app.get_webview_window(label) {
                if let Ok(visible) = window.is_visible() {
                    if visible {
                        eprintln!("⚠ Window {} is still visible after hide! Forcing hide again...", label);
                        let _ = window.hide();
                        #[cfg(windows)]
                        {
                            if let Ok(hwnd_ptr) = window.hwnd() {
                                use ::windows::Win32::Foundation::HWND;
                                use ::windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
                                let hwnd = HWND(hwnd_ptr.0 as isize);
                                unsafe {
                                    let _ = ShowWindow(hwnd, SW_HIDE);
                                }
                            }
                        }
                    } else {
                        println!("✓ Window {} is now hidden", label);
                    }
                }
            }
        }
    }
    
    // Also hide main window aggressively
    if let Some(window) = app.get_webview_window("main") {
        println!("[Overlay] Hiding main window");
        let _ = window.hide();
        let _ = window.set_fullscreen(false);
        
        #[cfg(windows)]
        {
            if let Ok(hwnd_ptr) = window.hwnd() {
                use ::windows::Win32::Foundation::HWND;
                use ::windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
                let hwnd = HWND(hwnd_ptr.0 as isize);
                unsafe {
                    let _ = ShowWindow(hwnd, SW_HIDE);
                }
            }
        }
        
        // Verify it's hidden
        std::thread::sleep(std::time::Duration::from_millis(100));
        if let Ok(visible) = window.is_visible() {
            if visible {
                eprintln!("⚠ Main window still visible, forcing hide again...");
                let _ = window.hide();
            } else {
                println!("✓ Main window is now hidden");
            }
        }
    }
    
    println!("[Overlay] hide_overlay completed");
    Ok(())
}

