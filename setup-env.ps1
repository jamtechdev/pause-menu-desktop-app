# Setup script for Google Calendar OAuth credentials
# Run this before starting the app: .\setup-env.ps1

$env:GOOGLE_CLIENT_ID="890086055015-46k99gc49dpd1piv566e8ak3jfp7hfvt.apps.googleusercontent.com"

# IMPORTANT: Replace with your actual client secret from Google Cloud Console
# You can find it in: Google Cloud Console > APIs & Services > Credentials > Your OAuth Client
$env:GOOGLE_CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"

Write-Host "Environment variables set:" -ForegroundColor Green
Write-Host "GOOGLE_CLIENT_ID: $env:GOOGLE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "GOOGLE_CLIENT_SECRET: $([string]::new('*', $env:GOOGLE_CLIENT_SECRET.Length))" -ForegroundColor Cyan
Write-Host ""
Write-Host "To make these permanent, add them to System Environment Variables" -ForegroundColor Yellow
Write-Host "Or run this script before each development session" -ForegroundColor Yellow

