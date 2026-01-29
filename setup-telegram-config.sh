#!/bin/bash
#
# 贾维斯 Bot Telegram配置辅助脚本
#
# 此脚本帮助您：
# 1. 计算授权用户的SHA-256哈希
# 2. 生成配置文件
# 3. 生成环境变量文件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  贾维斯 Bot Telegram配置向导${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# 检查必需工具
if ! command -v sha256sum &> /dev/null; then
    echo -e "${RED}错误: sha256sum命令不可用${NC}"
    echo "在Windows Git Bash中，请使用: openssl sha256"
    exit 1
fi

# 步骤1: 获取Telegram Bot Token
echo -e "${GREEN}步骤1: Telegram Bot Token${NC}"
echo "请访问 @BotFather 创建Bot并获取Token"
echo -n "请输入Bot Token: "
read -r BOT_TOKEN

if [[ -z "$BOT_TOKEN" ]]; then
    echo -e "${RED}错误: Bot Token不能为空${NC}"
    exit 1
fi

# 步骤2: 获取Telegram用户ID
echo
echo -e "${GREEN}步骤2: 您的Telegram用户ID${NC}"
echo "请发送消息给 @userinfobot 获取您的数字ID"
echo -n "请输入您的Telegram ID（数字）: "
read -r TELEGRAM_ID

if [[ -z "$TELEGRAM_ID" ]]; then
    echo -e "${RED}错误: Telegram ID不能为空${NC}"
    exit 1
fi

# 验证ID是否为数字
if ! [[ "$TELEGRAM_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}错误: Telegram ID必须是数字${NC}"
    exit 1
fi

# 步骤3: 计算SHA-256哈希
echo
echo -e "${GREEN}步骤3: 计算授权哈希${NC}"

# 兼容不同的sha256sum命令
if command -v sha256sum &> /dev/null; then
    AUTHORIZED_HASH=$(echo -n "$TELEGRAM_ID" | sha256sum | cut -d' ' -f1)
elif command -v openssl &> /dev/null; then
    AUTHORIZED_HASH=$(echo -n "$TELEGRAM_ID" | openssl sha256 | awk '{print $2}')
else
    echo -e "${RED}错误: 无法计算SHA-256哈希（sha256sum和openssl都不可用）${NC}"
    exit 1
fi

echo "授权哈希: $AUTHORIZED_HASH"

# 步骤4: 创建配置目录
echo
echo -e "${GREEN}步骤4: 创建配置目录${NC}"

CONFIG_DIR="$HOME/.clawdbot"
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

echo "配置目录: $CONFIG_DIR"

# 步骤5: 生成配置文件
echo
echo -e "${GREEN}步骤5: 生成配置文件${NC}"

CONFIG_FILE="$CONFIG_DIR/clawdbot.json"

cat > "$CONFIG_FILE" <<EOF
{
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789,
    "auth": {
      "mode": "none"
    }
  },
  "security": {
    "hardening": {
      "enabled": true,
      "authorizedUserHash": "$AUTHORIZED_HASH",
      "network": {
        "enforce": true,
        "extraAllowedDomains": [],
        "extraAllowedSuffixes": [],
        "logAllowed": false
      },
      "filesystem": {
        "enforce": false,
        "extraSensitivePaths": []
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "$BOT_TOKEN",
      "dmPolicy": "allowlist",
      "allowFrom": ["$TELEGRAM_ID"]
    }
  },
  "agents": {
    "defaults": {
      "model": "claude-3-7-sonnet-20250219",
      "thinkingLevel": "normal"
    }
  }
}
EOF

chmod 600 "$CONFIG_FILE"
echo "配置文件已创建: $CONFIG_FILE"

# 步骤6: 生成环境变量文件
echo
echo -e "${GREEN}步骤6: 生成环境变量文件${NC}"

ENV_FILE="$CONFIG_DIR/env.sh"

cat > "$ENV_FILE" <<EOF
#!/bin/bash
#
# 贾维斯 Bot 环境变量配置
# 自动生成时间: $(date)

# 安全加固配置
export MOLTBOT_HARDENING_ENABLED=1
export MOLTBOT_AUTHORIZED_USER_HASH="$AUTHORIZED_HASH"
export MOLTBOT_HARDENING_NETWORK_ENFORCE=1
export MOLTBOT_HARDENING_FS_ENFORCE=0

# Telegram配置
export TELEGRAM_BOT_TOKEN="$BOT_TOKEN"

# Anthropic Claude API（如需使用Claude，请取消注释并填写）
# export ANTHROPIC_API_KEY="sk-ant-..."

# 配置验证
echo "=================================="
echo "贾维斯 Bot 安全配置"
echo "=================================="
echo "安全加固: \${MOLTBOT_HARDENING_ENABLED}"
echo "授权哈希: \${MOLTBOT_AUTHORIZED_USER_HASH:0:16}..."
echo "网络强制: \${MOLTBOT_HARDENING_NETWORK_ENFORCE}"
echo "文件强制: \${MOLTBOT_HARDENING_FS_ENFORCE}"
echo "Telegram Token: \${TELEGRAM_BOT_TOKEN:0:10}..."
echo "=================================="
EOF

chmod 600 "$ENV_FILE"
echo "环境变量文件已创建: $ENV_FILE"

# 步骤7: 验证配置
echo
echo -e "${GREEN}步骤7: 验证配置${NC}"

if [[ -f "$CONFIG_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
    echo -e "${GREEN}✓${NC} 配置文件已创建并验证"
else
    echo -e "${RED}✗${NC} 配置文件创建失败"
    exit 1
fi

# 完成
echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo "下一步："
echo "1. 运行: source $ENV_FILE"
echo "2. 运行: ./start-jarvis-safe.sh"
echo
echo "配置文件位置："
echo "- 主配置: $CONFIG_FILE"
echo "- 环境变量: $ENV_FILE"
echo
echo -e "${YELLOW}重要安全提示：${NC}"
echo "- 请勿将 $CONFIG_FILE 和 $ENV_FILE 提交到Git"
echo "- 定期检查审计日志: $CONFIG_DIR/security-audit.log"
echo "- 仅允许您本人的Telegram账号控制Bot"
