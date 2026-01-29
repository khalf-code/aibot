#!/bin/bash

# Moltbot 安全配置快速检查脚本
# 用途: 验证部署环境是否符合安全最佳实践
# 作者: CMAF战略架构师
# 日期: 2026年1月28日

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 状态计数
CRITICAL=0
WARNINGS=0
PASSED=0

# 打印函数
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
    ((CRITICAL++))
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 1. 检查Node.js版本
check_node_version() {
    print_header "1. Node.js 版本检查"

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | sed 's/v//')
        MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d. -f1)
        MINOR_VERSION=$(echo "$NODE_VERSION" | cut -d. -f2)

        if [ "$MAJOR_VERSION" -ge 22 ] && [ "$MINOR_VERSION" -ge 12 ]; then
            print_pass "Node.js版本: v$NODE_VERSION (满足 ≥22.12.0 要求)"
        else
            print_fail "Node.js版本: v$NODE_VERSION (需要 ≥22.12.0)"
            print_info "   请升级Node.js以获取CVE-2025-59466和CVE-2026-21636补丁"
        fi
    else
        print_fail "未安装Node.js"
    fi
    echo
}

# 2. 检查配置目录权限
check_config_permissions() {
    print_header "2. 配置目录权限检查"

    CONFIG_DIR="$HOME/.clawdbot"

    if [ -d "$CONFIG_DIR" ]; then
        # 检查目录权限
        PERMS=$(stat -c "%a" "$CONFIG_DIR" 2>/dev/null || stat -f "%OLp" "$CONFIG_DIR" 2>/dev/null)
        if [ "$PERMS" = "700" ] || [ "$PERMS" = "600" ]; then
            print_pass "配置目录权限: $PERMS (安全)"
        else
            print_fail "配置目录权限: $PERMS (应为700)"
            print_info "   修复: chmod 700 $CONFIG_DIR"
        fi

        # 检查config.json权限
        CONFIG_FILE="$CONFIG_DIR/config.json"
        if [ -f "$CONFIG_FILE" ]; then
            PERMS=$(stat -c "%a" "$CONFIG_FILE" 2>/dev/null || stat -f "%OLp" "$CONFIG_FILE" 2>/dev/null)
            if [ "$PERMS" = "600" ]; then
                print_pass "配置文件权限: $PERMS (安全)"
            else
                print_fail "配置文件权限: $PERMS (应为600)"
                print_info "   修复: chmod 600 $CONFIG_FILE"
            fi
        else
            print_warn "配置文件不存在: $CONFIG_FILE"
        fi

        # 检查credentials目录
        CREDS_DIR="$CONFIG_DIR/credentials"
        if [ -d "$CREDS_DIR" ]; then
            PERMS=$(stat -c "%a" "$CREDS_DIR" 2>/dev/null || stat -f "%OLp" "$CREDS_DIR" 2>/dev/null)
            if [ "$PERMS" = "700" ]; then
                print_pass "凭证目录权限: $PERMS (安全)"
            else
                print_fail "凭证目录权限: $PERMS (应为700)"
                print_info "   修复: chmod 700 $CREDS_DIR"
            fi
        fi
    else
        print_warn "配置目录不存在: $CONFIG_DIR (首次运行请执行 moltbot onboard)"
    fi
    echo
}

# 3. 检查DM策略配置
check_dm_policy() {
    print_header "3. DM策略配置检查"

    CONFIG_FILE="$HOME/.clawdbot/config.json"

    if [ -f "$CONFIG_FILE" ]; then
        # 检查dmPolicy设置
        DM_POLICY=$(grep -o '"dmPolicy"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | grep -o '"[^"]*"$' | tr -d '"')

        if [ -z "$DM_POLICY" ]; then
            print_warn "未配置dmPolicy (默认可能是open)"
            print_info "   建议: 在config.json中设置 \"dmPolicy\": \"pairing\""
        elif [ "$DM_POLICY" = "open" ]; then
            print_fail "dmPolicy设置为open (任何人可发送DM)"
            print_info "   修复: moltbot config set channels.whatsapp.dmPolicy pairing"
        elif [ "$DM_POLICY" = "pairing" ]; then
            print_pass "dmPolicy设置为pairing (安全)"
        else
            print_warn "dmPolicy设置为: $DM_POLICY (未知策略)"
        fi
    else
        print_warn "配置文件不存在，无法检查DM策略"
    fi
    echo
}

# 4. 检查Gateway认证配置
check_gateway_auth() {
    print_header "4. Gateway认证配置检查"

    CONFIG_FILE="$HOME/.clawdbot/config.json"

    if [ -f "$CONFIG_FILE" ]; then
        # 检查gateway.auth.mode
        AUTH_MODE=$(grep -o '"auth"[[:space:]]*:[[:space:]]*{[^}]*"mode"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')

        if [ -z "$AUTH_MODE" ]; then
            print_warn "未配置gateway.auth.mode"
        elif [ "$AUTH_MODE" = "none" ]; then
            print_warn "Gateway认证禁用 (仅适合本地使用)"
            print_info "   如需公网暴露，请设置: moltbot config set gateway.auth.mode password"
        elif [ "$AUTH_MODE" = "password" ]; then
            print_pass "Gateway认证: password (安全)"
        else
            print_warn "Gateway认证模式: $AUTH_MODE (未知模式)"
        fi

        # 检查gateway.mode
        GATEWAY_MODE=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | head -1 | grep -o '"[^"]*"$' | tr -d '"')
        if [ "$GATEWAY_MODE" = "remote" ]; then
            if [ "$AUTH_MODE" != "password" ]; then
                print_fail "远程Gateway模式但未启用password认证 (严重风险)"
            fi
        fi
    fi
    echo
}

# 5. 检查Docker沙箱配置
check_sandbox_config() {
    print_header "5. Docker沙箱配置检查"

    CONFIG_FILE="$HOME/.clawdbot/config.json"

    if [ -f "$CONFIG_FILE" ]; then
        # 检查sandbox.mode
        SANDBOX_MODE=$(grep -o '"sandbox"[[:space:]]*:[[:space:]]*{[^}]*"mode"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')

        if [ -z "$SANDBOX_MODE" ]; then
            print_warn "未配置sandbox.mode (群聊可能无隔离)"
            print_info "   建议: 设置 \"sandbox\": { \"mode\": \"non-main\" }"
        elif [ "$SANDBOX_MODE" = "disabled" ] || [ "$SANDBOX_MODE" = "off" ]; then
            print_warn "沙箱已禁用 (群聊无隔离保护)"
        elif [ "$SANDBOX_MODE" = "non-main" ]; then
            print_pass "沙箱模式: non-main (安全)"

            # 检查Docker是否可用
            if command -v docker &> /dev/null; then
                if docker ps &> /dev/null; then
                    print_pass "Docker服务运行中"

                    # 检查沙箱镜像
                    if docker images | grep -q "moltbot/sandbox"; then
                        print_pass "沙箱镜像已安装: moltbot/sandbox"
                    else
                        print_warn "沙箱镜像未安装: moltbot/sandbox"
                        print_info "   安装: docker pull moltbot/sandbox:latest"
                    fi
                else
                    print_fail "Docker服务未运行"
                    print_info "   启动: sudo systemctl start docker"
                fi
            else
                print_fail "未安装Docker (沙箱无法工作)"
            fi
        else
            print_warn "沙箱模式: $SANDBOX_MODE (未知模式)"
        fi
    fi
    echo
}

# 6. 检查配对请求数量
check_pairing_requests() {
    print_header "6. 配对请求检查"

    CREDS_DIR="$HOME/.clawdbot/credentials"

    if [ -d "$CREDS_DIR" ]; then
        PAIRING_FILES=$(find "$CREDS_DIR" -name "*-pairing.json" 2>/dev/null)

        if [ -z "$PAIRING_FILES" ]; then
            print_info "无配对请求文件"
        else
            TOTAL_REQUESTS=0
            for file in $PAIRING_FILES; do
                if [ -f "$file" ]; then
                    COUNT=$(grep -c '"id"' "$file" 2>/dev/null || echo 0)
                    TOTAL_REQUESTS=$((TOTAL_REQUESTS + COUNT))
                    CHANNEL=$(basename "$file" | sed 's/-pairing.json//')

                    if [ "$COUNT" -gt 0 ]; then
                        if [ "$COUNT" -ge 3 ]; then
                            print_warn "$CHANNEL: $COUNT 个待审批请求 (达到上限)"
                            print_info "   查看: moltbot pairing list $CHANNEL"
                        else
                            print_info "$CHANNEL: $COUNT 个待审批请求"
                        fi
                    fi
                fi
            done

            if [ "$TOTAL_REQUESTS" -gt 10 ]; then
                print_warn "总计 $TOTAL_REQUESTS 个待审批请求 (可能存在异常)"
            else
                print_pass "配对请求数量正常 (总计: $TOTAL_REQUESTS)"
            fi
        fi
    fi
    echo
}

# 7. 检查环境变量安全
check_env_security() {
    print_header "7. 环境变量安全检查"

    ENV_FILE=".env"

    if [ -f "$ENV_FILE" ]; then
        print_warn ".env文件存在于项目根目录"
        print_info "   确保.env已加入.gitignore"

        if [ -f ".gitignore" ] && grep -q ".env" ".gitignore"; then
            print_pass ".env已在.gitignore中"
        else
            print_fail ".env未在.gitignore中 (可能泄露密钥)"
        fi

        # 检查.env文件权限
        PERMS=$(stat -c "%a" "$ENV_FILE" 2>/dev/null || stat -f "%OLp" "$ENV_FILE" 2>/dev/null)
        if [ "$PERMS" = "600" ]; then
            print_pass ".env文件权限: $PERMS (安全)"
        else
            print_warn ".env文件权限: $PERMS (建议600)"
            print_info "   修复: chmod 600 .env"
        fi
    else
        print_info "无.env文件（使用环境变量或配置文件）"
    fi
    echo
}

# 8. 检查detect-secrets基线
check_secrets_baseline() {
    print_header "8. 密钥泄露检测"

    if [ -f ".secrets.baseline" ]; then
        print_pass "detect-secrets基线文件存在"

        if command -v detect-secrets &> /dev/null; then
            print_info "运行detect-secrets扫描..."
            if detect-secrets scan --baseline .secrets.baseline &> /dev/null; then
                print_pass "未检测到新密钥泄露"
            else
                print_fail "检测到新密钥泄露"
                print_info "   查看详情: detect-secrets scan --baseline .secrets.baseline"
            fi
        else
            print_warn "未安装detect-secrets"
            print_info "   安装: pip install detect-secrets==1.5.0"
        fi
    else
        print_warn "无.secrets.baseline文件"
    fi
    echo
}

# 9. 检查Gateway端口
check_gateway_port() {
    print_header "9. Gateway端口检查"

    DEFAULT_PORT=18789

    if command -v ss &> /dev/null; then
        if ss -ltn | grep -q ":$DEFAULT_PORT"; then
            BIND_ADDR=$(ss -ltn | grep ":$DEFAULT_PORT" | awk '{print $4}')

            if echo "$BIND_ADDR" | grep -q "127.0.0.1\|localhost\|\*:$DEFAULT_PORT"; then
                if echo "$BIND_ADDR" | grep -q "\*:$DEFAULT_PORT"; then
                    print_fail "Gateway绑定到0.0.0.0:$DEFAULT_PORT (公网可访问)"
                    print_info "   修复: 使用 --bind loopback 参数启动"
                else
                    print_pass "Gateway绑定到本地: $BIND_ADDR"
                fi
            fi
        else
            print_info "Gateway未运行 (端口$DEFAULT_PORT未监听)"
        fi
    elif command -v netstat &> /dev/null; then
        # Windows/旧系统fallback
        if netstat -an | grep -q ":$DEFAULT_PORT"; then
            print_info "检测到端口$DEFAULT_PORT已监听 (请手动验证绑定地址)"
        else
            print_info "Gateway未运行 (端口$DEFAULT_PORT未监听)"
        fi
    fi
    echo
}

# 10. 生成总结
print_summary() {
    print_header "安全检查总结"

    echo -e "${GREEN}通过: $PASSED${NC}"
    echo -e "${YELLOW}警告: $WARNINGS${NC}"
    echo -e "${RED}严重: $CRITICAL${NC}"
    echo

    if [ "$CRITICAL" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
        echo -e "${GREEN}🎉 所有检查通过！您的Moltbot部署符合安全最佳实践。${NC}"
    elif [ "$CRITICAL" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  存在 $WARNINGS 个警告项，建议修复以提升安全性。${NC}"
    else
        echo -e "${RED}🚨 发现 $CRITICAL 个严重问题，请立即修复！${NC}"
    fi
    echo

    print_info "完整安全审计: moltbot security audit --deep --fix"
    print_info "详细分析报告: ./MOLTBOT项目深度分析报告.md"
}

# 主函数
main() {
    clear
    echo
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Moltbot 安全配置快速检查脚本 v1.0       ║${NC}"
    echo -e "${BLUE}║   生成时间: 2026年1月28日                  ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo

    check_node_version
    check_config_permissions
    check_dm_policy
    check_gateway_auth
    check_sandbox_config
    check_pairing_requests
    check_env_security
    check_secrets_baseline
    check_gateway_port
    print_summary
}

# 运行主函数
main
