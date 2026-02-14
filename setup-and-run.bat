@echo off
echo ================================
echo FlowSmartly Setup Script
echo ================================
echo.

cd /d "%~dp0"

echo [1/3] Pushing database schema...
call npx prisma db push --accept-data-loss
if %errorlevel% neq 0 (
    echo ERROR: Failed to push database schema
    pause
    exit /b 1
)
echo Done!
echo.

echo [2/3] Creating Super Admin user...
call npx tsx scripts/create-super-admin.ts
if %errorlevel% neq 0 (
    echo ERROR: Failed to create super admin
    pause
    exit /b 1
)
echo.

echo [3/3] Starting development server...
echo.
echo ================================
echo Server starting at http://localhost:3000
echo Admin login at http://localhost:3000/admin/login
echo ================================
echo.
call npm run dev
