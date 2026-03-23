; mlc Windows Installer (NSIS)
; 빌드: makensis installer.nsi

!define APP_NAME "My Little Company"
!define APP_VERSION "0.1.0"
!define APP_PUBLISHER "김동인 (amiroKim)"
!define APP_URL "https://github.com/donginKim/my-little-company"
!define BINARY_SRC "mlc-win-x64.exe"
!define INSTALL_DIR "$PROGRAMFILES64\mlc"
!define REG_UNINSTALL "Software\Microsoft\Windows\CurrentVersion\Uninstall\mlc"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "mlc-setup-win-x64.exe"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel admin
Unicode True

;--------------------------------
; 설치
;--------------------------------
Section "Install"
  SetOutPath "$INSTDIR"
  File /oname=mlc.exe "${BINARY_SRC}"

  ; PATH 추가 (시스템)
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
  StrCpy $0 "$0;$INSTDIR"
  WriteRegExpandStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$0"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000

  ; 프로그램 추가/제거 등록
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${REG_UNINSTALL}" "DisplayName"     "${APP_NAME}"
  WriteRegStr HKLM "${REG_UNINSTALL}" "DisplayVersion"  "${APP_VERSION}"
  WriteRegStr HKLM "${REG_UNINSTALL}" "Publisher"       "${APP_PUBLISHER}"
  WriteRegStr HKLM "${REG_UNINSTALL}" "URLInfoAbout"    "${APP_URL}"
  WriteRegStr HKLM "${REG_UNINSTALL}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegDWORD HKLM "${REG_UNINSTALL}" "NoModify" 1
  WriteRegDWORD HKLM "${REG_UNINSTALL}" "NoRepair"  1
SectionEnd

;--------------------------------
; 제거
;--------------------------------
Section "Uninstall"
  Delete "$INSTDIR\mlc.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  ; PATH에서 제거
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
  ${WordReplace} $0 ";$INSTDIR" "" "+" $0
  WriteRegExpandStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$0"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000

  DeleteRegKey HKLM "${REG_UNINSTALL}"
SectionEnd
