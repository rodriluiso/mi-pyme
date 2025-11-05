@echo off
REM Script de configuración para producción en Windows Server

echo ========================================
echo   Configuración de Producción - Windows
echo ========================================
echo.

REM Verificar privilegios de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Este script requiere privilegios de administrador
    echo Por favor ejecuta como Administrador
    pause
    exit /b 1
)

echo [1/6] Verificando Python...
python --version
if %errorLevel% neq 0 (
    echo ERROR: Python no está instalado o no está en PATH
    echo Descarga Python desde: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [2/6] Verificando Node.js...
node --version
if %errorLevel% neq 0 (
    echo ERROR: Node.js no está instalado o no está en PATH
    echo Descarga Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)

echo [3/6] Instalando dependencias del Backend...
cd backend
if not exist "venv\" (
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
cd ..

echo [4/6] Instalando dependencias del Frontend...
cd frontend
call npm install
cd ..

echo [5/6] Configurando variables de entorno...
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo ADVERTENCIA: Edita backend\.env con tu configuración de producción
    echo - Cambia DJANGO_SECRET_KEY
    echo - Configura DJANGO_DEBUG=False
    echo - Actualiza DJANGO_ALLOWED_HOSTS
    echo - Configura la base de datos PostgreSQL
)

echo [6/6] Ejecutando migraciones...
cd backend
call venv\Scripts\activate
python manage.py migrate
cd ..

echo.
echo ========================================
echo   Configuración Completada
echo ========================================
echo.
echo PRÓXIMOS PASOS:
echo 1. Edita backend\.env con tu configuración
echo 2. Crea un superusuario: cd backend ^&^& python manage.py createsuperuser
echo 3. Compila el frontend: cd frontend ^&^& npm run build
echo 4. Configura el servidor web (IIS o usa scripts\start-production.bat)
echo.
echo Para producción local simple, usa: scripts\start-production.bat
echo.
pause
