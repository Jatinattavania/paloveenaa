@echo off
rem Starts the new Paloveenaa website (HTML + Tailwind + JS) at http://localhost:8080
cd /d "%~dp0"
if not exist node_modules (
  echo Installing tools for the first time...
  call npm install
)
start "" http://localhost:8080
call npx http-server website -p 8080 -c-1
