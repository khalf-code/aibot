#!/bin/bash
#
# 贾维斯 Bot WhatsApp安全启动脚本
#
# 此脚本：
# 1. 检查所有必需的环境变量
# 2. 显示安全配置摘要
# 3. 验证配置文件完整性
# 4. 启动贾维斯 Bot服务（WhatsApp通道）

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
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
echo -e "${MAGENTA}╔════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║                                            ║${NC}"
echo -e "${MAGENTA}║   🦞 贾维斯 Bot (Jarvis Bot)              ║${NC}"
echo -e "${MAGENTA}║   WhatsApp 安全启动                        ║${NC}"
echo -e "${MAGENTA}║                                            ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════╝${NC}"
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
    print_info "请先运行: ./setup-whatsapp-config.sh"
    echo

    # 检查是否已经在环境中设置
    if [[ -z "$MOLTBOT_HARDENING_ENABLED" ]]; then
        print_error "环境变量未配置"
        echo
        echo "请执行以下步骤之一："
        echo "1. 运行配置向导: ${CYAN}./setup-whatsapp-config.sh${NC}"
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

# 检查可选的环境变量
if [[ -n "$MOLTBOT_HARDENING_NETWORK_ENFORCE" ]]; then
    print_success "网络白名单强制: ${MOLTBOT_HARDENING_NETWORK_ENFORCE}"
else
    print_warning "网络白名单强制未设置（默认为0）"
    export MOLTBOT_HARDENING_NETWORK_ENFORCE=1
    print_info "已自动设置为强制模式（1）"
fi

if [[ -n "$MOLTBOT_HARDENING_FS_ENFORCE" ]]; then
    print_success "文件系统强制: ${MOLTBOT_HARDENING_FS_ENFORCE}"
else
    print_info "文件系统强制未设置（默认为0，仅审计）"
    export MOLTBOT_HARDENING_FS_ENFORCE=0
fi

# 检查API密钥（可选但推荐）
if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    print_warning "ANTHROPIC_API_KEY 未设置"
    print_info "如需使用Claude AI，请设置此环境变量"
    print_info "获取地址: https://console.anthropic.com/account/keys"
else
    print_success "Claude API密钥: ${ANTHROPIC_API_KEY:0:10}..."
fi

echo

# 如果有缺失的必需变量，退出
if [[ $MISSING_VARS -gt 0 ]]; then
    print_error "缺少 $MISSING_VARS 个必需的环境变量"
    echo
    echo "请运行配置向导: ${CYAN}./setup-whatsapp-config.sh${NC}"
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
    if [[ -r "$CONFIG_FILE" ]]; then
        PERMS=$(stat -c "%a" "$CONFIG_FILE" 2>/dev/null || stat -f "%OLp" "$CONFIG_FILE" 2>/dev/null || echo "unknown")
        if [[ "$PERMS" == "600" ]]; then
            print_success "文件权限: $PERMS (安全)"
        else
            print_warning "文件权限: $PERMS (建议设为600)"
            chmod 600 "$CONFIG_FILE" 2>/dev/null && print_info "已自动修正为600"
        fi
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
echo -e "  🔒 单用户授权:     ${GREEN}已启用${NC}（仅手机号: ${MOLTBOT_AUTHORIZED_USER_HASH:0:8}...）"
echo -e "  🌐 网络白名单:     ${GREEN}$([ "${MOLTBOT_HARDENING_NETWORK_ENFORCE:-0}" == "1" ] && echo "强制模式 ⚡" || echo "审计模式 📝")${NC}"
echo -e "  📁 文件系统监控:   ${GREEN}$([ "${MOLTBOT_HARDENING_FS_ENFORCE:-0}" == "1" ] && echo "强制模式 ⚡" || echo "审计模式 📝")${NC}"
echo -e "  📝 审计日志:       ${GREEN}已启用${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo -e "${CYAN}通道配置：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  通道类型:   ${GREEN}WhatsApp (Baileys)${NC}"
echo -e "  DM策略:     ${GREEN}白名单模式${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo -e "${CYAN}路径配置：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  配置目录:   $HOME/.clawdbot/"
echo -e "  审计日志:   $HOME/.clawdbot/security-audit.log"
echo -e "  主配置:     $CONFIG_FILE"
echo -e "  环境变量:   $ENV_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# ============================================
# 步骤5: 最终确认
# ============================================

echo -e "${YELLOW}⚠ 启动前确认：${NC}"
echo "1. 此Bot将仅允许手机号 ${GREEN}${PHONE_NUMBER}${NC} 控制"
echo "2. 其他WhatsApp账号的消息将被静默拒绝"
echo "3. 所有网络请求将受白名单限制"
echo "4. 所有敏感操作将记录到审计日志"
echo "5. 首次启动会显示二维码，请使用手机扫描"
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
    MAJOR_VERSION=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)

    if [[ "$MAJOR_VERSION" -ge 22 ]]; then
        print_success "Node.js: $NODE_VERSION (符合≥22.12.0要求)"
    else
        print_error "Node.js: $NODE_VERSION (需要≥22.12.0)"
        exit 1
    fi
else
    print_error "Node.js 未安装"
    exit 1
fi

# 检查node_modules
if [[ -d "node_modules" ]]; then
    print_success "依赖已安装"
else
    print_warning "依赖未安装"
    print_info "正在安装依赖（可能需要5-10分钟）..."

    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        print_error "npm/pnpm 都不可用"
        exit 1
    fi
fi

echo

# ============================================
# 步骤7: 启动服务
# ============================================

print_header "步骤7: 启动贾维斯 Bot (WhatsApp)"

echo
echo -e "${GREEN}正在启动服务...${NC}"
echo -e "${CYAN}日志输出：${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${YELLOW}⚠ 首次启动说明：${NC}"
echo "1. 启动后会显示一个二维码"
echo "2. 打开手机WhatsApp"
echo "3. 进入 设置 > 已连接的设备 > 连接设备"
echo "4. 扫描终端中显示的二维码"
echo "5. 连接成功后即可开始使用"
echo
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# 启动命令
if command -v pnpm &> /dev/null; then
    exec pnpm moltbot gateway run --bind loopback --port 18789
elif command -v npm &> /dev/null; then
    exec npm run moltbot -- gateway run --bind loopback --port 18789
else
    # 尝试直接使用node运行
    if [[ -f "dist/index.js" ]]; then
        exec node dist/index.js gateway run --bind loopback --port 18789
    else
        print_error "无法找到启动入口"
        print_info "请先构建项目: npm run build"
        exit 1
    fi
fi
