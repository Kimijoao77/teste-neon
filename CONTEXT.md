# Contexto do Projeto — HortaMon (`teste-neon`)

Este arquivo registra a arquitetura, o estado atual e os próximos passos do projeto **HortaMon — Aventura Botânica** para facilitar a continuidade entre os 2 computadores sincronizados via GitHub (`Kimijoao77/teste-neon`).

---

## 🎯 Visão Geral

- **Projeto**: **HortaMon — Aventura Botânica**, RPG estilo Pokémon 100% original com criaturas inspiradas em frutas, verduras, legumes, raízes e fungos em estilo **cartoon colorido de jardim**.
- **Stack**: HTML5 + CSS3 + JavaScript vanilla com IIFE no namespace global `window.HortaMon` (`HM`) e `<script defer>` (sem ES modules, garantindo abertura direta via `file://` sem erros de CORS e sem dependências externas).
- **Save**: `localStorage` sob a chave `hortamon_save_v1`.

---

## ✅ Versão 1 (base — veja as mudanças da Versão 2 mais abaixo)

Todos os módulos principais foram implementados e integrados:

1. **Dados (`js/data/`)**
   - `types.js`: 6 tipos (`picante`, `folha`, `fresco`, `raiz`, `citrico`, `fungo`) e matriz balanceada (cada tipo vence 2 e resiste a 2).
   - `moves.js`: 29 golpes temáticos com efeitos (`burn`, `sleep`, `paralyze`, `atkUp`, `defUp`, `defDown`, `heal`, `drain`) e categorias de partículas.
   - `species.js`: 22 espécies originais (`HM.SPECIES` / `HM.SPECIES_LIST`), incluindo 3 linhas iniciais de 3 estágios (`pimentico`, `melancito`, `brocolino`), evoluções selvagens e o chefe `beterraboss`.
   - `world.js`: 5 itens (`vaso_comum`, `super_vaso`, `regador`, `super_regador`, `adubo_revive`), mapa 36×26 com 4 zonas (`vila`, `rota1`, `rota2`, `arena`), 4 prédios e 11 NPCs (Prof. Pomar, Enfermeira Rosa, Seu Bento, Terminal da Estufa, 2 placas, 4 treinadores e Líder Flora).
2. **Engines (`js/engine/`)**
   - `sprites.js`: renderização cartoon exclusiva das 22 criaturas (com cache offscreen `renderCreatureToDataURL`, silhuetas e status), 8 estilos de personagens e Vasos de Captura.
   - `audio.js`: 18 efeitos sonoros procedurais via Web Audio API com mute e desbloqueio seguro no primeiro gesto.
   - `save.js`: cálculo de stats, curva de XP, multi-level-up, aprendizado de golpes, evolução automática, curas/revive, registro da BotaniDex e persistência.
   - `battle.js`: batalha por turnos 60fps com cenários cartoon (jardim e Estufa Dourada), partículas, textos flutuantes, captura animada, STAB, críticos, status e IA tática.
   - `overworld.js`: exploração top-down 60fps com Y-sorting, prédios, minimapa, alerta de treinadores, grama alta animada com encontros ponderados e controles por teclado/clique/D-Pad.
3. **Interface & Fluxo (`index.html`, `css/style.css`, `js/main.js`)**
   - Layout cartoon de jardim ensolarado projetado para caber inteiro em 1280×720 sem rolagem incômoda.
   - Tela Inicial (Continuar/Novo Jogo + prévia do save), Escolha de Inicial com Prof. Pomar, Overworld com HUD/painel lateral/D-Pad/diálogos RPG, Arena de Batalha com badges `SUPER 2×` / `POUCO 0.5×`, modal comemorativo de Evolução e modais completos de Time, Mochila, Loja do Seu Bento, Caixa da Estufa, BotaniDex e Tabela de Tipos.

---

## 🧭 Contrato de Ordem de Scripts (`index.html`)

Manter sempre esta ordem de `<script defer>`:
1. `js/data/types.js`
2. `js/data/moves.js`
3. `js/data/species.js`
4. `js/data/world.js`
5. `js/engine/audio.js`
6. `js/engine/sprites.js`
7. `js/engine/save.js`
8. `js/engine/battle.js`
9. `js/engine/overworld.js`
10. `js/main.js`

---

## 🔁 Fluxo de Sync entre PC 1 e PC 2

- Sempre executar `git pull` antes de iniciar novas edições.
- Ao encerrar uma sessão: `git add .`, `git commit -m "..."` e `git push`.

## 🌟 Versão 2 (melhorias de 21/11/2026)

- **Tabela de tipos refeita** (`types.js`): ciclo `picante → fungo → folha → raiz → fresco → citrico → picante`; cada tipo vence os 2 seguintes e causa 0.5× nos 2 anteriores. Antes, os tipos funcionavam como 3 duplas idênticas.
- **Mapa 60×26** (`world.js`): colunas 36..58 são a região nova. Tiles novos: `12` areia, `13` coqueiro (sólido), `14` chão de caverna, `15` rocha (sólida), `16` canteiro sombrio (gera encontros). Zonas novas `pomar` (cena `tropical`) e `subterranea` (cena `caverna`).
- **NPCs com regras** (`world.js`):
  - `requires: { trainers: [...], badges: [...], text }` → líder só aceita desafio quando cumprido (Flora exige os 4 jardineiros das Rotas 1 e 2; Mandi exige a 1ª insígnia e os 4 jardineiros novos).
  - `hideIfBadge` → NPC some depois da insígnia (Guarda Tom na passagem a Leste da Rota 1).
  - `style` → visual do personagem (`guard`, `leader2`); `healSpot` → onde o jogador volta ao perder (salvo em `state.lastHealSpot`).
  - `questBefore` / `questReady` → textos do "Objetivo Atual".
- **8 espécies novas** (23..30): Bananinja, Abacatinho → Abacatão (Nv. 16), Cocoral, Rabanito, Trufim → Trufante (Nv. 16), Mandiocão. 6 golpes novos.
- **XP do time** (`battle.js`): participantes ganham 50%; com o item-chave `adubo_compartilhado` (`kind: 'key'`), todo o time ganha 50%.
- **Dourados**: `creature.golden = true` (chance 1/64 em `main.js`); `Sprites.drawCreature(..., { golden })` e `renderCreatureToDataURL(id, size, silhouette, golden)`.
- **Save**: `HM.exportSaveData(state)` / `HM.importSaveData(texto)` em `save.js`; botões no Menu e na tela inicial.
- **Celular**: regras no fim de `style.css` (toque, celular em pé e deitado).
- **Beterraboss** ficou raro na natureza (peso 3, captura 0.15).

## 💡 Ideias para Futuras Expansões

- Terceira Arena e Liga dos Jardineiros.
- Conquistas extras (ex.: capturar todos os Dourados de um tipo).
