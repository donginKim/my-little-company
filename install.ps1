# mlc Windows 설치 스크립트
# 사용법: irm https://raw.githubusercontent.com/donginKim/my-little-company/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO = "donginKim/my-little-company"
$TARGET = "mlc-win-x64.exe"
$INSTALL_DIR = "$env:LOCALAPPDATA\mlc"

# 최신 버전 조회
Write-Host "최신 버전 확인 중..."
$release = Invoke-RestMethod "https://api.github.com/repos/$REPO/releases/latest"
$VERSION = $release.tag_name

$URL = "https://github.com/$REPO/releases/download/$VERSION/$TARGET"

# 설치 디렉터리 생성
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

# 다운로드
Write-Host "mlc $VERSION 다운로드 중..."
Invoke-WebRequest -Uri $URL -OutFile "$INSTALL_DIR\mlc.exe"

# PATH 등록 (없는 경우에만)
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$INSTALL_DIR*") {
  [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$INSTALL_DIR", "User")
  Write-Host "PATH에 $INSTALL_DIR 추가됨"
}

Write-Host ""
Write-Host "✓ mlc $VERSION 설치 완료 → $INSTALL_DIR\mlc.exe"
Write-Host "  터미널을 재시작한 후 'mlc --help' 를 실행하세요."
