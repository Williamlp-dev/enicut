import { message, save } from "@tauri-apps/plugin-dialog";
import { Scissors } from "lucide-react";
import { useVideoContext } from "@/app/video-provider";
import { Button } from "@/components/ui/button";

interface CutButtonProps {
  onSuccess?: (outputPath: string) => void;
  onError?: (err: unknown) => void;
}

// Gera o caminho padrão sugerido e a extensão para o arquivo cortado (ex: "video.mp4" -> "video-cut.mp4")
function getDefaultCutPath(filePath: string, fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex !== -1 ? fileName.slice(dotIndex + 1) : "mp4";
  const baseName = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
  const newName = `${baseName}-cut.${extension}`;
  const defaultPath = filePath.replace(fileName, newName);

  return { defaultPath, extension };
}

export function CutButton({ onSuccess, onError }: CutButtonProps) {
  const { videoInfo, inPoint, outPoint, isSaving, cut } = useVideoContext();

  const handleCut = async () => {
    if (!videoInfo) return;

    try {
      const { defaultPath, extension } = getDefaultCutPath(
        videoInfo.path,
        videoInfo.name,
      );

      const savePath = await save({
        title: "Salvar vídeo cortado",
        defaultPath,
        filters: [{ name: "Vídeo", extensions: [extension] }],
      });

      // Usuário cancelou a seleção no diálogo nativo do sistema
      if (!savePath) return;

      const result = await cut(
        videoInfo.path,
        savePath,
        inPoint,
        outPoint,
      );

      if (result) {
        onSuccess?.(result);
        await message(`Corte salvo com sucesso em:\n${result}`, {
          title: "ENICUT",
          kind: "info",
        });
      } else {
        const errorMessage = "Falha ao realizar o corte do vídeo.";
        onError?.(errorMessage);
        await message(errorMessage, {
          title: "ENICUT",
          kind: "error",
        });
      }
    } catch (error) {
      const errorMessage =
        "Ocorreu um erro inesperado ao tentar salvar o corte.";
      onError?.(error);
      await message(errorMessage, {
        title: "ENICUT",
        kind: "error",
      });
    }
  };

  const isDisabled = !videoInfo || isSaving || outPoint <= inPoint;

  return (
    <Button
      id="btn-cut"
      variant="primary"
      className="gap-2 min-w-[104px]"
      onClick={handleCut}
      disabled={isDisabled}
      title="Cortar vídeo (cópia sem perdas)"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        <span
          className={`absolute inset-0 flex items-center justify-center will-change-transform transition-[opacity,filter,transform] duration-150 ease-out ${
            isSaving
              ? "opacity-100 filter-none scale-100"
              : "opacity-0 blur-[2px] scale-90 pointer-events-none"
          }`}
        >
          <span className="w-3.5 h-3.5 border-2 border-surface border-t-transparent rounded-full animate-spin" />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center will-change-transform transition-[opacity,filter,transform] duration-150 ease-out ${
            !isSaving
              ? "opacity-100 filter-none scale-100"
              : "opacity-0 blur-[2px] scale-90 pointer-events-none"
          }`}
        >
          <Scissors size={15} />
        </span>
      </div>
      <span>{isSaving ? "Cortando..." : "Cortar"}</span>
    </Button>
  );
}
