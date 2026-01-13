// Multi-monitor overlay window manager
// Creates separate overlay windows for each monitor

use tauri::{AppHandle, Manager};
use crate::utils::windows_api::{get_all_monitors, get_monitor_info};


pub struct MultiMonitorManager {
    window_labels: Vec<String>,
}

impl MultiMonitorManager {
    pub fn new() -> Self {
        Self {
            window_labels: Vec::new(),
        }
    }

    /// Create overlay windows for each monitor
    pub async fn create_monitor_windows(app: &AppHandle) -> Result<Vec<String>, String> {
        let mut window_labels = Vec::new();
        
        #[cfg(windows)]
        {
            match get_all_monitors() {
                Ok(monitors) => {
                    println!("Creating overlay windows for {} monitor(s)", monitors.len());
                    
                    for (index, monitor) in monitors.iter().enumerate() {
                        match get_monitor_info(*monitor) {
                            Ok(monitor_info) => {
                                let label = format!("overlay_monitor_{}", index);
                                
                                // Get monitor dimensions
                                let width = (monitor_info.rcMonitor.right - monitor_info.rcMonitor.left) as f64;
                                let height = (monitor_info.rcMonitor.bottom - monitor_info.rcMonitor.top) as f64;
                                let x = monitor_info.rcMonitor.left as f64;
                                let y = monitor_info.rcMonitor.top as f64;
                                
                                println!("Monitor {}: {}x{} at ({}, {})", index, width, height, x, y);
                                
                                // Create window for this monitor using Tauri v2 API
                                use tauri::WebviewWindowBuilder;
                                
                                match WebviewWindowBuilder::new(
                                    app,
                                    &label,
                                    tauri::WebviewUrl::App("index.html".into())
                                )
                                .title("Pause Menu")
                                .inner_size(width, height)
                                .position(x, y)
                                .fullscreen(false)
                                .transparent(true)
                                .decorations(false)
                                .always_on_top(true)
                                .skip_taskbar(true)
                                .focusable(true) // MUST be true to receive keyboard events!
                                .visible(false)
                                .resizable(false)
                                .build() {
                                    Ok(window) => {
                                        println!("✓ Created overlay window for monitor {}: {}x{} at ({}, {})", 
                                            index, width, height, x, y);
                                        
                                        // Verify the window was created with correct properties
                                        if let Ok(actual_size) = window.inner_size() {
                                            println!("  Window actual size: {}x{}", actual_size.width, actual_size.height);
                                        }
                                        if let Ok(actual_pos) = window.outer_position() {
                                            println!("  Window actual position: ({}, {})", actual_pos.x, actual_pos.y);
                                        }
                                        
                                        window_labels.push(label);
                                    }
                                    Err(e) => {
                                        eprintln!("✗✗✗ Failed to create window for monitor {}: {} ✗✗✗", index, e);
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to get monitor {} info: {}", index, e);
                            }
                        }
                    }
                }
                Err(e) => {
                    return Err(format!("Failed to enumerate monitors: {}", e));
                }
            }
        }
        
        #[cfg(not(windows))]
        {
            // Non-Windows: just use main window
            window_labels.push("main".to_string());
        }
        
        Ok(window_labels)
    }

    /// Show all overlay windows
    pub fn show_all_windows(app: &AppHandle, window_labels: &[String]) -> Result<(), String> {
        #[cfg(windows)]
        {
            // Get monitor info to position windows correctly
            match get_all_monitors() {
                Ok(monitors) => {
                    for (index, label) in window_labels.iter().enumerate() {
                        if let Some(window) = app.get_webview_window(label) {
                            println!("Showing overlay window: {} (monitor {})", label, index);
                            
                            // Get monitor info for this window
                            if index < monitors.len() {
                                if let Ok(monitor_info) = get_monitor_info(monitors[index]) {
                                    let width = (monitor_info.rcMonitor.right - monitor_info.rcMonitor.left) as f64;
                                    let height = (monitor_info.rcMonitor.bottom - monitor_info.rcMonitor.top) as f64;
                                    let x = monitor_info.rcMonitor.left as f64;
                                    let y = monitor_info.rcMonitor.top as f64;
                                    
                                    println!("  Positioning window at {}x{} size {}x{}", x, y, width, height);
                                    
                                    // Set size and position to match monitor exactly
                                    if let Err(e) = window.set_size(tauri::LogicalSize::new(width, height)) {
                                        eprintln!("Warning: Failed to set size for {}: {}", label, e);
                                    }
                                    
                                    if let Err(e) = window.set_position(tauri::LogicalPosition::new(x, y)) {
                                        eprintln!("Warning: Failed to set position for {}: {}", label, e);
                                    }
                                }
                            }
                            
                            // Set always on top first
                            if let Err(e) = window.set_always_on_top(true) {
                                eprintln!("Warning: Failed to set always on top for {}: {}", label, e);
                            } else {
                                println!("✓ Set always on top for {}", label);
                            }
                            
                            // DO NOT use fullscreen - it can span across monitors
                            // Instead, ensure window is not fullscreen
                            if let Err(e) = window.set_fullscreen(false) {
                                eprintln!("Warning: Failed to unset fullscreen for {}: {}", label, e);
                            }
                            
                            // Ensure window is focusable
                            if let Err(e) = window.set_focusable(true) {
                                eprintln!("Warning: Failed to set focusable for {}: {}", label, e);
                            } else {
                                println!("✓ Set focusable for {}", label);
                            }
                            
                            // Show window
                            if let Err(e) = window.show() {
                                eprintln!("✗ Failed to show window {}: {}", label, e);
                            } else {
                                println!("✓ Shown overlay window: {} on monitor {}", label, index);
                                
                                // Force focus using Windows API
                                #[cfg(windows)]
                                {
                                    if let Ok(hwnd_ptr) = window.hwnd() {
                                        use ::windows::Win32::Foundation::HWND;
                                        use ::windows::Win32::UI::WindowsAndMessaging::{SetForegroundWindow, BringWindowToTop, ShowWindow, SW_RESTORE};
                                        let hwnd = HWND(hwnd_ptr.0 as isize);
                                        unsafe {
                                            let _ = BringWindowToTop(hwnd);
                                            let _ = SetForegroundWindow(hwnd);
                                            let _ = ShowWindow(hwnd, SW_RESTORE);
                                        }
                                        println!("✓ Forced focus for {} using Windows API", label);
                                    }
                                }
                                
                                // Also try Tauri's setFocus
                                if let Err(e) = window.set_focus() {
                                    eprintln!("Warning: Failed to set focus for {}: {}", label, e);
                                } else {
                                    println!("✓ Set focus for {} using Tauri API", label);
                                }
                                
                                // Verify it's actually visible
                                std::thread::sleep(std::time::Duration::from_millis(100));
                                match window.is_visible() {
                                    Ok(visible) => {
                                        println!("Window {} visibility after show(): {}", label, visible);
                                        if !visible {
                                            eprintln!("⚠⚠⚠ WARNING: window.show() succeeded but is_visible() is false! ⚠⚠⚠");
                                            // Try showing again
                                            let _ = window.show();
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("Error checking visibility after show(): {}", e);
                                    }
                                }
                            }
                        } else {
                            eprintln!("✗✗✗ Window {} not found! ✗✗✗", label);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to get monitors for positioning: {}", e);
                    // Fallback: just show windows without positioning
                    for label in window_labels {
                        if let Some(window) = app.get_webview_window(label) {
                            window.set_always_on_top(true).ok();
                            window.set_fullscreen(false).ok();
                            window.show().ok();
                        }
                    }
                }
            }
        }
        
        #[cfg(not(windows))]
        {
            // Non-Windows: just show windows
            for label in window_labels {
                if let Some(window) = app.get_webview_window(label) {
                    window.set_always_on_top(true).ok();
                    window.set_fullscreen(false).ok();
                    window.show().ok();
                }
            }
        }
        
        Ok(())
    }

    /// Hide all overlay windows
    pub fn hide_all_windows(app: &AppHandle, window_labels: &[String]) -> Result<(), String> {
        println!("[MultiMonitor] Hiding {} windows", window_labels.len());
        for label in window_labels {
            if let Some(window) = app.get_webview_window(label) {
                println!("[MultiMonitor] Hiding window: {}", label);
                
                // Force hide using multiple methods
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
                
                // Verify it's hidden
                std::thread::sleep(std::time::Duration::from_millis(50));
                match window.is_visible() {
                    Ok(visible) => {
                        if visible {
                            eprintln!("⚠ Window {} is still visible after hide! Trying again...", label);
                            let _ = window.hide();
                        } else {
                            println!("✓ Hidden overlay window: {}", label);
                        }
                    }
                    Err(e) => {
                        eprintln!("Error checking visibility after hide: {}", e);
                    }
                }
            } else {
                eprintln!("✗ Window {} not found for hiding", label);
            }
        }
        Ok(())
    }

    /// Check if any overlay window is visible
    pub fn is_any_window_visible(app: &AppHandle, window_labels: &[String]) -> bool {
        println!("[MultiMonitor] Checking visibility of {} windows", window_labels.len());
        for label in window_labels {
            if let Some(window) = app.get_webview_window(label) {
                match window.is_visible() {
                    Ok(is_visible) => {
                        println!("[MultiMonitor] Window {} visibility: {}", label, is_visible);
                        if is_visible {
                            return true;
                        }
                    }
                    Err(e) => {
                        eprintln!("[MultiMonitor] Error checking visibility of {}: {}", label, e);
                    }
                }
            } else {
                println!("[MultiMonitor] Window {} not found", label);
            }
        }
        println!("[MultiMonitor] No windows are visible");
        false
    }
}

