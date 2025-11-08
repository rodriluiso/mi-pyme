@echo off
echo ========================================
echo  MI-PYME Desktop - Build Script
echo ========================================
echo.

echo [1/4] Compilando frontend...
cd ..\frontend
call npm run build
if errorlevel 1 (
    echo ERROR: Fallo al compilar frontend
    pause
    exit /b 1
)
echo OK - Frontend compilado
echo.

echo [2/4] Volviendo a electron-app...
cd ..\electron-app
echo.

echo [3/4] Instalando dependencias de Electron...
call npm install
if errorlevel 1 (
    echo ERROR: Fallo al instalar dependencias
    pause
    exit /b 1
)
echo OK - Dependencias instaladas
echo.

echo [4/4] Compilando instalador de Windows...
call npm run build:win
if errorlevel 1 (
    echo ERROR: Fallo al compilar instalador
    pause
    exit /b 1
)
echo.
echo ========================================
echo  BUILD COMPLETADO!
echo ========================================
echo.
echo El instalador esta en: electron-app\dist\
dir dist\*.exe
echo.
pause
