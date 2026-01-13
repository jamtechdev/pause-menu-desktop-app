# How to Restart ShellExperienceHost - Step by Step Guide

## What is ShellExperienceHost?
ShellExperienceHost is a Windows system process that handles:
- Notification system
- Action Center
- Start menu (on Windows 10/11)
- Settings app integration

Restarting it helps apply notification registry changes immediately.

## Method 1: Automatic (Recommended)
The app automatically restarts ShellExperienceHost when muting/unmuting notifications. You don't need to do anything manually.

## Method 2: Manual Restart via Task Manager

### Step-by-Step:

1. **Open Task Manager**
   - Press `Ctrl + Shift + Esc` (or `Ctrl + Alt + Delete` → Task Manager)
   - Or right-click the taskbar → "Task Manager"

2. **Find ShellExperienceHost**
   - In the "Processes" tab, look for "ShellExperienceHost"
   - You can also type "Shell" in the search box to filter

3. **End the Process**
   - Right-click on "ShellExperienceHost"
   - Click "End task" or "End process"
   - Confirm if asked

4. **Wait for Auto-Restart**
   - Windows will automatically restart ShellExperienceHost within a few seconds
   - You don't need to manually start it

## Method 3: Manual Restart via PowerShell

### Step-by-Step:

1. **Open PowerShell**
   - Press `Win + X`
   - Select "Windows PowerShell" or "Terminal"
   - Or search for "PowerShell" in Start menu

2. **Check if it's Running**
   ```powershell
   Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue
   ```

3. **If it's Running, Restart it:**
   ```powershell
   Get-Process -Name "ShellExperienceHost" | Stop-Process -Force
   ```

4. **If it's NOT Running (this is normal!):**
   - ShellExperienceHost only runs when needed (Start menu, Action Center, Settings)
   - To trigger it to start, simply:
     - Press `Win + A` to open Action Center (then press Esc to close)
     - Or open the Start menu
     - Or open Windows Settings
   - This will start ShellExperienceHost with the new notification settings

5. **Verify it Started:**
   ```powershell
   Get-Process -Name "ShellExperienceHost" -ErrorAction SilentlyContinue
   ```
   - If it shows a process, it's running with the new settings

## Method 4: Manual Restart via Command Prompt

### Step-by-Step:

1. **Open Command Prompt**
   - Press `Win + R`
   - Type `cmd` and press Enter
   - Or search for "Command Prompt" in Start menu

2. **Run the Command**
   ```cmd
   taskkill /F /IM ShellExperienceHost.exe
   ```

3. **Wait for Auto-Restart**
   - Windows will automatically restart it within a few seconds

## Why Restart ShellExperienceHost?

When you change notification settings in the registry:
- The changes are written to disk
- But ShellExperienceHost may still have old settings in memory (if it's running)
- Restarting it forces it to reload settings from the registry
- This makes notification changes take effect immediately

**Note**: If ShellExperienceHost is not running, that's perfectly normal! Windows starts it on-demand when you:
- Open the Start menu
- Open Action Center (Win + A)
- Open Windows Settings
- Receive a notification

When it starts, it will automatically load the new settings from the registry.

## Troubleshooting

### If ShellExperienceHost doesn't restart automatically:
1. Wait 5-10 seconds (it may take a moment)
2. Try opening the Start menu or Action Center (this triggers it to start)
3. Restart your computer if it still doesn't work

### If you get "Access Denied" error:
- You may need to run PowerShell/Command Prompt as Administrator
- Right-click → "Run as administrator"

### If notifications still don't work after restart:
1. Check Windows Settings → System → Notifications
2. Verify Focus Assist is set correctly
3. Try restarting your computer
4. Check if Windows updates are pending

## Notes

- **Safe to restart**: ShellExperienceHost is designed to be restarted. Windows will automatically restart it.
- **No data loss**: Restarting it won't cause any data loss or system issues.
- **Temporary**: The process will restart automatically, so you don't need to worry about breaking anything.

