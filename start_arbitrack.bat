@echo off
title ArbiTrack P2P - Auto Starter
color 0A

echo ========================================================
echo               ArbiTrack P2P Local System
echo ========================================================
echo.

echo [1/2] Levantando el Servidor Proxy (Firma de API Binance)...
start "ArbiTrack Proxy Server" cmd /k "node server/proxy.js"

echo [2/2] Levantando la Interfaz de Usuario (React)...
start "ArbiTrack Frontend" cmd /k "npm run dev"

echo.
echo ========================================================
echo   ¡Todo esta corriendo!
echo   Vite abrira automaticamente la aplicacion web.
echo   Si no lo hace, visita en tu navegador: 
echo   http://localhost:5173
echo ========================================================
echo.
pause
