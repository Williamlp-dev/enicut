import { open } from "@tauri-apps/plugin-dialog";
import {
  ExternalLink,
  FolderOpen,
  Keyboard,
  Maximize,
  Minimize,
  Minus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useVideoContext } from "@/app/video-provider";
import { ShortcutsModal } from "@/components/modals/shortcuts-modal";
import { UpdateModal } from "@/components/modals/update-modal";
import { Dropdown } from "@/components/ui/dropdown";
import { useUpdater } from "@/hooks/useUpdater";
import { formatFileSize } from "@/lib/time";

export function Titlebar() {
  const { videoInfo, handleOpenFile } = useVideoContext();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const updater = useUpdater();

  // Escuta os eventos nativos do Windows (Snape, Win + Setas, Dois cliques)
  useEffect(() => {
    let unlistenResized: (() => void) | undefined;

    const setupListener = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();

      const checkMaximized = async () => {
        setIsMaximized(await window.isMaximized());
      };

      await checkMaximized();

      // Atualiza o estado da UI sempre que a janela mudar de tamanho nativamente
      const unlistenPromise = window.onResized(checkMaximized);
      unlistenResized = await unlistenPromise;
    };

    setupListener();

    return () => {
      if (unlistenResized) unlistenResized();
    };
  }, []);

  const startDrag = async (e: React.PointerEvent) => {
    if (e.button === 0) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      getCurrentWindow().startDragging();
    }
  };

  // Alterna maximizar/restaurar de forma nativa e leve
  const handleToggleMaximize = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    try {
      // Método oficial e robusto do Tauri v2 para gerenciar os dois estados
      await appWindow.toggleMaximize();
    } catch (error) {
      console.error("[Titlebar] Erro ao alternar maximização:", error);
    }
  };

  const handleOpenDialog = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Vídeo",
          extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"],
        },
      ],
    });
    if (selected && typeof selected === "string") {
      await handleOpenFile(selected);
    }
  };

  const close = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    getCurrentWindow().close();
  };

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: A barra de título customizada do Tauri gerencia o arrasto nativo e maximização da janela do SO */}
      <div
        className="flex items-center justify-between h-12 bg-surface border-b border-border pl-4 select-none cursor-default"
        onPointerDown={startDrag}
        onDoubleClick={handleToggleMaximize}
      >
        <Dropdown.Root className="flex items-center">
          <Dropdown.Trigger
            className="relative p-1.5 rounded-md transition-colors duration-100 hover:bg-white/10 active:bg-white/15 aria-expanded:bg-white/10 cursor-pointer flex items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-accent"
            title={
              updater.hasUpdate
                ? `ENICUT v${updater.updateInfo?.version || ""} disponível! Clique para ver novidades`
                : "Menu ENICUT"
            }
          >
            <img
              src="/logo.svg"
              alt="ENICUT"
              className="w-6 h-6 pointer-events-none"
            />

            {/* Indicador pulsante quando há nova versão disponível */}
            {updater.hasUpdate && (
              <span className="absolute top-0.5 right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent ring-2 ring-surface" />
              </span>
            )}
          </Dropdown.Trigger>

          <Dropdown.Content align="left" className="w-56">
            <Dropdown.Label>ENICUT</Dropdown.Label>

            <Dropdown.Item
              onClick={() => {
                updater.openModal();
                if (!updater.hasUpdate) {
                  // `true` = manual: exibe mensagem de feedback e abre o modal com resultado
                  updater.checkForUpdates(true);
                }
              }}
            >
              <Dropdown.Icon>
                {updater.hasUpdate ? (
                  <Sparkles size={14} className="text-accent" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Dropdown.Icon>
              <span className="flex-1">Verificar atualizações</span>
              {updater.hasUpdate && (
                <span className="text-[10px] bg-accent/20 text-accent font-semibold px-1.5 py-0.5 rounded-full">
                  Novo
                </span>
              )}
            </Dropdown.Item>

            <Dropdown.Item onClick={() => setIsShortcutsOpen(true)}>
              <Dropdown.Icon>
                <Keyboard size={14} />
              </Dropdown.Icon>
              <span className="flex-1">Atalhos de teclado</span>
              <span className="text-[10px] text-text-muted font-mono">
                Ctrl+?
              </span>
            </Dropdown.Item>

            <Dropdown.Separator />

            <Dropdown.Item
              onClick={async () => {
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                openUrl("https://github.com/Williamlp-dev/enicut");
              }}
            >
              <Dropdown.Icon>
                <ExternalLink size={14} />
              </Dropdown.Icon>
              <span className="flex-1">Repositório GitHub</span>
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>

        {videoInfo && (
          <div className="flex-1 flex justify-center items-center gap-3 min-w-0 px-4 text-[11px] text-text-muted font-mono tracking-[0.05em]">
            <span className="truncate min-w-0 text-text/90">
              {videoInfo.name}
            </span>
            <span className="shrink-0 pointer-events-none">·</span>
            <span className="shrink-0 pointer-events-none">
              {videoInfo.width}×{videoInfo.height}
            </span>
            <span className="shrink-0 pointer-events-none">·</span>
            <span className="shrink-0 pointer-events-none">
              {videoInfo.fps.toFixed(0)} FPS
            </span>
            <span className="shrink-0 pointer-events-none">·</span>
            <span className="shrink-0 pointer-events-none">
              {videoInfo.name.split(".").pop()?.toUpperCase() ||
                videoInfo.videoCodec.toUpperCase()}
            </span>
            <span className="shrink-0 pointer-events-none">·</span>
            <span className="shrink-0 pointer-events-none">
              {formatFileSize(videoInfo.fileSize)}
            </span>
          </div>
        )}

        {/* Impede que o double click ou drag se propague para os botões de ação */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Controles da janela interceptam eventos de ponteiro para não propagar arrasto nativo da janela */}
        <div
          className="flex h-full"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-12 flex items-center justify-center bg-transparent border-none text-text-muted cursor-pointer transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            onClick={handleOpenDialog}
            title="Abrir novo arquivo"
          >
            <FolderOpen size={14} />
          </button>
          <button
            type="button"
            id="titlebar-minimize"
            className="w-12 flex items-center justify-center bg-transparent border-none text-text-muted cursor-pointer transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            onClick={async () => {
              const { getCurrentWindow } = await import(
                "@tauri-apps/api/window"
              );
              getCurrentWindow().minimize();
            }}
            title="Minimizar"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            id="titlebar-maximize"
            className="w-12 flex items-center justify-center bg-transparent border-none text-text-muted cursor-pointer transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            onClick={handleToggleMaximize}
            title={isMaximized ? "Restaurar tamanho" : "Maximizar"}
          >
            {isMaximized ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
          <button
            type="button"
            id="titlebar-close"
            className="w-12 flex items-center justify-center bg-transparent border-none text-text-muted cursor-pointer transition-colors duration-150 hover:bg-danger hover:text-text"
            onClick={close}
            title="Fechar janela"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <UpdateModal updater={updater} />
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        onOpen={() => setIsShortcutsOpen(true)}
      />
    </>
  );
}
