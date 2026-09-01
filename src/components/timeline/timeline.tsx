import { useCallback, useRef } from "react";
import { useVideoContext } from "@/app/video-provider";
import { clamp } from "@/lib/time";
import { CutHandles } from "./cut-handles";
import { Playhead } from "./playhead";
import { Thumbnails } from "./thumbnails";

// Lê getBoundingClientRect() dentro de cada handler no momento da interação,
// o que garante sempre precisão — ResizeObserver não é necessário.
export function Timeline() {
  const {
    videoInfo,
    videoRef,
    inPoint,
    outPoint,
    setInPoint,
    setOutPoint,
    thumbnails,
    beginScrub,
    scrubTo,
    endScrub,
  } = useVideoContext();

  const trackRef = useRef<HTMLDivElement>(null);

  // Converte uma posição clientX em tempo de vídeo proporcional à largura da faixa
  const clientXToTime = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || !videoInfo) return 0;
      const rect = track.getBoundingClientRect();
      const px = clamp(clientX - rect.left, 0, rect.width);
      return (px / rect.width) * videoInfo.duration;
    },
    [videoInfo],
  );

  // Clicar ou arrastar na faixa faz seek no vídeo.
  // stopPropagation nos handles impede que este handler dispare ao arrastar um handle.
  const handleTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!videoInfo || !trackRef.current) return;

      // Responde apenas ao ponteiro primário (clique esquerdo ou toque)
      if (event.button !== 0 && event.pointerType === "mouse") return;

      const track = trackRef.current;
      track.setPointerCapture(event.pointerId);

      beginScrub();
      scrubTo(clientXToTime(event.clientX));

      const onMove = (moveEvent: PointerEvent) =>
        scrubTo(clientXToTime(moveEvent.clientX));

      const onUp = (upEvent: PointerEvent) => {
        track.removeEventListener("pointermove", onMove);
        track.removeEventListener("pointerup", onUp);
        endScrub(clientXToTime(upEvent.clientX));
      };

      track.addEventListener("pointermove", onMove);
      track.addEventListener("pointerup", onUp);
    },
    [videoInfo, beginScrub, scrubTo, endScrub, clientXToTime],
  );

  if (!videoInfo) return <div className="flex-1 relative mx-6 my-8" />;

  const duration = videoInfo.duration;
  const inPct = (inPoint / duration) * 100;
  const outPct = (outPoint / duration) * 100;

  return (
    <div className="flex-1 relative mx-6 my-8 select-none">
      <div
        ref={trackRef}
        className="absolute inset-0 bg-surface-2 border border-border rounded-md cursor-crosshair touch-none mx-1.5"
        onPointerDown={handleTrackPointerDown}
      >
        <Thumbnails srcs={thumbnails} />

        {/* Região de seleção — área destacada entre IN e OUT */}
        <div
          data-selection
          className="absolute top-0 bottom-0 bg-accent/25 border-y-2 border-accent pointer-events-none z-10"
          style={{
            left: `${inPct}%`,
            width: `${outPct - inPct}%`,
          }}
        />

        <CutHandles
          duration={duration}
          inPoint={inPoint}
          outPoint={outPoint}
          setInPoint={setInPoint}
          setOutPoint={setOutPoint}
          trackRef={trackRef}
        />

        {/* Playhead sempre na camada superior */}
        <Playhead videoRef={videoRef} duration={duration} />
      </div>
    </div>
  );
}
