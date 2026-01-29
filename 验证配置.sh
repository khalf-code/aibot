#!/bin/bash
#
# 贾维斯 Bot 配置验证脚本
#

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

clear
echo
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  贾维斯 Bot 配置验证${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# 加载环境变量
ENV_FILE="$HOME/.clawdbot/env.sh"
if [[ -f "$ENV_FILE" ]]; then
    source "$ENV_FILE"
    echo -e "${GREEN}✓${NC} 环境变量已加载"
else
    echo -e "${RED}✗${NC} 环境变量文件未找到: $ENV_FILE"
    exit 1
fi

echo

# 检查 API 密钥
echo -e "${CYAN}API 密钥检查：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -n "$ZAI_API_KEY" ]]; then
    echo -e "${GREEN}✓${NC} ZAI_API_KEY: ${ZAI_API_KEY:0:20}... (GLM-4.7)"
else
    echo -e "${RED}✗${NC} ZAI_API_KEY 未设置"
fi

if [[ -n "$MOONSHOT_API_KEY" ]]; then
    echo -e "${GREEN}✓${NC} MOONSHOT_API_KEY: ${MOONSHOT_API_KEY:0:20}... (Kimi K2.5)"
else
    echo -e "${YELLOW}⚠${NC} MOONSHOT_API_KEY 未设置（图片/视频功能受限）"
fi

echo

# 检查配置文件
echo -e "${CYAN}配置文件检查：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CONFIG_FILE="$HOME/.moltbot/moltbot.json"
if [[ -f "$CONFIG_FILE" ]]; then
    echo -e "${GREEN}✓${NC} 配置文件存在: $CONFIG_FILE"

    # 检查主模型
    PRIMARY_MODEL=$(grep -A2 '"model"' "$CONFIG_FILE" | grep '"primary"' | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    if [[ -n "$PRIMARY_MODEL" ]]; then
        echo -e "${GREEN}✓${NC} 主模型: $PRIMARY_MODEL"
    fi

    # 检查响应前缀
    PREFIX=$(grep '"responsePrefix"' "$CONFIG_FILE" | sed 's/.*: "\(.*\)".*/\1/')
    if [[ -n "$PREFIX" ]]; then
        echo -e "${GREEN}✓${NC} 响应前缀: $PREFIX"
    fi

    # 检查 Web UI Token
    TOKEN=$(grep '"token"' "$CONFIG_FILE" | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    if [[ -n "$TOKEN" ]]; then
        echo -e "${GREEN}✓${NC} Web UI Token: ${TOKEN:0:20}... (已配置)"
    else
        echo -e "${YELLOW}⚠${NC} Web UI Token 未配置"
    fi
else
    echo -e "${RED}✗${NC} 配置文件未找到"
    exit 1
fi

echo

# 检查网关端口
echo -e "${CYAN}网关状态检查：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if netstat -ano | grep 18789 | grep LISTENING > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 网关正在运行 (127.0.0.1:18789)"
else
    echo -e "${YELLOW}⚠${NC} 网关未运行"
fi

echo

# 模型配置摘要
echo -e "${CYAN}多模型配置摘要：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  📝 ${GREEN}文本对话${NC}:"
echo -e "     优先: GLM-4.7 (¥0.015/千tokens)"
echo -e "     备用: Kimi K2.5 (¥0.12/千tokens)"
echo
echo -e "  📸 ${GREEN}图片识别${NC}:"
echo -e "     优先: Kimi K2.5 (支持图片)"
echo -e "     备用: GLM-4V-Plus"
echo
echo -e "  🎬 ${GREEN}视频解析${NC}:"
echo -e "     直接: Kimi K2.5 (唯一支持视频)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo
echo -e "${GREEN}配置验证完成！${NC}"
echo
echo "下一步："
echo "1. 如果网关未运行: ./start-jarvis-whatsapp.sh"
echo "2. 用 WhatsApp 发送消息测试"
echo "3. 访问 Web UI: 双击 打开WebUI.bat"
echo
