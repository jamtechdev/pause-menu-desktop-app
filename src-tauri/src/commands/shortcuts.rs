use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use std::sync::Mutex;

// Store registered number key shortcuts (currently unused - number keys handled via JavaScript)
static NUMBER_KEY_SHORTCUTS: Mutex<Vec<Shortcut>> = Mutex::new(Vec::new());

#[tauri::command]
pub async fn register_shortcut(
    app: tauri::AppHandle,
    shortcut_str: String,
) -> Result<(), String> {
    // Parse shortcut string (e.g., "Super+Space" -> Modifiers::SUPER + Code::Space)
    // For now, we'll implement a simple parser
    let parts: Vec<&str> = shortcut_str.split('+').collect();
    
    if parts.len() < 2 {
        return Err("Invalid shortcut format. Use format like 'Super+Space'".to_string());
    }

    let modifier = match parts[0].trim() {
        "Super" | "Win" | "Meta" => Modifiers::SUPER,
        "Ctrl" | "Control" => Modifiers::CONTROL,
        "Alt" => Modifiers::ALT,
        "Shift" => Modifiers::SHIFT,
        _ => return Err(format!("Unknown modifier: {}", parts[0])),
    };

    let code = match parts[1].trim() {
        "Space" => Code::Space,
        "Enter" => Code::Enter,
        "Escape" => Code::Escape,
        _ => return Err(format!("Unknown key: {}", parts[1])),
    };

    let shortcut = Shortcut::new(Some(modifier), code);
    app.global_shortcut()
        .register(shortcut)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Register arrow keys as global shortcuts for navigation
#[tauri::command]
pub async fn register_arrow_key_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    
    // Register arrow keys with Alt modifier (Alt+Arrow) - Windows requires modifiers for global shortcuts
    let arrow_keys = vec![
        (Code::ArrowUp, "Alt+ArrowUp"),
        (Code::ArrowDown, "Alt+ArrowDown"),
        (Code::ArrowLeft, "Alt+ArrowLeft"),
        (Code::ArrowRight, "Alt+ArrowRight"),
    ];
    
    let mut success_count = 0;
    for (code, name) in arrow_keys {
        // Try with Alt modifier first
        let shortcut = Shortcut::new(Some(Modifiers::ALT), code);
        match global_shortcut.register(shortcut) {
            Ok(_) => {
                success_count += 1;
                println!("✓ Registered {} global shortcut", name);
            }
            Err(e) => {
                eprintln!("⚠ Failed to register {}: {}", name, e);
                // Try without modifier as fallback
                let shortcut_no_mod = Shortcut::new(None, code);
                if let Ok(_) = global_shortcut.register(shortcut_no_mod) {
                    success_count += 1;
                    println!("✓ Registered {} global shortcut (no modifier)", name);
                }
            }
        }
    }
    
    if success_count > 0 {
        println!("✓ Successfully registered {} arrow key shortcuts", success_count);
        Ok(())
    } else {
        Err("Failed to register any arrow key shortcuts".to_string())
    }
}

/// Unregister arrow key shortcuts
#[tauri::command]
pub async fn unregister_arrow_key_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    
    let arrow_keys = vec![
        (Code::ArrowUp, "Alt+ArrowUp"),
        (Code::ArrowDown, "Alt+ArrowDown"),
        (Code::ArrowLeft, "Alt+ArrowLeft"),
        (Code::ArrowRight, "Alt+ArrowRight"),
    ];
    
    for (code, name) in arrow_keys {
        // Try to unregister with Alt modifier
        let shortcut = Shortcut::new(Some(Modifiers::ALT), code);
        match global_shortcut.unregister(shortcut) {
            Ok(_) => {
                println!("✓ Unregistered {} global shortcut", name);
            }
            Err(_) => {
                // Try without modifier
                let shortcut_no_mod = Shortcut::new(None, code);
                let _ = global_shortcut.unregister(shortcut_no_mod);
            }
        }
    }
    
    println!("✓ Unregistered all arrow key shortcuts");
    Ok(())
}

/// Register number keys (1-7) as global shortcuts for screen navigation
#[tauri::command]
pub async fn register_number_key_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    let mut registered = NUMBER_KEY_SHORTCUTS.lock().unwrap();
    
    // Clear any existing shortcuts
    for shortcut in registered.iter() {
        let _ = global_shortcut.unregister(shortcut.clone());
    }
    registered.clear();
    
    // Register Alt+number shortcuts (Alt+1 through Alt+7) for screen navigation
    // Using Alt modifier to avoid conflicts with Windows system shortcuts
    let number_keys = vec![
        (Code::Digit1, 1),
        (Code::Digit2, 2),
        (Code::Digit3, 3),
        (Code::Digit4, 4),
        (Code::Digit5, 5),
        (Code::Digit6, 6),
        (Code::Digit7, 7),
    ];
    
    let mut success_count = 0;
    for (code, screen_num) in number_keys {
        // Register with Alt modifier (Alt+1, Alt+2, etc.)
        let shortcut = Shortcut::new(Some(Modifiers::ALT), code);
        match global_shortcut.register(shortcut.clone()) {
            Ok(_) => {
                registered.push(shortcut);
                success_count += 1;
                println!("✓ Registered Alt+{} shortcut for screen {}", screen_num, screen_num);
            }
            Err(e) => {
                eprintln!("⚠ Failed to register Alt+{}: {}", screen_num, e);
            }
        }
    }
    
    if success_count > 0 {
        println!("✓ Successfully registered {} number key shortcuts (Alt+1 to Alt+7)", success_count);
    } else {
        return Err("Failed to register any number key shortcuts".to_string());
    }
    
    Ok(())
}

/// Unregister number key shortcuts
#[tauri::command]
pub async fn unregister_number_key_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    let mut registered = NUMBER_KEY_SHORTCUTS.lock().unwrap();
    
    for shortcut in registered.iter() {
        let _ = global_shortcut.unregister(shortcut.clone());
    }
    registered.clear();
    
    println!("✓ Unregistered all number key shortcuts");
    Ok(())
}

// Store registered system shortcut blockers
static SYSTEM_SHORTCUT_BLOCKERS: Mutex<Vec<Shortcut>> = Mutex::new(Vec::new());

/// Register Escape key as global shortcut to close overlay
#[tauri::command]
pub async fn register_escape_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    
    // Try Escape with Ctrl modifier (Ctrl+Escape) - Windows often requires modifiers
    let escape_shortcuts = vec![
        (Some(Modifiers::CONTROL), Code::Escape, "Ctrl+Escape"),
        (None, Code::Escape, "Escape"),
    ];
    
    for (modifier, code, name) in escape_shortcuts {
        let shortcut = Shortcut::new(modifier, code);
        match global_shortcut.register(shortcut) {
            Ok(_) => {
                println!("✓ Registered {} global shortcut", name);
                return Ok(());
            }
            Err(e) => {
                eprintln!("⚠ Failed to register {}: {}", name, e);
                // Try next option
            }
        }
    }
    
    Err("Failed to register Escape shortcut with any modifier".to_string())
}

/// Unregister Escape key global shortcut
#[tauri::command]
pub async fn unregister_escape_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    
    // Try to unregister both Ctrl+Escape and Escape
    let escape_shortcuts = vec![
        (Some(Modifiers::CONTROL), Code::Escape, "Ctrl+Escape"),
        (None, Code::Escape, "Escape"),
    ];
    
    for (modifier, code, name) in escape_shortcuts {
        let shortcut = Shortcut::new(modifier, code);
        match global_shortcut.unregister(shortcut) {
            Ok(_) => {
                println!("✓ Unregistered {} global shortcut", name);
            }
            Err(_) => {
                // Ignore errors - shortcut might not be registered
            }
        }
    }
    
    Ok(())
}

/// Register shortcuts to block Windows system shortcuts when overlay is visible
#[tauri::command]
pub async fn block_windows_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    let mut registered = SYSTEM_SHORTCUT_BLOCKERS.lock().unwrap();
    
    // Clear any existing blockers
    for shortcut in registered.iter() {
        let _ = global_shortcut.unregister(shortcut.clone());
    }
    registered.clear();
    
    // Block Windows system shortcuts that trigger modals
    // Note: Win key alone is tricky - we'll try multiple approaches
    let shortcuts_to_block = vec![
        // Try Win key alone with different approaches
        (None, Code::MetaLeft, "Win key (left)"),
        (None, Code::MetaRight, "Win key (right)"),
        (Some(Modifiers::SUPER), Code::MetaLeft, "Win+MetaLeft"),
        (Some(Modifiers::SUPER), Code::MetaRight, "Win+MetaRight"),
        // Win+A (opens Quick Settings/Action Center)
        (Some(Modifiers::SUPER), Code::KeyA, "Win+A (Quick Settings)"),
        // Win+I (opens Settings)
        (Some(Modifiers::SUPER), Code::KeyI, "Win+I (Settings)"),
        // Win+X (opens Power User Menu)
        (Some(Modifiers::SUPER), Code::KeyX, "Win+X (Power Menu)"),
        // Win+K (opens Cast/Connect)
        (Some(Modifiers::SUPER), Code::KeyK, "Win+K (Cast)"),
        // Win+N (opens Notification Center)
        (Some(Modifiers::SUPER), Code::KeyN, "Win+N (Notifications)"),
        // Win+S (opens Search)
        (Some(Modifiers::SUPER), Code::KeyS, "Win+S (Search)"),
        // Win+T (opens Taskbar)
        (Some(Modifiers::SUPER), Code::KeyT, "Win+T (Taskbar)"),
    ];
    
    let mut success_count = 0;
    for (modifier, code, name) in shortcuts_to_block {
        let shortcut = Shortcut::new(modifier, code);
        match global_shortcut.register(shortcut.clone()) {
            Ok(_) => {
                registered.push(shortcut);
                success_count += 1;
                println!("✓ Blocked {} shortcut", name);
            }
            Err(e) => {
                eprintln!("⚠ Failed to block {}: {}", name, e);
            }
        }
    }
    
    if success_count > 0 {
        println!("✓ Successfully blocked {} Windows system shortcuts", success_count);
    } else {
        return Err("Failed to block any Windows system shortcuts".to_string());
    }
    
    Ok(())
}

/// Unregister Windows system shortcut blockers
#[tauri::command]
pub async fn unblock_windows_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();
    let mut registered = SYSTEM_SHORTCUT_BLOCKERS.lock().unwrap();
    
    for shortcut in registered.iter() {
        let _ = global_shortcut.unregister(shortcut.clone());
    }
    registered.clear();
    
    println!("✓ Unblocked all Windows system shortcuts");
    Ok(())
}

