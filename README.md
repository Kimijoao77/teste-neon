# 🌱 HortaMon — Aventura Botânica

**HortaMon** é um RPG estilo Pokémon 100% original em visual **cartoon colorido de jardim**, estrelado por frutas, verduras, legumes, raízes e fungos colecionáveis. Feito em HTML5, CSS3 e JavaScript puro (sem dependências externas e sem servidor obrigatório), abre direto pelo navegador via `index.html`.

---

## 🌐 Jogar Online (PC ou celular)

**https://kimijoao77.github.io/teste-neon/** (precisa do GitHub Pages ligado em *Settings → Pages → Branch `main` / root*).

No celular, abra o link no Chrome e use **⋮ → Adicionar à tela inicial** para instalar como app.

---

## 🎮 Como Jogar (Abrir Localmente)

1. Abra a pasta do projeto (`teste-neon`).
2. Dê um clique duplo em **`index.html`** para abrir diretamente no navegador (Chrome, Edge ou Firefox — funciona via `file://`, sem necessidade de servidor ou internet).
3. Clique em **Começar Aventura** (ou **Continuar Aventura** caso já tenha progresso salvo) e escolha seu inicial com o **Prof. Pomar**:
   - 🌶️ **Pimentico** (*Picante*) — evolui para **Jalapão** e **Habaneiro**
   - 🍉 **Melancito** (*Fresco*) — evolui para **Melancor** e **Melanrei**
   - 🥦 **Brocolino** (*Folha*) — evolui para **Brocolão** e **Brocolosso**

---

## 🕹️ Controles

| Ação | Teclado / Mouse |
| --- | --- |
| Mover pelo mapa | `W A S D`, `Setas`, **D-Pad na tela** ou **clique/toque no mapa** |
| Interagir / Avançar diálogo | `Espaço`, `Enter`, botão **Interagir** ou clique em NPCs/placas |
| Abrir **Time** | `P` (ou botão **Time**) |
| Abrir **Mochila** | `I` (ou botão **Mochila**) |
| Abrir **BotaniDex** | `X` (ou botão **BotaniDex**) |
| Abrir **Tabela de Tipos** | `T` (ou botão **Tipos**) |
| Salvar progresso | `K` (ou botão **Salvar**) |
| Ligar / Mutar som | `M` (ou botão `🔊/🔇`) |
| Menu / Ajuda / Fechar janela | `Esc` |
| Celular | Toque no mapa para andar até o lugar, ou use o D-Pad e o botão **Interagir** |

---

## ✨ Recursos Implementados

- **30 HortaMons originais em arte cartoon procedural (`Canvas 2D`)**, com versões **✨ Douradas** raríssimas (1 em 64 encontros).
- **6 tipos em ciclo, cada um com identidade própria**: `🌶️ Picante → 🍄 Fungo → 🥦 Folha → 🥕 Raiz → 🍉 Fresco → 🍋 Cítrico → 🌶️`. Cada tipo vence os 2 seguintes (2×) e causa pouco dano nos 2 anteriores (0.5×). O triângulo dos iniciais continua: Picante > Folha > Fresco > Picante.
- **Mundo de 60×26 tiles em 6 áreas**:
  - **Vila da Horta**: Lab do Prof. Pomar, Estufa de Cura, Loja do Seu Bento e Terminal da Estufa.
  - **Rota 1 — Canteiro Ensolarado** (Nv. 2–5) e **Rota 2 — Bosque dos Esporos** (Nv. 5–9), com 4 jardineiros.
  - **Arena da Estufa Dourada**: a **Líder Flora** só aceita o desafio depois que você vence os 4 jardineiros.
  - **Pomar Tropical** (Nv. 10–15): liberado pelo **Guarda Tom** depois da 1ª insígnia; tem o **Posto do Pomar** (cura e loja) e 2 jardineiros.
  - **Horta Subterrânea** (Nv. 13–17): caverna com canteiros sombrios, 2 jardineiros e a **Arena da Raiz Profunda** do **Líder Mandi** (Nv. 17–20).
- **Batalha por turnos animada** com cenários de jardim, pomar tropical e caverna, captura, evolução e IA tática.
- **XP para o time**: quem entra no meio da luta ganha metade do XP; com o **Adubo Compartilhado** (presente do Prof. Pomar quando você tem 2 HortaMons) o time inteiro ganha.
- **Apelidos** (botão ✏️ no Time), **BotaniDex**, **Caixa da Estufa** e **Tabela de Tipos**.
- **Save**: automático no navegador (`localStorage`, chave `hortamon_save_v1`) e **Exportar/Importar Save** em arquivo `.json` (Menu) para levar o progresso entre PCs e celular.
- **Álbum de Cartas** (`cartas.html`): cartas giratórias — a frente mostra só o personagem e, ao tocar, a carta vira e mostra a ficha (stats, golpes, forte/fraco contra). Cada carta é liberada quando você captura o HortaMon (“Ver todas” abre o modo galeria; “Virar todas” gira todas de uma vez). Para imprimir: `cartas.html?sheet=1` até `?sheet=8` (frente e verso lado a lado — recorte, dobre e cole).
- **Celular**: layout próprio para tela em pé e deitada, controles maiores e instalação como app (manifest + ícones).
- **Tela inicial viva**: os HortaMons passeiam num jardim animado atrás do logo; menu de jogo com Continuar (mostra onde você parou), Novo jogo, Álbum e Opções (navegável pelas setas do teclado).
- **Visual**: fontes Fredoka (títulos e botões) e Nunito (textos) embutidas; ícones desenhados no lugar dos emojis nos botões; menu de pausa em lista com resumo do progresso.

---

## 📁 Estrutura do Projeto

```text
teste-neon/
├── index.html              # Estrutura das telas, HUDs e modais
├── cartas.html             # Álbum de cartas (desbloqueia pelo save)
├── manifest.webmanifest    # Instalação como app no celular
├── icons/                  # Ícones do app (192 e 512 px)
├── fonts/                  # Fredoka e Nunito embutidas (licença OFL), funcionam sem internet
├── css/
│   └── style.css           # Visual cartoon colorido de jardim (otimizado para 1280×720)
├── js/
│   ├── data/
│   │   ├── types.js        # 6 tipos botânicos e matriz de efetividade
│   │   ├── moves.js        # 35 golpes originais com efeitos e partículas
│   │   ├── species.js      # 30 espécies, stats base, learnsets e evoluções
│   │   └── world.js        # Itens, mapa 60×26, prédios, 6 zonas e NPCs
│   ├── engine/
│   │   ├── audio.js        # Efeitos sonoros procedurais (Web Audio API)
│   │   ├── sprites.js      # Arte cartoon das 30 criaturas (e versões douradas), personagens e vasos
│   │   ├── save.js         # Criação de criaturas, XP/evolução, curas e localStorage
│   │   ├── battle.js       # Motor de batalha por turnos, partículas e captura
│   │   └── overworld.js    # Mapa 60fps, movimento, minimapa, NPCs e encontros
│   └── main.js             # Fluxo principal, HUD, diálogos, loja, caixa e BotaniDex
├── README.md
└── CONTEXT.md
```

---

## 🔄 Sincronização entre 2 PCs (Git & GitHub)

### Como baixar no segundo PC

1. Instale o Git e o GitHub CLI (`gh`) no Windows (sem precisar de permissão de administrador):
   ```powershell
   winget install --id Git.MinGit -e --scope user
   winget install --id GitHub.cli -e --scope user
   ```
2. Abra um novo terminal e conecte sua conta do GitHub:
   ```powershell
   gh auth login
   gh auth setup-git
   ```
3. Clone o repositório no segundo PC:
   ```powershell
   git clone https://github.com/Kimijoao77/teste-neon.git
   ```
4. Abra a pasta `teste-neon` no Antigravity e teste abrindo `index.html`.

### Fluxo diário de trabalho

- **Antes de começar em qualquer PC:**
  ```powershell
  git pull
  ```
- **Ao terminar de alterar arquivos:**
  ```powershell
  git add .
  git commit -m "resumo das alterações"
  git push
  ```
