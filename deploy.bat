@echo off
title NEET Student App - Quick Deploy
cls

echo ==========================================================
echo       NEET Student Hub - Quick Frontend Deployment
echo ==========================================================
echo.

:: Read saved Render URL
set "RENDER_URL="
if exist frontend\.env.production (
    for /f "tokens=2 delims==" %%i in ('findstr "VITE_API_BASE" frontend\.env.production') do set "RENDER_URL=%%i"
)

if "%RENDER_URL%"=="" (
    echo [ERROR] No saved Render URL found in frontend\.env.production.
    :prompt_url
    set /p RENDER_URL="Paste your Render Backend URL: "
    if "%RENDER_URL%"=="" (
        echo URL cannot be empty.
        goto prompt_url
    )
)

:: Remove trailing slash if present
if "%RENDER_URL:~-1%"=="/" set "RENDER_URL=%RENDER_URL:~0,-1%"

:: Save the URL
echo VITE_API_BASE=%RENDER_URL% > frontend\.env.production

echo Using Render Backend URL: %RENDER_URL%
echo.

:: Build Frontend
echo Building Frontend...
cd frontend
call npm install
call npm run build
cd ..
echo.

:: Deploy Frontend to Firebase Hosting
echo Deploying Frontend to Firebase Hosting...
call firebase deploy --only hosting --project neet-student-app-2026
echo.

:: Push changes to GitHub (so Render builds the latest codebase)
echo Committing and pushing latest changes to GitHub...
git add .
git commit -m "Auto-deploy: %DATE% %TIME%"
git push origin HEAD
echo.

:: Trigger Render Backend Auto-Deployment via Hook
echo Triggering Render Backend Auto-Deployment...
curl -s "https://api.render.com/deploy/srv-d89u4mrbc2fs73fj3bf0?key=oVj8Gm2h2Ag"
echo.

echo ==========================================================
echo                      SUCCESS!
echo ==========================================================
echo Frontend deployed to Firebase Hosting!
echo Backend deployment triggered on Render!
echo.
pause
