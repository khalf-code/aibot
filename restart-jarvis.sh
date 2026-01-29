#!/bin/bash
#
# 快速重启 Jarvis Bot
#

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo
echo -e "${CYAN}正在重启 Jarvis Bot...${NC}"
echo

# 加载环境变量
echo -e "${GREEN}1. 加载最新配置${NC}"
source "$HOME/.clawdbot/env.sh"

# 验证 API 密钥
if [ -z "$ZAI_API_KEY" ]; then
    echo "❌ 错误：ZAI_API_KEY 未配置"
    exit 1
fi

echo "✅ API 密钥已加载（前10字符）: ${ZAI_API_KEY:0:10}..."

echo
echo -e "${GREEN}2. 启动网关${NC}"
echo

# 启动网关
exec pnpm moltbot gateway run --bind loopback --port 18789
