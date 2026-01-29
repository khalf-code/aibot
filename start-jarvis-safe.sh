#!/bin/bash
#
# 贾维斯 Bot 安全启动脚本
#
# 此脚本：
# 1. 检查所有必需的环境变量
# 2. 显示安全配置摘要
# 3. 验证配置文件完整性
# 4. 启动贾维斯 Bot服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# 清屏并显示横幅
clear
echo
print_header "  🦞 贾维斯 Bot (Jarvis Bot) 安全启动  "
echo
echo -e "${CYAN}基于 Moltbot 安全加固版本${NC}"
echo -e "${CYAN}单用户模式 | 网络白名单 | 审计日志${NC}"
echo

# ============================================
# 步骤1: 加载环境变量
# ============================================

print_header "步骤1: 加载环境变量"

ENV_FILE="$HOME/.clawdbot/env.sh"

if [[ -f "$ENV_FILE" ]]; then
    print_success "找到环境变量文件: $ENV_FILE"
    source "$ENV_FILE"
else
    print_warning "未找到环境变量文件"
    print_info "请先运行: ./setup-telegram-config.sh"
    echo

    # 检查是否已经在环境中设置
    if [[ -z "$MOLTBOT_HARDENING_ENABLED" ]]; then
        print_error "环境变量未配置"
        echo
        echo "请执行以下步骤之一："
        echo "1. 运行配置向导: ./setup-telegram-config.sh"
        echo "2. 手动创建: $ENV_FILE"
        echo "3. 导出环境变量: export MOLTBOT_HARDENING_ENABLED=1"
        exit 1
    else
        print_info "使用当前环境中的变量"
    fi
fi

echo

# ============================================
# 步骤2: 验证必需的环境变量
# ============================================

print_header "步骤2: 验证环境变量"

MISSING_VARS=0

# 检查安全加固开关
if [[ -z "$MOLTBOT_HARDENING_ENABLED" ]]; then
    print_error "MOLTBOT_HARDENING_ENABLED 未设置"
    MISSING_VARS=$((MISSING_VARS + 1))
else
    print_success "安全加固: 已启用"
fi

# 检查授权用户哈希
if [[ -z "$MOLTBOT_AUTHORIZED_USER_HASH" ]]; then
    print_error "MOLTBOT_AUTHORIZED_USER_HASH 未设置"
    MISSING_VARS=$((MISSING_VARS + 1))
else
    # 验证哈希格式（应该是64个十六进制字符）
    if [[ "$MOLTBOT_AUTHORIZED_USER_HASH" =~ ^[a-f0-9]{64}$ ]]; then
        print_success "授权哈希: ${MOLTBOT_AUTHORIZED_USER_HASH:0:16}... (格式正确)"
    else
        print_warning "授权哈希格式可能不正确（应为64位十六进制）"
        print_info "当前值: ${MOLTBOT_AUTHORIZED_USER_HASH:0:32}..."
    fi
fi

# 检查Telegram Token
if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
    print_error "TELEGRAM_BOT_TOKEN 未设置"
    MISSING_VARS=$((MISSING_VARS + 1))
else
    print_success "Telegram Token: ${TELEGRAM_BOT_TOKEN:0:10}..."
fi

# 检查可选的环境变量
if [[ -n "$MOLTBOT_HARDENING_NETWORK_ENFORCE" ]]; then
    print_success "网络白名单强制: ${MOLTBOT_HARDENING_NETWORK_ENFORCE}"
else
    print_warning "网络白名单强制未设置（默认为0）"
fi

if [[ -n "$MOLTBOT_HARDENING_FS_ENFORCE" ]]; then
    print_success "文件系统强制: ${MOLTBOT_HARDENING_FS_ENFORCE}"
else
    print_info "文件系统强制未设置（默认为0，仅审计）"
fi

echo

# 如果有缺失的必需变量，退出
if [[ $MISSING_VARS -gt 0 ]]; then
    print_error "缺少 $MISSING_VARS 个必需的环境变量"
    echo
    echo "请运行配置向导: ./setup-telegram-config.sh"
    exit 1
fi

# ============================================
# 步骤3: 验证配置文件
# ============================================

print_header "步骤3: 验证配置文件"

CONFIG_FILE="$HOME/.clawdbot/clawdbot.json"

if [[ -f "$CONFIG_FILE" ]]; then
    print_success "配置文件: $CONFIG_FILE"

    # 检查文件权限
    PERMS=$(stat -c "%a" "$CONFIG_FILE" 2>/dev/null || stat -f "%OLp" "$CONFIG_FILE" 2>/dev/null)
    if [[ "$PERMS" == "600" ]]; then
        print_success "文件权限: $PERMS (安全)"
    else
        print_warning "文件权限: $PERMS (建议设为600)"
        print_info "运行: chmod 600 $CONFIG_FILE"
    fi
else
    print_warning "配置文件不存在"
    print_info "将使用环境变量配置"
fi

echo

# ============================================
# 步骤4: 显示安全配置摘要
# ============================================

print_header "安全配置摘要"

echo
echo -e "${CYAN}安全功能状态：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  🔒 单用户授权:     ${GREEN}已启用${NC}"
echo -e "  🌐 网络白名单:     ${GREEN}$([ "${MOLTBOT_HARDENING_NETWORK_ENFORCE:-0}" == "1" ] && echo "强制模式" || echo "审计模式")${NC}"
echo -e "  📁 文件系统监控:   ${GREEN}$([ "${MOLTBOT_HARDENING_FS_ENFORCE:-0}" == "1" ] && echo "强制模式" || echo "审计模式")${NC}"
echo -e "  📝 审计日志:       ${GREEN}已启用${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo -e "${CYAN}授权用户信息：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  授权哈希: ${MOLTBOT_AUTHORIZED_USER_HASH:0:16}...${MOLTBOT_AUTHORIZED_USER_HASH:48:16}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo -e "${CYAN}日志和配置路径：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  配置目录:   $HOME/.clawdbot/"
echo -e "  审计日志:   $HOME/.clawdbot/security-audit.log"
echo -e "  主配置:     $CONFIG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# ============================================
# 步骤5: 最终确认
# ============================================

echo -e "${YELLOW}⚠ 启动前确认：${NC}"
echo "1. 此Bot将仅允许哈希为 ${MOLTBOT_AUTHORIZED_USER_HASH:0:16}... 的用户控制"
echo "2. 所有网络请求将受白名单限制"
echo "3. 所有敏感操作将记录到审计日志"
echo

read -p "按回车键继续启动，或按Ctrl+C取消... " -r
echo

# ============================================
# 步骤6: 检查依赖
# ============================================

print_header "步骤6: 检查依赖"

# 检查Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js: $NODE_VERSION"
else
    print_error "Node.js 未安装"
    exit 1
fi

# 检查pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    print_success "pnpm: v$PNPM_VERSION"
else
    print_warning "pnpm 未安装，尝试使用npm"

    if command -v npm &> /dev/null; then
        print_info "将使用npm启动"
    else
        print_error "npm 也未安装"
        exit 1
    fi
fi

# 检查node_modules
if [[ -d "node_modules" ]]; then
    print_success "依赖已安装"
else
    print_warning "依赖未安装"
    print_info "正在安装依赖..."

    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi
fi

echo

# ============================================
# 步骤7: 启动服务
# ============================================

print_header "步骤7: 启动贾维斯 Bot"

echo
echo -e "${GREEN}正在启动服务...${NC}"
echo -e "${CYAN}日志输出：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# 启动命令
if command -v pnpm &> /dev/null; then
    pnpm moltbot gateway run --bind loopback --port 18789
else
    npm run moltbot -- gateway run --bind loopback --port 18789
fi
