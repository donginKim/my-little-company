#!/bin/sh
set -e

REPO="donginKim/my-little-company"
INSTALL_DIR="/usr/local/bin"

# OS / 아키텍처 감지
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)  TARGET="mlc-macos-arm64" ;;
      x86_64) TARGET="mlc-macos-arm64" ;;  # Rosetta 2로 동작
      *) echo "지원하지 않는 아키텍처: $ARCH"; exit 1 ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64) TARGET="mlc-linux-x64" ;;
      *) echo "지원하지 않는 아키텍처: $ARCH"; exit 1 ;;
    esac
    ;;
  *)
    echo "지원하지 않는 OS: $OS"
    echo "Windows는 install.ps1을 사용하세요."
    exit 1
    ;;
esac

# 최신 버전 조회
VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "릴리즈 버전을 가져오지 못했습니다."
  exit 1
fi

URL="https://github.com/$REPO/releases/download/$VERSION/$TARGET"

echo "mlc $VERSION 다운로드 중..."
curl -fsSL "$URL" -o /tmp/mlc
chmod +x /tmp/mlc

# 설치 (권한 필요 시 sudo 사용)
if [ -w "$INSTALL_DIR" ]; then
  mv /tmp/mlc "$INSTALL_DIR/mlc"
else
  echo "sudo 권한으로 $INSTALL_DIR 에 설치합니다..."
  sudo mv /tmp/mlc "$INSTALL_DIR/mlc"
fi

echo ""
echo "✓ mlc $VERSION 설치 완료 → $INSTALL_DIR/mlc"
echo "  사용법: mlc --help"
