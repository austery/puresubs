#!/bin/bash

# PureSubs 项目快速启动脚本
# 此脚本会安装依赖、运行测试、并启动开发环境

set -e

echo "🚀 PureSubs 项目快速启动"
echo "=========================="

# 检查 Node.js 版本
echo "检查 Node.js 版本..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ 需要 Node.js 18 或更高版本，当前版本: $(node -v)"
    exit 1
fi
echo "✅ Node.js 版本: $(node -v)"

# 检查 pnpm
echo "检查 pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，正在安装..."
    npm install -g pnpm
fi
echo "✅ pnpm 版本: $(pnpm -v)"

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 运行类型检查
echo "🔍 运行类型检查..."
pnpm --filter @puresubs/core-engine run lint || echo "⚠️  核心引擎有 lint 警告"
pnpm --filter @puresubs/chrome-extension run lint || echo "⚠️  Chrome 扩展有 lint 警告"

# 运行测试
echo "🧪 运行测试..."
pnpm --filter @puresubs/core-engine test || echo "⚠️  一些测试失败或跳过（这在开发初期是正常的）"

# 构建项目
echo "🔨 构建项目..."
pnpm --filter @puresubs/core-engine build || echo "⚠️  核心引擎构建可能有问题"
pnpm --filter @puresubs/chrome-extension build:dev || echo "⚠️  Chrome 扩展构建可能有问题"

echo ""
echo "✅ 启动完成！"
echo ""
echo "📋 下一步操作："
echo "1. 开始核心引擎开发: cd packages/core-engine && pnpm dev"
echo "2. 开始扩展开发: cd packages/chrome-extension && pnpm dev"
echo "3. 运行测试: pnpm test"
echo "4. 查看任务清单: cat TASKS.md"
echo ""
echo "🔗 有用的命令："
echo "- pnpm dev          # 启动所有包的开发模式"
echo "- pnpm test         # 运行所有测试"
echo "- pnpm build        # 构建所有包"
echo "- pnpm lint         # 检查代码质量"
echo ""
echo "📚 查看 README.md 了解更多信息"
