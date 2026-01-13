# How to Manually Disable Teams Notifications

## The Problem
Microsoft Teams sometimes bypasses Windows notification settings and uses its own notification system. Even when Windows notifications are disabled, Teams may still show notifications.

## Solution: Disable Notifications in Teams Settings

### Method 1: Teams Desktop App Settings

1. **Open Microsoft Teams**
   - Launch the Teams desktop application

2. **Go to Settings**
   - Click on your profile picture (top right)
   - Select **Settings** (or press `Ctrl + ,`)

3. **Navigate to Notifications**
   - In the left sidebar, click **Notifications**

4. **Disable All Notifications**
   - Under "Activity", set to **Off** or **Only show in feed**
   - Under "Chats", set to **Off** or **Only show in feed**
   - Under "Meetings", set to **Off** or **Only show in feed**
   - Turn off **Banner notifications**
   - Turn off **Sound notifications**

5. **Save Settings**
   - Settings are saved automatically

### Method 2: Teams Web Version Settings

If you're using Teams in a browser:

1. **Open Teams in Browser**
   - Go to https://teams.microsoft.com

2. **Go to Settings**
   - Click your profile picture (top right)
   - Select **Settings**

3. **Disable Notifications**
   - Go to **Notifications** section
   - Disable all notification types
   - Disable browser notifications if prompted

### Method 3: Windows Browser Notification Settings

If Teams is running in Edge/Chrome:

1. **Open Browser Settings**
   - In Edge: `Settings` → `Cookies and site permissions` → `Notifications`
   - In Chrome: `Settings` → `Privacy and security` → `Site settings` → `Notifications`

2. **Block Teams Notifications**
   - Find `teams.microsoft.com` or `web.teams.microsoft.com`
   - Set to **Block**

### Method 4: Registry Method (Advanced)

If the above methods don't work, you can try modifying Teams registry directly:

1. **Open Registry Editor**
   - Press `Win + R`
   - Type `regedit` and press Enter

2. **Navigate to Teams Registry**
   - Go to: `HKEY_CURRENT_USER\Software\Microsoft\Office\Teams`

3. **Create/Modify Values**
   - Create a DWORD value: `DisableNotifications` = `1`
   - Create a DWORD value: `DisableToastNotifications` = `1`

4. **Restart Teams**
   - Close and restart Teams for changes to take effect

## Why This Happens

Teams uses multiple notification systems:
- **Windows Toast Notifications** (can be blocked via registry)
- **Teams Internal Notifications** (must be disabled in Teams settings)
- **Browser Notifications** (if using web version)
- **Teams Desktop Notifications** (separate from Windows)

Our app blocks Windows notifications, but Teams' internal notification system needs to be disabled separately.

## Verification

After disabling notifications in Teams:
1. Ask someone to send you a test message
2. You should NOT see any notification popup
3. The message will still appear in Teams, but without notifications

## Note

Even with all these settings, some Teams notifications (like meeting reminders) might still appear. This is a limitation of how Teams handles notifications internally.

