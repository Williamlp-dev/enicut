import { useCallback, useRef } from "react";
import { probeVideo } from "@/lib/tauri";
import type { VideoInfo } from "@/types/video";

export interface UseVideoReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  resolveVideoSrc: (path: string) => Promise<{ info: VideoInfo; src: string }>;
}

export function useVideo(): UseVideoReturn {
  const videoRef = useRef<HTMLVideoElement>(null);

  const play = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
    } catch (error) {
      // AbortError ocorre quando play() é interrompido antes de iniciar (ex: seek imediato) — não é um erro real
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("[useVideo] Falha ao iniciar reprodução:", error);
    }
  }, []);

  const pause = useCallback((): void => {
    videoRef.current?.pause();
  }, []);

  const seek = useCallback((time: number): void => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
  }, []);

  // Converte o caminho nativo do arquivo em URL compatível com o protocolo asset:// do Tauri
  const resolveVideoSrc = useCallback(
    async (path: string): Promise<{ info: VideoInfo; src: string }> => {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      const src = convertFileSrc(path);
      const info = await probeVideo(path);
      return { info, src };
    },
    [],
  );

  return { videoRef, play, pause, seek, resolveVideoSrc };
}
