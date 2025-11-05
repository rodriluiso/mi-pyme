@echo off
REM Script para iniciar en modo producción (Windows)

echo ========================================
echo   Iniciando Sistema PYME - PRODUCCIÓN
echo ========================================
echo.

REM Verificar que existe .env
if not exist "backend\.env" (
    echo ERROR: No existe backend\.env
    echo Ejecuta primero: scripts\setup-production-windows.bat
    pause
    exit /b 1
)

REM Compilar frontend
echo [1/3] Compilando Frontend...
cd frontend
call npm run build
cd ..

REM Recolectar archivos estáticos de Django
echo [2/3] Recolectando archivos estáticos...
cd backend
call venv\Scripts\activate
python manage.py collectstatic --noinput
cd ..

REM Iniciar con Gunicorn
echo [3/3] Iniciando servidor de producción...
echo.
echo Backend corriendo en: http://0.0.0.0:8000
echo.
cd backend
call venv\Scripts\activate
gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120

pause
