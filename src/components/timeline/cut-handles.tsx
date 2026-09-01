import { useCallback, useRef } from "react";
import { clamp } from "../../lib/time";

interface CutHandlesProps {
  duration: number;
  inPoint: number;
  outPoint: number;
  setInPoint: (t: number) => void;
  setOutPoint: (t: number) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
}

// Handles de corte IN e OUT arrastáveis na timeline.
// Usa setPointerCapture para continuar recebendo eventos mesmo com o cursor fora do elemento,
// sem necessidade de listeners globais na janela.
// Durante o arraste: atualiza o DOM diretamente (zero setState).
// Ao soltar: confirma o valor final para o estado do React uma única vez.
export function CutHandles({
  duration,
  inPoint,
  outPoint,
  setInPoint,
  setOutPoint,
  trackRef,
}: CutHandlesProps) {
  const inHandleRef = useRef<HTMLDivElement>(null);
  const outHandleRef = useRef<HTMLDivElement>(null);

  // Refs vivos para que os handlers de arraste sempre leiam os valores mais atuais
  const inPointRef = useRef(inPoint);
  const outPointRef = useRef(outPoint);
  inPointRef.current = inPoint;
  outPointRef.current = outPoint;

  const makeDragHandler = useCallback(
    (type: "in" | "out") => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation(); // Impede que o seek da Timeline dispare durante o arraste

      const handleEl = (type === "in" ? inHandleRef : outHandleRef).current;
      if (!handleEl || !trackRef.current) return;

      // Captura o ponteiro para receber pointermove mesmo quando o cursor sair do elemento
      handleEl.setPointerCapture(event.pointerId);

      const trackRect = trackRef.current.getBoundingClientRect();

      // Calcula o tempo equivalente a 12px (largura do handle) para evitar sobreposição dos dois handles
      const minGapTime = (12 / trackRect.width) * duration;

      let draggedTime =
        type === "in" ? inPointRef.current : outPointRef.current;

      const onMove = (moveEvent: PointerEvent) => {
        const px = moveEvent.clientX - trackRect.left;
        const raw = (px / trackRect.width) * duration;

        draggedTime = clamp(
          raw,
          type === "in" ? 0 : inPointRef.current + minGapTime,
          type === "out" ? duration : outPointRef.current - minGapTime,
        );

        // Atualização direta no DOM — sem re-render do React durante o arraste
        handleEl.style.left = `${(draggedTime / duration) * 100}%`;

        // Atualiza também a região de seleção em tempo real
        const track = trackRef.current;
        if (track) {
          const selEl = track.querySelector<HTMLDivElement>("[data-selection]");
          if (selEl) {
            const inPct =
              type === "in"
                ? (draggedTime / duration) * 100
                : (inPointRef.current / duration) * 100;
            const outPct =
              type === "out"
                ? (draggedTime / duration) * 100
                : (outPointRef.current / duration) * 100;
            selEl.style.left = `${inPct}%`;
            selEl.style.width = `${outPct - inPct}%`;
          }
        }
      };

      const onUp = () => {
        handleEl.removeEventListener("pointermove", onMove);
        handleEl.removeEventListener("pointerup", onUp);

        // Confirma no estado do React — atualização única ao final do arraste
        if (type === "in") setInPoint(draggedTime);
        else setOutPoint(draggedTime);
      };

      handleEl.addEventListener("pointermove", onMove);
      handleEl.addEventListener("pointerup", onUp);
    },
    [duration, setInPoint, setOutPoint, trackRef],
  );

  return (
    <>
      <div
        ref={inHandleRef}
        className="absolute top-0 bottom-0 w-3 bg-accent cursor-ew-resize -translate-x-1/2 rounded-[2px] touch-none transition-colors hover:bg-accent-hover z-20 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[2px] after:h-4 after:bg-bg after:rounded-[1px]"
        style={{ left: `${(inPoint / duration) * 100}%` }}
        onPointerDown={makeDragHandler("in")}
        title="Ponto de entrada — arraste ou pressione I"
      />
      <div
        ref={outHandleRef}
        className="absolute top-0 bottom-0 w-3 bg-accent cursor-ew-resize -translate-x-1/2 rounded-[2px] touch-none transition-colors hover:bg-accent-hover z-20 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[2px] after:h-4 after:bg-bg after:rounded-[1px]"
        style={{ left: `${(outPoint / duration) * 100}%` }}
        onPointerDown={makeDragHandler("out")}
        title="Ponto de saída — arraste ou pressione O"
      />
    </>
  );
}
