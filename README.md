# 🌱 HortaMon — Aventura Botânica

**HortaMon** é um RPG estilo Pokémon 100% original em visual **cartoon colorido de jardim**, estrelado por frutas, verduras, legumes, raízes e fungos colecionáveis. Feito em HTML5, CSS3 e JavaScript puro (sem dependências externas e sem servidor obrigatório), abre direto pelo navegador via `index.html`.

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

---

## ✨ Recursos Implementados

- **22 HortaMons originais em arte cartoon procedural (`Canvas 2D`)**: cada espécie possui desenho exclusivo, olhos expressivos, animação suave, sombras e efeitos de status (`Queimado`, `Dormindo`, `Paralisado`).
- **6 Tipos Botânicos balanceados**: `Picante 🌶️`, `Folha 🥦`, `Fresco 🍉`, `Raiz 🥕`, `Cítrico 🍋` e `Fungo 🍄` — cada tipo vence 2 (2×) e resiste a 2 (0.5×), com **selo tático automático** (`SUPER 2×` / `POUCO 0.5×`) nos golpes em batalha.
- **Mundo explorável top-down (36×26 tiles, 60 fps)**:
  - **Vila da Horta**: Lab do Prof. Pomar, **Estufa de Cura** (Enfermeira Rosa cura 100% do time), **Loja de Sementes** (Seu Bento vende Vasos, Regadores e Adubo Vital) e **Terminal da Estufa** (Caixa de Depósito).
  - **Rota 1 — Canteiro Ensolarado**: grama alta (Nv. 2–5) e 2 jardineiros desafiantes.
  - **Rota 2 — Bosque dos Esporos**: grama alta (Nv. 5–9) e 2 treinadores avançados.
  - **Arena da Estufa Dourada**: enfrente a **Líder Flora** pela **Insígnia da Colheita Dourada** (com suporte a revanche!).
- **Batalha por turnos animada**: partículas temáticas por elemento, textos flutuantes de dano/crítico/efetividade, animação completa do **Vaso de Captura** / **Super Vaso**, sistema de XP, novos golpes, **modal comemorativo de evolução** e IA inteligente.
- **Qualidade de Vida**: BotaniDex interativa com silhuetas, filtros e linha evolutiva; gerenciamento de líder do time; uso de itens dentro e fora da batalha; áudio procedural via Web Audio API; salvamento automático em `localStorage` (`hortamon_save_v1`).

---

## 📁 Estrutura do Projeto

```text
teste-neon/
├── index.html              # Estrutura das telas, HUDs e modais
├── css/
│   └── style.css           # Visual cartoon colorido de jardim (otimizado para 1280×720)
├── js/
│   ├── data/
│   │   ├── types.js        # 6 tipos botânicos e matriz de efetividade
│   │   ├── moves.js        # 29 golpes originais com efeitos e partículas
│   │   ├── species.js      # 22 espécies, stats base, learnsets e evoluções
│   │   └── world.js        # Itens, mapa 36×26, prédios, zonas e 11 NPCs
│   ├── engine/
│   │   ├── audio.js        # Efeitos sonoros procedurais (Web Audio API)
│   │   ├── sprites.js      # Arte cartoon das 22 criaturas, personagens e vasos
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
