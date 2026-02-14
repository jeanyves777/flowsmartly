# FlowSmartly Templates Setup Script
# Run this script to set up the templates system

Write-Host "Setting up FlowSmartly Templates System..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate Prisma Client
Write-Host "Step 1: Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}
Write-Host "Prisma client generated successfully!" -ForegroundColor Green
Write-Host ""

# Step 2: Push schema to database
Write-Host "Step 2: Pushing schema to database..." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push schema to database" -ForegroundColor Red
    exit 1
}
Write-Host "Schema pushed successfully!" -ForegroundColor Green
Write-Host ""

# Step 3: Seed templates
Write-Host "Step 3: Seeding default templates..." -ForegroundColor Yellow
npx tsx scripts/seed-templates.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to seed templates" -ForegroundColor Red
    exit 1
}
Write-Host "Templates seeded successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "Templates system setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now:" -ForegroundColor White
Write-Host "  - Visit /templates to see all templates" -ForegroundColor White
Write-Host "  - Use templates in AI Studio" -ForegroundColor White
Write-Host "  - Create your own custom templates" -ForegroundColor White
Write-Host ""
Write-Host "Run 'npm run dev' to start the development server" -ForegroundColor Yellow
