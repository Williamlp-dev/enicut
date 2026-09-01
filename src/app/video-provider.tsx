import { listen } from "@tauri-apps/api/event";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { type UseCutReturn, useCut } from "@/hooks/useCut";
import { type UseTimelineReturn, useTimeline } from "@/hooks/useTimeline";
import { type UseVideoReturn, useVideo } from "@/hooks/useVideo";
import { generateThumbnails, getCliArg } from "@/lib/tauri";
import type { VideoInfo } from "@/types/video";

// resolveVideoSrc is internal — VideoProvider exposes handleOpenFile instead
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

  const video = useVideo();
  const { resolveVideoSrc, pause, videoRef } = video;
  const timeline = useTimeline(videoInfo?.duration ?? 0);
  const { reset: resetTimeline } = timeline;
  const cut = useCut();

  // isPlaying is driven ONLY by the real <video> element events
  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onEnded = useCallback(() => setIsPlaying(false), []);

  const handleOpenFile = useCallback(
    async (path: string) => {
      try {
        const { info, src } = await resolveVideoSrc(path);

        // Set React state — <video src={videoSrc} /> picks this up declaratively
        setVideoSrc(src);
        setVideoInfo(info);
        setIsPlaying(false);
        resetTimeline(info.duration);

        // Generate thumbnails in the background
        setThumbnails([]);
        generateThumbnails(path, 10)
          .then(async (paths) => {
            const { convertFileSrc } = await import("@tauri-apps/api/core");
            setThumbnails(paths.map((p) => convertFileSrc(p)));
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
