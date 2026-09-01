import { useEffect } from "react";

export interface ShortcutHandlers {
  onTogglePlayback: () => void;
  onSetIn: () => void;
  onSetOut: () => void;
}

// Registra atalhos de teclado globais enquanto o componente está montado
export function useShortcuts({
  onTogglePlayback,
  onSetIn,
  onSetOut,
}: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignora atalhos quando o foco está em campos de entrada de texto
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.code) {
        case "Space": {
          event.preventDefault();
          onTogglePlayback();
          break;
        }
        case "KeyI":
          event.preventDefault();
          onSetIn();
          break;
        case "KeyO":
          event.preventDefault();
          onSetOut();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTogglePlayback, onSetIn, onSetOut]);
}
