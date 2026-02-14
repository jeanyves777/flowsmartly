$ErrorActionPreference = "Continue"
Set-Location "c:\Users\koffi\Dev\flowsmartly"

# Add Node.js to PATH
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove surrounding quotes if present
            $value = $value -replace '^["'']|["'']$', ''
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Use local node_modules binaries
$localBin = ".\node_modules\.bin"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FlowSmartly Stripe Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Setting up Stripe products and prices..." -ForegroundColor Yellow
& "$localBin\tsx.cmd" scripts/setup-stripe.ts

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
