use crate::models::action::CalendarEvent;
use chrono::{DateTime, Utc, Duration, NaiveDate};
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration as TokioDuration};

// OAuth token storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

// Calendar provider type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CalendarProvider {
    Google,
    Microsoft,
}

// Google Calendar API response structures
#[derive(Debug, Deserialize)]
struct GoogleCalendarResponse {
    items: Vec<GoogleEvent>,
}

#[derive(Debug, Deserialize)]
struct GoogleEvent {
    id: String,
    summary: String,
    start: GoogleDateTime,
    end: GoogleDateTime,
    location: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleDateTime {
    #[serde(rename = "dateTime", default, deserialize_with = "deserialize_optional_rfc3339")]
    date_time: Option<DateTime<Utc>>,
    #[serde(default)]
    date: Option<String>, // For all-day events
}

fn deserialize_optional_rfc3339<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    // Try to deserialize as Option<String> first
    match Option::<String>::deserialize(deserializer) {
        Ok(Some(s)) => {
            // Parse the RFC3339 string
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| Some(dt.with_timezone(&Utc)))
                .map_err(serde::de::Error::custom)
        },
        Ok(None) => Ok(None),
        Err(_) => Ok(None), // Field missing or invalid - return None
    }
}

// Microsoft Graph API response structures
#[derive(Debug, Deserialize)]
struct MicrosoftGraphResponse {
    value: Vec<MicrosoftEvent>,
}

#[derive(Debug, Deserialize)]
struct MicrosoftEvent {
    id: String,
    subject: String,
    start: MicrosoftDateTime,
    end: MicrosoftDateTime,
    location: Option<MicrosoftLocation>,
    body: Option<MicrosoftBody>,
}

#[derive(Debug, Deserialize)]
struct MicrosoftDateTime {
    #[serde(deserialize_with = "deserialize_rfc3339")]
    date_time: DateTime<Utc>,
    time_zone: String,
}

fn deserialize_rfc3339<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s: String = String::deserialize(deserializer)?;
    DateTime::parse_from_rfc3339(&s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(serde::de::Error::custom)
}

#[derive(Debug, Deserialize)]
struct MicrosoftLocation {
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct MicrosoftBody {
    content: String,
    content_type: String,
}

pub struct CalendarService {
    google_client_id: Option<String>,
    google_client_secret: Option<String>,
    microsoft_client_id: Option<String>,
    microsoft_client_secret: Option<String>,
    http_client: Client,
    cached_events: Arc<RwLock<Vec<CalendarEvent>>>,
    last_fetch: Arc<RwLock<Option<DateTime<Utc>>>>,
    authenticated_providers: Arc<RwLock<HashMap<CalendarProvider, bool>>>,
}

impl CalendarService {
    pub fn new() -> Self {
        let google_client_id = std::env::var("GOOGLE_CLIENT_ID").ok();
        let google_client_secret = std::env::var("GOOGLE_CLIENT_SECRET").ok();
        
        // Debug: Log if credentials are loaded
        if google_client_id.is_some() {
            println!("[Calendar] ✓ GOOGLE_CLIENT_ID loaded");
        } else {
            eprintln!("[Calendar] ✗ GOOGLE_CLIENT_ID not found in environment");
        }
        
        if google_client_secret.is_some() {
            println!("[Calendar] ✓ GOOGLE_CLIENT_SECRET loaded");
        } else {
            eprintln!("[Calendar] ✗ GOOGLE_CLIENT_SECRET not found in environment");
        }
        
        Self {
            google_client_id,
            google_client_secret,
            microsoft_client_id: std::env::var("MICROSOFT_CLIENT_ID").ok(),
            microsoft_client_secret: std::env::var("MICROSOFT_CLIENT_SECRET").ok(),
            http_client: Client::new(),
            cached_events: Arc::new(RwLock::new(Vec::new())),
            last_fetch: Arc::new(RwLock::new(None)),
            authenticated_providers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Initialize the calendar service and start background fetching
    pub async fn initialize(&self) -> Result<(), String> {
        // Start background task to fetch events every 5 minutes
        let cached_events = Arc::clone(&self.cached_events);
        let last_fetch = Arc::clone(&self.last_fetch);
        let http_client = self.http_client.clone();
        let google_client_id = self.google_client_id.clone();
        let google_client_secret = self.google_client_secret.clone();
        let microsoft_client_id = self.microsoft_client_id.clone();
        let microsoft_client_secret = self.microsoft_client_secret.clone();

        tokio::spawn(async move {
            let mut interval = interval(TokioDuration::from_secs(300)); // 5 minutes
            interval.tick().await; // Skip first immediate tick

            loop {
                interval.tick().await;

                // Fetch from Google Calendar if authenticated
                if let (Some(client_id), Some(client_secret)) =
                    (google_client_id.as_ref(), google_client_secret.as_ref())
                {
                    if Self::is_authenticated(CalendarProvider::Google).await {
                        match Self::fetch_google_events_internal(
                            &http_client,
                            client_id,
                            client_secret,
                        )
                        .await
                        {
                            Ok(events) => {
                                let mut cached = cached_events.write().await;
                                // Remove old Google events and add new ones
                                cached.retain(|e| !e.id.starts_with("google_"));
                                cached.extend(events);
                            }
                            Err(e) => eprintln!("Error fetching Google Calendar events: {}", e),
                        }
                    }
                }

                // Fetch from Microsoft Graph if authenticated
                if let (Some(client_id), Some(client_secret)) =
                    (microsoft_client_id.as_ref(), microsoft_client_secret.as_ref())
                {
                    if Self::is_authenticated(CalendarProvider::Microsoft).await {
                        match Self::fetch_microsoft_events_internal(
                            &http_client,
                            client_id,
                            client_secret,
                        )
                        .await
                        {
                            Ok(events) => {
                                let mut cached = cached_events.write().await;
                                // Remove old Microsoft events and add new ones
                                cached.retain(|e| !e.id.starts_with("microsoft_"));
                                cached.extend(events);
                            }
                            Err(e) => eprintln!("Error fetching Microsoft Calendar events: {}", e),
                        }
                    }
                }

                *last_fetch.write().await = Some(Utc::now());
            }
        });

        Ok(())
    }

    /// Get OAuth authorization URL for Google Calendar
    pub fn get_google_auth_url(&self) -> Result<String, String> {
        println!("[OAuth] get_google_auth_url called");
        println!("[OAuth] google_client_id is_some: {}", self.google_client_id.is_some());
        println!("[OAuth] google_client_secret is_some: {}", self.google_client_secret.is_some());
        
        // Try reading from environment again in case .env was loaded after service creation
        let client_id = if let Some(id) = self.google_client_id.as_ref() {
            id.clone()
        } else {
            println!("[OAuth] Client ID not in service, trying environment variable...");
            std::env::var("GOOGLE_CLIENT_ID").map_err(|_| {
                eprintln!("[OAuth] ✗ GOOGLE_CLIENT_ID not found in service or environment");
                "Google Client ID not configured. Please check your .env file."
            })?
        };
            
        let client_secret = if let Some(secret) = self.google_client_secret.as_ref() {
            secret.clone()
        } else {
            println!("[OAuth] Client Secret not in service, trying environment variable...");
            std::env::var("GOOGLE_CLIENT_SECRET").map_err(|_| {
                eprintln!("[OAuth] ✗ GOOGLE_CLIENT_SECRET not found in service or environment");
                "Google Client Secret not configured. Please check your .env file."
            })?
        };
            
        println!("[OAuth] ✓ Using Client ID: {}...", &client_id[..client_id.len().min(20)]);

        let client = BasicClient::new(
            ClientId::new(client_id.clone()),
            Some(ClientSecret::new(client_secret.clone())),
            AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
                .map_err(|e| format!("Invalid auth URL: {}", e))?,
            Some(
                TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
                    .map_err(|e| format!("Invalid token URL: {}", e))?,
            ),
        )
        .set_redirect_uri(
            RedirectUrl::new("http://localhost:8080/oauth/callback".to_string())
                .map_err(|e| format!("Invalid redirect URL: {}", e))?,
        );

        let (auth_url, _csrf_token) = client
            .authorize_url(oauth2::CsrfToken::new_random)
            .add_scope(Scope::new(
                "https://www.googleapis.com/auth/calendar.readonly".to_string(),
            ))
            // Add Gmail API scopes
            .add_scope(Scope::new(
                "https://www.googleapis.com/auth/gmail.readonly".to_string(),
            ))
            .add_scope(Scope::new(
                "https://www.googleapis.com/auth/gmail.send".to_string(),
            ))
            .add_scope(Scope::new(
                "https://www.googleapis.com/auth/gmail.compose".to_string(),
            ))
            .url();

        let url_string = auth_url.to_string();
        println!("[OAuth] Generated auth URL: {}", url_string);
        
        // Verify required parameters are in the URL
        if !url_string.contains("client_id=") {
            eprintln!("[OAuth] ✗ WARNING: client_id parameter missing from URL!");
        } else {
            println!("[OAuth] ✓ client_id parameter found in URL");
        }
        
        if !url_string.contains("redirect_uri=") {
            eprintln!("[OAuth] ✗ WARNING: redirect_uri parameter missing from URL!");
            eprintln!("[OAuth] This might be because redirect_uri needs to be registered in Google Cloud Console");
        } else {
            println!("[OAuth] ✓ redirect_uri parameter found in URL");
            // Extract and show redirect_uri
            if let Some(start) = url_string.find("redirect_uri=") {
                let redirect_part = &url_string[start..];
                if let Some(end) = redirect_part.find('&') {
                    println!("[OAuth] redirect_uri value: {}", &redirect_part[13..end]);
                } else {
                    println!("[OAuth] redirect_uri value: {}", &redirect_part[13..]);
                }
            }
        }
        
        if !url_string.contains("scope=") {
            eprintln!("[OAuth] ✗✗✗ CRITICAL: scope parameter missing from URL! ✗✗✗");
            eprintln!("[OAuth] This will cause 'Missing required parameter: scope' error");
            eprintln!("[OAuth] Full URL for debugging: {}", url_string);
        } else {
            println!("[OAuth] ✓ scope parameter found in URL");
            // Extract and show scope value
            if let Some(start) = url_string.find("scope=") {
                let scope_part = &url_string[start..];
                if let Some(end) = scope_part.find('&') {
                    let scope_value = &scope_part[6..end];
                    println!("[OAuth] scope value (URL-encoded): {}", scope_value);
                    // Try to decode it
                    if let Ok(decoded) = urlencoding::decode(scope_value) {
                        println!("[OAuth] scope value (decoded): {}", decoded);
                    }
                } else {
                    let scope_value = &scope_part[6..];
                    println!("[OAuth] scope value (URL-encoded, no & after): {}", scope_value);
                    if let Ok(decoded) = urlencoding::decode(scope_value) {
                        println!("[OAuth] scope value (decoded): {}", decoded);
                    }
                }
            }
        }
        
        // Also check for response_type and state (required OAuth2 params)
        if !url_string.contains("response_type=") {
            eprintln!("[OAuth] ✗ WARNING: response_type parameter missing from URL!");
        } else {
            println!("[OAuth] ✓ response_type parameter found in URL");
        }

        Ok(url_string)
    }

    /// Get OAuth authorization URL for Microsoft Graph
    pub fn get_microsoft_auth_url(&self) -> Result<String, String> {
        let client_id = self
            .microsoft_client_id
            .as_ref()
            .ok_or("Microsoft Client ID not configured")?;
        let client_secret = self
            .microsoft_client_secret
            .as_ref()
            .ok_or("Microsoft Client Secret not configured")?;

        let client = BasicClient::new(
            ClientId::new(client_id.clone()),
            Some(ClientSecret::new(client_secret.clone())),
            AuthUrl::new(
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string(),
            )
            .map_err(|e| format!("Invalid auth URL: {}", e))?,
            Some(
                TokenUrl::new(
                    "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string(),
                )
                .map_err(|e| format!("Invalid token URL: {}", e))?,
            ),
        )
        .set_redirect_uri(
            RedirectUrl::new("http://localhost:8080/oauth/callback".to_string())
                .map_err(|e| format!("Invalid redirect URL: {}", e))?,
        );

        let (auth_url, _csrf_token) = client
            .authorize_url(oauth2::CsrfToken::new_random)
            .add_scope(Scope::new("Calendars.Read".to_string()))
            .url();

        Ok(auth_url.to_string())
    }

    /// Handle OAuth callback and store tokens
    pub async fn handle_oauth_callback(
        &self,
        provider: CalendarProvider,
        code: String,
    ) -> Result<(), String> {
        match provider {
            CalendarProvider::Google => {
                self.handle_google_callback(code).await?;
            }
            CalendarProvider::Microsoft => {
                self.handle_microsoft_callback(code).await?;
            }
        }

        // Mark provider as authenticated
        {
            let mut providers = self.authenticated_providers.write().await;
            providers.insert(provider, true);
        }

        Ok(())
    }

    async fn handle_google_callback(&self, code: String) -> Result<(), String> {
        println!("[Calendar] ========== handle_google_callback START ==========");
        let client_id = self
            .google_client_id
            .as_ref()
            .ok_or("Google Client ID not configured")?;
        let client_secret = self
            .google_client_secret
            .as_ref()
            .ok_or("Google Client Secret not configured")?;

        println!("[Calendar] Creating OAuth client...");
        let client = BasicClient::new(
            ClientId::new(client_id.clone()),
            Some(ClientSecret::new(client_secret.clone())),
            AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
                .map_err(|e| format!("Invalid auth URL: {}", e))?,
            Some(
                TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
                    .map_err(|e| format!("Invalid token URL: {}", e))?,
            ),
        )
        .set_redirect_uri(
            RedirectUrl::new("http://localhost:8080/oauth/callback".to_string())
                .map_err(|e| format!("Invalid redirect URL: {}", e))?,
        );

        println!("[Calendar] Exchanging OAuth code for token...");
        println!("[Calendar] Code length: {}", code.len());
        println!("[Calendar] Code preview: {}...", &code[..code.len().min(20)]);
        println!("[Calendar] Client ID: {}...", &client_id[..client_id.len().min(30)]);
        println!("[Calendar] Client Secret length: {} characters", client_secret.len());
        println!("[Calendar] Client Secret preview: {}...", &client_secret[..client_secret.len().min(10)]);
        println!("[Calendar] Redirect URI: http://localhost:8080/oauth/callback");
        
        let token_result = match client
            .exchange_code(AuthorizationCode::new(code.clone()))
            .request_async(async_http_client)
            .await
        {
            Ok(result) => {
                println!("[Calendar] ✓ Token exchange successful!");
                result
            }
            Err(e) => {
                eprintln!("[Calendar] ✗✗✗ TOKEN EXCHANGE FAILED ✗✗✗");
                eprintln!("[Calendar] Error: {:?}", e);
                eprintln!("[Calendar] Error to_string: {}", e);
                eprintln!("[Calendar] Code used: {}...", &code[..code.len().min(20)]);
                eprintln!("[Calendar] Redirect URI used: http://localhost:8080/oauth/callback");
                eprintln!("[Calendar] Client ID used: {}...", &client_id[..client_id.len().min(30)]);
                eprintln!("[Calendar] Client Secret length: {} characters", client_secret.len());
                eprintln!("[Calendar] Client Secret preview: {}...", &client_secret[..client_secret.len().min(10)]);
                
                let detailed_error = format!(
                    "Token exchange failed: {}\n\n\
                    TROUBLESHOOTING STEPS:\n\
                    1. Verify GOOGLE_CLIENT_SECRET in .env file matches Google Cloud Console\n\
                    2. Go to: https://console.cloud.google.com/apis/credentials\n\
                    3. Click your OAuth 2.0 Client ID\n\
                    4. Verify 'Authorized redirect URIs' includes: http://localhost:8080/oauth/callback\n\
                    5. Copy the 'Client secret' value and update .env file\n\
                    6. Restart the app after updating .env\n\n\
                    Current error: invalid_client means client_id/client_secret mismatch or redirect_uri not registered.",
                    e
                );
                eprintln!("[Calendar] {}", detailed_error);
                return Err(detailed_error);
            }
        };

        let expires_at = token_result
            .expires_in()
            .map(|duration| Utc::now() + Duration::seconds(duration.as_secs() as i64));

        println!("[Calendar] Token received:");
        println!("[Calendar] - Access token length: {}", token_result.access_token().secret().len());
        println!("[Calendar] - Has refresh token: {}", token_result.refresh_token().is_some());
        if let Some(expires) = expires_at {
            println!("[Calendar] - Expires at: {}", expires);
        } else {
            println!("[Calendar] - No expiration time");
        }

        let token_data = TokenData {
            access_token: token_result.access_token().secret().clone(),
            refresh_token: token_result
                .refresh_token()
                .map(|rt| rt.secret().clone()),
            expires_at,
        };

        println!("[Calendar] Storing token in keyring...");
        Self::store_token(CalendarProvider::Google, &token_data).await?;
        println!("[Calendar] ✓ Token stored successfully!");

        Ok(())
    }

    async fn handle_microsoft_callback(&self, code: String) -> Result<(), String> {
        let client_id = self
            .microsoft_client_id
            .as_ref()
            .ok_or("Microsoft Client ID not configured")?;
        let client_secret = self
            .microsoft_client_secret
            .as_ref()
            .ok_or("Microsoft Client Secret not configured")?;

        let client = BasicClient::new(
            ClientId::new(client_id.clone()),
            Some(ClientSecret::new(client_secret.clone())),
            AuthUrl::new(
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string(),
            )
            .map_err(|e| format!("Invalid auth URL: {}", e))?,
            Some(
                TokenUrl::new(
                    "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string(),
                )
                .map_err(|e| format!("Invalid token URL: {}", e))?,
            ),
        )
        .set_redirect_uri(
            RedirectUrl::new("http://localhost:8080/oauth/callback".to_string())
                .map_err(|e| format!("Invalid redirect URL: {}", e))?,
        );

        let token_result = client
            .exchange_code(AuthorizationCode::new(code))
            .request_async(async_http_client)
            .await
            .map_err(|e| format!("Token exchange failed: {}", e))?;

        let expires_at = token_result
            .expires_in()
            .map(|duration| Utc::now() + Duration::seconds(duration.as_secs() as i64));

        let token_data = TokenData {
            access_token: token_result.access_token().secret().clone(),
            refresh_token: token_result
                .refresh_token()
                .map(|rt| rt.secret().clone()),
            expires_at,
        };

        Self::store_token(CalendarProvider::Microsoft, &token_data).await?;

        Ok(())
    }

    /// Store OAuth token securely using keyring
    async fn store_token(provider: CalendarProvider, token_data: &TokenData) -> Result<(), String> {
        let service_name = match provider {
            CalendarProvider::Google => "pause-menu-google-calendar",
            CalendarProvider::Microsoft => "pause-menu-microsoft-calendar",
        };

        println!("[Calendar] store_token called for provider: {:?}, service_name: {}", provider, service_name);

        let entry = keyring::Entry::new(service_name, "oauth_token")
            .map_err(|e| {
                eprintln!("[Calendar] ✗ Failed to create keyring entry: {}", e);
                format!("Failed to create keyring entry: {}", e)
            })?;

        let json = serde_json::to_string(token_data)
            .map_err(|e| {
                eprintln!("[Calendar] ✗ Failed to serialize token: {}", e);
                format!("Failed to serialize token: {}", e)
            })?;

        println!("[Calendar] Serialized token, length: {} characters", json.len());

        entry
            .set_password(&json)
            .map_err(|e| {
                eprintln!("[Calendar] ✗ Failed to store token in keyring: {}", e);
                format!("Failed to store token: {}", e)
            })?;

        println!("[Calendar] ✓ Token stored successfully in keyring");

        // Verify it was stored by trying to retrieve it
        match entry.get_password() {
            Ok(retrieved) => {
                if retrieved == json {
                    println!("[Calendar] ✓ Token verification: stored and retrieved match");
                } else {
                    eprintln!("[Calendar] ⚠ WARNING: Stored and retrieved tokens don't match!");
                }
            }
            Err(e) => {
                eprintln!("[Calendar] ⚠ WARNING: Could not verify stored token: {}", e);
            }
        }

        Ok(())
    }

    /// Retrieve OAuth token from secure storage
    pub async fn get_token(provider: CalendarProvider) -> Result<TokenData, String> {
        let service_name = match provider {
            CalendarProvider::Google => "pause-menu-google-calendar",
            CalendarProvider::Microsoft => "pause-menu-microsoft-calendar",
        };

        println!("[Calendar] get_token called for provider: {:?}, service_name: {}", provider, service_name);

        // Create keyring entry - keyring library returns Result, not panics
        let entry = keyring::Entry::new(service_name, "oauth_token")
            .map_err(|e| {
                eprintln!("[Calendar] ✗ Failed to create keyring entry: {}", e);
                format!("Failed to create keyring entry: {}", e)
            })?;

        println!("[Calendar] Keyring entry created, attempting to get password...");
        
        // Get password - keyring library returns Result, not panics
        let json = entry
            .get_password()
            .map_err(|e| {
                eprintln!("[Calendar] ✗ Failed to retrieve token from keyring: {}", e);
                eprintln!("[Calendar] This usually means no token has been stored yet");
                format!("Failed to retrieve token: {}", e)
            })?;

        println!("[Calendar] ✓ Token retrieved from keyring, length: {} characters", json.len());

        let token_data: TokenData = serde_json::from_str(&json)
            .map_err(|e| {
                eprintln!("[Calendar] ✗ Failed to deserialize token: {}", e);
                format!("Failed to deserialize token: {}", e)
            })?;

        println!("[Calendar] ✓ Token deserialized successfully");

        // Check if token is expired and refresh if needed
        if let Some(expires_at) = token_data.expires_at {
            let now = Utc::now();
            println!("[Calendar] Token expires at: {}, current time: {}", expires_at, now);
            if expires_at <= now {
                eprintln!("[Calendar] ✗ Token expired");
                // Token expired, would need to refresh
                // For now, return error - refresh logic can be added later
                return Err("Token expired. Please re-authenticate.".to_string());
            } else {
                let remaining = expires_at - now;
                println!("[Calendar] ✓ Token is valid, expires in: {} seconds", remaining.num_seconds());
            }
        } else {
            println!("[Calendar] Token has no expiration time");
        }

        println!("[Calendar] ✓ Token retrieved successfully");
        Ok(token_data)
    }

    /// Check if a provider is authenticated
    pub async fn is_authenticated(provider: CalendarProvider) -> bool {
        println!("[Calendar] is_authenticated called for provider: {:?}", provider);
        match Self::get_token(provider).await {
            Ok(_) => {
                println!("[Calendar] ✓ Provider is authenticated");
                true
            }
            Err(e) => {
                eprintln!("[Calendar] ✗ Provider is NOT authenticated: {}", e);
                false
            }
        }
    }

    /// Fetch events from Google Calendar
    async fn fetch_google_events_internal(
        http_client: &Client,
        _client_id: &str,
        _client_secret: &str,
    ) -> Result<Vec<CalendarEvent>, String> {
        let token_data = Self::get_token(CalendarProvider::Google).await?;

        let now = Utc::now();
        // Fetch events for the next 7 days instead of just 24 hours
        let future = now + Duration::days(7);
        let time_min = now.to_rfc3339();
        let time_max = future.to_rfc3339();

        println!("[Calendar] Fetching Google Calendar events from {} to {}", time_min, time_max);

        // URL encode the datetime parameters
        let time_min_encoded = urlencoding::encode(&time_min);
        let time_max_encoded = urlencoding::encode(&time_max);
        
        let url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime",
            time_min_encoded, time_max_encoded
        );
        
        println!("[Calendar] Google Calendar API URL: {}", url);

        let response = http_client
            .get(&url)
            .bearer_auth(&token_data.access_token)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Google Calendar events: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unable to read error response".to_string());
            return Err(format!(
                "Google Calendar API error: {} - {}",
                status, error_text
            ));
        }

        // Get the raw response text for debugging and parsing
        let response_text = response.text().await
            .map_err(|e| format!("Failed to read Google Calendar response: {}", e))?;
        
        println!("[Calendar] Google Calendar API response length: {} chars", response_text.len());
        if response_text.len() < 1000 {
            println!("[Calendar] Full response: {}", response_text);
        } else {
            println!("[Calendar] Response preview (first 500 chars): {}", 
                &response_text.chars().take(500).collect::<String>());
        }
        
        // Try to find and print the first event's start/end structure for debugging
        if let Some(start_idx) = response_text.find("\"start\"") {
            let end_idx = response_text[start_idx..].find("\"end\"").unwrap_or(200);
            let snippet = &response_text[start_idx..start_idx + end_idx.min(400)];
            println!("[Calendar] First event 'start' field structure: {}", snippet);
        }
        if let Some(end_idx) = response_text.find("\"end\"") {
            let next_field = response_text[end_idx..].find("\",").unwrap_or(200);
            let snippet = &response_text[end_idx..end_idx + next_field.min(400)];
            println!("[Calendar] First event 'end' field structure: {}", snippet);
        }

        // Parse the JSON response
        let calendar_response: GoogleCalendarResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                eprintln!("[Calendar] JSON parse error: {}", e);
                eprintln!("[Calendar] Error location: line {} column {}", 
                    e.line(), e.column());
                // Print a snippet around the error
                let lines: Vec<&str> = response_text.lines().collect();
                if let Some(line_num) = e.line().checked_sub(1) {
                    if (line_num as usize) < lines.len() {
                        eprintln!("[Calendar] Error at line {}: {}", line_num + 1, lines[line_num as usize]);
                    }
                }
                // Try to find and print the first event's start/end structure
                if let Some(start_idx) = response_text.find("\"start\"") {
                    let snippet = &response_text[start_idx..start_idx.min(response_text.len()).min(start_idx + 200)];
                    eprintln!("[Calendar] First 'start' field snippet: {}", snippet);
                }
                format!("Failed to parse Google Calendar response: {} at line {} column {}", 
                    e, e.line(), e.column())
            })?;

        println!("[Calendar] Google Calendar API returned {} events", calendar_response.items.len());

        let events: Vec<CalendarEvent> = calendar_response
            .items
            .into_iter()
            .enumerate()
            .filter_map(|(idx, event)| {
                println!("[Calendar] Processing event {}: id={}, summary={}", idx, event.id, event.summary);
                println!("[Calendar] Event {} start: date_time={:?}, date={:?}", 
                    idx, event.start.date_time, event.start.date);
                println!("[Calendar] Event {} end: date_time={:?}, date={:?}", 
                    idx, event.end.date_time, event.end.date);
                
                // Handle both dateTime and date (all-day events)
                let start_time = if let Some(dt) = event.start.date_time {
                    // Has dateTime field - use it directly
                    println!("[Calendar] Event {} using date_time for start: {}", idx, dt);
                    Some(dt)
                } else if let Some(date_str) = &event.start.date {
                    // Has date field (all-day event) - parse it
                    println!("[Calendar] Event {} has date (all-day) for start: {}", idx, date_str);
                    // For all-day events, Google returns date as "YYYY-MM-DD"
                    // We need to parse it and set to start of day in UTC
                    match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        Ok(naive_date) => {
                            let dt = naive_date.and_hms_opt(0, 0, 0)
                                .unwrap()
                                .and_utc();
                            println!("[Calendar] Event {} parsed all-day start: {}", idx, dt);
                            Some(dt)
                        },
                        Err(e) => {
                            eprintln!("[Calendar] Event {} failed to parse start date '{}': {}", idx, date_str, e);
                            None
                        }
                    }
                } else {
                    eprintln!("[Calendar] Event {} has neither date_time nor date for start", idx);
                    None
                };
                
                let start_time = match start_time {
                    Some(st) => {
                        println!("[Calendar] Event {} start_time: {}", idx, st);
                        st
                    },
                    None => {
                        eprintln!("[Calendar] Event {} has no valid start time, skipping", idx);
                        return None;
                    }
                };

                let end_time = if let Some(dt) = event.end.date_time {
                    // Has dateTime field - use it directly
                    println!("[Calendar] Event {} using date_time for end: {}", idx, dt);
                    Some(dt)
                } else if let Some(date_str) = &event.end.date {
                    // Has date field (all-day event) - parse it
                    println!("[Calendar] Event {} has date (all-day) for end: {}", idx, date_str);
                    // For all-day events, Google returns date as "YYYY-MM-DD"
                    // We need to parse it and set to end of day in UTC
                    match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        Ok(naive_date) => {
                            let dt = naive_date.and_hms_opt(23, 59, 59)
                                .unwrap()
                                .and_utc();
                            println!("[Calendar] Event {} parsed all-day end: {}", idx, dt);
                            Some(dt)
                        },
                        Err(e) => {
                            eprintln!("[Calendar] Event {} failed to parse end date '{}': {}", idx, date_str, e);
                            None
                        }
                    }
                } else {
                    eprintln!("[Calendar] Event {} has neither date_time nor date for end", idx);
                    None
                };
                
                let end_time = match end_time {
                    Some(et) => {
                        println!("[Calendar] Event {} end_time: {}", idx, et);
                        et
                    },
                    None => {
                        eprintln!("[Calendar] Event {} has no valid end time, skipping", idx);
                        return None;
                    }
                };

                let cal_event = CalendarEvent {
                    id: format!("google_{}", event.id),
                    title: event.summary.clone(),
                    start_time,
                    end_time,
                    location: event.location.clone(),
                    description: event.description.clone(),
                };
                
                println!("[Calendar] ✓ Parsed event: '{}' at {} (Unix: {})", 
                    cal_event.title, 
                    cal_event.start_time,
                    cal_event.start_time.timestamp()
                );
                
                Some(cal_event)
            })
            .collect();

        println!("[Calendar] Successfully parsed {} events from Google Calendar", events.len());
        Ok(events)
    }

    /// Fetch events from Microsoft Graph
    async fn fetch_microsoft_events_internal(
        http_client: &Client,
        _client_id: &str,
        _client_secret: &str,
    ) -> Result<Vec<CalendarEvent>, String> {
        let token_data = Self::get_token(CalendarProvider::Microsoft).await?;

        let now = Utc::now();
        let tomorrow = now + Duration::hours(24);
        let start_datetime = now.to_rfc3339();
        let end_datetime = tomorrow.to_rfc3339();

        // URL encode the datetime parameters
        let start_encoded = urlencoding::encode(&start_datetime);
        let end_encoded = urlencoding::encode(&end_datetime);
        
        let url = format!(
            "https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime={}&endDateTime={}&$orderby=start/dateTime",
            start_encoded, end_encoded
        );

        let response = http_client
            .get(&url)
            .bearer_auth(&token_data.access_token)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Microsoft Calendar events: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Microsoft Graph API error: {}",
                response.status()
            ));
        }

        let graph_response: MicrosoftGraphResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Microsoft Graph response: {}", e))?;

        let events: Vec<CalendarEvent> = graph_response
            .value
            .into_iter()
            .map(|event| CalendarEvent {
                id: format!("microsoft_{}", event.id),
                title: event.subject,
                start_time: event.start.date_time,
                end_time: event.end.date_time,
                location: event.location.map(|l| l.display_name),
                description: event.body.map(|b| b.content),
            })
            .collect();

        Ok(events)
    }

    /// Get all upcoming events (cached)
    pub async fn get_events(&self) -> Result<Vec<CalendarEvent>, String> {
        let events = self.cached_events.read().await;
        Ok(events.clone())
    }

    /// Get the next upcoming meeting
    pub async fn get_next_meeting(&self) -> Option<CalendarEvent> {
        let events = self.cached_events.read().await;
        let now = Utc::now();

        events
            .iter()
            .filter(|event| event.start_time > now)
            .min_by_key(|event| event.start_time)
            .cloned()
    }

    /// Calculate time until next meeting
    pub async fn time_until_next_meeting(&self) -> Option<Duration> {
        self.get_next_meeting()
            .await
            .map(|event| event.start_time - Utc::now())
    }

    /// Manually trigger a refresh of events
    pub async fn refresh_events(&self) -> Result<(), String> {
        println!("[Calendar] ========== refresh_events called ==========");
        let mut all_events = Vec::new();

        // Fetch from Google Calendar if authenticated
        if let (Some(client_id), Some(client_secret)) = (
            self.google_client_id.as_ref(),
            self.google_client_secret.as_ref(),
        ) {
            let is_auth = Self::is_authenticated(CalendarProvider::Google).await;
            println!("[Calendar] Google Calendar authenticated: {}", is_auth);
            if is_auth {
                println!("[Calendar] Fetching Google Calendar events...");
                match Self::fetch_google_events_internal(&self.http_client, client_id, client_secret)
                    .await
                {
                    Ok(events) => {
                        println!("[Calendar] ✓ Fetched {} events from Google Calendar", events.len());
                        all_events.extend(events);
                    },
                    Err(e) => {
                        eprintln!("[Calendar] ✗ Error fetching Google Calendar events: {}", e);
                    },
                }
            } else {
                println!("[Calendar] Google Calendar not authenticated, skipping fetch");
            }
        } else {
            println!("[Calendar] Google Calendar credentials not configured");
        }

        // Fetch from Microsoft Graph if authenticated
        if let (Some(client_id), Some(client_secret)) = (
            self.microsoft_client_id.as_ref(),
            self.microsoft_client_secret.as_ref(),
        ) {
            if Self::is_authenticated(CalendarProvider::Microsoft).await {
                match Self::fetch_microsoft_events_internal(
                    &self.http_client,
                    client_id,
                    client_secret,
                )
                .await
                {
                    Ok(events) => all_events.extend(events),
                    Err(e) => eprintln!("Error fetching Microsoft Calendar events: {}", e),
                }
            }
        }

        println!("[Calendar] Total events after refresh: {}", all_events.len());
        *self.cached_events.write().await = all_events;
        *self.last_fetch.write().await = Some(Utc::now());

        println!("[Calendar] ✓ Events cached successfully");
        Ok(())
    }
}

// Global calendar service instance
use std::sync::OnceLock;
use tokio::sync::Mutex;

static CALENDAR_SERVICE: OnceLock<Arc<Mutex<CalendarService>>> = OnceLock::new();

pub async fn get_calendar_service() -> Arc<Mutex<CalendarService>> {
    CALENDAR_SERVICE.get_or_init(|| {
        let service = Arc::new(Mutex::new(CalendarService::new()));
        let service_clone = Arc::clone(&service);
        tokio::spawn(async move {
            // Wrap initialize in error handling to prevent panics
            let service_guard = service_clone.lock().await;
            if let Err(e) = service_guard.initialize().await {
                eprintln!("[Calendar] Error during service initialization: {}", e);
            }
        });
        service
    }).clone()
}
