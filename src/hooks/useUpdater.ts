import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UpdaterState {
  isChecking: boolean;
  hasUpdate: boolean;
  updateInfo: {
    currentVersion: string;
    version: string;
    body?: string;
    date?: string;
  } | null;
  isDownloading: boolean;
  downloadProgress: number; // 0 a 100
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
  statusMessage: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    isChecking: false,
    hasUpdate: false,
    updateInfo: null,
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    error: null,
    statusMessage: null,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const updateRef = useRef<Update | null>(null);

  const checkForUpdates = useCallback(async (manual = false) => {
    setState((prev) => ({
      ...prev,
      isChecking: true,
      error: null,
      statusMessage: manual ? "Verificando se há novas versões..." : null,
    }));

    try {
      const update = await check();
      updateRef.current = update;

      if (update) {
        setState((prev) => ({
          ...prev,
          isChecking: false,
          hasUpdate: true,
          updateInfo: {
            currentVersion: update.currentVersion,
            version: update.version,
            body: update.body,
            date: update.date,
          },
          statusMessage: `Nova versão ${update.version} disponível!`,
        }));
        if (manual) {
          setIsModalOpen(true);
        }
      } else {
        setState((prev) => ({
          ...prev,
          isChecking: false,
          hasUpdate: false,
          updateInfo: null,
          statusMessage: manual ? "Você já está na versão mais recente." : null,
        }));
        if (manual) {
          setIsModalOpen(true);
        }
      }
    } catch (err) {
      console.warn("[useUpdater] Erro ao verificar atualizações:", err);
      setState((prev) => ({
        ...prev,
        isChecking: false,
        error: manual
          ? "Não foi possível verificar atualizações no momento."
          : null,
        statusMessage: null,
      }));
      if (manual) {
        setIsModalOpen(true);
      }
    }
  }, []);

  const downloadAndInstallUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setState((prev) => ({
      ...prev,
      isDownloading: true,
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: null,
      statusMessage: "Baixando atualização...",
    }));

    let total = 0;
    let downloaded = 0;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setState((prev) => ({
            ...prev,
            totalBytes: total,
          }));
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const progress =
            total > 0
              ? Math.min(100, Math.round((downloaded / total) * 100))
              : 0;
          setState((prev) => ({
            ...prev,
            downloadedBytes: downloaded,
            downloadProgress: progress,
          }));
        } else if (event.event === "Finished") {
          setState((prev) => ({
            ...prev,
            downloadProgress: 100,
            statusMessage: "Instalando e reiniciando...",
          }));
        }
      });

      // Tenta reiniciar caso o instalador não reinicie sozinho
      try {
        await relaunch();
      } catch {
        // No Windows, o instalador pode fechar a janela antes do relaunch, o que é esperado
      }
    } catch (err) {
      console.error("[useUpdater] Falha ao baixar/instalar atualização:", err);
      setState((prev) => ({
        ...prev,
        isDownloading: false,
        error: "Falha ao instalar atualização. Tente novamente mais tarde.",
        statusMessage: null,
      }));
    }
  }, []);

  // Checagem automática silenciosa após a inicialização
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
    checkForUpdates,
    downloadAndInstallUpdate,
  };
}
