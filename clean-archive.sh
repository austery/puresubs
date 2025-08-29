#!/bin/bash

# 🗑️ 文档归档清理脚本
# 在审阅完 docs_archive/ 中的文件后，运行此脚本进行清理

echo "🔍 正在检查归档文件夹..."

if [ ! -d "docs_archive" ]; then
    echo "❌ 归档文件夹不存在"
    exit 1
fi

echo "📦 归档文件夹内容："
ls -la docs_archive/

echo ""
echo "⚠️  即将删除 docs_archive/ 文件夹及其所有内容"
echo "📋 确认要删除的文件："
find docs_archive/ -type f -name "*.md" -o -name "*.html" | sort

echo ""
read -p "❓ 确认删除吗？(yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    rm -rf docs_archive/
    echo "✅ 归档文件夹已删除"
    echo "🎉 项目文档清理完成！"
else
    echo "❌ 操作已取消"
    echo "💡 如需删除，请运行: rm -rf docs_archive/"
fi
