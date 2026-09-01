use tauri::AppHandle;

use crate::models::video::VideoInfo;
use crate::services::ffprobe;

// Comando Tauri para sondar um arquivo de vídeo.
// Retorna as informações do vídeo lidas pelo ffprobe.
#[tauri::command]
pub async fn probe_video(app: AppHandle, path: String) -> Result<VideoInfo, String> {
    let p = std::path::Path::new(&path);
    ffprobe::probe(&app, p).await
}
