// Window enumeration and tracking service
// Uses Windows API to enumerate, track, and monitor windows

use crate::models::window::WindowInfo;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[cfg(windows)]
use ::windows::{
    core::PWSTR,
    Win32::Foundation::*,
    Win32::UI::WindowsAndMessaging::*,
    Win32::System::Threading::*,
    Win32::System::ProcessStatus::*,
};

pub struct WindowTracker {
    cached_windows: Arc<Mutex<HashMap<isize, WindowInfo>>>,
    last_poll: Arc<Mutex<Instant>>,
    foreground_window: Arc<Mutex<Option<isize>>>,
}

impl WindowTracker {
    pub fn new() -> Self {
        Self {
            cached_windows: Arc::new(Mutex::new(HashMap::new())),
            last_poll: Arc::new(Mutex::new(Instant::now())),
            foreground_window: Arc::new(Mutex::new(None)),
        }
    }

    /// Enumerate all open windows
    pub fn enumerate_windows(&self) -> Result<Vec<WindowInfo>, String> {
        #[cfg(windows)]
        {
            let mut windows = Vec::new();
            let mut window_data = Vec::<(HWND, String, String, String)>::new();

            unsafe {
                // EnumWindows callback to collect window handles
                extern "system" fn enum_windows_proc(
                    hwnd: HWND,
                    lparam: LPARAM,
                ) -> BOOL {
                    unsafe {
                        let windows = &mut *(lparam.0 as *mut Vec<(HWND, String, String, String)>);
                        
                        // Check if window is visible
                        if IsWindowVisible(hwnd).as_bool() {
                            // Get window title
                            let mut title = [0u16; 256];
                            let title_len = GetWindowTextW(hwnd, &mut title);
                            let title_str = if title_len > 0 {
                                String::from_utf16_lossy(&title[..title_len as usize])
                            } else {
                                String::new()
                            };

                            // Skip windows with no title (usually system windows)
                            if title_str.is_empty() {
                                return BOOL::from(true);
                            }

                            // Get process ID
                            let mut process_id: u32 = 0;
                            GetWindowThreadProcessId(hwnd, Some(&mut process_id));

                            // Get process name and executable path
                            let process_name = WindowTracker::get_process_name(process_id).unwrap_or_default();
                            let executable_path = WindowTracker::get_executable_path(process_id).unwrap_or_default();

                            windows.push((hwnd, title_str, process_name, executable_path));
                        }
                        
                        BOOL::from(true)
                    }
                }

                // Enumerate all windows
                let result = EnumWindows(
                    Some(enum_windows_proc),
                    LPARAM(&mut window_data as *mut _ as isize),
                );

                if result.is_err() {
                    return Err("Failed to enumerate windows".to_string());
                }
            }

            // Convert to WindowInfo
            let now = Utc::now();
            for (hwnd, title, process_name, executable_path) in window_data {
                let handle = hwnd.0 as isize;
                
                // Check if this window was in cache to get last_active time
                let last_active = {
                    let cache = self.cached_windows.lock().unwrap();
                    cache.get(&handle)
                        .map(|w| w.last_active)
                        .unwrap_or(now)
                };

                let is_visible = unsafe { IsWindowVisible(hwnd).as_bool() };

                windows.push(WindowInfo {
                    handle,
                    title,
                    process_name,
                    executable_path,
                    last_active,
                    is_visible,
                });
            }

            // Update cache
            {
                let mut cache = self.cached_windows.lock().unwrap();
                cache.clear();
                for window in &windows {
                    cache.insert(window.handle, window.clone());
                }
            }

            // Update last poll time
            {
                let mut last_poll = self.last_poll.lock().unwrap();
                *last_poll = Instant::now();
            }

            Ok(windows)
        }

        #[cfg(not(windows))]
        {
            Ok(vec![])
        }
    }

    /// Get only visible windows
    pub fn get_visible_windows(&self) -> Result<Vec<WindowInfo>, String> {
        let all_windows = self.enumerate_windows()?;
        Ok(all_windows.into_iter().filter(|w| w.is_visible).collect())
    }

    /// Get window titles
    pub fn get_window_titles(&self) -> Result<Vec<String>, String> {
        let windows = self.enumerate_windows()?;
        Ok(windows.into_iter().map(|w| w.title).collect())
    }

    /// Get process names
    pub fn get_process_names(&self) -> Result<Vec<String>, String> {
        let windows = self.enumerate_windows()?;
        let mut process_names: Vec<String> = windows.into_iter().map(|w| w.process_name).collect();
        process_names.sort();
        process_names.dedup();
        Ok(process_names)
    }

    /// Get window handles
    pub fn get_window_handles(&self) -> Result<Vec<isize>, String> {
        let windows = self.enumerate_windows()?;
        Ok(windows.into_iter().map(|w| w.handle).collect())
    }

    /// Get currently active (foreground) window
    pub fn get_active_window(&self) -> Result<Option<WindowInfo>, String> {
        #[cfg(windows)]
        {
            unsafe {
                let hwnd = GetForegroundWindow();
                if hwnd.0 == 0 {
                    return Ok(None);
                }

                let handle = hwnd.0 as isize;
                
                // Check cache first
                {
                    let cache = self.cached_windows.lock().unwrap();
                    if let Some(window) = cache.get(&handle) {
                        return Ok(Some(window.clone()));
                    }
                }

                // Get window info
                let mut title = [0u16; 256];
                let title_len = GetWindowTextW(hwnd, &mut title);
                let title_str = if title_len > 0 {
                    String::from_utf16_lossy(&title[..title_len as usize])
                } else {
                    String::new()
                };

                let mut process_id: u32 = 0;
                GetWindowThreadProcessId(hwnd, Some(&mut process_id));
                let process_name = WindowTracker::get_process_name(process_id).unwrap_or_default();
                let executable_path = WindowTracker::get_executable_path(process_id).unwrap_or_default();
                let is_visible = IsWindowVisible(hwnd).as_bool();

                let window = WindowInfo {
                    handle,
                    title: title_str,
                    process_name,
                    executable_path,
                    last_active: Utc::now(),
                    is_visible,
                };

                // Update cache
                {
                    let mut cache = self.cached_windows.lock().unwrap();
                    cache.insert(handle, window.clone());
                }

                // Update foreground window
                {
                    let mut fg = self.foreground_window.lock().unwrap();
                    *fg = Some(handle);
                }

                Ok(Some(window))
            }
        }

        #[cfg(not(windows))]
        {
            Ok(None)
        }
    }

    /// Track window focus changes
    pub fn track_focus_changes(&self) -> Result<Option<WindowInfo>, String> {
        let active = self.get_active_window()?;
        
        if let Some(ref window) = active {
            let handle = window.handle;
            
            // Check if focus changed
            let focus_changed = {
                let fg = self.foreground_window.lock().unwrap();
                *fg != Some(handle)
            };

            if focus_changed {
                println!("Focus changed to: {} ({})", window.title, window.process_name);
                
                // Update foreground window
                {
                    let mut fg = self.foreground_window.lock().unwrap();
                    *fg = Some(handle);
                }

                return Ok(active);
            }
        }

        Ok(None)
    }

    /// Track window open/close events by comparing with cache
    pub fn track_window_changes(&self) -> Result<(Vec<WindowInfo>, Vec<isize>), String> {
        let current_windows = self.enumerate_windows()?;
        let current_handles: std::collections::HashSet<isize> = 
            current_windows.iter().map(|w| w.handle).collect();

        let cache = self.cached_windows.lock().unwrap();
        let cached_handles: std::collections::HashSet<isize> = 
            cache.keys().cloned().collect();

        // Find opened windows (in current but not in cache)
        let opened: Vec<WindowInfo> = current_windows
            .into_iter()
            .filter(|w| !cached_handles.contains(&w.handle))
            .collect();

        // Find closed windows (in cache but not in current)
        let closed: Vec<isize> = cached_handles
            .into_iter()
            .filter(|h| !current_handles.contains(h))
            .collect();

        if !opened.is_empty() {
            println!("Windows opened: {:?}", opened.iter().map(|w| &w.title).collect::<Vec<_>>());
        }

        if !closed.is_empty() {
            println!("Windows closed: {:?}", closed);
        }

        Ok((opened, closed))
    }

    /// Get window last active time
    pub fn get_window_last_active(&self, handle: isize) -> Option<DateTime<Utc>> {
        let cache = self.cached_windows.lock().unwrap();
        cache.get(&handle).map(|w| w.last_active)
    }

    /// Poll for window changes (should be called every 2 seconds)
    pub fn poll(&self) -> Result<WindowChangeResult, String> {
        let now = Instant::now();
        let should_poll = {
            let last_poll = self.last_poll.lock().unwrap();
            now.duration_since(*last_poll) >= Duration::from_secs(2)
        };

        if !should_poll {
            return Ok(WindowChangeResult::NoChange);
        }

        // Track focus changes
        let focus_changed = self.track_focus_changes()?;

        // Track window open/close
        let (opened, closed) = self.track_window_changes()?;

        if focus_changed.is_some() || !opened.is_empty() || !closed.is_empty() {
            Ok(WindowChangeResult::Changed {
                focus_changed,
                opened,
                closed,
            })
        } else {
            Ok(WindowChangeResult::NoChange)
        }
    }

    #[cfg(windows)]
    /// Get process name from process ID
    fn get_process_name(process_id: u32) -> Result<String, String> {
        // Get executable path first, then extract filename
        match Self::get_executable_path(process_id) {
            Ok(path) => {
                let name = std::path::Path::new(&path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Unknown")
                    .to_string();
                Ok(name)
            }
            Err(_) => Ok(format!("Process_{}", process_id))
        }
    }

    #[cfg(not(windows))]
    fn get_process_name(_process_id: u32) -> Result<String, String> {
        Ok("Unknown".to_string())
    }

    #[cfg(windows)]
    /// Get executable path from process ID
    fn get_executable_path(process_id: u32) -> Result<String, String> {
        unsafe {
            // Open process handle with limited access (just to query name)
            let handle = OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION,
                false, // bInheritHandle
                process_id,
            );

            if handle.is_err() {
                // Try with limited information access (works for more processes)
                let handle = OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION,
                    false,
                    process_id,
                );
                
                if handle.is_err() {
                    return Err(format!("Failed to open process {}", process_id));
                }
                
                return Self::query_process_image_name(handle.unwrap());
            }

            Self::query_process_image_name(handle.unwrap())
        }
    }

    #[cfg(windows)]
    /// Query the full image name for a process handle
    fn query_process_image_name(handle: HANDLE) -> Result<String, String> {
        unsafe {
            // QueryFullProcessImageNameW requires a buffer
            let mut buffer = vec![0u16; 260]; // MAX_PATH
            let mut size = buffer.len() as u32;

            // Try QueryFullProcessImageNameW (Windows Vista+)
            // Get a pointer to the buffer
            let result = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32, // 0 = full path
                PWSTR(buffer.as_mut_ptr()),
                &mut size,
            );

            if result.is_ok() && size > 0 && size <= buffer.len() as u32 {
                let path = String::from_utf16_lossy(&buffer[..size as usize]);
                let _ = CloseHandle(handle); // Clean up handle
                return Ok(path);
            }

            // Fallback: Try with native format
            let mut size = buffer.len() as u32;
            let result = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_NATIVE, // 1 = native format
                PWSTR(buffer.as_mut_ptr()),
                &mut size,
            );

            if result.is_ok() && size > 0 && size <= buffer.len() as u32 {
                let path = String::from_utf16_lossy(&buffer[..size as usize]);
                let _ = CloseHandle(handle);
                return Ok(path);
            }

            let _ = CloseHandle(handle);
            Err("Failed to query process image name".to_string())
        }
    }

    #[cfg(not(windows))]
    fn get_executable_path(_process_id: u32) -> Result<String, String> {
        Ok(String::new())
    }
}

/// Result of window change polling
#[derive(Debug)]
pub enum WindowChangeResult {
    NoChange,
    Changed {
        focus_changed: Option<WindowInfo>,
        opened: Vec<WindowInfo>,
        closed: Vec<isize>,
    },
}
