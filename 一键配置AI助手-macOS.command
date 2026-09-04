#!/bin/bash
# ============================================================
#  个人炒股交易系统 · 本地离线AI 一键配置（macOS）
#  双击运行（若提示无法验证开发者，请右键->打开，或在终端执行本文件）
#  一键完成：安装 Ollama -> 跨域授权 -> 拉取模型 -> 打开交易系统
# ============================================================
cd "$(dirname "$0")"
MODEL="${MODEL:-qwen2.5:7b}"

echo "================================================"
echo "  个人炒股交易系统 · 本地离线AI 一键配置"
echo "  目标模型：$MODEL"
echo "================================================"
echo

# 1) 检查/安装 Ollama
if command -v ollama >/dev/null 2>&1; then
  echo "[1/5] 已检测到 Ollama，跳过安装。"
else
  echo "[1/5] 未检测到 Ollama，开始安装（可能需要输入一次开机密码）..."
  curl -fsSL https://ollama.com/install.sh | sh
  if ! command -v ollama >/dev/null 2>&1; then
    echo "[错误] 安装失败：请手动到 https://ollama.com/download 下载 macOS 版安装。"
    exit 1
  fi
fi

# 2) 跨域授权（允许本地网页调用本机AI）
echo "[2/5] 写入授权 OLLAMA_ORIGINS=* ..."
launchctl setenv OLLAMA_ORIGINS "*" 2>/dev/null
launchctl setenv OLLAMA_HOST "0.0.0.0:11434" 2>/dev/null
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0:11434"
pkill -f "ollama serve" 2>/dev/null
sleep 1

# 3) 启动本地 AI 服务
echo "[3/5] 启动 Ollama 服务..."
nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
sleep 3

# 4) 检查/拉取模型
echo "[4/5] 检查模型 $MODEL ..."
if ollama list 2>/dev/null | grep -q "$MODEL"; then
  echo "      模型已就绪。"
else
  echo "      首次需要拉取模型（约 4-5 GB，视网速数分钟），请耐心等待..."
  ollama pull "$MODEL" || echo "[提示] 拉取失败：请检查网络后重新运行本脚本。"
fi

# 5) 连通性测试并打开系统
echo "[5/5] 连接测试..."
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "      连接成功，本地离线AI已就绪！"
else
  echo "[提示] 本地AI服务暂未响应，可稍后手动运行: ollama serve"
fi

echo
echo "正在打开交易系统..."
open index.html 2>/dev/null || echo "请手动双击 index.html 打开。"
echo
echo "系统默认模型名为 $MODEL，一般无需改动。"
echo "提示：今后正常使用只需双击 index.html；本脚本仅在重装/换机后需要再跑一次。"
