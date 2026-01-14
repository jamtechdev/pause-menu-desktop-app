use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Open documents viewer window
#[tauri::command]
pub async fn open_documents_viewer(app: AppHandle) -> Result<(), String> {
    println!("[Documents] Opening documents viewer window...");

    // Check if window already exists and focus it
    if let Some(existing) = app.get_webview_window("documents_viewer") {
        println!("[Documents] Window already exists, focusing...");
        let _ = existing.set_focus();
        return Ok(());
    }

    // Create the documents viewer window
    let url = WebviewUrl::External(
        "http://localhost:3000/".parse()
            .map_err(|e| format!("Invalid URL: {}", e))?
    );

    match WebviewWindowBuilder::new(
        &app,
        "documents_viewer",
        url
    )
    .title("Uploaded Documents - LetMeSell")
    .inner_size(1000.0, 700.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(true)
    .always_on_top(false)
    .visible(true)
    .build() {
        Ok(window) => {
            println!("[Documents] ✓ Documents viewer window created");
            // Center the window
            if let Err(e) = window.center() {
                eprintln!("[Documents] Warning: Failed to center window: {}", e);
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("[Documents] ✗ Failed to create documents viewer window: {}", e);
            Err(format!("Failed to open documents viewer: {}", e))
        }
    }
}

/// Get list of uploaded documents
#[tauri::command]
pub async fn get_uploaded_documents() -> Result<Vec<serde_json::Value>, String> {
    use reqwest;
    
    let api_url = "http://localhost:3000/files";
    
    let client = reqwest::Client::new();
    let response = client
        .get(api_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch documents: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch documents: {}", response.status()));
    }
    
    let json: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    if let Some(files) = json.get("files").and_then(|f| f.as_array()) {
        Ok(files.clone())
    } else {
        Ok(Vec::new())
    }
}

/// Open a document in a new window
#[tauri::command]
pub async fn open_document(app: AppHandle, document_url: String, title: String) -> Result<(), String> {
    println!("[Documents] Opening document: {} - {}", title, document_url);
    
    // Create a unique window label
    let window_label = format!("document_{}", chrono::Utc::now().timestamp_millis());
    
    let url_parsed = document_url.parse::<url::Url>()
        .map_err(|e| format!("Invalid URL: {}", e))?;
    
    match WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::External(url_parsed)
    )
    .title(&title)
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(true)
    .always_on_top(false)
    .visible(true)
    .build() {
        Ok(window) => {
            println!("[Documents] ✓ Document window created: {}", window_label);
            if let Err(e) = window.center() {
                eprintln!("[Documents] Warning: Failed to center window: {}", e);
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("[Documents] ✗ Failed to create document window: {}", e);
            Err(format!("Failed to open document: {}", e))
        }
    }
}

