@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title POS e Inventario Resiliente

echo.
echo ============================================================
echo   POS e Inventario Resiliente para Emprendedores
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js.
  echo Instala Node.js 20.19+ o 22.12+ desde https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro npm.
  echo Reinstala Node.js incluyendo npm.
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] No se encontro package.json.
  echo Ejecuta este archivo desde la carpeta del proyecto.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias por primera vez...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
  echo.
)

echo Iniciando la aplicacion...
echo El navegador se abrira automaticamente en http://localhost:5173/
echo Para detener el servidor presiona Ctrl+C en esta ventana.
echo.

call npm run dev

echo.
echo El servidor se detuvo.
pause
