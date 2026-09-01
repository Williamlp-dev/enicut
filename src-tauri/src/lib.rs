use std::sync::Mutex;
use tauri::{Emitter, Manager};
use commands::system::AppArgs;

mod commands;
mod models;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Limpa caches temporários de miniaturas gerados em sessões anteriores
    services::paths::clean_all_temp_cache();

    // Captura o caminho de arquivo passado via linha de comando (ex: clique direito → Abrir com Enicut)
    let initial_file = std::env::args().skip(1).find(|arg| {
        !arg.starts_with("-") && std::path::Path::new(arg).exists()
    });

    tauri::Builder::default()
        .manage(AppArgs(Mutex::new(initial_file.clone())))
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(video_file) = argv.into_iter().skip(1).find(|arg| {
                !arg.starts_with("-") && std::path::Path::new(arg).exists()
            }) {
                let _ = app.emit("abrir-video", video_file);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(move |app| {
            // Aplica o efeito Mica nativo do Windows 11 para aparência integrada ao sistema.
            // Mica com dark=true combina com o tema escuro do Enicut.
            // Em versões anteriores ao Windows 11 o erro é ignorado silenciosamente.
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                use window_vibrancy::apply_mica;
                let _ = apply_mica(&window, Some(true));
            }

            if let Some(file) = initial_file {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
                    let _ = app_handle.emit("abrir-video", file);
                });
            }
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::video::probe_video,
            commands::cut::cut_video,
            commands::thumbnails::generate_thumbnails,
            commands::system::get_cli_arg,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao inicializar o Enicut");
}
