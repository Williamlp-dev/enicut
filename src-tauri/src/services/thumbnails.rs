use std::path::Path;

use crate::services::paths::thumbnail_cache_dir;

#[cfg(target_os = "windows")]
use windows::{
    core::{GUID, HSTRING, PCWSTR},
    Win32::Foundation::GENERIC_WRITE,
    Win32::Graphics::Imaging::{
        CLSID_WICImagingFactory, GUID_ContainerFormatJpeg, GUID_WICPixelFormat24bppBGR,
        GUID_WICPixelFormat32bppBGRA, IWICBitmap, IWICBitmapEncoder,
        IWICBitmapFrameEncode, IWICBitmapScaler, IWICImagingFactory, IWICStream,
        WICBitmapEncoderNoCache, WICBitmapInterpolationModeLinear,
    },
    Win32::Media::MediaFoundation::{
        IMFAttributes, IMFMediaType, IMFSample, IMFSourceReader, MFCreateAttributes,
        MFCreateMediaType, MFCreateSourceReaderFromURL, MFStartup, MFSTARTUP_NOSOCKET,
        MFVideoFormat_RGB32, MF_LOW_LATENCY, MF_MT_FRAME_SIZE, MF_MT_MAJOR_TYPE,
        MF_MT_SUBTYPE, MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS,
        MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, MF_SOURCE_READER_FIRST_AUDIO_STREAM,
        MF_SOURCE_READER_FIRST_VIDEO_STREAM, MF_VERSION,
    },
    Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_MULTITHREADED, StructuredStorage::PROPVARIANT,
    },
};

/// Gera `count` imagens em miniatura (JPEG) distribuídas uniformemente ao longo da duração do vídeo.
/// Usa Windows Media Foundation com aceleração por GPU e redimensionamento nativo.
pub fn generate(
    video_path: &Path,
    duration: f64,
    count: u32,
) -> Result<Vec<String>, String> {
    if count == 0 {
        return Ok(vec![]);
    }

    #[cfg(target_os = "windows")]
    {
        generate_windows(video_path, duration, count)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err(format!(
            "Miniaturas não suportadas nesta plataforma para: {}",
            video_path.display()
        ))
    }
}

// ─── Implementação Windows ────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn generate_windows(
    video_path: &Path,
    duration: f64,
    count: u32,
) -> Result<Vec<String>, String> {
    let cache_dir = thumbnail_cache_dir(video_path)
        .map_err(|e| format!("Falha ao criar diretório de cache: {e}"))?;

    let mut paths = Vec::with_capacity(count as usize);
    let mut all_exist = true;

    for i in 0..count {
        let output = cache_dir.join(format!("thumb_{:04}.jpg", i));
        let output_str = output.to_string_lossy().into_owned();
        if !output.exists() {
            all_exist = false;
        }
        paths.push(output_str);
    }

    if all_exist {
        return Ok(paths);
    }

    unsafe {
        let co_hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        let co_initialized = co_hr.0 == 0;

        let result = extract_thumbnails(video_path, duration, count, &paths);

        if co_initialized {
            CoUninitialize();
        }

        result.map(|_| {
            paths
                .into_iter()
                .filter(|p| Path::new(p).exists())
                .collect()
        })
    }
}

#[cfg(target_os = "windows")]
unsafe fn extract_thumbnails(
    video_path: &Path,
    duration: f64,
    count: u32,
    paths: &[String],
) -> Result<(), String> {
    MFStartup(MF_VERSION, MFSTARTUP_NOSOCKET)
        .map_err(|e| format!("MFStartup falhou: {e}"))?;

    let mut attr_opt: Option<IMFAttributes> = None;
    MFCreateAttributes(&mut attr_opt, 3)
        .map_err(|e| format!("MFCreateAttributes falhou: {e}"))?;
    let attr = attr_opt.ok_or_else(|| "MFCreateAttributes retornou None".to_string())?;

    // 1. Habilita decodificação acelerada por hardware via GPU (NVDEC / Intel QSV / AMD)
    let _ = attr.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1);
    // 2. Habilita o processador de vídeo interno para downscaling e conversão de cores nativa
    let _ = attr.SetUINT32(&MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, 1);
    // 3. Otimiza latência de leitura
    let _ = attr.SetUINT32(&MF_LOW_LATENCY, 1);

    let url = HSTRING::from(video_path.to_string_lossy().as_ref());
    let reader: IMFSourceReader = MFCreateSourceReaderFromURL(&url, &attr)
        .map_err(|e| format!("Falha ao abrir vídeo '{}': {e}", video_path.display()))?;

    // Desativa áudio e ativa vídeo
    let _ = reader.SetStreamSelection(MF_SOURCE_READER_FIRST_AUDIO_STREAM.0 as u32, false);
    let _ = reader.SetStreamSelection(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, true);

    // Lê a resolução nativa do vídeo
    let native_type = reader
        .GetNativeMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, 0)
        .map_err(|e| format!("GetNativeMediaType falhou: {e}"))?;
    let frame_size = native_type
        .GetUINT64(&MF_MT_FRAME_SIZE)
        .map_err(|e| format!("MF_MT_FRAME_SIZE falhou: {e}"))?;
    let src_width = (frame_size >> 32) as u32;
    let src_height = (frame_size & 0xFFFF_FFFF) as u32;

    if src_width == 0 || src_height == 0 {
        return Err("Dimensões inválidas do vídeo".to_string());
    }

    let target_width = 160u32;
    let target_height = (((160.0 / src_width as f64) * src_height as f64).round() as u32).max(1);

    // Solicita RGB32 já redimensionado pelo Video Processor nativo para 160xH
    let rgb_type: IMFMediaType = MFCreateMediaType()
        .map_err(|e| format!("MFCreateMediaType falhou: {e}"))?;
    rgb_type
        .SetGUID(&MF_MT_MAJOR_TYPE, &windows::Win32::Media::MediaFoundation::MFMediaType_Video)
        .map_err(|e| format!("SetGUID(MF_MT_MAJOR_TYPE) falhou: {e}"))?;
    rgb_type
        .SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)
        .map_err(|e| format!("SetGUID(MF_MT_SUBTYPE) falhou: {e}"))?;

    let target_size = ((target_width as u64) << 32) | (target_height as u64);
    let _ = rgb_type.SetUINT64(&MF_MT_FRAME_SIZE, target_size);

    if reader.SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, None, &rgb_type).is_err() {
        // Fallback: se o decoder não aceitar redimensionamento direto, solicita RGB32 padrão
        let fallback_type: IMFMediaType = MFCreateMediaType()
            .map_err(|e| format!("MFCreateMediaType falhou: {e}"))?;
        fallback_type
            .SetGUID(&MF_MT_MAJOR_TYPE, &windows::Win32::Media::MediaFoundation::MFMediaType_Video)
            .map_err(|e| format!("SetGUID fallback falhou: {e}"))?;
        fallback_type
            .SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)
            .map_err(|e| format!("SetGUID fallback falhou: {e}"))?;
        reader
            .SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, None, &fallback_type)
            .map_err(|e| format!("SetCurrentMediaType falhou: {e}"))?;
    }

    // Lê a resolução real entregue pelo Media Foundation
    let current_type = reader
        .GetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32)
        .map_err(|e| format!("GetCurrentMediaType falhou: {e}"))?;
    let actual_size = current_type
        .GetUINT64(&MF_MT_FRAME_SIZE)
        .map_err(|e| format!("MF_MT_FRAME_SIZE falhou: {e}"))?;
    let decode_width = (actual_size >> 32) as u32;
    let decode_height = (actual_size & 0xFFFF_FFFF) as u32;

    let wic_factory: IWICImagingFactory = CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)
        .map_err(|e| format!("CoCreateInstance(CLSID_WICImagingFactory) falhou: {e}"))?;

    let interval = if count > 1 {
        duration / (count as f64 - 1.0)
    } else {
        0.0
    };

    for i in 0..count {
        let out_path = &paths[i as usize];
        if Path::new(out_path).exists() {
            continue;
        }

        let timestamp_sec = (i as f64 * interval).min(duration);
        let timestamp_100ns = (timestamp_sec * 10_000_000.0) as i64;
        let var_pos = PROPVARIANT::from(timestamp_100ns);

        let _ = reader.SetCurrentPosition(&GUID::zeroed(), &var_pos);

        // Busca o keyframe mais próximo imediatamente após o seek (evita decodificar múltiplos frames)
        let mut actual_sample: Option<IMFSample> = None;
        for _ in 0..5 {
            let mut actual_stream_index = 0u32;
            let mut stream_flags = 0u32;
            let mut sample_timestamp = 0i64;
            let mut sample_opt: Option<IMFSample> = None;

            let read_res = reader.ReadSample(
                MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32,
                0,
                Some(&mut actual_stream_index),
                Some(&mut stream_flags),
                Some(&mut sample_timestamp),
                Some(&mut sample_opt),
            );

            if read_res.is_err() {
                break;
            }

            if let Some(s) = sample_opt {
                actual_sample = Some(s);
                break;
            }
        }

        if let Some(sample) = actual_sample {
            let buffer = match sample.ConvertToContiguousBuffer() {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("[Thumbnails] Frame {i}: ConvertToContiguousBuffer falhou: {e}");
                    continue;
                }
            };

            let mut ptr = std::ptr::null_mut();
            let mut current_len = 0u32;
            if let Err(e) = buffer.Lock(&mut ptr, None, Some(&mut current_len)) {
                eprintln!("[Thumbnails] Frame {i}: buffer.Lock falhou: {e}");
                continue;
            }

            let slice = std::slice::from_raw_parts(ptr, current_len as usize);

            let save_res = save_jpeg_frame(
                &wic_factory,
                slice,
                decode_width,
                decode_height,
                target_width,
                target_height,
                out_path,
            );

            let _ = buffer.Unlock();

            if let Err(e) = save_res {
                eprintln!("[Thumbnails] Frame {i}: save_jpeg_frame falhou: {e}");
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
unsafe fn save_jpeg_frame(
    factory: &IWICImagingFactory,
    pixel_data: &[u8],
    src_width: u32,
    src_height: u32,
    dst_width: u32,
    dst_height: u32,
    out_path: &str,
) -> Result<(), String> {
    let stream: IWICStream = factory
        .CreateStream()
        .map_err(|e| format!("CreateStream falhou: {e}"))?;

    let path_hstring = HSTRING::from(out_path);
    stream
        .InitializeFromFilename(
            PCWSTR::from_raw(path_hstring.as_ptr()),
            GENERIC_WRITE.0,
        )
        .map_err(|e| format!("InitializeFromFilename falhou: {e}"))?;

    let encoder: IWICBitmapEncoder = factory
        .CreateEncoder(&GUID_ContainerFormatJpeg, std::ptr::null())
        .map_err(|e| format!("CreateEncoder falhou: {e}"))?;

    encoder
        .Initialize(&stream, WICBitmapEncoderNoCache)
        .map_err(|e| format!("Encoder Initialize falhou: {e}"))?;

    let mut frame_opt: Option<IWICBitmapFrameEncode> = None;
    encoder
        .CreateNewFrame(&mut frame_opt, std::ptr::null_mut())
        .map_err(|e| format!("CreateNewFrame falhou: {e}"))?;

    let frame = frame_opt.ok_or_else(|| "CreateNewFrame retornou None".to_string())?;

    frame
        .Initialize(None)
        .map_err(|e| format!("Frame Initialize falhou: {e}"))?;

    frame
        .SetSize(dst_width, dst_height)
        .map_err(|e| format!("SetSize falhou: {e}"))?;

    let mut pixel_format = GUID_WICPixelFormat24bppBGR;
    let _ = frame.SetPixelFormat(&mut pixel_format);

    let stride = src_width * 4;
    let required_len = (stride * src_height) as usize;
    let valid_slice = if pixel_data.len() >= required_len {
        &pixel_data[..required_len]
    } else {
        pixel_data
    };

    // Força o 4º byte (alpha/padding) para 0xFF (100% opaco).
    let mut opaque_buffer = valid_slice.to_vec();
    for pixel in opaque_buffer.chunks_exact_mut(4) {
        pixel[3] = 0xFF;
    }

    let bitmap: IWICBitmap = factory
        .CreateBitmapFromMemory(
            src_width,
            src_height,
            &GUID_WICPixelFormat32bppBGRA,
            stride,
            &opaque_buffer,
        )
        .map_err(|e| format!("CreateBitmapFromMemory falhou: {e}"))?;

    if src_width == dst_width && src_height == dst_height {
        // Já está no tamanho final correto! Grava direto sem scaler
        frame
            .WriteSource(&bitmap, std::ptr::null())
            .map_err(|e| format!("WriteSource falhou: {e}"))?;
    } else {
        let scaler: IWICBitmapScaler = factory
            .CreateBitmapScaler()
            .map_err(|e| format!("CreateBitmapScaler falhou: {e}"))?;

        scaler
            .Initialize(&bitmap, dst_width, dst_height, WICBitmapInterpolationModeLinear)
            .map_err(|e| format!("Scaler Initialize falhou: {e}"))?;

        frame
            .WriteSource(&scaler, std::ptr::null())
            .map_err(|e| format!("WriteSource falhou: {e}"))?;
    }

    frame
        .Commit()
        .map_err(|e| format!("Frame Commit falhou: {e}"))?;

    encoder
        .Commit()
        .map_err(|e| format!("Encoder Commit falhou: {e}"))?;

    Ok(())
}
