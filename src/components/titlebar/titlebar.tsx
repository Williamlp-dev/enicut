import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Maximize, Minimize, Minus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useVideoContext } from "@/app/video-provider";
import { formatFileSize } from "@/lib/time";

export function Titlebar() {
  const { videoInfo, handleOpenFile } = useVideoContext();
  const [isMaximized, setIsMaximized] = useState(false);

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
    <div
      className="flex items-center justify-between h-12 bg-surface border-b border-border pl-4 select-none cursor-default"
      onPointerDown={startDrag}
      onDoubleClick={handleToggleMaximize}
    >
      <div className="flex items-center">
        <img
          src="/logo.svg"
          alt="ENICUT"
          className="w-6 h-6 pointer-events-none"
        />
      </div>

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
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
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
  );
}
