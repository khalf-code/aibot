#!/bin/bash
#
# 贾维斯 Bot WhatsApp直接启动脚本（跳过构建）
# 使用 tsx 直接运行 TypeScript 源码
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 清屏并显示横幅
clear
echo
echo -e "${MAGENTA}╔════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║                                            ║${NC}"
echo -e "${MAGENTA}║   🦞 贾维斯 Bot (Jarvis Bot)              ║${NC}"
echo -e "${MAGENTA}║   WhatsApp 直接启动（开发模式）           ║${NC}"
echo -e "${MAGENTA}║                                            ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════╝${NC}"
echo
echo -e "${CYAN}基于 Moltbot 安全加固版本${NC}"
echo -e "${CYAN}单用户模式 | 网络白名单 | 审计日志${NC}"
echo

# 加载环境变量
ENV_FILE="$HOME/.clawdbot/env.sh"
if [[ -f "$ENV_FILE" ]]; then
    source "$ENV_FILE"
fi

echo -e "${GREEN}正在使用 tsx 直接运行 TypeScript...${NC}"
echo -e "${YELLOW}注意: 这是开发模式，性能可能略低于构建版本${NC}"
echo

# 检查 tsx 是否可用
if ! npm list tsx &> /dev/null; then
    echo -e "${RED}错误: tsx 未安装${NC}"
    echo "正在安装 tsx..."
    npm install
fi

# 直接运行源码
exec npx tsx src/entry.ts gateway run --bind loopback --port 18789
