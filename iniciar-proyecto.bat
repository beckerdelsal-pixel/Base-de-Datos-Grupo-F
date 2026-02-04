@echo off
chcp 65001 > nul
title Crowdfunding Platform - Oracle 21c XE
color 0A

echo =============================================
echo    PLATAFORMA CROWDFUNDING - ORACLE 21c XE
echo =============================================
echo.

echo [1/4] Probando conexión Oracle...
cd backend
node test-conexion-final.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ Error en la conexión. Verifica:
    echo    1. Oracle 21c XE corriendo
    echo    2. Usuario crowdfunding_app existe en XEPDB1
    echo    3. Archivo .env configurado correctamente
    pause
    exit /b 1
)

echo.
echo [2/4] ¿Deseas crear/recrear la base de datos? (S/N)
set /p respuesta=

if /I "%respuesta%"=="S" (
    echo.
    echo 📊 Creando base de datos...
    node setup-database.js
)

echo.
echo [3/4] Iniciando servidor backend...
echo    Servidor: http://localhost:3000
echo.
start cmd /k "npm run dev"

echo.
echo [4/4] ¿Abrir frontend en navegador? (S/N)
set /p abrir=

if /I "%abrir%"=="S" (
    echo 🌐 Abriendo frontend...
    start "" "frontend/index.html"
)

echo.
echo =============================================
echo    ✅ CONFIGURACIÓN COMPLETADA
echo =============================================
echo.
pause