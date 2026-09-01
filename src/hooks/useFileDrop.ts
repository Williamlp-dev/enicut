import { useEffect, useState } from "react";
import type { VideoInfo } from "@/types/video";

export interface UseFileDropReturn {
  isDragging: boolean;
}

interface FileDropProps {
  onFile: (path: string) => void;
  videoInfo: VideoInfo | null;
}

// Extensões de vídeo aceitas no drop para filtragem de arquivos arrastados
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"];

export function useFileDrop({
  onFile,
  videoInfo,
}: FileDropProps): UseFileDropReturn {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();

        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setIsDragging(true);
          } else if (event.payload.type === "drop") {
            setIsDragging(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const videoPath = paths.find((p) =>
                SUPPORTED_VIDEO_EXTENSIONS.some((ext) =>
                  p.toLowerCase().endsWith(ext),
                ),
              );
              if (videoPath) {
                onFile(videoPath);
              }
            }
          } else if (event.payload.type === "leave") {
            setIsDragging(false);
          }
        });
      } catch (error) {
        // Hook executado fora do contexto Tauri (ex: testes ou dev web puro)
        console.warn("[useFileDrop] Contexto Tauri indisponível:", error);
      }
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [onFile]);

  // Com vídeo carregado a dropzone desaparece, então o estado de arraste é irrelevante
  const effectiveDragging = isDragging && !videoInfo;

  return { isDragging: effectiveDragging };
}
