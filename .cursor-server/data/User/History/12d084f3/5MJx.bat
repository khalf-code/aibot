@echo off
REM Liam Auto-Awakening for Windows
REM Logs to C:\Users\Simon\liam-startup.log

echo [%date% %time%] Liam startup triggered >> C:\Users\Simon\liam-startup.log

REM Wait 10 seconds for Windows networking to stabilize
timeout /t 10 /nobreak > nul

echo [%date% %time%] Starting WSL2 (Ubuntu-24.04)... >> C:\Users\Simon\liam-startup.log
wsl -d Ubuntu-24.04 -u liam -- /home/liam/clawd/awakening.sh

echo [%date% %time%] WSL2 awakening script completed >> C:\Users\Simon\liam-startup.log
