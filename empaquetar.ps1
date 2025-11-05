# Script de empaquetado de MI-PYME para distribución
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EMPAQUETADO DE MI-PYME PARA DISTRIBUCION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$distDir = "mi-pyme-distribucion"

# Eliminar carpeta anterior si existe
if (Test-Path $distDir) {
    Write-Host "[0/7] Eliminando distribución anterior..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $distDir
}

# Crear carpeta de distribución
Write-Host "[1/7] Creando estructura..." -ForegroundColor Green
New-Item -ItemType Directory -Path $distDir | Out-Null
New-Item -ItemType Directory -Path "$distDir\backend" | Out-Null
New-Item -ItemType Directory -Path "$distDir\frontend" | Out-Null
New-Item -ItemType Directory -Path "$distDir\infra" | Out-Null

# Copiar backend (excluyendo archivos innecesarios)
Write-Host "[2/7] Copiando backend..." -ForegroundColor Green
$excludeBackend = @('__pycache__', '*.pyc', '*.pyo', '.pytest_cache', 'db.sqlite3', 'db.sqlite3.backup*', '*.log')
Get-ChildItem -Path "backend" -Recurse | Where-Object {
    $item = $_
    -not ($excludeBackend | Where-Object { $item.FullName -like "*$_*" })
} | Copy-Item -Destination { Join-Path "$distDir\backend" $_.FullName.Substring((Get-Location).Path.Length + 8) } -Force

# Copiar frontend construido
Write-Host "[3/7] Copiando frontend..." -ForegroundColor Green
Copy-Item -Path "frontend\dist\*" -Destination "$distDir\frontend" -Recurse -Force

# Copiar docker-compose
Write-Host "[4/7] Copiando configuración Docker..." -ForegroundColor Green
Copy-Item -Path "infra\docker-compose.yml" -Destination "$distDir\infra\" -Force

# Crear archivo de requirements
Write-Host "[5/7] Creando requirements.txt..." -ForegroundColor Green
@"
django==5.1
djangorestframework==3.15.2
django-cors-headers==4.6.0
psycopg2-binary==2.9.10
cryptography==44.0.0
django-axes==7.0.0
python-dotenv==1.0.1
"@ | Out-File -FilePath "$distDir\requirements.txt" -Encoding utf8

# Crear script de inicio
Write-Host "[6/7] Creando script de inicio..." -ForegroundColor Green
@"
@echo off
echo ========================================
echo MI-PYME - INICIANDO SISTEMA
echo ========================================
echo.

echo [1/4] Verificando Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python no esta instalado
    echo Por favor instale Python 3.10 o superior desde python.org
    pause
    exit /b 1
)

echo [2/4] Verificando Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker no esta instalado
    echo Por favor instale Docker Desktop desde docker.com
    pause
    exit /b 1
)

echo [3/4] Iniciando PostgreSQL en Docker...
cd infra
docker-compose up -d db
cd ..
timeout /t 5 /nobreak >nul

echo [4/4] Instalando dependencias de Python...
pip install -r requirements.txt --quiet

echo Aplicando migraciones...
cd backend
python manage.py migrate --noinput

echo.
echo ========================================
echo SISTEMA LISTO!
echo ========================================
echo.
echo Abriendo navegador en http://localhost:8000
echo.
echo Para detener el sistema, presione Ctrl+C
echo.
start http://localhost:8000
python manage.py runserver 8000 --noreload
"@ | Out-File -FilePath "$distDir\INICIAR_SISTEMA.bat" -Encoding utf8

# Crear README
Write-Host "[7/7] Creando documentación..." -ForegroundColor Green
@"
# MI-PYME - INSTRUCCIONES DE INSTALACION

## Requisitos Previos

1. **Python 3.10 o superior**
   - Descargar desde: https://www.python.org/downloads/
   - Durante la instalación, marcar "Add Python to PATH"

2. **Docker Desktop**
   - Descargar desde: https://www.docker.com/products/docker-desktop/
   - Iniciar Docker Desktop antes de usar la aplicación

## Instalación

1. Descomprimir este archivo en la ubicación deseada
2. Asegurarse de que Docker Desktop esté corriendo
3. Ejecutar ``INICIAR_SISTEMA.bat``

## Primer Uso

La primera vez que ejecute el sistema:
- Se descargará PostgreSQL en Docker (~100MB)
- Se instalarán las dependencias de Python
- Se aplicarán las migraciones de base de datos
- Esto puede tardar 5-10 minutos

## Uso Regular

1. Abrir Docker Desktop
2. Ejecutar ``INICIAR_SISTEMA.bat``
3. El sistema abrirá automáticamente en el navegador

## Notas

- El sistema se ejecuta en: http://localhost:8000
- Los datos se guardan en Docker, persisten entre reinicios
- Para detener: Presionar Ctrl+C en la ventana del comando

## Archivos Incluidos

- ``backend/`` - Código del servidor Django
- ``frontend/`` - Aplicación web (React compilado)
- ``infra/`` - Configuración de base de datos (Docker)
- ``requirements.txt`` - Dependencias de Python
- ``INICIAR_SISTEMA.bat`` - Script de inicio

## Soporte

Para más información o soporte, contactar al administrador del sistema.
"@ | Out-File -FilePath "$distDir\README.md" -Encoding utf8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EMPAQUETADO COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Carpeta creada: $distDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor White
Write-Host "1. Comprimir la carpeta '$distDir' en un archivo ZIP" -ForegroundColor White
Write-Host "2. Transferir el ZIP a la otra PC" -ForegroundColor White
Write-Host "3. Descomprimir y ejecutar INICIAR_SISTEMA.bat" -ForegroundColor White
Write-Host ""

# Calcular tamaño
$size = (Get-ChildItem -Path $distDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Tamaño total: $([math]::Round($size, 2)) MB" -ForegroundColor Yellow
Write-Host ""
