@echo off
chcp 65001 >nul
title 个人炒股交易系统 · 同步服务器
cd /d "%~dp0"

echo ==============================================================
echo   个人炒股交易系统 · 同步服务器
echo ==============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js。
    echo.
    echo 请先到 https://nodejs.org 下载并安装 Node.js（LTS 版），
    echo 安装完成后重新双击本脚本。
    echo.
    pause
    exit /b 1
)

echo 正在启动服务器（本窗口请保持打开，关闭即停止服务）...
echo 首次启动后将自动打开浏览器；手机请连同一 WiFi 后访问窗口中显示的"局域网访问"地址。
echo.
start "" http://localhost:8000
node server.js

echo.
echo 服务器已停止。
pause
