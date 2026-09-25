; =============================================================
; ENICUT - NSIS Uninstaller Hooks
; Garante exclusão completa de todos os dados ao desinstalar
; =============================================================

; --- Alinhamento e Configurações Visuais do Header do NSIS ---
; Posiciona o logo no canto SUPERIOR DIREITO (padrão de instaladores profissionais)
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH

; Altera o texto do rodapé (substitui o 'Nullsoft Install System v3.11')
; Pode ser "ENICUT" ou " " para ficar totalmente invisível
BrandingText "ENICUT"

; Roda ANTES de remover arquivos, registry e atalhos
!macro NSIS_HOOK_PREUNINSTALL
  ; Mensagem de confirmação personalizada
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Deseja remover TODOS os dados do ENICUT?$\n$\nIsso inclui configurações, cache, banco de dados local e histórico de uso.$\n$\nEssa ação não pode ser desfeita." \
    IDYES do_full_cleanup IDNO skip_cleanup

  do_full_cleanup:
    SetShellVarContext current

    ; --- AppData\Local\ENICUT (pasta principal de instalação) ---
    RMDir /r "$LOCALAPPDATA\ENICUT"

    ; --- AppData\Roaming\com.enicut.app (dados Tauri: config, db, logs) ---
    RMDir /r "$APPDATA\com.enicut.app"

    ; --- AppData\Local\com.enicut.app (cache Tauri/WebView) ---
    RMDir /r "$LOCALAPPDATA\com.enicut.app"

    ; --- Cache do WebView2 (EBWebView) ---
    RMDir /r "$LOCALAPPDATA\ENICUT\EBWebView"

    ; --- Temp files do app ---
    RMDir /r "$TEMP\ENICUT"

    ; --- Entradas extras no registry (file associations, etc.) ---
    DeleteRegKey HKCU "Software\ENICUT"
    DeleteRegKey HKLM "SOFTWARE\ENICUT"
    DeleteRegKey HKCU "Software\com.enicut.app"

    Goto cleanup_done

  skip_cleanup:
    ; O usuário escolheu NÃO deletar dados — continua só removendo o executável

  cleanup_done:
!macroend

; Roda DEPOIS que o desinstalador removeu tudo (arquivos, registry, atalhos)
!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove a pasta de instalação principal se ainda existir (pode ter sobrado algo)
  SetShellVarContext current
  RMDir /r "$INSTDIR"

  ; Notificação final
  MessageBox MB_OK|MB_ICONINFORMATION \
    "O ENICUT foi completamente removido do seu computador.$\nObrigado por usar o ENICUT!"
!macroend
