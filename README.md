# 🌱 HortaMon — Aventura Botânica

**HortaMon** é um RPG estilo Pokémon 100% original em visual **cartoon colorido de jardim**, estrelado por **24 criaturas inspiradas na fauna brasileira** (8 famílias de 3 estágios: araras azuis, verdes e vermelhas, micos-leões, capivaras, tamanduás, gatos-maracajás voltaicos e cães caramelos). Feito em HTML5, CSS3 e JavaScript puro (sem dependências externas e sem servidor obrigatório), abre direto pelo navegador via `index.html`.

---

## 🌐 Jogar Online (PC ou celular)

**https://kimijoao77.github.io/teste-neon/** (precisa do GitHub Pages ligado em *Settings → Pages → Branch `main` / root*).

No celular, abra o link no Chrome e use **⋮ → Adicionar à tela inicial** para instalar como app.

---

## 🎮 Como Jogar (Abrir Localmente)

1. Abra a pasta do projeto (`teste-neon`).
2. Dê um clique duplo em **`index.html`** para abrir diretamente no navegador (Chrome, Edge ou Firefox — funciona via `file://`, sem necessidade de servidor ou internet).
3. Clique em **Começar Aventura** (ou **Continuar Aventura** caso já tenha progresso salvo) e escolha seu inicial com o **Prof. Pomar**:
   - 🥦 **Voara** (*Folha*) — evolui para **Azurara** e **Ararazul**
   - 🌶️ **Pequemico** (*Picante*) — evolui para **Micorado** e **Douraleão**
   - 🍉 **Capi** (*Fresco*) — evolui para **Varacapi** e **Capilorde**

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

- **24 HortaMons com ilustrações próprias em 8 famílias de 3 formas** (`Filhote → Jovem Nv. 7 → Adulto Nv. 14`) nas batalhas, na BotaniDex e no [álbum completo](https://kimijoao77.github.io/teste-neon/cartas.html?galeria=todas), com versões **✨ Douradas** raríssimas (1 em 64 encontros):
  - 🥦 **Folha**: `Voara → Azurara → Ararazul` (Arara Azul) e `Verdara → Floreara → Matarara` (Arara Verde)
  - 🌶️ **Picante**: `Pequemico → Micorado → Douraleão` (Mico-Leão) e `Rubiara → Brasara → Escarlara` (Arara Vermelha)
  - 🍉 **Fresco**: `Capi → Varacapi → Capilorde` (Capivara)
  - 🥕 **Raiz**: `Tamanduí → Tamirim → Lutanduá` (Tamanduá)
  - ⚡ **Voltaico**: `Magato → Maragaiato → Amatirica` (Felino Voltaico)
  - ◉ **Neutro**: `Caramelo → Caralata → Viramelo` (Cão Caramelo)
- **Três opções de inicial**. Voara, Pequemico e Capi (assim como os filhotes das outras 5 famílias) também podem ser capturados na Rota 1 e evoluem nos níveis 7 e 14.
- **Sistema de tipos**: 6 tipos em ciclo (`🌶️ Picante → 🍄 Fungo → 🥦 Folha → 🥕 Raiz → 🍉 Fresco → 🍋 Cítrico → 🌶️`, cada um vence os 2 seguintes com 2× e causa 0.5× nos 2 anteriores) + **⚡ Voltaico** (vence Fresco, sofre contra Raiz) e **◉ Neutro** (dano equilibrado). O triângulo dos iniciais continua: Picante > Folha > Fresco > Picante.
- **Mundo de 60×26 tiles em 6 áreas**:
  - **Vila da Horta**: Lab do Prof. Pomar, Estufa de Cura, Loja do Seu Bento e Terminal da Estufa.
  - **Rota 1 — Canteiro Ensolarado** (Nv. 2–5) e **Rota 2 — Bosque dos Esporos** (Nv. 5–9), com 4 jardineiros.
  - **Arena da Estufa Dourada**: a **Líder Flora** só aceita o desafio depois que você vence os 4 jardineiros.
  - **Pomar Tropical** (Nv. 10–15): liberado pelo **Guarda Tom** depois da 1ª insígnia; tem o **Posto do Pomar** (cura e loja) e 2 jardineiros.
  - **Horta Subterrânea** (Nv. 13–17): caverna com canteiros sombrios, 2 jardineiros e a **Arena da Raiz Profunda** do **Líder Mandi** (Nv. 17–20).
- **Gráficos HD-2D 3D (WebGL / Three.js offline)**: mapa diorama 3D completo (60×26 com prédios, árvores frutíferas, coqueiros, água animada, cristais bioluminescentes e iluminação dinâmica por bioma) e arenas de batalha 3D cinematográficas com câmera dinâmica e Vaso de Captura 3D — 100% compatível com `file://` e sem CDN externo! Você pode alternar a qualquer momento entre **HD-2D 3D (WebGL)** e **2.5D Clássico** em **Opções** (ou no **Menu de Pausa**), com fallback automático caso o navegador não suporte WebGL.
- **Batalha por turnos animada** com cenários de jardim, Estufa Dourada, pomar tropical e caverna, transição cinematográfica, captura, evolução e IA tática.
- **XP para o time**: quem entra no meio da luta ganha metade do XP; com o **Adubo Compartilhado** (presente do Prof. Pomar quando você tem 2 HortaMons) o time inteiro ganha.
- **Apelidos** (botão ✏️ no Time), **BotaniDex**, **Caixa da Estufa** e **Tabela de Tipos**.
- **Save**: automático no navegador (`localStorage`, chave `hortamon_save_v1`) e **Exportar/Importar Save** em arquivo `.json` (Menu) para levar o progresso entre PCs e celular. Os saves botânicos convertem as criaturas da equipe e do depósito por tipo e estágio.
- **Álbum de Cartas** (`cartas.html`): **24 cartas giratórias** (8 famílias) — a frente mostra só o personagem e, ao tocar, a carta vira e mostra a ficha (stats, golpes, forte/fraco contra). Cada carta é liberada quando você captura o HortaMon (“Ver todas” abre o modo galeria agrupado por família; “Virar todas” gira todas de uma vez). Para imprimir: `cartas.html?sheet=1` até `?sheet=6` (4 pares frente e verso por folha — recorte, dobre e cole).
- **Celular**: layout próprio para tela em pé e deitada, controles maiores e instalação como app (manifest + ícones).
- **Tela inicial viva**: os três iniciais aparecem em destaque diante do jardim animado; menu de jogo com Continuar (mostra onde você parou), Novo jogo, Álbum e Opções (navegável pelas setas do teclado).
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
│   │   ├── types.js        # Tipos e matriz de efetividade (ciclo + Voltaico e Neutro)
│   │   ├── moves.js        # 53 golpes originais com efeitos e partículas
│   │   ├── species.js      # 24 espécies (8 famílias × 3 estágios), stats base e learnsets
│   │   ├── animal-art.js   # Ilustrações das famílias iniciais (arara azul, mico e capivara)
│   │   ├── family-art.js   # Ilustrações das demais famílias (tamanduá, voltaico, caramelo, arara verde e arara vermelha)
│   │   └── world.js        # Itens, mapa 60×26, prédios, 6 zonas e NPCs
│   ├── vendor/
│   │   └── three.min.js    # Three.js r147 UMD local (100% offline / file://)
│   ├── engine/
│   │   ├── audio.js        # Efeitos sonoros procedurais (Web Audio API)
│   │   ├── sprites.js      # Arte das 24 criaturas (e versões douradas), personagens e vasos
│   │   ├── save.js         # Criação de criaturas, XP/evolução, curas e localStorage
│   │   ├── scenery.js      # Cenários animados da tela inicial e batalhas 2.5D
│   │   ├── hd2d-core.js    # Núcleo HD-2D WebGL (texturas, standees, sky dome e biomas)
│   │   ├── battle-3d.js    # Arena de batalha 3D cinematográfica (5 biomas e vaso 3D)
│   │   ├── battle.js       # Motor de batalha por turnos, partículas e captura
│   │   ├── overworld-3d.js # Diorama 3D 60×26 do mapa com InstancedMesh e raycasting
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
