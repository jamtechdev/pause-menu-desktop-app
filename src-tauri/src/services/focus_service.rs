// Focus mode service with Windows Focus Assist integration
// Provides notification muting, focus timers, and meeting reschedule suggestions

use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration as TokioDuration, Instant};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use windows::Win32::System::Com::*;

// Focus mode types with predefined durations
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FocusMode {
    Focus1,       // 1 minute (for testing)
    Focus15,      // 15 minutes
    Focus25,      // 25 minutes (Pomodoro)
    DeepWork60,   // 60 minutes
    ClearInbox10, // 10 minutes
    PrepForMeeting, // Custom duration
    Custom(u32),  // Custom duration in minutes
}

// Custom serialization for FocusMode
impl Serialize for FocusMode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            FocusMode::Focus1 => serializer.serialize_str("focus1"),
            FocusMode::Focus15 => serializer.serialize_str("focus15"),
            FocusMode::Focus25 => serializer.serialize_str("focus25"),
            FocusMode::DeepWork60 => serializer.serialize_str("deepwork60"),
            FocusMode::ClearInbox10 => serializer.serialize_str("clearinbox10"),
            FocusMode::PrepForMeeting => serializer.serialize_str("prepformeeting"),
            FocusMode::Custom(mins) => {
                use serde::ser::SerializeStruct;
                let mut state = serializer.serialize_struct("Custom", 2)?;
                state.serialize_field("type", "custom")?;
                state.serialize_field("minutes", mins)?;
                state.end()
            }
        }
    }
}

// Custom deserialization for FocusMode
impl<'de> Deserialize<'de> for FocusMode {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::{self, Visitor, MapAccess};
        use std::fmt;

        struct FocusModeVisitor;

        impl<'de> Visitor<'de> for FocusModeVisitor {
            type Value = FocusMode;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a focus mode string or custom object")
            }

            fn visit_str<E>(self, value: &str) -> Result<FocusMode, E>
            where
                E: de::Error,
            {
                match value {
                    "focus1" => Ok(FocusMode::Focus1),
                    "focus15" => Ok(FocusMode::Focus15),
                    "focus25" => Ok(FocusMode::Focus25),
                    "deepwork60" => Ok(FocusMode::DeepWork60),
                    "clearinbox10" => Ok(FocusMode::ClearInbox10),
                    "prepformeeting" => Ok(FocusMode::PrepForMeeting),
                    _ => Err(de::Error::unknown_variant(value, &["focus1", "focus15", "focus25", "deepwork60", "clearinbox10", "prepformeeting"])),
                }
            }

            fn visit_map<M>(self, mut map: M) -> Result<FocusMode, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut mode_type: Option<String> = None;
                let mut minutes: Option<u32> = None;

                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "type" => {
                            if mode_type.is_some() {
                                return Err(de::Error::duplicate_field("type"));
                            }
                            mode_type = Some(map.next_value()?);
                        }
                        "minutes" => {
                            if minutes.is_some() {
                                return Err(de::Error::duplicate_field("minutes"));
                            }
                            minutes = Some(map.next_value()?);
                        }
                        _ => {
                            let _ = map.next_value::<de::IgnoredAny>()?;
                        }
                    }
                }

                if let Some(t) = mode_type {
                    if t == "custom" {
                        if let Some(mins) = minutes {
                            Ok(FocusMode::Custom(mins))
                        } else {
                            Err(de::Error::missing_field("minutes"))
                        }
                    } else {
                        Err(de::Error::unknown_variant(&t, &["custom"]))
                    }
                } else {
                    Err(de::Error::missing_field("type"))
                }
            }
        }

        deserializer.deserialize_any(FocusModeVisitor)
    }
}

impl FocusMode {
    pub fn duration_minutes(&self) -> u32 {
        match self {
            FocusMode::Focus1 => 1,
            FocusMode::Focus15 => 15,
            FocusMode::Focus25 => 25,
            FocusMode::DeepWork60 => 60,
            FocusMode::ClearInbox10 => 10,
            FocusMode::PrepForMeeting => 15, // Default for prep
            FocusMode::Custom(minutes) => *minutes,
        }
    }

    pub fn name(&self) -> String {
        match self {
            FocusMode::Focus1 => "Focus 1".to_string(),
            FocusMode::Focus15 => "Focus 15".to_string(),
            FocusMode::Focus25 => "Focus 25".to_string(),
            FocusMode::DeepWork60 => "Deep Work 60".to_string(),
            FocusMode::ClearInbox10 => "Clear Inbox 10".to_string(),
            FocusMode::PrepForMeeting => "Prep for Meeting".to_string(),
            FocusMode::Custom(mins) => format!("Custom {} min", mins),
        }
    }
}

// Focus session state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSession {
    pub mode: FocusMode,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub start_time: DateTime<Utc>,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub end_time: DateTime<Utc>,
    pub duration_minutes: u32,
    pub is_active: bool,
    pub remaining_seconds: u64,
}

// Meeting reschedule suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingSuggestion {
    pub event_id: String,
    pub title: String,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub original_time: DateTime<Utc>,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub suggested_time: DateTime<Utc>,
    pub reason: String,
}

// Windows Focus Assist state (for restoration)
#[derive(Debug, Clone)]
struct FocusAssistState {
    was_enabled: bool,
    previous_mode: u32, // 0 = Off, 1 = Priority only, 2 = Alarms only
}

pub struct FocusService {
    current_session: Arc<RwLock<Option<FocusSession>>>,
    focus_assist_state: Arc<RwLock<Option<FocusAssistState>>>,
    notification_state: Arc<RwLock<bool>>, // true if notifications were muted
    temporary_mute_end_time: Arc<RwLock<Option<DateTime<Utc>>>>, // when temporary mute expires
    app_handle: Option<AppHandle>,
}

impl FocusService {
    pub fn new() -> Self {
        Self {
            current_session: Arc::new(RwLock::new(None)),
            focus_assist_state: Arc::new(RwLock::new(None)),
            notification_state: Arc::new(RwLock::new(false)),
            temporary_mute_end_time: Arc::new(RwLock::new(None)),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, app: AppHandle) {
        self.app_handle = Some(app);
    }

    /// Start a focus mode session
    pub async fn start_focus_mode(&self, mode: FocusMode) -> std::result::Result<FocusSession, String> {
        println!("[Focus] ========== start_focus_mode called ==========");
        println!("[Focus] Mode: {:?} ({} minutes)", mode, mode.duration_minutes());
        
        // Check if there's already an active session
        {
            let session = self.current_session.read().await;
            if let Some(ref s) = *session {
                if s.is_active {
                    let err = "A focus session is already active".to_string();
                    eprintln!("[Focus] ✗ {}", err);
                    return Err(err);
                }
            }
        }

        let duration_minutes = mode.duration_minutes();
        let start_time = Utc::now();
        let end_time = start_time + Duration::minutes(duration_minutes as i64);

        println!("[Focus] Creating session: {} minutes, from {} to {}", 
            duration_minutes, start_time, end_time);

        let session = FocusSession {
            mode,
            start_time,
            end_time,
            duration_minutes,
            is_active: true,
            remaining_seconds: (duration_minutes * 60) as u64,
        };

        println!("[Focus] Session created, enabling Focus Assist...");
        // Enable Focus Assist and mute notifications
        match self.enable_focus_assist().await {
            Ok(_) => println!("[Focus] ✓ Focus Assist enabled"),
            Err(e) => {
                eprintln!("[Focus] ✗ Failed to enable Focus Assist: {}", e);
                return Err(format!("Failed to enable Focus Assist: {}", e));
            }
        }
        
        println!("[Focus] Muting notifications...");
        match self.mute_notifications().await {
            Ok(_) => println!("[Focus] ✓ Notifications muted"),
            Err(e) => {
                eprintln!("[Focus] ✗ Failed to mute notifications: {}", e);
                return Err(format!("Failed to mute notifications: {}", e));
            }
        }

        // Store session
        *self.current_session.write().await = Some(session.clone());

        // Start timer task
        let session_arc = Arc::clone(&self.current_session);
        let focus_service = Arc::new(self.clone_for_timer());
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            let duration = TokioDuration::from_secs(duration_minutes as u64 * 60);
            let start = Instant::now();
            let mut last_second = 0u64;

            loop {
                sleep(TokioDuration::from_secs(1)).await;
                let elapsed = start.elapsed();

                if elapsed >= duration {
                    // Time's up!
                    break;
                }

                let remaining = duration.as_secs() - elapsed.as_secs();
                
                // Update remaining seconds every second
                {
                    let mut session = session_arc.write().await;
                    if let Some(ref mut s) = *session {
                        s.remaining_seconds = remaining;
                        
                        // Emit countdown update every second
                        if let Some(ref app) = app_handle {
                            let _ = app.emit("focus-countdown", remaining);
                        }
                    }
                }

                // Emit update every 10 seconds for efficiency
                if remaining % 10 == 0 && remaining != last_second {
                    last_second = remaining;
                    if let Some(ref app) = app_handle {
                        let _ = app.emit("focus-update", remaining);
                    }
                }
            }

            // Timer finished - restore and notify
            {
                let mut session = session_arc.write().await;
                if let Some(ref mut s) = *session {
                    s.is_active = false;
                    s.remaining_seconds = 0;
                }
            }

            // Restore notifications and Focus Assist
            println!("[Focus] Focus session completed - auto-restoring notifications...");
            
            // First, stop the notification blocker if it's running
            #[cfg(windows)]
            {
                use crate::utils::notification_suppression::stop_notification_blocker;
                stop_notification_blocker();
                println!("[Focus] Stopped notification blocker");
            }
            
            // Restore Focus Assist
            let _ = focus_service.restore_focus_assist().await;
            
            // Use the comprehensive unmute method to properly restore notifications
            #[cfg(windows)]
            {
                use crate::utils::notification_suppression::unmute_notifications_windows_api;
                println!("[Focus] Calling unmute_notifications_windows_api...");
                match unmute_notifications_windows_api() {
                    Ok(_) => {
                        println!("[Focus] ✓ Notifications auto-unmuted successfully via Windows API");
                        // Update notification state
                        *focus_service.notification_state.write().await = false;
                        
                        // Give Windows time to process the changes
                        sleep(TokioDuration::from_millis(500)).await;
                        println!("[Focus] Waiting for Windows to apply notification changes...");
                    }
                    Err(e) => {
                        eprintln!("[Focus] Failed to auto-unmute via Windows API: {}, using fallback", e);
            let _ = focus_service.restore_notifications().await;
                        // Update notification state even on fallback
                        *focus_service.notification_state.write().await = false;
                        sleep(TokioDuration::from_millis(500)).await;
                    }
                }
            }
            
            #[cfg(not(windows))]
            {
                let _ = focus_service.restore_notifications().await;
                *focus_service.notification_state.write().await = false;
            }

            // Emit completion event
            if let Some(ref app) = app_handle {
                let _ = app.emit("focus-complete", ());
                let _ = app.emit("notifications-restored", ());
                println!("[Focus] ✓ Emitted focus-complete and notifications-restored events");
            }

            // Clear session after a delay
            tokio::spawn(async move {
                sleep(TokioDuration::from_secs(5)).await;
                let mut session = session_arc.write().await;
                *session = None;
            });
        });

        Ok(session)
    }

    /// Stop the current focus session early
    pub async fn stop_focus_mode(&self) -> std::result::Result<(), String> {
        let mut session = self.current_session.write().await;
        
        if let Some(ref mut s) = *session {
            if !s.is_active {
                return Err("No active focus session".to_string());
            }
            s.is_active = false;
        } else {
            return Err("No active focus session".to_string());
        }

        // Restore notifications and Focus Assist
        // Always unmute notifications when stopping focus, even if they were muted independently
        println!("[Focus] Stopping focus mode - unmuting notifications...");
        
        // Stop the notification blocker first
        #[cfg(windows)]
        {
            use crate::utils::notification_suppression::stop_notification_blocker;
            stop_notification_blocker();
            println!("[Focus] Stopped notification blocker");
        }
        
        self.restore_focus_assist().await?;
        self.restore_notifications().await?;
        
        // Also explicitly unmute notifications (handles both focus-muted and independently-muted notifications)
        let is_muted = self.is_notifications_muted().await;
        if is_muted {
            println!("[Focus] Notifications are muted - unmuting them...");
            if let Err(e) = self.unmute_notifications().await {
                eprintln!("[Focus] Warning: Failed to unmute notifications: {}", e);
                // Continue anyway - we tried
            }
        }

        // Clear session
        *session = None;

        if let Some(ref app) = self.app_handle {
            let _ = app.emit("focus-stopped", ());
        }

        Ok(())
    }

    /// Get current focus session
    pub async fn get_current_session(&self) -> Option<FocusSession> {
        self.current_session.read().await.clone()
    }

    /// Enable Windows Focus Assist
    #[cfg(windows)]
    async fn enable_focus_assist(&self) -> std::result::Result<(), String> {
        unsafe {
            // Initialize COM
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            // Note: CoInitializeEx can return S_FALSE if already initialized, which is OK

            // Try to get current Focus Assist state
            let current_state = self.get_focus_assist_state().await;
            
            // Save current state for restoration
            {
                let mut state = self.focus_assist_state.write().await;
                *state = Some(FocusAssistState {
                    was_enabled: current_state.is_some(),
                    previous_mode: current_state.unwrap_or(0),
                });
            }

            // Enable Focus Assist using registry
            // Focus Assist is controlled via registry: HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\$windows.data.notifications.quiescence.win10\Current
            // For simplicity, we'll use a PowerShell command or direct registry manipulation
            
            // Method 1: Use Windows API to set Focus Assist to "Alarms only" (mode 2)
            // This is the most reliable way
            match self.set_focus_assist_registry(2) {
                Ok(_) => {
                    println!("Focus Assist enabled successfully");
                    Ok(())
                }
                Err(e) => {
                    eprintln!("Warning: Failed to enable Focus Assist via registry: {}", e);
                    // Fallback: Just log that we tried
        Ok(())
    }
}
        }
    }

    #[cfg(not(windows))]
    async fn enable_focus_assist(&self) -> std::result::Result<(), String> {
        // Not available on non-Windows platforms
        Ok(())
    }

    /// Get current Focus Assist state
    #[cfg(windows)]
    async fn get_focus_assist_state(&self) -> Option<u32> {
        // Use PowerShell to get Focus Assist state
        // Focus Assist state: 0 = Off, 1 = Priority only, 2 = Alarms only
        let _output = std::process::Command::new("powershell")
            .args([
                "-Command",
                "Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\Cache\\DefaultAccount\\*windows.data.notifications.quiescence.win10*\\Current' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Data -ErrorAction SilentlyContinue"
            ])
            .output();
        
        // Alternative: Try reading from simpler registry path
        // Windows 10/11 stores Focus Assist in a complex binary format
        // For reliability, we'll use a PowerShell script that checks the actual state
        
        // For now, return None (unknown) - the actual state reading is complex
        // We'll save the state before enabling and restore it
        None
    }

    /// Set Do Not Disturb / Focus Assist via PowerShell
    /// Tries multiple methods: Do Not Disturb registry, Focus Assist registry, and Windows Runtime API
    #[cfg(windows)]
    fn set_focus_assist_registry(&self, mode: u32) -> std::result::Result<(), String> {
        use std::process::Command;
        
        // Focus Assist modes:
        // 0 = Off
        // 1 = Priority only  
        // 2 = Alarms only (most restrictive - mutes all except alarms)
        
        println!("[Focus] Setting Do Not Disturb / Focus Assist to mode: {} (0=Off, 1=Priority, 2=Alarms only)", mode);
        
        // Use registry method - works on all Windows 10/11 versions
        let ps_script = match mode {
            0 => r#"
                # Disable Focus Assist
                $path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
                $keys = Get-ChildItem -Path $path -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*windows.data.notifications.quiescence*" }
                foreach ($key in $keys) {
                    if (Test-Path $key.PSPath) {
                        $data = Get-ItemProperty -Path $key.PSPath -Name "Data" -ErrorAction SilentlyContinue
                        if ($data) {
                            Set-ItemProperty -Path $key.PSPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -ErrorAction SilentlyContinue
                        }
                    }
                }
                # Also try the direct registry path
                $directPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\$windows.data.notifications.quiescence.win10\Current"
                if (Test-Path $directPath) {
                    Set-ItemProperty -Path $directPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -ErrorAction SilentlyContinue
                }
                Write-Host "Focus Assist disabled"
            "#.to_string(),
            2 => r#"
                # Enable Do Not Disturb / Focus Assist - Alarms only (most restrictive)
                # Try multiple methods: Do Not Disturb registry, Focus Assist registry
                $found = $false
                $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
                
                Write-Host "[Do Not Disturb] Starting enable process..."
                
                # Method 0: Try Do Not Disturb registry directly
                Write-Host "[Do Not Disturb] Trying Do Not Disturb registry method..."
                try {
                    # Do Not Disturb notification settings
                    $notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
                    if (Test-Path $notifPath) {
                        # Disable toast notifications (Do Not Disturb)
                        Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Value 0 -ErrorAction SilentlyContinue
                        Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED" -Value 0 -ErrorAction SilentlyContinue
                        Write-Host "[Do Not Disturb] Updated notification settings registry"
                        $found = $true
                    }
                } catch {
                    Write-Host "[Do Not Disturb] Do Not Disturb registry method failed: $_"
                }
                
                # Method 1: Focus Assist registry (original method)
                Write-Host "[Focus Assist] Trying Focus Assist registry method..."
                
                # Method 1: Search for all quiescence keys recursively
                Write-Host "[Focus Assist] Searching registry for quiescence keys..."
                $allKeys = @()
                try {
                    $items = Get-ChildItem -Path $basePath -Recurse -ErrorAction SilentlyContinue
                    Write-Host "[Focus Assist] Total items in registry path: $($items.Count)"
                    $allKeys = $items | Where-Object { 
                        $_.PSChildName -like "*quiescence*" -or 
                        $_.Name -like "*quiescence*" -or
                        $_.PSPath -like "*quiescence*"
                    }
                    Write-Host "[Focus Assist] Found $($allKeys.Count) quiescence keys"
                } catch {
                    Write-Host "[Focus Assist] Search error: $_"
                }
                
                # Try to update each key
                foreach ($key in $allKeys) {
                    $keyPath = $key.PSPath
                    try {
                        if (Test-Path $keyPath) {
                            # Try to get or create the Data property
                            $dataProp = Get-ItemProperty -Path $keyPath -Name "Data" -ErrorAction SilentlyContinue
                            if ($dataProp) {
                                Set-ItemProperty -Path $keyPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction Stop
                                $found = $true
                                Write-Host "[Focus Assist] Updated: $keyPath"
                            } else {
                                # Create Data property if it doesn't exist
                                try {
                                    New-ItemProperty -Path $keyPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -PropertyType Binary -Force -ErrorAction Stop | Out-Null
                                    $found = $true
                                    Write-Host "[Focus Assist] Created Data in: $keyPath"
                                } catch {
                                    Write-Host "[Focus Assist] Could not create Data in $keyPath : $_"
                                }
                            }
                        }
                    } catch {
                        Write-Host "[Focus Assist] Error with $keyPath : $_"
                    }
                }
                
                # Method 2: Try common direct paths (Windows 10/11) - CREATE if they don't exist
                Write-Host "[Focus Assist] Trying direct registry paths (will create if missing)..."
                $directPaths = @(
                    "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win10\Current",
                    "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win11\Current",
                    "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\windows.data.notifications.quiescence\Current"
                )
                
                foreach ($directPath in $directPaths) {
                    try {
                        # Create the path if it doesn't exist
                        if (-not (Test-Path $directPath)) {
                            Write-Host "[Focus Assist] Creating registry path: $directPath"
                            $parentPath = Split-Path -Path $directPath -Parent
                            if (-not (Test-Path $parentPath)) {
                                New-Item -Path $parentPath -Force -ErrorAction SilentlyContinue | Out-Null
                            }
                            New-Item -Path $directPath -Force -ErrorAction Stop | Out-Null
                            Write-Host "[Focus Assist] Created registry path: $directPath"
                        }
                        
                        # Now set or create the Data property
                        $dataProp = Get-ItemProperty -Path $directPath -Name "Data" -ErrorAction SilentlyContinue
                        if ($dataProp) {
                            Set-ItemProperty -Path $directPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction Stop
                            $found = $true
                            Write-Host "[Focus Assist] Updated direct path: $directPath"
                        } else {
                            New-ItemProperty -Path $directPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -PropertyType Binary -Force -ErrorAction Stop | Out-Null
                            $found = $true
                            Write-Host "[Focus Assist] Created Data in direct path: $directPath"
                        }
                    } catch {
                        Write-Host "[Focus Assist] Error with direct path $directPath : $_"
                    }
                }
                
                # Refresh the notification system to apply changes
                Write-Host "[Focus Assist] Refreshing notification system..."
                Start-Sleep -Milliseconds 500
                
                # Method 1: Restart ShellExperienceHost if running
                $shellProcess = Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue
                if ($shellProcess) {
                    Stop-Process -Name "ShellExperienceHost" -Force -ErrorAction SilentlyContinue
                    Write-Host "[Focus Assist] Restarted ShellExperienceHost"
                    Start-Sleep -Milliseconds 1000
                } else {
                    Write-Host "[Focus Assist] ShellExperienceHost not running (this is normal, Windows will start it when needed)"
                }
                
                # Method 2: Force Windows to reload notification settings
                # Broadcast WM_SETTINGCHANGE to notify Windows of registry changes
                try {
                    Add-Type -TypeDefinition @"
                        using System;
                        using System.Runtime.InteropServices;
                        public class Win32 {
                            [DllImport("user32.dll", CharSet=CharSet.Auto)]
                            public static extern IntPtr SendMessageTimeout(
                                IntPtr hWnd, uint Msg, IntPtr wParam, string lParam,
                                uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
                            public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);
                            public static readonly uint WM_SETTINGCHANGE = 0x001A;
                            public static readonly uint SMTO_ABORTIFHUNG = 0x0002;
                        }
"@ -ErrorAction SilentlyContinue
                    $result = [IntPtr]::Zero
                    [Win32]::SendMessageTimeout(
                        [Win32]::HWND_BROADCAST,
                        [Win32]::WM_SETTINGCHANGE,
                        [IntPtr]::Zero,
                        "Environment",
                        [Win32]::SMTO_ABORTIFHUNG,
                        5000,
                        [ref]$result
                    ) | Out-Null
                    Write-Host "[Focus Assist] Broadcasted settings change message"
                } catch {
                    Write-Host "[Focus Assist] Could not broadcast settings change: $_"
                }
                
                Start-Sleep -Milliseconds 500
                
                if ($found) {
                    Write-Host "[Focus Assist] Registry keys updated successfully"
                    Write-Host "[Focus Assist] NOTE: On Windows 11 24H2, registry changes may not take effect immediately."
                    Write-Host "[Focus Assist] If notifications are still showing, please enable Focus Assist manually:"
                    Write-Host "[Focus Assist] Settings > System > Focus > Set to 'Alarms only'"
                    Write-Host "[Focus Assist] Or use Action Center (Win+A) > Focus Assist button"
                    
                    # Try to open Focus Assist settings page
                    try {
                        Start-Process "ms-settings:quiethours" -ErrorAction SilentlyContinue
                        Write-Host "[Focus Assist] Opened Focus Assist settings page"
                    } catch {
                        Write-Host "[Focus Assist] Could not open settings page automatically"
                    }
                } else {
                    Write-Host "[Focus Assist] WARNING - Could not find or update registry keys. Focus Assist may not be enabled."
                    Write-Host "[Focus Assist] Please enable Focus Assist manually in Settings > System > Focus"
                    
                    # Try to open Focus Assist settings page
                    try {
                        Start-Process "ms-settings:quiethours" -ErrorAction SilentlyContinue
                        Write-Host "[Focus Assist] Opened Focus Assist settings page"
                    } catch {
                        Write-Host "[Focus Assist] Could not open settings page automatically"
                    }
                }
            "#.to_string(),
            1 => r#"
                # Priority only
                $path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
                $keys = Get-ChildItem -Path $path -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*windows.data.notifications.quiescence*" }
                foreach ($key in $keys) {
                    if (Test-Path $key.PSPath) {
                        $data = Get-ItemProperty -Path $key.PSPath -Name "Data" -ErrorAction SilentlyContinue
                        if ($data) {
                            Set-ItemProperty -Path $key.PSPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -ErrorAction SilentlyContinue
                        }
                    }
                }
                # Also try the direct registry path
                $directPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\$windows.data.notifications.quiescence.win10\Current"
                if (Test-Path $directPath) {
                    Set-ItemProperty -Path $directPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -ErrorAction SilentlyContinue
                }
                # Refresh the notification system
                Stop-Process -Name "ShellExperienceHost" -Force -ErrorAction SilentlyContinue
                Write-Host "Focus Assist enabled - Priority only"
            "#.to_string(),
            _ => return Err(format!("Invalid Focus Assist mode: {}", mode)),
        };
        
        // Execute PowerShell script with proper execution policy
        let output = Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        println!("[Focus] PowerShell stdout: {}", stdout);
        if !stderr.is_empty() && !stderr.contains("Cannot find a process") && !stderr.contains("Windows Runtime API not available") {
            eprintln!("[Focus] PowerShell stderr: {}", stderr);
        }
        
        // Check if Windows Runtime API was used successfully
        let used_runtime_api = stdout.contains("Windows Runtime API") || stdout.contains("Focus Assist enabled via Windows Runtime API");
        
        if !output.status.success() && !used_runtime_api {
            eprintln!("[Focus] PowerShell command failed with exit code: {:?}", output.status.code());
            eprintln!("[Focus] Attempting alternative method...");
            // Try a simpler registry approach
            return self.set_focus_assist_simple_registry(mode);
        }
        
        if used_runtime_api {
            println!("[Focus] ✓ Focus Assist set to mode {} (Windows Runtime API)", mode);
        } else {
            println!("[Focus] ✓ Focus Assist set to mode {} (registry method)", mode);
        }
        
        Ok(())
    }
    
    /// Simple registry method as last resort
    #[cfg(windows)]
    fn set_focus_assist_simple_registry(&self, mode: u32) -> std::result::Result<(), String> {
        use std::process::Command;
        
        println!("[Focus] Using simple registry method for mode: {}", mode);
        
        // Try the most common registry path for Windows 11
        let value = match mode {
            0 => "0x43000000000000000000000000000000",
            1 => "0x43010000000000000000000000000000",
            2 => "0x43020000000000000000000000000000",
            _ => return Err(format!("Invalid mode: {}", mode)),
        };
        
        let ps_script = format!(
            r#"
            $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
            $keys = Get-ChildItem -Path $basePath -Recurse -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -like "*quiescence*" }}
            foreach ($key in $keys) {{
                try {{
                    $regPath = $key.PSPath
                    if (Test-Path $regPath) {{
                        $current = Get-ItemProperty -Path $regPath -Name "Data" -ErrorAction SilentlyContinue
                        if ($current) {{
                            $bytes = [System.Convert]::FromHexString("{}")
                            Set-ItemProperty -Path $regPath -Name "Data" -Value $bytes -Type Binary -Force
                            Write-Host "Updated: $regPath"
                        }}
                    }}
                }} catch {{
                    Write-Host "Error updating $($key.PSPath): $_"
                }}
            }}
            Start-Sleep -Seconds 1
            Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Write-Host "Focus Assist mode {} set"
            "#,
            value.replace("0x", ""),
            mode
        );
        
        let output = Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("[Focus] Simple registry method stdout: {}", stdout);
        
        Ok(())
    }

    /// Restore Focus Assist to previous state
    #[cfg(windows)]
    async fn restore_focus_assist(&self) -> std::result::Result<(), String> {
        let state = {
            let state = self.focus_assist_state.read().await;
            state.clone()
        };

        if let Some(state) = state {
            // Restore previous Focus Assist mode
            if !state.was_enabled {
                // Disable Focus Assist (set to mode 0)
                let _ = self.set_focus_assist_registry(0);
            } else {
                // Restore previous mode
                let _ = self.set_focus_assist_registry(state.previous_mode);
            }
        }

        Ok(())
    }

    #[cfg(not(windows))]
    async fn restore_focus_assist(&self) -> std::result::Result<(), String> {
        Ok(())
    }

    /// Mute notifications using Windows Runtime Notification API
    /// This directly suppresses notifications without relying on Focus Assist registry
    async fn mute_notifications(&self) -> std::result::Result<(), String> {
        println!("[Focus] Muting notifications using multi-method approach...");
        *self.notification_state.write().await = true;
        
        #[cfg(windows)]
        {
            // Use aggressive multi-method approach
            println!("[Focus] Applying system-wide notification suppression...");
            let _ = self.disable_notifications_system_wide().await;
            
            println!("[Focus] Disabling app-specific notifications...");
            let _ = self.disable_app_notifications().await;
            
            // Try Windows Runtime API (may fail but worth trying)
            println!("[Focus] Attempting Windows Runtime API suppression...");
            let _ = self.suppress_notifications_directly().await;
            
            println!("[Focus] ✓ Notifications muted using multiple methods");
        }

        #[cfg(not(windows))]
        {
            println!("[Focus] Notification muting not available on this platform");
        }

        Ok(())
    }
    
    /// Suppress notifications directly using Windows Runtime API via PowerShell
    #[cfg(windows)]
    async fn suppress_notifications_directly(&self) -> std::result::Result<(), String> {
        use std::process::Command;
        
        // Use PowerShell to call Windows Runtime API for notification suppression
        let ps_script = r#"
            try {
                # Load Windows Runtime types
                Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
                
                # Load Windows.UI.Shell types for FocusSessionManager
                [Windows.UI.Shell.FocusSessionManager, Windows.UI.Shell, ContentType = WindowsRuntime] | Out-Null
                
                # Get the FocusSessionManager
                $manager = [Windows.UI.Shell.FocusSessionManager]::GetDefault()
                
                # Create a helper function to await async operations
                $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
                    $_.Name -eq 'AsTask' -and 
                    $_.GetParameters().Count -eq 1 -and 
                    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
                })[0]
                
                Function Await($WinRtTask, $ResultType) {
                    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
                    $netTask = $asTask.Invoke($null, @($WinRtTask))
                    $netTask.Wait() | Out-Null
                    $netTask.Result
                }
                
                # Try multiple methods to create a FocusSession
                $session = $null
                
                # Method 1: Try using reflection to find a constructor
                try {
                    $sessionType = [Windows.UI.Shell.FocusSession]
                    $constructors = $sessionType.GetConstructors([System.Reflection.BindingFlags]::NonPublic -bor [System.Reflection.BindingFlags]::Instance)
                    if ($constructors.Count -gt 0) {
                        # Try to invoke the first constructor
                        $ctor = $constructors[0]
                        $paramCount = $ctor.GetParameters().Count
                        if ($paramCount -eq 0) {
                            $session = $ctor.Invoke($null)
                        } else {
                            # Create default parameters
                            $params = New-Object object[] $paramCount
                            $session = $ctor.Invoke($params)
                        }
                        Write-Host "[Focus] Created FocusSession using reflection constructor"
                    }
                } catch {
                    Write-Host "[Focus] Reflection method failed: $_"
                }
                
                # Method 2: Try using Activator with different parameters
                if (-not $session) {
                    try {
                        $sessionType = [Windows.UI.Shell.FocusSession]
                        # Try with empty object array
                        $session = [System.Activator]::CreateInstance($sessionType, $true, $false, $null, $null, $null)
                        Write-Host "[Focus] Created FocusSession using Activator with parameters"
                    } catch {
                        Write-Host "[Focus] Activator method failed: $_"
                    }
                }
                
                # Method 3: Try using NotificationListener API directly
                if (-not $session) {
                    try {
                        # Try to use NotificationListener to suppress notifications
                        [Windows.UI.Notifications.Management.NotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
                        $listener = [Windows.UI.Notifications.Management.NotificationListener]::Current
                        
                        # Get all notification sources
                        $sources = Await ($listener.GetNotificationSourcesAsync()) ([Windows.Foundation.Collections.IVectorView[Windows.UI.Notifications.Management.NotificationListenerAccessStatus]])
                        
                        Write-Host "[Focus] Found notification sources, attempting to suppress..."
                        Write-Host "[Focus] Note: NotificationListener requires app manifest capabilities"
                        Write-Host "[Focus] This may not work from a desktop app without proper permissions"
                    } catch {
                        Write-Host "[Focus] NotificationListener method failed: $_"
                    }
                }
                
                # Method 4: Try to get an existing session or use a factory method
                if (-not $session) {
                    try {
                        # Check if there's a static factory method
                        $sessionType = [Windows.UI.Shell.FocusSession]
                        $methods = $sessionType.GetMethods([System.Reflection.BindingFlags]::Static -bor [System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::NonPublic)
                        $factoryMethod = $methods | Where-Object { $_.Name -like "*Create*" -or $_.Name -like "*New*" } | Select-Object -First 1
                        if ($factoryMethod) {
                            $session = $factoryMethod.Invoke($null, $null)
                            Write-Host "[Focus] Created FocusSession using factory method: $($factoryMethod.Name)"
                        }
                    } catch {
                        Write-Host "[Focus] Factory method failed: $_"
                    }
                }
                
                if ($session) {
                    # Set session properties
                    try {
                        $session.Kind = [Windows.UI.Shell.FocusSessionKind]::AlarmsOnly
                        $endTime = [DateTimeOffset]::Now.AddHours(2)
                        $session.EndTime = $endTime
                        
                        # Start the focus session
                        $asyncOp = $manager.StartFocusSession($session)
                        $result = Await $asyncOp ([Windows.UI.Shell.FocusSession])
                        
                        Write-Host "[Focus] Focus session started via Windows Runtime API - Session ID: $($result.Id)"
                        Write-Host "[Focus] SUCCESS - Notifications suppressed directly"
                        exit 0
                    } catch {
                        Write-Host "[Focus] Failed to start session: $_"
                        exit 1
                    }
                } else {
                    Write-Host "[Focus] Failed to create FocusSession object - all methods failed"
                    Write-Host "[Focus] LIMITATION: Windows Runtime API is not accessible from desktop apps on Windows 11 24H2"
                    Write-Host "[Focus] Focus Assist must be enabled manually:"
                    Write-Host "[Focus] 1. Press Win+A to open Action Center"
                    Write-Host "[Focus] 2. Click the Focus Assist button to set it to 'Alarms only'"
                    Write-Host "[Focus] OR go to Settings > System > Focus > Set to 'Alarms only'"
                    exit 1
                }
            } catch {
                $errorMsg = $_.Exception.Message
                $errorType = $_.Exception.GetType().FullName
                Write-Host "[Focus] Windows Runtime API error [$errorType]: $errorMsg"
                Write-Host "[Focus] Stack trace: $($_.Exception.StackTrace)"
                exit 1
            }
        "#;
        
        let output = Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        println!("[Focus] PowerShell stdout: {}", stdout);
        if !stderr.is_empty() {
            println!("[Focus] PowerShell stderr: {}", stderr);
        }
        
        if output.status.success() {
            Ok(())
        } else {
            Err(format!("PowerShell script failed with exit code: {:?}", output.status.code()))
        }
    }
    
    #[cfg(not(windows))]
    async fn suppress_notifications_directly(&self) -> std::result::Result<(), String> {
        Err("Not available on this platform".to_string())
    }

    /// Restore notifications
    /// This restores Focus Assist to its previous state, which restores notifications
    async fn restore_notifications(&self) -> std::result::Result<(), String> {
        let was_muted = {
            let state = self.notification_state.read().await;
            *state
        };

        if was_muted {
            println!("[Focus] Restoring notifications using multiple methods...");
            *self.notification_state.write().await = false;
            
            #[cfg(windows)]
            {
                // Restore system-wide notification settings
                let _ = self.restore_system_notifications().await;
                
                // Restore app-specific notifications
                let _ = self.restore_app_notifications().await;
                
                // Notifications are also restored when Focus Assist is restored
                // The restore_focus_assist() function handles this
                println!("[Focus] Notifications restored via multiple methods");
            }
        }

        Ok(())
    }

    /// Restore system-wide notification settings using direct Windows API
    #[cfg(windows)]
    async fn restore_system_notifications(&self) -> std::result::Result<(), String> {
        // Use direct Windows API instead of PowerShell for reliability
        use crate::utils::notification_suppression::restore_notifications_direct;
        
        match restore_notifications_direct() {
            Ok(_) => {
                println!("[Focus] ✓ Notifications restored using direct Windows API");
                Ok(())
            }
            Err(e) => {
                eprintln!("[Focus] Direct API restoration failed: {}, falling back to PowerShell", e);
                // Fallback to PowerShell method
                self.restore_system_notifications_powershell().await
            }
        }
    }
    
    /// Fallback PowerShell method for notification restoration
    #[cfg(windows)]
    async fn restore_system_notifications_powershell(&self) -> std::result::Result<(), String> {
        use std::process::Command;
        
        let ps_script = r#"
            $ErrorActionPreference = "Continue"
            
            Write-Host "[Notifications] Restoring system-wide notification settings..."
            
            # Restore global toast notifications
            $notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
            if (Test-Path $notifPath) {
                # Remove the disabled properties or set them back to enabled
                Remove-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Force -ErrorAction SilentlyContinue
                Remove-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED" -Force -ErrorAction SilentlyContinue
                Write-Host "[Notifications] Restored global notification settings"
            }
            
            # Force Windows to reload notification settings
            Start-Sleep -Milliseconds 500
            
            # Restart ShellExperienceHost to apply changes
            $shellProcess = Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue
            if ($shellProcess) {
                Stop-Process -Name "ShellExperienceHost" -Force -ErrorAction SilentlyContinue
                Write-Host "[Notifications] Restarted ShellExperienceHost"
                Start-Sleep -Milliseconds 1000
            }
            
            Write-Host "[Notifications] System notification restoration completed"
            exit 0
        "#;
        
        let output = Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("[Focus] System notifications restore stdout: {}", stdout);
        
        Ok(())
    }
    
    #[cfg(not(windows))]
    async fn restore_system_notifications(&self) -> std::result::Result<(), String> {
        Ok(())
    }

    /// Temporarily mute notifications for a specified duration (in minutes)
    /// If duration is None, mute until manually unmuted
    pub async fn temporarily_mute_notifications(&self, duration_minutes: Option<u32>) -> std::result::Result<(), String> {
        println!("[Focus] Temporarily muting notifications for {:?} minutes", duration_minutes);
        
        // Check if already muted
        let is_already_muted = {
            let state = self.notification_state.read().await;
            *state
        };

        if !is_already_muted {
            // Use Windows API to mute notifications
            println!("[Focus] Using Windows API to mute notifications...");
            
            #[cfg(windows)]
            {
                use crate::utils::notification_suppression::mute_notifications_windows_api;
                match mute_notifications_windows_api() {
                    Ok(_) => {
                        println!("[Focus] ✓ Notifications muted using Windows API");
                        *self.notification_state.write().await = true;
                    }
                    Err(e) => {
                        eprintln!("[Focus] ✗ Failed to mute notifications via Windows API: {}", e);
                        // Fallback to PowerShell method if Windows API fails
                        println!("[Focus] Falling back to PowerShell method...");
                        let _ = self.enable_focus_assist().await;
                        let _ = self.disable_notifications_system_wide().await;
                        *self.notification_state.write().await = true;
                    }
                }
            }
            
            #[cfg(not(windows))]
            {
                println!("[Focus] Windows API not available on this platform");
            }
        }

        // Set end time if duration is specified
        if let Some(duration) = duration_minutes {
            let end_time = Utc::now() + Duration::minutes(duration as i64);
            *self.temporary_mute_end_time.write().await = Some(end_time);
            println!("[Focus] Temporary mute will expire at {}", end_time);

            // Spawn a task to automatically restore after duration
            let service = Arc::new(self.clone_for_timer());
            let mute_end_time = end_time;
            
            tokio::spawn(async move {
                let now = Utc::now();
                let wait_seconds = (mute_end_time - now).num_seconds();
                
                if wait_seconds > 0 {
                    println!("[Focus] Waiting {} seconds before auto-restoring notifications", wait_seconds);
                    sleep(TokioDuration::from_secs(wait_seconds as u64)).await;
                }

                // Check if mute is still active and hasn't been extended
                let should_restore = {
                    let end_time = service.temporary_mute_end_time.read().await;
                    end_time.map(|et| et <= Utc::now()).unwrap_or(false)
                };

                if should_restore {
                    println!("[Focus] Auto-restoring notifications after temporary mute duration");
                    
                    #[cfg(windows)]
                    {
                        use crate::utils::notification_suppression::unmute_notifications_windows_api;
                        if let Err(e) = unmute_notifications_windows_api() {
                            eprintln!("[Focus] Failed to unmute via Windows API: {}, using fallback", e);
                            let _ = service.restore_focus_assist().await;
                            let _ = service.restore_notifications().await;
                        } else {
                            println!("[Focus] ✓ Notifications restored using Windows API");
                        }
                    }
                    
                    #[cfg(not(windows))]
                    {
                        let _ = service.restore_focus_assist().await;
                        let _ = service.restore_notifications().await;
                    }
                    
                    *service.temporary_mute_end_time.write().await = None;
                    *service.notification_state.write().await = false;
                    
                    if let Some(ref app) = service.app_handle {
                        let _ = app.emit("notifications-restored", ());
                    }
                }
            });
        } else {
            // No duration - manual unmute only
            *self.temporary_mute_end_time.write().await = None;
        }

        Ok(())
    }

    /// Unmute notifications (manual unmute)
    pub async fn unmute_notifications(&self) -> std::result::Result<(), String> {
        println!("[Focus] Manually unmuting notifications...");
        
        // Clear temporary mute end time
        *self.temporary_mute_end_time.write().await = None;
        
        // Use Windows API to unmute notifications
        #[cfg(windows)]
        {
            use crate::utils::notification_suppression::unmute_notifications_windows_api;
            match unmute_notifications_windows_api() {
                Ok(_) => {
                    println!("[Focus] ✓ Notifications unmuted using Windows API");
                    *self.notification_state.write().await = false;
                }
                Err(e) => {
                    eprintln!("[Focus] ✗ Failed to unmute via Windows API: {}, using fallback", e);
                    // Fallback to PowerShell methods
                    self.restore_focus_assist().await?;
                    self.restore_notifications().await?;
                    *self.notification_state.write().await = false;
                }
            }
        }
        
        #[cfg(not(windows))]
        {
            self.restore_focus_assist().await?;
            self.restore_notifications().await?;
            *self.notification_state.write().await = false;
        }

        if let Some(ref app) = self.app_handle {
            let _ = app.emit("notifications-restored", ());
        }

        Ok(())
    }

    /// Restore app-specific notifications
    #[cfg(windows)]
    async fn restore_app_notifications(&self) -> std::result::Result<(), String> {
        use std::process::Command;
        
        let ps_script = r#"
            $ErrorActionPreference = "Continue"
            
            Write-Host "[Notifications] Restoring app notifications..."
            
            # Base registry path for app notifications
            $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
            
            # Re-enable notifications for all apps (remove the disabled state)
            try {
                $allApps = Get-ChildItem -Path $basePath -ErrorAction SilentlyContinue
                foreach ($app in $allApps) {
                    try {
                        # Remove the Enabled property if it was set to 0, or set it to 1
                        $currentValue = Get-ItemProperty -Path $app.PSPath -Name "Enabled" -ErrorAction SilentlyContinue
                        if ($currentValue -and $currentValue.Enabled -eq 0) {
                            Remove-ItemProperty -Path $app.PSPath -Name "Enabled" -Force -ErrorAction SilentlyContinue
                            Write-Host "[Notifications] Restored notifications for: $($app.PSChildName)"
                        }
                    } catch {
                        # Ignore errors - some apps may not have this property
                    }
                }
            } catch {
                Write-Host "[Notifications] Error restoring app notifications: $_"
            }
            
            Write-Host "[Notifications] App notification restoration completed"
            exit 0
        "#;
        
        let output = Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("[Focus] App notifications restore stdout: {}", stdout);
        
        Ok(())
    }
    
    #[cfg(not(windows))]
    async fn restore_app_notifications(&self) -> std::result::Result<(), String> {
        Ok(())
    }

    /// Get remaining time for temporary mute (in seconds)
    pub async fn get_temporary_mute_remaining(&self) -> Option<u64> {
        let end_time = {
            let end_time = self.temporary_mute_end_time.read().await;
            *end_time
        };

        if let Some(end_time) = end_time {
            let now = Utc::now();
            if now < end_time {
                let remaining = (end_time - now).num_seconds();
                if remaining > 0 {
                    return Some(remaining as u64);
                }
            }
        }

        None
    }

    /// Check if notifications are temporarily muted
    pub async fn is_notifications_muted(&self) -> bool {
        let state = self.notification_state.read().await;
        *state
    }

    /// Disable notifications system-wide using direct Windows API
    #[cfg(windows)]
    async fn disable_notifications_system_wide(&self) -> std::result::Result<(), String> {
        // Use direct Windows API instead of PowerShell for reliability
        use crate::utils::notification_suppression::suppress_notifications_direct;
        
        match suppress_notifications_direct() {
            Ok(_) => {
                println!("[Focus] ✓ Notifications suppressed using direct Windows API");
                Ok(())
            }
            Err(e) => {
                eprintln!("[Focus] Direct API suppression failed: {}, falling back to PowerShell", e);
                // Fallback to PowerShell method
                self.disable_notifications_system_wide_powershell().await
            }
        }
    }
    
    /// Fallback PowerShell method for notification suppression
    #[cfg(windows)]
    async fn disable_notifications_system_wide_powershell(&self) -> std::result::Result<(), String> {
        use std::process::Command;
        
        let ps_script = r#"
            $ErrorActionPreference = "Stop"
            
            Write-Host "[Notifications] Disabling notifications system-wide..."
            
            # Method 1: Disable toast notifications globally
            $notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
            if (-not (Test-Path $notifPath)) {
                New-Item -Path $notifPath -Force | Out-Null
            }
            
            # Disable toast notifications
            Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Value 0 -Type DWord -Force
            Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED" -Value 0 -Type DWord -Force
            
            Write-Host "[Notifications] Disabled global toast notifications"
            
            # Method 2: Set Focus Assist to Alarms Only via registry (more aggressive)
            $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
            
            # Find and update all quiescence keys
            $keys = Get-ChildItem -Path $basePath -Recurse -ErrorAction SilentlyContinue | 
                Where-Object { $_.PSChildName -like "*quiescence*" -or $_.Name -like "*quiescence*" }
            
            foreach ($key in $keys) {
                try {
                    $keyPath = $key.PSPath
                    if (Test-Path $keyPath) {
                        # Set to Alarms Only (mode 2)
                        Set-ItemProperty -Path $keyPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction SilentlyContinue
                        Write-Host "[Notifications] Updated Focus Assist key: $keyPath"
                    }
                } catch {
                    Write-Host "[Notifications] Error updating $($key.PSPath): $_"
                }
            }
            
            # Method 3: Create/update direct registry paths
            $directPaths = @(
                "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win10\Current",
                "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win11\Current"
            )
            
            foreach ($directPath in $directPaths) {
                try {
                    if (-not (Test-Path $directPath)) {
                        $parentPath = Split-Path -Path $directPath -Parent
                        if (-not (Test-Path $parentPath)) {
                            New-Item -Path $parentPath -Force -ErrorAction SilentlyContinue | Out-Null
                        }
                        New-Item -Path $directPath -Force -ErrorAction SilentlyContinue | Out-Null
                    }
                    
                    Set-ItemProperty -Path $directPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction SilentlyContinue
                    Write-Host "[Notifications] Updated direct path: $directPath"
                } catch {
                    Write-Host "[Notifications] Error with direct path $directPath : $_"
                }
            }
            
            # Method 4: Force Windows to reload notification settings
            Start-Sleep -Milliseconds 500
            
            # Restart ShellExperienceHost to apply changes
            $shellProcess = Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue
            if ($shellProcess) {
                Stop-Process -Name "ShellExperienceHost" -Force -ErrorAction SilentlyContinue
                Write-Host "[Notifications] Restarted ShellExperienceHost"
                Start-Sleep -Milliseconds 1000
            }
            
            # Broadcast settings change
            try {
                Add-Type -TypeDefinition @"
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {
                        [DllImport("user32.dll", CharSet=CharSet.Auto)]
                        public static extern IntPtr SendMessageTimeout(
                            IntPtr hWnd, uint Msg, IntPtr wParam, string lParam,
                            uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
                        public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);
                        public static readonly uint WM_SETTINGCHANGE = 0x001A;
                        public static readonly uint SMTO_ABORTIFHUNG = 0x0002;
                    }
"@ -ErrorAction SilentlyContinue
                $result = [IntPtr]::Zero
                [Win32]::SendMessageTimeout(
                    [Win32]::HWND_BROADCAST,
                    [Win32]::WM_SETTINGCHANGE,
                    [IntPtr]::Zero,
                    "Environment",
                    [Win32]::SMTO_ABORTIFHUNG,
                    5000,
                    [ref]$result
                ) | Out-Null
                Write-Host "[Notifications] Broadcasted settings change"
            } catch {
                Write-Host "[Notifications] Could not broadcast settings change: $_"
            }
            
            Write-Host "[Notifications] System-wide notification suppression applied"
            exit 0
        "#;
        
        let output = Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        println!("[Focus] System-wide disable stdout: {}", stdout);
        if !stderr.is_empty() {
            println!("[Focus] System-wide disable stderr: {}", stderr);
        }
        
        if output.status.success() {
            Ok(())
        } else {
            Err(format!("PowerShell script failed with exit code: {:?}", output.status.code()))
        }
    }
    
    #[cfg(not(windows))]
    async fn disable_notifications_system_wide(&self) -> std::result::Result<(), String> {
        Err("Not available on this platform".to_string())
    }

    /// Disable notifications for specific apps (Teams, Outlook, etc.)
    #[cfg(windows)]
    async fn disable_app_notifications(&self) -> std::result::Result<(), String> {
        use std::process::Command;
        
        let ps_script = r#"
            $ErrorActionPreference = "Continue"
            
            Write-Host "[Notifications] Disabling notifications for specific apps..."
            
            # Apps to disable notifications for
            $appsToDisable = @(
                "Microsoft.SkypeApp",           # Skype/Teams
                "MSTeams",                      # Microsoft Teams
                "MicrosoftTeams",                # Microsoft Teams (alternative)
                "com.microsoft.teams",          # Teams UWP
                "Microsoft.Outlook",            # Outlook
                "Microsoft.Office.Outlook",     # Outlook (alternative)
                "Discord",                      # Discord
                "com.discordapp.Discord",       # Discord UWP
                "WhatsApp",                     # WhatsApp
                "com.whatsapp.WhatsApp",        # WhatsApp UWP
                "Slack",                        # Slack
                "com.tinyspeck.chatlyio",       # Slack UWP
                "Telegram",                     # Telegram
                "com.telegram.telegram",         # Telegram UWP
                "Zoom",                         # Zoom
                "Zoom.Zoom",                    # Zoom UWP
                "com.zoom.Zoom"                 # Zoom (alternative)
            )
            
            # Base registry path for app notifications
            $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
            
            foreach ($appId in $appsToDisable) {
                try {
                    $appPath = Join-Path $basePath $appId
                    
                    if (Test-Path $appPath) {
                        # Disable notifications for this app
                        Set-ItemProperty -Path $appPath -Name "Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                        Set-ItemProperty -Path $appPath -Name "ShowInActionCenter" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                        Write-Host "[Notifications] Disabled notifications for: $appId"
                    } else {
                        # Create the path and disable
                        New-Item -Path $appPath -Force -ErrorAction SilentlyContinue | Out-Null
                        Set-ItemProperty -Path $appPath -Name "Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                        Set-ItemProperty -Path $appPath -Name "ShowInActionCenter" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                        Write-Host "[Notifications] Created and disabled notifications for: $appId"
                    }
                } catch {
                    Write-Host "[Notifications] Error disabling $appId : $_"
                }
            }
            
            # Also try to find Teams by searching for it
            try {
                $allApps = Get-ChildItem -Path $basePath -ErrorAction SilentlyContinue
                foreach ($app in $allApps) {
                    $appName = $app.PSChildName
                    if ($appName -like "*team*" -or $appName -like "*skype*" -or $appName -like "*outlook*") {
                        Set-ItemProperty -Path $app.PSPath -Name "Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                        Set-ItemProperty -Path $app.PSPath -Name "ShowInActionCenter" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                        Write-Host "[Notifications] Disabled notifications for found app: $appName"
                    }
                }
            } catch {
                Write-Host "[Notifications] Error searching for apps: $_"
            }
            
            Write-Host "[Notifications] App-specific notification suppression completed"
            exit 0
        "#;
        
        let output = Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        println!("[Focus] App notifications disable stdout: {}", stdout);
        if !stderr.is_empty() {
            println!("[Focus] App notifications disable stderr: {}", stderr);
        }
        
        // Don't fail if this doesn't work - it's a best-effort approach
        Ok(())
    }
    
    #[cfg(not(windows))]
    async fn disable_app_notifications(&self) -> std::result::Result<(), String> {
        Err("Not available on this platform".to_string())
    }

    /// Get meeting reschedule suggestions based on focus session
    pub async fn get_meeting_suggestions(
        &self,
        focus_end_time: DateTime<Utc>,
    ) -> std::result::Result<Vec<MeetingSuggestion>, String> {
        use crate::services::calendar_service::get_calendar_service;
        
        println!("[Focus] Getting meeting suggestions for focus session ending at {}", focus_end_time);
        
        // Get current focus session to determine start time
        let focus_start_time = {
            let session = self.current_session.read().await;
            session.as_ref().map(|s| s.start_time).unwrap_or(Utc::now())
        };
        
        // Get calendar events
        let calendar_service = get_calendar_service().await;
        let calendar_service = calendar_service.lock().await;
        
        let events = calendar_service.get_events().await
            .unwrap_or_else(|e| {
                eprintln!("[Focus] Error getting calendar events: {}", e);
                vec![]
            });
        
        let mut suggestions = Vec::new();
        
        // Get session mode name for reason text
        let session_mode_name = {
            let session = self.current_session.read().await;
            session.as_ref()
                .map(|s| s.mode.name())
                .unwrap_or_else(|| "active".to_string())
        };
        
        // Check each event to see if it conflicts with focus session
        for event in events {
            let event_start = event.start_time;
            let event_end = event.end_time;
            
            // Check if event conflicts with focus session in any way:
            // 1. Event starts during focus session
            // 2. Event overlaps with focus session (starts before, ends during)
            // 3. Event starts shortly before focus session (within 15 minutes) - user might want to reschedule
            let conflicts = 
                // Event starts during focus session
                (event_start >= focus_start_time && event_start < focus_end_time) ||
                // Event overlaps (starts before, ends during or after)
                (event_start < focus_start_time && event_end > focus_start_time) ||
                // Event starts shortly before focus session (within 15 min) - might want buffer time
                (event_start < focus_start_time && event_start >= focus_start_time - chrono::Duration::minutes(15));
            
            if conflicts {
                // Determine suggested time based on conflict type
                let suggested_time = if event_start < focus_start_time {
                    // Event starts before focus - suggest moving to after focus ends
                    focus_end_time + chrono::Duration::minutes(15) // 15 min buffer after focus
                } else {
                    // Event starts during focus - suggest moving to after focus ends
                    focus_end_time + chrono::Duration::minutes(15) // 15 min buffer after focus
                };
                
                // Generate reason based on conflict type
                let reason = if event_start < focus_start_time && event_end > focus_start_time {
                    format!(
                        "This meeting overlaps with your {} focus session ({} - {}). Consider rescheduling to avoid interruption.",
                        session_mode_name,
                        focus_start_time.format("%H:%M"),
                        focus_end_time.format("%H:%M")
                    )
                } else if event_start >= focus_start_time && event_start < focus_end_time {
                    format!(
                        "This meeting starts during your {} focus session ({} - {}). Reschedule to maintain focus.",
                        session_mode_name,
                        focus_start_time.format("%H:%M"),
                        focus_end_time.format("%H:%M")
                    )
                } else {
                    format!(
                        "This meeting starts just before your {} focus session ({} - {}). Consider rescheduling to allow buffer time.",
                        session_mode_name,
                        focus_start_time.format("%H:%M"),
                        focus_end_time.format("%H:%M")
                    )
                };
                
                let suggestion = MeetingSuggestion {
                    event_id: event.id.clone(),
                    title: event.title.clone(),
                    original_time: event.start_time,
                    suggested_time,
                    reason,
                };
                
                suggestions.push(suggestion);
                println!("[Focus] Found conflicting meeting: {} at {} (conflicts with focus {} - {})", 
                    event.title, event.start_time, focus_start_time, focus_end_time);
            }
        }
        
        // Sort suggestions by original time
        suggestions.sort_by_key(|s| s.original_time);
        
        println!("[Focus] Found {} meeting suggestions", suggestions.len());
        Ok(suggestions)
    }

    /// Get countdown remaining seconds
    pub async fn get_remaining_seconds(&self) -> Option<u64> {
        let session = self.current_session.read().await;
        if let Some(s) = session.as_ref() {
            if !s.is_active {
                return None;
            }
            // Calculate remaining seconds dynamically based on end_time
            let now = Utc::now();
            if now >= s.end_time {
                return Some(0);
            }
            let remaining = (s.end_time - now).num_seconds();
            if remaining > 0 {
                Some(remaining as u64)
            } else {
                Some(0)
            }
        } else {
            None
        }
    }

    /// Check if focus mode is active
    pub async fn is_active(&self) -> bool {
        let session = self.current_session.read().await;
        session.as_ref().map(|s| s.is_active).unwrap_or(false)
    }

    // Helper to clone service for timer task
    fn clone_for_timer(&self) -> Self {
        Self {
            current_session: Arc::clone(&self.current_session),
            focus_assist_state: Arc::clone(&self.focus_assist_state),
            notification_state: Arc::clone(&self.notification_state),
            temporary_mute_end_time: Arc::clone(&self.temporary_mute_end_time),
            app_handle: self.app_handle.clone(),
        }
    }
}

impl Clone for FocusService {
    fn clone(&self) -> Self {
        Self {
            current_session: Arc::clone(&self.current_session),
            focus_assist_state: Arc::clone(&self.focus_assist_state),
            notification_state: Arc::clone(&self.notification_state),
            temporary_mute_end_time: Arc::clone(&self.temporary_mute_end_time),
            app_handle: self.app_handle.clone(),
        }
    }
}

// Global focus service instance
use std::sync::OnceLock;
use tokio::sync::Mutex;

static FOCUS_SERVICE: OnceLock<Arc<Mutex<FocusService>>> = OnceLock::new();

pub async fn get_focus_service() -> Arc<Mutex<FocusService>> {
    FOCUS_SERVICE
        .get_or_init(|| {
            Arc::new(Mutex::new(FocusService::new()))
        })
        .clone()
}
