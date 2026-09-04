#!/bin/bash
# 个人炒股交易系统 · 同步服务器（Linux）
cd "$(dirname "$0")"

echo "=============================================================="
echo "  个人炒股交易系统 · 同步服务器"
echo "=============================================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js。请先安装：sudo apt install nodejs 或到 https://nodejs.org 下载。"
  exit 1
fi

echo "正在启动服务器（本窗口请保持打开，关闭即停止服务）..."
echo "手机请连同一 WiFi 后访问窗口中显示的“局域网访问”地址。"
echo ""
node server.js
