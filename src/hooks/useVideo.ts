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
  onSeeked: () => void;
  resolveVideoSrc: (path: string) => Promise<{ info: VideoInfo; src: string }>;
}

export function useVideo(): UseVideoReturn {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Gating de seek e scrubbing para evitar colisões no demuxer do Chromium/WebView2
  const desiredTimeRef = useRef<number>(0);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const seekScheduledRef = useRef<boolean>(false);
  const wasPlayingRef = useRef<boolean>(false);

  const play = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("[useVideo] Falha ao iniciar reprodução:", error);
    }
  }, []);

  const pause = useCallback((): void => {
    videoRef.current?.pause();
  }, []);

  // Aplica o seek garantindo no máximo 1 operação de decodificação ativa no demuxer por vez
  const applySeek = useCallback((time: number): void => {
    const video = videoRef.current;
    if (!video) return;

    if (video.seeking) {
      pendingSeekTimeRef.current = time;
    } else {
      pendingSeekTimeRef.current = null;
      try {
        video.currentTime = time;
      } catch (err) {
        console.warn("[useVideo] Falha ao aplicar seek:", err);
      }
    }
  }, []);

  // Disparado no evento 'seeked' da tag <video> quando o frame anterior terminou de carregar
  const onSeeked = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;

    if (pendingSeekTimeRef.current !== null) {
      const nextTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;
      try {
        video.currentTime = nextTime;
      } catch (err) {
        console.warn("[useVideo] Falha no pending seek:", err);
      }
    }
  }, []);

  const seek = useCallback(
    (time: number): void => {
      applySeek(time);
    },
    [applySeek],
  );

  const beginScrub = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    wasPlayingRef.current = !video.paused;
    video.pause();
  }, []);

  const scrubTo = useCallback(
    (time: number): void => {
      desiredTimeRef.current = time;

      if (seekScheduledRef.current) return;
      seekScheduledRef.current = true;

      requestAnimationFrame(() => {
        seekScheduledRef.current = false;
        applySeek(desiredTimeRef.current);
      });
    },
    [applySeek],
  );

  const endScrub = useCallback(
    (time: number): void => {
      seekScheduledRef.current = false;
      applySeek(time);
      if (wasPlayingRef.current) {
        play();
      }
    },
    [applySeek, play],
  );

  const resolveVideoSrc = useCallback(
    async (path: string): Promise<{ info: VideoInfo; src: string }> => {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      const src = convertFileSrc(path);
      const info = await probeVideo(path);
      return { info, src };
    },
    [],
  );

  return {
    videoRef,
    play,
    pause,
    seek,
    beginScrub,
    scrubTo,
    endScrub,
    onSeeked,
    resolveVideoSrc,
  };
}
