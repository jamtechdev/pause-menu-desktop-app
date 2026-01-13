# Pause Menu

A productivity overlay application built with Tauri, React, and TypeScript.

## Phase 1: Project Setup & Foundation ✅

## Phase 2.1: Global Keyboard Shortcut ✅

### Implementation Status:
- ✅ Global shortcut registration (tries Win+Space, Ctrl+Space, Win+O)
- ✅ Window toggle functionality
- ✅ Frontend event handling
- ✅ Escape key support for closing overlay
- ✅ **Working shortcut: Ctrl+Space** (tested and confirmed)

### Usage:
- Press **Ctrl+Space** to toggle overlay (primary shortcut)
- Press **Win+Space** (if available, may conflict with Windows)
- Press **Win+O** (fallback option)
- Press **Escape** to close overlay
- Click "Toggle Overlay (Test)" button for manual testing

### Features:
- ✅ Works from any application
- ✅ Works in fullscreen mode
- ✅ Works across multiple monitors
- ✅ Emits event to frontend when triggered
- ✅ Graceful error handling (app doesn't crash if shortcuts fail)

## Phase 1: Project Setup & Foundation ✅

### Development Environment
- ✅ Rust toolchain (rustup) - Installed
- ✅ Visual C++ Build Tools - Installed
- ✅ Git - Installed
- ✅ Node.js 18+ LTS - Installed (v22.19.0)
- ✅ Cursor IDE with extensions (recommended):
  - rust-analyzer extension
  - Tauri extension
  - CodeLLDB extension (debugging)

### Project Structure

```
pause-menu/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/              # React components
│   │   ├── Overlay.tsx           # Main overlay container
│   │   ├── Dimmer.tsx            # Screen dimming component
│   │   ├── screens/              # Four main screens
│   │   │   ├── Continue.tsx     # Screen 1: Continue
│   │   │   ├── Do.tsx            # Screen 2: Do
│   │   │   ├── Jump.tsx         # Screen 3: Jump
│   │   │   └── Focus.tsx         # Screen 4: Focus
│   │   ├── navigation/           # Navigation components
│   │   │   ├── ScreenSwitcher.tsx
│   │   │   └── KeyboardNav.tsx
│   │   └── common/               # Shared components
│   │       ├── WindowItem.tsx    # Window list item
│   │       ├── ActionItem.tsx    # Action suggestion item
│   │       ├── AppLauncher.tsx   # App launcher item
│   │       └── FocusTimer.tsx    # Focus mode timer
│   ├── services/                 # Frontend services
│   │   ├── api.ts                # Backend API client
│   │   ├── auth.ts               # Authentication service
│   │   └── subscription.ts       # Subscription service
│   ├── hooks/                    # React hooks
│   │   ├── useWindows.ts         # Window tracking hook
│   │   ├── useShortcut.ts        # Global shortcut hook
│   │   ├── useCalendar.ts        # Calendar integration hook
│   │   └── useFocus.ts           # Focus mode hook
│   ├── styles/                   # CSS files
│   │   ├── overlay.css           # Overlay styles
│   │   ├── screens.css           # Screen-specific styles
│   │   └── animations.css        # Transitions & animations
│   ├── utils/                    # Utility functions
│   │   ├── windowUtils.ts        # Window manipulation utils
│   │   ├── fileUtils.ts          # File operations utils
│   │   └── timeUtils.ts         # Time formatting utils
│   ├── App.tsx                   # Main React app
│   └── main.tsx                  # React entry point
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── lib.rs                # Library entry point
│   │   ├── commands/             # Tauri commands (Rust functions)
│   │   │   ├── mod.rs
│   │   │   ├── windows.rs        # Window tracking commands
│   │   │   ├── shortcuts.rs      # Global shortcut commands
│   │   │   ├── overlay.rs        # Overlay control commands
│   │   │   ├── files.rs           # File tracking commands
│   │   │   ├── calendar.rs       # Calendar integration
│   │   │   ├── focus.rs           # Focus mode commands
│   │   │   └── launch.rs          # App/file launching
│   │   ├── services/             # Rust services
│   │   │   ├── mod.rs
│   │   │   ├── window_tracker.rs # Window enumeration service
│   │   │   ├── file_tracker.rs   # Recent files tracking
│   │   │   ├── shortcut_manager.rs # Global shortcut manager
│   │   │   ├── overlay_manager.rs # Overlay window manager
│   │   │   ├── calendar_service.rs # Calendar API client
│   │   │   └── focus_service.rs   # Focus mode service
│   │   ├── models/               # Data models
│   │   │   ├── mod.rs
│   │   │   ├── window.rs          # Window data structure
│   │   │   ├── file.rs            # File data structure
│   │   │   └── action.rs          # Action suggestion model
│   │   └── utils/                # Rust utilities
│   │       ├── mod.rs
│   │       └── windows_api.rs     # Windows API wrappers
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── public/                        # Static assets
│   ├── icons/                    # App icons
│   └── images/                   # Images
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
└── README.md                     # Project documentation
```

### Dependencies

**Frontend:**
- React 18.2.0
- TypeScript 5.3.0
- @tauri-apps/api 2.x
- @tauri-apps/plugin-global-shortcut 2.x
- @tauri-apps/plugin-shell 2.x
- axios 1.6.0
- date-fns 2.30.0
- zustand 4.4.0

**Backend (Rust):**
- tauri 2.x
- tauri-plugin-global-shortcut 2.x
- tauri-plugin-shell 2.x
- windows 0.52 (Windows API bindings)
- serde & serde_json
- reqwest 0.11
- tokio 1.35
- chrono 0.4
- dirs 5.0
- notify 6.0

## Development

### Running the Application

```bash
npm run tauri dev
```

### Building

```bash
npm run tauri build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Next Steps

Phase 1 is complete. Ready to proceed with Phase 2 implementation.
