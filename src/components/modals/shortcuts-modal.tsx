import { Keyboard } from "lucide-react";
import { useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

const SHORTCUT_GROUPS: { title: string; shortcuts: ShortcutItem[] }[] = [
  {
    title: "Reprodução & Edição",
    shortcuts: [
      { keys: ["Espaço"], description: "Reproduzir / Pausar vídeo" },
      { keys: ["I"], description: "Definir Ponto Inicial (In)" },
      { keys: ["O"], description: "Definir Ponto Final (Out)" },
    ],
  },
  {
    title: "Navegação & Janela",
    shortcuts: [
      { keys: ["Ctrl", "?"], description: "Exibir atalhos de teclado" },
      { keys: ["Esc"], description: "Fechar modais e menus" },
    ],
  },
];

export function ShortcutsModal({
  isOpen,
  onClose,
  onOpen,
}: ShortcutsModalProps) {
  // Atalho global 'Ctrl + ?' (ou 'Ctrl + /') para abrir ou fechar o modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;
      const isTriggerKey = e.key === "?" || e.key === "/" || e.code === "Slash";

      if (isModifier && isTriggerKey) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  return (
    <Dialog.Root isOpen={isOpen} onClose={onClose}>
      <Dialog.Content className="max-w-sm">
        <Dialog.Close />

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-accent">
            <Keyboard size={16} />
          </div>
          <div>
            <Dialog.Title className="text-sm">Atalhos de Teclado</Dialog.Title>
            <Dialog.Description className="text-[11px]">
              Comandos rápidos para facilitar a edição
            </Dialog.Description>
          </div>
        </div>

        <div className="space-y-3.5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {group.title}
              </span>
              <div className="space-y-1.5 rounded-lg bg-surface/50 border border-border/60 p-2.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between text-xs py-0.5"
                  >
                    <span className="text-text/80 text-[11px]">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono font-medium text-text shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Dialog.Footer className="mt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 text-xs rounded-lg bg-surface-3 hover:bg-surface text-text transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
