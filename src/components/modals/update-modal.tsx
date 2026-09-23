import { ArrowUpRight, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { useUpdater } from "@/hooks/useUpdater";

interface UpdateModalProps {
  updater: ReturnType<typeof useUpdater>;
}

export function UpdateModal({ updater }: UpdateModalProps) {
  const {
    isModalOpen,
    closeModal,
    hasUpdate,
    updateInfo,
    isChecking,
    isDownloading,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    error,
    statusMessage,
    downloadAndInstallUpdate,
    checkForUpdates,
  } = updater;

  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <Dialog.Root
      isOpen={isModalOpen}
      onClose={closeModal}
      preventClose={isDownloading}
    >
      <Dialog.Content>
        <Dialog.Close />

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center shadow-inner">
            <img
              src="/logo.svg"
              alt="ENICUT"
              className="w-6 h-6 pointer-events-none"
            />
          </div>
          <div>
            <Dialog.Title>
              ENICUT
              {updateInfo?.version && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-mono font-medium">
                  v{updateInfo.version}
                </span>
              )}
            </Dialog.Title>
            <Dialog.Description>
              {hasUpdate
                ? "Nova atualização disponível"
                : "Informações da versão"}
            </Dialog.Description>
          </div>
        </div>

        {/* Conteúdo dinâmico */}
        {hasUpdate && updateInfo ? (
          <div className="space-y-4">
            {/* Comparativo de versões */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border text-xs">
              <span className="text-text-muted">
                Atual:{" "}
                <span className="font-mono text-text">
                  v{updateInfo.currentVersion}
                </span>
              </span>
              <span className="text-accent flex items-center gap-1 font-medium font-mono">
                Nova: v{updateInfo.version}
                <ArrowUpRight size={14} />
              </span>
            </div>

            {/* Notas de atualização (Changelog) */}
            {updateInfo.body && (
              <div className="space-y-1">
                <span className="text-xs text-text-muted font-medium">
                  Novidades:
                </span>
                <div className="max-h-32 overflow-y-auto p-3 rounded-lg bg-surface/50 border border-border/60 text-xs text-text/80 whitespace-pre-wrap font-sans">
                  {updateInfo.body}
                </div>
              </div>
            )}

            {/* Progresso de Download */}
            {isDownloading && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-text-muted font-mono">
                  <span>{statusMessage || "Baixando..."}</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-accent transition-all duration-200 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                {totalBytes > 0 && (
                  <p className="text-[11px] text-text-muted/70 text-right font-mono">
                    {formatMb(downloadedBytes)} MB / {formatMb(totalBytes)} MB
                  </p>
                )}
              </div>
            )}

            {/* Mensagem de Erro */}
            {error && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* Ações */}
            <Dialog.Footer>
              {!isDownloading && (
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs rounded-lg text-text-muted hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  Lembrar mais tarde
                </button>
              )}
              <button
                type="button"
                onClick={downloadAndInstallUpdate}
                disabled={isDownloading}
                className="px-4 py-2 text-xs rounded-lg bg-accent text-background font-semibold hover:brightness-110 active:brightness-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-accent/20"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Atualizar agora
                  </>
                )}
              </button>
            </Dialog.Footer>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center justify-center text-center py-4 space-y-2">
              <CheckCircle2 size={36} className="text-accent/90" />
              <p className="text-sm font-medium text-text">
                O ENICUT está atualizado!
              </p>
              <p className="text-xs text-text-muted max-w-xs">
                {statusMessage ||
                  "Você já está aproveitando a versão mais recente e veloz do aplicativo."}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => checkForUpdates(true)}
                disabled={isChecking}
                className="text-xs text-accent hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={isChecking ? "animate-spin" : ""}
                />
                {isChecking ? "Verificando..." : "Verificar novamente"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-1.5 text-xs rounded-lg bg-surface-3 hover:bg-surface text-text transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
