import { open } from "@tauri-apps/plugin-dialog";
import { Film, FolderOpen, X } from "lucide-react";
import { useVideoContext } from "@/app/video-provider";
import { Button } from "@/components/ui/button";
import { useFileDrop } from "@/hooks/useFileDrop";

// Extensões de vídeo compatíveis aceitas pelo diálogo nativo do sistema
const SUPPORTED_VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "avi", "webm", "m4v"];

interface CloseOverlayButtonProps {
  onClose: () => void;
}

// Botão flutuante para fechar o vídeo atual, visível no hover sobre o player
function CloseOverlayButton({ onClose }: CloseOverlayButtonProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <Button
        variant="secondary"
        onClick={onClose}
        className="absolute top-4 right-4 pointer-events-auto gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2/85 hover:bg-danger hover:border-danger hover:text-white backdrop-blur-md border border-border/70 shadow-lg opacity-0 group-hover:opacity-100 text-xs"
        title="Fechar vídeo"
      >
        <X size={14} />
        <span>Fechar vídeo</span>
      </Button>
    </div>
  );
}

interface VideoDropzoneProps {
  isDragging: boolean;
  onOpenDialog: () => void;
}

// Área de soltura e seleção de arquivo exibida quando nenhum vídeo está carregado
function VideoDropzone({ isDragging, onOpenDialog }: VideoDropzoneProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDialog();
    }
  };

  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center self-stretch m-6 gap-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ${
        isDragging
          ? "border-accent bg-accent-dim text-accent"
          : "border-border bg-transparent [&:hover:not(:has(button:hover))]:border-accent [&:hover:not(:has(button:hover))]:bg-accent-dim text-text-muted [&:hover:not(:has(button:hover))]:text-accent"
      }`}
      onClick={onOpenDialog}
      role="button"
      tabIndex={0}
      aria-label="Abrir arquivo de vídeo"
      onKeyDown={handleKeyDown}
    >
      <div className="transition-colors duration-200">
        {isDragging ? <Film size={48} /> : <FolderOpen size={48} />}
      </div>
      <p className="text-[15px] font-medium text-text-muted">
        {isDragging
          ? "Solte o vídeo aqui"
          : "Arraste um vídeo ou clique para abrir"}
      </p>
      <p className="text-[12px] text-text-muted opacity-60">
        MP4, MOV, MKV, AVI, WebM
      </p>
      {!isDragging && (
        <Button
          variant="secondary"
          className="gap-2 mt-2"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDialog();
          }}
        >
          <FolderOpen size={16} />
          Abrir vídeo
        </Button>
      )}
    </div>
  );
}

export function VideoPlayer() {
  const {
    videoRef,
    videoSrc,
    videoInfo,
    handleOpenFile,
    handleCloseVideo,
    onPlay,
    onPause,
    onEnded,
  } = useVideoContext();

  const { isDragging } = useFileDrop({ onFile: handleOpenFile, videoInfo });

  const handleOpenDialog = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Vídeo",
            extensions: SUPPORTED_VIDEO_EXTENSIONS,
          },
        ],
      });

      if (selected && typeof selected === "string") {
        await handleOpenFile(selected);
      }
    } catch (error) {
      console.error(
        "[player] Erro ao abrir diálogo de seleção de arquivo:",
        error,
      );
    }
  };

  const showCloseButton = Boolean(videoSrc);

  return (
    <div className="relative flex flex-1 items-center justify-center bg-surface rounded-md overflow-hidden group">
      {showCloseButton && <CloseOverlayButton onClose={handleCloseVideo} />}

      {/* O elemento <video> permanece sempre montado para garantir que videoRef seja válido de imediato */}
      <video
        ref={videoRef}
        src={videoSrc ?? undefined}
        className="w-full h-full block object-contain"
        style={{ display: videoSrc ? "block" : "none" }}
        preload="metadata"
        playsInline
        // Sincronização orientada a eventos para fonte única da verdade
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        // Eventos de diagnóstico no console para monitorar ciclo de vida da mídia
        onLoadedMetadata={(event) => {
          const videoElement = event.currentTarget;
          console.log("[video] loadedmetadata", {
            src: videoElement.currentSrc,
            duration: videoElement.duration,
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            readyState: videoElement.readyState,
            networkState: videoElement.networkState,
          });
        }}
        onCanPlay={() => console.log("[video] canplay")}
        onPlaying={() => console.log("[video] playing")}
        onWaiting={() => console.log("[video] waiting")}
        onError={(event) => {
          const videoElement = event.currentTarget;
          console.error("[video] Erro na tag de vídeo", {
            code: videoElement.error?.code,
            message: videoElement.error?.message,
            currentSrc: videoElement.currentSrc,
            networkState: videoElement.networkState,
            readyState: videoElement.readyState,
          });
        }}
      />

      {!videoSrc && (
        <VideoDropzone
          isDragging={isDragging}
          onOpenDialog={handleOpenDialog}
        />
      )}
    </div>
  );
}
