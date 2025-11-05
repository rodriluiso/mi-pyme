@echo off
REM Script de backup para Windows

echo ========================================
echo   Backup Sistema PYME
echo ========================================
echo.

REM Crear directorio de backups si no existe
if not exist "backups\" mkdir backups

REM Nombre del archivo con fecha
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set datetime=%mydate%_%mytime%

set BACKUP_FILE=backups\backup_%datetime%.zip

echo [1/3] Haciendo backup de la base de datos...
REM Para SQLite (desarrollo)
if exist "backend\db.sqlite3" (
    copy "backend\db.sqlite3" "backups\db_%datetime%.sqlite3"
)

REM Para PostgreSQL (descomentar y configurar)
REM pg_dump -U pyme_user -h localhost pyme_db > backups\db_%datetime%.sql

echo [2/3] Haciendo backup de archivos media...
if exist "backend\media\" (
    xcopy /E /I /Y "backend\media" "backups\media_%datetime%\"
)

echo [3/3] Creando archivo comprimido...
REM Requiere 7-Zip instalado o PowerShell
powershell Compress-Archive -Path backups\db_%datetime%.* -DestinationPath %BACKUP_FILE%

echo.
echo ========================================
echo   Backup Completado
echo ========================================
echo.
echo Archivo: %BACKUP_FILE%
echo.

REM Limpiar backups antiguos (más de 30 días)
echo Limpiando backups antiguos...
forfiles /p "backups" /s /m *.zip /d -30 /c "cmd /c del @path" 2>nul

echo.
pause
