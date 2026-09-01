import { useCallback, useState } from "react";
import { cutVideo } from "@/lib/tauri";

export interface UseCutReturn {
  isSaving: boolean;
  cut: (
    path: string,
    outputPath: string,
    start: number,
    end: number,
  ) => Promise<string | null>;
}

export function useCut(): UseCutReturn {
  const [isSaving, setIsSaving] = useState(false);

  const cut = useCallback(
    async (
      path: string,
      outputPath: string,
      start: number,
      end: number,
    ): Promise<string | null> => {
      // Ignora chamadas simultâneas — apenas um corte por vez
      if (isSaving) return null;

      setIsSaving(true);
      try {
        const actualOutputPath = await cutVideo(path, outputPath, start, end);
        return actualOutputPath;
      } catch (error) {
        console.error("[useCut] Erro ao cortar o vídeo:", error);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving],
  );

  return { isSaving, cut };
}
