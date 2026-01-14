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

#[tauri::command]
pub async fn bring_window_to_front(handle: isize) -> Result<(), String> {
    #[cfg(windows)]
    {
        use ::windows::Win32::Foundation::{HWND, BOOL};
        use ::windows::Win32::System::Threading::{GetCurrentThreadId, AttachThreadInput};
        use ::windows::Win32::UI::WindowsAndMessaging::{
            SetForegroundWindow, BringWindowToTop, ShowWindow, SW_RESTORE, SW_SHOW, 
            IsWindow, GetWindowThreadProcessId, AllowSetForegroundWindow, ASFW_ANY
        };
        
        unsafe {
            let hwnd = HWND(handle as isize);
            
            // Check if window is valid
            if !IsWindow(hwnd).as_bool() {
                return Err(format!("Invalid window handle: {}", handle));
            }
            
            println!("[bring_window_to_front] Attempting to bring window {} to front", handle);
            
            // Get the thread ID of the target window
            let mut target_thread_id = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut target_thread_id));
            let current_thread_id = GetCurrentThreadId();
            
            // If threads are different, attach input to allow SetForegroundWindow
            let thread_attached = if target_thread_id != current_thread_id {
                println!("[bring_window_to_front] Attaching thread input (target: {}, current: {})", target_thread_id, current_thread_id);
                let attach_result = AttachThreadInput(current_thread_id, target_thread_id, BOOL::from(true));
                attach_result.as_bool()
            } else {
                false
            };
            
            if !thread_attached && target_thread_id != current_thread_id {
                println!("[bring_window_to_front] Warning: Failed to attach thread input, continuing anyway");
            }
            
            // Allow the target window to set foreground
            let _ = AllowSetForegroundWindow(ASFW_ANY);
            
            // Restore window if minimized
            let show_result = ShowWindow(hwnd, SW_RESTORE);
            if show_result.as_bool() {
                println!("[bring_window_to_front] Window restored from minimized state");
            }
            
            // Also try SW_SHOW to ensure it's visible
            let _ = ShowWindow(hwnd, SW_SHOW);
            
            // Bring to top
            let bring_result = BringWindowToTop(hwnd);
            if bring_result.is_err() {
                println!("[bring_window_to_front] Warning: BringWindowToTop failed");
            }
            
            // Set foreground window (this is the critical call)
            let set_fg_result = SetForegroundWindow(hwnd);
            if set_fg_result.as_bool() {
                println!("[bring_window_to_front] ✓ Successfully set foreground window");
            } else {
                println!("[bring_window_to_front] Warning: SetForegroundWindow returned false");
            }
            
            // Detach thread input if we attached it
            if thread_attached {
                let _ = AttachThreadInput(current_thread_id, target_thread_id, BOOL::from(false));
            }
            
            // Small delay to let Windows process the window activation
            std::thread::sleep(std::time::Duration::from_millis(50));
            
            Ok(())
        }
    }
    
    #[cfg(not(windows))]
    {
        Err("Window activation is only supported on Windows".to_string())
    }
}

