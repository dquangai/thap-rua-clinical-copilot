@echo off
echo ==========================================
echo Starting Thap Rua Clinical Copilot...
echo ==========================================

echo [1/2] Starting Backend (Port 4000)...
start "Thap Rua - Backend" /D "%~dp0backend\api" cmd /k call start.bat

echo [2/2] Starting Frontend (Port 5173)...
start "Thap Rua - Frontend" /D "%~dp0" cmd /k npm run dev:frontend

echo Both services are starting in separate windows.
echo - Backend: http://127.0.0.1:4000
echo - Frontend: http://127.0.0.1:5173
echo.
echo You can close this window. The service windows will remain open.