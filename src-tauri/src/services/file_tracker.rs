// Recent files tracking service
// Monitors Windows Recent folder and tracks recently opened files

use crate::models::file::RecentFile;
use chrono::{DateTime, Utc};
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

pub struct FileTracker {
    recent_files: Arc<Mutex<HashMap<String, RecentFile>>>,
    recent_folder: PathBuf,
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

impl FileTracker {
    pub fn new() -> Result<Self, String> {
        #[cfg(windows)]
        {
            // Get Windows Recent folder path
            let recent_folder = Self::get_recent_folder()?;
            println!("Recent folder: {:?}", recent_folder);

            let tracker = Self {
                recent_files: Arc::new(Mutex::new(HashMap::new())),
                recent_folder: recent_folder.clone(),
                watcher: Arc::new(Mutex::new(None)),
            };

            // Initial scan
            if let Err(e) = tracker.scan_recent_folder() {
                eprintln!("Warning: Failed to scan recent folder initially: {}", e);
            }

            // Start watching for file system changes
            if let Err(e) = tracker.start_watching() {
                eprintln!("Warning: Failed to start file watcher: {}", e);
            }

            Ok(tracker)
        }

        #[cfg(not(windows))]
        {
            Ok(Self {
                recent_files: Arc::new(Mutex::new(HashMap::new())),
                recent_folder: PathBuf::new(),
                watcher: Arc::new(Mutex::new(None)),
            })
        }
    }

    #[cfg(windows)]
    fn get_recent_folder() -> Result<PathBuf, String> {
        use dirs;
        
        if let Some(appdata) = dirs::data_local_dir() {
            let recent = appdata.join("Microsoft").join("Windows").join("Recent");
            if recent.exists() {
                return Ok(recent);
            }
        }

        // Fallback: try environment variable
        if let Ok(appdata) = std::env::var("APPDATA") {
            let recent = PathBuf::from(appdata)
                .parent()
                .ok_or_else(|| "Invalid APPDATA path".to_string())?
                .join("Roaming")
                .join("Microsoft")
                .join("Windows")
                .join("Recent");
            if recent.exists() {
                return Ok(recent);
            }
        }

        Err("Could not find Windows Recent folder".to_string())
    }

    /// Scan the Recent folder and parse .lnk files
    pub fn scan_recent_folder(&self) -> Result<(), String> {
        #[cfg(windows)]
        {
            let mut files = HashMap::new();

            if !self.recent_folder.exists() {
                return Err("Recent folder does not exist".to_string());
            }

            match std::fs::read_dir(&self.recent_folder) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        
                        // Only process .lnk files
                        if path.extension().and_then(|s| s.to_str()) == Some("lnk") {
                            match Self::parse_lnk_file(&path) {
                                Ok(Some(recent_file)) => {
                                    let key = recent_file.path.clone();
                                    files.insert(key, recent_file);
                                }
                                Ok(None) => {
                                    // Skip files that couldn't be parsed
                                }
                                Err(e) => {
                                    eprintln!("Error parsing .lnk file {:?}: {}", path, e);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    return Err(format!("Failed to read Recent folder: {}", e));
                }
            }

            // Update cache
            {
                let mut cache = self.recent_files.lock().unwrap();
                cache.clear();
                cache.extend(files);
            }

            println!("Scanned {} recent files", self.recent_files.lock().unwrap().len());
            Ok(())
        }

        #[cfg(not(windows))]
        {
            Ok(())
        }
    }

    #[cfg(windows)]
    /// Parse a .lnk (Windows shortcut) file to extract target path
    /// For now, uses a simplified approach - extracts info from .lnk file metadata
    /// TODO: Implement full IShellLink parsing for accurate target paths
    fn parse_lnk_file(lnk_path: &Path) -> Result<Option<RecentFile>, String> {
        // Get .lnk file metadata
        let metadata = std::fs::metadata(lnk_path)
            .map_err(|e| format!("Failed to get .lnk file metadata: {}", e))?;

        // Get file name (without .lnk extension)
        let file_name = lnk_path
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        // Get last accessed time from .lnk file
        let last_accessed = metadata
            .accessed()
            .or_else(|_| metadata.modified())
            .ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| DateTime::<Utc>::from_timestamp(d.as_secs() as i64, 0))
            .flatten()
            .unwrap_or_else(|| Utc::now());

        // Try to extract target path from .lnk file name
        // Windows Recent folder stores .lnk files with the target file name
        // For now, we'll use the .lnk file name as a placeholder
        // In a full implementation, we'd parse the .lnk file using IShellLink
        let path = format!("C:\\{}", file_name); // Placeholder path

        // Try to determine actual file type from name
        let actual_file_type = if let Some(ext) = PathBuf::from(&file_name).extension() {
            ext.to_string_lossy().to_string()
        } else {
            "Unknown".to_string()
        };

        Ok(Some(RecentFile {
            name: file_name,
            path,
            last_accessed,
            file_type: actual_file_type,
        }))
    }

    #[cfg(not(windows))]
    fn parse_lnk_file(_lnk_path: &Path) -> Result<Option<RecentFile>, String> {
        Ok(None)
    }

    /// Get all recent files
    pub fn get_recent_files(&self) -> Vec<RecentFile> {
        let cache = self.recent_files.lock().unwrap();
        cache.values().cloned().collect()
    }

    /// Get recent files filtered by file type
    pub fn get_recent_files_by_type(&self, file_type: &str) -> Vec<RecentFile> {
        let cache = self.recent_files.lock().unwrap();
        cache
            .values()
            .filter(|f| f.file_type.eq_ignore_ascii_case(file_type))
            .cloned()
            .collect()
    }

    /// Get recent files sorted by last accessed time (most recent first)
    pub fn get_recent_files_sorted(&self) -> Vec<RecentFile> {
        let mut files = self.get_recent_files();
        files.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
        files
    }

    /// Get recent files by type, sorted
    pub fn get_recent_files_by_type_sorted(&self, file_type: &str) -> Vec<RecentFile> {
        let mut files = self.get_recent_files_by_type(file_type);
        files.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
        files
    }

    /// Refresh the cache by re-scanning the Recent folder
    pub fn refresh(&self) -> Result<(), String> {
        self.scan_recent_folder()
    }

    /// Start watching the Recent folder for changes
    pub fn start_watching(&self) -> Result<(), String> {
        let recent_files = Arc::clone(&self.recent_files);

        let mut watcher = notify::recommended_watcher(move |result: Result<Event, notify::Error>| {
            match result {
                Ok(event) => {
                    // Only process .lnk file changes
                    if let EventKind::Create(_) | EventKind::Modify(_) = event.kind {
                        for path in event.paths {
                            if path.extension().and_then(|s| s.to_str()) == Some("lnk") {
                                println!("Detected .lnk file change: {:?}", path);
                                
                                // Parse the new/updated .lnk file
                                if let Ok(Some(recent_file)) = Self::parse_lnk_file(&path) {
                                    let mut cache = recent_files.lock().unwrap();
                                    cache.insert(recent_file.path.clone(), recent_file);
                                    println!("Updated recent files cache");
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("File watcher error: {}", e);
                }
            }
        })
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        watcher
            .watch(&self.recent_folder, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch Recent folder: {}", e))?;

        {
            let mut w = self.watcher.lock().unwrap();
            *w = Some(watcher);
        }

        println!("Started watching Recent folder: {:?}", self.recent_folder);
        Ok(())
    }

    /// Stop watching the Recent folder
    pub fn stop_watching(&self) {
        let mut watcher = self.watcher.lock().unwrap();
        *watcher = None;
        println!("Stopped watching Recent folder");
    }
}

impl Default for FileTracker {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            recent_files: Arc::new(Mutex::new(HashMap::new())),
            recent_folder: PathBuf::new(),
            watcher: Arc::new(Mutex::new(None)),
        })
    }
}
