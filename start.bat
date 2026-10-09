@echo off
rem ============================================================
rem  AI School - local server launcher
rem  ASCII only. Uses Node.js server.mjs (cache disabled).
rem
rem  !! DO NOT switch this to "python -m http.server" !!
rem  Python's built-in server sends NO Cache-Control header, so
rem  the browser applies heuristic caching to ES modules. Result:
rem  after you edit a .js file, a plain refresh still runs the OLD
rem  code. Our server.mjs sets no-store on every response.
rem ============================================================
cd /d "%~dp0"

set PORT=8300

echo ============================================
echo   AI School - Local Server
echo ============================================
echo.

rem ---- Locate a Node.js runtime ----
rem 1) node on PATH  2) managed node  3) standard install
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"

if not defined NODE_EXE (
  for /d %%D in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do (
    if not defined NODE_EXE if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
  )
)

if not defined NODE_EXE (
  if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

if not defined NODE_EXE (
  echo [!] Node.js was not found on this computer.
  echo     Please install Node.js LTS from nodejs.org
  echo.
  pause
  exit /b 1
)

echo Using Node: %NODE_EXE%
echo Starting server on http://127.0.0.1:%PORT%/
echo If the page does not open by itself, visit the address above.
echo Close this window to stop the server.
echo.

rem  !! "%~dp0" ends with a backslash; inside quotes that trailing
rem  !!"\" escapes the closing quote when Node parses argv, so the
rem  !! path argument silently VANISHES and the port number becomes
rem  !! the web root -> every request 404s. Appending "." fixes it.
"%NODE_EXE%" "%~dp0server.mjs" "%~dp0." %PORT%

pause
