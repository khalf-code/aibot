#!/bin/bash
#
# 贾维斯 Bot WhatsApp配置辅助脚本
#
# 此脚本帮助您：
# 1. 获取您的WhatsApp手机号
# 2. 计算授权用户的SHA-256哈希
# 3. 生成配置文件
# 4. 生成环境变量文件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  贾维斯 Bot WhatsApp配置向导${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# 步骤1: 获取WhatsApp手机号
echo -e "${GREEN}步骤1: 您的WhatsApp手机号${NC}"
echo
echo -e "${CYAN}重要说明：${NC}"
echo "1. 手机号必须使用E.164国际格式（包含国家代码）"
echo "2. 中国大陆: +86 开头（如：+8613800138000）"
echo "3. 不要包含空格、破折号或其他符号"
echo "4. 这个手机号将是唯一能控制Bot的账号"
echo
echo -e "${YELLOW}示例：${NC}"
echo "  中国: +8613800138000"
echo "  美国: +11234567890"
echo "  英国: +447700900000"
echo
echo -n "请输入您的WhatsApp手机号（E.164格式）: "
read -r PHONE_NUMBER

# 验证手机号格式
if [[ -z "$PHONE_NUMBER" ]]; then
    echo -e "${RED}错误: 手机号不能为空${NC}"
    exit 1
fi

# 验证是否以+开头
if [[ ! "$PHONE_NUMBER" =~ ^\+[0-9]+$ ]]; then
    echo -e "${RED}错误: 手机号格式不正确${NC}"
    echo "必须以 + 开头，后面只能是数字"
    echo "示例: +8613800138000"
    exit 1
fi

# 验证长度（一般11-15位）
PHONE_LENGTH=${#PHONE_NUMBER}
if [[ $PHONE_LENGTH -lt 11 ]] || [[ $PHONE_LENGTH -gt 15 ]]; then
    echo -e "${YELLOW}警告: 手机号长度($PHONE_LENGTH)可能不正确${NC}"
    echo "一般应为11-15位（含+号）"
    echo -n "是否继续？(y/n): "
    read -r CONFIRM
    if [[ "$CONFIRM" != "y" ]] && [[ "$CONFIRM" != "Y" ]]; then
        echo "已取消"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} 手机号: $PHONE_NUMBER"

# 步骤2: 计算SHA-256哈希
echo
echo -e "${GREEN}步骤2: 计算授权哈希${NC}"

# 兼容不同的sha256命令
if command -v sha256sum &> /dev/null; then
    AUTHORIZED_HASH=$(echo -n "$PHONE_NUMBER" | sha256sum | cut -d' ' -f1)
elif command -v openssl &> /dev/null; then
    AUTHORIZED_HASH=$(echo -n "$PHONE_NUMBER" | openssl sha256 | awk '{print $NF}')
else
    echo -e "${RED}错误: 无法计算SHA-256哈希（sha256sum和openssl都不可用）${NC}"
    exit 1
fi

echo "授权哈希: $AUTHORIZED_HASH"
echo -e "${CYAN}（此哈希用于安全验证，请勿泄露）${NC}"

# 步骤3: 创建配置目录
echo
echo -e "${GREEN}步骤3: 创建配置目录${NC}"

CONFIG_DIR="$HOME/.clawdbot"
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

echo "配置目录: $CONFIG_DIR"

# 步骤4: 生成配置文件
echo
echo -e "${GREEN}步骤4: 生成配置文件${NC}"

CONFIG_FILE="$CONFIG_DIR/clawdbot.json"

cat > "$CONFIG_FILE" <<EOF
{
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789,
    "auth": {
      "allowTailscale": true
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "zai/glm-4.7"
      },
      "workspace": "~/clawd"
    }
  },
  "channels": {
    "whatsapp": {
      "allowFrom": ["$PHONE_NUMBER"]
    }
  },
  "env": {
    "ZAI_API_KEY": "\${ZAI_API_KEY}"
  }
}
EOF

chmod 600 "$CONFIG_FILE"
echo -e "${GREEN}✓${NC} 配置文件已创建: $CONFIG_FILE"

# 步骤5: 生成环境变量文件
echo
echo -e "${GREEN}步骤5: 生成环境变量文件${NC}"

ENV_FILE="$CONFIG_DIR/env.sh"

cat > "$ENV_FILE" <<EOF
#!/bin/bash
#
# 贾维斯 Bot 环境变量配置（WhatsApp版本）
# 自动生成时间: $(date)

# ============================================
# 安全加固配置
# ============================================

# 启用安全加固功能（必须）
export MOLTBOT_HARDENING_ENABLED=1

# 授权用户哈希（SHA-256）
# 基于手机号: $PHONE_NUMBER
export MOLTBOT_AUTHORIZED_USER_HASH="$AUTHORIZED_HASH"

# 网络白名单强制模式（强制启用）
export MOLTBOT_HARDENING_NETWORK_ENFORCE=1

# 文件系统监控模式（审计模式，不拦截）
export MOLTBOT_HARDENING_FS_ENFORCE=0

# ============================================
# Z.AI GLM-4.7 API配置（必需）
# ============================================

# GLM-4.7 是性价比最高的模型，工具调用和编程能力强
# 获取地址: https://www.z.ai/ (注册并获取API密钥)
export ZAI_API_KEY="your-zai-api-key-here"

# ============================================
# 备选模型配置（可选）
# ============================================

# 如需使用其他模型，可取消以下注释并配置：
# Anthropic Claude (高质量但价格较高)
# export ANTHROPIC_API_KEY="sk-ant-api03-..."
# Moonshot Kimi K2 (长上下文，中文友好)
# export MOONSHOT_API_KEY="sk-..."
# DeepSeek (需要自定义provider配置)
# export DEEPSEEK_API_KEY="sk-..."

# ============================================
# 日志配置
# ============================================

# 审计日志路径（可选，默认为~/.clawdbot/security-audit.log）
export MOLTBOT_HARDENING_LOG_FILE="\$HOME/.clawdbot/security-audit.log"

# ============================================
# 配置验证
# ============================================

echo "===================================="
echo "贾维斯 Bot 安全配置（WhatsApp）"
echo "===================================="
echo "安全加固: \${MOLTBOT_HARDENING_ENABLED:-未设置}"
echo "授权手机: $PHONE_NUMBER"
echo "授权哈希: \${MOLTBOT_AUTHORIZED_USER_HASH:0:16}... (前16字符)"
echo "网络强制: \${MOLTBOT_HARDENING_NETWORK_ENFORCE:-0}"
echo "文件强制: \${MOLTBOT_HARDENING_FS_ENFORCE:-0}"
echo "===================================="
EOF

chmod 600 "$ENV_FILE"
echo -e "${GREEN}✓${NC} 环境变量文件已创建: $ENV_FILE"

# 步骤6: 验证配置
echo
echo -e "${GREEN}步骤6: 验证配置${NC}"

if [[ -f "$CONFIG_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
    echo -e "${GREEN}✓${NC} 配置文件已创建并验证"

    # 显示配置摘要
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}配置摘要${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  授权手机号: ${GREEN}$PHONE_NUMBER${NC}"
    echo -e "  授权哈希:   ${GREEN}${AUTHORIZED_HASH:0:16}...${AUTHORIZED_HASH:48:16}${NC}"
    echo -e "  通道:       ${GREEN}WhatsApp (Baileys)${NC}"
    echo -e "  安全级别:   ${GREEN}企业级（5层防护）${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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
echo "1. 加载环境变量: ${CYAN}source $ENV_FILE${NC}"
echo "2. 启动服务: ${CYAN}./start-jarvis-whatsapp.sh${NC}"
echo "3. 扫描二维码连接WhatsApp"
echo
echo "配置文件位置："
echo "- 主配置: $CONFIG_FILE"
echo "- 环境变量: $ENV_FILE"
echo "- 审计日志: $CONFIG_DIR/security-audit.log"
echo
echo -e "${YELLOW}⚠ 重要安全提示：${NC}"
echo "- 请勿将配置文件提交到Git"
echo "- 定期检查审计日志"
echo "- 仅允许 $PHONE_NUMBER 控制Bot"
echo "- 首次启动会显示WhatsApp二维码，请使用手机扫描"
