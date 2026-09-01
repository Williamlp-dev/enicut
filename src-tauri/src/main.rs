// Previne a janela adicional de console no Windows em release, NÃO REMOVA!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    enicut_lib::run()
}
