use crate::models::gmail::{GmailDraft, SendEmailRequest, SendEmailResponse};
use crate::services::gmail_service::GmailService;

#[tauri::command]
pub async fn get_gmail_drafts() -> Result<Vec<GmailDraft>, String> {
    GmailService::list_drafts().await
}

#[tauri::command]
pub async fn get_gmail_draft(draft_id: String) -> Result<GmailDraft, String> {
    GmailService::get_draft(&draft_id).await
}

#[tauri::command]
pub async fn send_gmail_email(
    to: String,
    subject: String,
    body: String,
    reply_to_message_id: Option<String>,
    thread_id: Option<String>,
) -> Result<SendEmailResponse, String> {
    let request = SendEmailRequest {
        to,
        subject,
        body,
        reply_to_message_id,
        thread_id,
    };
    GmailService::send_email(request).await
}

#[tauri::command]
pub async fn reply_to_gmail_email(
    message_id: String,
    to: String,
    subject: String,
    body: String,
) -> Result<SendEmailResponse, String> {
    GmailService::reply_to_email(&message_id, &to, &subject, &body).await
}

#[tauri::command]
pub async fn delete_gmail_draft(draft_id: String) -> Result<(), String> {
    GmailService::delete_draft(&draft_id).await
}

