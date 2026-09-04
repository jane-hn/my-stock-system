#!/bin/bash
# ============================================================
#  个人炒股交易系统 · 本地离线AI 一键配置（Linux）
#  使用方法：bash 一键配置AI助手-Linux.sh
# ============================================================
cd "$(dirname "$0")"
MODEL="${MODEL:-qwen2.5:7b}"

echo "================================================"
echo "  个人炒股交易系统 · 本地离线AI 一键配置"
echo "  目标模型：$MODEL"
echo "================================================"
echo

if command -v ollama >/dev/null 2>&1; then
  echo "[1/5] 已检测到 Ollama，跳过安装。"
else
  echo "[1/5] 未检测到 Ollama，开始安装..."
  curl -fsSL https://ollama.com/install.sh | sh
  if ! command -v ollama >/dev/null 2>&1; then
    echo "[错误] 安装失败：请到 https://ollama.com/download 获取 Linux 安装方式。"
    exit 1
  fi
fi

echo "[2/5] 写入授权 OLLAMA_ORIGINS=* ..."
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0:11434"
pkill -f "ollama serve" 2>/dev/null
sleep 1

echo "[3/5] 启动 Ollama 服务..."
nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
sleep 3

echo "[4/5] 检查模型 $MODEL ..."
if ollama list 2>/dev/null | grep -q "$MODEL"; then
  echo "      模型已就绪。"
else
  echo "      首次需要拉取模型（约 4-5 GB），请耐心等待..."
  ollama pull "$MODEL" || echo "[提示] 拉取失败：请检查网络后重新运行本脚本。"
fi

echo "[5/5] 连接测试..."
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "      连接成功，本地离线AI已就绪！"
else
  echo "[提示] 本地AI服务暂未响应，可稍后手动运行: OLLAMA_ORIGINS='*' ollama serve"
fi

echo "正在打开交易系统..."
xdg-open index.html 2>/dev/null || echo "请手动用浏览器打开 index.html。"
echo "提示：今后正常使用只需用浏览器打开 index.html；本脚本仅在重装/换机后需要再跑一次。"
