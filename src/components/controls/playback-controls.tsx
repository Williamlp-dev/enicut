import { FastForward, Pause, Play, Rewind } from "lucide-react";
import { useCallback, useState } from "react";
import { useVideoContext } from "@/app/video-provider";
import { TimeDisplay } from "@/components/controls/time-display";
import { VolumeControl } from "@/components/controls/volume-control";
import { Button } from "@/components/ui/button";
import { useShortcuts } from "@/hooks/useShortcuts";

// Intervalo em segundos utilizado para avanço e retrocesso rápido
const SEEK_STEP_SECONDS = 10;

// Barra principal de controles de reprodução (volume, navegação, tempo e enquadramento)
export function PlaybackControls() {
  const {
    videoRef,
    videoInfo,
    play,
    pause,
    seek,
    isPlaying,
    inPoint,
    outPoint,
    setInPoint,
    setOutPoint,
  } = useVideoContext();

  const [objectFit, setObjectFit] = useState<"contain" | "cover">("contain");

  const disabled = !videoInfo;

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // Se o cursor estiver fora da área delimitada pelos marcadores, inicia no ponto de entrada
      if (video.currentTime >= outPoint || video.currentTime < inPoint) {
        video.currentTime = inPoint;
      }
      play();
    } else {
      pause();
    }
  }, [videoRef, inPoint, outPoint, play, pause]);

  const seekBackward = () => {
    if (videoRef.current) {
      seek(Math.max(0, videoRef.current.currentTime - SEEK_STEP_SECONDS));
    }
  };

  const seekForward = () => {
    if (videoRef.current && videoInfo) {
      seek(
        Math.min(
          videoInfo.duration,
          videoRef.current.currentTime + SEEK_STEP_SECONDS,
        ),
      );
    }
  };

  const toggleFit = () => {
    const nextFit = objectFit === "contain" ? "cover" : "contain";
    setObjectFit(nextFit);

    if (videoRef.current) {
      videoRef.current.style.objectFit = nextFit;
    }
  };

  // Registra atalhos de teclado globais de controle
  useShortcuts({
    onTogglePlayback: togglePlayback,
    onSetIn: () => {
      if (videoRef.current) setInPoint(videoRef.current.currentTime);
    },
    onSetOut: () => {
      if (videoRef.current) setOutPoint(videoRef.current.currentTime);
    },
  });

  return (
    <div className="h-16 flex items-center justify-between px-6 bg-surface-2 border-t border-border shrink-0 z-10">
      <VolumeControl videoRef={videoRef} disabled={disabled} />

      <div className="flex flex-1 items-center justify-center gap-4">
        <Button
          variant="icon"
          disabled={disabled}
          onClick={seekBackward}
          title="Voltar 10s"
        >
          <Rewind size={16} />
        </Button>

        <Button
          variant="play"
          disabled={disabled}
          onClick={togglePlayback}
          title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
        >
          <div className="relative w-5 h-5 flex items-center justify-center">
            <span
              className={`absolute inset-0 flex items-center justify-center will-change-transform transition-[opacity,filter,transform] duration-150 ease-out ${
                isPlaying
                  ? "opacity-100 filter-none scale-100"
                  : "opacity-0 blur-[2px] scale-90 pointer-events-none"
              }`}
            >
              <Pause size={18} fill="currentColor" />
            </span>
            <span
              className={`absolute inset-0 flex items-center justify-center will-change-transform transition-[opacity,filter,transform] duration-150 ease-out ${
                !isPlaying
                  ? "opacity-100 filter-none scale-100"
                  : "opacity-0 blur-[2px] scale-90 pointer-events-none"
              }`}
            >
              <Play size={18} fill="currentColor" />
            </span>
          </div>
        </Button>

        <Button
          variant="icon"
          disabled={disabled}
          onClick={seekForward}
          title="Avançar 10s"
        >
          <FastForward size={16} />
        </Button>
      </div>

      <div className="flex items-center gap-4 w-1/3 justify-end">
        <TimeDisplay />

        <Button
          variant="ghost"
          className="font-bold text-[13px] text-text hover:text-accent w-10 px-0 h-8"
          disabled={disabled}
          onClick={toggleFit}
          title={
            objectFit === "contain"
              ? "Preencher tela (Fill)"
              : "Ajustar à tela (Fit)"
          }
        >
          {objectFit === "contain" ? "Fit" : "Fill"}
        </Button>
      </div>
    </div>
  );
}
