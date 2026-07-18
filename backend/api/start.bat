@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Khong tim thay backend\api\.venv\Scripts\python.exe
  echo Hay tao virtual environment va cai dependencies truoc.
  exit /b 1
)

echo Starting Thap Rua Clinical API at http://127.0.0.1:4000
echo Press Ctrl+C to stop.
".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 4000

exit /b %errorlevel%
