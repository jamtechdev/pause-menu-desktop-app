// Magic link callback server - automatically captures magic link verification
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use http_body_util::Full;
use bytes::Bytes;
use std::convert::Infallible;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use url::Url;

static MAGIC_LINK_CALLBACK_CHANNEL: tokio::sync::Mutex<Option<oneshot::Sender<(String, String)>>> = tokio::sync::Mutex::const_new(None);

pub struct MagicLinkServer;

impl MagicLinkServer {
    /// Start magic link callback server
    /// Returns (token, email) when callback is received
    pub async fn start_callback_server(
        port: u16,
    ) -> Result<(String, String), String> {
        // Create channel for callback
        let (tx, rx) = oneshot::channel::<(String, String)>();
        {
            let mut guard = MAGIC_LINK_CALLBACK_CHANNEL.lock().await;
            *guard = Some(tx);
        }

        // Start HTTP server to capture callback
        let addr = format!("127.0.0.1:{}", port);
        println!("[MagicLink] Attempting to bind to {}...", addr);
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => {
                println!("[MagicLink] ✓✓✓ SUCCESS: Callback server listening on http://{} ✓✓✓", addr);
                println!("[MagicLink] Server is ready to receive callbacks");
                l
            }
            Err(e) => {
                eprintln!("[MagicLink] ✗✗✗ FAILED to bind to port {}: {} ✗✗✗", port, e);
                eprintln!("[MagicLink] Port {} is already in use. This usually means:", port);
                eprintln!("[MagicLink]   1. Another instance of the app is running");
                eprintln!("[MagicLink]   2. Another application is using port {}", port);
                eprintln!("[MagicLink]   3. The previous callback server didn't shut down properly");
                return Err(format!(
                    "Port {} is already in use. Please close any other instances of the app and try again. Error: {}",
                    port, e
                ));
            }
        };
        
        let server_handle = {
            tokio::spawn(async move {
                loop {
                    match listener.accept().await {
                        Ok((stream, _)) => {
                            let io = TokioIo::new(stream);
                            let service = service_fn(Self::handle_request);
                            
                            if let Err(err) = http1::Builder::new()
                                .serve_connection(io, service)
                                .await
                            {
                                eprintln!("[MagicLink] Error serving connection: {:?}", err);
                            }
                        }
                        Err(e) => {
                            eprintln!("[MagicLink] Error accepting connection: {:?}", e);
                            break;
                        }
                    }
                }
            })
        };

        // Wait for callback (with timeout)
        tokio::select! {
            result = rx => {
                // Stop the server after getting the callback
                server_handle.abort();
                match result {
                    Ok((token, email)) => Ok((token, email)),
                    Err(_) => Err("Magic link callback channel closed".to_string()),
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(300)) => {
                server_handle.abort();
                Err("Magic link timeout - no callback received within 5 minutes".to_string())
            }
        }
    }

    async fn handle_request(
        req: Request<hyper::body::Incoming>,
    ) -> Result<Response<Full<Bytes>>, Infallible> {
        let path = req.uri().path();
        let query = req.uri().query().unwrap_or("");
        println!("[MagicLink] Received request: path={}, query={}", path, query);
        
        if path == "/auth/callback" || path.starts_with("/auth/callback") {
            println!("[MagicLink] Processing callback request...");
            // Parse query parameters
            let url = Url::parse(&format!("http://localhost:8081{}?{}", path, query))
                .unwrap_or_else(|_| Url::parse("http://localhost:8081/auth/callback").unwrap());
            
            let mut token = None;
            let mut email = None;
            let mut error = None;
            
            for (key, value) in url.query_pairs() {
                if key == "token" {
                    token = Some(value.to_string());
                } else if key == "email" {
                    email = Some(value.to_string());
                } else if key == "error" {
                    error = Some(value.to_string());
                }
            }

            if let Some(err) = error {
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/html")
                    .body(Full::new(Bytes::from(format!(
                        r#"
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Authentication Error</title>
                            <meta http-equiv="refresh" content="3;url=about:blank">
                            <style>
                                body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: white; }}
                                .error {{ color: #ef4444; }}
                            </style>
                        </head>
                        <body>
                            <h1 class="error">Authentication Failed</h1>
                            <p>{}</p>
                            <p>This window will close automatically...</p>
                        </body>
                        </html>
                        "#,
                        err
                    ))))
                    .unwrap());
            }

            if let (Some(auth_token), Some(auth_email)) = (token, email) {
                println!("[MagicLink] Received callback with token (length: {}) and email: {}", auth_token.len(), auth_email);
                
                // Send token and email back through channel
                let mut guard = MAGIC_LINK_CALLBACK_CHANNEL.lock().await;
                if let Some(tx) = guard.take() {
                    println!("[MagicLink] Sending token and email through channel...");
                    match tx.send((auth_token.clone(), auth_email.clone())) {
                        Ok(_) => {
                            println!("[MagicLink] ✓ Token and email sent successfully through channel");
                        }
                        Err(e) => {
                            eprintln!("[MagicLink] ✗ Failed to send token through channel: {:?}", e);
                            // Channel failed, but we still have the token - it will be sent via postMessage in HTML
                        }
                    }
                } else {
                    eprintln!("[MagicLink] ✗ No channel receiver found! Callback server may not be waiting.");
                    println!("[MagicLink] Token will be sent via postMessage in HTML response as fallback");
                }
                
                // Return HTML page that also tries to send token via postMessage as fallback
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/html")
                    .body(Full::new(Bytes::from(format!(
                        r#"
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Authentication Successful</title>
                            <meta http-equiv="refresh" content="3;url=about:blank">
                            <style>
                                body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: white; }}
                                .success {{ color: #10b981; font-size: 24px; }}
                                .checkmark {{ font-size: 48px; margin: 20px 0; }}
                            </style>
                        </head>
                        <body>
                            <div class="checkmark">✓</div>
                            <h1 class="success">Authentication Successful!</h1>
                            <p>You are now logged in to LetMeSell.</p>
                            <p style="font-size: 12px; opacity: 0.7; margin-top: 30px;">This window will close automatically...</p>
                            <script>
                                // Try to send token via postMessage as fallback
                                (function() {{
                                    console.log('[Success Page] Attempting to send token via postMessage...');
                                    const token = '{}';
                                    const email = '{}';
                                    
                                    // Try multiple methods to ensure message is received
                                    const sendMessage = (target, type) => {{
                                        try {{
                                            target.postMessage({{
                                                type: type,
                                                token: token,
                                                email: email
                                            }}, '*');
                                            console.log('[Success Page] ✓ Sent', type, 'to', target === window.opener ? 'opener' : 'parent');
                                        }} catch (e) {{
                                            console.error('[Success Page] Failed to send to', target === window.opener ? 'opener' : 'parent', ':', e);
                                        }}
                                    }};
                                    
                                    // Send to opener (if opened from desktop app)
                                    if (window.opener) {{
                                        sendMessage(window.opener, 'MAGIC_LINK_CALLBACK');
                                        sendMessage(window.opener, 'AUTH_SUCCESS');
                                    }} else {{
                                        console.log('[Success Page] No window.opener found');
                                    }}
                                    
                                    // Send to parent (if in iframe)
                                    if (window.parent && window.parent !== window) {{
                                        sendMessage(window.parent, 'MAGIC_LINK_CALLBACK');
                                        sendMessage(window.parent, 'AUTH_SUCCESS');
                                    }} else {{
                                        console.log('[Success Page] No parent window (not in iframe)');
                                    }}
                                    
                                    // Also try to send to top window
                                    if (window.top && window.top !== window) {{
                                        sendMessage(window.top, 'MAGIC_LINK_CALLBACK');
                                        sendMessage(window.top, 'AUTH_SUCCESS');
                                    }}
                                    
                                    console.log('[Success Page] All postMessage attempts completed');
                                }})();
                            </script>
                        </body>
                        </html>
                        "#,
                        auth_token, auth_email
                    ))))
                    .unwrap());
            } else {
                // Missing parameters
                return Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "text/html")
                    .body(Full::new(Bytes::from(
                        r#"
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Invalid Request</title>
                            <style>
                                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: white; }
                            </style>
                        </head>
                        <body>
                            <h1>Invalid Request</h1>
                            <p>Missing required parameters (token or email).</p>
                        </body>
                        </html>
                        "#
                    )))
                    .unwrap());
            }
        }

        // Default response
        Ok(Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Full::new(Bytes::from("Not Found")))
            .unwrap())
    }
}

