$ErrorActionPreference = "Continue"
Set-Location "c:\Users\koffi\Dev\flowsmartly"

# Add Node.js to PATH
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

# Use local node_modules binaries
$localBin = ".\node_modules\.bin"

Write-Host "Seeding plans and credit packages..." -ForegroundColor Yellow
& "$localBin\tsx.cmd" scripts/seed-plans.ts
Write-Host "Done!" -ForegroundColor Green
