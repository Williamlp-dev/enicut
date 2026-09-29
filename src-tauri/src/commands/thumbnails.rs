use crate::services::{media_info, paths::thumbnail_cache_dir, thumbnails};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailReady {
    pub index: u32,
    pub path: String,
}

// Comando Tauri para geração de miniaturas com carregamento progressivo e paralelo.
//
// Em vez de esperar todas as miniaturas ficarem prontas para retornar, este comando:
//  1. Calcula todos os caminhos de saída e devolve imediatamente ao frontend
//     (que já pode exibir os que estão no cache).
//  2. Para os que faltam, spawna um thread por miniatura — cada um gera seu
//     frame de forma independente e emite "thumbnail-ready" assim que conclui.
//
// O resultado do invoke é o vetor de caminhos (vazios para frames ainda não gerados).
// O frontend escuta "thumbnail-ready" para preencher os slots conforme chegam.
#[tauri::command]
pub async fn generate_thumbnails(
    app: AppHandle,
    path: String,
    count: u32,
) -> Result<Vec<String>, String> {
    let p_buf = PathBuf::from(&path);

    tokio::task::spawn_blocking(move || {
        let info = media_info::probe(&p_buf)
            .map_err(|e| format!("probe falhou: {e}"))?;

        let duration = info.duration;
        if duration <= 0.0 || count == 0 {
            return Ok(vec![]);
        }

        let cache_dir = thumbnail_cache_dir(&p_buf)
            .map_err(|e| format!("cache dir falhou: {e}"))?;

        let interval = duration / (count as f64 + 1.0);
        let paths: Vec<String> = (0..count)
            .map(|i| {
                cache_dir
                    .join(format!("thumb_{:04}.jpg", i))
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();

        // Retorna os caminhos já existentes no cache imediatamente.
        // Frames ausentes são string vazia — o frontend exibe placeholder.
        let cached: Vec<String> = paths
            .iter()
            .map(|p| if is_cached(p) { p.clone() } else { String::new() })
            .collect();

        // Spawna um thread por frame ausente.
        // AppHandle é Clone + Send internamente — Arc seria redundante.
        for (i, out_path) in paths.into_iter().enumerate() {
            let i = i as u32;
            if is_cached(&out_path) {
                // Já no cache — emite imediatamente para sincronizar o frontend.
                emit_thumbnail(&app, i, out_path);
                continue;
            }

            let app_clone = app.clone();
            let p_clone = p_buf.clone();
            let timestamp_sec = ((i as f64 + 1.0) * interval).min(duration - 0.1);

            std::thread::spawn(move || {
                spawn_thumbnail_worker(&app_clone, &p_clone, duration, i, timestamp_sec, out_path);
            });
        }

        Ok(cached)
    })
    .await
    .map_err(|e| format!("generate_thumbnails spawn falhou: {e}"))?
}

fn is_cached(path: &str) -> bool {
    std::path::Path::new(path).exists()
}

fn emit_thumbnail(app: &AppHandle, index: u32, path: String) {
    let _ = app.emit("thumbnail-ready", ThumbnailReady { index, path });
}

fn spawn_thumbnail_worker(
    app: &AppHandle,
    video_path: &PathBuf,
    duration: f64,
    index: u32,
    timestamp_sec: f64,
    out_path: String,
) {
    match thumbnails::generate_single(video_path, duration, timestamp_sec, &out_path) {
        Ok(()) => emit_thumbnail(app, index, out_path),
        Err(e) => {
            eprintln!("[Thumbnails] Frame {index} falhou: {e}");
            // Emite com path vazio para o frontend manter o placeholder.
            emit_thumbnail(app, index, String::new());
        }
    }
}

