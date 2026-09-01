import { invoke } from "@tauri-apps/api/core";
import type { VideoInfo } from "@/types/video";

// Lê metadados de um arquivo de vídeo via comando Tauri nativo
export async function probeVideo(path: string): Promise<VideoInfo> {
  return invoke<VideoInfo>("probe_video", { path });
}

// Corta o vídeo de start até end sem recodificar (stream copy) e retorna o caminho do arquivo gerado
export async function cutVideo(
  path: string,
  outputPath: string,
  start: number,
  end: number,
): Promise<string> {
  return invoke<string>("cut_video", { path, outputPath, start, end });
}

// Gera miniaturas para a linha do tempo e retorna caminhos absolutos (usar convertFileSrc no frontend)
export async function generateThumbnails(
  path: string,
  count: number,
): Promise<string[]> {
  return invoke<string[]>("generate_thumbnails", { path, count });
}

// Recupera o caminho de vídeo passado via linha de comando (ex: clique direito → Abrir com Enicut)
export async function getCliArg(): Promise<string | null> {
  return invoke<string | null>("get_cli_arg");
}

// Registra o Enicut no menu de contexto do Windows e na lista "Abrir com"
export async function registerContextMenu(): Promise<void> {
  return invoke<void>("register_context_menu");
}
