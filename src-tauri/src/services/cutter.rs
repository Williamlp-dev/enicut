use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::Path;

use mp4::{Mp4Reader, TrackType};

/// Realiza o corte rápido (lossless / stream-copy) de um vídeo MP4 em Rust puro com passthrough de sample entry.
pub fn cut(
    input: &Path,
    output: &Path,
    start: f64,
    end: f64,
) -> Result<String, String> {
    let output_str = output.to_string_lossy().into_owned();
    cut_mp4_lossless(input, output, start, end)?;
    Ok(output_str)
}

/// Corte lossless universal e codec-agnóstico em Rust puro.
/// Preserva o SampleEntry original (av01/av1C para AV1, avc1/avcC para H.264, hvc1/hvcC para HEVC, mp4a para AAC),
/// localiza o keyframe exato, rebaseia os metadados temporais e constrói o container MP4 perfeito.
pub fn cut_mp4_lossless(
    input: &Path,
    output: &Path,
    start_sec: f64,
    end_sec: f64,
) -> Result<(), String> {
    println!("[Cutter] Iniciando corte lossless nativo com Extradata Passthrough...");

    let mut src_file = File::open(input)
        .map_err(|e| format!("Falha ao abrir arquivo de entrada: {e}"))?;
    let file_len = src_file
        .metadata()
        .map_err(|e| format!("Falha ao ler metadata: {e}"))?
        .len();

    // Lê o cabeçalho/final do arquivo para extrair o moov e os SampleEntries originais
    let seek_pos = file_len.saturating_sub(16 * 1024 * 1024);
    src_file.seek(SeekFrom::Start(seek_pos))
        .map_err(|e| format!("Falha ao posicionar ponteiro no moov: {e}"))?;
    let mut moov_buf = vec![0u8; 16 * 1024 * 1024];
    let n_moov = src_file.read(&mut moov_buf)
        .map_err(|e| format!("Falha ao ler moov: {e}"))?;
    moov_buf.truncate(n_moov);

    // Se o moov estiver no início do arquivo (ex: faststart), lê os primeiros 16 MB
    if !has_box(&moov_buf, b"stsd") {
        src_file.seek(SeekFrom::Start(0))
            .map_err(|e| format!("Falha no seek inicial: {e}"))?;
        let mut header_buf = vec![0u8; 16 * 1024 * 1024];
        let n_head = src_file.read(&mut header_buf)
            .map_err(|e| format!("Falha ao ler cabeçalho: {e}"))?;
        header_buf.truncate(n_head);
        moov_buf = header_buf;
    }

    // Extrai o SampleEntry bruto do vídeo (av01 / avc1 / avc3 / hvc1 / hev1 / vp09)
    let (video_stsd_entry, video_w, video_h) = extract_video_sample_entry(&moov_buf)
        .ok_or_else(|| "Não foi possível localizar o SampleEntry de vídeo no arquivo".to_string())?;

    // Extrai o SampleEntry bruto do áudio (mp4a / Opus / ac-3)
    let audio_stsd_opt = extract_audio_sample_entry(&moov_buf);

    println!(
        "[Cutter] Video Codec FourCC: '{}', SampleEntry: {} bytes, Resolução: {}x{}",
        String::from_utf8_lossy(&video_stsd_entry[4..8]),
        video_stsd_entry.len(),
        video_w,
        video_h
    );

    // Usa Mp4Reader para analisar índices, timescale e keyframes
    src_file.seek(SeekFrom::Start(0))
        .map_err(|e| format!("Falha no seek: {e}"))?;
    let reader = BufReader::new(src_file);
    let mut mp4_reader = Mp4Reader::read_header(reader, file_len)
        .map_err(|e| format!("Falha ao analisar cabeçalho MP4: {e}"))?;

    // Localiza os IDs dos tracks de vídeo e áudio
    let mut v_track_id_opt = None;
    let mut a_track_id_opt = None;

    for (t_id, track) in mp4_reader.tracks() {
        if let Ok(tt) = track.track_type() {
            if tt == TrackType::Video && v_track_id_opt.is_none() {
                v_track_id_opt = Some(*t_id);
            } else if tt == TrackType::Audio && a_track_id_opt.is_none() {
                a_track_id_opt = Some(*t_id);
            }
        }
    }

    let v_track_id = v_track_id_opt.ok_or_else(|| "Nenhum track de vídeo encontrado".to_string())?;
    let v_track = mp4_reader.tracks().get(&v_track_id).unwrap();
    let v_timescale = v_track.timescale();
    let v_total_samples = mp4_reader.sample_count(v_track_id)
        .map_err(|e| format!("Falha ao obter amostras de vídeo: {e}"))?;

    // Localiza o keyframe mais próximo anterior a start_sec
    let v_scale = v_timescale as f64;
    let start_ticks = (start_sec.max(0.0) * v_scale) as u64;
    let end_ticks = (end_sec * v_scale) as u64;

    let mut keyframe_id = 1u32;
    let mut keyframe_dts = 0u64;
    let mut end_id = v_total_samples;

    for s_idx in 1..=v_total_samples {
        if let Ok(Some(s)) = mp4_reader.read_sample(v_track_id, s_idx) {
            if s.is_sync && s.start_time <= start_ticks {
                keyframe_id = s_idx;
                keyframe_dts = s.start_time;
            }
            if s.start_time > end_ticks && s_idx > 1 {
                end_id = s_idx - 1;
                break;
            }
        }
    }

    let actual_start_sec = keyframe_dts as f64 / v_scale;
    println!(
        "[Cutter] Corte alinhado ao keyframe: sample {} ({:.2}s até {:.2}s), total {} quadros de vídeo",
        keyframe_id, actual_start_sec, end_sec, end_id.saturating_sub(keyframe_id) + 1
    );

    // Determina intervalo de amostras de áudio correspondente
    let mut a_samples_info = None;
    if let (Some(a_track_id), Some(audio_entry)) = (a_track_id_opt, audio_stsd_opt) {
        if let Some(a_track) = mp4_reader.tracks().get(&a_track_id) {
            let a_timescale = a_track.timescale();
            if let Ok(a_total) = mp4_reader.sample_count(a_track_id) {
                let a_scale = a_timescale as f64;
                let a_start_ticks = (actual_start_sec * a_scale) as u64;
                let a_end_ticks = (end_sec * a_scale) as u64;
                let mut a_start_id = 1u32;
                let mut a_end_id = a_total;
                let mut found_start = false;

                for s_idx in 1..=a_total {
                    if let Ok(Some(s)) = mp4_reader.read_sample(a_track_id, s_idx) {
                        if !found_start && s.start_time >= a_start_ticks {
                            a_start_id = s_idx;
                            found_start = true;
                        }
                        if s.start_time > a_end_ticks && s_idx > 1 {
                            a_end_id = s_idx - 1;
                            break;
                        }
                    }
                }
                a_samples_info = Some((a_track_id, a_timescale, a_start_id, a_end_id, audio_entry));
            }
        }
    }

    // Cria o arquivo MP4 de destino
    let dst_file = File::create(output)
        .map_err(|e| format!("Falha ao criar arquivo de saída: {e}"))?;
    let mut out_file = BufWriter::new(dst_file);

    // 1. Escreve ftyp
    let ftyp_brands = [b"isom", b"mp42", b"av01", b"mp41"];
    let ftyp_size = 8 + 4 + 4 + (ftyp_brands.len() * 4);
    out_file.write_all(&(ftyp_size as u32).to_be_bytes()).unwrap();
    out_file.write_all(b"ftyp").unwrap();
    out_file.write_all(b"mp42").unwrap();
    out_file.write_all(&0u32.to_be_bytes()).unwrap();
    for b in &ftyp_brands {
        out_file.write_all(*b).unwrap();
    }

    // 2. Reserva cabeçalho do mdat
    let mdat_pos = out_file.stream_position().map_err(|e| e.to_string())?;
    out_file.write_all(&0u32.to_be_bytes()).unwrap(); // Tamanho temporário
    out_file.write_all(b"mdat").unwrap();

    // Copia samples de vídeo
    let mut v_sample_sizes = Vec::new();
    let mut v_sample_durations = Vec::new();
    let mut v_sync_samples = Vec::new();
    let mut v_sample_offsets = Vec::new();

    for (out_idx, s_idx) in (keyframe_id..=end_id).enumerate() {
        if let Ok(Some(s)) = mp4_reader.read_sample(v_track_id, s_idx) {
            let offset = out_file.stream_position().map_err(|e| e.to_string())?;
            v_sample_offsets.push(offset);
            out_file.write_all(&s.bytes).map_err(|e| e.to_string())?;
            v_sample_sizes.push(s.bytes.len() as u32);
            v_sample_durations.push(s.duration);
            if s.is_sync {
                v_sync_samples.push(out_idx as u32 + 1); // 1-indexed para stss
            }
        }
    }

    // Copia samples de áudio (se houver)
    let mut a_sample_sizes = Vec::new();
    let mut a_sample_durations = Vec::new();
    let mut a_sample_offsets = Vec::new();
    let mut a_timescale_final = 48000u32;
    let mut a_entry_final = Vec::new();

    if let Some((a_track_id, a_timescale, a_start_id, a_end_id, audio_entry)) = a_samples_info {
        a_timescale_final = a_timescale;
        a_entry_final = audio_entry;

        for s_idx in a_start_id..=a_end_id {
            if let Ok(Some(s)) = mp4_reader.read_sample(a_track_id, s_idx) {
                let offset = out_file.stream_position().map_err(|e| e.to_string())?;
                a_sample_offsets.push(offset);
                out_file.write_all(&s.bytes).map_err(|e| e.to_string())?;
                a_sample_sizes.push(s.bytes.len() as u32);
                a_sample_durations.push(s.duration);
            }
        }
    }

    let mdat_end = out_file.stream_position().map_err(|e| e.to_string())?;
    let mdat_size = (mdat_end - mdat_pos) as u32;

    // Atualiza o tamanho exato do mdat
    out_file.seek(SeekFrom::Start(mdat_pos)).map_err(|e| e.to_string())?;
    out_file.write_all(&mdat_size.to_be_bytes()).map_err(|e| e.to_string())?;
    out_file.seek(SeekFrom::Start(mdat_end)).map_err(|e| e.to_string())?;

    // 3. Constrói o moov com os SampleEntries originais intactos
    let v_total_dur: u64 = v_sample_durations.iter().map(|&d| d as u64).sum();
    let a_total_dur: u64 = a_sample_durations.iter().map(|&d| d as u64).sum();
    let movie_timescale = 1000u32;
    let movie_dur = (v_total_dur as f64 / v_timescale as f64 * movie_timescale as f64) as u64;

    let moov_bytes = build_moov_box(
        movie_timescale,
        movie_dur,
        // Track 1 (Vídeo)
        1,
        v_timescale,
        v_total_dur,
        video_w,
        video_h,
        &video_stsd_entry,
        &v_sample_durations,
        &v_sync_samples,
        &v_sample_sizes,
        &v_sample_offsets,
        // Track 2 (Áudio)
        if a_sample_sizes.is_empty() { None } else {
            Some((2, a_timescale_final, a_total_dur, &a_entry_final, &a_sample_durations, &a_sample_sizes, &a_sample_offsets))
        },
    );

    out_file.write_all(&moov_bytes).map_err(|e| e.to_string())?;
    out_file.flush().map_err(|e| e.to_string())?;

    println!("[Cutter] Corte nativo concluído com sucesso!");
    Ok(())
}

fn has_box(buf: &[u8], fourcc: &[u8; 4]) -> bool {
    for i in 0..buf.len().saturating_sub(4) {
        if &buf[i..i + 4] == fourcc {
            return true;
        }
    }
    false
}

/// Extrai a box do SampleEntry de vídeo (av01, avc1, avc3, hvc1, hev1, vp09) do stsd original
fn extract_video_sample_entry(buf: &[u8]) -> Option<(Vec<u8>, u16, u16)> {
    let codecs = [b"av01", b"avc1", b"avc3", b"hvc1", b"hev1", b"vp09"];
    for &fourcc in &codecs {
        for i in 0..buf.len().saturating_sub(64) {
            if &buf[i..i + 4] == fourcc && i >= 4 {
                let entry_size = u32::from_be_bytes([buf[i - 4], buf[i - 3], buf[i - 2], buf[i - 1]]) as usize;
                if entry_size >= 8 && i - 4 + entry_size <= buf.len() {
                    let entry_bytes = buf[i - 4..i - 4 + entry_size].to_vec();
                    let width = if entry_size >= 36 { u16::from_be_bytes([entry_bytes[32], entry_bytes[33]]) } else { 1920 };
                    let height = if entry_size >= 36 { u16::from_be_bytes([entry_bytes[34], entry_bytes[35]]) } else { 1080 };
                    return Some((entry_bytes, width, height));
                }
            }
        }
    }
    None
}

/// Extrai a box do SampleEntry de áudio (mp4a, Opus, ac-3) do stsd original
fn extract_audio_sample_entry(buf: &[u8]) -> Option<Vec<u8>> {
    let codecs = [b"mp4a", b"Opus", b"ac-3", b"ec-3"];
    for &fourcc in &codecs {
        for i in 0..buf.len().saturating_sub(64) {
            if &buf[i..i + 4] == fourcc && i >= 4 {
                let entry_size = u32::from_be_bytes([buf[i - 4], buf[i - 3], buf[i - 2], buf[i - 1]]) as usize;
                if entry_size >= 8 && i - 4 + entry_size <= buf.len() {
                    return Some(buf[i - 4..i - 4 + entry_size].to_vec());
                }
            }
        }
    }
    None
}

type AudioTrackData<'a> = (u32, u32, u64, &'a [u8], &'a [u32], &'a [u32], &'a [u64]);

/// Constrói a estrutura 'moov' em bytes puros com os stsd originais preservados
fn build_moov_box(
    movie_timescale: u32,
    movie_duration: u64,
    v_track_id: u32,
    v_timescale: u32,
    v_duration: u64,
    v_width: u16,
    v_height: u16,
    v_sample_entry: &[u8],
    v_durations: &[u32],
    v_sync_samples: &[u32],
    v_sizes: &[u32],
    v_offsets: &[u64],
    audio_data: Option<AudioTrackData>,
) -> Vec<u8> {
    let mut moov = Vec::new();

    // mvhd
    let mut mvhd = Vec::new();
    mvhd.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
    mvhd.write_all(&0u32.to_be_bytes()).unwrap(); // Creation time
    mvhd.write_all(&0u32.to_be_bytes()).unwrap(); // Modification time
    mvhd.write_all(&movie_timescale.to_be_bytes()).unwrap();
    mvhd.write_all(&(movie_duration as u32).to_be_bytes()).unwrap();
    mvhd.write_all(&0x00010000u32.to_be_bytes()).unwrap(); // Rate 1.0
    mvhd.write_all(&0x0100u16.to_be_bytes()).unwrap(); // Volume 1.0
    mvhd.write_all(&[0u8; 10]).unwrap(); // Reserved
    // Matrix (Unity 3x3)
    let matrix: [u32; 9] = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
    for m in &matrix {
        mvhd.write_all(&m.to_be_bytes()).unwrap();
    }
    mvhd.write_all(&[0u8; 24]).unwrap(); // Predefined
    mvhd.write_all(&3u32.to_be_bytes()).unwrap(); // Next track ID

    // Video Trak
    let v_trak = build_trak(
        v_track_id,
        v_timescale,
        v_duration,
        movie_timescale,
        v_width,
        v_height,
        b"vide",
        v_sample_entry,
        v_durations,
        Some(v_sync_samples),
        v_sizes,
        v_offsets,
    );

    // Audio Trak (se houver)
    let a_trak_opt = audio_data.map(|(a_id, a_ts, a_dur, a_entry, a_durations, a_szs, a_offs)| {
        build_trak(
            a_id,
            a_ts,
            a_dur,
            movie_timescale,
            0,
            0,
            b"soun",
            a_entry,
            a_durations,
            None,
            a_szs,
            a_offs,
        )
    });

    // Concatena moov
    let mut moov_len = 8 + (8 + mvhd.len()) + (8 + v_trak.len());
    if let Some(ref a_trak) = a_trak_opt {
        moov_len += 8 + a_trak.len();
    }

    moov.write_all(&(moov_len as u32).to_be_bytes()).unwrap();
    moov.write_all(b"moov").unwrap();

    write_box(&mut moov, b"mvhd", &mvhd);
    write_box(&mut moov, b"trak", &v_trak);
    if let Some(ref a_trak) = a_trak_opt {
        write_box(&mut moov, b"trak", a_trak);
    }

    moov
}

fn build_trak(
    track_id: u32,
    timescale: u32,
    duration: u64,
    movie_timescale: u32,
    width: u16,
    height: u16,
    handler: &[u8; 4],
    sample_entry: &[u8],
    durations: &[u32],
    sync_samples: Option<&[u32]>,
    sizes: &[u32],
    offsets: &[u64],
) -> Vec<u8> {
    let mut trak = Vec::new();

    // tkhd
    let mut tkhd = Vec::new();
    let track_dur_movie = (duration as f64 / timescale as f64 * movie_timescale as f64) as u32;
    let flags = 0x0000000Fu32; // Enabled, InMovie, InPreview
    tkhd.write_all(&(flags & 0x00FFFFFF).to_be_bytes()).unwrap(); // Version 0 + Flags
    tkhd.write_all(&0u32.to_be_bytes()).unwrap(); // Creation time
    tkhd.write_all(&0u32.to_be_bytes()).unwrap(); // Modification time
    tkhd.write_all(&track_id.to_be_bytes()).unwrap();
    tkhd.write_all(&0u32.to_be_bytes()).unwrap(); // Reserved
    tkhd.write_all(&track_dur_movie.to_be_bytes()).unwrap();
    tkhd.write_all(&[0u8; 8]).unwrap(); // Reserved
    tkhd.write_all(&0u16.to_be_bytes()).unwrap(); // Layer
    tkhd.write_all(&0u16.to_be_bytes()).unwrap(); // Alt group
    tkhd.write_all(&(if handler == b"soun" { 0x0100u16 } else { 0u16 }).to_be_bytes()).unwrap(); // Volume
    tkhd.write_all(&0u16.to_be_bytes()).unwrap(); // Reserved
    // Matrix
    let matrix: [u32; 9] = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
    for m in &matrix {
        tkhd.write_all(&m.to_be_bytes()).unwrap();
    }
    tkhd.write_all(&((width as u32) << 16).to_be_bytes()).unwrap();
    tkhd.write_all(&((height as u32) << 16).to_be_bytes()).unwrap();

    // mdia
    let mut mdia = Vec::new();

    // mdhd
    let mut mdhd = Vec::new();
    mdhd.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
    mdhd.write_all(&0u32.to_be_bytes()).unwrap(); // Creation
    mdhd.write_all(&0u32.to_be_bytes()).unwrap(); // Modification
    mdhd.write_all(&timescale.to_be_bytes()).unwrap();
    mdhd.write_all(&(duration as u32).to_be_bytes()).unwrap();
    mdhd.write_all(&0x55C4u16.to_be_bytes()).unwrap(); // Language "und"
    mdhd.write_all(&0u16.to_be_bytes()).unwrap(); // Predefined

    // hdlr
    let mut hdlr = Vec::new();
    hdlr.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
    hdlr.write_all(&0u32.to_be_bytes()).unwrap(); // Predefined
    hdlr.write_all(handler).unwrap();
    hdlr.write_all(&[0u8; 12]).unwrap(); // Reserved
    hdlr.write_all(if handler == b"vide" { b"VideoHandler\0" } else { b"SoundHandler\0" }).unwrap();

    // minf
    let mut minf = Vec::new();
    if handler == b"vide" {
        let mut vmhd = Vec::new();
        vmhd.write_all(&0x00000001u32.to_be_bytes()).unwrap(); // Version 0, Flags 1
        vmhd.write_all(&0u16.to_be_bytes()).unwrap(); // Graphics mode
        vmhd.write_all(&[0u8; 6]).unwrap(); // Opcolor
        write_box(&mut minf, b"vmhd", &vmhd);
    } else {
        let mut smhd = Vec::new();
        smhd.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
        smhd.write_all(&0u16.to_be_bytes()).unwrap(); // Balance
        smhd.write_all(&0u16.to_be_bytes()).unwrap(); // Reserved
        write_box(&mut minf, b"smhd", &smhd);
    }

    // dinf -> dref -> url
    let mut dinf = Vec::new();
    let mut dref = Vec::new();
    dref.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
    dref.write_all(&1u32.to_be_bytes()).unwrap(); // Entry count = 1
    let mut url = Vec::new();
    url.write_all(&0x00000001u32.to_be_bytes()).unwrap(); // Self-contained flag = 1
    write_box(&mut dref, b"url ", &url);
    write_box(&mut dinf, b"dref", &dref);
    write_box(&mut minf, b"dinf", &dinf);

    // stbl
    let mut stbl = Vec::new();

    // 1. stsd (Sample Description com o SampleEntry original preservado!)
    let mut stsd = Vec::new();
    stsd.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
    stsd.write_all(&1u32.to_be_bytes()).unwrap(); // Entry count = 1
    stsd.write_all(sample_entry).unwrap();
    write_box(&mut stbl, b"stsd", &stsd);

    // 2. stts (Time to sample)
    let mut stts = Vec::new();
    stts.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
    let mut stts_entries: Vec<(u32, u32)> = Vec::new();
    for &dur in durations {
        if let Some(last) = stts_entries.last_mut() {
            if last.1 == dur {
                last.0 += 1;
                continue;
            }
        }
        stts_entries.push((1, dur));
    }
    stts.write_all(&(stts_entries.len() as u32).to_be_bytes()).unwrap();
    for (count, delta) in stts_entries {
        stts.write_all(&count.to_be_bytes()).unwrap();
        stts.write_all(&delta.to_be_bytes()).unwrap();
    }
    write_box(&mut stbl, b"stts", &stts);

    // 3. stss (Sync samples - apenas para vídeo)
    if let Some(sync_list) = sync_samples {
        let mut stss = Vec::new();
        stss.write_all(&0u32.to_be_bytes()).unwrap();
        stss.write_all(&(sync_list.len() as u32).to_be_bytes()).unwrap();
        for &s_num in sync_list {
            stss.write_all(&s_num.to_be_bytes()).unwrap();
        }
        write_box(&mut stbl, b"stss", &stss);
    }

    // 4. stsc (Sample to chunk: 1 sample por chunk para precisão 100%)
    let mut stsc = Vec::new();
    stsc.write_all(&0u32.to_be_bytes()).unwrap();
    stsc.write_all(&1u32.to_be_bytes()).unwrap(); // 1 entrada
    stsc.write_all(&1u32.to_be_bytes()).unwrap(); // First chunk = 1
    stsc.write_all(&1u32.to_be_bytes()).unwrap(); // Samples per chunk = 1
    stsc.write_all(&1u32.to_be_bytes()).unwrap(); // Sample description index = 1
    write_box(&mut stbl, b"stsc", &stsc);

    // 5. stsz (Sample sizes)
    let mut stsz = Vec::new();
    stsz.write_all(&0u32.to_be_bytes()).unwrap(); // Version 0, Flags 0
    stsz.write_all(&0u32.to_be_bytes()).unwrap(); // Sample size 0 (variável)
    stsz.write_all(&(sizes.len() as u32).to_be_bytes()).unwrap();
    for &sz in sizes {
        stsz.write_all(&sz.to_be_bytes()).unwrap();
    }
    write_box(&mut stbl, b"stsz", &stsz);

    // 6. co64 (Chunk offset 64-bit para suporte a arquivos de qualquer gigabyte)
    let mut co64 = Vec::new();
    co64.write_all(&0u32.to_be_bytes()).unwrap();
    co64.write_all(&(offsets.len() as u32).to_be_bytes()).unwrap();
    for &off in offsets {
        co64.write_all(&off.to_be_bytes()).unwrap();
    }
    write_box(&mut stbl, b"co64", &co64);

    write_box(&mut minf, b"stbl", &stbl);

    write_box(&mut mdia, b"mdhd", &mdhd);
    write_box(&mut mdia, b"hdlr", &hdlr);
    write_box(&mut mdia, b"minf", &minf);

    write_box(&mut trak, b"tkhd", &tkhd);
    write_box(&mut trak, b"mdia", &mdia);

    trak
}

fn write_box(dest: &mut Vec<u8>, box_type: &[u8; 4], payload: &[u8]) {
    let box_len = (8 + payload.len()) as u32;
    dest.write_all(&box_len.to_be_bytes()).unwrap();
    dest.write_all(box_type).unwrap();
    dest.write_all(payload).unwrap();
}
