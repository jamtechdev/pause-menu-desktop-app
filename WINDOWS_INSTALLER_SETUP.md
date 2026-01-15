# Windows Installer Setup - Pause Menu

## ✅ Configuration Complete

All Windows installer configurations have been set up in `src-tauri/tauri.conf.json`.

## 📦 Installer Features

### ✅ Configured Features

1. **NSIS Installer (.exe)**
   - ✅ Configured as primary installer format
   - ✅ Output: `pause-menu_1.0.0_x64_en-US.exe`

2. **Start Menu Shortcut**
   - ✅ Enabled by default in NSIS installer
   - ✅ Shortcut name: "Pause Menu" (configured in `shortcutName`)

3. **Desktop Shortcut**
   - ✅ Created automatically by NSIS installer
   - ✅ Users can choose during installation

4. **Uninstaller**
   - ✅ Included automatically with NSIS installer
   - ✅ Accessible via Windows Settings → Apps

5. **Auto-updater Support**
   - ⚠️ Requires additional Tauri updater plugin
   - Can be added later if needed

## 🔧 Build Configuration

### App Metadata
- **Product Name**: Pause Menu
- **Version**: 1.0.0
- **Identifier**: com.jamtech.pause-menu
- **Category**: Productivity
- **Copyright**: © 2026 JamTech. All rights reserved.

### Installer Options
- **Install Mode**: Per Machine (requires admin)
- **One-Click Install**: Disabled (shows installer UI)
- **Run After Finish**: Enabled (launches app after install)
- **Allow Downgrades**: Disabled
- **Allow Elevation**: Enabled (for per-machine install)
- **Delete App Data on Uninstall**: Disabled (preserves user data)

### Language Support
- **Primary Language**: English
- **Display Language Selector**: Enabled
- **Multi-language**: Can be extended later

## 🚀 Building the Installer

### Prerequisites
1. **Rust Toolchain**
   ```bash
   # Install Rust if not already installed
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Windows Build Tools** (Windows only)
   - Visual Studio Build Tools or Visual Studio Community
   - Windows SDK
   - NSIS (included with Tauri)

3. **Node.js and npm**
   - Already installed for frontend development

### Build Commands

#### Development Build
```bash
npm run tauri:dev
```

#### Production Build (Creates Installer)
```bash
npm run tauri:build
```

### Build Output

After running `npm run tauri:build`, the installer will be located at:

```
src-tauri/target/release/bundle/nsis/pause-menu_1.0.0_x64-setup.exe
```

The final installer name will be:
```
pause-menu_1.0.0_x64_en-US.exe
```

## 🔐 Code Signing (Optional)

### Current Status
- **Code Signing**: Not configured (certificateThumbprint: null)
- **Digest Algorithm**: SHA256 (configured)
- **Timestamp URL**: Not set

### To Enable Code Signing

1. **Obtain Code Signing Certificate**
   - Purchase from: DigiCert, Sectigo, GlobalSign, etc.
   - Or use self-signed for testing (not recommended for distribution)

2. **Install Certificate**
   - Install certificate in Windows Certificate Store
   - Note the certificate thumbprint

3. **Update Configuration**
   ```json
   "windows": {
     "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT_HERE",
     "timestampUrl": "http://timestamp.digicert.com"
   }
   ```

4. **Sign During Build**
   - Tauri will automatically sign the installer if certificate is configured

## 📋 Installation Experience

### User Flow
1. User downloads `pause-menu_1.0.0_x64_en-US.exe`
2. Double-clicks installer
3. Windows UAC prompt appears (for per-machine install)
4. User accepts and installer UI appears
5. User can choose:
   - Installation directory
   - Create desktop shortcut (default: yes)
   - Create start menu shortcut (default: yes)
6. Installation completes
7. App launches automatically (if "Run After Finish" is enabled)

### Uninstallation
- Users can uninstall via:
  - Windows Settings → Apps → Pause Menu → Uninstall
  - Control Panel → Programs and Features
  - Start Menu → Right-click → Uninstall

## 🔄 Auto-Updater Setup (Future)

To enable auto-updates, you'll need:

1. **Add Tauri Updater Plugin**
   ```bash
   npm install @tauri-apps/plugin-updater
   ```

2. **Configure Update Server**
   - Host update manifest and binaries
   - Update `tauri.conf.json` with updater configuration

3. **Implement Update Check**
   - Add update check logic in app
   - Handle update downloads and installation

## 📝 Notes

- **Install Mode**: Currently set to `perMachine` (requires admin)
  - Change to `perUser` if you want user-level installation
  - Per-user doesn't require admin rights

- **One-Click Install**: Disabled to show installer UI
  - Enable if you want silent installation

- **Icon**: Uses `icons/icon.ico` for installer
  - Ensure icon.ico exists and is properly formatted

## ✅ Checklist

- [x] Configure tauri.conf.json
- [x] Set app metadata
- [x] Configure installer options
- [x] NSIS installer (.exe)
- [x] Start Menu shortcut
- [x] Desktop shortcut
- [x] Uninstaller
- [ ] Code signing setup (optional)
- [ ] Auto-updater support (future)

## 🧪 Testing

1. **Build the installer**:
   ```bash
   npm run tauri:build
   ```

2. **Test installation**:
   - Run the generated .exe file
   - Verify shortcuts are created
   - Verify app launches after installation

3. **Test uninstallation**:
   - Uninstall via Windows Settings
   - Verify all files are removed
   - Verify shortcuts are removed

## 📚 Resources

- [Tauri Bundle Documentation](https://v2.tauri.app/plugin/bundler/)
- [NSIS Installer Options](https://v2.tauri.app/plugin/bundler/nsis/)
- [Code Signing Guide](https://v2.tauri.app/plugin/bundler/windows/#code-signing)

