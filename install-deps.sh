#!/bin/bash
#
# 依赖安装脚本
#

set -e

echo "========================================="
echo "  开始安装项目依赖"
echo "========================================="
echo

# 检查 pnpm
if command -v pnpm &> /dev/null; then
    echo "✓ 使用 pnpm 安装依赖..."
    pnpm install
elif command -v npm &> /dev/null; then
    echo "✓ 使用 npm 安装依赖..."
    npm install
else
    echo "✗ 错误: 未找到 npm 或 pnpm"
    exit 1
fi

echo
echo "========================================="
echo "  依赖安装完成"
echo "========================================="
echo

# 验证安装
if [ -d "node_modules" ]; then
    echo "✓ node_modules 目录已创建"
    echo "✓ 已安装包数量: $(ls node_modules | wc -l)"
else
    echo "✗ node_modules 目录不存在"
    exit 1
fi
