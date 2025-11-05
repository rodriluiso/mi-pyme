@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo MI-PYME - Setup de Runtimes Portables
echo ========================================
echo.

REM Crear directorios
echo [1/4] Creando directorios...
if not exist "electron-app\runtime" mkdir "electron-app\runtime"
if not exist "electron-app\runtime\python" mkdir "electron-app\runtime\python"
if not exist "electron-app\runtime\node" mkdir "electron-app\runtime\node"
if not exist "temp_downloads" mkdir "temp_downloads"

REM Descargar Python
echo [2/4] Descargando Python 3.11...
if not exist "electron-app\runtime\python\python.exe" (
    echo    Descargando Python Embeddable...
    curl -L -o "temp_downloads\python.zip" "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"

    echo    Extrayendo Python...
    tar -xf "temp_downloads\python.zip" -C "electron-app\runtime\python"

    echo    Configurando pip...
    curl -L -o "electron-app\runtime\python\get-pip.py" "https://bootstrap.pypa.io/get-pip.py"

    REM Modificar python311._pth
    echo python311.zip> "electron-app\runtime\python\python311._pth"
    echo .>> "electron-app\runtime\python\python311._pth"
    echo Lib\site-packages>> "electron-app\runtime\python\python311._pth"
    echo import site>> "electron-app\runtime\python\python311._pth"

    echo    Instalando pip...
    electron-app\runtime\python\python.exe electron-app\runtime\python\get-pip.py

    echo    Instalando dependencias de Django (esto puede tardar varios minutos)...
    electron-app\runtime\python\python.exe -m pip install -r backend\requirements.txt --no-warn-script-location

    echo    OK Python instalado correctamente
) else (
    echo    OK Python ya existe
)

REM Descargar Node.js
echo [3/4] Descargando Node.js...
if not exist "electron-app\runtime\node\node.exe" (
    echo    Descargando Node.js...
    curl -L -o "temp_downloads\node.zip" "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"

    echo    Extrayendo Node.js...
    tar -xf "temp_downloads\node.zip" -C "temp_downloads"

    REM Mover archivos
    xcopy /E /I /Y "temp_downloads\node-v20.18.0-win-x64" "electron-app\runtime\node"

    echo    Instalando serve...
    electron-app\runtime\node\npm.cmd install -g serve --prefix electron-app\runtime\node

    echo    OK Node.js instalado correctamente
) else (
    echo    OK Node.js ya existe
)

REM Generar SECRET_KEY
echo [4/4] Generando SECRET_KEY...
echo.
echo IMPORTANTE: Ejecuta este comando y copia el resultado a backend\.env.production:
echo.
echo     python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
echo.

REM Limpiar temporales
echo Limpiando archivos temporales...
if exist "temp_downloads" rmdir /S /Q "temp_downloads"

echo.
echo ========================================
echo Setup completado!
echo ========================================
echo.
echo Proximos pasos:
echo 1. Generar SECRET_KEY y actualizar backend\.env.production
echo 2. Ejecutar: cd electron-app ^&^& npm run build:win
echo 3. Encontrar MI-PYME.exe en electron-app\dist\
echo.

pause
