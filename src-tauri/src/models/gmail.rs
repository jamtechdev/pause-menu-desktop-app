use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailDraft {
    pub id: String,
    #[serde(default)]
    pub message: Option<GmailMessage>, // Optional because list response might not include full message
    #[serde(default)]
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailMessage {
    pub id: String,
    #[serde(rename = "threadId", default)]
    pub thread_id: String, // Can be empty in some responses
    #[serde(default)]
    pub label_ids: Vec<String>,
    #[serde(default)]
    pub snippet: Option<String>,
    #[serde(default)]
    pub payload: Option<GmailMessagePart>,
    #[serde(default)]
    pub size_estimate: Option<u64>,
    #[serde(default)]
    pub history_id: Option<String>,
    #[serde(default)]
    pub internal_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailMessagePart {
    pub part_id: Option<String>,
    pub mime_type: Option<String>,
    pub filename: Option<String>,
    pub headers: Vec<GmailHeader>,
    pub body: Option<GmailMessageBody>,
    pub parts: Option<Vec<GmailMessagePart>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailHeader {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailMessageBody {
    pub attachment_id: Option<String>,
    pub size: Option<u32>,
    pub data: Option<String>, // Base64 encoded
}

// Draft list item (simplified structure from drafts.list)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailDraftListItem {
    pub id: String,
    pub message: GmailDraftMessageRef, // Simplified message reference
}

// Simplified message reference in draft list (only has id and threadId)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailDraftMessageRef {
    pub id: String,
    #[serde(rename = "threadId")]
    pub thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailDraftListResponse {
    pub drafts: Vec<GmailDraftListItem>, // Use simplified list item
    pub next_page_token: Option<String>,
    pub result_size_estimate: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendEmailRequest {
    pub to: String,
    pub subject: String,
    pub body: String,
    pub reply_to_message_id: Option<String>, // If replying to an email
    pub thread_id: Option<String>, // If replying to an email
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendEmailResponse {
    pub id: String,
    pub thread_id: String,
    pub label_ids: Vec<String>,
}

