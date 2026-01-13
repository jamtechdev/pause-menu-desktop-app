// OAuth callback server - automatically captures OAuth callback
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

static OAUTH_CODE_CHANNEL: tokio::sync::Mutex<Option<oneshot::Sender<String>>> = tokio::sync::Mutex::const_new(None);

pub struct OAuthServer;

impl OAuthServer {
    /// Start OAuth flow with automatic callback capture
    pub async fn start_oauth_flow(
        auth_url: String,
    ) -> Result<String, String> {
        // Create channel for callback
        let (tx, rx) = oneshot::channel::<String>();
        {
            let mut guard = OAUTH_CODE_CHANNEL.lock().await;
            *guard = Some(tx);
        }

        // Start HTTP server to capture callback
        // Note: We must use port 8080 because that's what's configured in Google OAuth
        // If port is busy, the user needs to close any other instances
        let listener = match TcpListener::bind("127.0.0.1:8080").await {
            Ok(l) => {
                println!("[OAuth] Callback server listening on http://localhost:8080");
                l
            }
            Err(e) => {
                return Err(format!(
                    "Port 8080 is already in use. Please close any other instances of the app and try again. Error: {}",
                    e
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
                                eprintln!("Error serving connection: {:?}", err);
                            }
                        }
                        Err(e) => {
                            eprintln!("Error accepting connection: {:?}", e);
                            break;
                        }
                    }
                }
            })
        };

        // Open browser with auth URL
        println!("[OAuth] Opening browser with auth URL...");
        println!("[OAuth] URL length: {} characters", auth_url.len());
        #[cfg(windows)]
        {
            use std::process::Command;
            // On Windows, we need to properly quote the URL to prevent & from being interpreted as command separator
            // Use PowerShell's Start-Process which handles URLs better, or use cmd with proper quoting
            match Command::new("powershell")
                .args(["-Command", &format!("Start-Process '{}'", auth_url)])
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        println!("[OAuth] ✓ Browser opened successfully via PowerShell");
                    } else {
                        // Fallback to cmd with quoted URL
                        eprintln!("[OAuth] PowerShell failed, trying cmd with quoted URL...");
                        let quoted_url = format!("\"{}\"", auth_url);
                        match Command::new("cmd")
                            .args(["/C", "start", "", &quoted_url])
                            .output()
                        {
                            Ok(cmd_output) => {
                                if cmd_output.status.success() {
                                    println!("[OAuth] ✓ Browser opened successfully via cmd");
                                } else {
                                    eprintln!("[OAuth] ✗ Failed to open browser. Exit code: {:?}", cmd_output.status.code());
                                    eprintln!("[OAuth] stderr: {}", String::from_utf8_lossy(&cmd_output.stderr));
                                }
                            }
                            Err(e) => {
                                eprintln!("[OAuth] ✗ Error opening browser with cmd: {}", e);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[OAuth] ✗ Error opening browser with PowerShell: {}", e);
                    // Try cmd as fallback
                    let quoted_url = format!("\"{}\"", auth_url);
                    if let Err(cmd_err) = Command::new("cmd")
                        .args(["/C", "start", "", &quoted_url])
                        .output()
                    {
                        eprintln!("[OAuth] ✗ Error opening browser with cmd fallback: {}", cmd_err);
                    }
                }
            }
        }

        #[cfg(not(windows))]
        {
            use std::process::Command;
            let _ = Command::new("xdg-open").arg(&auth_url).output();
        }

        // Wait for callback (with timeout)
        tokio::select! {
            result = rx => {
                // Stop the server after getting the code
                server_handle.abort();
                match result {
                    Ok(code) => Ok(code),
                    Err(_) => Err("OAuth callback channel closed".to_string()),
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(300)) => {
                server_handle.abort();
                Err("OAuth timeout - no callback received within 5 minutes".to_string())
            }
        }
    }

    async fn handle_request(
        req: Request<hyper::body::Incoming>,
    ) -> Result<Response<Full<Bytes>>, Infallible> {
        let path = req.uri().path();
        
        if path == "/oauth/callback" {
            // Parse query parameters
            let query = req.uri().query().unwrap_or("");
            let url = Url::parse(&format!("http://localhost:8080/oauth/callback?{}", query))
                .unwrap_or_else(|_| Url::parse("http://localhost:8080/oauth/callback").unwrap());
            
            let mut code = None;
            let mut error = None;
            
            for (key, value) in url.query_pairs() {
                if key == "code" {
                    code = Some(value.to_string());
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
                            <title>OAuth Error</title>
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

            if let Some(auth_code) = code {
                // Send code back through channel
                let mut guard = OAUTH_CODE_CHANNEL.lock().await;
                if let Some(tx) = guard.take() {
                    let _ = tx.send(auth_code.clone());
                }
                
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/html")
                    .body(Full::new(Bytes::from(format!(
                        r#"
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Authentication Successful</title>
                            <meta http-equiv="refresh" content="2;url=about:blank">
                            <style>
                                body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: white; }}
                                .success {{ color: #10b981; font-size: 24px; }}
                                .checkmark {{ font-size: 48px; margin: 20px 0; }}
                            </style>
                        </head>
                        <body>
                            <div class="checkmark">✓</div>
                            <h1 class="success">Authentication Successful!</h1>
                            <p>Your calendar is now connected.</p>
                            <p style="font-size: 12px; opacity: 0.7; margin-top: 30px;">This window will close automatically...</p>
                        </body>
                        </html>
                        "#
                    ))))
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
