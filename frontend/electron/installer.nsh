; ==============================================================================
; PyShield Studio - Custom NSIS Windows Installer Script
; ==============================================================================
; Provides:
; 1. Custom "Select Additional Tasks" wizard page right after Directory selection
; 2. Desktop Shortcut Checkbox (user selectable)
; 3. Add to PATH Environment Variable Checkbox (user selectable)
; 4. Clean Uninstaller to remove shortcuts and PATH entries
; ==============================================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ------------------------------------------------------------------------------
; Global State Variables (Declared globally so all macros recognise them)
; ------------------------------------------------------------------------------
Var TasksDialog
Var CheckboxDesktop
Var CheckboxDesktop_State
Var CheckboxPath
Var CheckboxPath_State

; ------------------------------------------------------------------------------
; Helper Macro: String Replace (for uninstaller PATH cleanup)
; ------------------------------------------------------------------------------
!macro DefineStrRep UN
Function ${UN}StrRep
  Exch $R2 ; ReplacementString
  Exch
  Exch $R1 ; SearchString
  Exch 2
  Exch $R0 ; SourceString
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8

  StrLen $R5 $R1
  StrCpy $R3 0
  Loop:
    StrCpy $R4 $R0 $R5 $R3
    StrCmp $R4 "" Done
    StrCmp $R4 $R1 Found
    IntOp $R3 $R3 + 1
    Goto Loop

  Found:
    StrCpy $R4 $R0 $R3
    IntOp $R6 $R3 + $R5
    StrCpy $R7 $R0 "" $R6
    StrCpy $R0 "$R4$R2$R7"
    StrLen $R8 $R2
    IntOp $R3 $R3 + $R8
    Goto Loop

  Done:
    Pop $R8
    Pop $R7
    Pop $R6
    Pop $R5
    Pop $R4
    Pop $R3
    Push $R0
    Exch
    Pop $R2
    Exch
    Pop $R1
FunctionEnd
!macroend

!insertmacro DefineStrRep "un."

; ------------------------------------------------------------------------------
; Installer Wizard Page (Skipped when building uninstaller binary)
; ------------------------------------------------------------------------------
!ifndef BUILD_UNINSTALLER
!ifndef UNINSTALLER_OUT_FILE

; Hook into electron-builder's assisted installer:
; Inserts the custom page right after the Directory selection page
!macro customPageAfterChangeDir
  Page custom AdditionalTasksPageCreate AdditionalTasksPageLeave
!macroend

Function AdditionalTasksPageCreate
  nsDialogs::Create 1018
  Pop $TasksDialog
  ${If} $TasksDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "Select the additional tasks you would like Setup to perform while installing ${PRODUCT_NAME}:"
  Pop $0

  ; --- Section 1: Additional Shortcuts ---
  ${NSD_CreateLabel} 0 18u 100% 10u "Additional shortcuts:"
  Pop $0

  ${NSD_CreateCheckbox} 10u 32u 90% 12u "Create a &desktop shortcut"
  Pop $CheckboxDesktop
  ${If} $CheckboxDesktop_State == ""
    StrCpy $CheckboxDesktop_State 1
  ${EndIf}
  ${NSD_SetState} $CheckboxDesktop $CheckboxDesktop_State

  ; --- Section 2: Command Line & System PATH ---
  ${NSD_CreateLabel} 0 52u 100% 10u "Command line integration:"
  Pop $0

  ${NSD_CreateCheckbox} 10u 66u 90% 12u "&Add PyShield Studio to PATH environment variable (recommended)"
  Pop $CheckboxPath
  ${If} $CheckboxPath_State == ""
    StrCpy $CheckboxPath_State 1
  ${EndIf}
  ${NSD_SetState} $CheckboxPath $CheckboxPath_State

  nsDialogs::Show
FunctionEnd

Function AdditionalTasksPageLeave
  ${NSD_GetState} $CheckboxDesktop $CheckboxDesktop_State
  ${NSD_GetState} $CheckboxPath $CheckboxPath_State
FunctionEnd

!endif
!endif

; ------------------------------------------------------------------------------
; Installation Hook: Perform Selected Tasks
; ------------------------------------------------------------------------------
!macro customInstall
  ; 1. Create Desktop Shortcut if checked
  ${If} $CheckboxDesktop_State == 1
    DetailPrint "Creating Desktop Shortcut..."
    CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  ${EndIf}

  ; 2. Add to User PATH if checked
  ${If} $CheckboxPath_State == 1
    DetailPrint "Adding $INSTDIR to User PATH..."
    Push $R0
    Push $R1
    Push $R2

    ReadRegStr $R0 HKCU "Environment" "PATH"
    ${If} $R0 != ""
      StrCpy $R1 "$R0;$INSTDIR"
    ${Else}
      StrCpy $R1 "$INSTDIR"
    ${EndIf}

    WriteRegExpandStr HKCU "Environment" "PATH" "$R1"
    
    ; Broadcast WM_SETTINGCHANGE so Windows Explorer & open terminals pick up PATH
    System::Call 'user32::SendMessageTimeout(i 0xffff, i 0x001A, i 0, t "Environment", i 0, i 5000, *i .R2)'
    
    Pop $R2
    Pop $R1
    Pop $R0
  ${EndIf}
!macroend

; ------------------------------------------------------------------------------
; Uninstallation Hook: Clean up shortcuts and PATH
; ------------------------------------------------------------------------------
!macro customUnInstall
  DetailPrint "Cleaning up PyShield Studio desktop shortcuts..."
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  DetailPrint "Cleaning up PATH environment variable..."
  Push $R0
  Push $R1
  Push $R2
  ReadRegStr $R0 HKCU "Environment" "PATH"
  ${If} $R0 != ""
    ; Remove ";$INSTDIR"
    Push "$R0"
    Push ";$INSTDIR"
    Push ""
    Call un.StrRep
    Pop $R1

    ; Remove "$INSTDIR;"
    Push "$R1"
    Push "$INSTDIR;"
    Push ""
    Call un.StrRep
    Pop $R1

    ; Remove "$INSTDIR" (if it was the only entry)
    Push "$R1"
    Push "$INSTDIR"
    Push ""
    Call un.StrRep
    Pop $R1

    WriteRegExpandStr HKCU "Environment" "PATH" "$R1"
    System::Call 'user32::SendMessageTimeout(i 0xffff, i 0x001A, i 0, t "Environment", i 0, i 5000, *i .R2)'
  ${EndIf}
  Pop $R2
  Pop $R1
  Pop $R0
!macroend
