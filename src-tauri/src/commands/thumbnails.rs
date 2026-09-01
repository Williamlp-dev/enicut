use crate::services::{media_info, thumbnails};

// Comando Tauri para gerar miniaturas da timeline.
// Retorna um vetor com os caminhos dos arquivos de imagem gerados.
#[tauri::command]
pub async fn generate_thumbnails(
    path: String,
    count: u32,
) -> Result<Vec<String>, String> {
    let p_buf = std::path::PathBuf::from(&path);

    tokio::task::spawn_blocking(move || {
        let info = media_info::probe(&p_buf)?;
        println!("[Thumbnails] Iniciando geração para '{}' (duração: {:.2}s, count: {})", p_buf.display(), info.duration, count);
        let res = thumbnails::generate(&p_buf, info.duration, count);
        match &res {
            Ok(paths) => println!("[Thumbnails] Sucesso! {} miniaturas geradas.", paths.len()),
            Err(e) => eprintln!("[Thumbnails] ERRO na geração de miniaturas: {}", e),
        }
        res
    })
    .await
    .map_err(|e| format!("generate_thumbnails spawn falhou: {e}"))?
}
