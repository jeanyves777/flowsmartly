@echo off
setlocal

REM Add Node.js to PATH
set PATH=C:\Program Files\nodejs;%PATH%

echo ============================================
echo FlowSmartly Templates Setup
echo ============================================
echo.

cd /d "%~dp0"

echo Step 1: Generating Prisma Client...
call npm run db:generate
if errorlevel 1 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)
echo SUCCESS: Prisma client generated!
echo.

echo Step 2: Pushing schema to database...
call npm run db:push
if errorlevel 1 (
    echo ERROR: Failed to push schema
    pause
    exit /b 1
)
echo SUCCESS: Schema pushed!
echo.

echo Step 3: Seeding templates...
call npm run db:seed-templates
if errorlevel 1 (
    echo ERROR: Failed to seed templates
    pause
    exit /b 1
)
echo SUCCESS: Templates seeded!
echo.

echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Run 'npm run dev' to start the server
echo.
pause
