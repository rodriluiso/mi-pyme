@echo off
echo Matando proceso Vite en puerto 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo Proceso terminado.
timeout /t 2 >nul