use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::services::paths::thumbnail_cache_dir;

// Gera `count` imagens em miniatura distribuídas uniformemente ao longo da duração do vídeo.
// Retorna uma lista de caminhos de arquivos absolutos (formato WebP).
pub async fn generate(
    app: &AppHandle,
    video_path: &Path,
    duration: f64,
    count: u32,
) -> Result<Vec<String>, String> {
    if count == 0 {
        return Ok(vec![]);
    }

    let cache_dir = thumbnail_cache_dir(video_path)
        .map_err(|e| format!("Falha ao criar o diretório de cache de miniaturas: {e}"))?;

    let mut paths = Vec::with_capacity(count as usize);

    let interval = if count > 1 {
        duration / (count as f64 - 1.0)
    } else {
        0.0
    };

    for i in 0..count {
        let timestamp = (i as f64 * interval).min(duration);
        let output = cache_dir.join(format!("thumb_{:04}.webp", i));
        let output_str = output.to_string_lossy().into_owned();

        // Pula se já estiver no cache
        if output.exists() {
            paths.push(output_str);
            continue;
        }

        let video_str = video_path.to_string_lossy();

        let result = app
            .shell()
            .sidecar("ffmpeg")
            .map_err(|e| format!("Falha ao encontrar o sidecar do ffmpeg: {e}"))?
            .args([
                "-ss", &format!("{:.3}", timestamp),
                "-i", &video_str,
                "-vframes", "1",
                "-vf", "scale=160:-1",
                "-q:v", "80",
                "-y",
                &output_str,
            ])
            .output()
            .await;

        if let Ok(out) = result {
            if out.status.success() {
                paths.push(output_str);
            }
        }
    }

    Ok(paths)
}
