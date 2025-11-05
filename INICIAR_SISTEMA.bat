@echo off
title MI-PYME - Sistema de Gestion Empresarial
color 0A

echo.
echo ========================================
echo      MI-PYME - Iniciando Sistema
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando Backend Django...
start "MI-PYME Backend" cmd /k "cd backend && python manage.py runserver 8000 --noreload"

echo.
echo Esperando a que Django inicie...
timeout /t 5 /nobreak >nul

echo [2/2] Iniciando Frontend React...
start "MI-PYME Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Esperando a que Vite inicie...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo      Sistema Iniciado Correctamente
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Abriendo navegador...
timeout /t 2 /nobreak >nul

start http://localhost:5173

echo.
echo ========================================
echo   MI-PYME esta corriendo!
echo.
echo   - NO CIERRES las ventanas de Backend y Frontend
echo   - Para detener, cierra ambas ventanas
echo ========================================
echo.
pause
