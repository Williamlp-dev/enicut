import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { type UseCutReturn, useCut } from "@/hooks/useCut";
import { type UseTimelineReturn, useTimeline } from "@/hooks/useTimeline";
import { type UseVideoReturn, useVideo } from "@/hooks/useVideo";
import { generateThumbnails, getCliArg } from "@/lib/tauri";
import type { VideoInfo } from "@/types/video";

const THUMB_COUNT = 10;

// resolveVideoSrc é interno — VideoProvider expõe handleOpenFile em seu lugar.
// beginScrub, scrubTo e endScrub são propagados via spread de video abaixo.
type VideoAPI = Omit<UseVideoReturn, "resolveVideoSrc">;

interface VideoContextValue extends VideoAPI, UseTimelineReturn, UseCutReturn {
  videoInfo: VideoInfo | null;
  videoSrc: string | null; // declarative src for <video src={videoSrc} />
  isPlaying: boolean;
  thumbnails: string[];
  handleOpenFile: (path: string) => Promise<void>;
  handleCloseVideo: () => void;
  // Wired to <video> element events — single source of truth for isPlaying
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}

const VideoContext = createContext<VideoContextValue | null>(null);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const activeVideoPathRef = useRef<string | null>(null);

  const video = useVideo();
  const { resolveVideoSrc, pause, videoRef } = video;
  const timeline = useTimeline(videoInfo?.duration ?? 0);
  const { reset: resetTimeline } = timeline;
  const cut = useCut();

  // isPlaying is driven ONLY by the real <video> element events
  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onEnded = useCallback(() => setIsPlaying(false), []);

  const thumbnailUnlistenRef = useRef<(() => void) | null>(null);

  const handleOpenFile = useCallback(
    async (path: string) => {
      activeVideoPathRef.current = path;
      try {
        const { info, src } = await resolveVideoSrc(path);

        setVideoSrc(src);
        setVideoInfo(info);
        setIsPlaying(false);
        resetTimeline(info.duration);

        // Limpa listener anterior e reinicia slots da timeline
        thumbnailUnlistenRef.current?.();
        thumbnailUnlistenRef.current = null;
        setThumbnails(Array(THUMB_COUNT).fill(""));

        // Escuta eventos "thumbnail-ready" emitidos pelo backend conforme
        // cada frame é gerado em paralelo — preenche slots progressivamente.
        const unlisten = await listen<{ index: number; path: string }>(
          "thumbnail-ready",
          (event) => {
            if (activeVideoPathRef.current !== path) return;
            const { index, path: thumbPath } = event.payload;
            if (!thumbPath) return;
            setThumbnails((prev) => applyThumbnailPath(prev, index, convertFileSrc(thumbPath)));
          },
        );
        thumbnailUnlistenRef.current = unlisten;

        // Dispara a geração — o invoke retorna os hits de cache imediatamente;
        // os frames ausentes chegam via "thumbnail-ready" à medida que ficam prontos.
        generateThumbnails(path, THUMB_COUNT)
          .then((cachedPaths) => {
            if (activeVideoPathRef.current !== path) return;
            setThumbnails((prev) => {
              const next = [...prev];
              cachedPaths.forEach((p, i) => {
                if (p) next[i] = convertFileSrc(p);
              });
              return next;
            });
          })
          .catch((err) =>
            console.warn("[VideoProvider] thumbnails error:", err),
          );
      } catch (err) {
        console.error("[VideoProvider] failed to load video:", err);
      }
    },
    [resolveVideoSrc, resetTimeline],
  );

  const handleCloseVideo = useCallback(() => {
    activeVideoPathRef.current = null;
    thumbnailUnlistenRef.current?.();
    thumbnailUnlistenRef.current = null;
    pause();
    setVideoSrc(null);
    setVideoInfo(null);
    setIsPlaying(false);
    setThumbnails([]);
    resetTimeline(0);
    if (videoRef.current) {
      videoRef.current.src = "";
    }
  }, [pause, resetTimeline, videoRef]);

  // Check for CLI video argument on launch and listen for open-video events
  useEffect(() => {
    getCliArg()
      .then((path) => {
        if (path) {
          handleOpenFile(path);
        }
      })
      .catch((err) => console.warn("[VideoProvider] getCliArg error:", err));

    const unlistenPromise = listen<string>("abrir-video", (event) => {
      if (event.payload) {
        handleOpenFile(event.payload);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [handleOpenFile]);

  const value: VideoContextValue = {
    ...video,
    ...timeline,
    ...cut,
    videoInfo,
    videoSrc,
    isPlaying,
    thumbnails,
    handleOpenFile,
    handleCloseVideo,
    onPlay,
    onPause,
    onEnded,
  };

  return (
    <VideoContext.Provider value={value}>{children}</VideoContext.Provider>
  );
}

export function useVideoContext(): VideoContextValue {
  const ctx = useContext(VideoContext);
  if (!ctx)
    throw new Error("useVideoContext must be used inside <VideoProvider>");
  return ctx;
}

/** Retorna um novo array com o slot `index` substituído por `src`. */
function applyThumbnailPath(prev: string[], index: number, src: string): string[] {
  const next = [...prev];
  next[index] = src;
  return next;
}
