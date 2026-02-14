$ErrorActionPreference = "Continue"
Set-Location "c:\Users\koffi\Dev\flowsmartly"

# Add Node.js to PATH
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

# Use local node_modules binaries
$localBin = ".\node_modules\.bin"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "FlowSmartly Setup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Installing tsx..." -ForegroundColor Yellow
& npm install -D tsx 2>$null
Write-Host "Done!" -ForegroundColor Green
Write-Host ""

Write-Host "[2/4] Pushing database schema..." -ForegroundColor Yellow
& "$localBin\prisma.cmd" db push --accept-data-loss
Write-Host "Done!" -ForegroundColor Green
Write-Host ""

Write-Host "[3/4] Creating Super Admin user..." -ForegroundColor Yellow
& "$localBin\tsx.cmd" scripts/create-super-admin.ts
Write-Host ""

Write-Host "[4/4] Starting development server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Server starting at http://localhost:3000" -ForegroundColor Green
Write-Host "Admin login at http://localhost:3000/admin/login" -ForegroundColor Green
Write-Host ""
Write-Host "SUPER ADMIN CREDENTIALS:" -ForegroundColor Cyan
Write-Host "  Email:    admin@flowsmartly.com" -ForegroundColor White
Write-Host "  Password: Admin@123456" -ForegroundColor White
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Start Next.js dev server
& "$localBin\next.cmd" dev
