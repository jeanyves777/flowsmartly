$ErrorActionPreference = "Stop"
Set-Location "c:\Users\koffi\Dev\flowsmartly"

$stripeCli = "C:\Users\koffi\AppData\Local\Microsoft\WinGet\Packages\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\stripe.exe"

# Load STRIPE_SECRET_KEY from .env
$envContent = Get-Content ".env"
foreach ($line in $envContent) {
    if ($line -match "^STRIPE_SECRET_KEY=(.+)$") {
        $stripeKey = $matches[1].Trim()
        break
    }
}

if (-not $stripeKey) {
    Write-Host "Error: STRIPE_SECRET_KEY not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Getting webhook signing secret..." -ForegroundColor Yellow
$secret = & $stripeCli listen --api-key $stripeKey --print-secret 2>&1

if ($secret -match "^whsec_") {
    Write-Host ""
    Write-Host "Webhook Secret: $secret" -ForegroundColor Green
    Write-Host ""

    # Update .env file - replace the commented line
    $envText = Get-Content ".env" -Raw
    $envText = $envText -replace "# STRIPE_WEBHOOK_SECRET=.*", "STRIPE_WEBHOOK_SECRET=$secret"
    Set-Content ".env" $envText.TrimEnd()

    Write-Host ".env file updated with STRIPE_WEBHOOK_SECRET" -ForegroundColor Green
} else {
    Write-Host "Output: $secret" -ForegroundColor Yellow
}
