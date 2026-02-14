@echo off
echo ============================================
echo FlowSmartly Templates Setup Script
echo ============================================
echo.

echo Step 1: Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo Failed to generate Prisma client
    exit /b 1
)
echo Prisma client generated successfully!
echo.

echo Step 2: Pushing schema to database...
call npx prisma db push
if errorlevel 1 (
    echo Failed to push schema to database
    exit /b 1
)
echo Schema pushed successfully!
echo.

echo Step 3: Seeding default templates...
call npx tsx scripts/seed-templates.ts
if errorlevel 1 (
    echo Failed to seed templates
    exit /b 1
)
echo Templates seeded successfully!
echo.

echo ============================================
echo Templates system setup complete!
echo ============================================
echo.
echo You can now:
echo   - Visit /templates to see all templates
echo   - Use templates in AI Studio
echo   - Create your own custom templates
echo.
echo Run 'npm run dev' to start the development server
pause
