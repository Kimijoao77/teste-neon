(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  const STARTER_IDS = ['pimentico', 'melancito', 'brocolino'];

  const STATUS_META = {
    burn: { label: '🔥 Queimado', cls: 'status-burn' },
    sleep: { label: '💤 Dormindo', cls: 'status-sleep' },
    paralyze: { label: '⚡ Paralisado', cls: 'status-paralyze' }
  };

  // Estado da camada de interface
  const ui = {
    screen: 'title',
    state: null,
    overworldReady: false,
    modal: null, // { kind, onClose }
    dialogue: null, // { npc, lines, index, actions, onFinish }
    battleTab: 'fight',
    battleSnapshot: null,
    battleNpc: null,
    pendingBattleItem: null,
    evoResolver: null,
    evoLockedUntil: 0,
    selectedPartyIdx: 0,
    selectedDexId: 'pimentico',
    dexFilter: 'all',
    pendingBagItem: null
  };

  // Referências DOM preenchidas em init()
  const dom = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function audio(fn, ...args) {
    try {
      if (HM.Audio && typeof HM.Audio[fn] === 'function') {
        return HM.Audio[fn](...args);
      }
    } catch (_) {
      // Ignora erros de áudio em navegadores restritivos
    }
    return undefined;
  }

  // Ícones desenhados em SVG (traço na cor do texto) — substituem os emojis dos botões
  const ICON_PATHS = {
    team: '<path d="M12 21c-4-2-7-5.5-7-10 3 0 5.5 1.5 7 4 1.5-2.5 4-4 7-4 0 4.5-3 8-7 10z"/><path d="M12 15V9"/><circle cx="12" cy="6" r="2.5"/>',
    bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 13h6"/>',
    book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/>',
    types: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="2"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="5" rx="1"/>',
    sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 10l4 4M21 10l-4 4"/>',
    menu: '<path d="M5 7h14M5 12h14M5 17h14"/>'
  };

  function icon(name) {
    return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
  }

  function applyToolbarIcons() {
    const set = (id, name, label) => {
      const el = $(id);
      if (el) el.innerHTML = label ? `${icon(name)}<span>${label}</span>` : icon(name);
    };
    set('btn-open-party', 'team', 'Time');
    set('btn-open-bag', 'bag', 'Mochila');
    set('btn-open-dex', 'book', 'BotaniDex');
    set('btn-open-types', 'types', 'Tipos');
    set('btn-save-game', 'save', 'Salvar');
    set('btn-open-menu', 'menu', 'Menu');
    set('btn-battle-types', 'types', 'Tipos');
  }

  function spriteUrl(speciesId, size, silhouette, golden) {
    try {
      if (HM.Sprites && typeof HM.Sprites.renderCreatureToDataURL === 'function') {
        return HM.Sprites.renderCreatureToDataURL(speciesId, size || 96, !!silhouette, !!golden);
      }
    } catch (_) {}
    return '';
  }

  function drawCharOnCanvas(canvas, style, size) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      if (HM.Sprites && typeof HM.Sprites.drawCharacter === 'function') {
        HM.Sprites.drawCharacter(ctx, canvas.width / 2, canvas.height * 0.56, size || 40, style || 'prof', 'down', 0);
      }
    } catch (_) {}
  }

  function ensureStateShape(st) {
    if (!st) return null;
    if (!st.player) {
      const sp = (HM.WORLD && HM.WORLD.spawn) || { x: 7, y: 18, dir: 'down' };
      st.player = { x: sp.x, y: sp.y, dir: sp.dir || 'down' };
    }
    if (!Array.isArray(st.party)) st.party = [];
    if (!Array.isArray(st.box)) st.box = [];
    if (!st.bag || typeof st.bag !== 'object') st.bag = {};
    if (!Array.isArray(st.badges)) st.badges = [];
    if (!st.defeatedTrainers || typeof st.defeatedTrainers !== 'object') st.defeatedTrainers = {};
    if (!st.dex || typeof st.dex !== 'object') st.dex = { seen: {}, caught: {} };
    if (!st.dex.seen || typeof st.dex.seen !== 'object') st.dex.seen = {};
    if (!st.dex.caught || typeof st.dex.caught !== 'object') st.dex.caught = {};
    if (typeof st.coins !== 'number') st.coins = 0;
    return st;
  }

  function isSpeciesSeen(speciesId) {
    const st = ui.state;
    if (!st || !st.dex) return false;
    return !!(st.dex.seen && st.dex.seen[speciesId]) || !!(st.dex.caught && st.dex.caught[speciesId]);
  }

  function isSpeciesCaught(speciesId) {
    const st = ui.state;
    if (!st || !st.dex || !st.dex.caught) return false;
    return !!st.dex.caught[speciesId];
  }

  function countDex(st) {
    const target = st || ui.state;
    const total = (HM.SPECIES_LIST && HM.SPECIES_LIST.length) || 22;
    if (!target || !target.dex) return { seen: 0, caught: 0, total };
    const seen = Object.keys(target.dex.seen || {}).filter((k) => target.dex.seen[k]).length;
    const caught = Object.keys(target.dex.caught || {}).filter((k) => target.dex.caught[k]).length;
    return { seen: Math.max(seen, caught), caught, total };
  }

  function isTrainerDefeated(npcId) {
    const st = ui.state;
    if (!st || !st.defeatedTrainers) return false;
    if (Array.isArray(st.defeatedTrainers)) return st.defeatedTrainers.includes(npcId);
    return !!st.defeatedTrainers[npcId];
  }

  // Retorna null se o NPC pode ser desafiado, ou {done,total,text} se falta algo
  function getUnmetRequirement(npc) {
    const req = npc && npc.requires;
    if (!req) return null;
    const st = ui.state || {};
    if (Array.isArray(req.badges)) {
      const owned = Array.isArray(st.badges) ? st.badges : [];
      const have = req.badges.filter((b) => owned.indexOf(b) !== -1).length;
      if (have < req.badges.length) {
        return { done: have, total: req.badges.length, text: req.badgeText || req.text || 'Você ainda precisa de mais insígnias.' };
      }
    }
    if (Array.isArray(req.trainers)) {
      const done = req.trainers.filter((id) => isTrainerDefeated(id)).length;
      if (done < req.trainers.length) {
        return { done, total: req.trainers.length, text: req.text || 'Vença os jardineiros das rotas primeiro!' };
      }
    }
    return null;
  }

  function markTrainerDefeated(npcId) {
    const st = ui.state;
    if (!st || !npcId) return;
    if (Array.isArray(st.defeatedTrainers)) {
      if (!st.defeatedTrainers.includes(npcId)) st.defeatedTrainers.push(npcId);
    } else {
      st.defeatedTrainers = st.defeatedTrainers || {};
      st.defeatedTrainers[npcId] = true;
    }
  }

  function getCreatureName(creature) {
    if (!creature) return 'HortaMon';
    const sp = HM.SPECIES && HM.SPECIES[creature.speciesId];
    return creature.nickname || (sp ? sp.name : creature.speciesId);
  }

  // Nome com a marca ✨ dos HortaMons Dourados (HTML seguro)
  function nameHtml(creature) {
    const mark = creature && creature.golden ? '<span class="golden-mark" title="HortaMon Dourado">✨</span>' : '';
    return mark + escapeHtml(getCreatureName(creature));
  }

  function getHpClass(pct) {
    if (pct > 50) return 'hp-high';
    if (pct > 20) return 'hp-mid';
    return 'hp-low';
  }

  function renderTypeChipHtml(typeId) {
    const t = HM.TYPES && HM.TYPES[typeId];
    if (!t) return `<span class="type-chip">${escapeHtml(typeId)}</span>`;
    return `<span class="type-chip" style="--t-bg:${t.bg};--t-color:${t.dark};--t-border:${t.color};">${t.icon} ${escapeHtml(t.name)}</span>`;
  }

  function renderStatusChipHtml(creature) {
    if (!creature) return '';
    if (creature.hp <= 0) {
      return '<span class="status-chip status-fainted">💫 Desmaiado</span>';
    }
    const meta = creature.status && STATUS_META[creature.status];
    if (!meta) return '';
    return `<span class="status-chip ${meta.cls}">${meta.label}</span>`;
  }

  function renderStageTagsHtml(stages) {
    if (!stages) return '';
    const out = [];
    if (stages.atk) {
      const sign = stages.atk > 0 ? `+${stages.atk}` : `${stages.atk}`;
      out.push(`<span class="stage-tag ${stages.atk > 0 ? 'stage-up' : 'stage-down'}">ATK ${sign}</span>`);
    }
    if (stages.def) {
      const sign = stages.def > 0 ? `+${stages.def}` : `${stages.def}`;
      out.push(`<span class="stage-tag ${stages.def > 0 ? 'stage-up' : 'stage-down'}">DEF ${sign}</span>`);
    }
    return out.join('');
  }

  function getItemList() {
    if (!HM.ITEMS) return [];
    const order = ['vaso_comum', 'super_vaso', 'regador', 'super_regador', 'adubo_revive', 'adubo_compartilhado'];
    const result = [];
    order.forEach((id) => {
      if (HM.ITEMS[id]) result.push(HM.ITEMS[id]);
    });
    Object.keys(HM.ITEMS).forEach((id) => {
      if (!order.includes(id)) result.push(HM.ITEMS[id]);
    });
    return result;
  }

  // =========================================================================
  // TOASTS E SOM
  // =========================================================================

  function showToast(text, tone) {
    if (!dom.toastContainer) return;
    const el = document.createElement('div');
    el.className = 'toast' + (tone ? ` toast-${tone}` : '');
    el.textContent = text;
    dom.toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 280);
    }, 2900);
  }

  function syncSoundButtons() {
    const muted = !!(HM.Audio && HM.Audio.muted);
    const svg = icon(muted ? 'mute' : 'sound');
    if (dom.btnToggleSound) dom.btnToggleSound.innerHTML = svg;
    if (dom.btnBattleSound) dom.btnBattleSound.innerHTML = svg;
    const pill = $('opt-sound-state');
    if (pill) {
      pill.textContent = muted ? 'Desligado' : 'Ligado';
      pill.classList.toggle('off', muted);
    }
  }

  function toggleSound() {
    audio('unlock');
    audio('toggleMute');
    syncSoundButtons();
    if (!(HM.Audio && HM.Audio.muted)) {
      audio('playSelect');
    }
  }

  // =========================================================================
  // TROCA DE TELAS
  // =========================================================================

  function showScreen(name) {
    ui.screen = name;
    const map = {
      title: dom.screenTitle,
      starter: dom.screenStarter,
      overworld: dom.screenOverworld,
      battle: dom.screenBattle
    };
    Object.keys(map).forEach((k) => {
      if (map[k]) map[k].classList.toggle('active', k === name);
    });
  }

  // =========================================================================
  // TELA 1: TÍTULO
  // =========================================================================

  function renderTitleScreen() {
    const countPill = $('title-count-pill');
    if (countPill) countPill.textContent = `${(HM.SPECIES_LIST || []).length} HortaMons para descobrir`;
    startTitleScene();

    const saveExists = typeof HM.hasSave === 'function' && HM.hasSave();
    const saved = saveExists ? ensureStateShape(typeof HM.loadGame === 'function' ? HM.loadGame() : null) : null;
    if (saved && saved.party && saved.party.length > 0) {
      const dex = countDex(saved);
      const zoneObj =
        HM.WORLD && HM.WORLD.zones && HM.WORLD.zones[saved.zone] ? HM.WORLD.zones[saved.zone] : { name: 'Vila da Horta' };
      const zoneName = zoneObj.name.split(' — ')[0];
      const badges = (saved.badges || []).length;
      const partyImgs = saved.party
        .slice(0, 3)
        .map((c) => `<img src="${spriteUrl(c.speciesId, 52, false, c.golden)}" alt="" />`)
        .join('');
      dom.titleSavePreview.innerHTML = `${partyImgs}<span>${escapeHtml(zoneName)} · ${badges} ${badges === 1 ? 'insígnia' : 'insígnias'} · ${dex.caught}/${dex.total}</span>`;
      dom.titleSavePreview.classList.remove('hidden');
      dom.btnContinue.classList.remove('hidden');
    } else {
      dom.btnContinue.classList.add('hidden');
      dom.titleSavePreview.classList.add('hidden');
    }
  }

  // ---------------------------------------------------------------------------
  // Cenário animado da tela inicial: jardim com HortaMons passeando
  // ---------------------------------------------------------------------------
  const titleScene = {
    running: false,
    raf: 0,
    clouds: [
      { x: 0.12, y: 0.14, s: 1.1, v: 0.006 },
      { x: 0.55, y: 0.08, s: 0.8, v: 0.004 },
      { x: 0.86, y: 0.2, s: 1.3, v: 0.007 }
    ],
    // x em fração da largura, d = profundidade (0 fundo, 1 frente), walk = velocidade
    mons: [
      { id: 'brocolino', x: 0.16, d: 0.55, walk: 0 },
      { id: 'pimentico', x: 0.3, d: 0.9, walk: 0.012 },
      { id: 'melancito', x: 0.78, d: 0.75, walk: 0 },
      { id: 'cenourito', x: 0.62, d: 0.35, walk: -0.009 },
      { id: 'cogumim', x: 0.9, d: 0.95, walk: 0 },
      { id: 'limoninho', x: 0.45, d: 0.2, walk: 0.007 },
      { id: 'bananinja', x: 0.05, d: 0.25, walk: 0 }
    ]
  };

  function startTitleScene() {
    const canvas = $('title-scene');
    if (!canvas || titleScene.running) return;
    titleScene.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (ui.screen !== 'title' || !titleScene.running) {
        titleScene.running = false;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drawTitleScene(canvas, now, dt);
      titleScene.raf = requestAnimationFrame(loop);
    };
    titleScene.raf = requestAnimationFrame(loop);
  }

  function drawTitleScene(canvas, now, dt) {
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const W = global.innerWidth;
    const H = global.innerHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = now / 1000;
    const horizon = H * 0.62;

    // Céu
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#7cc8f2');
    sky.addColorStop(1, '#d9f4dd');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // Sol
    const sx = W * 0.84;
    const sy = H * 0.15;
    const glow = c.createRadialGradient(sx, sy, 10, sx, sy, 110);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
    glow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    c.fillStyle = glow;
    c.fillRect(sx - 110, sy - 110, 220, 220);
    c.fillStyle = '#fde047';
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(sx, sy, 34, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Nuvens
    titleScene.clouds.forEach((cl) => {
      cl.x += cl.v * dt;
      if (cl.x > 1.2) cl.x = -0.2;
      drawTitleCloud(c, cl.x * W, cl.y * H, cl.s * Math.max(0.7, W / 1400));
    });

    // Colinas
    const hill = (yTop, color, amp, phase) => {
      c.fillStyle = color;
      c.strokeStyle = '#2b1d14';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-10, H);
      c.lineTo(-10, yTop);
      for (let x = 0; x <= W + 20; x += 20) {
        c.lineTo(x, yTop - Math.sin(x / (W * 0.22) + phase) * amp - Math.sin(x / (W * 0.09) + phase * 2) * amp * 0.25);
      }
      c.lineTo(W + 10, H);
      c.closePath();
      c.fill();
      c.stroke();
    };
    hill(horizon - H * 0.12, '#a7e08a', H * 0.05, 0.6);
    hill(horizon - H * 0.03, '#86d26a', H * 0.035, 2.1);

    // Árvores no horizonte
    [0.07, 0.24, 0.69, 0.95].forEach((fx, k) => drawTitleTree(c, fx * W, horizon - H * 0.03, 26 + k * 3, t + k));

    // Campo
    const field = c.createLinearGradient(0, horizon, 0, H);
    field.addColorStop(0, '#79c94f');
    field.addColorStop(1, '#5aae3b');
    c.fillStyle = field;
    c.fillRect(0, horizon, W, H - horizon);
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, horizon);
    c.lineTo(W, horizon);
    c.stroke();

    // Cerquinha
    c.fillStyle = '#c98f55';
    c.lineWidth = 2.5;
    const fenceY = horizon + 6;
    for (let x = 12; x < W; x += 46) {
      c.beginPath();
      c.rect(x, fenceY - 26, 10, 30);
      c.fill();
      c.stroke();
    }
    c.beginPath();
    c.rect(0, fenceY - 18, W, 7);
    c.fill();
    c.stroke();

    // HortaMons (do fundo para a frente)
    if (HM.Sprites && typeof HM.Sprites.drawCreature === 'function') {
      const base = W > H ? Math.min(W, H * 1.6) : W * 1.55;
      titleScene.mons
        .slice()
        .sort((a, b) => a.d - b.d)
        .forEach((m, k) => {
          if (m.walk) {
            m.x += m.walk * dt;
            if (m.x > 1.1) m.x = -0.1;
            if (m.x < -0.1) m.x = 1.1;
          }
          const y = horizon + 26 + m.d * (H - horizon - 70);
          const size = base * (0.085 + m.d * 0.07);
          const hop = m.walk ? Math.abs(Math.sin(t * 6 + k)) * size * 0.08 : 0;
          HM.Sprites.drawCreature(c, m.id, m.x * W, y - size * 0.35 - hop, size, {
            time: now + k * 700,
            facing: m.walk < 0 ? 'left' : 'right',
            shadow: true
          });
        });
    }

    // Tufos de grama na frente
    c.strokeStyle = '#2f7d24';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    for (let x = 20; x < W; x += 64) {
      const gy = H - 14 - ((x * 7) % 30);
      const sway = Math.sin(t * 2 + x) * 3;
      c.beginPath();
      c.moveTo(x, gy);
      c.quadraticCurveTo(x - 4, gy - 10, x - 7 + sway, gy - 16);
      c.moveTo(x, gy);
      c.quadraticCurveTo(x + 1, gy - 12, x + sway, gy - 20);
      c.moveTo(x, gy);
      c.quadraticCurveTo(x + 5, gy - 9, x + 9 + sway, gy - 14);
      c.stroke();
    }
  }

  function drawTitleCloud(c, x, y, s) {
    const shapes = (ctx) => {
      ctx.beginPath();
      ctx.arc(-26, 6, 18, 0, Math.PI * 2);
      ctx.moveTo(26, -4);
      ctx.arc(0, -4, 26, 0, Math.PI * 2);
      ctx.moveTo(46, 6);
      ctx.arc(28, 6, 18, 0, Math.PI * 2);
      ctx.moveTo(-40, 10);
      ctx.roundRect ? ctx.roundRect(-44, 4, 90, 20, 10) : ctx.rect(-44, 4, 90, 20);
    };
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    // 1) contorno grosso de todas as formas; 2) preenchimento por cima esconde os traços internos
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 6;
    c.lineJoin = 'round';
    shapes(c);
    c.stroke();
    c.fillStyle = '#ffffff';
    shapes(c);
    c.fill();
    c.restore();
  }

  function drawTitleTree(c, x, y, r, t) {
    const sway = Math.sin(t * 0.8) * 1.5;
    c.save();
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 2.5;
    c.fillStyle = '#8b5a2b';
    c.beginPath();
    c.rect(x - 5, y - r * 0.9, 10, r * 0.9);
    c.fill();
    c.stroke();
    c.fillStyle = '#2f9e44';
    c.beginPath();
    c.arc(x - r * 0.55 + sway, y - r * 1.05, r * 0.62, 0, Math.PI * 2);
    c.arc(x + r * 0.55 + sway, y - r * 1.05, r * 0.62, 0, Math.PI * 2);
    c.arc(x + sway, y - r * 1.55, r * 0.72, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#f87171';
    [[-0.5, -1.1], [0.35, -1.5], [0.6, -0.95]].forEach((p) => {
      c.beginPath();
      c.arc(x + p[0] * r + sway, y + p[1] * r, 3.2, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  }

  // Setas do teclado navegam pelo menu da tela inicial
  function handleTitleMenuKeys(ev) {
    if (ui.screen !== 'title' || ui.modal) return;
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const items = Array.from(document.querySelectorAll('.title-menu .menu-item')).filter(
      (el) => !el.classList.contains('hidden')
    );
    if (items.length === 0) return;
    ev.preventDefault();
    const idx = items.indexOf(document.activeElement);
    const next = ev.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[idx < 0 ? 0 : next].focus();
    audio('playSelect');
  }

  function openOptionsModal() {
    audio('playSelect');
    const muted = !!(HM.Audio && HM.Audio.muted);
    openModal({ kind: 'options', title: 'Opções', sizeClass: 'modal-narrow' });
    dom.modalBody.innerHTML = `
      <div class="menu-list">
        <button type="button" class="menu-row" id="opt-sound">Som <span id="opt-sound-state" class="toggle-pill${muted ? ' off' : ''}">${muted ? 'Desligado' : 'Ligado'}</span></button>
        <button type="button" class="menu-row" id="opt-help">Como jogar</button>
        <button type="button" class="menu-row" id="opt-types">Tabela de tipos</button>
        <button type="button" class="menu-row" id="opt-import">Importar save <small>arquivo .json</small></button>
      </div>
    `;
    $('opt-sound').addEventListener('click', () => toggleSound());
    $('opt-help').addEventListener('click', () => {
      closeModal(true);
      openHelpModal();
    });
    $('opt-types').addEventListener('click', () => {
      closeModal(true);
      openTypesModal();
    });
    $('opt-import').addEventListener('click', () => {
      closeModal(true);
      askImportSave();
    });
  }

  function handleContinueGame() {
    audio('unlock');
    audio('playSelect');
    const loaded = ensureStateShape(typeof HM.loadGame === 'function' ? HM.loadGame() : null);
    if (!loaded || !loaded.party || loaded.party.length === 0) {
      showToast('Não foi possível carregar o save. Escolha seu inicial!', 'error');
      openStarterScreen();
      return;
    }
    ui.state = loaded;
    enterOverworld();
    showToast('🌿 Bem-vindo de volta, jardineiro!', 'success');
  }

  function handleNewGameClick() {
    audio('unlock');
    audio('playSelect');
    const saveExists = typeof HM.hasSave === 'function' && HM.hasSave();
    if (saveExists) {
      openConfirmModal({
        title: 'Começar do zero?',
        message: 'Você já tem uma aventura salva. Se escolher um inicial novo, o progresso antigo será apagado.',
        confirmLabel: 'Começar do zero',
        confirmClass: 'btn-sun',
        onConfirm: () => openStarterScreen()
      });
    } else {
      openStarterScreen();
    }
  }

  // =========================================================================
  // TELA 2: ESCOLHA DE INICIAL
  // =========================================================================

  function openStarterScreen() {
    showScreen('starter');
    drawCharOnCanvas(dom.profAvatarCanvas, 'prof', 48);

    const cardsHtml = STARTER_IDS.map((id) => {
      const sp = HM.SPECIES && HM.SPECIES[id];
      if (!sp) return '';
      const t = (HM.TYPES && HM.TYPES[sp.type]) || { bg: '#fef9c3', color: '#22c55e', dark: '#166534', icon: '🌱', name: sp.type };
      const chart = (HM.TYPE_CHART && HM.TYPE_CHART[sp.type]) || {};
      const strongAgainst = Object.keys(chart)
        .filter((k) => chart[k] >= 2)
        .map((k) => {
          const dt = HM.TYPES && HM.TYPES[k];
          return dt ? `${dt.icon} ${dt.name}` : k;
        })
        .join(' e ');

      const stats = sp.baseStats || { hp: 50, atk: 50, def: 50, spd: 50 };
      const statBar = (label, val, color) => {
        const pct = Math.min(100, Math.round((val / 85) * 100));
        return `
          <div class="mini-stat-row">
            <span class="mini-stat-label">${label}</span>
            <div class="mini-stat-bar">
              <div class="mini-stat-fill" style="width:${pct}%;background:${color};"></div>
            </div>
          </div>
        `;
      };

      return `
        <article class="starter-card" data-starter-id="${escapeHtml(id)}" style="--card-tint:${t.bg};">
          <div class="starter-art-box">
            <img src="${spriteUrl(id, 144, false)}" alt="${escapeHtml(sp.name)}" />
          </div>
          <div class="starter-head">
            <h3>${escapeHtml(sp.name)}</h3>
            ${renderTypeChipHtml(sp.type)}
          </div>
          <p class="starter-title-sub">${escapeHtml(sp.title || '')}</p>
          <p class="starter-desc">${escapeHtml(sp.desc || '')}</p>
          <div class="starter-stats">
            ${statBar('HP', stats.hp, '#22c55e')}
            ${statBar('ATK', stats.atk, '#ef4444')}
            ${statBar('DEF', stats.def, '#f59e0b')}
            ${statBar('VEL', stats.spd, '#38bdf8')}
          </div>
          <div class="starter-adv">Forte contra: ${escapeHtml(strongAgainst || 'Equilibrado')}</div>
          <button type="button" class="btn btn-primary btn-sm" data-choose-starter="${escapeHtml(id)}">
            Escolher ${escapeHtml(sp.name)}
          </button>
        </article>
      `;
    }).join('');

    dom.starterGrid.innerHTML = cardsHtml;
    dom.starterGrid.querySelectorAll('[data-starter-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const starterId = card.getAttribute('data-starter-id');
        pickStarter(starterId);
      });
    });
  }

  function pickStarter(starterId) {
    audio('unlock');
    audio('playVictory');
    if (typeof HM.clearSave === 'function') HM.clearSave();
    ui.state = ensureStateShape(HM.createNewState(starterId));
    if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
    const sp = HM.SPECIES && HM.SPECIES[starterId];
    enterOverworld();
    showToast(`🎉 ${sp ? sp.name : 'Seu HortaMon'} entrou para o seu time!`, 'gold');
  }

  // =========================================================================
  // TELA 3: OVERWORLD & HUD
  // =========================================================================

  function enterOverworld() {
    closeModal(true);
    closeDialogue(true);
    showScreen('overworld');

    if (HM.Overworld) {
      if (!ui.overworldReady) {
        HM.Overworld.init({
          canvas: dom.overworldCanvas,
          state: ui.state,
          callbacks: {
            onZoneChange: handleZoneChange,
            onEncounter: handleWildEncounter,
            onNpcInteract: handleNpcInteract
          }
        });
        ui.overworldReady = true;
      } else {
        HM.Overworld.setState(ui.state);
        HM.Overworld.resume();
      }
    }

    refreshOverworldHud();
  }

  function handleZoneChange(zone) {
    if (!zone) return;
    if (ui.state) ui.state.zone = zone.id;
    updateZoneDisplay(zone);
  }

  function updateZoneDisplay(zone) {
    let z = zone;
    if (!z && HM.WORLD && ui.state && ui.state.player && typeof HM.WORLD.getZoneAt === 'function') {
      z = HM.WORLD.getZoneAt(ui.state.player.x, ui.state.player.y);
    }
    if (!z && HM.WORLD && HM.WORLD.zones && ui.state && ui.state.zone) {
      z = HM.WORLD.zones[ui.state.zone];
    }
    if (z) {
      dom.hudZoneName.textContent = z.name || 'Vila da Horta';
      dom.hudZoneSub.textContent = z.subtitle || 'Jardim ensolarado';
    }
  }

  function computeQuestHint(st) {
    if (!st) return 'Explore a Vila da Horta!';
    const dex = countDex(st);
    const maxLv = st.party.reduce((acc, c) => Math.max(acc, c.level || 1), 1);
    const owned = Array.isArray(st.badges) ? st.badges : [];

    if (dex.caught <= 1 && maxLv < 6 && owned.length === 0) {
      return 'Siga para a grama alta da Rota 1 para capturar novos HortaMons e subir de nível! Use a Estufa de Cura quando precisar.';
    }

    // Próximo líder ainda sem insígnia (na ordem do mundo)
    const leaders = ((HM.WORLD && HM.WORLD.npcs) || []).filter((n) => n.role === 'leader' && n.badge);
    const next = leaders.find((n) => owned.indexOf(n.badge) === -1);
    if (next) {
      const unmet = getUnmetRequirement(next);
      if (unmet) {
        const tpl = next.questBefore || 'Vença os jardineiros das rotas ({done}/{total}) para poder desafiar {leader}!';
        return tpl.replace('{done}', unmet.done).replace('{total}', unmet.total).replace('{leader}', next.name);
      }
      return (next.questReady || 'Sua equipe está pronta! Desafie {leader} pela {badge}!')
        .replace('{leader}', next.name)
        .replace('{badge}', next.badge);
    }

    if (dex.caught >= dex.total) {
      return '🌟 Mestre Botânico Supremo! Todas as insígnias e 100% da BotaniDex! Agora cace HortaMons ✨ Dourados (1 em 64 encontros).';
    }
    return `🏆 Todas as insígnias conquistadas! Complete a BotaniDex (${dex.caught}/${dex.total}) e procure HortaMons ✨ Dourados na grama alta.`;
  }

  function refreshOverworldHud() {
    const st = ui.state;
    if (!st) return;
    updateZoneDisplay();
    const dex = countDex(st);
    dom.hudCoins.textContent = String(st.coins || 0);
    dom.hudBadges.textContent = String((st.badges || []).length);
    dom.hudDex.textContent = `${dex.caught}/${dex.total}`;
    dom.questText.textContent = computeQuestHint(st);
    renderSidebarParty();
  }

  function renderSidebarParty() {
    const st = ui.state;
    if (!st || !dom.sidebarPartyList) return;
    dom.sidebarPartyCount.textContent = String(st.party.length);

    dom.sidebarPartyList.innerHTML = st.party
      .map((c, idx) => {
        const hpPct = c.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((c.hp / c.maxHp) * 100))) : 0;
        const xpPct = c.xpNext > 0 ? Math.max(0, Math.min(100, Math.round(((c.xp || 0) / c.xpNext) * 100))) : 0;
        const leaderMark = idx === 0 ? '⭐ ' : '';
        const faintedCls = c.hp <= 0 ? ' is-fainted' : '';
        const leaderCls = idx === 0 ? ' is-leader' : '';
        const statusShort =
          c.hp <= 0
            ? ' 💫'
            : c.status === 'burn'
              ? ' 🔥'
              : c.status === 'sleep'
                ? ' 💤'
                : c.status === 'paralyze'
                  ? ' ⚡'
                  : '';

        return `
          <div class="side-mon-row${leaderCls}${faintedCls}" data-party-idx="${idx}" title="Clique para ver detalhes de ${escapeHtml(getCreatureName(c))}">
            <img class="side-mon-avatar" src="${spriteUrl(c.speciesId, 56, false, c.golden)}" alt="${escapeHtml(getCreatureName(c))}" />
            <div class="side-mon-info">
              <div class="side-mon-top">
                <span class="side-mon-name">${leaderMark}${escapeHtml(getCreatureName(c))}${statusShort}</span>
                <span class="side-mon-lv">Nv.${c.level}</span>
              </div>
              <div class="side-mon-bars">
                <div class="side-hp-line">
                  <div class="bar-track bar-sm">
                    <div class="bar-fill ${getHpClass(hpPct)}" style="width:${hpPct}%"></div>
                  </div>
                  <span class="side-hp-num">${c.hp}/${c.maxHp}</span>
                </div>
                <div class="bar-track bar-xp">
                  <div class="bar-fill xp-fill" style="width:${xpPct}%"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    dom.sidebarPartyList.querySelectorAll('[data-party-idx]').forEach((row) => {
      row.addEventListener('click', () => {
        const idx = Number(row.getAttribute('data-party-idx')) || 0;
        openPartyModal(idx);
      });
    });
  }

  // =========================================================================
  // DIÁLOGO RPG & INTERAÇÃO COM NPCS
  // =========================================================================

  function normalizeLines(val, fallback) {
    if (Array.isArray(val) && val.length > 0) return val.map(String);
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [fallback || 'Olá, jardineiro!'];
  }

  function showDialogue({ npc, lines, actions, onFinish }) {
    if (HM.Overworld) HM.Overworld.pause();
    ui.dialogue = {
      npc,
      lines: normalizeLines(lines),
      index: 0,
      actions: actions || null,
      onFinish: onFinish || null,
      openedAt: Date.now()
    };
    drawCharOnCanvas(dom.dialoguePortrait, (npc && (npc.style || npc.role)) || 'prof', 38);
    dom.dialogueSpeaker.textContent = (npc && npc.name) || 'Aviso';
    dom.dialogueBox.classList.remove('hidden');
    renderDialoguePage();
  }

  function renderDialoguePage() {
    const d = ui.dialogue;
    if (!d) return;
    const isLast = d.index >= d.lines.length - 1;
    dom.dialogueText.textContent = d.lines[d.index] || '';
    dom.dialoguePage.textContent = `${d.index + 1}/${d.lines.length}`;
    dom.dialogueActions.innerHTML = '';

    if (isLast && Array.isArray(d.actions) && d.actions.length > 0) {
      dom.dialogueNextHint.classList.add('hidden');
      d.actions.forEach((act) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn btn-xs ${act.cls || 'btn-cream'}`;
        btn.textContent = act.label;
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          audio('playSelect');
          closeDialogue(true);
          if (typeof act.onClick === 'function') act.onClick();
        });
        dom.dialogueActions.appendChild(btn);
      });
    } else {
      dom.dialogueNextHint.classList.remove('hidden');
      dom.dialogueNextHint.textContent = isLast ? '▼ Fechar (Espaço)' : '▼ Continuar (Espaço)';
    }
  }

  function advanceDialogue() {
    const d = ui.dialogue;
    if (!d) return;
    if (d.openedAt && Date.now() - d.openedAt < 140) return;
    const isLast = d.index >= d.lines.length - 1;
    if (!isLast) {
      d.index += 1;
      audio('playSelect');
      renderDialoguePage();
      return;
    }
    // Se tem ações na última página, o botão principal pode ser acionado por Espaço/Enter
    if (Array.isArray(d.actions) && d.actions.length > 0) {
      const primary = d.actions[0];
      audio('playSelect');
      closeDialogue(true);
      if (primary && typeof primary.onClick === 'function') primary.onClick();
      return;
    }
    const finishCb = d.onFinish;
    audio('playSelect');
    closeDialogue(false);
    if (typeof finishCb === 'function') finishCb();
  }

  function closeDialogue(keepPaused) {
    ui.dialogue = null;
    if (dom.dialogueBox) dom.dialogueBox.classList.add('hidden');
    if (!keepPaused && ui.screen === 'overworld' && !ui.modal && HM.Overworld) {
      HM.Overworld.resume();
    }
  }

  function handleNpcInteract(npc) {
    if (!npc || ui.modal || ui.dialogue || ui.screen !== 'overworld') return;
    audio('playSelect');

    switch (npc.role) {
      case 'healer': {
        showDialogue({
          npc,
          lines: normalizeLines(
            npc.dialogue,
            'Bem-vindo à Estufa de Cura! Deixe seus HortaMons descansarem um pouquinho sob nossa luz solar...'
          ),
          onFinish: () => {
            if (npc.healSpot) ui.state.lastHealSpot = Object.assign({}, npc.healSpot);
            else if (HM.WORLD && HM.WORLD.healSpot) ui.state.lastHealSpot = Object.assign({}, HM.WORLD.healSpot);
            if (typeof HM.healParty === 'function') HM.healParty(ui.state);
            if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
            audio('playHeal');
            refreshOverworldHud();
            showToast('💚 Time 100% revitalizado!', 'success');
          }
        });
        break;
      }

      case 'shop': {
        showDialogue({
          npc,
          lines: normalizeLines(
            npc.dialogue,
            'Olá, jovem jardineiro! Tenho vasos mágicos, regadores fresquinhos e adubo vital para sua jornada!'
          ),
          actions: [
            {
              label: '🛒 Abrir Loja',
              cls: 'btn-sun',
              onClick: () => openShopModal()
            },
            {
              label: 'Agora não',
              cls: 'btn-cream',
              onClick: () => HM.Overworld && HM.Overworld.resume()
            }
          ]
        });
        break;
      }

      case 'box': {
        showDialogue({
          npc,
          lines: normalizeLines(
            npc.dialogue,
            'Terminal da Estufa ativado! Aqui você pode organizar os HortaMons do seu Time e do Depósito.'
          ),
          actions: [
            {
              label: '📦 Abrir Caixa da Estufa',
              cls: 'btn-sky',
              onClick: () => openBoxModal()
            },
            {
              label: 'Sair',
              cls: 'btn-cream',
              onClick: () => HM.Overworld && HM.Overworld.resume()
            }
          ]
        });
        break;
      }

      case 'trainer':
      case 'leader': {
        const defeated = isTrainerDefeated(npc.id);
        const unmet = defeated ? null : getUnmetRequirement(npc);
        if (unmet) {
          showDialogue({
            npc,
            lines: [`${unmet.text} (${unmet.done}/${unmet.total})`]
          });
          break;
        }
        if (!defeated) {
          showDialogue({
            npc,
            lines: normalizeLines(
              npc.dialogue,
              npc.role === 'leader'
                ? `Bem-vindo à ${npc.arenaName || 'Arena'}! Mostre a força do seu jardim!`
                : 'Ei! Nossos olhares se cruzaram! Vamos duelar com nossos HortaMons!'
            ),
            actions: [
              {
                label: npc.role === 'leader' ? '👑 Desafiar Mestra!' : '⚔️ Aceitar Duelo!',
                cls: 'btn-primary',
                onClick: () => launchTrainerBattle(npc)
              },
              {
                label: 'Preparar antes',
                cls: 'btn-cream',
                onClick: () => HM.Overworld && HM.Overworld.resume()
              }
            ]
          });
        } else if (npc.role === 'leader') {
          showDialogue({
            npc,
            lines: normalizeLines(
              npc.defeatedDialogue,
              `Parabéns novamente pela ${npc.badge || 'Insígnia'}! Quer treinar comigo em uma revanche?`
            ),
            actions: [
              {
                label: '🔄 Pedir Revanche!',
                cls: 'btn-sun',
                onClick: () => launchTrainerBattle(npc)
              },
              {
                label: 'Até logo!',
                cls: 'btn-cream',
                onClick: () => HM.Overworld && HM.Overworld.resume()
              }
            ]
          });
        } else {
          showDialogue({
            npc,
            lines: normalizeLines(
              npc.defeatedDialogue,
              'Que batalha incrível! Seus HortaMons estão muito bem cuidados!'
            )
          });
        }
        break;
      }

      case 'prof': {
        const st = ui.state;
        st.bag = st.bag || {};
        const total = (st.party || []).length + (st.box || []).length;
        const hasShare = (st.bag.adubo_compartilhado || 0) > 0;
        if (!hasShare && total >= 2) {
          showDialogue({
            npc,
            lines: [
              'Olha só, você já tem um time de verdade! Tome este presente: o Adubo Compartilhado. 🌻',
              'Enquanto ele estiver na sua mochila, os HortaMons que não lutaram também ganham metade do XP de cada vitória. Ótimo para treinar os mais fraquinhos!'
            ],
            onFinish: () => {
              st.bag.adubo_compartilhado = 1;
              if (typeof HM.saveGame === 'function') HM.saveGame(st);
              audio('playVictory');
              showToast('🌻 Você recebeu o Adubo Compartilhado!', 'gold');
              refreshOverworldHud();
            }
          });
        } else if (!hasShare) {
          showDialogue({
            npc,
            lines: normalizeLines(npc.dialogue, 'Olá, jovem jardineiro!').concat([
              'Ah, e capture um segundo HortaMon e volte aqui: tenho um presente que ajuda a treinar o time inteiro!'
            ])
          });
        } else {
          showDialogue({
            npc,
            lines: normalizeLines(npc.dialogue, 'Continue explorando a Vila da Horta e suas rotas!')
          });
        }
        break;
      }

      default: {
        showDialogue({
          npc,
          lines: normalizeLines(npc.dialogue, 'Continue explorando a Vila da Horta e suas rotas!')
        });
        break;
      }
    }
  }

  function hasAliveCreature() {
    return !!(ui.state && ui.state.party && ui.state.party.some((c) => c.hp > 0));
  }

  function launchTrainerBattle(npc) {
    if (!hasAliveCreature()) {
      showToast('Todos os seus HortaMons estão cansados! Visite a Estufa de Cura.', 'error');
      if (HM.Overworld) HM.Overworld.resume();
      return;
    }
    const specs = Array.isArray(npc.party) && npc.party.length > 0 ? npc.party : [{ speciesId: 'cenourito', level: 4 }];
    const enemyParty = specs.map((p) => HM.createCreature(p.speciesId, p.level));
    startBattle({
      type: npc.role === 'leader' ? 'leader' : 'trainer',
      enemyParty,
      trainerNpc: npc,
      scene: npc.scene || getSceneAt(npc.x, npc.y)
    });
  }

  const GOLDEN_CHANCE = 1 / 64;

  function getSceneAt(x, y) {
    const zone = HM.WORLD && typeof HM.WORLD.getZoneAt === 'function' ? HM.WORLD.getZoneAt(x, y) : null;
    return (zone && zone.scene) || 'jardim';
  }

  function handleWildEncounter(wildCreature, zone) {
    if (!wildCreature || ui.screen !== 'overworld') return;
    if (!hasAliveCreature()) {
      if (typeof HM.healParty === 'function') HM.healParty(ui.state);
      showToast('💚 Seu time foi revitalizado!', 'success');
    }
    if (Math.random() < GOLDEN_CHANCE) wildCreature.golden = true;
    const p = (ui.state && ui.state.player) || { x: 0, y: 0 };
    startBattle({
      type: 'wild',
      enemyParty: [wildCreature],
      trainerNpc: null,
      scene: (zone && zone.scene) || getSceneAt(p.x, p.y)
    });
  }

  // =========================================================================
  // TELA 4: BATALHA POR TURNOS
  // =========================================================================

  function startBattle({ type, enemyParty, trainerNpc, scene }) {
    closeModal(true);
    closeDialogue(true);
    if (HM.Overworld) HM.Overworld.pause();

    ui.battleTab = 'fight';
    ui.pendingBattleItem = null;
    ui.battleNpc = trainerNpc || null;
    ui.battleSnapshot = null;

    showScreen('battle');

    if (type === 'leader') {
      dom.battleTypeBadge.className = 'pill pill-sun';
      dom.battleTypeBadge.textContent = `👑 ${(trainerNpc && trainerNpc.arenaName) || 'Arena'}`;
      dom.battleHeaderTitle.textContent = trainerNpc ? trainerNpc.name : 'Líder da Arena';
    } else if (type === 'trainer') {
      dom.battleTypeBadge.className = 'pill pill-berry';
      dom.battleTypeBadge.textContent = '⚔️ Duelo de Jardineiros';
      dom.battleHeaderTitle.textContent = trainerNpc ? trainerNpc.name : 'Treinador Rival';
    } else {
      const lead = enemyParty && enemyParty[0];
      const sp = lead && HM.SPECIES && HM.SPECIES[lead.speciesId];
      dom.battleTypeBadge.className = lead && lead.golden ? 'pill pill-sun' : 'pill pill-leaf';
      dom.battleTypeBadge.textContent = lead && lead.golden ? '✨ Encontro Dourado!' : '🌿 Batalha Selvagem';
      dom.battleHeaderTitle.textContent = sp ? `${sp.name} ${lead.golden ? 'dourado' : 'selvagem'}` : 'Encontro na Grama Alta';
    }

    if (HM.Battle && typeof HM.Battle.start === 'function') {
      HM.Battle.start({
        state: ui.state,
        type,
        enemyParty,
        trainerNpc,
        scene: scene || 'jardim',
        canvas: dom.battleCanvas,
        callbacks: {
          onStateChange: handleBattleStateChange,
          onEvolution: handleBattleEvolution,
          onFinished: handleBattleFinished
        }
      });
    }
  }

  function handleBattleStateChange(snapshot) {
    if (!snapshot) return;
    ui.battleSnapshot = snapshot;

    // HUD Inimigo
    const enemy = snapshot.enemyCreature;
    if (enemy) {
      const esp = HM.SPECIES && HM.SPECIES[enemy.speciesId];
      const et = esp && HM.TYPES && HM.TYPES[esp.type];
      dom.enemyName.textContent = (enemy.golden ? '✨ ' : '') + getCreatureName(enemy);
      dom.enemyLevel.textContent = `Nv. ${enemy.level}`;
      dom.enemyCaughtMark.classList.toggle('hidden', !(snapshot.isWild && isSpeciesCaught(enemy.speciesId)));
      if (et) {
        dom.enemyTypeBadge.style.setProperty('--t-bg', et.bg);
        dom.enemyTypeBadge.style.setProperty('--t-color', et.dark);
        dom.enemyTypeBadge.style.setProperty('--t-border', et.color);
        dom.enemyTypeBadge.textContent = `${et.icon} ${et.name}`;
      }

      const enemyStatusHtml = renderStatusChipHtml(enemy);
      if (enemyStatusHtml) {
        dom.enemyStatusBadge.className = enemy.hp <= 0 ? 'status-chip status-fainted' : `status-chip ${STATUS_META[enemy.status].cls}`;
        dom.enemyStatusBadge.textContent = enemy.hp <= 0 ? '💫 Desmaiado' : STATUS_META[enemy.status].label;
      } else {
        dom.enemyStatusBadge.className = 'status-chip hidden';
      }

      dom.enemyStages.innerHTML = renderStageTagsHtml(snapshot.enemyStages);

      if (!snapshot.isWild && snapshot.enemyPartyTotal > 1) {
        const dots = [];
        for (let i = 0; i < snapshot.enemyPartyTotal; i++) {
          const alive = i < snapshot.enemyPartyAlive;
          dots.push(`<span class="party-dot${alive ? '' : ' fainted'}"></span>`);
        }
        dom.enemyPartyDots.innerHTML = dots.join('');
        dom.enemyPartyDots.classList.remove('hidden');
      } else {
        dom.enemyPartyDots.classList.add('hidden');
      }

      const ePct = enemy.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100))) : 0;
      dom.enemyHpFill.style.width = `${ePct}%`;
      dom.enemyHpFill.className = `bar-fill ${getHpClass(ePct)}`;
      dom.enemyHpText.textContent = `${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
    }

    // HUD Jogador
    const player = snapshot.playerCreature;
    if (player) {
      const psp = HM.SPECIES && HM.SPECIES[player.speciesId];
      const pt = psp && HM.TYPES && HM.TYPES[psp.type];
      dom.playerName.textContent = (player.golden ? '✨ ' : '') + getCreatureName(player);
      dom.playerLevel.textContent = `Nv. ${player.level}`;
      if (pt) {
        dom.playerTypeBadge.style.setProperty('--t-bg', pt.bg);
        dom.playerTypeBadge.style.setProperty('--t-color', pt.dark);
        dom.playerTypeBadge.style.setProperty('--t-border', pt.color);
        dom.playerTypeBadge.textContent = `${pt.icon} ${pt.name}`;
      }

      const playerStatusHtml = renderStatusChipHtml(player);
      if (playerStatusHtml) {
        dom.playerStatusBadge.className = player.hp <= 0 ? 'status-chip status-fainted' : `status-chip ${STATUS_META[player.status].cls}`;
        dom.playerStatusBadge.textContent = player.hp <= 0 ? '💫 Desmaiado' : STATUS_META[player.status].label;
      } else {
        dom.playerStatusBadge.className = 'status-chip hidden';
      }

      dom.playerStages.innerHTML = renderStageTagsHtml(snapshot.playerStages);

      const pPct = player.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((player.hp / player.maxHp) * 100))) : 0;
      dom.playerHpFill.style.width = `${pPct}%`;
      dom.playerHpFill.className = `bar-fill ${getHpClass(pPct)}`;
      dom.playerHpText.textContent = `${Math.max(0, player.hp)}/${player.maxHp}`;

      const xpPct = player.xpNext > 0 ? Math.max(0, Math.min(100, Math.round(((player.xp || 0) / player.xpNext) * 100))) : 0;
      dom.playerXpFill.style.width = `${xpPct}%`;
    }

    // Narração
    dom.battleMessage.textContent = snapshot.message || 'O que você vai fazer?';
    dom.battleBusyDots.classList.toggle('hidden', !snapshot.busy);

    // Força aba de troca quando mustSwitch está ativo
    if (snapshot.mustSwitch) {
      ui.battleTab = 'party';
      ui.pendingBattleItem = null;
    }

    // Atualiza botões das abas
    const locked = snapshot.busy || snapshot.ended;
    dom.btabFight.disabled = locked || snapshot.mustSwitch;
    dom.btabBag.disabled = locked || snapshot.mustSwitch;
    dom.btabParty.disabled = locked;
    dom.btabRun.disabled = locked || snapshot.mustSwitch || !snapshot.isWild;
    dom.btabRun.title = snapshot.isWild ? 'Tentar fugir da batalha' : 'Não é possível fugir de uma batalha contra treinador!';

    dom.btabFight.classList.toggle('active', ui.battleTab === 'fight');
    dom.btabBag.classList.toggle('active', ui.battleTab === 'bag');
    dom.btabParty.classList.toggle('active', ui.battleTab === 'party');

    renderBattleActionPane();
  }

  function renderBattleActionPane() {
    const snap = ui.battleSnapshot;
    if (!snap || !dom.battleActionPane) return;

    const disabled = snap.busy || snap.ended;

    if (ui.battleTab === 'fight') {
      const pc = snap.playerCreature;
      const ec = snap.enemyCreature;
      const enemySp = ec && HM.SPECIES && HM.SPECIES[ec.speciesId];
      const moves = (pc && Array.isArray(pc.moves) ? pc.moves : []);
      const anyPp = moves.some((m) => m.pp > 0);

      if (!anyPp) {
        dom.battleActionPane.innerHTML = `
          <div class="moves-grid">
            <button type="button" class="move-card" data-move-idx="0" ${disabled ? 'disabled' : ''}>
              <div class="move-card-top">
                <span class="move-name">🌿 Esforço Botânico</span>
                <span class="move-eff-badge eff-status">RESERVA</span>
              </div>
              <div class="move-card-bottom">
                <span>Sem PP restante</span>
                <span>Poder 35</span>
              </div>
            </button>
          </div>
        `;
      } else {
        dom.battleActionPane.innerHTML = `
          <div class="moves-grid">
            ${moves
              .map((m, idx) => {
                const def = (HM.MOVES && HM.MOVES[m.id]) || {
                  name: m.id,
                  type: 'raiz',
                  category: 'attack',
                  power: 40,
                  accuracy: 100,
                  desc: ''
                };
                const t = (HM.TYPES && HM.TYPES[def.type]) || { bg: '#fef6df', color: '#8b5a2b', dark: '#2b1d14', icon: '🌿', name: def.type };
                let effBadge = '';
                if (def.category === 'status') {
                  effBadge = '<span class="move-eff-badge eff-status">STATUS</span>';
                } else if (enemySp && typeof HM.getTypeEffectiveness === 'function') {
                  const eff = HM.getTypeEffectiveness(def.type, enemySp.type);
                  if (eff >= 2) {
                    effBadge = '<span class="move-eff-badge eff-super">SUPER 2×</span>';
                  } else if (eff <= 0.5) {
                    effBadge = '<span class="move-eff-badge eff-weak">POUCO 0.5×</span>';
                  }
                }
                const outOfPp = m.pp <= 0;
                const tooltip = `${def.desc || ''} (Precisão: ${def.accuracy || 100}%)`.trim();

                return `
                  <button
                    type="button"
                    class="move-card"
                    style="--m-bg:${t.bg};"
                    data-move-idx="${idx}"
                    title="${escapeHtml(tooltip)}"
                    ${disabled || outOfPp ? 'disabled' : ''}
                  >
                    <div class="move-card-top">
                      <span class="move-name">${escapeHtml(def.name)}</span>
                      ${effBadge}
                    </div>
                    <div class="move-card-bottom">
                      ${renderTypeChipHtml(def.type)}
                      <span class="move-meta-right">
                        <span>${def.category === 'attack' ? `Poder ${def.power}` : 'Efeito'}</span>
                        <strong>PP ${m.pp}/${m.maxPp}</strong>
                      </span>
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        `;
      }

      dom.battleActionPane.querySelectorAll('[data-move-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (snap.busy || snap.ended) return;
          const idx = Number(btn.getAttribute('data-move-idx'));
          audio('playSelect');
          HM.Battle && HM.Battle.useMove(idx);
        });
      });
      return;
    }

    if (ui.battleTab === 'bag') {
      if (ui.pendingBattleItem) {
        const item = HM.ITEMS && HM.ITEMS[ui.pendingBattleItem];
        dom.battleActionPane.innerHTML = `
          <div class="battle-pane-header">
            <span>Escolha o alvo para ${item ? `${item.icon} ${escapeHtml(item.name)}` : 'o item'}:</span>
            <button type="button" id="btn-cancel-battle-item" class="btn btn-cream btn-xs">← Voltar</button>
          </div>
          <div class="battle-party-grid">
            ${(ui.state.party || [])
              .map((c, idx) => {
                const isRevive = item && item.kind === 'revive';
                const canUse = isRevive
                  ? c.hp <= 0
                  : c.hp > 0 && (c.hp < c.maxHp || (ui.pendingBattleItem === 'super_regador' && !!c.status));
                const hpPct = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
                return `
                  <button
                    type="button"
                    class="battle-party-btn"
                    data-use-target="${idx}"
                    ${disabled || !canUse ? 'disabled' : ''}
                  >
                    <img src="${spriteUrl(c.speciesId, 48, false, c.golden)}" alt="${escapeHtml(getCreatureName(c))}" />
                    <div class="battle-party-info">
                      <strong>${nameHtml(c)}</strong>
                      <small>HP ${c.hp}/${c.maxHp} ${c.hp <= 0 ? '💫' : ''}</small>
                      <div class="bar-track bar-sm">
                        <div class="bar-fill ${getHpClass(hpPct)}" style="width:${hpPct}%"></div>
                      </div>
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        `;

        const cancelBtn = $('btn-cancel-battle-item');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            audio('playCancel');
            ui.pendingBattleItem = null;
            renderBattleActionPane();
          });
        }

        dom.battleActionPane.querySelectorAll('[data-use-target]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if (snap.busy || snap.ended) return;
            const targetIdx = Number(btn.getAttribute('data-use-target'));
            const itemId = ui.pendingBattleItem;
            ui.pendingBattleItem = null;
            ui.battleTab = 'fight';
            audio('playSelect');
            HM.Battle && HM.Battle.useItem(itemId, targetIdx);
          });
        });
        return;
      }

      const items = getItemList().filter((it) => it.kind !== 'key' && (ui.state.bag[it.id] || 0) > 0);
      if (items.length === 0) {
        dom.battleActionPane.innerHTML =
          '<p style="margin:0;text-align:center;font-weight:800;color:var(--ink-soft);">Sua mochila está vazia! Visite a Loja do Seu Bento na Vila da Horta.</p>';
        return;
      }

      dom.battleActionPane.innerHTML = `
        <div class="battle-items-grid">
          ${items
            .map((it) => {
              const qty = ui.state.bag[it.id] || 0;
              const isCatch = it.kind === 'catch';
              const blocked = disabled || (isCatch && !snap.isWild);
              const sub = isCatch && !snap.isWild ? 'Só em selvagens' : it.desc;
              return `
                <button
                  type="button"
                  class="battle-item-btn"
                  data-battle-item="${escapeHtml(it.id)}"
                  title="${escapeHtml(it.desc)}"
                  ${blocked ? 'disabled' : ''}
                >
                  <span class="battle-item-icon">${it.icon}</span>
                  <div class="battle-item-meta">
                    <strong>${escapeHtml(it.name)}</strong>
                    <small>${escapeHtml(sub)}</small>
                  </div>
                  <span class="battle-qty">×${qty}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      `;

      dom.battleActionPane.querySelectorAll('[data-battle-item]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (snap.busy || snap.ended) return;
          const itemId = btn.getAttribute('data-battle-item');
          const item = HM.ITEMS && HM.ITEMS[itemId];
          if (!item) return;
          audio('playSelect');
          if (item.kind === 'catch') {
            ui.battleTab = 'fight';
            HM.Battle && HM.Battle.useItem(itemId);
          } else {
            ui.pendingBattleItem = itemId;
            renderBattleActionPane();
          }
        });
      });
      return;
    }

    if (ui.battleTab === 'party') {
      const banner = snap.mustSwitch
        ? '<div class="must-switch-banner">⚡ Seu HortaMon desmaiou! Escolha o próximo parceiro para entrar na arena:</div>'
        : '';
      dom.battleActionPane.innerHTML = `
        ${banner}
        <div class="battle-party-grid">
          ${(ui.state.party || [])
            .map((c, idx) => {
              const isActive = idx === snap.playerPartyIndex;
              const isFainted = c.hp <= 0;
              const hpPct = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
              const statusTxt = isActive ? 'Em campo' : isFainted ? 'Desmaiado' : `Nv.${c.level} • ${c.hp}/${c.maxHp}`;
              return `
                <button
                  type="button"
                  class="battle-party-btn${isActive ? ' is-active' : ''}"
                  data-switch-idx="${idx}"
                  ${disabled || isActive || isFainted ? 'disabled' : ''}
                >
                  <img src="${spriteUrl(c.speciesId, 48, false, c.golden)}" alt="${escapeHtml(getCreatureName(c))}" />
                  <div class="battle-party-info">
                    <strong>${nameHtml(c)}</strong>
                    <small>${escapeHtml(statusTxt)}</small>
                    <div class="bar-track bar-sm">
                      <div class="bar-fill ${getHpClass(hpPct)}" style="width:${hpPct}%"></div>
                    </div>
                  </div>
                </button>
              `;
            })
            .join('')}
        </div>
      `;

      dom.battleActionPane.querySelectorAll('[data-switch-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (snap.busy || snap.ended) return;
          const idx = Number(btn.getAttribute('data-switch-idx'));
          audio('playSelect');
          ui.battleTab = 'fight';
          HM.Battle && HM.Battle.switchCreature(idx);
        });
      });
    }
  }

  function handleBattleEvolution(info) {
    return showEvolutionModal(info);
  }

  function showEvolutionModal({ creature, fromId, toId }) {
    const fromSp = HM.SPECIES && HM.SPECIES[fromId];
    const toSp = HM.SPECIES && HM.SPECIES[toId];
    audio('playEvolve');

    dom.evoTitle.textContent = `${fromSp ? fromSp.name : fromId} evoluiu para ${toSp ? toSp.name : toId}!`;
    dom.evoFromImg.src = spriteUrl(fromId, 136, false, creature && creature.golden);
    dom.evoFromName.textContent = fromSp ? fromSp.name : fromId;
    dom.evoToImg.src = spriteUrl(toId, 136, false, creature && creature.golden);
    dom.evoToName.textContent = toSp ? toSp.name : toId;
    dom.evoDesc.textContent =
      (toSp && toSp.desc) || 'Seu parceiro ficou ainda mais forte e radiante!';

    if (toSp && HM.TYPES && HM.TYPES[toSp.type]) {
      const t = HM.TYPES[toSp.type];
      dom.evoToType.style.setProperty('--t-bg', t.bg);
      dom.evoToType.style.setProperty('--t-color', t.dark);
      dom.evoToType.style.setProperty('--t-border', t.color);
      dom.evoToType.textContent = `${t.icon} ${t.name}`;
      dom.evoToType.classList.remove('hidden');
    } else {
      dom.evoToType.classList.add('hidden');
    }

    if (creature && ui.state && typeof HM.registerCaught === 'function') {
      HM.registerCaught(ui.state, toId);
    }

    dom.evoOverlay.classList.remove('hidden');
    ui.evoLockedUntil = Date.now() + 380;

    return new Promise((resolve) => {
      ui.evoResolver = resolve;
    });
  }

  function closeEvolutionModal() {
    if (!ui.evoResolver || Date.now() < ui.evoLockedUntil) return;
    audio('playSelect');
    dom.evoOverlay.classList.add('hidden');
    const fn = ui.evoResolver;
    ui.evoResolver = null;
    fn();
  }

  function handleBattleFinished(result) {
    if (HM.Battle && typeof HM.Battle.stop === 'function') {
      HM.Battle.stop();
    }
    const npc = ui.battleNpc;
    ui.battleNpc = null;
    ui.battleSnapshot = null;
    ui.pendingBattleItem = null;

    const outcome = result && result.outcome;

    if (outcome === 'win') {
      // Nota: battle.js já somou rewardCoins em state.coins e badge em state.badges
      if (npc && npc.id) {
        markTrainerDefeated(npc.id);
        if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
      }
      if (result && result.badge) {
        showToast(`🏅 Você ganhou a ${result.badge}!`, 'gold');
      } else if (result && result.rewardCoins > 0) {
        showToast(`🪙 Vitória! +${result.rewardCoins} moedas!`, 'success');
      } else {
        showToast('🎉 Vitória na batalha!', 'success');
      }
    } else if (outcome === 'caught') {
      const sp = result && result.caughtSpeciesId && HM.SPECIES && HM.SPECIES[result.caughtSpeciesId];
      const destMsg = result && result.destination === 'box' ? 'foi para a Caixa da Estufa!' : 'entrou no seu Time!';
      const goldTxt = result && result.caughtGolden ? '✨ DOURADO ' : '';
      showToast(`🏺 ${sp ? sp.name : 'HortaMon'} ${goldTxt}capturado e ${destMsg}`, 'gold');
      if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
    } else if (outcome === 'run') {
      showToast('🏃 Você fugiu com segurança!');
    } else if (outcome === 'lose') {
      if (typeof HM.healParty === 'function') HM.healParty(ui.state);
      const healSpot =
        (ui.state && ui.state.lastHealSpot) ||
        (HM.WORLD && (HM.WORLD.healSpot || HM.WORLD.spawn)) ||
        { x: 10, y: 18, dir: 'up' };
      if (HM.Overworld && typeof HM.Overworld.teleport === 'function') {
        HM.Overworld.teleport(healSpot.x, healSpot.y, healSpot.dir || 'up');
      } else if (ui.state && ui.state.player) {
        ui.state.player.x = healSpot.x;
        ui.state.player.y = healSpot.y;
        ui.state.player.dir = healSpot.dir || 'up';
      }
      if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
      showToast('💚 Você voltou ao último posto de cura e seu time foi 100% recuperado!', 'success');
    }

    showScreen('overworld');
    refreshOverworldHud();
    if (HM.Overworld && typeof HM.Overworld.resume === 'function') {
      HM.Overworld.resume();
    }
  }

  // =========================================================================
  // SISTEMA DE MODAIS
  // =========================================================================

  function openModal({ kind, title, subtitle, sizeClass, footerHtml, onClose }) {
    if (ui.screen === 'overworld' && HM.Overworld) {
      HM.Overworld.pause();
    }
    ui.modal = { kind, onClose: onClose || null };

    dom.modalDialog.className = 'modal-dialog cartoon-card' + (sizeClass ? ` ${sizeClass}` : '');
    dom.modalTitle.textContent = title || '';
    if (subtitle) {
      dom.modalSubtitle.textContent = subtitle;
      dom.modalSubtitle.classList.remove('hidden');
    } else {
      dom.modalSubtitle.classList.add('hidden');
    }

    if (footerHtml) {
      dom.modalFooter.innerHTML = footerHtml;
      dom.modalFooter.classList.remove('hidden');
    } else {
      dom.modalFooter.innerHTML = '';
      dom.modalFooter.classList.add('hidden');
    }

    dom.modalBackdrop.classList.remove('hidden');
  }

  function closeModal(silent) {
    if (!ui.modal) return;
    if (!silent) audio('playCancel');
    const cb = ui.modal.onClose;
    ui.modal = null;
    ui.pendingBagItem = null;
    dom.modalBackdrop.classList.add('hidden');
    if (typeof cb === 'function') cb();
    if (ui.screen === 'overworld' && !ui.dialogue && HM.Overworld) {
      HM.Overworld.resume();
    }
  }

  function openConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm }) {
    openModal({
      kind: 'confirm',
      title,
      sizeClass: 'modal-narrow',
      footerHtml: `
        <button type="button" id="confirm-cancel-btn" class="btn btn-cream btn-sm">Cancelar</button>
        <button type="button" id="confirm-ok-btn" class="btn ${confirmClass || 'btn-primary'} btn-sm">${escapeHtml(confirmLabel || 'Confirmar')}</button>
      `
    });
    dom.modalBody.innerHTML = `<p style="margin:0;font-size:0.94rem;line-height:1.45;font-weight:700;color:var(--ink-soft);">${escapeHtml(message)}</p>`;

    $('confirm-cancel-btn').addEventListener('click', () => closeModal());
    $('confirm-ok-btn').addEventListener('click', () => {
      audio('playSelect');
      closeModal(true);
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  // =========================================================================
  // MODAL: TIME (PARTY)
  // =========================================================================

  function openPartyModal(initialIdx) {
    if (!ui.state) return;
    audio('playSelect');
    ui.selectedPartyIdx = Math.min(
      Math.max(0, typeof initialIdx === 'number' ? initialIdx : ui.selectedPartyIdx),
      Math.max(0, ui.state.party.length - 1)
    );
    ui.renaming = false;
    openModal({
      kind: 'party',
      title: 'Time',
      sizeClass: 'modal-wide'
    });
    renderPartyModalBody();
  }

  function renderPartyModalBody() {
    const party = ui.state.party || [];
    if (party.length === 0) {
      dom.modalBody.innerHTML = '<p>Nenhum HortaMon no time.</p>';
      return;
    }
    if (ui.selectedPartyIdx >= party.length) ui.selectedPartyIdx = 0;

    const sel = party[ui.selectedPartyIdx];
    const selSp = HM.SPECIES && HM.SPECIES[sel.speciesId];
    const evoSp = selSp && selSp.evolvesTo && HM.SPECIES && HM.SPECIES[selSp.evolvesTo];

    const listHtml = party
      .map((c, idx) => {
        const hpPct = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
        const selectedCls = idx === ui.selectedPartyIdx ? ' selected' : '';
        return `
          <div class="party-slot-card${selectedCls}" data-select-slot="${idx}">
            <img src="${spriteUrl(c.speciesId, 72, false, c.golden)}" alt="${escapeHtml(getCreatureName(c))}" />
            <div class="party-slot-main">
              <div class="party-slot-top">
                ${idx === 0 ? '<span class="leader-star">⭐ Líder</span>' : ''}
                <strong>${nameHtml(c)}</strong>
                <span class="lv-pill">Nv. ${c.level}</span>
                ${renderStatusChipHtml(c)}
              </div>
              <div class="side-hp-line" style="margin-top:5px;">
                <div class="bar-track bar-sm">
                  <div class="bar-fill ${getHpClass(hpPct)}" style="width:${hpPct}%"></div>
                </div>
                <span class="side-hp-num">${c.hp}/${c.maxHp}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const statBar = (label, val, maxVal, color) => {
      const pct = Math.min(100, Math.round((val / maxVal) * 100));
      return `
        <div class="stat-row">
          <span>${label}</span>
          <span>${val}</span>
          <div class="bar-track bar-sm"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>
        </div>
      `;
    };

    const movesHtml = (sel.moves || [])
      .map((m) => {
        const def = (HM.MOVES && HM.MOVES[m.id]) || { name: m.id, type: 'raiz', power: 0, desc: '' };
        return `
          <div class="detail-move-pill" title="${escapeHtml(def.desc || '')}">
            <strong>${escapeHtml(def.name)}</strong>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-top:3px;">
              ${renderTypeChipHtml(def.type)}
              <small>PP ${m.pp}/${m.maxPp}</small>
            </div>
          </div>
        `;
      })
      .join('');

    const usableItems = ['regador', 'super_regador', 'adubo_revive']
      .map((id) => HM.ITEMS && HM.ITEMS[id])
      .filter((it) => it && (ui.state.bag[it.id] || 0) > 0);

    const quickHealHtml = usableItems
      .map((it) => {
        const qty = ui.state.bag[it.id] || 0;
        const canUse =
          it.kind === 'revive'
            ? sel.hp <= 0
            : sel.hp > 0 && (sel.hp < sel.maxHp || (it.id === 'super_regador' && !!sel.status));
        return `
          <button type="button" class="btn btn-cream btn-xs" data-quick-item="${escapeHtml(it.id)}" ${canUse ? '' : 'disabled'}>
            ${it.icon} ${escapeHtml(it.name)} (×${qty})
          </button>
        `;
      })
      .join('');

    const canMakeLeader = ui.selectedPartyIdx > 0 && sel.hp > 0;
    const xpPct = sel.xpNext > 0 ? Math.min(100, Math.round(((sel.xp || 0) / sel.xpNext) * 100)) : 0;

    dom.modalBody.innerHTML = `
      <div class="party-modal-layout">
        <div class="party-cards-list">${listHtml}</div>
        <div class="party-detail-box">
          <div class="detail-hero">
            <img src="${spriteUrl(sel.speciesId, 112, false, sel.golden)}" alt="${escapeHtml(getCreatureName(sel))}" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <strong style="font-size:1.1rem;">${nameHtml(sel)}</strong>
                <span class="lv-pill">Nv. ${sel.level}</span>
                <button type="button" id="btn-rename" class="btn btn-cream btn-xs" title="Dar um apelido">✏️ Apelido</button>
              </div>
              ${sel.nickname && selSp ? `<small class="species-under-nick">${escapeHtml(selSp.name)}${sel.golden ? ' • ✨ Dourado' : ''}</small>` : sel.golden ? '<small class="species-under-nick">✨ HortaMon Dourado</small>' : ''}
              ${
                ui.renaming
                  ? `<div class="rename-row">
                      <input id="rename-input" type="text" maxlength="12" autocomplete="off" value="${escapeHtml(sel.nickname || '')}" placeholder="${escapeHtml(selSp ? selSp.name : '')}" aria-label="Apelido" />
                      <button type="button" id="btn-rename-save" class="btn btn-primary btn-xs">Salvar</button>
                      <button type="button" id="btn-rename-cancel" class="btn btn-cream btn-xs" title="Cancelar">✖</button>
                    </div>`
                  : ''
              }
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin:5px 0;">
                ${selSp ? renderTypeChipHtml(selSp.type) : ''}
                ${renderStatusChipHtml(sel)}
              </div>
              <div style="font-size:0.75rem;font-weight:800;color:var(--ink-soft);">
                XP: ${sel.xp || 0}/${sel.xpNext || 100}
                <div class="bar-track bar-xp" style="margin-top:3px;">
                  <div class="bar-fill xp-fill" style="width:${xpPct}%"></div>
                </div>
              </div>
              ${
                evoSp
                  ? `<div style="margin-top:5px;font-size:0.74rem;font-weight:800;color:var(--leaf-dark);">✨ Evolui para ${escapeHtml(evoSp.name)} no Nv. ${selSp.evolveLevel}</div>`
                  : ''
              }
            </div>
          </div>

          <div class="stat-bars-list">
            ${statBar('HP', sel.maxHp, 160, '#22c55e')}
            ${statBar('ATK', sel.atk, 100, '#ef4444')}
            ${statBar('DEF', sel.def, 100, '#f59e0b')}
            ${statBar('VEL', sel.spd, 100, '#38bdf8')}
          </div>

          <div>
            <strong style="font-size:0.82rem;display:block;margin-bottom:5px;">Golpes Aprendidos:</strong>
            <div class="detail-moves-grid">${movesHtml}</div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:2px dashed rgba(43,29,20,0.2);">
            <button type="button" id="btn-make-leader" class="btn btn-sun btn-xs" ${canMakeLeader ? '' : 'disabled'}>
              ⭐ Tornar Líder
            </button>
            <div class="quick-heal-row">
              ${quickHealHtml || '<small style="font-weight:700;color:var(--ink-soft);">Sem itens de cura na mochila</small>'}
            </div>
          </div>
        </div>
      </div>
    `;

    dom.modalBody.querySelectorAll('[data-select-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        ui.selectedPartyIdx = Number(el.getAttribute('data-select-slot')) || 0;
        ui.renaming = false;
        audio('playSelect');
        renderPartyModalBody();
      });
    });

    const renameBtn = $('btn-rename');
    if (renameBtn) {
      renameBtn.addEventListener('click', () => {
        ui.renaming = !ui.renaming;
        audio('playSelect');
        renderPartyModalBody();
        const inp = $('rename-input');
        if (inp) {
          inp.focus();
          inp.select();
        }
      });
    }
    const saveNick = () => {
      const inp = $('rename-input');
      if (!inp) return;
      const clean = inp.value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
      const spName = selSp ? selSp.name : '';
      sel.nickname = clean && clean !== spName ? clean : null;
      ui.renaming = false;
      if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
      audio('playSelect');
      refreshOverworldHud();
      renderPartyModalBody();
      showToast(sel.nickname ? `✏️ Agora ele se chama ${sel.nickname}!` : '✏️ Apelido removido.', 'success');
    };
    const renameSave = $('btn-rename-save');
    if (renameSave) renameSave.addEventListener('click', saveNick);
    const renameCancel = $('btn-rename-cancel');
    if (renameCancel) {
      renameCancel.addEventListener('click', () => {
        ui.renaming = false;
        renderPartyModalBody();
      });
    }
    const renameInput = $('rename-input');
    if (renameInput) {
      renameInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          saveNick();
        }
      });
    }

    const leaderBtn = $('btn-make-leader');
    if (leaderBtn) {
      leaderBtn.addEventListener('click', () => {
        if (!canMakeLeader) return;
        const chosen = party.splice(ui.selectedPartyIdx, 1)[0];
        party.unshift(chosen);
        ui.selectedPartyIdx = 0;
        if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
        audio('playSelect');
        refreshOverworldHud();
        renderPartyModalBody();
        showToast(`⭐ ${getCreatureName(chosen)} agora é o líder do time!`, 'success');
      });
    }

    dom.modalBody.querySelectorAll('[data-quick-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-quick-item');
        applyFieldItem(itemId, ui.selectedPartyIdx);
        renderPartyModalBody();
      });
    });
  }

  function applyFieldItem(itemId, partyIdx) {
    const st = ui.state;
    const item = HM.ITEMS && HM.ITEMS[itemId];
    const target = st && st.party && st.party[partyIdx];
    if (!item || !target || (st.bag[itemId] || 0) <= 0) return false;

    if (item.kind === 'revive') {
      if (target.hp > 0) {
        audio('playError');
        showToast(`${getCreatureName(target)} não está desmaiado!`, 'error');
        return false;
      }
      if (typeof HM.reviveCreature === 'function') {
        HM.reviveCreature(target, item.revivePct || 0.6);
      } else {
        target.hp = Math.max(1, Math.round(target.maxHp * (item.revivePct || 0.6)));
        target.status = null;
      }
      st.bag[itemId] -= 1;
      audio('playHeal');
      if (typeof HM.saveGame === 'function') HM.saveGame(st);
      refreshOverworldHud();
      showToast(`🌱 ${getCreatureName(target)} foi revivido!`, 'success');
      return true;
    }

    if (item.kind === 'heal') {
      const cureStatus = itemId === 'super_regador';
      if (target.hp <= 0) {
        audio('playError');
        showToast('Use Adubo Vital para reviver um HortaMon desmaiado!', 'error');
        return false;
      }
      if (target.hp >= target.maxHp && !(cureStatus && target.status)) {
        audio('playError');
        showToast(`${getCreatureName(target)} já está com HP cheio!`, 'error');
        return false;
      }
      if (typeof HM.healCreature === 'function') {
        HM.healCreature(target, item.heal || 45, cureStatus);
      } else {
        target.hp = Math.min(target.maxHp, target.hp + (item.heal || 45));
        if (cureStatus) target.status = null;
      }
      st.bag[itemId] -= 1;
      audio('playHeal');
      if (typeof HM.saveGame === 'function') HM.saveGame(st);
      refreshOverworldHud();
      showToast(`💧 ${getCreatureName(target)} recuperou energia!`, 'success');
      return true;
    }

    return false;
  }

  // =========================================================================
  // MODAL: MOCHILA (FORA DE BATALHA)
  // =========================================================================

  function openBagModal() {
    if (!ui.state) return;
    audio('playSelect');
    ui.pendingBagItem = null;
    openModal({
      kind: 'bag',
      title: 'Mochila'
    });
    renderBagModalBody();
  }

  function renderBagModalBody() {
    const items = getItemList().filter((it) => it.kind !== 'key' || ((ui.state.bag && ui.state.bag[it.id]) || 0) > 0);
    const cardsHtml = items
      .map((it) => {
        const qty = (ui.state.bag && ui.state.bag[it.id]) || 0;
        const canFieldUse = (it.kind === 'heal' || it.kind === 'revive') && qty > 0;
        return `
          <div class="item-card">
            <div class="item-card-head">
              <div class="item-icon-badge">${it.icon}</div>
              <div>
                <strong>${escapeHtml(it.name)}</strong>
                <div style="font-size:0.75rem;font-weight:800;color:var(--leaf-dark);">Quantidade: ×${qty}</div>
              </div>
            </div>
            <p class="item-card-desc">${escapeHtml(it.desc)}</p>
            <div class="item-card-foot">
              ${
                it.kind === 'key'
                  ? '<span class="pill pill-leaf" style="font-size:0.7rem;">✅ Sempre ativo</span>'
                  : it.kind === 'catch'
                  ? '<span class="pill pill-sun" style="font-size:0.7rem;">Usar em batalha</span>'
                  : `<button type="button" class="btn btn-primary btn-xs" data-bag-use="${escapeHtml(it.id)}" ${canFieldUse ? '' : 'disabled'}>Usar no Time</button>`
              }
            </div>
          </div>
        `;
      })
      .join('');

    let pickerHtml = '';
    if (ui.pendingBagItem) {
      const it = HM.ITEMS && HM.ITEMS[ui.pendingBagItem];
      pickerHtml = `
        <div class="bag-target-picker">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <strong>Escolha quem vai receber ${it ? `${it.icon} ${escapeHtml(it.name)}` : ''}:</strong>
            <button type="button" id="btn-bag-cancel-pick" class="btn btn-cream btn-xs">Cancelar</button>
          </div>
          <div class="battle-party-grid">
            ${(ui.state.party || [])
              .map((c, idx) => {
                const hpPct = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
                const ok =
                  it && it.kind === 'revive'
                    ? c.hp <= 0
                    : c.hp > 0 && (c.hp < c.maxHp || (ui.pendingBagItem === 'super_regador' && !!c.status));
                return `
                  <button type="button" class="battle-party-btn" data-bag-target="${idx}" ${ok ? '' : 'disabled'}>
                    <img src="${spriteUrl(c.speciesId, 48, false, c.golden)}" alt="${escapeHtml(getCreatureName(c))}" />
                    <div class="battle-party-info">
                      <strong>${nameHtml(c)}</strong>
                      <small>HP ${c.hp}/${c.maxHp} ${c.hp <= 0 ? '💫' : ''}</small>
                      <div class="bar-track bar-sm"><div class="bar-fill ${getHpClass(hpPct)}" style="width:${hpPct}%"></div></div>
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }

    dom.modalBody.innerHTML = `<div class="items-list-grid">${cardsHtml}</div>${pickerHtml}`;

    dom.modalBody.querySelectorAll('[data-bag-use]').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio('playSelect');
        ui.pendingBagItem = btn.getAttribute('data-bag-use');
        renderBagModalBody();
      });
    });

    const cancelPick = $('btn-bag-cancel-pick');
    if (cancelPick) {
      cancelPick.addEventListener('click', () => {
        audio('playCancel');
        ui.pendingBagItem = null;
        renderBagModalBody();
      });
    }

    dom.modalBody.querySelectorAll('[data-bag-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-bag-target'));
        applyFieldItem(ui.pendingBagItem, idx);
        if ((ui.state.bag[ui.pendingBagItem] || 0) <= 0) {
          ui.pendingBagItem = null;
        }
        renderBagModalBody();
      });
    });
  }

  // =========================================================================
  // MODAL: LOJA DO SEU BENTO
  // =========================================================================

  function openShopModal() {
    if (!ui.state) return;
    audio('playSelect');
    openModal({
      kind: 'shop',
      title: 'Loja'
    });
    renderShopModalBody();
  }

  function renderShopModalBody() {
    const coins = ui.state.coins || 0;
    const items = getItemList().filter((it) => it.kind !== 'key' && it.price > 0);

    const cardsHtml = items
      .map((it) => {
        const owned = (ui.state.bag && ui.state.bag[it.id]) || 0;
        const canBuy1 = coins >= it.price;
        const canBuy5 = coins >= it.price * 5;
        return `
          <div class="item-card">
            <div class="item-card-head">
              <div class="item-icon-badge">${it.icon}</div>
              <div>
                <strong>${escapeHtml(it.name)}</strong>
                <div style="font-size:0.75rem;font-weight:800;color:var(--wood);">🪙 ${it.price} moedas • Na mochila: ${owned}</div>
              </div>
            </div>
            <p class="item-card-desc">${escapeHtml(it.desc)}</p>
            <div class="item-card-foot">
              <button type="button" class="btn btn-primary btn-xs" data-buy-id="${escapeHtml(it.id)}" data-buy-qty="1" ${canBuy1 ? '' : 'disabled'}>
                Comprar 1
              </button>
              <button type="button" class="btn btn-sun btn-xs" data-buy-id="${escapeHtml(it.id)}" data-buy-qty="5" ${canBuy5 ? '' : 'disabled'}>
                ×5 (🪙 ${it.price * 5})
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    dom.modalBody.innerHTML = `
      <div class="shop-wallet-bar">
        <span>💰 Seu Saldo Atual: 🪙 ${coins} moedas</span>
        <small style="color:var(--ink-soft);">Dica: Vença batalhas para ganhar mais moedas!</small>
      </div>
      <div class="items-list-grid">${cardsHtml}</div>
    `;

    dom.modalBody.querySelectorAll('[data-buy-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-buy-id');
        const qty = Number(btn.getAttribute('data-buy-qty')) || 1;
        const it = HM.ITEMS && HM.ITEMS[id];
        if (!it) return;
        const cost = it.price * qty;
        if ((ui.state.coins || 0) < cost) {
          audio('playError');
          showToast('Moedas insuficientes!', 'error');
          return;
        }
        ui.state.coins -= cost;
        ui.state.bag[id] = (ui.state.bag[id] || 0) + qty;
        if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
        audio('playCoin');
        refreshOverworldHud();
        renderShopModalBody();
        showToast(`🛒 Comprou ${qty}× ${it.name}!`, 'success');
      });
    });
  }

  // =========================================================================
  // MODAL: CAIXA DA ESTUFA
  // =========================================================================

  function openBoxModal() {
    if (!ui.state) return;
    audio('playSelect');
    openModal({
      kind: 'box',
      title: 'Caixa da Estufa',
      subtitle: 'Time: de 1 a 6 HortaMons. O resto fica guardado aqui.',
      sizeClass: 'modal-wide'
    });
    renderBoxModalBody();
  }

  function renderBoxModalBody() {
    const party = ui.state.party || [];
    const box = ui.state.box || [];

    const partyRows = party
      .map((c, idx) => {
        const canStore = party.length > 1;
        return `
          <div class="box-mon-row">
            <img src="${spriteUrl(c.speciesId, 56, false, c.golden)}" alt="${escapeHtml(getCreatureName(c))}" />
            <div class="box-mon-info">
              <strong>${idx === 0 ? '⭐ ' : ''}${escapeHtml(getCreatureName(c))}</strong>
              <small>Nv.${c.level} • HP ${c.hp}/${c.maxHp}</small>
            </div>
            <button type="button" class="btn btn-cream btn-xs" data-store-idx="${idx}" ${canStore ? '' : 'disabled'} title="${canStore ? 'Mover para o depósito' : 'Mantenha ao menos 1 HortaMon no time'}">
              Guardar ➔
            </button>
          </div>
        `;
      })
      .join('');

    const boxRows =
      box.length === 0
        ? '<p style="margin:8px 0;font-size:0.84rem;font-weight:700;color:var(--ink-soft);">Nenhum HortaMon guardado no depósito ainda. Capture mais criaturas na grama alta!</p>'
        : box
            .map((c, idx) => {
              const canTake = party.length < 6;
              return `
                <div class="box-mon-row">
                  <img src="${spriteUrl(c.speciesId, 56, false, c.golden)}" alt="${escapeHtml(getCreatureName(c))}" />
                  <div class="box-mon-info">
                    <strong>${nameHtml(c)}</strong>
                    <small>Nv.${c.level} • HP ${c.hp}/${c.maxHp}</small>
                  </div>
                  <button type="button" class="btn btn-primary btn-xs" data-take-idx="${idx}" ${canTake ? '' : 'disabled'} title="${canTake ? 'Colocar no time' : 'Seu time já está cheio (6/6)'}">
                    ⬅ Trazer
                  </button>
                </div>
              `;
            })
            .join('');

    dom.modalBody.innerHTML = `
      <div class="box-split">
        <div class="box-col">
          <h3>🌿 Seu Time (${party.length}/6)</h3>
          ${partyRows}
        </div>
        <div class="box-col">
          <h3>🏡 Depósito da Estufa (${box.length})</h3>
          ${boxRows}
        </div>
      </div>
    `;

    dom.modalBody.querySelectorAll('[data-store-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-store-idx'));
        if (party.length <= 1) return;
        const mon = party.splice(idx, 1)[0];
        box.push(mon);
        if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
        audio('playSelect');
        refreshOverworldHud();
        renderBoxModalBody();
      });
    });

    dom.modalBody.querySelectorAll('[data-take-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-take-idx'));
        if (party.length >= 6) return;
        const mon = box.splice(idx, 1)[0];
        party.push(mon);
        if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
        audio('playSelect');
        refreshOverworldHud();
        renderBoxModalBody();
      });
    });
  }

  // =========================================================================
  // MODAL: BOTANIDEX
  // =========================================================================

  function getEvolutionLine(speciesId) {
    if (!HM.SPECIES || !HM.SPECIES[speciesId]) return [];
    // Encontra o primeiro estágio da família
    let baseId = speciesId;
    const all = HM.SPECIES_LIST || Object.values(HM.SPECIES);
    let safety = 0;
    while (safety < 5) {
      const prev = all.find((s) => s.evolvesTo === baseId);
      if (!prev) break;
      baseId = prev.id;
      safety += 1;
    }
    const line = [];
    let cur = HM.SPECIES[baseId];
    safety = 0;
    while (cur && safety < 5) {
      line.push(cur);
      cur = cur.evolvesTo ? HM.SPECIES[cur.evolvesTo] : null;
      safety += 1;
    }
    return line;
  }

  function openDexModal() {
    audio('playSelect');
    const dex = countDex();
    if (!HM.SPECIES[ui.selectedDexId] && HM.SPECIES_LIST && HM.SPECIES_LIST.length > 0) {
      ui.selectedDexId = HM.SPECIES_LIST[0].id;
    }
    openModal({
      kind: 'dex',
      title: 'BotaniDex',
      subtitle: `${dex.caught} capturados · ${dex.seen} vistos · ${dex.total} no total`,
      sizeClass: 'modal-wide'
    });
    renderDexModalBody();
  }

  function renderDexModalBody() {
    const list = HM.SPECIES_LIST || [];
    const dex = countDex();

    const filtered = list.filter((sp) => {
      if (ui.dexFilter === 'caught') return isSpeciesCaught(sp.id);
      if (ui.dexFilter === 'seen') return isSpeciesSeen(sp.id);
      return true;
    });

    const gridHtml =
      filtered.length === 0
        ? '<p style="font-weight:700;color:var(--ink-soft);">Nenhuma espécie neste filtro ainda.</p>'
        : filtered
            .map((sp) => {
              const seen = isSpeciesSeen(sp.id);
              const caught = isSpeciesCaught(sp.id);
              const num = String(sp.dexNum || 0).padStart(2, '0');
              const selectedCls = sp.id === ui.selectedDexId ? ' selected' : '';
              const caughtCls = caught ? ' is-caught' : '';
              const badge = caught ? '🏺' : seen ? '👁️' : '';
              return `
                <button type="button" class="dex-tile${selectedCls}${caughtCls}" data-dex-id="${escapeHtml(sp.id)}">
                  <span class="dex-num">#${num}</span>
                  ${badge ? `<span class="dex-badge">${badge}</span>` : ''}
                  <img src="${spriteUrl(sp.id, 76, !seen)}" alt="${seen ? escapeHtml(sp.name) : 'Desconhecido'}" />
                  <span class="dex-tile-name">${seen ? escapeHtml(sp.name) : '???'}</span>
                </button>
              `;
            })
            .join('');

    const cur = HM.SPECIES && HM.SPECIES[ui.selectedDexId];
    let detailHtml = '';

    if (cur) {
      const seen = isSpeciesSeen(cur.id);
      const caught = isSpeciesCaught(cur.id);
      const num = String(cur.dexNum || 0).padStart(2, '0');

      if (!seen) {
        detailHtml = `
          <div class="dex-detail-panel">
            <div class="dex-detail-top">
              <img src="${spriteUrl(cur.id, 112, true)}" alt="Espécie desconhecida" />
              <div>
                <span class="pill pill-sun">#${num} • Não descoberto</span>
                <h3 style="margin:6px 0 4px;">???</h3>
                <p style="margin:0;font-size:0.82rem;color:var(--ink-soft);font-weight:700;">
                  Explore a grama alta das rotas e enfrente jardineiros para registrar esta espécie na BotaniDex!
                </p>
              </div>
            </div>
          </div>
        `;
      } else {
        const line = getEvolutionLine(cur.id);
        const evoHtml = line
          .map((node, idx) => {
            const nodeSeen = isSpeciesSeen(node.id);
            const arrow =
              idx < line.length - 1
                ? `<div class="evo-chain-arrow">➔<br/>Nv.${node.evolveLevel || '?'}</div>`
                : '';
            return `
              <div class="evo-node${node.id === cur.id ? ' current' : ''}" data-dex-jump="${escapeHtml(node.id)}">
                <img src="${spriteUrl(node.id, 56, !nodeSeen)}" alt="${nodeSeen ? escapeHtml(node.name) : '???'}" />
                <span>${nodeSeen ? escapeHtml(node.name) : '???'}</span>
              </div>
              ${arrow}
            `;
          })
          .join('');

        const bs = cur.baseStats || { hp: 50, atk: 50, def: 50, spd: 50 };
        const baseBar = (label, val, color) => {
          const pct = Math.min(100, Math.round((val / 115) * 100));
          return `
            <div class="stat-row">
              <span>${label}</span>
              <span>${val}</span>
              <div class="bar-track bar-sm"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>
            </div>
          `;
        };

        const learnHtml = (cur.learnset || [])
          .map((l) => {
            const mv = HM.MOVES && HM.MOVES[l.moveId];
            return `<span class="type-chip" style="--t-bg:var(--cream);--t-color:var(--ink);--t-border:var(--ink);">Nv.${l.level} ${escapeHtml(mv ? mv.name : l.moveId)}</span>`;
          })
          .join(' ');

        detailHtml = `
          <div class="dex-detail-panel">
            <div class="dex-detail-top">
              <img src="${spriteUrl(cur.id, 118, false)}" alt="${escapeHtml(cur.name)}" />
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span class="lv-pill">#${num}</span>
                  <strong style="font-size:1.14rem;">${escapeHtml(cur.name)}</strong>
                </div>
                <div style="font-size:0.78rem;font-weight:800;color:var(--wood);margin:2px 0 5px;">${escapeHtml(cur.title || '')}</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                  ${renderTypeChipHtml(cur.type)}
                  <span class="pill ${caught ? 'pill-leaf' : 'pill-sky'}" style="font-size:0.7rem;">
                    ${caught ? '🏺 Capturado' : '👁️ Visto'}
                  </span>
                </div>
              </div>
            </div>

            <p style="margin:0;font-size:0.84rem;line-height:1.4;font-weight:600;color:var(--ink-soft);">
              ${escapeHtml(cur.desc || '')}
            </p>

            <div>
              <strong style="font-size:0.8rem;display:block;margin-bottom:5px;">Linha Evolutiva:</strong>
              <div class="evo-chain">${evoHtml}</div>
            </div>

            <div>
              <strong style="font-size:0.8rem;display:block;margin-bottom:5px;">Atributos Base:</strong>
              <div class="stat-bars-list">
                ${baseBar('HP', bs.hp, '#22c55e')}
                ${baseBar('ATK', bs.atk, '#ef4444')}
                ${baseBar('DEF', bs.def, '#f59e0b')}
                ${baseBar('VEL', bs.spd, '#38bdf8')}
              </div>
            </div>

            <div>
              <strong style="font-size:0.8rem;display:block;margin-bottom:5px;">Golpes:</strong>
              <div style="display:flex;flex-wrap:wrap;gap:4px;">${learnHtml}</div>
            </div>
          </div>
        `;
      }
    }

    dom.modalBody.innerHTML = `
      <div class="dex-toolbar">
        <div class="dex-filters">
          <button type="button" class="btn btn-xs ${ui.dexFilter === 'all' ? 'btn-sun' : 'btn-cream'}" data-dex-filter="all">Todos (${dex.total})</button>
          <button type="button" class="btn btn-xs ${ui.dexFilter === 'caught' ? 'btn-leaf' : 'btn-cream'}" data-dex-filter="caught">🏺 Capturados (${dex.caught})</button>
          <button type="button" class="btn btn-xs ${ui.dexFilter === 'seen' ? 'btn-sky' : 'btn-cream'}" data-dex-filter="seen">👁️ Vistos (${dex.seen})</button>
        </div>
        <span class="pill pill-leaf">Progresso: ${Math.round((dex.caught / Math.max(1, dex.total)) * 100)}%</span>
      </div>
      <div class="dex-layout">
        <div class="dex-grid">${gridHtml}</div>
        <div>${detailHtml}</div>
      </div>
    `;

    dom.modalBody.querySelectorAll('[data-dex-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio('playSelect');
        ui.dexFilter = btn.getAttribute('data-dex-filter');
        renderDexModalBody();
      });
    });

    dom.modalBody.querySelectorAll('[data-dex-id], [data-dex-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dex-id') || btn.getAttribute('data-dex-jump');
        ui.selectedDexId = id;
        audio('playSelect');
        renderDexModalBody();
      });
    });
  }

  // =========================================================================
  // MODAL: TABELA DE TIPOS BOTÂNICOS
  // =========================================================================

  function openTypesModal() {
    audio('playSelect');
    openModal({
      kind: 'types',
      title: 'Tabela de tipos',
      subtitle: 'Picante → Fungo → Folha → Raiz → Fresco → Cítrico → Picante. Cada tipo vence os 2 seguintes (2×) e causa pouco dano nos 2 anteriores (½×).',
      sizeClass: 'modal-wide'
    });

    const list = HM.TYPE_LIST || Object.keys(HM.TYPES || {});
    const cardsHtml = list
      .map((id) => {
        const t = HM.TYPES[id];
        const row = (HM.TYPE_CHART && HM.TYPE_CHART[id]) || {};
        const wins = list.filter((d) => row[d] >= 2).map(renderTypeChipHtml).join('');
        const weak = list.filter((d) => row[d] <= 0.5).map(renderTypeChipHtml).join('');
        return `
          <div class="type-info-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              ${renderTypeChipHtml(id)}
              <small style="font-weight:700;color:var(--ink-soft);text-align:right;">${escapeHtml(t.desc || '')}</small>
            </div>
            <div class="type-rel-line">
              <span style="color:var(--leaf-dark);">SUPER 2×:</span> ${wins}
            </div>
            <div class="type-rel-line">
              <span style="color:var(--berry-dark);">POUCO 0.5×:</span> ${weak}
            </div>
          </div>
        `;
      })
      .join('');

    const headerCells = list
      .map((id) => `<th>${HM.TYPES[id].icon}<br/>${escapeHtml(HM.TYPES[id].name)}</th>`)
      .join('');
    const matrixRows = list
      .map((atk) => {
        const cells = list
          .map((def) => {
            const eff = HM.getTypeEffectiveness(atk, def);
            if (eff >= 2) return '<td class="cell-2x">2×</td>';
            if (eff <= 0.5) return '<td class="cell-half">½×</td>';
            return '<td class="cell-1x">1×</td>';
          })
          .join('');
        return `<tr><th>${HM.TYPES[atk].icon} ${escapeHtml(HM.TYPES[atk].name)}</th>${cells}</tr>`;
      })
      .join('');

    dom.modalBody.innerHTML = `
      <div class="type-cards-grid">${cardsHtml}</div>
      <div class="type-matrix-wrap">
        <strong style="display:block;font-size:0.84rem;margin-bottom:6px;">Matriz Completa (Linha = Golpe • Coluna = Defensor):</strong>
        <table class="type-matrix">
          <thead>
            <tr><th>Ataque ╲ Defesa</th>${headerCells}</tr>
          </thead>
          <tbody>${matrixRows}</tbody>
        </table>
      </div>
    `;
  }

  // =========================================================================
  // MODAL: COMO JOGAR & MENU
  // =========================================================================

  function openHelpModal() {
    audio('playSelect');
    openModal({
      kind: 'help',
      title: 'Como jogar'
    });

    dom.modalBody.innerHTML = `
      <div class="help-grid">
        <div class="help-box">
          <h4>Exploração</h4>
          <ul>
            <li>Use <strong>WASD</strong>, <strong>Setas</strong> ou o <strong>D-Pad</strong> na tela para caminhar.</li>
            <li>Pressione <strong>Espaço / Enter</strong> ou clique em NPCs e placas para conversar.</li>
            <li>Ande na <strong>grama alta</strong> (ou nos canteiros sombrios da caverna) para encontrar HortaMons selvagens!</li>
            <li>No celular, toque no mapa para andar até o lugar tocado.</li>
          </ul>
        </div>
        <div class="help-box">
          <h4>Batalha & Captura</h4>
          <ul>
            <li>Observe os selos automáticos <strong>SUPER 2×</strong> e <strong>POUCO 0.5×</strong> nos golpes!</li>
            <li>Enfraqueça HortaMons selvagens e use um <strong>Vaso de Captura</strong> na Mochila para capturá-los.</li>
            <li>HortaMons ganham XP, aprendem golpes novos e <strong>evoluem automaticamente</strong>!</li>
            <li>Quem entra no meio da luta também ganha XP. Com o <strong>Adubo Compartilhado</strong> (presente do Prof. Pomar), o time todo ganha.</li>
            <li>✨ Raramente (1 em 64) aparece um HortaMon <strong>Dourado</strong>. Capture se puder!</li>
          </ul>
        </div>
        <div class="help-box">
          <h4>Locais da Vila da Horta</h4>
          <ul>
            <li><strong>Estufa de Cura (Enf. Rosa):</strong> cura 100% do time de graça!</li>
            <li><strong>Loja do Seu Bento:</strong> compre Vasos, Regadores e Adubo Vital.</li>
            <li><strong>Caixa da Estufa:</strong> troque HortaMons entre Time e Depósito.</li>
            <li><strong>Arena Dourada:</strong> vença os 4 jardineiros das rotas e depois a Líder Flora!</li>
          </ul>
        </div>
        <div class="help-box">
          <h4>Depois da 1ª Insígnia</h4>
          <ul>
            <li>O <strong>Guarda Tom</strong> libera a passagem a Leste da Rota 1.</li>
            <li><strong>Pomar Tropical:</strong> Posto do Pomar com cura e loja.</li>
            <li><strong>Horta Subterrânea:</strong> vença os jardineiros e desafie o <strong>Líder Mandi</strong>.</li>
          </ul>
        </div>
        <div class="help-box">
          <h4>Save e Álbum</h4>
          <ul>
            <li>Use <strong>Menu → Exportar Save</strong> para levar seu progresso para outro PC ou celular.</li>
            <li>No <strong>Time</strong>, toque em ✏️ para dar apelidos.</li>
            <li>O <strong>Álbum de Cartas</strong> libera uma carta para cada HortaMon capturado.</li>
          </ul>
        </div>
      </div>
    `;
  }

  function openMenuModal() {
    audio('playSelect');
    const muted = !!(HM.Audio && HM.Audio.muted);
    const st = ui.state;
    const dex = countDex(st);
    const zone = st && HM.WORLD && HM.WORLD.zones && HM.WORLD.zones[st.zone];
    openModal({ kind: 'menu', title: 'Menu', sizeClass: 'modal-narrow' });

    dom.modalBody.innerHTML = `
      ${
        st
          ? `<div class="pause-summary">
              <span><b>${escapeHtml(zone ? zone.name.split(' — ')[0] : 'Vila da Horta')}</b></span>
              <span><b>${(st.badges || []).length}</b> ${(st.badges || []).length === 1 ? 'insígnia' : 'insígnias'}</span>
              <span><b>${dex.caught}/${dex.total}</b> capturados</span>
              <span><b>${st.coins || 0}</b> moedas</span>
            </div>`
          : ''
      }
      <div class="menu-list">
        <button type="button" id="menu-resume-btn" class="menu-row">Continuar jogando</button>
        <button type="button" id="menu-save-btn" class="menu-row">Salvar agora</button>
        <button type="button" id="menu-sound-btn" class="menu-row">Som <span id="opt-sound-state" class="toggle-pill${muted ? ' off' : ''}">${muted ? 'Desligado' : 'Ligado'}</span></button>
        <button type="button" id="menu-help-btn" class="menu-row">Como jogar</button>
        <a id="menu-cards-btn" class="menu-row" href="cartas.html">Álbum de cartas</a>
        <button type="button" id="menu-export-btn" class="menu-row">Exportar save <small>arquivo .json</small></button>
        <button type="button" id="menu-import-btn" class="menu-row">Importar save <small>arquivo .json</small></button>
        <button type="button" id="menu-title-btn" class="menu-row">Tela inicial</button>
      </div>
      <div class="menu-gap"></div>
      <div class="menu-list">
        <button type="button" id="menu-reset-btn" class="menu-row danger">Apagar save e recomeçar</button>
      </div>
    `;

    $('menu-resume-btn').addEventListener('click', () => closeModal());

    $('menu-save-btn').addEventListener('click', () => {
      if (ui.state && typeof HM.saveGame === 'function') {
        HM.saveGame(ui.state);
        audio('playSelect');
        showToast('💾 Jogo salvo com sucesso!', 'success');
      }
      closeModal(true);
    });

    $('menu-sound-btn').addEventListener('click', () => toggleSound());

    $('menu-help-btn').addEventListener('click', () => {
      closeModal(true);
      openHelpModal();
    });

    $('menu-cards-btn').addEventListener('click', () => {
      if (ui.state && typeof HM.saveGame === 'function') HM.saveGame(ui.state);
    });

    $('menu-export-btn').addEventListener('click', () => {
      exportSaveFile();
    });

    $('menu-import-btn').addEventListener('click', () => {
      closeModal(true);
      askImportSave();
    });

    $('menu-title-btn').addEventListener('click', () => {
      if (ui.state && typeof HM.saveGame === 'function') HM.saveGame(ui.state);
      closeModal(true);
      if (HM.Overworld) HM.Overworld.pause();
      renderTitleScreen();
      showScreen('title');
      showToast('💾 Progresso salvo!');
    });

    $('menu-reset-btn').addEventListener('click', () => {
      closeModal(true);
      openConfirmModal({
        title: 'Apagar o save?',
        message: 'Tem certeza que deseja apagar permanentemente o save atual e começar do zero?',
        confirmLabel: 'Sim, apagar tudo',
        confirmClass: 'btn-danger',
        onConfirm: () => {
          if (typeof HM.clearSave === 'function') HM.clearSave();
          if (HM.Overworld) HM.Overworld.pause();
          ui.state = null;
          renderTitleScreen();
          showScreen('title');
          showToast('Save apagado. Pronto para uma nova aventura!');
        }
      });
    });
  }

  // =========================================================================
  // EXPORTAR / IMPORTAR SAVE
  // =========================================================================

  function exportSaveFile() {
    if (!ui.state || typeof HM.exportSaveData !== 'function') {
      showToast('Comece uma aventura antes de exportar.', 'error');
      return;
    }
    if (typeof HM.saveGame === 'function') HM.saveGame(ui.state);
    const text = HM.exportSaveData(ui.state);
    const blob = new Blob([text], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hortamon-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 800);
    audio('playSelect');
    showToast('📤 Save exportado! Leve o arquivo .json para o outro PC ou celular.', 'success');
  }

  function askImportSave() {
    const hasProgress = !!ui.state || (typeof HM.hasSave === 'function' && HM.hasSave());
    if (!hasProgress) {
      pickImportFile();
      return;
    }
    openConfirmModal({
      title: 'Importar save?',
      message: 'O progresso salvo neste navegador será substituído pelo do arquivo. Quer continuar?',
      confirmLabel: 'Sim, escolher arquivo',
      confirmClass: 'btn-primary',
      onConfirm: () => pickImportFile()
    });
  }

  function pickImportFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const loaded = typeof HM.importSaveData === 'function' ? HM.importSaveData(String(reader.result || '')) : null;
        if (!loaded) {
          audio('playError');
          showToast('Esse arquivo não é um save válido do HortaMon.', 'error');
          return;
        }
        ui.state = ensureStateShape(loaded);
        audio('unlock');
        enterOverworld();
        showToast('📥 Save importado! Bem-vindo de volta!', 'gold');
      };
      reader.onerror = () => showToast('Não consegui ler o arquivo.', 'error');
      reader.readAsText(file);
    });
    input.click();
  }

  // =========================================================================
  // CONTROLES GLOBAIS (TECLADO + D-PAD + BOTÕES)
  // =========================================================================

  function bindDpad() {
    document.querySelectorAll('.dpad-btn[data-dir]').forEach((btn) => {
      const dir = btn.getAttribute('data-dir');
      const startMove = (ev) => {
        ev.preventDefault();
        audio('unlock');
        btn.classList.add('pressed');
        if (ui.screen === 'overworld' && !ui.modal && !ui.dialogue && HM.Overworld) {
          HM.Overworld.setHeldDirection(dir);
        }
      };
      const stopMove = () => {
        btn.classList.remove('pressed');
        if (HM.Overworld) HM.Overworld.setHeldDirection(null);
      };
      btn.addEventListener('pointerdown', startMove);
      btn.addEventListener('pointerup', stopMove);
      btn.addEventListener('pointerleave', stopMove);
      btn.addEventListener('pointercancel', stopMove);
    });

    global.addEventListener('blur', () => {
      if (HM.Overworld) HM.Overworld.setHeldDirection(null);
    });
  }

  function bindGlobalEvents() {
    // Destrava áudio no primeiro gesto
    const unlockOnce = () => {
      audio('unlock');
      global.removeEventListener('pointerdown', unlockOnce);
      global.removeEventListener('keydown', unlockOnce);
    };
    global.addEventListener('pointerdown', unlockOnce);
    global.addEventListener('keydown', unlockOnce);

    // Tela Inicial
    dom.btnContinue.addEventListener('click', handleContinueGame);
    dom.btnNewGame.addEventListener('click', handleNewGameClick);
    const optionsBtn = $('btn-title-options');
    if (optionsBtn) optionsBtn.addEventListener('click', openOptionsModal);
    global.addEventListener('keydown', handleTitleMenuKeys);

    // Tela de Inicial
    dom.btnStarterBack.addEventListener('click', () => {
      audio('playCancel');
      renderTitleScreen();
      showScreen('title');
    });

    // Barra superior Overworld
    dom.btnOpenParty.addEventListener('click', () => openPartyModal());
    dom.btnSidebarParty.addEventListener('click', () => openPartyModal());
    dom.btnOpenBag.addEventListener('click', openBagModal);
    dom.btnOpenDex.addEventListener('click', openDexModal);
    dom.btnOpenTypes.addEventListener('click', openTypesModal);
    dom.btnSaveGame.addEventListener('click', () => {
      if (ui.state && typeof HM.saveGame === 'function') {
        HM.saveGame(ui.state);
        audio('playSelect');
        showToast('💾 Jogo salvo!', 'success');
      }
    });
    dom.btnToggleSound.addEventListener('click', toggleSound);
    dom.btnOpenMenu.addEventListener('click', openMenuModal);

    // Interagir / Diálogo
    dom.btnDpadInteract.addEventListener('click', () => {
      audio('unlock');
      if (ui.dialogue) {
        advanceDialogue();
      } else if (ui.screen === 'overworld' && !ui.modal && HM.Overworld) {
        HM.Overworld.interact();
      }
    });
    dom.dialogueBox.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (ui.dialogue) advanceDialogue();
    });

    // Batalha
    dom.btnBattleTypes.addEventListener('click', openTypesModal);
    dom.btnBattleSound.addEventListener('click', toggleSound);
    dom.btabFight.addEventListener('click', () => {
      if (!ui.battleSnapshot || ui.battleSnapshot.busy || ui.battleSnapshot.mustSwitch) return;
      audio('playSelect');
      ui.battleTab = 'fight';
      ui.pendingBattleItem = null;
      handleBattleStateChange(ui.battleSnapshot);
    });
    dom.btabBag.addEventListener('click', () => {
      if (!ui.battleSnapshot || ui.battleSnapshot.busy || ui.battleSnapshot.mustSwitch) return;
      audio('playSelect');
      ui.battleTab = 'bag';
      ui.pendingBattleItem = null;
      handleBattleStateChange(ui.battleSnapshot);
    });
    dom.btabParty.addEventListener('click', () => {
      if (!ui.battleSnapshot || ui.battleSnapshot.busy) return;
      audio('playSelect');
      ui.battleTab = 'party';
      ui.pendingBattleItem = null;
      handleBattleStateChange(ui.battleSnapshot);
    });
    dom.btabRun.addEventListener('click', () => {
      if (!ui.battleSnapshot || ui.battleSnapshot.busy || ui.battleSnapshot.mustSwitch || !ui.battleSnapshot.isWild) return;
      audio('playSelect');
      HM.Battle && HM.Battle.tryRun();
    });

    // Modais
    dom.modalCloseBtn.addEventListener('click', () => closeModal());
    dom.modalBackdrop.addEventListener('click', (ev) => {
      if (ev.target === dom.modalBackdrop) closeModal();
    });

    // Evolução
    dom.evoConfirmBtn.addEventListener('click', closeEvolutionModal);

    // Teclado Global (fase de captura + stopImmediatePropagation impede vazamento para o Overworld)
    global.addEventListener(
      'keydown',
      (ev) => {
        if (ui.evoResolver) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (!ev.repeat) closeEvolutionModal();
          }
          return;
        }

        if (ui.modal) {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (!ev.repeat) closeModal();
          }
          return;
        }

        if (ui.dialogue) {
          if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'e' || ev.key === 'E') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (!ev.repeat) advanceDialogue();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (!ev.repeat) closeDialogue(false);
          }
          return;
        }

        if (ui.screen === 'overworld') {
          const key = ev.key.toLowerCase();
          // Nota: W/A/S/D ficam livres para o movimento no Overworld
          if (key === 'p') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            openPartyModal();
          } else if (key === 'i') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            openBagModal();
          } else if (key === 'x') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            openDexModal();
          } else if (key === 't') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            openTypesModal();
          } else if (key === 'k') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (ui.state && typeof HM.saveGame === 'function') {
              HM.saveGame(ui.state);
              audio('playSelect');
              showToast('💾 Jogo salvo!', 'success');
            }
          } else if (key === 'm') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            toggleSound();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            openMenuModal();
          }
        }
      },
      true
    );
  }

  function cacheDom() {
    dom.screenTitle = $('screen-title');
    dom.screenStarter = $('screen-starter');
    dom.screenOverworld = $('screen-overworld');
    dom.screenBattle = $('screen-battle');

    dom.titleShowcase = $('title-showcase');
    dom.titleSavePreview = $('title-save-preview');
    dom.btnContinue = $('btn-continue');
    dom.btnNewGame = $('btn-new-game');

    dom.profAvatarCanvas = $('prof-avatar-canvas');
    dom.starterGrid = $('starter-grid');
    dom.btnStarterBack = $('btn-starter-back');

    dom.hudZoneName = $('hud-zone-name');
    dom.hudZoneSub = $('hud-zone-sub');
    dom.hudCoins = $('hud-coins');
    dom.hudBadges = $('hud-badges');
    dom.hudDex = $('hud-dex');
    dom.btnOpenParty = $('btn-open-party');
    dom.btnOpenBag = $('btn-open-bag');
    dom.btnOpenDex = $('btn-open-dex');
    dom.btnOpenTypes = $('btn-open-types');
    dom.btnSaveGame = $('btn-save-game');
    dom.btnToggleSound = $('btn-toggle-sound');
    dom.btnOpenMenu = $('btn-open-menu');

    dom.overworldCanvas = $('overworld-canvas');
    dom.dialogueBox = $('dialogue-box');
    dom.dialoguePortrait = $('dialogue-portrait');
    dom.dialogueSpeaker = $('dialogue-speaker');
    dom.dialoguePage = $('dialogue-page');
    dom.dialogueText = $('dialogue-text');
    dom.dialogueActions = $('dialogue-actions');
    dom.dialogueNextHint = $('dialogue-next-hint');

    dom.questText = $('quest-text');
    dom.sidebarPartyCount = $('sidebar-party-count');
    dom.btnSidebarParty = $('btn-sidebar-party');
    dom.sidebarPartyList = $('sidebar-party-list');
    dom.btnDpadInteract = $('btn-dpad-interact');

    dom.battleCanvas = $('battle-canvas');
    dom.battleTypeBadge = $('battle-type-badge');
    dom.battleHeaderTitle = $('battle-header-title');
    dom.btnBattleTypes = $('btn-battle-types');
    dom.btnBattleSound = $('btn-battle-sound');

    dom.enemyName = $('enemy-name');
    dom.enemyCaughtMark = $('enemy-caught-mark');
    dom.enemyLevel = $('enemy-level');
    dom.enemyTypeBadge = $('enemy-type-badge');
    dom.enemyStatusBadge = $('enemy-status-badge');
    dom.enemyStages = $('enemy-stages');
    dom.enemyPartyDots = $('enemy-party-dots');
    dom.enemyHpFill = $('enemy-hp-fill');
    dom.enemyHpText = $('enemy-hp-text');

    dom.playerName = $('player-name');
    dom.playerLevel = $('player-level');
    dom.playerTypeBadge = $('player-type-badge');
    dom.playerStatusBadge = $('player-status-badge');
    dom.playerStages = $('player-stages');
    dom.playerHpFill = $('player-hp-fill');
    dom.playerHpText = $('player-hp-text');
    dom.playerXpFill = $('player-xp-fill');

    dom.battleMessage = $('battle-message');
    dom.battleBusyDots = $('battle-busy-dots');
    dom.btabFight = $('btab-fight');
    dom.btabBag = $('btab-bag');
    dom.btabParty = $('btab-party');
    dom.btabRun = $('btab-run');
    dom.battleActionPane = $('battle-action-pane');

    dom.modalBackdrop = $('modal-backdrop');
    dom.modalDialog = $('modal-dialog');
    dom.modalTitle = $('modal-title');
    dom.modalSubtitle = $('modal-subtitle');
    dom.modalCloseBtn = $('modal-close-btn');
    dom.modalBody = $('modal-body');
    dom.modalFooter = $('modal-footer');

    dom.evoOverlay = $('evo-overlay');
    dom.evoTitle = $('evo-title');
    dom.evoFromImg = $('evo-from-img');
    dom.evoFromName = $('evo-from-name');
    dom.evoToImg = $('evo-to-img');
    dom.evoToName = $('evo-to-name');
    dom.evoToType = $('evo-to-type');
    dom.evoDesc = $('evo-desc');
    dom.evoConfirmBtn = $('evo-confirm-btn');

    dom.toastContainer = $('toast-container');
  }

  function init() {
    cacheDom();
    applyToolbarIcons();
    bindGlobalEvents();
    bindDpad();
    syncSoundButtons();
    renderTitleScreen();
    showScreen('title');
  }

  HM.UI = {
    showToast,
    refreshOverworldHud,
    openPartyModal,
    openBagModal,
    openDexModal,
    openTypesModal,
    openShopModal,
    openBoxModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
