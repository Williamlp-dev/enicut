use crate::services::cutter;

// Comando Tauri para cortar um vídeo.
// Utiliza corte nativo e lossless em Rust puro para MP4.
#[tauri::command]
pub async fn cut_video(
    path: String,
    output_path: String,
    start: f64,
    end: f64,
) -> Result<String, String> {
    let p_buf = std::path::PathBuf::from(&path);
    let out_buf = std::path::PathBuf::from(&output_path);

    tokio::task::spawn_blocking(move || {
        cutter::cut(&p_buf, &out_buf, start, end)
    })
    .await
    .map_err(|e| format!("cut_video spawn falhou: {e}"))?
}
