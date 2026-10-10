#!/bin/bash
# Chrome 扩展打包脚本
# 用法: ./build.sh [版本号]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/dist"
VERSION=${1:-"1.0.0"}

echo "=== BF Auto Plugin 打包工具 ==="
echo "版本号: $VERSION"

# 清理旧的构建目录
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "复制文件到构建目录..."

# 复制核心文件
cp -r "$SCRIPT_DIR/background" "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/content" "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/popup" "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/shared" "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/icons" "$BUILD_DIR/"

# 使用生产版本 manifest.json（权限最小化）
cp "$SCRIPT_DIR/manifest.production.json" "$BUILD_DIR/manifest.json"

# 更新版本号
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$BUILD_DIR/manifest.json"
else
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$BUILD_DIR/manifest.json"
fi

echo "生成 manifest.json (生产配置)..."

# 创建 ZIP 包
ZIP_NAME="bf-auto-plugin-v${VERSION}.zip"
echo "打包为 $ZIP_NAME..."

cd "$BUILD_DIR"
zip -r "../$ZIP_NAME" . -x "*.DS_Store" -x "__MACOSX/*"

echo ""
echo "=== 打包完成 ==="
echo "构建目录: $BUILD_DIR"
echo "ZIP 包: $SCRIPT_DIR/$ZIP_NAME"
echo ""
echo "安装方式:"
echo "  1. 打开 Chrome 扩展管理页面 (chrome://extensions/)"
echo "  2. 开启开发者模式"
echo "  3. 点击'加载已解压的扩展程序'，选择 dist 目录"
echo "  或者: 将 $ZIP_NAME 上传到 Chrome Web Store"
