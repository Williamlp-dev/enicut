use tauri::AppHandle;

use crate::services::{ffprobe, thumbnails};

// Comando Tauri para gerar miniaturas da timeline.
// Retorna um vetor com os caminhos dos arquivos de imagem gerados.
#[tauri::command]
pub async fn generate_thumbnails(
    app: AppHandle,
    path: String,
    count: u32,
) -> Result<Vec<String>, String> {
    let p = std::path::Path::new(&path);

    // Sondar a duração primeiro
    let info = ffprobe::probe(&app, p).await?;

    thumbnails::generate(&app, p, info.duration, count).await
}
