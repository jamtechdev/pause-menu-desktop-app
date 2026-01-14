use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResponse {
    pub success: bool,
    pub message: String,
    pub url: Option<String>,
}

/// Upload a file to LetMeSell from file path
#[tauri::command]
pub async fn upload_file_to_letmesell(file_path: String) -> Result<UploadResponse, String> {
    println!("[Upload] Uploading file to LetMeSell: {}", file_path);
    
    // Validate file path - check if it looks like a valid path
    let path = PathBuf::from(&file_path);
    
    // Check if path contains invalid characters (like URLs converted to paths)
    if file_path.contains("http://") || file_path.contains("https://") || file_path.contains("--") {
        return Err(format!("Invalid file path. Please select a file from your computer."));
    }
    
    if !path.exists() {
        return Err(format!("File not found. Please make sure the file exists and try again."));
    }
    
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("notes")
        .to_string();
    
    // Read file contents
    let file_contents = std::fs::read(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    println!("[Upload] File size: {} bytes", file_contents.len());
    
    upload_file_bytes(file_contents, file_name, &path).await
}

/// Upload file bytes to LetMeSell
async fn upload_file_bytes(file_contents: Vec<u8>, file_name: String, path: &PathBuf) -> Result<UploadResponse, String> {
    // Get LetMeSell API endpoint from environment or use default (localhost for local development)
    let api_url = std::env::var("LETMESELL_API_URL")
        .unwrap_or_else(|_| "http://localhost:3000/upload".to_string());
    
    println!("[Upload] File size: {} bytes", file_contents.len());
    
    // Create multipart form
    let form = reqwest::multipart::Form::new()
        .text("type", "notes")
        .part(
            "file",
            reqwest::multipart::Part::bytes(file_contents)
                .file_name(file_name.clone())
                .mime_str(get_mime_type(path))
                .map_err(|e| format!("Failed to set MIME type: {}", e))?,
        );
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Upload file
    println!("[Upload] Sending request to: {}", api_url);
    let response = client
        .post(&api_url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            let error_msg = e.to_string();
            // Provide user-friendly error messages
            if error_msg.contains("dns error") || error_msg.contains("No such host") {
                format!("Cannot connect to LetMeSell server. Please check your internet connection or verify the API endpoint is correct.")
            } else if error_msg.contains("timeout") {
                format!("Upload timed out. Please try again.")
            } else if error_msg.contains("connection refused") || error_msg.contains("actively refused") {
                if api_url.contains("localhost") || api_url.contains("127.0.0.1") {
                    format!("Local API server is not running. Please start your local LetMeSell API server and try again.")
                } else {
                    format!("Connection refused. The LetMeSell server may be temporarily unavailable.")
                }
            } else {
                format!("Network error: {}", error_msg)
            }
        })?;
    
    let status = response.status();
    println!("[Upload] Response status: {}", status);
    
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("[Upload] ✗ Upload failed: {} - {}", status, error_text);
        return Err(format!("Upload failed: {} - {}", status, error_text));
    }
    
    // Parse response
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    println!("[Upload] ✓ Upload successful");
    println!("[Upload] Response: {}", response_text);
    
    // Try to parse as JSON, or return success message
    match serde_json::from_str::<UploadResponse>(&response_text) {
        Ok(resp) => Ok(resp),
        Err(_) => {
            // If not JSON, assume success
            Ok(UploadResponse {
                success: true,
                message: format!("{} uploaded successfully to LetMeSell!", file_name),
                url: None,
            })
        }
    }
}

/// Upload file from bytes (for frontend file picker)
#[tauri::command]
pub async fn upload_file_bytes_to_letmesell(file_bytes: Vec<u8>, file_name: String, mime_type: Option<String>) -> Result<UploadResponse, String> {
    println!("[Upload] Uploading file bytes to LetMeSell: {} ({} bytes)", file_name, file_bytes.len());
    
    // Get LetMeSell API endpoint from environment or use default (localhost for local development)
    let api_url = std::env::var("LETMESELL_API_URL")
        .unwrap_or_else(|_| "http://localhost:3000/upload".to_string());
    
    // Determine MIME type
    let mime = mime_type.unwrap_or_else(|| {
        let ext = PathBuf::from(&file_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        match ext.as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "png" => "image/png",
            "pdf" => "application/pdf",
            "txt" => "text/plain",
            "md" => "text/markdown",
            "doc" => "application/msword",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "rtf" => "application/rtf",
            _ => "application/octet-stream",
        }.to_string()
    });
    
    // Create multipart form
    let form = reqwest::multipart::Form::new()
        .text("type", "notes")
        .part(
            "file",
            reqwest::multipart::Part::bytes(file_bytes)
                .file_name(file_name.clone())
                .mime_str(&mime)
                .map_err(|e| format!("Failed to set MIME type: {}", e))?,
        );
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Upload file
    println!("[Upload] Sending request to: {}", api_url);
    let response = client
        .post(&api_url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            let error_msg = e.to_string();
            // Provide user-friendly error messages
            if error_msg.contains("dns error") || error_msg.contains("No such host") {
                format!("Cannot connect to LetMeSell server. Please check your internet connection or verify the API endpoint is correct.")
            } else if error_msg.contains("timeout") {
                format!("Upload timed out. Please try again.")
            } else if error_msg.contains("connection refused") || error_msg.contains("actively refused") {
                if api_url.contains("localhost") || api_url.contains("127.0.0.1") {
                    format!("Local API server is not running. Please start your local LetMeSell API server and try again.")
                } else {
                    format!("Connection refused. The LetMeSell server may be temporarily unavailable.")
                }
            } else {
                format!("Network error: {}", error_msg)
            }
        })?;
    
    let status = response.status();
    println!("[Upload] Response status: {}", status);
    
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("[Upload] ✗ Upload failed: {} - {}", status, error_text);
        return Err(format!("Upload failed: {} - {}", status, error_text));
    }
    
    // Parse response
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    println!("[Upload] ✓ Upload successful");
    println!("[Upload] Response: {}", response_text);
    
    // Try to parse as JSON, or return success message
    match serde_json::from_str::<UploadResponse>(&response_text) {
        Ok(resp) => Ok(resp),
        Err(_) => {
            // If not JSON, assume success
            Ok(UploadResponse {
                success: true,
                message: format!("{} uploaded successfully to LetMeSell!", file_name),
                url: None,
            })
        }
    }
}

/// Get MIME type from file extension
fn get_mime_type(path: &PathBuf) -> &str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "rtf" => "application/rtf",
        _ => "application/octet-stream",
    }
}

/// Open file picker to select note files for upload
#[tauri::command]
pub async fn pick_note_files() -> Result<Vec<String>, String> {
    // Tauri 2.x file picker would be handled via frontend
    // For now, return empty - frontend will handle file selection
    Ok(Vec::new())
}

