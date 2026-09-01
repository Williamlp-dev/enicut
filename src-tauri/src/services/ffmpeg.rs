use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// Corte rápido usando stream copy (-c copy). Sem recodificação.
// Retorna o caminho do arquivo de saída.
pub async fn fast_cut(
    app: &AppHandle,
    input: &Path,
    output: &Path,
    start: f64,
    end: f64,
) -> Result<String, String> {
    let input_str = input.to_string_lossy();
    let output_str = output.to_string_lossy().into_owned();

    let status = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Falha ao encontrar o sidecar do ffmpeg: {e}"))?
        .args([
            "-ss", &format!("{:.6}", start),
            "-to", &format!("{:.6}", end),
            "-i", &input_str,
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            "-y",
            &output_str,
        ])
        .output()
        .await
        .map_err(|e| format!("Falha ao executar o ffmpeg: {e}"))?;

    if !status.status.success() {
        let stderr = String::from_utf8_lossy(&status.stderr);
        return Err(format!("Erro no ffmpeg: {stderr}"));
    }

    Ok(output_str)
}
