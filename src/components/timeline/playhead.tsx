import { useEffect, useRef } from "react";

interface PlayheadProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
}

// Posição do playhead atualizada via requestAnimationFrame → DOM style.left.
// Zero atualizações de estado do React durante a reprodução — o componente renderiza apenas uma vez.
export function Playhead({ videoRef, duration }: PlayheadProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    if (duration === 0) return;

    const updatePosition = () => {
      const video = videoRef.current;
      const el = playheadRef.current;

      if (
        video &&
        el &&
        Number.isFinite(video.duration) &&
        video.duration > 0
      ) {
        const pct = (video.currentTime / video.duration) * 100;
        el.style.left = `${pct}%`;
      }

      rafIdRef.current = requestAnimationFrame(updatePosition);
    };

    rafIdRef.current = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [videoRef, duration]);

  return (
    <div
      ref={playheadRef}
      className="absolute top-0 bottom-0 w-[1px] bg-playhead z-30 pointer-events-none -translate-x-1/2 before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:rotate-45 before:w-2 before:h-2 before:bg-playhead"
    />
  );
}
