# ENICUT 🎬

<p align="center">
  <strong>Cortador de vídeos ultrarrápido, leve e com foco em corte lossless sem re-encodagem.</strong><br>
  Construído com Tauri v2, Rust e React 19. 100% local, offline e sem dependências pesadas.
</p>

---

## 💡 Como surgiu a ideia?

Utilizava a **Reprodução Instantânea da NVIDIA** no dia a dia e essa experiência acabou gerando a ideia do ENICUT. A maioria dos editores disponíveis era pesada, lenta ou complexa demais para o que eu precisava foi aí que decidi criar algo do zero, focado apenas no essencial.

---

## ✨ Principais Recursos

- ⚡ **Corte Lossless em Frações de Segundo:** O corte é feito diretamente no container MP4 em Rust puro (stream-copy com extradata passthrough), sem re-encodagem. Um clipe longo é cortado em milissegundos mantendo a qualidade original (H.264, HEVC/H.265, AV1, AAC).
- 🚀 **Zero Dependências Externas (Sem FFmpeg):** Ao contrário de outros cortadores que empacotam 100+ MB de binários do FFmpeg, o ENICUT utiliza APIs nativas do **Windows Media Foundation (WMF)** e **Windows Imaging Component (WIC)** com aceleração por hardware (GPU). O executável final é extremamente pequeno (< 5 MB).
- 🎞️ **Timeline Interativa com Miniaturas Rápidas:** Geração assíncrona de miniaturas (thumbnails) com cache inteligente e aceleração por GPU.
- 🔄 **Atualizações Automáticas In-App:** Sistema de auto-update integrado com GitHub Releases e assinatura criptográfica Ed25519. Verifique e instale atualizações diretamente pela logo do aplicativo sem precisar reinstalar.
- ⌨️ **Atalhos de Teclado Profissionais:** Navegação e corte rápidos pelo teclado (`Espaço`, `I`, `O`, `Ctrl + ?`).
- 🪟 **Interface Moderna e Minimalista:** Design sóbrio em dark mode, janela sem bordas com controles nativos customizados e pílulas de busca rápida (`[ ‹ 10s ]` e `[ 10s › ]`).
- 🔒 **Privacidade Total:** 100% offline. Nenhum vídeo ou dado sai do seu computador.

---

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
| :--- | :--- |
| <kbd>Espaço</kbd> | Reproduzir / Pausar |
| <kbd>I</kbd> | Definir Ponto Inicial (*In*) |
| <kbd>O</kbd> | Definir Ponto Final (*Out*) |
| <kbd>Ctrl</kbd> + <kbd>?</kbd> | Abrir modal de atalhos |
| <kbd>Esc</kbd> | Fechar modais e menus |

---

## 🛠️ Tecnologias Utilizadas

- **Core & Backend:**
  - [Rust](https://www.rust-lang.org/) — Performance nativa, segurança de memória e manipulação de arquivos em baixo nível
  - [Tauri v2](https://v2.tauri.app/) — Framework leve para desktop apps
  - **Windows Media Foundation (WMF) & WIC** — Leitura de metadados e renderização de miniaturas acelerada por hardware
  - **MP4 Container Remuxer** — Parser e multiplexador MP4 em Rust puro
- **Frontend:**
  - [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
  - [TailwindCSS v4](https://tailwindcss.com/) — Estilização moderna e enxuta
  - [Lucide React](https://lucide.dev/) — Ícones
- **Ferramentas:**
  - [Vite](https://vitejs.dev/) — Dev server ultrarrápido
  - [Biome](https://biomejs.dev/) — Linter e formatador de código
  - [pnpm](https://pnpm.io/) — Gerenciador de pacotes eficiente

---

## 🚀 Como Desenvolver Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 20 ou superior)
- [pnpm](https://pnpm.io/) (`corepack enable` ou `npm install -g pnpm`)
- [Rust](https://www.rust-lang.org/tools/install) (com o target `x86_64-pc-windows-msvc`)

> [!NOTE]
> Não é necessário baixar nenhum binário externo (como FFmpeg). O projeto compila e roda nativamente no Windows de forma direta.

### Passos:
1. Clone o repositório:
   ```bash
   git clone https://github.com/Williamlp-dev/enicut.git
   cd enicut
   ```

2. Instale as dependências:
   ```bash
   pnpm install
   ```

3. Inicie o ambiente de desenvolvimento:
   ```bash
   pnpm tauri dev
   ```

---

## 📦 Como Compilar para Produção

Para gerar o instalador final do Windows:

```bash
pnpm tauri build
```

Os artefatos gerados estarão disponíveis em:
`src-tauri/target/release/bundle/nsis/` ou `src-tauri/target/release/bundle/msi/`.

---

## 📄 Licença

Este projeto é desenvolvido para uso pessoal e comunidade sob a licença de software livre. Sinta-se à vontade para abrir [Issues](https://github.com/Williamlp-dev/enicut/issues) ou enviar contribuições!
