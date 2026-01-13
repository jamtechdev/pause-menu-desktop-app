use std::path::Path;
use std::process::Command;
use std::result::Result;
use std::sync::{Arc, OnceLock};
use std::time::Instant;
use tokio::sync::RwLock;

#[cfg(windows)]
use windows::{
    core::*,
    Win32::Foundation::*,
    Win32::System::Com::*,
    Win32::UI::Shell::*,
    Win32::UI::WindowsAndMessaging::*,
};

/// Cache entry for app list
struct AppListCache {
    apps: Vec<AppInfo>,
    cached_at: Instant,
    filter_system: bool,
}

/// Global app list cache
static APP_LIST_CACHE: OnceLock<Arc<RwLock<Option<AppListCache>>>> = OnceLock::new();

/// Cache TTL: 5 minutes
const CACHE_TTL_SECONDS: u64 = 300;

/// Get or initialize the app list cache
fn get_app_cache() -> Arc<RwLock<Option<AppListCache>>> {
    APP_LIST_CACHE
        .get_or_init(|| Arc::new(RwLock::new(None)))
        .clone()
}

/// Launch an application by name or path
#[tauri::command]
pub async fn launch_app(name_or_path: String) -> Result<(), String> {
    println!("[Launch] Launching app: {}", name_or_path);
    
    #[cfg(windows)]
    {
        // Check if it's a path (contains / or \ or : or .exe)
        let is_path = name_or_path.contains('/') || 
                     name_or_path.contains('\\') || 
                     name_or_path.contains(':') ||
                     name_or_path.ends_with(".exe") ||
                     name_or_path.ends_with(".lnk") ||
                     Path::new(&name_or_path).exists();
        
        let target_path = if !is_path {
            // It's a name - try to find the app
            println!("[Launch] Searching for app by name: {}", name_or_path);
            match find_app_by_name(&name_or_path).await {
                Some(path) => {
                    println!("[Launch] Found app: {} -> {}", name_or_path, path);
                    path
                }
                None => {
                    // Try launching by name directly (Windows will search PATH)
                    name_or_path.clone()
                }
            }
        } else {
            name_or_path.clone()
        };
        
        // Try Windows ShellExecute API first (most reliable)
        match launch_with_shellexecute(&target_path) {
            Ok(_) => {
                println!("[Launch] ✓ Launched via ShellExecute: {}", target_path);
                return Ok(());
            }
            Err(e) => {
                eprintln!("[Launch] ShellExecute failed: {}, trying fallback...", e);
            }
        }
        
        // Fallback: Try Tauri shell plugin
        match launch_with_shell(&target_path).await {
            Ok(_) => {
                println!("[Launch] ✓ Launched via shell: {}", target_path);
                return Ok(());
            }
            Err(e) => {
                eprintln!("[Launch] Shell launch failed: {}, trying direct execution...", e);
            }
        }
        
        // Final fallback: Direct execution
        launch_with_command(&target_path)
    }
    
    #[cfg(not(windows))]
    {
        // Non-Windows: Use shell plugin
        launch_with_shell(&name_or_path).await
    }
}

/// Find an application by name in Start Menu (uses cache if available)
#[cfg(windows)]
async fn find_app_by_name(name: &str) -> Option<String> {
    use std::path::PathBuf;
    
    let name_lower = name.to_lowercase();
    let mut apps = Vec::new();
    
    // Try to use cache first
    let cache = get_app_cache();
    let cache_read = cache.read().await;
    
    if let Some(cached) = cache_read.as_ref() {
        if cached.filter_system == true {
            let age = cached.cached_at.elapsed();
            if age.as_secs() < CACHE_TTL_SECONDS {
                // Use cached apps
                apps = cached.apps.clone();
                drop(cache_read);
            } else {
                drop(cache_read);
                // Cache expired, scan fresh
                let start_menu_paths = vec![
                    dirs::home_dir()?.join("AppData/Roaming/Microsoft/Windows/Start Menu/Programs"),
                    PathBuf::from("C:/ProgramData/Microsoft/Windows/Start Menu/Programs"),
                ];
                
                for start_menu in start_menu_paths {
                    if start_menu.exists() {
                        if let Ok(_) = scan_directory_for_search(&start_menu, &mut apps, true) {
                            // Continue searching
                        }
                    }
                }
            }
        } else {
            drop(cache_read);
            // Cache has different filter, scan fresh
            let start_menu_paths = vec![
                dirs::home_dir()?.join("AppData/Roaming/Microsoft/Windows/Start Menu/Programs"),
                PathBuf::from("C:/ProgramData/Microsoft/Windows/Start Menu/Programs"),
            ];
            
            for start_menu in start_menu_paths {
                if start_menu.exists() {
                    if let Ok(_) = scan_directory_for_search(&start_menu, &mut apps, true) {
                        // Continue searching
                    }
                }
            }
        }
    } else {
        drop(cache_read);
        // No cache, scan fresh
        let start_menu_paths = vec![
            dirs::home_dir()?.join("AppData/Roaming/Microsoft/Windows/Start Menu/Programs"),
            PathBuf::from("C:/ProgramData/Microsoft/Windows/Start Menu/Programs"),
        ];
        
        for start_menu in start_menu_paths {
            if start_menu.exists() {
                if let Ok(_) = scan_directory_for_search(&start_menu, &mut apps, true) {
                    // Continue searching
                }
            }
        }
    }
    
    // Find best match - prioritize exact matches
    let mut exact_match: Option<String> = None;
    let mut partial_match: Option<String> = None;
    
    for app in apps {
        let app_name_lower = app.name.to_lowercase();
        // Exact match (highest priority)
        if app_name_lower == name_lower {
            exact_match = Some(app.path);
            break;
        }
        // Contains match (lower priority)
        if app_name_lower.contains(&name_lower) || name_lower.contains(&app_name_lower) {
            if partial_match.is_none() {
                partial_match = Some(app.path);
            }
        }
    }
    
    exact_match.or(partial_match)
}

/// Helper function to scan directory for app search (reuses scan_directory logic)
#[cfg(windows)]
fn scan_directory_for_search(dir: &Path, apps: &mut Vec<AppInfo>, filter_system: bool) -> Result<(), String> {
    scan_directory(dir, apps, filter_system)
}

/// Launch a file by path
#[tauri::command]
pub async fn launch_file(file_path: String) -> Result<(), String> {
    println!("[Launch] Launching file: {}", file_path);
    
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    #[cfg(windows)]
    {
        // Use ShellExecute for files (handles file associations automatically)
        match launch_with_shellexecute(&file_path) {
            Ok(_) => {
                println!("[Launch] ✓ Launched file via ShellExecute: {}", file_path);
                Ok(())
            }
            Err(e) => {
                eprintln!("[Launch] ShellExecute failed: {}, trying shell...", e);
                launch_with_shell(&file_path).await
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        launch_with_shell(&file_path).await
    }
}

/// Open a folder
#[tauri::command]
pub async fn open_folder(folder_path: String) -> Result<(), String> {
    println!("[Launch] Opening folder: {}", folder_path);
    
    let path = Path::new(&folder_path);
    if !path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }
    
    #[cfg(windows)]
    {
        // Use ShellExecute for folders
        match launch_with_shellexecute(&folder_path) {
            Ok(_) => {
                println!("[Launch] ✓ Opened folder via ShellExecute: {}", folder_path);
                Ok(())
            }
            Err(e) => {
                eprintln!("[Launch] ShellExecute failed: {}, trying explorer...", e);
                // Fallback: Use explorer command
                Command::new("explorer")
                    .arg(&folder_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open folder: {}", e))?;
                Ok(())
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        // Use system-specific commands
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&folder_path)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(&folder_path)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
        Ok(())
    }
}

/// Launch a URL
#[tauri::command]
pub async fn launch_url(url: String) -> Result<(), String> {
    println!("[Launch] Launching URL: {}", url);
    
    // Validate URL format
    if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("file://") {
        return Err(format!("Invalid URL format: {}", url));
    }
    
    #[cfg(windows)]
    {
        // Use ShellExecute for URLs
        match launch_with_shellexecute(&url) {
            Ok(_) => {
                println!("[Launch] ✓ Launched URL via ShellExecute: {}", url);
                Ok(())
            }
            Err(e) => {
                eprintln!("[Launch] ShellExecute failed: {}, trying default browser...", e);
                // Fallback: Use start command
                Command::new("cmd")
                    .args(["/C", "start", &url])
                    .spawn()
                    .map_err(|e| format!("Failed to launch URL: {}", e))?;
                Ok(())
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&url)
                .spawn()
                .map_err(|e| format!("Failed to launch URL: {}", e))?;
        }
        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(&url)
                .spawn()
                .map_err(|e| format!("Failed to launch URL: {}", e))?;
        }
        Ok(())
    }
}

/// Get list of installed applications from Start Menu (with caching)
#[tauri::command]
pub async fn get_installed_apps(filter_system: Option<bool>) -> Result<Vec<AppInfo>, String> {
    let filter = filter_system.unwrap_or(true);
    println!("[Launch] Getting installed apps (filter_system: {})", filter);
    
    #[cfg(windows)]
    {
        let cache = get_app_cache();
        let cache_read = cache.read().await;
        
        // Check if cache is valid
        if let Some(cached) = cache_read.as_ref() {
            if cached.filter_system == filter {
                let age = cached.cached_at.elapsed();
                if age.as_secs() < CACHE_TTL_SECONDS {
                    println!("[Launch] ✓ Using cached app list (age: {}s, {} apps)", age.as_secs(), cached.apps.len());
                    return Ok(cached.apps.clone());
                } else {
                    println!("[Launch] Cache expired (age: {}s), refreshing...", age.as_secs());
                }
            } else {
                println!("[Launch] Cache filter mismatch (cached: {}, requested: {}), refreshing...", cached.filter_system, filter);
            }
        }
        
        // Drop read lock before acquiring write lock
        drop(cache_read);
        
        // Scan and cache
        println!("[Launch] Scanning Start Menu for apps...");
        let apps = scan_start_menu_apps(filter)?;
        
        // Update cache
        let mut cache_write = cache.write().await;
        *cache_write = Some(AppListCache {
            apps: apps.clone(),
            cached_at: Instant::now(),
            filter_system: filter,
        });
        println!("[Launch] ✓ Cached {} apps", apps.len());
        
        Ok(apps)
    }
    
    #[cfg(not(windows))]
    {
        // Non-Windows: Return empty for now
        Ok(Vec::new())
    }
}

/// Refresh the app list cache (force re-scan)
#[tauri::command]
pub async fn refresh_app_list_cache() -> Result<(), String> {
    println!("[Launch] Refreshing app list cache...");
    
    let cache = get_app_cache();
    let mut cache_write = cache.write().await;
    
    // Clear cache
    *cache_write = None;
    
    println!("[Launch] ✓ Cache cleared");
    Ok(())
}

/// App information structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub description: Option<String>,
}

/// Windows ShellExecute implementation
#[cfg(windows)]
fn launch_with_shellexecute(path: &str) -> Result<(), String> {
    unsafe {
        // Initialize COM (ignore errors - may already be initialized)
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        
        let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let path_hstring = HSTRING::from_wide(&path_wide[..path_wide.len() - 1])
            .map_err(|e| format!("Failed to create HSTRING: {:?}", e))?;
        
        // Use ShellExecute to launch (handles file associations automatically)
        let result = ShellExecuteW(
            HWND::default(),
            w!("open"),
            &path_hstring,
            None,
            None,
            SW_SHOWNORMAL,
        );
        
        // ShellExecute returns a value > 32 on success (as HINSTANCE)
        // Check if result is valid (not an error code)
        let result_value = result.0 as i32;
        if result_value > 32 {
            Ok(())
        } else {
            Err(format!("ShellExecute failed with code: {}", result_value))
        }
    }
}

/// Tauri shell plugin implementation
#[cfg(windows)]
async fn launch_with_shell(path: &str) -> Result<(), String> {
    // Note: This would require the app handle, but we can use std::process as fallback
    // For now, use Command directly
    Command::new("cmd")
        .args(["/C", "start", "", path])
        .spawn()
        .map_err(|e| format!("Failed to launch: {}", e))?;
    Ok(())
}

#[cfg(not(windows))]
async fn launch_with_shell(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
    }
    Ok(())
}

/// Direct command execution fallback
fn launch_with_command(path: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        // Try to execute directly
        if Path::new(path).exists() {
            Command::new(path)
                .spawn()
                .map_err(|e| format!("Failed to execute: {}", e))?;
            Ok(())
        } else {
            // Try as a command name
            Command::new(path)
                .spawn()
                .map_err(|e| format!("Failed to launch app: {}", e))?;
            Ok(())
        }
    }
    
    #[cfg(not(windows))]
    {
        Command::new(path)
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
        Ok(())
    }
}

/// Scan Start Menu for installed applications
#[cfg(windows)]
fn scan_start_menu_apps(filter_system: bool) -> Result<Vec<AppInfo>, String> {
    use std::path::PathBuf;
    
    let mut apps = Vec::new();
    
    // Common Start Menu locations
    let start_menu_paths = vec![
        dirs::home_dir()
            .ok_or_else(|| "Could not find home directory".to_string())?
            .join("AppData/Roaming/Microsoft/Windows/Start Menu/Programs"),
        PathBuf::from("C:/ProgramData/Microsoft/Windows/Start Menu/Programs"),
    ];
    
    for start_menu in start_menu_paths {
        if start_menu.exists() {
            scan_directory(&start_menu, &mut apps, filter_system)?;
        }
    }
    
    // Sort by name
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    
    println!("[Launch] Found {} apps", apps.len());
    Ok(apps)
}

/// Recursively scan directory for .lnk and .exe files
#[cfg(windows)]
fn scan_directory(dir: &Path, apps: &mut Vec<AppInfo>, filter_system: bool) -> Result<(), String> {
    use std::fs;
    
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        
        if path.is_dir() {
            // Recursively scan subdirectories
            scan_directory(&path, apps, filter_system)?;
        } else {
            let extension = path.extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            
            if extension == "lnk" || extension == "exe" {
                if let Some(app_info) = parse_app_entry(&path, filter_system) {
                    apps.push(app_info);
                }
            }
        }
    }
    
    Ok(())
}

/// Parse a .lnk or .exe file into AppInfo
#[cfg(windows)]
fn parse_app_entry(path: &Path, filter_system: bool) -> Option<AppInfo> {
    let name = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    
    // Filter out system apps if requested
    if filter_system {
        let name_lower = name.to_lowercase();
        // Common system app patterns to filter
        if name_lower.contains("uninstall") ||
           name_lower.contains("setup") ||
           name_lower.contains("installer") ||
           name_lower.starts_with("microsoft") && name_lower.contains("edge") ||
           name_lower == "windows defender" ||
           name_lower == "windows security" {
            return None;
        }
    }
    
    // For .lnk files, we'd need to resolve the target, but for now just use the path
    let app_path = if path.extension().and_then(|s| s.to_str()) == Some("lnk") {
        // Try to resolve .lnk target (simplified - would need shell32 COM interface for full resolution)
        path.to_string_lossy().to_string()
    } else {
        path.to_string_lossy().to_string()
    };
    
    Some(AppInfo {
        name,
        path: app_path,
        icon: None, // Could extract icon from .lnk or .exe
        description: None,
    })
}
