$ErrorActionPreference = "Continue"
Set-Location "c:\Users\koffi\Dev\flowsmartly"
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

Write-Host "Installing Twilio SDK..." -ForegroundColor Yellow
npm install twilio
Write-Host "Done!" -ForegroundColor Green
