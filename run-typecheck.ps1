$ErrorActionPreference = "Continue"
Set-Location "c:\Users\koffi\Dev\flowsmartly"

# Add Node.js to PATH
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

# Use local node_modules binaries
$localBin = ".\node_modules\.bin"

Write-Host "Running TypeScript check..." -ForegroundColor Yellow
& "$localBin\tsc.cmd" --noEmit
Write-Host "Done!" -ForegroundColor Green
