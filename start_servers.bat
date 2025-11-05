@echo off
echo Deteniendo servidores existentes...
taskkill /F /IM python.exe /IM node.exe 2>nul
timeout /t 3 /nobreak >nul

echo.
echo Iniciando servidor Django en puerto 8000...
start "Django Server" cmd /k "cd backend && python manage.py runserver"

timeout /t 5 /nobreak >nul

echo.
echo Iniciando servidor React en puerto 5174...
start "React Server" cmd /k "cd frontend && npm run dev"

echo.
echo Servidores iniciados!
echo - Django: http://127.0.0.1:8000
echo - React: http://localhost:5174
echo.
pause
