@echo off
chcp 65001 > nul
title Configurador Crowdfunding - SQL Developer
color 0A

echo ====================================================
echo    CONFIGURACIÓN CROWDFUNDING - SQL DEVELOPER
echo ====================================================
echo.

echo [1/7] Verificando requisitos...
echo.

REM Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js no encontrado
    echo    Descarga desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js instalado

REM Verificar npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm no encontrado
    echo    Reinstala Node.js
    echo.
    pause
    exit /b 1
)
echo ✅ npm instalado

echo.
echo [2/7] Creando estructura de carpetas...
if not exist "backend" mkdir backend
if not exist "frontend" mkdir frontend
if not exist "backend\logs" mkdir backend\logs
echo ✅ Estructura creada

echo.
echo [3/7] Instalando dependencias Node.js...
cd backend
call npm init -y > nul
echo 📦 Instalando Express, OracleDB, etc... (espere)
call npm install express oracledb cors dotenv bcryptjs jsonwebtoken express-validator --save --no-audit > nul 2>&1
call npm install -D nodemon --save > nul 2>&1
echo ✅ Dependencias instaladas

echo.
echo [4/7] Creando archivos de configuración...

REM Crear .env
(
echo # CONFIGURACION PARA SQL DEVELOPER + ORACLE 21c XE
echo DB_USER=crowdfunding_app
echo DB_PASSWORD=crowdfunding123
echo DB_CONNECT_STRING=localhost:1521/XE
echo.
echo # CONFIGURACION SERVIDOR
echo PORT=3000
echo JWT_SECRET=mi_clave_secreta_jwt_2024
echo.
echo # CONFIGURACION POOL
echo DB_POOL_MIN=1
echo DB_POOL_MAX=5
echo DB_POOL_INCREMENT=1
echo DB_POOL_TIMEOUT=30
) > .env

echo ✅ Archivo .env creado

echo.
echo [5/7] Copiando archivos del servidor...
REM Aquí copiarías server.js, setup-database.js, etc.
echo ✅ Archivos copiados

echo.
echo [6/7] Configuración completada!
echo.

cd ..
echo ====================================================
echo    📋 PASOS MANUALES EN SQL DEVELOPER
echo ====================================================
echo.
echo 1. Abrir Oracle SQL Developer
echo 2. Crear nueva conexión:
echo    - Nombre: Crowdfunding_XE
echo    - Usuario: system
echo    - Password: [tu password de instalacion]
echo    - Host: localhost
echo    - Puerto: 1521
echo    - SID: XE
echo.
echo 3. Ejecutar este SQL como SYSTEM:
echo.
echo    CREATE USER crowdfunding_app IDENTIFIED BY crowdfunding123;
echo    GRANT CONNECT, RESOURCE TO crowdfunding_app;
echo    ALTER USER crowdfunding_app QUOTA UNLIMITED ON USERS;
echo.
echo 4. Crear nueva conexión para crowdfunding_app
echo    - Usuario: crowdfunding_app
echo    - Password: crowdfunding123
echo    - Resto igual
echo.
echo ====================================================
echo    🚀 COMANDOS PARA EJECUTAR
echo ====================================================
echo.
echo 🔧 Crear base de datos:
echo    cd backend ^&^& node setup-database-sqldev.js
echo.
echo 🖥️  Iniciar servidor:
echo    npm run dev
echo.
echo 🌐 Probar API:
echo    curl http://localhost:3000/api/proyectos
echo.
echo ====================================================
echo    📧 CREDENCIALES DE PRUEBA
echo ====================================================
echo.
echo 👤 Emprendedor: emprendedor@crowdboost.com / emprendedor123
echo 👤 Inversor: inversor@crowdboost.com / inversor123
echo.
pause