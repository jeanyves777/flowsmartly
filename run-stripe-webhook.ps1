$ErrorActionPreference = "Continue"
Set-Location "c:\Users\koffi\Dev\flowsmartly"

# Stripe CLI path
$stripeCli = "C:\Users\koffi\AppData\Local\Microsoft\WinGet\Packages\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\stripe.exe"

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^["'']|["'']$', ''
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stripe Webhook Local Listener" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the webhook secret
Write-Host "Getting webhook signing secret..." -ForegroundColor Yellow
$secret = & $stripeCli listen --api-key $env:STRIPE_SECRET_KEY --print-secret 2>&1

if ($secret -match "^whsec_") {
    Write-Host ""
    Write-Host "Webhook Secret: $secret" -ForegroundColor Green
    Write-Host ""
    Write-Host "Add this to your .env file:" -ForegroundColor Yellow
    Write-Host "STRIPE_WEBHOOK_SECRET=$secret" -ForegroundColor White
    Write-Host ""

    # Update .env file
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "# STRIPE_WEBHOOK_SECRET=") {
        $envContent = $envContent -replace "# STRIPE_WEBHOOK_SECRET=.*", "STRIPE_WEBHOOK_SECRET=$secret"
        Set-Content ".env" $envContent -NoNewline
        Write-Host ".env file updated automatically!" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Starting webhook listener..." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""

    # Start listening for webhooks
    & $stripeCli listen --api-key $env:STRIPE_SECRET_KEY --forward-to localhost:3000/api/payments/webhook
} else {
    Write-Host "Error getting webhook secret:" -ForegroundColor Red
    Write-Host $secret -ForegroundColor Red
}
