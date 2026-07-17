@echo off
echo ==========================================
echo Starting Thap Rua Clinical Copilot...
echo ==========================================

echo [1/2] Starting Backend (Port 4000)...
start "Thap Rua - Backend" cmd /k "npm run dev:backend"

echo [2/2] Starting Frontend (Port 5173)...
start "Thap Rua - Frontend" cmd /k "npm run dev:frontend"

echo Both services are starting in separate windows!
echo - Backend: http://localhost:4000
echo - Frontend: http://localhost:5173
echo.
echo You can close this window now. The services will keep running in their own windows.
