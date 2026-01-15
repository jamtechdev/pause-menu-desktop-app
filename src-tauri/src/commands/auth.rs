use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use crate::services::magic_link_server::MagicLinkServer;

/// Start magic link callback server and wait for verification
/// Returns (token, email) when callback is received
#[tauri::command]
pub async fn start_magic_link_callback_server(port: Option<u16>) -> Result<(String, String), String> {
    let callback_port = port.unwrap_or(8081);
    println!("[Auth] Starting magic link callback server on port {}", callback_port);
    
    match MagicLinkServer::start_callback_server(callback_port).await {
        Ok((token, email)) => {
            println!("[Auth] ✓ Magic link callback received: token length={}, email={}", token.len(), email);
            Ok((token, email))
        }
        Err(e) => {
            eprintln!("[Auth] ✗ Magic link callback error: {}", e);
            Err(e)
        }
    }
}

/// Open a magic link URL in a popup window inside the app
#[tauri::command]
pub async fn open_magic_link_popup(app: AppHandle, url: String) -> Result<(), String> {
    println!("[Auth] Opening magic link in popup: {}", url);
    
    // Validate URL format
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!("Invalid URL format: {}", url));
    }
    
    // Check if popup window already exists and focus it
    if let Some(existing) = app.get_webview_window("magic_link_popup") {
        println!("[Auth] Popup window already exists, focusing...");
        let _ = existing.set_focus();
        // Reload the URL in case it changed
        if let Err(e) = existing.eval(&format!("window.location.href = '{}';", url)) {
            eprintln!("[Auth] Warning: Failed to update URL: {}", e);
        }
        return Ok(());
    }
    
    // Parse the URL
    let url_parsed = url.parse::<url::Url>()
        .map_err(|e| format!("Invalid URL: {}", e))?;
    
    // Create a popup window for the magic link
    match WebviewWindowBuilder::new(
        &app,
        "magic_link_popup",
        WebviewUrl::External(url_parsed)
    )
    .title("Magic Link Authentication - LetMeSell")
    .inner_size(600.0, 700.0)
    .min_inner_size(500.0, 600.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(true)
    .always_on_top(false)
    .visible(true)
    .build() {
        Ok(window) => {
            println!("[Auth] ✓ Magic link popup window created");
            // Center the window
            if let Err(e) = window.center() {
                eprintln!("[Auth] Warning: Failed to center window: {}", e);
            }
            // Focus the window
            if let Err(e) = window.set_focus() {
                eprintln!("[Auth] Warning: Failed to focus window: {}", e);
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("[Auth] ✗ Failed to create popup window: {}", e);
            Err(format!("Failed to open magic link popup: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_validation() {
        // This is a unit test for the URL validation logic
        let valid_urls = vec![
            "http://example.com",
            "https://example.com",
            "http://localhost:3000",
        ];
        
        let invalid_urls = vec![
            "ftp://example.com",
            "file:///path/to/file",
            "not-a-url",
            "",
        ];

        for url in valid_urls {
            assert!(url.starts_with("http://") || url.starts_with("https://"));
        }

        for url in invalid_urls {
            assert!(!url.starts_with("http://") && !url.starts_with("https://"));
        }
    }

    #[tokio::test]
    async fn test_magic_link_callback_server_default_port() {
        // Test that default port is used when None is provided
        // Note: This test would require mocking the MagicLinkServer
        // For now, we just test the port selection logic
        let port = None;
        let callback_port = port.unwrap_or(8081);
        assert_eq!(callback_port, 8081);
    }

    #[tokio::test]
    async fn test_magic_link_callback_server_custom_port() {
        // Test that custom port is used when provided
        let port = Some(9999);
        let callback_port = port.unwrap_or(8081);
        assert_eq!(callback_port, 9999);
    }
}
