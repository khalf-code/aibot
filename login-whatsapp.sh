#!/bin/bash
#
# WhatsApp 登录脚本 - 扫描二维码
#

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WhatsApp 登录 - 扫描二维码${NC}"
echo -e "${BLUE}========================================${NC}"
echo

echo -e "${CYAN}准备步骤：${NC}"
echo "1. 确保手机和电脑在同一网络"
echo "2. 打开手机 WhatsApp"
echo "3. 进入：设置 > 已连接的设备 > 连接设备"
echo "4. 准备扫描终端显示的二维码"
echo

echo -e "${GREEN}正在启动登录流程...${NC}"
echo

# 运行登录命令（不需要 whatsapp 参数）
npx moltbot channels login
