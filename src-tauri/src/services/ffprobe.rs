use std::path::Path;

use crate::models::video::VideoInfo;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// Executa ffprobe em um arquivo de vídeo via sidecar e retorna os metadados estruturados.
pub async fn probe(app: &AppHandle, path: &Path) -> Result<VideoInfo, String> {
    let path_str = path.to_string_lossy();

    let output = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| format!("Falha ao encontrar o sidecar do ffprobe: {e}"))?
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            &path_str,
        ])
        .output()
        .await
        .map_err(|e| format!("Falha ao executar o ffprobe: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Erro no ffprobe: {stderr}"));
    }

    let raw: FfprobeOutput =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("Erro ao fazer parse da saída do ffprobe: {e}"))?;

    let video_stream = raw
        .streams
        .iter()
        .find(|s| s.codec_type.as_deref() == Some("video"))
        .ok_or("Nenhum stream de vídeo encontrado")?;

    let audio_stream = raw
        .streams
        .iter()
        .find(|s| s.codec_type.as_deref() == Some("audio"));

    let duration = raw
        .format
        .duration
        .as_deref()
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);

    let fps = parse_frame_rate(
        video_stream
            .avg_frame_rate
            .as_deref()
            .or(video_stream.r_frame_rate.as_deref())
            .unwrap_or("0/1"),
    );

    let bitrate = raw
        .format
        .bit_rate
        .as_deref()
        .and_then(|b| b.parse::<u64>().ok());

    let file_size = raw
        .format
        .size
        .as_deref()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();

    Ok(VideoInfo {
        path: path.to_string_lossy().into_owned(),
        name,
        duration,
        width: video_stream.width.unwrap_or(0),
        height: video_stream.height.unwrap_or(0),
        fps,
        video_codec: video_stream.codec_name.clone().unwrap_or_default(),
        audio_codec: audio_stream.and_then(|s| s.codec_name.clone()),
        bitrate,
        file_size,
    })
}

// ─── Structs Internas ─────────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct FfprobeOutput {
    streams: Vec<FfprobeStream>,
    format: FfprobeFormat,
}

#[derive(Debug, serde::Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    avg_frame_rate: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
    bit_rate: Option<String>,
    size: Option<String>,
}

fn parse_frame_rate(s: &str) -> f64 {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() == 2 {
        let num = parts[0].parse::<f64>().unwrap_or(0.0);
        let den = parts[1].parse::<f64>().unwrap_or(1.0);
        if den != 0.0 {
            return num / den;
        }
    }
    s.parse::<f64>().unwrap_or(0.0)
}
