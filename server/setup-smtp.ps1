# SMTP Configuration Helper Script
# This script helps you configure SMTP settings in your .env file

Write-Host "`n=== LetMeSell SMTP Configuration ===" -ForegroundColor Cyan
Write-Host ""

# Ask which email provider
Write-Host "Which email provider do you want to use?" -ForegroundColor Yellow
Write-Host "1. Gmail" -ForegroundColor Green
Write-Host "2. Outlook/Office 365" -ForegroundColor Green
Write-Host "3. Papercut (Local Testing)" -ForegroundColor Green
Write-Host ""
$choice = Read-Host "Enter choice (1-3)"

$envContent = @"
# Server Configuration
PORT=3000

# MongoDB Configuration (optional override)
# MONGODB_URI=your-mongodb-uri

# Stripe Configuration (optional)
# STRIPE_SECRET_KEY=your-stripe-key
# STRIPE_WEBHOOK_SECRET=your-webhook-secret

"@

switch ($choice) {
    "1" {
        Write-Host "`n=== Gmail Configuration ===" -ForegroundColor Yellow
        Write-Host "You need a Gmail App Password (not your regular password)" -ForegroundColor Cyan
        Write-Host "Get it from: https://myaccount.google.com/apppasswords" -ForegroundColor Cyan
        Write-Host ""
        $email = Read-Host "Enter your Gmail address"
        $password = Read-Host "Enter your 16-character App Password" -AsSecureString
        $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
        
        $envContent += @"
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$email
SMTP_PASSWORD=$passwordPlain
FROM_EMAIL=$email
"@
    }
    "2" {
        Write-Host "`n=== Outlook/Office 365 Configuration ===" -ForegroundColor Yellow
        Write-Host "You need an App Password (not your regular password)" -ForegroundColor Cyan
        Write-Host "Get it from: https://account.microsoft.com/security/app-passwords" -ForegroundColor Cyan
        Write-Host ""
        $email = Read-Host "Enter your Outlook/Office 365 email"
        $password = Read-Host "Enter your App Password" -AsSecureString
        $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
        
        $envContent += @"
# Outlook/Office 365 SMTP Configuration
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$email
SMTP_PASSWORD=$passwordPlain
FROM_EMAIL=$email
"@
    }
    "3" {
        Write-Host "`n=== Papercut Configuration (Local Testing) ===" -ForegroundColor Yellow
        Write-Host "Download Papercut from: https://github.com/ChangemakerStudios/Papercut-SMTP/releases" -ForegroundColor Cyan
        Write-Host "Run Papercut.exe before starting the server" -ForegroundColor Cyan
        Write-Host ""
        
        $envContent += @"
# Papercut SMTP Configuration (Local Testing)
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=test
SMTP_PASSWORD=test
FROM_EMAIL=test@letmesell.local
SMTP_REJECT_UNAUTHORIZED=false
"@
    }
    default {
        Write-Host "Invalid choice. Exiting." -ForegroundColor Red
        exit
    }
}

# Backup existing .env if it exists
if (Test-Path .env) {
    $backupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item .env $backupName
    Write-Host "`nBacked up existing .env to $backupName" -ForegroundColor Green
}

# Write new .env file
$envContent | Out-File -FilePath .env -Encoding utf8 -NoNewline
Write-Host "`n✓ Created/Updated .env file" -ForegroundColor Green
Write-Host "`nRestart your server (npm start) for changes to take effect." -ForegroundColor Yellow

