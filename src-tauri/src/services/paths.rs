use std::path::{Path, PathBuf};

// Limpa todos os caches temporários de miniaturas deixados por execuções anteriores.
pub fn clean_all_temp_cache() {
    let root = std::env::temp_dir().join("enicut");
    if root.exists() {
        let _ = std::fs::remove_dir_all(&root);
    }
}

// Retorna o diretório temporário do enicut para miniaturas.
// Cria o diretório se não existir e limpa caches de vídeos antigos.
pub fn thumbnail_cache_dir(video_path: &Path) -> std::io::Result<PathBuf> {
    let hash = hash_path(video_path);
    let root = std::env::temp_dir().join("enicut");
    let dir = root.join(&hash);
    std::fs::create_dir_all(&dir)?;

    // Mantém no máximo 5 caches recentes de miniaturas de vídeo
    prune_old_cache(&root, &hash, 5);

    Ok(dir)
}

fn prune_old_cache(root: &Path, current_hash: &str, max_entries: usize) {
    if let Ok(entries) = std::fs::read_dir(root) {
        let mut dirs: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .collect();

        if dirs.len() > max_entries {
            // Ordena pela data de modificação ascendente (mais antigos primeiro)
            dirs.sort_by_key(|d| {
                d.metadata()
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            });

            let to_remove = dirs.len().saturating_sub(max_entries);
            for entry in dirs.iter().take(to_remove) {
                let p = entry.path();
                if p.file_name().and_then(|n| n.to_str()) != Some(current_hash) {
                    let _ = std::fs::remove_dir_all(&p);
                }
            }
        }
    }
}

fn hash_path(path: &Path) -> String {
    let s = path.to_string_lossy();
    // Hash simples estilo djb2 — apenas para nomenclatura do diretório
    let mut hash: u64 = 5381;
    for b in s.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(b as u64);
    }
    format!("{:x}", hash & 0xffffff)
}
