# Contexto do Projeto — HortaMon (`teste-neon`)

Este arquivo registra a arquitetura, o estado atual e os próximos passos do projeto **HortaMon — Aventura Botânica** para facilitar a continuidade entre os 2 computadores sincronizados via GitHub (`Kimijoao77/teste-neon`).

---

## 🎯 Visão Geral

- **Projeto**: **HortaMon — Aventura Botânica**, RPG estilo Pokémon 100% original em visual **HD-2D 3D (Three.js WebGL offline) / 2.5D Cartoon de Jardim**, atualmente na **Versão 3.0** com **24 espécies / 8 famílias** inspiradas na fauna brasileira (araras azuis, verdes e vermelhas, micos-leões, capivaras, tamanduás, gatos-maracajás voltaicos e cães caramelos).
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
6. `js/data/animal-art.js`
7. `js/data/family-art.js`
8. `js/engine/sprites.js`
9. `js/engine/save.js`
10. `js/engine/scenery.js`
11. `js/vendor/three.min.js`
12. `js/engine/hd2d-core.js`
13. `js/engine/battle-3d.js`
14. `js/engine/battle.js`
15. `js/engine/overworld-3d.js`
16. `js/engine/overworld.js`
17. `js/main.js`

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
- **Álbum de cartas giratórias** (`cartas.html`): `.tcard > .flip-inner > .face-front / .face-back`; a classe `.flipped` gira a carta (CSS 3D). Cartas nunca vistas ficam cinza; vistas mostram silhueta. Modo impressão `?sheet=N` mostra 4 pares frente|verso por folha.

## 🎨 Versão 2.2 — tela inicial e menus

- Tela inicial: `<canvas id="title-scene">` desenhado por `drawTitleScene()` em `main.js` (só roda enquanto a tela de título está ativa). Menu com `.menu-item`; Opções em `openOptionsModal()`.
- Menu de pausa (`openMenuModal`) e Opções usam `.menu-list` / `.menu-row`.
- Ícones SVG: `icon(nome)` em `main.js` (`team`, `bag`, `book`, `types`, `save`, `sound`, `mute`, `menu`); os da barra do mapa estão direto no `index.html`.
- Fontes em `/fonts` com `@font-face` no topo do `style.css`: `--font-display` (Fredoka) e `--font-main` (Nunito).

## 🦜 Versão 2.6 — Fauna Brasileira: 24 Espécies / 8 Famílias (22/11/2026)

- **Catálogo unificado de 24 espécies em 8 famílias de 3 estágios** (`Filhote → Jovem Nv. 7 → Adulto Nv. 14`) em `js/data/species.js`, com ilustrações embutidas em `js/data/animal-art.js` e `js/data/family-art.js`:
  1. **Arara Azul** (`folha`, inicial): `voara` → `azurara` → `ararazul` (#001–#003)
  2. **Mico-Leão** (`picante`, inicial): `pequemico` → `micorado` → `douraleao` (#004–#006)
  3. **Capivara** (`fresco`, inicial): `capi` → `varacapi` → `capilorde` (#007–#009)
  4. **Tamanduá** (`raiz`): `tamandui` → `tamirim` → `lutandua` (#010–#012)
  5. **Felino Voltaico** (`voltaico`): `magato` → `maragaiato` → `amatirica` (#013–#015)
  6. **Cão Caramelo** (`neutro`): `caramelo` → `caralata` → `viramelo` (#016–#018)
  7. **Arara Verde** (`folha`, nova!): `verdara` → `floreara` → `matarara` (#019–#021)
  8. **Arara Vermelha** (`picante`, nova!): `rubiara` → `brasara` → `escarlara` (#022–#024)
- **Tipos & Golpes**: 8 tipos em `types.js` (ciclo original + `voltaico` e `neutro`) e 53 golpes em `moves.js`.
- **Álbum de Cartas (`cartas.html`)**: 24 cartas giratórias (8 famílias no modo galeria), filtro por tipo mostrando apenas tipos com espécies ativas (6 tipos somando 24 cartas), verso ajustado para `neutro` (`Nenhum`) e espaçamento refinado sem corte de texto, e modo impressão dinâmico em **6 folhas** (`?sheet=1` até `?sheet=6`, 4 pares frente|verso por folha).

## ✨ Versão 3.0 — Upgrade HD-2D 3D (Three.js WebGL Offline)

- **Three.js local (zero CDN / 100% `file://`)**: `js/vendor/three.min.js` (r147 UMD global `window.THREE`) + `js/engine/hd2d-core.js` (`HM.HD2D` com detecção segura de WebGL, persistência `hortamon_3d_enabled`, 14 texturas pictóricas, standees HD-2D com sombra direcional, Sky Dome e 5 presets de bioma).
- **Arquitetura de 2 camadas em `index.html` e `css/style.css`**:
  - `.overworld-3d-layer` posicionada absolutamente atrás de `#overworld-canvas` dentro de `.canvas-frame` (`z-index: 1` vs `z-index: 2` transparente para HUD 2D, minimapa e badges projetados).
  - `.battle-canvas-wrap` encapsulando `#battle-canvas` na linha 2 de `.battle-stage` para alinhamento pixel-a-pixel de `.battle-3d-layer` sem invadir as placas de HUD da linha 1 (desktop 1280×720, celular em pé e deitado).
  - Vinhetas cinematográficas sutis, placas de HUD de batalha refinadas e overlay rápido `#battle-transition` (~240ms) ao entrar em combate.
- **Toggle de Gráficos (`js/main.js`)**: disponível em **Opções** (Tela Inicial) e no **Menu de Pausa**, alternando ao vivo entre **HD-2D 3D (WebGL)** e **2.5D Clássico** via `HM.HD2D.setEnabled(bool)` (com estado desabilitado e aviso amigável caso WebGL não esteja disponível).

## 💡 Ideias para Futuras Expansões

- Terceira Arena e Liga dos Jardineiros.
- Conquistas extras (ex.: capturar todos os Dourados de um tipo).
