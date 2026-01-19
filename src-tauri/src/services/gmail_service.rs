use crate::models::gmail::*;
use crate::services::calendar_service::{CalendarProvider, CalendarService, TokenData};
use reqwest::Client;
use serde_json::json;
use base64::{Engine, engine::general_purpose};

pub struct GmailService;

impl GmailService {
    /// Get OAuth token for Google (reuse from calendar service)
    async fn get_token() -> Result<TokenData, String> {
        CalendarService::get_token(CalendarProvider::Google).await
    }

    /// List all Gmail drafts
    pub async fn list_drafts() -> Result<Vec<GmailDraft>, String> {
        println!("[Gmail] list_drafts called");
        let token_data = match Self::get_token().await {
            Ok(token) => {
                println!("[Gmail] ✓ Token retrieved successfully");
                token
            }
            Err(e) => {
                eprintln!("[Gmail] ✗ Failed to get token: {}", e);
                return Err(format!("Failed to get OAuth token: {}. Please re-authenticate with Gmail scopes.", e));
            }
        };
        
        let client = Client::new();
        let url = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
        
        println!("[Gmail] Fetching drafts from: {}", url);
        let response = client
            .get(url)
            .header("Authorization", format!("Bearer {}", token_data.access_token))
            .send()
            .await
            .map_err(|e| {
                eprintln!("[Gmail] ✗ Network error: {}", e);
                format!("Failed to fetch drafts: {}", e)
            })?;

        let status = response.status();
        println!("[Gmail] Response status: {}", status);
        
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            eprintln!("[Gmail] ✗ API error: {} - {}", status, error_text);
            
            // Provide helpful error message
            if status.as_u16() == 401 || status.as_u16() == 403 {
                return Err(format!("Gmail API authentication error ({}): {}. Please re-authenticate with Gmail scopes enabled.", status, error_text));
            }
            return Err(format!("Gmail API error: {} - {}", status, error_text));
        }

        let draft_list: GmailDraftListResponse = response
            .json()
            .await
            .map_err(|e| {
                eprintln!("[Gmail] ✗ Failed to parse response: {}", e);
                format!("Failed to parse drafts response: {}", e)
            })?;

        println!("[Gmail] Found {} drafts in list", draft_list.drafts.len());

        // Fetch full draft details for each draft
        let mut full_drafts = Vec::new();
        for draft_item in draft_list.drafts {
            println!("[Gmail] Fetching full details for draft: {}", draft_item.id);
            match Self::get_draft(&draft_item.id).await {
                Ok(full_draft) => {
                    println!("[Gmail] ✓ Got full draft: {}", draft_item.id);
                    full_drafts.push(full_draft);
                }
                Err(e) => {
                    eprintln!("[Gmail] ✗ Failed to get draft {}: {}", draft_item.id, e);
                    // Create a minimal draft from the list item
                    let minimal_draft = GmailDraft {
                        id: draft_item.id.clone(),
                        message: Some(GmailMessage {
                            id: draft_item.message.id.clone(),
                            thread_id: draft_item.message.thread_id.clone(),
                            label_ids: vec![],
                            snippet: None,
                            payload: None,
                            size_estimate: None,
                            history_id: None,
                            internal_date: None,
                        }),
                        snippet: None,
                    };
                    full_drafts.push(minimal_draft);
                }
            }
        }

        println!("[Gmail] Returning {} full drafts", full_drafts.len());
        Ok(full_drafts)
    }

    /// Get a specific draft by ID
    pub async fn get_draft(draft_id: &str) -> Result<GmailDraft, String> {
        let token_data = Self::get_token().await?;
        let client = Client::new();

        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/drafts/{}", draft_id);
        
        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token_data.access_token))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch draft: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gmail API error: {} - {}", status, error_text));
        }

        // Get raw response text for debugging
        let response_text = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;
        
        println!("[Gmail] Raw draft response (first 500 chars): {}", 
                 &response_text.chars().take(500).collect::<String>());

        // Try to parse the response for debugging
        let draft: GmailDraft = serde_json::from_str(&response_text)
            .map_err(|e| {
                eprintln!("[Gmail] ✗ Failed to parse draft response: {}", e);
                eprintln!("[Gmail] Full response: {}", response_text);
                format!("Failed to parse draft response: {}. Response: {}", e, &response_text.chars().take(200).collect::<String>())
            })?;

        println!("[Gmail] ✓ Parsed draft successfully: id={}, has_message={}", 
                 draft.id, draft.message.is_some());
        Ok(draft)
    }
    ///// ------------------------------------------------------------------------------------------------ /////       
    /// Send an email
    pub async fn send_email(request: SendEmailRequest) -> Result<SendEmailResponse, String> {
        println!("[Gmail] send_email called");
        
        // Validate email address
        let to_email = request.to.trim();
        if to_email.is_empty() {
            return Err("Email address cannot be empty".to_string());
        }
        
        // Basic email validation
        if !to_email.contains('@') || !to_email.contains('.') {
            return Err(format!("Invalid email address format: '{}'. Please provide a valid email address.", to_email));
        }
        
        // Check for common invalid patterns
        if to_email.starts_with('<') || to_email.ends_with('>') {
            return Err(format!("Invalid email address format: '{}'. Email should not contain angle brackets. Use format: email@example.com", to_email));
        }
        
        let token_data = match Self::get_token().await {
            Ok(token) => {
                println!("[Gmail] ✓ Token retrieved successfully");
                token
            }
            Err(e) => {
                eprintln!("[Gmail] ✗ Failed to get token: {}", e);
                return Err(format!("Failed to get OAuth token: {}. Please re-authenticate.", e));
            }
        };
        
        let client = Client::new();

        // Build the email message in RFC 2822 format
        // Use only the email address, not display name
        let mut message = format!("To: {}\r\n", to_email);
        message.push_str(&format!("Subject: {}\r\n", request.subject));
        message.push_str("Content-Type: text/html; charset=utf-8\r\n");
        message.push_str("\r\n");
        message.push_str(&request.body);
        
        println!("[Gmail] Email message preview (first 200 chars): {}",
                 &message.chars().take(200).collect::<String>());

        // Encode message in base64url format (Gmail API requirement)
        let encoded_message = general_purpose::URL_SAFE_NO_PAD
            .encode(message.as_bytes());

        let mut payload = json!({
            "raw": encoded_message
        });

        // If replying, add threadId
        if let Some(thread_id) = request.thread_id {
            payload["threadId"] = json!(thread_id);
        }

        let url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
        
        println!("[Gmail] Sending email to: {}", request.to);
        let response = match client
            .post(url)
            .header("Authorization", format!("Bearer {}", token_data.access_token))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
        {
            Ok(resp) => {
                println!("[Gmail] ✓ Request sent successfully");
                resp
            }
            Err(e) => {
                eprintln!("[Gmail] ✗ Network error sending email: {}", e);
                return Err(format!("Failed to send email: {}", e));
            }
        };

        let status = response.status();
        println!("[Gmail] Response status: {}", status);
        
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            eprintln!("[Gmail] ✗ API error: {} - {}", status, error_text);
            return Err(format!("Gmail API error: {} - {}", status, error_text));
        }

        let response_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                eprintln!("[Gmail] ✗ Failed to read response: {}", e);
                return Err(format!("Failed to read response: {}", e));
            }
        };

        let sent_message: GmailMessage = match serde_json::from_str::<GmailMessage>(&response_text) {
            Ok(msg) => {
                println!("[Gmail] ✓ Email sent successfully, message ID: {}", msg.id);
                msg
            }
            Err(e) => {
                eprintln!("[Gmail] ✗ Failed to parse response: {}", e);
                eprintln!("[Gmail] Response text: {}", response_text);
                return Err(format!("Failed to parse send response: {}", e));
            }
        };

        Ok(SendEmailResponse {
            id: sent_message.id,
            thread_id: sent_message.thread_id,
            label_ids: sent_message.label_ids,
        })
    }

    /// Reply to an email
    pub async fn reply_to_email(
        message_id: &str,
        to: &str,
        subject: &str,
        body: &str,
    ) -> Result<SendEmailResponse, String> {
        // First, get the original message to get thread_id
        let token_data = Self::get_token().await?;
        let client = Client::new();

        let get_url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}", message_id);
        
        let response = client
            .get(&get_url)
            .header("Authorization", format!("Bearer {}", token_data.access_token))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch message: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gmail API error: {} - {}", status, error_text));
        }

        let original_message: GmailMessage = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse message response: {}", e))?;

        // Build reply message
        let mut reply_message = format!("To: {}\r\n", to);
        reply_message.push_str(&format!("Subject: Re: {}\r\n", subject));
        reply_message.push_str("Content-Type: text/html; charset=utf-8\r\n");
        reply_message.push_str("\r\n");
        reply_message.push_str(&body);

        // Encode message
        let encoded_message = general_purpose::URL_SAFE_NO_PAD
            .encode(reply_message.as_bytes());

        let payload = json!({
            "raw": encoded_message,
            "threadId": original_message.thread_id.clone()
        });

        let send_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
        
        let response = client
            .post(send_url)
            .header("Authorization", format!("Bearer {}", token_data.access_token))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Failed to send reply: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gmail API error: {} - {}", status, error_text));
        }

        let sent_message: GmailMessage = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse send response: {}", e))?;

        Ok(SendEmailResponse {
            id: sent_message.id,
            thread_id: sent_message.thread_id,
            label_ids: sent_message.label_ids,
        })
    }

    /// Extract email address from draft headers
    pub fn extract_to_from_draft(draft: &GmailDraft) -> Option<String> {
        if let Some(ref message) = draft.message {
            if let Some(ref payload) = message.payload {
                for header in &payload.headers {
                    if header.name.to_lowercase() == "to" {
                        return Some(header.value.clone());
                    }
                }
            }
        }
        None
    }

    /// Extract subject from draft headers
    pub fn extract_subject_from_draft(draft: &GmailDraft) -> Option<String> {
        if let Some(ref message) = draft.message {
            if let Some(ref payload) = message.payload {
                for header in &payload.headers {
                    if header.name.to_lowercase() == "subject" {
                        return Some(header.value.clone());
                    }
                }
            }
        }
        None
    }

    /// Extract body from draft
    pub fn extract_body_from_draft(draft: &GmailDraft) -> Option<String> {
        if let Some(ref message) = draft.message {
            if let Some(ref payload) = message.payload {
                // Check if body is in the main payload
                if let Some(ref body) = payload.body {
                    if let Some(ref data) = body.data {
                        if let Ok(decoded) = general_purpose::URL_SAFE_NO_PAD.decode(data) {
                            if let Ok(text) = String::from_utf8(decoded) {
                                return Some(text);
                            }
                        }
                    }
                }

                // Check parts for body
                if let Some(ref parts) = payload.parts {
                    for part in parts {
                        if let Some(ref body) = part.body {
                            if let Some(ref data) = body.data {
                                if let Ok(decoded) = general_purpose::URL_SAFE_NO_PAD.decode(data) {
                                    if let Ok(text) = String::from_utf8(decoded) {
                                        return Some(text);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    /// Delete a draft by ID
    pub async fn delete_draft(draft_id: &str) -> Result<(), String> {
        let token_data = Self::get_token().await?;
        let client = Client::new();

        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/drafts/{}", draft_id);
        
        let response = client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", token_data.access_token))
            .send()
            .await
            .map_err(|e| format!("Failed to delete draft: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gmail API error: {} - {}", status, error_text));
        }

        println!("[Gmail] ✓ Draft deleted successfully: {}", draft_id);
        Ok(())
    }
}
