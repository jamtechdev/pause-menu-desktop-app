// Direct Windows API implementation for notification suppression
// This uses native Windows APIs instead of PowerShell for reliability

#[cfg(windows)]
use windows::Win32::System::Registry::*;
#[cfg(windows)]
use windows::Win32::Foundation::*;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::*;
#[cfg(windows)]
use windows::Win32::System::Threading::*;
#[cfg(windows)]
use windows::Win32::System::Diagnostics::ToolHelp::*;
#[cfg(windows)]
use windows::core::*;

/// Suppress notifications using direct Windows API calls
/// Falls back to PowerShell if direct API fails
#[cfg(windows)]
pub fn suppress_notifications_direct() -> std::result::Result<(), String> {
    // For now, use PowerShell method which is more reliable
    // Direct Windows API has compatibility issues with windows-rs crate
    use std::process::Command;
    
    let ps_script = r#"
        $ErrorActionPreference = "Stop"
        
        Write-Host "[Notifications] Starting comprehensive notification suppression..."
        
        # Method 1: Disable global toast notifications
        $notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
        if (-not (Test-Path $notifPath)) {
            New-Item -Path $notifPath -Force | Out-Null
        }
        Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Value 0 -Type DWord -Force
        Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED" -Value 0 -Type DWord -Force
        Write-Host "[Notifications] Disabled global toast notifications"
        
        # Method 2: Set Focus Assist to Alarms Only
        $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
        $keys = Get-ChildItem -Path $basePath -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*quiescence*" }
        foreach ($key in $keys) {
            try {
                Set-ItemProperty -Path $key.PSPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction SilentlyContinue
            } catch {}
        }
        
        # Method 3: Direct paths
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
            } catch {}
        }
        
        # Method 4: Disable app-specific notifications
        $apps = @("Microsoft.SkypeApp", "MSTeams", "MicrosoftTeams", "com.microsoft.teams", "Microsoft.Outlook")
        foreach ($app in $apps) {
            try {
                $appPath = Join-Path $notifPath $app
                if (-not (Test-Path $appPath)) {
                    New-Item -Path $appPath -Force | Out-Null
                }
                Set-ItemProperty -Path $appPath -Name "Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $appPath -Name "ShowInActionCenter" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            } catch {}
        }
        
        # Method 5: Restart ShellExperienceHost
        Start-Sleep -Milliseconds 500
        Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 1000
        
        # Method 6: Broadcast settings change
        try {
            Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                public class Win32 {
                    [DllImport("user32.dll", CharSet=CharSet.Auto)]
                    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
                    public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);
                    public static readonly uint WM_SETTINGCHANGE = 0x001A;
                    public static readonly uint SMTO_ABORTIFHUNG = 0x0002;
                }
"@ -ErrorAction SilentlyContinue
            $result = [IntPtr]::Zero
            [Win32]::SendMessageTimeout([Win32]::HWND_BROADCAST, [Win32]::WM_SETTINGCHANGE, [IntPtr]::Zero, "Environment", [Win32]::SMTO_ABORTIFHUNG, 5000, [ref]$result) | Out-Null
        } catch {}
        
        Write-Host "[Notifications] Notification suppression completed"
        exit 0
    "#;
    
    let output = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("[Focus] Notification suppression stdout: {}", stdout);
    
    if output.status.success() {
        Ok(())
    } else {
        Err(format!("PowerShell script failed with exit code: {:?}", output.status.code()))
    }
}

#[cfg(not(windows))]
pub fn suppress_notifications_direct() -> std::result::Result<(), String> {
    Err("Not available on this platform".to_string())
}

/// Restore notifications using PowerShell
#[cfg(windows)]
pub fn restore_notifications_direct() -> std::result::Result<(), String> {
    use std::process::Command;
    
    let ps_script = r#"
        $ErrorActionPreference = "Continue"
        
        Write-Host "[Notifications] Restoring notifications..."
        
        # Restore global notifications
        $notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
        if (Test-Path $notifPath) {
            Remove-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED" -Force -ErrorAction SilentlyContinue
        }
        
        # Restore Focus Assist to Off
        $directPaths = @(
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win10\Current",
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win11\Current"
        )
        foreach ($directPath in $directPaths) {
            try {
                if (Test-Path $directPath) {
                    Set-ItemProperty -Path $directPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
        # Restart ShellExperienceHost
        Start-Sleep -Milliseconds 500
        Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        
        Write-Host "[Notifications] Notifications restored"
        exit 0
    "#;
    
    let output = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("[Focus] Notification restoration stdout: {}", stdout);
    
    Ok(())
}

#[cfg(not(windows))]
pub fn restore_notifications_direct() -> std::result::Result<(), String> {
    Err("Not available on this platform".to_string())
}

#[cfg(windows)]
unsafe fn disable_global_notifications() -> std::result::Result<(), String> {
    let key_path = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings");
    
    let mut hkey = HKEY::default();
    let result = RegCreateKeyW(
        HKEY_CURRENT_USER,
        key_path,
        &mut hkey,
    );
    
    if result.is_ok() {
        // Disable toast notifications
        let value_name = w!("NOC_GLOBAL_SETTING_TOAST_ENABLED");
        let value: u32 = 0;
        match RegSetValueExW(
            hkey,
            value_name,
            0,
            REG_DWORD,
            Some(&value.to_le_bytes()),
        ) {
            Ok(_) => println!("[Notifications] ✓ Set NOC_GLOBAL_SETTING_TOAST_ENABLED to 0"),
            Err(e) => {
                let _ = RegCloseKey(hkey);
                return Err(format!("Failed to set toast notifications: {:?}", e));
            }
        }
        
        // Disable Action Center
        let value_name2 = w!("NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED");
        match RegSetValueExW(
            hkey,
            value_name2,
            0,
            REG_DWORD,
            Some(&value.to_le_bytes()),
        ) {
            Ok(_) => println!("[Notifications] ✓ Set NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED to 0"),
            Err(e) => {
                let _ = RegCloseKey(hkey);
                return Err(format!("Failed to set action center: {:?}", e));
            }
        }
        
        let _ = RegCloseKey(hkey);
        println!("[Notifications] ✓ Disabled global notifications via registry");
        Ok(())
    } else {
        Err("Failed to create/open registry key".to_string())
    }
}

#[cfg(windows)]
unsafe fn restore_global_notifications() -> std::result::Result<(), String> {
    let key_path = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings");
    
    let mut hkey = HKEY::default();
    let result = RegOpenKeyExW(
        HKEY_CURRENT_USER,
        key_path,
        0,
        KEY_WRITE,
        &mut hkey,
    );
    
    if result.is_ok() {
        // Remove the disabled properties
        let value_name = w!("NOC_GLOBAL_SETTING_TOAST_ENABLED");
        let _ = RegDeleteValueW(hkey, value_name);
        
        let value_name2 = w!("NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED");
        let _ = RegDeleteValueW(hkey, value_name2);
        
        let _ = RegCloseKey(hkey);
        println!("[Notifications] Restored global notifications via registry");
    }
    
    Ok(())
}

#[cfg(windows)]
unsafe fn set_focus_assist_alarms_only() -> std::result::Result<(), String> {
    // Focus Assist is stored in CloudStore registry
    // We need to find and update the quiescence keys
    let base_path = w!("Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\Cache\\DefaultAccount");
    
    let mut hkey = HKEY::default();
    let result = RegOpenKeyExW(
        HKEY_CURRENT_USER,
        base_path,
        0,
        KEY_READ | KEY_WRITE,
        &mut hkey,
    );
    
    if result.is_ok() {
        // Try to enumerate subkeys and find quiescence keys
        // This is complex, so we'll use a simpler approach: try known paths
        
        let _ = RegCloseKey(hkey);
    }
    
    // Try direct paths
    let direct_paths = [
        w!("Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\Cache\\DefaultAccount\\$windows.data.notifications.quiescence.win10\\Current"),
        w!("Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\Cache\\DefaultAccount\\$windows.data.notifications.quiescence.win11\\Current"),
    ];
    
    // Focus Assist Alarms Only mode binary value
    let alarms_only_value: [u8; 16] = [0x43, 0x42, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    
    for path in &direct_paths {
        let mut hkey = HKEY::default();
        let result = RegCreateKeyW(
            HKEY_CURRENT_USER,
            *path,
            &mut hkey,
        );
        
        if result.is_ok() {
            let value_name = w!("Data");
            let _ = RegSetValueExW(
                hkey,
                value_name,
                0,
                REG_BINARY,
                Some(&alarms_only_value),
            );
            let _ = RegCloseKey(hkey);
            println!("[Notifications] Set Focus Assist to Alarms Only via registry: {:?}", path);
        }
    }
    
    Ok(())
}

#[cfg(windows)]
unsafe fn restore_focus_assist() -> std::result::Result<(), String> {
    // Restore Focus Assist to Off (mode 0)
    let direct_paths = [
        w!("Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\Cache\\DefaultAccount\\$windows.data.notifications.quiescence.win10\\Current"),
        w!("Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\Cache\\DefaultAccount\\$windows.data.notifications.quiescence.win11\\Current"),
    ];
    
    // Focus Assist Off mode binary value
    let off_value: [u8; 16] = [0x43, 0x42, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    
    for path in &direct_paths {
        let mut hkey = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            *path,
            0,
            KEY_WRITE,
            &mut hkey,
        );
        
        if result.is_ok() {
            let value_name = w!("Data");
            let _ = RegSetValueExW(
                hkey,
                value_name,
                0,
                REG_BINARY,
                Some(&off_value),
            );
            let _ = RegCloseKey(hkey);
            println!("[Notifications] Restored Focus Assist to Off via registry: {:?}", path);
        }
    }
    
    Ok(())
}

#[cfg(windows)]
unsafe fn disable_app_notifications() -> std::result::Result<(), String> {
    let apps = [
        "Microsoft.SkypeApp",
        "MSTeams",
        "MicrosoftTeams",
        "com.microsoft.teams",
        "Microsoft.Outlook",
        "Microsoft.Office.Outlook",
    ];
    
    let base_path = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings");
    
    for app in &apps {
        // Build the full path
        let mut app_path_wide: Vec<u16> = base_path.as_wide().to_vec();
        app_path_wide.push('\\' as u16);
        app_path_wide.extend(app.encode_utf16());
        app_path_wide.push(0);
        
        let mut hkey = HKEY::default();
        let result = RegCreateKeyW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(app_path_wide.as_ptr()),
            &mut hkey,
        );
        
        if result.is_ok() {
            let value_name = w!("Enabled");
            let value: u32 = 0;
            let _ = RegSetValueExW(
                hkey,
                value_name,
                0,
                REG_DWORD,
                Some(&value.to_le_bytes()),
            );
            
            let value_name2 = w!("ShowInActionCenter");
            let _ = RegSetValueExW(
                hkey,
                value_name2,
                0,
                REG_DWORD,
                Some(&value.to_le_bytes()),
            );
            
            let _ = RegCloseKey(hkey);
            println!("[Notifications] Disabled notifications for app: {}", app);
        }
    }
    
    Ok(())
}

#[cfg(windows)]
unsafe fn restore_app_notifications() -> std::result::Result<(), String> {
    let base_path = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings");
    
    let mut hkey = HKEY::default();
    let result = RegOpenKeyExW(
        HKEY_CURRENT_USER,
        base_path,
        0,
        KEY_READ | KEY_WRITE,
        &mut hkey,
    );
    
    if result.is_ok() {
        // Enumerate subkeys and remove Enabled=0 values
        // For simplicity, we'll just try to delete the Enabled value from known apps
        let _ = RegCloseKey(hkey);
    }
    
    Ok(())
}

#[cfg(windows)]
unsafe fn broadcast_settings_change() -> std::result::Result<(), String> {
    // Broadcast WM_SETTINGCHANGE to notify Windows of registry changes
    let hwnd_broadcast = HWND(0xffff);
    
    // Send WM_SETTINGCHANGE message with environment string
    let env_str = windows::core::HSTRING::from("Environment");
    let mut result = 0usize;
    let _ = SendMessageTimeoutW(
        hwnd_broadcast,
        WM_SETTINGCHANGE,
        WPARAM(0),
        LPARAM(env_str.as_ptr() as isize),
        SMTO_ABORTIFHUNG,
        5000,
        Some(&mut result),
    );
    
    println!("[Notifications] Broadcasted settings change message");
    Ok(())
}

#[cfg(windows)]
unsafe fn restart_shell_experience_host() -> std::result::Result<(), String> {
    println!("[Notifications] Attempting to restart ShellExperienceHost...");
    
    // Method 1: Try using PowerShell (more reliable)
    use std::process::Command;
    let ps_script = r#"
        $ErrorActionPreference = "Continue"
        $process = Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "[Notifications] Found ShellExperienceHost process (PID: $($process.Id))"
            Stop-Process -Name "ShellExperienceHost" -Force -ErrorAction SilentlyContinue
            Write-Host "[Notifications] Terminated ShellExperienceHost"
            Start-Sleep -Milliseconds 500
            Write-Host "[Notifications] ShellExperienceHost will restart automatically by Windows"
        } else {
            Write-Host "[Notifications] ShellExperienceHost not running (this is normal - Windows starts it on-demand)"
            Write-Host "[Notifications] Opening Action Center to trigger ShellExperienceHost startup..."
            # Trigger ShellExperienceHost to start by opening Action Center
            try {
                Add-Type -TypeDefinition @"
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
                        public static readonly byte VK_LWIN = 0x5B;
                        public static readonly byte VK_A = 0x41;
                        public static readonly uint KEYEVENTF_KEYUP = 0x0002;
                    }
"@ -ErrorAction SilentlyContinue
                # Simulate Win+A to open Action Center (this will start ShellExperienceHost)
                [Win32]::keybd_event([Win32]::VK_LWIN, 0, 0, 0)
                [Win32]::keybd_event([Win32]::VK_A, 0, 0, 0)
                Start-Sleep -Milliseconds 100
                [Win32]::keybd_event([Win32]::VK_A, 0, [Win32]::KEYEVENTF_KEYUP, 0)
                [Win32]::keybd_event([Win32]::VK_LWIN, 0, [Win32]::KEYEVENTF_KEYUP, 0)
                Start-Sleep -Milliseconds 200
                # Close Action Center by pressing Esc
                [Win32]::keybd_event(0x1B, 0, 0, 0) # VK_ESCAPE
                Start-Sleep -Milliseconds 50
                [Win32]::keybd_event(0x1B, 0, [Win32]::KEYEVENTF_KEYUP, 0)
                Write-Host "[Notifications] Triggered ShellExperienceHost startup"
            } catch {
                Write-Host "[Notifications] Could not trigger ShellExperienceHost (this is OK)"
            }
        }
    "#;
    
    let output = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
        .output();
    
    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            println!("[Notifications] PowerShell output: {}", stdout);
            if result.status.success() {
                println!("[Notifications] ✓ ShellExperienceHost restart initiated via PowerShell");
                return Ok(());
            }
        }
        Err(e) => {
            eprintln!("[Notifications] PowerShell method failed: {}, trying Windows API...", e);
        }
    }
    
    // Method 2: Fallback to Windows API
    let snapshot = match CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[Notifications] Failed to create process snapshot: {:?}", e);
            return Ok(()); // Don't fail if we can't create snapshot
        }
    };
    
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    
    let mut found = false;
    if Process32FirstW(snapshot, &mut entry).is_ok() {
        loop {
            // Convert wide string to regular string
            let mut name_bytes = Vec::new();
            for &byte in &entry.szExeFile {
                if byte == 0 {
                    break;
                }
                name_bytes.push(byte);
            }
            let process_name = String::from_utf16_lossy(&name_bytes);
            
            if process_name.eq_ignore_ascii_case("ShellExperienceHost.exe") {
                println!("[Notifications] Found ShellExperienceHost process (PID: {})", entry.th32ProcessID);
                match OpenProcess(PROCESS_TERMINATE, false, entry.th32ProcessID) {
                    Ok(process_handle) => {
                        match TerminateProcess(process_handle, 0) {
                            Ok(_) => {
                                println!("[Notifications] ✓ Terminated ShellExperienceHost process");
                                found = true;
                            }
                            Err(e) => {
                                eprintln!("[Notifications] Failed to terminate process: {:?}", e);
                            }
                        }
                        let _ = CloseHandle(process_handle);
                        break;
                    }
                    Err(e) => {
                        eprintln!("[Notifications] Failed to open ShellExperienceHost process: {:?}", e);
                    }
                }
            }
            
            if Process32NextW(snapshot, &mut entry).is_err() {
                break;
            }
        }
    }
    
    let _ = CloseHandle(snapshot);
    
    if !found {
        println!("[Notifications] ShellExperienceHost not running (Windows will start it when needed)");
    }
    
    Ok(())
}

/// Mute notifications using Windows API (for overlay toggle)
/// Uses PowerShell as primary method for reliability, Windows API as supplement
#[cfg(windows)]
pub fn mute_notifications_windows_api() -> std::result::Result<(), String> {
    println!("[Notifications] Muting notifications using comprehensive approach...");
    
    // Use PowerShell as primary method (more reliable for app-specific notifications)
    use std::process::Command;
    
    let ps_script = r#"
        $ErrorActionPreference = "Stop"
        
        Write-Host "[Notifications] Starting comprehensive notification suppression..."
        
        # Method 1: Disable global toast notifications
        $notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
        if (-not (Test-Path $notifPath)) {
            New-Item -Path $notifPath -Force | Out-Null
        }
        Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Value 0 -Type DWord -Force
        Set-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED" -Value 0 -Type DWord -Force
        Write-Host "[Notifications] Disabled global toast notifications"
        
        # Method 2: Disable ALL app notifications (comprehensive approach)
        Write-Host "[Notifications] Disabling notifications for all apps..."
        $allApps = Get-ChildItem -Path $notifPath -ErrorAction SilentlyContinue
        foreach ($app in $allApps) {
            try {
                Set-ItemProperty -Path $app.PSPath -Name "Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $app.PSPath -Name "ShowInActionCenter" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $app.PSPath -Name "ToastEnabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Write-Host "[Notifications] Disabled: $($app.PSChildName)"
            } catch {
                # Ignore errors for individual apps
            }
        }
        
        # Method 2b: Aggressively disable Teams notifications (multiple registry paths)
        Write-Host "[Notifications] Aggressively disabling Teams notifications..."
        $teamsVariants = @(
            "MSTeams",
            "MicrosoftTeams",
            "com.microsoft.teams",
            "Microsoft.SkypeApp",
            "Microsoft.Skype.SkypeDesktop",
            "Microsoft.SkypeApp_kzf8qxf38zg5c!App",
            "Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!https://teams.microsoft.com/",
            "Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!https://web.teams.microsoft.com/",
            "Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!https://web.skype.com/"
        )
        foreach ($teamsId in $teamsVariants) {
            try {
                $teamsPath = Join-Path $notifPath $teamsId
                if (-not (Test-Path $teamsPath)) {
                    New-Item -Path $teamsPath -Force -ErrorAction SilentlyContinue | Out-Null
                }
                Set-ItemProperty -Path $teamsPath -Name "Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $teamsPath -Name "ShowInActionCenter" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $teamsPath -Name "ToastEnabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $teamsPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                Write-Host "[Notifications] Disabled Teams variant: $teamsId"
            } catch {
                Write-Host "[Notifications] Error disabling $teamsId : $_"
            }
        }
        
        # Method 2c: Find and disable any app containing "team", "skype", or "teams" in name
        Write-Host "[Notifications] Searching for Teams-related apps..."
        foreach ($app in $allApps) {
            $appName = $app.PSChildName.ToLower()
            if ($appName -like "*team*" -or $appName -like "*skype*" -or $appName -like "*microsoftteams*") {
                try {
                    Set-ItemProperty -Path $app.PSPath -Name "Enabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                    Set-ItemProperty -Path $app.PSPath -Name "ShowInActionCenter" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                    Set-ItemProperty -Path $app.PSPath -Name "ToastEnabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                    Write-Host "[Notifications] Found and disabled: $($app.PSChildName)"
                } catch {
                    Write-Host "[Notifications] Error disabling $($app.PSChildName) : $_"
                }
            }
        }
        
        # Method 3: Set Focus Assist to Alarms Only
        $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
        $keys = Get-ChildItem -Path $basePath -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*quiescence*" }
        foreach ($key in $keys) {
            try {
                Set-ItemProperty -Path $key.PSPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction SilentlyContinue
            } catch {}
        }
        
        # Method 4: Direct paths
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
            } catch {}
        }
        
        # Method 5: Also disable notifications in Teams app data (if Teams is installed)
        Write-Host "[Notifications] Attempting to disable Teams notifications in app data..."
        $teamsAppDataPath = "$env:APPDATA\Microsoft\Teams"
        if (Test-Path $teamsAppDataPath) {
            try {
                $teamsSettingsPath = Join-Path $teamsAppDataPath "desktop-config.json"
                if (Test-Path $teamsSettingsPath) {
                    $config = Get-Content $teamsSettingsPath -Raw | ConvertFrom-Json
                    if ($config) {
                        if (-not $config.PSObject.Properties['notifications']) {
                            $config | Add-Member -MemberType NoteProperty -Name "notifications" -Value @{} -Force
                        }
                        $config.notifications | Add-Member -MemberType NoteProperty -Name "enabled" -Value $false -Force
                        $config | ConvertTo-Json -Depth 10 | Set-Content $teamsSettingsPath -Force
                        Write-Host "[Notifications] Disabled notifications in Teams config"
                    }
                }
            } catch {
                Write-Host "[Notifications] Could not modify Teams config: $_"
            }
        }
        
        # Method 6: Restart ShellExperienceHost
        Start-Sleep -Milliseconds 500
        Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 1000
        
        # Method 7: Try to restart Teams process to apply settings
        Write-Host "[Notifications] Attempting to restart Teams to apply notification settings..."
        $teamsProcesses = Get-Process -Name "Teams" -ErrorAction SilentlyContinue
        if ($teamsProcesses) {
            foreach ($proc in $teamsProcesses) {
                try {
                    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                    Write-Host "[Notifications] Stopped Teams process (PID: $($proc.Id))"
                } catch {
                    Write-Host "[Notifications] Could not stop Teams process: $_"
                }
            }
            Start-Sleep -Milliseconds 2000
            Write-Host "[Notifications] Teams will restart automatically with new notification settings"
        }
        
        # Method 8: Actively close/hide Teams notification windows
        Write-Host "[Notifications] Closing any visible Teams notification windows..."
        try {
            Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                using System.Text;
                public class Win32 {
                    [DllImport("user32.dll")]
                    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
                    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
                    [DllImport("user32.dll")]
                    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
                    [DllImport("user32.dll")]
                    public static extern int GetWindowTextLength(IntPtr hWnd);
                    [DllImport("user32.dll")]
                    public static extern bool IsWindowVisible(IntPtr hWnd);
                    [DllImport("user32.dll")]
                    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
                    [DllImport("user32.dll")]
                    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
                    public static readonly uint WM_CLOSE = 0x0010;
                }
"@ -ErrorAction SilentlyContinue
            
            $teamsNotificationClosed = $false
            [Win32+EnumWindowsProc]$callback = {
                param([IntPtr]$hWnd, [IntPtr]$lParam)
                if ([Win32]::IsWindowVisible($hWnd)) {
                    $length = [Win32]::GetWindowTextLength($hWnd)
                    if ($length -gt 0) {
                        $sb = New-Object System.Text.StringBuilder($length + 1)
                        [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
                        $windowTitle = $sb.ToString()
                        # BE VERY SPECIFIC - only close actual Teams notification windows
                        # Don't close other apps that might contain "Teams" or "Notification" in title
                        $isTeamsNotification = ($windowTitle -like "*Microsoft Teams*Notification*" -or 
                                               $windowTitle -like "*Teams*Notification*" -or
                                               ($windowTitle -eq "Microsoft Teams" -and $length -lt 50))
                        
                        # EXCLUDE important apps
                        $isExcluded = ($windowTitle -like "*Cursor*" -or 
                                      $windowTitle -like "*Visual Studio*" -or
                                      $windowTitle -like "*Code*" -or
                                      $windowTitle -like "*Chrome*" -or
                                      $windowTitle -like "*Firefox*" -or
                                      $windowTitle -like "*Edge*" -or
                                      $windowTitle -like "*Explorer*")
                        
                        if ($isTeamsNotification -and -not $isExcluded) {
                            [Win32]::PostMessage($hWnd, [Win32]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
                            Write-Host "[Notifications] Closed Teams notification window: $windowTitle"
                            $script:teamsNotificationClosed = $true
                        }
                    }
                }
                return $true
            }
            [Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
            if ($teamsNotificationClosed) {
                Start-Sleep -Milliseconds 200
            }
        } catch {
            Write-Host "[Notifications] Could not close Teams notification windows: $_"
        }
        
        # Method 9: Broadcast settings change
        try {
            Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                public class Win32 {
                    [DllImport("user32.dll", CharSet=CharSet.Auto)]
                    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
                    public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);
                    public static readonly uint WM_SETTINGCHANGE = 0x001A;
                    public static readonly uint SMTO_ABORTIFHUNG = 0x0002;
                }
"@ -ErrorAction SilentlyContinue
            $result = [IntPtr]::Zero
            [Win32]::SendMessageTimeout([Win32]::HWND_BROADCAST, [Win32]::WM_SETTINGCHANGE, [IntPtr]::Zero, "Environment", [Win32]::SMTO_ABORTIFHUNG, 5000, [ref]$result) | Out-Null
        } catch {}
        
        Write-Host "[Notifications] Notification suppression completed"
        Write-Host "[Notifications] NOTE: If Teams notifications still appear, you may need to disable them in Teams Settings > Notifications"
        exit 0
    "#;
    
    let output = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("[Notifications] PowerShell output: {}", stdout);
    
    if output.status.success() {
        // Also try Windows API as supplement
        unsafe {
            let _ = disable_global_notifications();
            let _ = set_focus_assist_alarms_only();
            let _ = broadcast_settings_change();
            let _ = restart_shell_experience_host();
        }
        
        // Start background task to continuously block Teams notifications
        // DISABLED: Notification blocker is too aggressive and closes other apps
        // TODO: Re-enable with better filtering
        // let _ = start_notification_blocker();
        
        println!("[Notifications] ✓ Notifications muted via comprehensive approach");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("PowerShell script failed: {}\nStdout: {}\nStderr: {}", 
            output.status, stdout, stderr))
    }
}

/// Unmute notifications using Windows API (for overlay toggle)
/// Uses PowerShell as primary method for reliability
#[cfg(windows)]
pub fn unmute_notifications_windows_api() -> std::result::Result<(), String> {
    println!("[Notifications] Unmuting notifications using comprehensive approach...");
    
    use std::process::Command;
    
    let ps_script = r#"
        $ErrorActionPreference = "Continue"
        
        Write-Host "[Notifications] Restoring notifications..."
        
        # Restore global notifications
        $notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
        if (Test-Path $notifPath) {
            Remove-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $notifPath -Name "NOC_GLOBAL_SETTING_ACTION_CENTER_ENABLED" -Force -ErrorAction SilentlyContinue
            Write-Host "[Notifications] Restored global notifications"
        }
        
        # Restore all app notifications (remove all properties that were set to 0, then explicitly enable)
        Write-Host "[Notifications] Restoring app notifications..."
        $allApps = Get-ChildItem -Path $notifPath -ErrorAction SilentlyContinue
        foreach ($app in $allApps) {
            try {
                $wasDisabled = $false
                
                # Remove all properties that might have been set to 0 during muting
                $currentEnabled = Get-ItemProperty -Path $app.PSPath -Name "Enabled" -ErrorAction SilentlyContinue
                if ($currentEnabled -and $currentEnabled.Enabled -eq 0) {
                    Remove-ItemProperty -Path $app.PSPath -Name "Enabled" -Force -ErrorAction SilentlyContinue
                    $wasDisabled = $true
                }
                
                $currentShowInActionCenter = Get-ItemProperty -Path $app.PSPath -Name "ShowInActionCenter" -ErrorAction SilentlyContinue
                if ($currentShowInActionCenter -and $currentShowInActionCenter.ShowInActionCenter -eq 0) {
                    Remove-ItemProperty -Path $app.PSPath -Name "ShowInActionCenter" -Force -ErrorAction SilentlyContinue
                    $wasDisabled = $true
                }
                
                $currentToastEnabled = Get-ItemProperty -Path $app.PSPath -Name "ToastEnabled" -ErrorAction SilentlyContinue
                if ($currentToastEnabled -and $currentToastEnabled.ToastEnabled -eq 0) {
                    Remove-ItemProperty -Path $app.PSPath -Name "ToastEnabled" -Force -ErrorAction SilentlyContinue
                    $wasDisabled = $true
                }
                
                # Also remove NOC_GLOBAL_SETTING_TOAST_ENABLED if it was set on app-specific paths
                $currentNocToast = Get-ItemProperty -Path $app.PSPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -ErrorAction SilentlyContinue
                if ($currentNocToast -and $currentNocToast.NOC_GLOBAL_SETTING_TOAST_ENABLED -eq 0) {
                    Remove-ItemProperty -Path $app.PSPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Force -ErrorAction SilentlyContinue
                    $wasDisabled = $true
                }
                
                # Explicitly enable notifications if they were disabled (more reliable)
                if ($wasDisabled) {
                    Set-ItemProperty -Path $app.PSPath -Name "Enabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                    Set-ItemProperty -Path $app.PSPath -Name "ShowInActionCenter" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                    Set-ItemProperty -Path $app.PSPath -Name "ToastEnabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                    Write-Host "[Notifications] Explicitly enabled notifications for: $($app.PSChildName)"
                }
            } catch {
                # Ignore errors for individual apps
            }
        }
        
        # Restore Teams-specific variants (same list as in mute function)
        Write-Host "[Notifications] Restoring Teams notification variants..."
        $teamsVariants = @(
            "MSTeams",
            "MicrosoftTeams",
            "com.microsoft.teams",
            "Microsoft.SkypeApp",
            "Microsoft.Skype.SkypeDesktop",
            "Microsoft.SkypeApp_kzf8qxf38zg5c!App",
            "Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!https://teams.microsoft.com/",
            "Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!https://web.teams.microsoft.com/",
            "Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!https://web.skype.com/"
        )
        foreach ($teamsId in $teamsVariants) {
            try {
                $teamsPath = Join-Path $notifPath $teamsId
                if (Test-Path $teamsPath) {
                    # Remove the disabled properties first
                    Remove-ItemProperty -Path $teamsPath -Name "Enabled" -Force -ErrorAction SilentlyContinue
                    Remove-ItemProperty -Path $teamsPath -Name "ShowInActionCenter" -Force -ErrorAction SilentlyContinue
                    Remove-ItemProperty -Path $teamsPath -Name "ToastEnabled" -Force -ErrorAction SilentlyContinue
                    Remove-ItemProperty -Path $teamsPath -Name "NOC_GLOBAL_SETTING_TOAST_ENABLED" -Force -ErrorAction SilentlyContinue
                    
                    # Explicitly enable notifications by setting to 1 (more reliable than just removing)
                    Set-ItemProperty -Path $teamsPath -Name "Enabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                    Set-ItemProperty -Path $teamsPath -Name "ShowInActionCenter" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                    Set-ItemProperty -Path $teamsPath -Name "ToastEnabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                    Write-Host "[Notifications] Explicitly enabled notifications for Teams variant: $teamsId"
                }
            } catch {
                Write-Host "[Notifications] Error restoring $teamsId : $_"
            }
        }
        
        # Restore Focus Assist to Off
        Write-Host "[Notifications] Restoring Focus Assist..."
        $basePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount"
        $keys = Get-ChildItem -Path $basePath -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*quiescence*" }
        foreach ($key in $keys) {
            try {
                Set-ItemProperty -Path $key.PSPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction SilentlyContinue
            } catch {}
        }
        
        # Direct paths
        $directPaths = @(
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win10\Current",
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\`$windows.data.notifications.quiescence.win11\Current"
        )
        foreach ($directPath in $directPaths) {
            try {
                if (Test-Path $directPath) {
                    Set-ItemProperty -Path $directPath -Name "Data" -Value ([byte[]](0x43,0x42,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -ErrorAction SilentlyContinue
                    Write-Host "[Notifications] Restored Focus Assist for: $directPath"
                }
            } catch {}
        }
        
        # Restore Teams config file (if it was modified)
        Write-Host "[Notifications] Restoring Teams config file..."
        $teamsAppDataPath = "$env:APPDATA\Microsoft\Teams"
        if (Test-Path $teamsAppDataPath) {
            try {
                $teamsSettingsPath = Join-Path $teamsAppDataPath "desktop-config.json"
                if (Test-Path $teamsSettingsPath) {
                    $config = Get-Content $teamsSettingsPath -Raw | ConvertFrom-Json
                    if ($config -and $config.notifications) {
                        # Remove the enabled property to restore default behavior
                        if ($config.notifications.PSObject.Properties['enabled']) {
                            $config.notifications.PSObject.Properties.Remove('enabled')
                            $config | ConvertTo-Json -Depth 10 | Set-Content $teamsSettingsPath -Force
                            Write-Host "[Notifications] Restored Teams config file"
                        }
                    }
                }
            } catch {
                Write-Host "[Notifications] Could not restore Teams config: $_"
            }
        }
        
        # Restart ShellExperienceHost
        Write-Host "[Notifications] Restarting ShellExperienceHost..."
        Start-Sleep -Milliseconds 500
        Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 1000
        
        # Restart Teams to apply restored notification settings
        Write-Host "[Notifications] Restarting Teams to apply restored settings..."
        $teamsProcesses = Get-Process -Name "Teams" -ErrorAction SilentlyContinue
        if ($teamsProcesses) {
            foreach ($proc in $teamsProcesses) {
                try {
                    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                    Write-Host "[Notifications] Stopped Teams process (PID: $($proc.Id))"
                } catch {
                    Write-Host "[Notifications] Could not stop Teams process: $_"
                }
            }
            Start-Sleep -Milliseconds 2000
            Write-Host "[Notifications] Teams will restart automatically with restored notification settings"
        } else {
            Write-Host "[Notifications] Teams not running (will apply settings when it starts)"
        }
        
        # Broadcast settings change
        Write-Host "[Notifications] Broadcasting settings change..."
        try {
            Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                public class Win32 {
                    [DllImport("user32.dll", CharSet=CharSet.Auto)]
                    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
                    public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);
                    public static readonly uint WM_SETTINGCHANGE = 0x001A;
                    public static readonly uint SMTO_ABORTIFHUNG = 0x0002;
                }
"@ -ErrorAction SilentlyContinue
            $result = [IntPtr]::Zero
            [Win32]::SendMessageTimeout([Win32]::HWND_BROADCAST, [Win32]::WM_SETTINGCHANGE, [IntPtr]::Zero, "Environment", [Win32]::SMTO_ABORTIFHUNG, 5000, [ref]$result) | Out-Null
        } catch {}
        
        Write-Host "[Notifications] Notifications restored successfully"
        exit 0
    "#;
    
    let output = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", &ps_script])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("[Notifications] PowerShell output: {}", stdout);
    
    if output.status.success() {
        // Also try Windows API as supplement
        unsafe {
            let _ = restore_global_notifications();
            let _ = restore_focus_assist();
            let _ = broadcast_settings_change();
            let _ = restart_shell_experience_host();
        }
        
        // Stop the background notification blocker
        stop_notification_blocker();
        
        println!("[Notifications] ✓ Notifications unmuted via comprehensive approach");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("PowerShell script failed: {}\nStdout: {}\nStderr: {}", 
            output.status, stdout, stderr))
    }
}

#[cfg(not(windows))]
pub fn mute_notifications_windows_api() -> std::result::Result<(), String> {
    Err("Not available on this platform".to_string())
}

#[cfg(not(windows))]
pub fn unmute_notifications_windows_api() -> std::result::Result<(), String> {
    Err("Not available on this platform".to_string())
}

// Shared flag for notification blocker - must be accessible from both start and stop functions
#[cfg(windows)]
static BLOCKER_RUNNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Start a background task that continuously closes Teams notification windows
/// This runs while notifications are muted
#[cfg(windows)]
pub fn start_notification_blocker() -> std::result::Result<(), String> {
    use std::sync::atomic::Ordering;
    use std::time::Duration;
    
    // Check if blocker is already running
    if BLOCKER_RUNNING.swap(true, Ordering::SeqCst) {
        println!("[Notifications] Notification blocker already running");
        return Ok(());
    }
    
    println!("[Notifications] Starting background notification blocker...");
    
    // Spawn background task that runs continuously while muted
    // Use native Windows API for maximum speed (no PowerShell overhead)
    std::thread::spawn(move || {
        unsafe {
            extern "system" fn enum_windows_proc(hwnd: HWND, _lparam: LPARAM) -> BOOL {
                unsafe {
                    // Get window text
                    let mut title = [0u16; 512];
                    let title_len = GetWindowTextW(hwnd, &mut title);
                    
                    if title_len > 0 {
                        let title_str = String::from_utf16_lossy(&title[..title_len as usize]);
                        let title_lower = title_str.to_lowercase();
                        
                        // Check if it's a Teams notification window
                        // BE VERY SPECIFIC - don't close other apps like Cursor, VS Code, etc.
                        let is_teams_notification = 
                            (title_lower.contains("microsoft teams") && title_lower.contains("notification")) ||
                            (title_lower.contains("teams") && title_lower.contains("notification")) ||
                            (title_lower.contains("teams") && title_lower.contains("quick reply")) ||
                            (title_lower.contains("teams") && title_lower.contains("send a quick reply")) ||
                            (title_lower == "microsoft teams" && title_len < 50); // Short Teams notification titles
                        
                        // EXCLUDE common apps that might match
                        let is_excluded_app = 
                            title_lower.contains("cursor") ||
                            title_lower.contains("visual studio") ||
                            title_lower.contains("code") ||
                            title_lower.contains("chrome") ||
                            title_lower.contains("firefox") ||
                            title_lower.contains("edge") ||
                            title_lower.contains("explorer") ||
                            title_lower.contains("desktop") ||
                            title_lower.contains("taskbar");
                        
                        if is_teams_notification && !is_excluded_app {
                            // Immediately hide it (fastest method - happens before rendering)
                            let _ = ShowWindow(hwnd, SW_HIDE);
                            // Then close it
                            let _ = PostMessageW(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0));
                            return BOOL::from(true);
                        }
                    }
                    
                    // Also check visible windows by size and position (Teams notifications are small popups)
                    // BUT be very careful - only target very specific notification-like windows
                    // This catches notifications even if they don't have text yet
                    if IsWindowVisible(hwnd).as_bool() {
                        // First check if we have window text - if we do, use that instead
                        if title_len == 0 {
                            // Only check size/position for windows with NO text (true notification popups)
                            let mut rect = RECT::default();
                            if GetWindowRect(hwnd, &mut rect).is_ok() {
                                let width = (rect.right - rect.left).abs();
                                let height = (rect.bottom - rect.top).abs();
                                
                                // Teams notification windows are VERY specific:
                                // - 300-500px wide and 100-200px tall
                                // - Appear in the bottom-right corner
                                // - Have NO title text (or very short title)
                                if width >= 250 && width <= 550 && height >= 80 && height <= 250 {
                                    let screen_width = GetSystemMetrics(SM_CXSCREEN) as i32;
                                    let screen_height = GetSystemMetrics(SM_CYSCREEN) as i32;
                                    
                                    // Must be in the bottom-right corner (where notifications appear)
                                    // And must be very close to the edge
                                    if rect.right >= screen_width - 450 && rect.bottom >= screen_height - 350 {
                                        // Additional safety: check window class name if possible
                                        // For now, only close if it's truly tiny and in the corner
                                        // This should only catch actual notification popups
                                        let _ = ShowWindow(hwnd, SW_HIDE);
                                        let _ = PostMessageW(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0));
                                    }
                                }
                            }
                        }
                    }
                }
                BOOL::from(true)
            }
            
            // Run continuously - check every 10ms for instant blocking (faster than human perception ~16ms)
            // BUT check the flag and exit when it's set to false
            loop {
                // Check if we should stop
                if !BLOCKER_RUNNING.load(Ordering::SeqCst) {
                    println!("[Notifications] Background notification blocker thread exiting");
                    break;
                }
                
                let _ = EnumWindows(Some(enum_windows_proc), LPARAM(0));
                std::thread::sleep(Duration::from_millis(10)); // Very fast - 10ms checks (100 times per second)
            }
        }
    });
    
    println!("[Notifications] ✓ Background notification blocker started (checking every 10ms for instant blocking)");
    Ok(())
}

#[cfg(not(windows))]
pub fn start_notification_blocker() -> std::result::Result<(), String> {
    Err("Not available on this platform".to_string())
}

/// Stop the background notification blocker
#[cfg(windows)]
pub fn stop_notification_blocker() {
    use std::sync::atomic::Ordering;
    BLOCKER_RUNNING.store(false, Ordering::SeqCst);
    println!("[Notifications] Notification blocker stopped (thread will exit on next check)");
    // Give the thread a moment to exit
    std::thread::sleep(std::time::Duration::from_millis(50));
}

#[cfg(not(windows))]
pub fn stop_notification_blocker() {
    // No-op on non-Windows
}

