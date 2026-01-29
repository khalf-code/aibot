@echo off
echo ========================================
echo   Installing Dependencies
echo ========================================
echo.

cd /d "%~dp0"

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm not found in PATH
    pause
    exit /b 1
)

echo Installing dependencies with npm...
call npm install

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Installation Complete
    echo ========================================
    if exist node_modules (
        echo node_modules directory created successfully
    ) else (
        echo Warning: node_modules not found
    )
) else (
    echo.
    echo ========================================
    echo   Installation Failed
    echo ========================================
    echo Error code: %ERRORLEVEL%
)

pause
