use crate::models::video::VideoInfo;
use crate::services::media_info;

// Comando Tauri para sondar um arquivo de vídeo via Windows Media Foundation.
// spawn_blocking isola as chamadas COM síncronas do runtime assíncrono do tokio.
#[tauri::command]
pub async fn probe_video(path: String) -> Result<VideoInfo, String> {
    let p = std::path::PathBuf::from(&path);
    tokio::task::spawn_blocking(move || media_info::probe(&p))
        .await
        .map_err(|e| format!("probe_video spawn falhou: {e}"))?
}
