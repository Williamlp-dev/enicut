use tauri::AppHandle;

use crate::services::{media_info, thumbnails};

// Comando Tauri para gerar miniaturas da timeline.
// Retorna um vetor com os caminhos dos arquivos de imagem gerados.
#[tauri::command]
pub async fn generate_thumbnails(
    app: AppHandle,
    path: String,
    count: u32,
) -> Result<Vec<String>, String> {
    let p_buf = std::path::PathBuf::from(&path);
    let p_ref = p_buf.as_path();

    // probe é síncrono (MF COM) — isolamos do runtime tokio via spawn_blocking
    let duration = tokio::task::spawn_blocking({
        let p = p_buf.clone();
        move || media_info::probe(&p).map(|info| info.duration)
    })
    .await
    .map_err(|e| format!("probe spawn falhou: {e}"))??;

    thumbnails::generate(&app, p_ref, duration, count).await
}
