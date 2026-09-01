use tauri::AppHandle;

use crate::services::ffmpeg;

// Comando Tauri para cortar um vídeo.
// Chama o serviço ffmpeg para realizar o corte rápido.
#[tauri::command]
pub async fn cut_video(
    app: AppHandle,
    path: String,
    output_path: String,
    start: f64,
    end: f64,
) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    let out = std::path::Path::new(&output_path);
    ffmpeg::fast_cut(&app, p, out, start, end).await
}
