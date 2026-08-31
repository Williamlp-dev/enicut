# ENICUT 🎬

**ENICUT** é um editor e cortador de vídeo super rápido, focado em performance, privacidade (100% offline) e uma interface de usuário premium e intuitiva. 

Construído com tecnologias modernas de desktop para oferecer uma experiência nativa e incrivelmente leve.

## 💡 Como surgiu a ideia?

Eu utilizo muito a Reprodução Instantânea da NVIDIA (Instant Replay) para salvar clipes rápidos de gameplay e o meu dia a dia exige que eu corte diversos outros vídeos constantemente. O problema é que eu nunca encontrei uma ferramenta que fosse realmente **rápida, leve e focada apenas no essencial** para fazer esses cortes. A maioria dos editores demorava uma eternidade para abrir ou exigia re-renderizar o clipe inteiro. 

Foi assim que nasceu o **ENICUT**: uma solução feita de desenvolvedor para usuário, criada para resolver essa dor e facilitar o dia a dia de quem precisa de agilidade. E isso é só o começo, logo mais vêm novas atualizações! 🚀

## ✨ Destaques da Versão 1.0

- **Cortes Instantâneos (Fast Cut):** Diferente de editores tradicionais, o ENICUT corta vídeos sem necessidade de re-encodagem demorada utilizando `ffmpeg -c copy`. O corte de um vídeo longo acontece em frações de segundo.
- **Interface Premium (Glassmorphism):** Integração profunda com o Windows 11 usando efeitos nativos Mica/Acrylic e uma Titlebar customizada de borda a borda.
- **Privacidade Total:** Processamento 100% offline e local no seu PC.
- **Extrema Leveza:** O núcleo do aplicativo (Rust + React) pesa **menos de 5 MB**, garantindo uso quase zero de memória RAM em repouso.
- **Timeline Interativa:** Navegação rápida com geração assíncrona de miniaturas (thumbnails).

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React, TypeScript, TailwindCSS 4, Lucide React
- **Backend:** Rust, Tauri v2
- **Processamento de Mídia:** FFmpeg & FFprobe (Sidecars)
- **Tooling:** Vite, Biome (Lint/Format), pnpm

## 🚀 Como Desenvolver

**Pré-requisitos:**
- [Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

**Passos:**
1. Clone este repositório.
2. Baixe os binários estáticos do [FFmpeg e FFprobe para Windows](https://www.gyan.dev/ffmpeg/builds/) e coloque os arquivos `.exe` na pasta `src-tauri/binaries/` com os nomes `ffmpeg.exe` e `ffprobe.exe`.
3. Instale as dependências:
   ```bash
   pnpm install
   ```
4. Rode em ambiente de desenvolvimento:
   ```bash
   pnpm tauri dev
   ```

## 📦 Como Compilar (Release)

O projeto está otimizado (`opt-level="s"`, `lto=true`, `codegen-units=1`) para gerar um binário incrivelmente pequeno.

Para criar o instalador final:
```bash
pnpm tauri build
```
O `.msi` ou `.exe` gerado estará disponível em `src-tauri/target/release/bundle/`.

---
*Desenvolvido com foco em Clean Code e Arquitetura Robusta.*
