import { useCallback, useState } from "react";
import { clamp } from "@/lib/time";

export interface UseTimelineReturn {
  inPoint: number;
  outPoint: number;
  setInPoint: (t: number) => void;
  setOutPoint: (t: number) => void;
  reset: (newDuration: number) => void;
}

// Garante que IN e OUT permaneçam separados por pelo menos 0.1s para evitar cortes de duração zero
export function useTimeline(duration: number): UseTimelineReturn {
  const [inPoint, setInPointRaw] = useState(0);
  const [outPoint, setOutPointRaw] = useState(0);

  const setInPoint = (t: number) => {
    setInPointRaw(clamp(t, 0, outPoint > 0 ? outPoint - 0.1 : duration));
  };

  const setOutPoint = (t: number) => {
    setOutPointRaw(clamp(t, inPoint + 0.1, duration));
  };

  // Inicializa ou reinicia os marcadores para cobrir toda a duração do vídeo
  const reset = useCallback((newDuration: number) => {
    setInPointRaw(0);
    setOutPointRaw(newDuration);
  }, []);

  return { inPoint, outPoint, setInPoint, setOutPoint, reset };
}
