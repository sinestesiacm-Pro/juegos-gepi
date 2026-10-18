@echo off
REM Inicia el juego Gepiclub JetSki en http://localhost:5173
cd /d "%~dp0"
start "" http://localhost:5173
npx --yes http-server . -p 5173 -a 127.0.0.1 -c-1
