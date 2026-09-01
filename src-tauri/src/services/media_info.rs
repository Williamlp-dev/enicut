use std::path::Path;

use crate::models::video::VideoInfo;

#[cfg(target_os = "windows")]
use windows::{
    core::HSTRING,
    Win32::Media::MediaFoundation::{
        IMFMediaType, IMFSourceReader, MFCreateSourceReaderFromURL, MFStartup,
        MFSTARTUP_NOSOCKET, MF_MT_AUDIO_NUM_CHANNELS, MF_MT_FRAME_RATE, MF_MT_FRAME_SIZE,
        MF_MT_SUBTYPE, MF_PD_DURATION, MF_SOURCE_READER_FIRST_AUDIO_STREAM,
        MF_SOURCE_READER_FIRST_VIDEO_STREAM, MF_SOURCE_READER_MEDIASOURCE, MF_VERSION,
        MFAudioFormat_AAC, MFAudioFormat_MP3, MFAudioFormat_Opus, MFAudioFormat_PCM,
        MFVideoFormat_AV1, MFVideoFormat_H264, MFVideoFormat_H265, MFVideoFormat_VP80,
        MFVideoFormat_VP90,
    },
    Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED},
};

/// Le os metadados de um arquivo de video via Windows Media Foundation.
/// Substitui o sidecar ffprobe sem nenhum binario externo.
pub fn probe(path: &Path) -> Result<VideoInfo, String> {
    #[cfg(target_os = "windows")]
    {
        probe_windows(path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err(format!(
            "probe nao suportado nesta plataforma para: {}",
            path.display()
        ))
    }
}

// --- Implementacao Windows ---

#[cfg(target_os = "windows")]
fn probe_windows(path: &Path) -> Result<VideoInfo, String> {
    unsafe {
        // COM deve ser inicializado por thread.
        // S_OK (0) = inicializado agora -> chama CoUninitialize.
        // S_FALSE (1) = ja estava inicializado -> nao chama CoUninitialize.
        let co_hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        let co_initialized = co_hr.0 == 0;

        let result = read_media_info(path);

        if co_initialized {
            CoUninitialize();
        }

        result
    }
}

#[cfg(target_os = "windows")]
unsafe fn read_media_info(path: &Path) -> Result<VideoInfo, String> {
    MFStartup(MF_VERSION, MFSTARTUP_NOSOCKET)
        .map_err(|e| format!("MFStartup falhou: {e}"))?;

    let url = HSTRING::from(path.to_string_lossy().as_ref());
    let reader: IMFSourceReader = MFCreateSourceReaderFromURL(&url, None)
        .map_err(|e| format!("Falha ao abrir '{}': {e}", path.display()))?;

    let duration_100ns = read_presentation_u64(&reader, &MF_PD_DURATION)?;
    // MF_PD_DURATION e em unidades de 100 nanossegundos
    let duration = duration_100ns as f64 / 10_000_000.0;

    let (width, height, fps, video_codec) = read_video_stream_info(&reader)?;
    let (audio_codec, _channels) = read_audio_stream_info(&reader);

    let file_size = path.metadata().map(|m| m.len()).unwrap_or(0);

    // MF nao expoe bitrate total do container; estimamos a partir do tamanho e duracao
    let bitrate = if duration > 0.0 {
        Some((file_size as f64 * 8.0 / duration) as u64)
    } else {
        None
    };

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();

    Ok(VideoInfo {
        path: path.to_string_lossy().into_owned(),
        name,
        duration,
        width,
        height,
        fps,
        video_codec,
        audio_codec,
        bitrate,
        file_size,
    })
}

// --- Helpers de leitura de atributos MF ---

// GetPresentationAttribute retorna PROPVARIANT diretamente (windows 0.61+).
// MF_PD_DURATION usa VT_UI8; na 0.61 uhVal ja e u64 diretamente (sem .QuadPart).
#[cfg(target_os = "windows")]
unsafe fn read_presentation_u64(
    reader: &IMFSourceReader,
    key: &windows::core::GUID,
) -> Result<u64, String> {
    let pv = reader
        .GetPresentationAttribute(MF_SOURCE_READER_MEDIASOURCE.0 as u32, key)
        .map_err(|e| format!("GetPresentationAttribute ({key:?}) falhou: {e}"))?;

    let value = pv.Anonymous.Anonymous.Anonymous.uhVal;
    Ok(value)
}

#[cfg(target_os = "windows")]
unsafe fn read_video_stream_info(
    reader: &IMFSourceReader,
) -> Result<(u32, u32, f64, String), String> {
    let media_type: IMFMediaType = reader
        .GetNativeMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, 0)
        .map_err(|e| format!("Nenhum stream de video encontrado: {e}"))?;

    // MF_MT_FRAME_SIZE empacota width (high 32 bits) e height (low 32 bits) num unico u64
    let frame_size = media_type
        .GetUINT64(&MF_MT_FRAME_SIZE)
        .map_err(|e| format!("MF_MT_FRAME_SIZE falhou: {e}"))?;
    let width = (frame_size >> 32) as u32;
    let height = (frame_size & 0xFFFF_FFFF) as u32;

    // MF_MT_FRAME_RATE empacota numerador (high) e denominador (low) num unico u64
    let frame_rate = media_type
        .GetUINT64(&MF_MT_FRAME_RATE)
        .unwrap_or((30 << 32) | 1); // fallback: 30/1 se nao disponivel
    let fps_num = (frame_rate >> 32) as f64;
    let fps_den = (frame_rate & 0xFFFF_FFFF) as f64;
    let fps = if fps_den > 0.0 { fps_num / fps_den } else { 0.0 };

    let video_codec = read_subtype_name(&media_type);

    Ok((width, height, fps, video_codec))
}

#[cfg(target_os = "windows")]
unsafe fn read_audio_stream_info(reader: &IMFSourceReader) -> (Option<String>, Option<u32>) {
    let Ok(media_type) = reader.GetNativeMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM.0 as u32, 0)
    else {
        return (None, None);
    };

    let codec = read_subtype_name(&media_type);
    let channels = media_type.GetUINT32(&MF_MT_AUDIO_NUM_CHANNELS).ok();

    (Some(codec), channels)
}

/// Converte o GUID de subtipo MF para um nome legivel (ex: MFVideoFormat_H264 -> "h264")
#[cfg(target_os = "windows")]
unsafe fn read_subtype_name(media_type: &IMFMediaType) -> String {
    use windows::core::GUID;

    let Ok(subtype) = media_type.GetGUID(&MF_MT_SUBTYPE) else {
        return String::from("unknown");
    };

    let known: &[(GUID, &str)] = &[
        (MFVideoFormat_H264, "h264"),
        (MFVideoFormat_H265, "hevc"),
        (MFVideoFormat_AV1, "av1"),
        (MFVideoFormat_VP90, "vp9"),
        (MFVideoFormat_VP80, "vp8"),
        (MFAudioFormat_AAC, "aac"),
        (MFAudioFormat_MP3, "mp3"),
        (MFAudioFormat_Opus, "opus"),
        (MFAudioFormat_PCM, "pcm"),
    ];

    known
        .iter()
        .find(|(guid, _)| *guid == subtype)
        .map(|(_, name)| (*name).to_string())
        .unwrap_or_else(|| format!("{{{:08X}-...}}", subtype.data1))
}
