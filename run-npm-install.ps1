$ErrorActionPreference = "Continue"
Set-Location "c:\Users\koffi\Dev\flowsmartly"

# Add Node.js to PATH
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

Write-Host "Installing packages..." -ForegroundColor Yellow
npm install $args
Write-Host "Done!" -ForegroundColor Green
