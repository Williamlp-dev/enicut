import { useEffect, useRef } from "react";

interface PlayheadProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
}

// Posição do playhead atualizada via requestVideoFrameCallback → DOM style.left.
// Dispara exatamente uma vez por frame decodificado — sem polling quando pausado.
// Fallback para requestAnimationFrame em browsers sem suporte a rVFC.
export function Playhead({ videoRef, duration }: PlayheadProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const callbackIdRef = useRef<number>(0);

  useEffect(() => {
    if (duration === 0) return;

    const video = videoRef.current;
    if (!video) return;

    const supportsRVFC = "requestVideoFrameCallback" in HTMLVideoElement.prototype;

    const updatePosition = () => {
      const el = playheadRef.current;
      const vid = videoRef.current;

      if (el && vid && Number.isFinite(vid.duration) && vid.duration > 0) {
        const pct = (vid.currentTime / vid.duration) * 100;
        el.style.left = `${pct}%`;
      }

      if (supportsRVFC) {
        callbackIdRef.current = videoRef.current?.requestVideoFrameCallback(updatePosition) ?? 0;
      } else {
        callbackIdRef.current = requestAnimationFrame(updatePosition);
      }
    };

    if (supportsRVFC) {
      callbackIdRef.current = video.requestVideoFrameCallback(updatePosition);
    } else {
      callbackIdRef.current = requestAnimationFrame(updatePosition);
    }

    return () => {
      if (supportsRVFC) {
        videoRef.current?.cancelVideoFrameCallback(callbackIdRef.current);
      } else {
        cancelAnimationFrame(callbackIdRef.current);
      }
    };
  }, [videoRef, duration]);

  return (
    <div
      ref={playheadRef}
      className="absolute top-0 bottom-0 w-[1px] bg-playhead z-30 pointer-events-none -translate-x-1/2 before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:rotate-45 before:w-2 before:h-2 before:bg-playhead"
    />
  );
}
