@echo off
echo ========================================
echo  Instalador de Rust para MI-PYME Tauri
echo ========================================
echo.
echo Este script descargara e instalara Rust.
echo Rust es necesario para compilar aplicaciones Tauri.
echo.
echo Presiona cualquier tecla para continuar o Ctrl+C para cancelar...
pause >nul

echo.
echo Descargando rustup-init.exe...
curl -o %TEMP%\rustup-init.exe https://win.rustup.rs/x86_64

if errorlevel 1 (
    echo.
    echo ERROR: No se pudo descargar rustup-init.exe
    echo Verifica tu conexion a internet.
    pause
    exit /b 1
)

echo.
echo Ejecutando instalador de Rust...
echo.
echo IMPORTANTE:
echo - Acepta las opciones por defecto (opcion 1)
echo - La instalacion puede tardar 5-10 minutos
echo.
%TEMP%\rustup-init.exe

if errorlevel 1 (
    echo.
    echo ERROR: La instalacion de Rust fallo
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Rust instalado correctamente!
echo ========================================
echo.
echo IMPORTANTE: Cierra esta ventana y abre una NUEVA terminal
echo para que los cambios surtan efecto.
echo.
echo Luego ejecuta: npm run tauri dev
echo.
pause
