use std::sync::Mutex;
use tauri::State;

pub struct AppArgs(pub Mutex<Option<String>>);

// Comando Tauri para obter o argumento da linha de comando passado na inicialização.
// Usado principalmente para o recurso "Abrir com" do sistema operacional.
#[tauri::command]
pub fn get_cli_arg(state: State<AppArgs>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}
