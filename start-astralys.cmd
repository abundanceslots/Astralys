@echo off
cd /d "%~dp0"
call npm.cmd run start:go -- --clear
if errorlevel 1 pause
