@echo off
title NEET Student App - Deployment Automation
cls

echo ==========================================================
echo       NEET Student Hub - Deployment Automation Script
echo ==========================================================
echo.

:: Step 1: Git Repository Setup & Push to GitHub
echo [STEP 1] Initializing Git and Pushing to GitHub...
echo ----------------------------------------------------------
git init
git remote remove origin >nul 2>&1
git remote add origin https://github.com/NEET-STUDENT-APP/NEET-STUDENT-APP.git
git branch -M main
git add .
git commit -m "Deploy: frontend and backend setup"
echo Pushing codebase to GitHub (main branch)...
git push -u origin main -f
if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Git push failed on main. Let's try pushing to the "master" branch instead...
    git branch -M master
    git push -u origin master -f
)
echo.
echo Git push completed!
echo.

:: Step 2: Render Backend Deployment Instruction
echo [STEP 2] Set up the Render Web Service
echo ----------------------------------------------------------
echo 1. Go to your Render Dashboard: https://dashboard.render.com
echo 2. Click "New" -> "Web Service"
echo 3. Connect the GitHub repository: https://github.com/NEET-STUDENT-APP/NEET-STUDENT-APP
echo 4. Set the following settings:
echo    - Name: neet-student-app-api
echo    - Root Directory: backend
echo    - Runtime: Node
echo    - Build Command: npm install
echo    - Start Command: node server.js
echo.
echo 5. Expand "Advanced" and add the following Environment Variables:
echo    - PORT : 10000
echo    - DB_HOST : gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com
echo    - DB_PORT : 4000
echo    - DB_USER : BN9g9KwP2SU7dzo.root
echo    - DB_PASSWORD : zgPC6S0XPVFzn2zN
echo    - DB_NAME : neet_db
echo    - JWT_SECRET : NeetStudentAppSecretKey2026!@#
echo    - IMGBB_API_KEY : 1a966379cb23b1ba6e42166f0a4ee38f
echo.
echo 6. Click "Create Web Service" and wait for it to deploy.
echo 7. Once deployed, copy your Render Web Service URL.
echo    (It looks like: https://neet-student-app-api-xxxx.onrender.com)
echo.
pause
echo.

:: Step 3: Prompt for Render URL
echo [STEP 3] Configuring Frontend with Render Backend URL
echo ----------------------------------------------------------
set "RENDER_URL="
if exist frontend\.env.production (
    for /f "tokens=2 delims==" %%i in ('findstr "VITE_API_BASE" frontend\.env.production') do set "RENDER_URL=%%i"
)

if not "%RENDER_URL%"=="" (
    echo Using existing saved Render URL: %RENDER_URL%
) else (
    :prompt_url
    set /p RENDER_URL="Paste your Render Web Service URL: "
    if "%RENDER_URL%"=="" (
        echo URL cannot be empty. Please paste your Render URL.
        goto prompt_url
    )
)
:: Remove trailing slash if present
if "%RENDER_URL:~-1%"=="/" set "RENDER_URL=%RENDER_URL:~0,-1%"

echo Writing Render backend URL to frontend configuration...
echo VITE_API_BASE=%RENDER_URL% > frontend\.env.production
echo.

:: Step 4: Build Frontend
echo [STEP 4] Building Frontend Production Bundle...
echo ----------------------------------------------------------
cd frontend
call npm install
call npm run build
cd ..
echo.

:: Step 5: Deploy Frontend to Firebase Hosting
echo [STEP 5] Deploying Frontend to Firebase Hosting...
echo ----------------------------------------------------------
call firebase deploy --only hosting --project neet-student-app-2026
echo.
echo ==========================================================
echo                      SUCCESS!
echo ==========================================================
echo Your frontend is deployed to Firebase Hosting.
echo Your backend is deploying on Render at: %RENDER_URL%
echo.
pause
