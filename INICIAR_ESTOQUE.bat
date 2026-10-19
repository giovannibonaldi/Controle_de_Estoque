@echo off
chcp 65001 > nul
title Estoque Azul V10 - Servidor
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 22 ou superior em https://nodejs.org/
  pause
  exit /b 1
)
echo.
echo Estoque Azul V10 - apresentação, login e permissões
node --version
echo.
echo Acesse http://127.0.0.1:3000 no navegador.
echo Deixe esta janela aberta enquanto usar o sistema.
start "" /min cmd /c "timeout /t 3 /nobreak ^>nul ^& start http://127.0.0.1:3000"
node server.js
echo.
echo O servidor foi encerrado.
pause
