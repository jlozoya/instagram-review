@echo off
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul
if not errorlevel 1 (
  echo Instalando dependencias con pnpm...
  call pnpm install
  if errorlevel 1 goto :error

  echo Generando ejecutable portable e instalador para Windows...
  call pnpm run dist:win:all
  if errorlevel 1 goto :error
  goto :done
)

where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro pnpm ni npm. Instala Node.js LTS y pnpm para Windows.
  pause
  exit /b 1
)

echo pnpm no esta instalado; compilando con npm...
call npm install
if errorlevel 1 goto :error
call npm run dist:win:all
if errorlevel 1 goto :error

goto :done

:done
echo.
echo Listo. Los ejecutables con icono se encuentran en la carpeta dist.
explorer "%cd%\dist"
pause
exit /b 0

:error
echo.
echo No se pudo generar el ejecutable. Revisa el mensaje anterior.
pause
exit /b 1
