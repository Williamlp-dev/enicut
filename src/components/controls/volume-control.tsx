import { Volume2, VolumeX } from "lucide-react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface VolumeControlProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  disabled?: boolean;
}

// Controle de volume com botão de mute e slider interativo com arraste por ponteiro
export function VolumeControl({
  videoRef,
  disabled = false,
}: VolumeControlProps) {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const volumeSliderRef = useRef<HTMLDivElement>(null);

  // Sincroniza o volume diretamente no elemento HTMLVideoElement nativo
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, videoRef]);

  const toggleMute = () => setIsMuted((previous) => !previous);

  // A captura do ponteiro garante que o arraste continue suave mesmo se o cursor sair da barra
  const handleVolumePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = volumeSliderRef.current;
      if (!slider) return;

      slider.setPointerCapture(event.pointerId);

      const updateVolumeFromCursor = (clientX: number) => {
        const rect = slider.getBoundingClientRect();
        const ratio = (clientX - rect.left) / rect.width;
        const normalizedVolume = Math.max(0, Math.min(1, ratio));

        setVolume(normalizedVolume);
        setIsMuted(false);
      };

      updateVolumeFromCursor(event.clientX);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateVolumeFromCursor(moveEvent.clientX);
      };

      const handlePointerUp = () => {
        slider.removeEventListener("pointermove", handlePointerMove);
        slider.removeEventListener("pointerup", handlePointerUp);
      };

      slider.addEventListener("pointermove", handlePointerMove);
      slider.addEventListener("pointerup", handlePointerUp);
    },
    [],
  );

  const volumePercent = (isMuted ? 0 : volume) * 100;
  const hasNoAudio = isMuted || volume === 0;

  return (
    <div className="flex items-center gap-4 w-1/3">
      <Button
        variant="icon"
        disabled={disabled}
        onClick={toggleMute}
        title={isMuted ? "Ativar som" : "Desativar som"}
      >
        <div className="relative w-5 h-5 flex items-center justify-center">
          <span
            className={`absolute inset-0 flex items-center justify-center will-change-transform transition-[opacity,filter,transform] duration-150 ease-out ${
              hasNoAudio
                ? "opacity-100 filter-none scale-100"
                : "opacity-0 blur-[2px] scale-90 pointer-events-none"
            }`}
          >
            <VolumeX size={18} />
          </span>
          <span
            className={`absolute inset-0 flex items-center justify-center will-change-transform transition-[opacity,filter,transform] duration-150 ease-out ${
              !hasNoAudio
                ? "opacity-100 filter-none scale-100"
                : "opacity-0 blur-[2px] scale-90 pointer-events-none"
            }`}
          >
            <Volume2 size={18} />
          </span>
        </div>
      </Button>

      <div
        className="relative w-20 h-1.5 bg-surface-3 rounded-full cursor-pointer touch-none group"
        ref={volumeSliderRef}
        onPointerDown={handleVolumePointerDown}
        role="slider"
        aria-label="Controle de volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(volumePercent)}
        tabIndex={0}
      >
        <div
          className="absolute top-0 left-0 h-full bg-accent rounded-l-full"
          style={{ width: `${volumePercent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 bg-accent rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${volumePercent}%` }}
        />
      </div>
    </div>
  );
}
