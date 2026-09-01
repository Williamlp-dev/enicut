import { useEffect, useRef } from "react";
import { useVideoContext } from "@/app/video-provider";
import { formatTime } from "@/lib/time";

// Exibe tempo atual e duração total via DOM direto para manter 60fps sem re-render do React
export function TimeDisplay() {
  const { videoRef, videoInfo, outPoint } = useVideoContext();
  const currentTimeDisplayRef = useRef<HTMLSpanElement>(null);
  const durationDisplayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      if (currentTimeDisplayRef.current) {
        currentTimeDisplayRef.current.textContent = formatTime(video.currentTime);
      }

      // Pausa automaticamente a reprodução se o vídeo atingir o ponto de saída (outPoint)
      if (!video.paused && video.currentTime >= outPoint) {
        video.pause();
        video.currentTime = outPoint;
      }
    };

    const updateDuration = () => {
      if (durationDisplayRef.current && videoInfo) {
        durationDisplayRef.current.textContent = formatTime(videoInfo.duration);
      }
    };

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("durationchange", updateDuration);

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("durationchange", updateDuration);
    };
  }, [videoRef, videoInfo, outPoint]);

  return (
    <span className="font-mono text-[11px] text-text-muted tracking-[0.05em]">
      <span ref={currentTimeDisplayRef} className="text-accent">
        00:00:00.0
      </span>
      <span className="opacity-60"> / </span>
      <span ref={durationDisplayRef} className="opacity-60">
        {videoInfo ? formatTime(videoInfo.duration) : "00:00:00.0"}
      </span>
    </span>
  );
}
