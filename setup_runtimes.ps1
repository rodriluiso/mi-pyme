# Script de configuración automática de runtimes portables
# Ejecutar desde PowerShell como administrador

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MI-PYME - Setup de Runtimes Portables" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Rutas
$rootDir = $PSScriptRoot
$electronDir = Join-Path $rootDir "electron-app"
$runtimeDir = Join-Path $electronDir "runtime"
$pythonDir = Join-Path $runtimeDir "python"
$nodeDir = Join-Path $runtimeDir "node"
$pgsqlDir = Join-Path $runtimeDir "pgsql"
$tempDir = Join-Path $rootDir "temp_downloads"

# Crear directorios
Write-Host "[1/6] Creando estructura de directorios..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# Descargar Python Embeddable
Write-Host "[2/6] Descargando Python 3.11 Embeddable..." -ForegroundColor Yellow
$pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
$pythonZip = Join-Path $tempDir "python.zip"

if (-not (Test-Path $pythonDir)) {
    try {
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonZip
        Expand-Archive -Path $pythonZip -DestinationPath $pythonDir -Force
        Write-Host "  ✓ Python descargado y extraído" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Error descargando Python: $_" -ForegroundColor Red
        Write-Host "  → Descarga manual desde: $pythonUrl" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ Python ya existe" -ForegroundColor Green
}

# Configurar Python con pip
Write-Host "[3/6] Configurando pip en Python embebido..." -ForegroundColor Yellow

if (Test-Path $pythonDir) {
    # Descargar get-pip.py
    $getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
    $getPipPath = Join-Path $pythonDir "get-pip.py"

    try {
        Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPath

        # Modificar python311._pth para habilitar site-packages
        $pthFile = Get-ChildItem -Path $pythonDir -Filter "python*._pth" | Select-Object -First 1
        if ($pthFile) {
            $pthContent = Get-Content $pthFile.FullName
            $pthContent = $pthContent -replace "^#import site", "import site"
            if ($pthContent -notcontains "Lib\site-packages") {
                $pthContent += "Lib\site-packages"
            }
            Set-Content -Path $pthFile.FullName -Value $pthContent
            Write-Host "  ✓ Archivo ._pth configurado" -ForegroundColor Green
        }

        # Instalar pip
        $pythonExe = Join-Path $pythonDir "python.exe"
        & $pythonExe $getPipPath
        Write-Host "  ✓ pip instalado" -ForegroundColor Green

        # Instalar dependencias de Django
        $requirementsPath = Join-Path $rootDir "backend\requirements.txt"
        if (Test-Path $requirementsPath) {
            Write-Host "  → Instalando dependencias de Django (esto puede tardar varios minutos)..." -ForegroundColor Cyan
            & $pythonExe -m pip install -r $requirementsPath --no-warn-script-location
            Write-Host "  ✓ Dependencias instaladas" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠ Error configurando pip: $_" -ForegroundColor Red
    }
}

# Descargar Node.js
Write-Host "[4/6] Descargando Node.js..." -ForegroundColor Yellow
$nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
$nodeZip = Join-Path $tempDir "node.zip"

if (-not (Test-Path $nodeDir)) {
    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
        Expand-Archive -Path $nodeZip -DestinationPath $tempDir -Force

        # Mover contenido de la carpeta extraída a nodeDir
        $extractedNodeDir = Get-ChildItem -Path $tempDir -Filter "node-*" -Directory | Select-Object -First 1
        Move-Item -Path $extractedNodeDir.FullName -Destination $nodeDir -Force

        Write-Host "  ✓ Node.js descargado y extraído" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Error descargando Node.js: $_" -ForegroundColor Red
        Write-Host "  → Descarga manual desde: $nodeUrl" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ Node.js ya existe" -ForegroundColor Green
}

# Instalar serve en Node.js
Write-Host "[5/6] Instalando serve en Node.js..." -ForegroundColor Yellow

if (Test-Path $nodeDir) {
    try {
        $npmCmd = Join-Path $nodeDir "npm.cmd"
        & $npmCmd install -g serve --prefix $nodeDir
        Write-Host "  ✓ serve instalado" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Error instalando serve: $_" -ForegroundColor Red
    }
}

# PostgreSQL (opcional)
Write-Host "[6/6] PostgreSQL..." -ForegroundColor Yellow
Write-Host "  → PostgreSQL debe descargarse manualmente" -ForegroundColor Cyan
Write-Host "  → URL: https://www.enterprisedb.com/download-postgresql-binaries" -ForegroundColor Cyan
Write-Host "  → Extraer en: $pgsqlDir" -ForegroundColor Cyan
Write-Host "  → O usa SQLite (más simple, configuración por defecto)" -ForegroundColor Yellow

# Limpiar archivos temporales
Write-Host "" -ForegroundColor Yellow
Write-Host "Limpiando archivos temporales..." -ForegroundColor Yellow
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ Setup completado!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Revisar backend/.env.production" -ForegroundColor White
Write-Host "2. Ejecutar: cd electron-app && npm run build:win" -ForegroundColor White
Write-Host "3. Encontrar MI-PYME.exe en electron-app/dist/" -ForegroundColor White
Write-Host ""
Write-Host "Ver GUIA_EMPAQUETADO.md para más detalles." -ForegroundColor Yellow
