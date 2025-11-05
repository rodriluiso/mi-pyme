@echo off
REM Script para iniciar la aplicación en Windows (Desarrollo/Producción Local)

echo ========================================
echo   Iniciando Sistema PYME
echo ========================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist "backend\" (
    echo ERROR: No se encuentra el directorio backend
    echo Por favor ejecuta este script desde la raíz del proyecto
    pause
    exit /b 1
)

REM Iniciar Backend
echo [1/2] Iniciando Backend Django...
start "PYME Backend" cmd /k "cd backend && python manage.py runserver"
timeout /t 3 /nobreak > nul

REM Iniciar Frontend
echo [2/2] Iniciando Frontend React...
start "PYME Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   Sistema PYME Iniciado
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5174
echo Admin:    http://localhost:8000/admin
echo.
echo Presiona Ctrl+C en cada ventana para detener
echo ========================================
