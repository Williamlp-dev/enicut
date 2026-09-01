import { useCallback, useRef } from "react";
import { probeVideo } from "@/lib/tauri";
import type { VideoInfo } from "@/types/video";

export interface UseVideoReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  beginScrub: () => void;
  scrubTo: (time: number) => void;
  endScrub: (time: number) => void;
  resolveVideoSrc: (path: string) => Promise<{ info: VideoInfo; src: string }>;
}

export function useVideo(): UseVideoReturn {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Scrub state — refs mutáveis evitam closures stale e re-renders durante o drag
  const desiredTimeRef = useRef<number>(0);
  const seekScheduledRef = useRef<boolean>(false);
  const wasPlayingRef = useRef<boolean>(false);

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

  // Pausa o vídeo e salva se estava tocando — chamado no pointerdown da timeline
  const beginScrub = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    wasPlayingRef.current = !video.paused;
    video.pause();
  }, []);

  // Agenda um único seek por frame via rAF, descartando seeks intermediários (latest-frame-wins).
  // Usa requestAnimationFrame — não rVFC — porque o vídeo está pausado durante o scrub
  // e rVFC só dispara quando um novo frame é apresentado ao compositor, o que não acontece
  // com vídeo parado, causando o seek ficar preso na fila indefinidamente.
  const scrubTo = useCallback((time: number): void => {
    desiredTimeRef.current = time;

    if (seekScheduledRef.current) return;
    seekScheduledRef.current = true;

    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) {
        seekScheduledRef.current = false;
        return;
      }
      video.currentTime = desiredTimeRef.current;
      seekScheduledRef.current = false;
    });
  }, []);

  // Seek final preciso e retoma play se estava tocando — chamado no pointerup da timeline
  const endScrub = useCallback(
    (time: number): void => {
      seekScheduledRef.current = false;
      seek(time);
      if (wasPlayingRef.current) {
        play();
      }
    },
    [seek, play],
  );

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

  return { videoRef, play, pause, seek, beginScrub, scrubTo, endScrub, resolveVideoSrc };
}
