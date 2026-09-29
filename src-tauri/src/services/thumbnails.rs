use std::path::Path;

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
        IMFAttributes, IMFMediaBuffer, IMFMediaType, IMFSample, IMFSourceReader,
        MFCreateAttributes, MFCreateMediaType, MFCreateSourceReaderFromURL, MFMediaType_Video,
        MFShutdown, MFStartup, MFSTARTUP_NOSOCKET, MFVideoFormat_RGB32, MF_LOW_LATENCY,
        MF_MT_FRAME_SIZE, MF_MT_MAJOR_TYPE, MF_MT_SUBTYPE,
        MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING,
        MF_SOURCE_READER_FIRST_AUDIO_STREAM, MF_SOURCE_READER_FIRST_VIDEO_STREAM, MF_VERSION,
    },
    Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_MULTITHREADED, StructuredStorage::PROPVARIANT,
    },
};

/// Largura padrão das miniaturas da timeline (em pixels).
const TARGET_THUMB_WIDTH: u32 = 160;

// ─── API Pública ─────────────────────────────────────────────────────────────

/// Extrai uma miniatura de vídeo em um timestamp específico e salva em disco como JPEG.
///
/// Projetada para ser chamada em threads paralelas — cada thread abre seu próprio
/// `IMFSourceReader` (COM multithreaded por thread) e gera um frame de forma
/// independente, sem contenção entre threads.
pub fn generate_single(
    video_path: &Path,
    duration: f64,
    timestamp_sec: f64,
    out_path: &str,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        unsafe { extract_single_windows(video_path, duration, timestamp_sec, out_path) }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (video_path, duration, timestamp_sec, out_path);
        Err("Miniaturas não suportadas nesta plataforma".to_string())
    }
}

// ─── Estruturas de Suporte (Windows) ─────────────────────────────────────────

#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Dimensions {
    width: u32,
    height: u32,
}

#[cfg(target_os = "windows")]
impl Dimensions {
    fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }

    fn from_mf_size(size: u64) -> Self {
        Self {
            width: (size >> 32) as u32,
            height: (size & 0xFFFF_FFFF) as u32,
        }
    }

    fn as_mf_size(self) -> u64 {
        ((self.width as u64) << 32) | (self.height as u64)
    }

    fn is_valid(self) -> bool {
        self.width > 0 && self.height > 0
    }
}

/// Agrupa as dimensões relevantes para a decodificação e escala do frame.
#[cfg(target_os = "windows")]
struct ThumbnailConfig {
    native_dims: Dimensions,
    decode_dims: Dimensions,
    target_dims: Dimensions,
}

/// Buffer de pixels brutos entregue pelo Media Foundation com stride real.
#[cfg(target_os = "windows")]
struct RawFrame<'a> {
    data: &'a [u8],
    dimensions: Dimensions,
    stride: u32,
}

// ─── RAII Scopes ─────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
struct ComScope(bool);

#[cfg(target_os = "windows")]
impl ComScope {
    unsafe fn enter() -> Self {
        let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        Self(hr.0 == 0 || hr.0 == 1) // S_OK ou S_FALSE
    }
}

#[cfg(target_os = "windows")]
impl Drop for ComScope {
    fn drop(&mut self) {
        if self.0 {
            unsafe { CoUninitialize(); }
        }
    }
}

#[cfg(target_os = "windows")]
struct MediaFoundationScope;

#[cfg(target_os = "windows")]
impl MediaFoundationScope {
    unsafe fn enter() -> Result<Self, String> {
        MFStartup(MF_VERSION, MFSTARTUP_NOSOCKET)
            .map_err(|e| format!("MFStartup falhou: {e}"))?;
        Ok(Self)
    }
}

#[cfg(target_os = "windows")]
impl Drop for MediaFoundationScope {
    fn drop(&mut self) {
        let _ = unsafe { MFShutdown() };
    }
}

#[cfg(target_os = "windows")]
struct BufferLockGuard<'a>(&'a IMFMediaBuffer);

#[cfg(target_os = "windows")]
impl<'a> Drop for BufferLockGuard<'a> {
    fn drop(&mut self) {
        let _ = unsafe { self.0.Unlock() };
    }
}

// ─── Pipeline de Extração ────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
unsafe fn extract_single_windows(
    video_path: &Path,
    duration: f64,
    timestamp_sec: f64,
    out_path: &str,
) -> Result<(), String> {
    let _com = ComScope::enter();
    let _mf = MediaFoundationScope::enter()?;

    let (reader, native_dims) = open_video_reader(video_path)?;
    let target_dims = calculate_thumbnail_dimensions(native_dims, TARGET_THUMB_WIDTH);
    let decode_dims = configure_rgb_output(&reader, target_dims)?;

    let sample = seek_and_read_frame(&reader, duration, timestamp_sec)?;
    let config = ThumbnailConfig {
        native_dims,
        decode_dims,
        target_dims,
    };

    save_sample_as_jpeg(&sample, &config, out_path)
}

/// Abre um `IMFSourceReader` dedicado para o arquivo de vídeo e obtém as dimensões nativas.
#[cfg(target_os = "windows")]
unsafe fn open_video_reader(video_path: &Path) -> Result<(IMFSourceReader, Dimensions), String> {
    let mut attr_opt: Option<IMFAttributes> = None;
    MFCreateAttributes(&mut attr_opt, 3)
        .map_err(|e| format!("MFCreateAttributes falhou: {e}"))?;
    let attr = attr_opt.ok_or("MFCreateAttributes retornou None")?;

    let _ = attr.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1);
    let _ = attr.SetUINT32(&MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, 1);
    let _ = attr.SetUINT32(&MF_LOW_LATENCY, 1);

    let url = HSTRING::from(video_path.to_string_lossy().as_ref());
    let reader: IMFSourceReader = MFCreateSourceReaderFromURL(&url, &attr)
        .map_err(|e| format!("Falha ao abrir vídeo: {e}"))?;

    let _ = reader.SetStreamSelection(MF_SOURCE_READER_FIRST_AUDIO_STREAM.0 as u32, false);
    let _ = reader.SetStreamSelection(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, true);

    let native_type = reader
        .GetNativeMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32, 0)
        .map_err(|e| format!("GetNativeMediaType falhou: {e}"))?;

    let frame_size = native_type
        .GetUINT64(&MF_MT_FRAME_SIZE)
        .map_err(|e| format!("MF_MT_FRAME_SIZE falhou: {e}"))?;

    let dims = Dimensions::from_mf_size(frame_size);
    if !dims.is_valid() {
        return Err("Dimensões do vídeo são inválidas".to_string());
    }

    Ok((reader, dims))
}

/// Calcula a altura proporcional mantendo a largura fixa.
#[cfg(target_os = "windows")]
fn calculate_thumbnail_dimensions(src: Dimensions, target_width: u32) -> Dimensions {
    let target_height = (((target_width as f64 / src.width as f64) * src.height as f64).round() as u32).max(1);
    Dimensions::new(target_width, target_height)
}

/// Configura o leitor para entregar quadros descompactados em RGB32.
/// Tenta configurar no tamanho alvo e aplica fallback caso o codec exija o tamanho nativo.
#[cfg(target_os = "windows")]
unsafe fn configure_rgb_output(
    reader: &IMFSourceReader,
    target_dims: Dimensions,
) -> Result<Dimensions, String> {
    let stream_index = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;

    let rgb_type = create_rgb32_media_type(Some(target_dims))?;
    if reader.SetCurrentMediaType(stream_index, None, &rgb_type).is_err() {
        let fallback_type = create_rgb32_media_type(None)?;
        reader
            .SetCurrentMediaType(stream_index, None, &fallback_type)
            .map_err(|e| format!("SetCurrentMediaType falhou: {e}"))?;
    }

    let current_type = reader
        .GetCurrentMediaType(stream_index)
        .map_err(|e| format!("GetCurrentMediaType falhou: {e}"))?;

    let actual_size = current_type
        .GetUINT64(&MF_MT_FRAME_SIZE)
        .map_err(|e| format!("MF_MT_FRAME_SIZE falhou: {e}"))?;

    let decode_dims = Dimensions::from_mf_size(actual_size);
    if !decode_dims.is_valid() {
        return Err("Resolução de decodificação inválida".to_string());
    }

    Ok(decode_dims)
}

#[cfg(target_os = "windows")]
unsafe fn create_rgb32_media_type(dims: Option<Dimensions>) -> Result<IMFMediaType, String> {
    let media_type: IMFMediaType = MFCreateMediaType()
        .map_err(|e| format!("MFCreateMediaType falhou: {e}"))?;

    media_type
        .SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)
        .map_err(|e| format!("SetGUID major type falhou: {e}"))?;

    media_type
        .SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)
        .map_err(|e| format!("SetGUID subtype falhou: {e}"))?;

    if let Some(d) = dims {
        let _ = media_type.SetUINT64(&MF_MT_FRAME_SIZE, d.as_mf_size());
    }

    Ok(media_type)
}

/// Posiciona o leitor no timestamp solicitado e lê a amostra de vídeo correspondente.
#[cfg(target_os = "windows")]
unsafe fn seek_and_read_frame(
    reader: &IMFSourceReader,
    duration: f64,
    timestamp_sec: f64,
) -> Result<IMFSample, String> {
    let ts_clamped = timestamp_sec.min(duration - 0.05).max(0.0);
    let timestamp_100ns = (ts_clamped * 10_000_000.0) as i64;
    let var_pos = PROPVARIANT::from(timestamp_100ns);
    let _ = reader.SetCurrentPosition(&GUID::zeroed(), &var_pos);

    let stream_index = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;
    for _ in 0..5 {
        let mut actual_stream_index = 0u32;
        let mut stream_flags = 0u32;
        let mut timestamp = 0i64;
        let mut sample_opt: Option<IMFSample> = None;

        if reader
            .ReadSample(
                stream_index,
                0,
                Some(&mut actual_stream_index),
                Some(&mut stream_flags),
                Some(&mut timestamp),
                Some(&mut sample_opt),
            )
            .is_err()
        {
            break;
        }

        if let Some(sample) = sample_opt {
            return Ok(sample);
        }
    }

    Err(format!("Nenhum frame encontrado em {ts_clamped:.2}s"))
}

/// Bloqueia o buffer da amostra, detecta a resolução entregue e invoca a codificação JPEG.
#[cfg(target_os = "windows")]
unsafe fn save_sample_as_jpeg(
    sample: &IMFSample,
    config: &ThumbnailConfig,
    out_path: &str,
) -> Result<(), String> {
    let buffer = sample
        .ConvertToContiguousBuffer()
        .map_err(|e| format!("ConvertToContiguousBuffer falhou: {e}"))?;

    let mut ptr = std::ptr::null_mut();
    let mut current_len = 0u32;
    buffer
        .Lock(&mut ptr, None, Some(&mut current_len))
        .map_err(|e| format!("buffer.Lock falhou: {e}"))?;

    let _lock = BufferLockGuard(&buffer);

    let buf_len = current_len as usize;
    let slice = std::slice::from_raw_parts(ptr, buf_len);

    let frame = resolve_delivered_frame(slice, buf_len, config.decode_dims, config.native_dims);

    let wic_factory: IWICImagingFactory =
        CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("CoCreateInstance WIC falhou: {e}"))?;

    encode_jpeg(&wic_factory, &frame, config.target_dims, out_path)
}

/// Detecta se o Media Foundation entregou o frame decodificado no tamanho alvo
/// ou na resolução nativa (comum após seek), calculando a stride real por linha.
#[cfg(target_os = "windows")]
fn resolve_delivered_frame<'a>(
    data: &'a [u8],
    buf_len: usize,
    decode_dims: Dimensions,
    native_dims: Dimensions,
) -> RawFrame<'a> {
    let expected_small = (decode_dims.width * decode_dims.height * 4) as usize;
    let dimensions = if buf_len <= expected_small + expected_small / 4 + 256 {
        decode_dims
    } else {
        native_dims
    };

    let stride = (buf_len as u32)
        .checked_div(dimensions.height)
        .unwrap_or(dimensions.width * 4);

    RawFrame {
        data,
        dimensions,
        stride,
    }
}

/// Converte o buffer bruto (com possível padding de alinhamento por linha do MF)
/// para um buffer BGRA contíguo com alpha opaco (0xFF) e sem padding de stride.
#[cfg(target_os = "windows")]
fn prepare_clean_bgra(frame: &RawFrame<'_>) -> Vec<u8> {
    let clean_stride = (frame.dimensions.width * 4) as usize;
    let required_len = (frame.stride * frame.dimensions.height) as usize;
    let valid_slice = if frame.data.len() >= required_len {
        &frame.data[..required_len]
    } else {
        frame.data
    };

    let mut clean_buffer = Vec::with_capacity(clean_stride * frame.dimensions.height as usize);

    for row in 0..frame.dimensions.height {
        let row_start = (row * frame.stride) as usize;
        let row_end = row_start + clean_stride;

        if row_end <= valid_slice.len() {
            let row_data = &valid_slice[row_start..row_end];
            for chunk in row_data.chunks_exact(4) {
                clean_buffer.extend_from_slice(&[chunk[0], chunk[1], chunk[2], 0xFF]);
            }
        } else {
            // Linha além dos dados válidos — preenche com preto
            clean_buffer.resize(clean_buffer.len() + clean_stride, 0);
        }
    }

    clean_buffer
}

/// Codifica o frame em arquivo JPEG no caminho especificado usando o Windows Imaging Component (WIC).
#[cfg(target_os = "windows")]
unsafe fn encode_jpeg(
    factory: &IWICImagingFactory,
    frame: &RawFrame<'_>,
    target_dims: Dimensions,
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

    let wic_frame = frame_opt.ok_or_else(|| "CreateNewFrame retornou None".to_string())?;

    wic_frame
        .Initialize(None)
        .map_err(|e| format!("Frame Initialize falhou: {e}"))?;

    wic_frame
        .SetSize(target_dims.width, target_dims.height)
        .map_err(|e| format!("SetSize falhou: {e}"))?;

    let mut pixel_format = GUID_WICPixelFormat24bppBGR;
    let _ = wic_frame.SetPixelFormat(&mut pixel_format);

    let clean_buffer = prepare_clean_bgra(frame);
    let clean_stride = frame.dimensions.width * 4;

    let bitmap: IWICBitmap = factory
        .CreateBitmapFromMemory(
            frame.dimensions.width,
            frame.dimensions.height,
            &GUID_WICPixelFormat32bppBGRA,
            clean_stride,
            &clean_buffer,
        )
        .map_err(|e| format!("CreateBitmapFromMemory falhou: {e}"))?;

    if frame.dimensions == target_dims {
        // Já está no tamanho final correto: grava direto sem scaler
        wic_frame
            .WriteSource(&bitmap, std::ptr::null())
            .map_err(|e| format!("WriteSource falhou: {e}"))?;
    } else {
        // Redimensiona usando bilinear scaler do WIC
        let scaler: IWICBitmapScaler = factory
            .CreateBitmapScaler()
            .map_err(|e| format!("CreateBitmapScaler falhou: {e}"))?;

        scaler
            .Initialize(
                &bitmap,
                target_dims.width,
                target_dims.height,
                WICBitmapInterpolationModeLinear,
            )
            .map_err(|e| format!("Scaler Initialize falhou: {e}"))?;

        wic_frame
            .WriteSource(&scaler, std::ptr::null())
            .map_err(|e| format!("WriteSource falhou: {e}"))?;
    }

    wic_frame
        .Commit()
        .map_err(|e| format!("Frame Commit falhou: {e}"))?;

    encoder
        .Commit()
        .map_err(|e| format!("Encoder Commit falhou: {e}"))?;

    Ok(())
}
