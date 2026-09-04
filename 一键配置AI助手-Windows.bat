@echo off
chcp 65001 >nul
title 个人炒股交易系统 · 本地AI一键配置
REM ============================================================
REM  一键完成：安装 Ollama -> 设置跨域授权 -> 拉取模型 -> 打开交易系统
REM  想换模型，只改下面这一行（与 ollama list 中的名称一致）
REM ============================================================
set "MODEL=qwen2.5:7b"

echo ================================================
echo   个人炒股交易系统 · 本地离线AI 一键配置
echo   目标模型：%MODEL%
echo ================================================
echo.

REM ---------- 第 1 步：检查/安装 Ollama ----------
where ollama >nul 2>nul
if errorlevel 1 goto :install_ollama
echo [1/5] 已检测到 Ollama，跳过安装。
goto :step2

:install_ollama
echo [1/5] 未检测到 Ollama，开始下载安装程序（约 1-2 分钟）...
where winget >nul 2>nul
if errorlevel 1 goto :curl_install
echo 使用 winget 安装...
winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto :curl_install
goto :after_install

:curl_install
echo 使用官网安装包下载...
curl -L -o "%TEMP%\OllamaSetup.exe" https://ollama.com/download/OllamaSetup.exe
if not exist "%TEMP%\OllamaSetup.exe" goto :install_fail
echo 正在启动安装向导，请按提示完成安装（一路下一步即可）...
start "" "%TEMP%\OllamaSetup.exe"
goto :after_install

:install_fail
echo.
echo [错误] 下载失败：请检查网络，或手动到 https://ollama.com/download 下载安装。
pause
exit /b 1

:after_install
echo.
echo Ollama 安装完成后，请【重新双击本脚本】继续后续配置。
pause
exit /b 0

REM ---------- 第 2 步：跨域授权（关键步骤） ----------
:step2
echo [2/5] 停止旧的 Ollama 进程（使授权生效）...
taskkill /IM ollama.exe /F >nul 2>nul
timeout /t 1 /nobreak >nul
echo       写入授权：OLLAMA_ORIGINS=*（允许本地网页调用本机AI）...
setx OLLAMA_ORIGINS "*" >nul
setx OLLAMA_HOST "0.0.0.0:11434" >nul
set "OLLAMA_ORIGINS=*"
set "OLLAMA_HOST=0.0.0.0:11434"

REM ---------- 第 3 步：启动本地 AI 服务 ----------
echo [3/5] 启动 Ollama 服务...
start "" /min cmd /c "ollama serve"
timeout /t 3 /nobreak >nul

REM ---------- 第 4 步：检查/拉取模型 ----------
echo [4/5] 检查模型 %MODEL% ...
ollama list 2>nul | findstr /C:"%MODEL%" >nul 2>nul
if errorlevel 1 (
  echo       首次需要拉取模型（约 4-5 GB，视网速数分钟），请耐心等待...
  ollama pull %MODEL%
  if errorlevel 1 (
    echo [提示] 拉取失败：请检查网络后重新双击本脚本；已有模型可改脚本顶部的 MODEL 名称。
  )
) else (
  echo       模型已就绪。
)

REM ---------- 第 5 步：连通性测试并打开系统 ----------
echo [5/5] 连接测试...
curl -s http://localhost:11434/api/tags >nul 2>nul
if errorlevel 1 (
  echo [提示] 本地AI服务暂未响应。可稍后在命令行手动运行 ollama serve，再重试。
) else (
  echo       连接成功，本地离线AI已就绪！
)

echo.
echo 正在打开交易系统...
start "" "%~dp0index.html"
echo.
echo 已在浏览器打开。系统默认模型名为 %MODEL%，一般无需改动；
echo 如在「设置」页改过模型名，请保持与本脚本一致。
echo.
echo 提示：今后正常使用只需双击 index.html；本脚本仅在重装/换机后需要再跑一次。
pause
