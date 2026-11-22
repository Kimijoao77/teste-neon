(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  // Tile codes (contrato HM.WORLD):
  // 0=grama, 1=caminho_terra, 2=grama_alta, 3=agua(solido), 4=arvore(solido),
  // 5=cerca(solido), 6=predio(solido), 7=porta(andavel), 8=flores(andavel),
  // 9=piso_estufa(andavel), 10=ponte(andavel), 11=balcao_cura(solido)
  const TILE = {
    GRASS: 0,
    DIRT: 1,
    TALL_GRASS: 2,
    WATER: 3,
    TREE: 4,
    FENCE: 5,
    BUILDING: 6,
    DOOR: 7,
    FLOWERS: 8,
    GREENHOUSE_FLOOR: 9,
    BRIDGE: 10,
    HEAL_COUNTER: 11,
    SAND: 12,
    PALM: 13,
    CAVE_FLOOR: 14,
    ROCK: 15,
    CAVE_GRASS: 16
  };

  const SOLID_TILES = new Set([
    TILE.WATER,
    TILE.TREE,
    TILE.FENCE,
    TILE.BUILDING,
    TILE.HEAL_COUNTER,
    TILE.PALM,
    TILE.ROCK
  ]);

  // Tiles que geram encontros selvagens
  function isEncounterTile(t) {
    return t === TILE.TALL_GRASS || t === TILE.CAVE_GRASS;
  }

  // NPC que some depois de uma insígnia (ex.: Guarda Tom libera a passagem)
  function isNpcHidden(npc) {
    if (!npc || !npc.hideIfBadge) return false;
    const st = state;
    return !!(st && Array.isArray(st.badges) && st.badges.indexOf(npc.hideIfBadge) !== -1);
  }

  const DIR_DELTA = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
  };

  const OPPOSITE_DIR = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left'
  };

  const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);

  const STEP_DURATION_MS = 165;
  const ENCOUNTER_CHANCE = 0.18;
  const ENCOUNTER_COOLDOWN_STEPS = 3;
  const ENCOUNTER_FLASH_MS = 320;
  const TRAINER_ALERT_MS = 380;
  const ZONE_BANNER_MS = 2600;
  const OUTLINE = '#233129';
  const GROUND_TILT = 0.72;

  // Deterministic pseudo-random hash in [0, 1) for (col, row, seed)
  function hash2D(col, row, seed) {
    let h = (col * 374761393 + row * 668265263 + (seed || 0) * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function darkenHex(hex, factor) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#' || (hex.length !== 7 && hex.length !== 4)) {
      return '#6b4c35';
    }
    let r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    r = clamp(Math.round(r * factor), 0, 255);
    g = clamp(Math.round(g * factor), 0, 255);
    b = clamp(Math.round(b * factor), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function lightenHex(hex, amount) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#' || (hex.length !== 7 && hex.length !== 4)) {
      return '#fffdf5';
    }
    let r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    r = clamp(Math.round(r + (255 - r) * amount), 0, 255);
    g = clamp(Math.round(g + (255 - g) * amount), 0, 255);
    b = clamp(Math.round(b + (255 - b) * amount), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Compatible state position reader/writer across possible save schemas
  function readPlayerPosFromState(st, world) {
    const fallback = (world && world.spawn) || { x: 4, y: 4, dir: 'down' };
    if (st) {
      if (st.player && typeof st.player.x === 'number' && typeof st.player.y === 'number') {
        return { x: st.player.x, y: st.player.y, dir: VALID_DIRS.has(st.player.dir) ? st.player.dir : 'down' };
      }
      if (st.pos && typeof st.pos.x === 'number' && typeof st.pos.y === 'number') {
        return { x: st.pos.x, y: st.pos.y, dir: VALID_DIRS.has(st.pos.dir) ? st.pos.dir : 'down' };
      }
      if (st.position && typeof st.position.x === 'number' && typeof st.position.y === 'number') {
        return { x: st.position.x, y: st.position.y, dir: VALID_DIRS.has(st.position.dir) ? st.position.dir : 'down' };
      }
      if (typeof st.x === 'number' && typeof st.y === 'number') {
        return { x: st.x, y: st.y, dir: VALID_DIRS.has(st.dir) ? st.dir : 'down' };
      }
    }
    return {
      x: fallback.x,
      y: fallback.y,
      dir: VALID_DIRS.has(fallback.dir) ? fallback.dir : 'down'
    };
  }

  function syncPlayerPosToState(st, x, y, dir) {
    if (!st) return;
    if (st.player && typeof st.player === 'object') {
      st.player.x = x;
      st.player.y = y;
      st.player.dir = dir;
    } else if (st.pos && typeof st.pos === 'object') {
      st.pos.x = x;
      st.pos.y = y;
      st.pos.dir = dir;
    } else if (st.position && typeof st.position === 'object') {
      st.position.x = x;
      st.position.y = y;
      st.position.dir = dir;
    } else if (typeof st.x === 'number' && typeof st.y === 'number') {
      st.x = x;
      st.y = y;
      st.dir = dir;
    } else {
      st.player = { x: x, y: y, dir: dir };
    }
  }

  function isNpcDefeated(st, npc) {
    if (!st || !npc) return false;
    const id = npc.id;
    const sources = [
      st.defeatedTrainers,
      st.defeated,
      st.trainersDefeated,
      st.flags && st.flags.defeatedTrainers
    ];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (!src) continue;
      if (Array.isArray(src) && src.indexOf(id) !== -1) return true;
      if (src instanceof Set && src.has(id)) return true;
      if (typeof src === 'object' && !Array.isArray(src) && src[id]) return true;
    }
    if (npc.role === 'leader' && npc.badge && Array.isArray(st.badges)) {
      if (st.badges.indexOf(npc.badge) !== -1) return true;
    }
    return false;
  }

  // Fallback character renderer if HM.Sprites.drawCharacter is absent
  function drawFallbackCharacter(ctx, cx, cy, size, style, dir, walkFrame) {
    const bob = Math.abs(Math.sin(walkFrame * Math.PI * 0.5)) * 2.5;
    const r = size * 0.34;
    ctx.save();
    ctx.translate(cx, cy - bob);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    ctx.lineJoin = 'round';

    const colors = {
      player: '#789263',
      prof: '#f8fafc',
      healer: '#c78993',
      shop: '#f59e0b',
      box: '#38bdf8',
      trainer: '#fb923c',
      leader: '#eab308',
      sign: '#a16207'
    };
    const bodyColor = colors[style] || '#789263';

    if (style === 'sign') {
      ctx.fillStyle = '#68543e';
      ctx.fillRect(-4, 0, 8, r * 1.05);
      ctx.strokeRect(-4, 0, 8, r * 1.05);
      ctx.fillStyle = '#d4a373';
      roundRectPath(ctx, -r * 0.95, -r * 0.9, r * 1.9, r * 1.15, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Body
    ctx.fillStyle = bodyColor;
    roundRectPath(ctx, -r * 0.72, -r * 0.05, r * 1.44, r * 1.05, 6);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = '#fde2c4';
    ctx.beginPath();
    ctx.arc(0, -r * 0.42, r * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eyes based on facing
    if (dir !== 'up') {
      const ex = dir === 'left' ? -3 : dir === 'right' ? 3 : 0;
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      ctx.arc(-4 + ex, -r * 0.42, 2.2, 0, Math.PI * 2);
      ctx.arc(4 + ex, -r * 0.42, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Runtime engine singleton state
  let canvas = null;
  let ctx = null;
  let state = null;
  let callbacks = {};
  let world = null;

  let initialized = false;
  let paused = false;
  let rafId = null;
  let lastFrameTime = 0;
  let elapsedTime = 0;

  // Player state
  const player = {
    x: 0,
    y: 0,
    fromX: 0,
    fromY: 0,
    renderX: 0,
    renderY: 0,
    dir: 'down',
    moving: false,
    stepElapsed: 0,
    walkCycle: 0,
    walkFrame: 0
  };

  // Camera
  const camera = { x: 0, y: 0, snapped: false };
  const viewport = { width: 768, height: 480, scaleX: 1, scaleY: 1 };

  function syncViewport() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return false;
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    const zoom = clamp(width / 620, 0.9, 1.28);
    viewport.width = width / zoom;
    viewport.height = height / zoom;
    viewport.scaleX = pixelWidth / viewport.width;
    viewport.scaleY = pixelHeight / viewport.height;
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      camera.snapped = false;
    }
    return true;
  }

  // Zone tracking & banner
  let currentZone = null;
  let zoneBanner = null; // { name, subtitle, elapsed }

  // Controls
  let keyDirStack = [];
  let heldDpadDir = null;
  let pointerDown = false;
  let pointerClientX = 0;
  let pointerClientY = 0;
  let pointerDownTime = 0;
  let pointerMoved = false;
  let clickPath = []; // array of { x, y }
  let clickInteractNpc = null;

  // Wild encounters & trainer sight
  let tallGrassCooldown = 2;
  let encounterPending = null; // { elapsed, wildCreature, zone }
  let trainerAlert = null; // { npc, elapsed }
  const trainerSightCooldowns = Object.create(null);
  const npcFacingOverrides = Object.create(null);

  // Effects & ambient life
  let particles = [];
  let butterflies = [];
  let pollen = [];

  // Minimap
  let minimapCanvas = null;
  let minimapCompact = false;
  const minimapRect = { x: 0, y: 0, w: 124, h: 90 };

  // Building footprint lookup for tile 6 detection
  let buildingTileSet = new Set();

  // Bound event listener references
  let onKeyDownBound = null;
  let onKeyUpBound = null;
  let onWindowBlurBound = null;
  let onPointerDownBound = null;
  let onPointerMoveBound = null;
  let onPointerUpBound = null;

  function getTile(col, row) {
    if (!world || !world.tiles) return TILE.TREE;
    if (row < 0 || row >= world.rows || col < 0 || col >= world.cols) return TILE.TREE;
    const r = world.tiles[row];
    return r && r[col] !== undefined ? r[col] : TILE.GRASS;
  }

  function getNpcAt(col, row) {
    if (!world || !Array.isArray(world.npcs)) return null;
    for (let i = 0; i < world.npcs.length; i++) {
      const n = world.npcs[i];
      if (isNpcHidden(n)) continue;
      if (n.x === col && n.y === row) return n;
    }
    return null;
  }

  function isWalkable(col, row) {
    if (!world) return false;
    if (col < 0 || col >= world.cols || row < 0 || row >= world.rows) return false;
    const t = getTile(col, row);
    if (SOLID_TILES.has(t)) return false;
    if (getNpcAt(col, row)) return false;
    return true;
  }

  function buildWorldCaches() {
    buildingTileSet = new Set();
    if (world && Array.isArray(world.buildings)) {
      for (let i = 0; i < world.buildings.length; i++) {
        const b = world.buildings[i];
        for (let r = b.y; r < b.y + b.h; r++) {
          for (let c = b.x; c < b.x + b.w; c++) {
            buildingTileSet.add(c + ',' + r);
          }
        }
      }
    }
    buildMinimapCache();
    initAmbientLife();
  }

  function buildMinimapCache() {
    if (!world || typeof document === 'undefined') {
      minimapCanvas = null;
      return;
    }
    const scale = 3;
    const off = document.createElement('canvas');
    off.width = world.cols * scale;
    off.height = world.rows * scale;
    const mctx = off.getContext('2d');
    if (!mctx) return;

    const palette = {
      [TILE.GRASS]: '#78c850',
      [TILE.DIRT]: '#e5c088',
      [TILE.TALL_GRASS]: '#3a8f34',
      [TILE.WATER]: '#38bdf8',
      [TILE.TREE]: '#266d32',
      [TILE.FENCE]: '#9a6332',
      [TILE.BUILDING]: '#c2594a',
      [TILE.DOOR]: '#d6b872',
      [TILE.FLOWERS]: '#c78993',
      [TILE.GREENHOUSE_FLOOR]: '#efe3c6',
      [TILE.BRIDGE]: '#b57a44',
      [TILE.HEAL_COUNTER]: '#fb7185',
      [TILE.SAND]: '#fde68a',
      [TILE.PALM]: '#15803d',
      [TILE.CAVE_FLOOR]: '#6b5a7a',
      [TILE.ROCK]: '#3f3450',
      [TILE.CAVE_GRASS]: '#7e22ce'
    };

    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        const t = getTile(c, r);
        mctx.fillStyle = palette[t] || '#78c850';
        mctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }

    if (Array.isArray(world.buildings)) {
      for (let i = 0; i < world.buildings.length; i++) {
        const b = world.buildings[i];
        mctx.fillStyle = b.roofColor || '#d9534f';
        mctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
        mctx.strokeStyle = 'rgba(43,29,20,0.65)';
        mctx.lineWidth = 1;
        mctx.strokeRect(b.x * scale + 0.5, b.y * scale + 0.5, b.w * scale - 1, b.h * scale - 1);
      }
    }

    minimapCanvas = off;
  }

  function initAmbientLife() {
    butterflies = [];
    pollen = [];
    if (!world) return;
    const S = world.tileSize || 48;
    const worldW = world.cols * S;
    const worldH = world.rows * S;

    // Collect flower tiles to spawn butterflies near flowers
    const flowerSpots = [];
    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        if (getTile(c, r) === TILE.FLOWERS) {
          flowerSpots.push({ x: (c + 0.5) * S, y: (r + 0.5) * S });
        }
      }
    }

    const wingColors = ['#fde047', '#c78993', '#60a5fa', '#fb923c', '#ffffff'];
    const count = Math.min(7, Math.max(4, Math.floor(flowerSpots.length / 4)));
    for (let i = 0; i < count; i++) {
      const anchor = flowerSpots.length > 0
        ? flowerSpots[Math.floor((i * 7 + 3) % flowerSpots.length)]
        : { x: worldW * (0.15 + 0.7 * hash2D(i, 1, 9)), y: worldH * (0.15 + 0.7 * hash2D(i, 2, 9)) };
      butterflies.push({
        anchorX: anchor.x,
        anchorY: anchor.y,
        x: anchor.x,
        y: anchor.y,
        phase: i * 1.73,
        speed: 0.7 + (i % 3) * 0.25,
        radiusX: 38 + (i % 4) * 18,
        radiusY: 26 + (i % 3) * 14,
        color: wingColors[i % wingColors.length]
      });
    }

    for (let i = 0; i < 22; i++) {
      pollen.push({
        x: hash2D(i, 11, 3) * worldW,
        y: hash2D(i, 23, 5) * worldH,
        vx: 6 + hash2D(i, 7, 1) * 10,
        vy: -3 + hash2D(i, 13, 2) * 6,
        size: 1.8 + hash2D(i, 19, 4) * 2.2,
        phase: hash2D(i, 31, 8) * Math.PI * 2
      });
    }
  }

  function spawnLeafParticles(col, row, count, palette) {
    if (!world) return;
    const S = world.tileSize || 48;
    const cx = (col + 0.5) * S;
    const cy = (row + 0.55) * S;
    const colors = palette || ['#83a87e', '#789263', '#9ba97e', '#567655'];
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const spd = 28 + Math.random() * 52;
      particles.push({
        kind: 'leaf',
        x: cx + (Math.random() - 0.5) * 22,
        y: cy + (Math.random() - 0.5) * 14,
        vx: Math.cos(ang) * spd + (Math.random() - 0.5) * 20,
        vy: Math.sin(ang) * spd - 14,
        gravity: 95,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 7,
        size: 4 + Math.random() * 3.5,
        color: colors[i % colors.length],
        life: 0,
        maxLife: 0.45 + Math.random() * 0.3
      });
    }
  }

  function spawnDustPuff(col, row) {
    if (!world) return;
    const S = world.tileSize || 48;
    const cx = (col + 0.5) * S;
    const cy = (row + 0.78) * S;
    for (let i = 0; i < 3; i++) {
      particles.push({
        kind: 'dust',
        x: cx + (Math.random() - 0.5) * 12,
        y: cy + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 14,
        gravity: 10,
        size: 3.5 + Math.random() * 2.5,
        color: '#f3dfb9',
        life: 0,
        maxLife: 0.34 + Math.random() * 0.14
      });
    }
  }

  function spawnTeleportSparkles(col, row) {
    if (!world) return;
    const S = world.tileSize || 48;
    const cx = (col + 0.5) * S;
    const cy = (row + 0.5) * S;
    const colors = ['#fde047', '#9ba97e', '#ffffff', '#38bdf8'];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      particles.push({
        kind: 'sparkle',
        x: cx + Math.cos(ang) * 10,
        y: cy + Math.sin(ang) * 8,
        vx: Math.cos(ang) * 42,
        vy: Math.sin(ang) * 32 - 20,
        gravity: 20,
        size: 4.5,
        color: colors[i % colors.length],
        life: 0,
        maxLife: 0.55
      });
    }
  }

  function updateZone(col, row, showBanner) {
    if (!world || typeof world.getZoneAt !== 'function') return;
    const z = world.getZoneAt(col, row);
    if (!z) return;
    if (state) {
      state.zone = z.id;
    }
    const prevId = currentZone ? currentZone.id : null;
    if (z.id !== prevId) {
      currentZone = z;
      if (showBanner !== false) {
        zoneBanner = {
          name: z.name || z.id,
          subtitle: z.subtitle || '',
          elapsed: 0
        };
      }
      if (callbacks && typeof callbacks.onZoneChange === 'function') {
        try {
          callbacks.onZoneChange(z);
        } catch (err) {
          console.error('[Overworld] onZoneChange error:', err);
        }
      }
    }
  }

  function cameraTarget(position, span, worldSpan) {
    return worldSpan <= span
      ? (worldSpan - span) / 2
      : clamp(position - span / 2, 0, worldSpan - span);
  }

  function updateCamera(dt, snap = false) {
    if (!canvas || !world) return;
    const S = world.tileSize || 48;
    const x = cameraTarget((player.renderX + 0.5) * S, viewport.width, world.cols * S);
    const y = cameraTarget((player.renderY + 0.5) * S, viewport.height / GROUND_TILT, world.rows * S);
    const alpha = snap || !camera.snapped ? 1 : 1 - Math.exp(-dt * 11);
    camera.x += (x - camera.x) * alpha;
    camera.y += (y - camera.y) * alpha;
    camera.snapped = true;
  }

  function clearInputs() {
    keyDirStack = [];
    heldDpadDir = null;
    pointerDown = false;
    clickPath = [];
    clickInteractNpc = null;
  }

  function getPointerHoldDirection() {
    if (!pointerDown || !canvas || !world) return null;
    // Wait briefly so quick taps trigger click-to-walk rather than immediate hold drift
    if (performance.now() - pointerDownTime < 140 && !pointerMoved) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const cx = ((pointerClientX - rect.left) / rect.width) * viewport.width;
    const cy = ((pointerClientY - rect.top) / rect.height) * viewport.height;
    const S = world.tileSize || 48;
    const playerScreenX = (player.renderX + 0.5) * S - Math.round(camera.x);
    const playerScreenY = (player.renderY + 0.5) * S - Math.round(camera.y);
    const dx = cx - playerScreenX;
    const dy = cy / GROUND_TILT - playerScreenY;
    if (Math.hypot(dx, dy) < S * 0.42) return null;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  function getDesiredDirection() {
    if (heldDpadDir && VALID_DIRS.has(heldDpadDir)) {
      clickPath = [];
      clickInteractNpc = null;
      return heldDpadDir;
    }
    if (keyDirStack.length > 0) {
      clickPath = [];
      clickInteractNpc = null;
      return keyDirStack[keyDirStack.length - 1];
    }
    const ptrDir = getPointerHoldDirection();
    if (ptrDir) {
      clickPath = [];
      clickInteractNpc = null;
      return ptrDir;
    }
    if (clickPath.length > 0) {
      const next = clickPath[0];
      const dx = next.x - player.x;
      const dy = next.y - player.y;
      if (dx === 1 && dy === 0) return 'right';
      if (dx === -1 && dy === 0) return 'left';
      if (dx === 0 && dy === 1) return 'down';
      if (dx === 0 && dy === -1) return 'up';
      clickPath = [];
    }
    return null;
  }

  // Lightweight BFS pathfinding on small map (<= 14 steps) for tap-to-walk
  function computePath(startX, startY, goalX, goalY, stopAdjacent) {
    if (!world) return [];
    const maxNodes = 420;
    const cols = world.cols;
    const rows = world.rows;
    const visited = new Uint8Array(cols * rows);
    const parent = new Int32Array(cols * rows);
    parent.fill(-1);

    const startIdx = startY * cols + startX;
    visited[startIdx] = 1;
    const queue = [startIdx];
    let head = 0;
    let foundIdx = -1;

    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0]
    ];

    while (head < queue.length && head < maxNodes) {
      const cur = queue[head++];
      const cx = cur % cols;
      const cy = (cur - cx) / cols;

      if (stopAdjacent) {
        if (Math.abs(cx - goalX) + Math.abs(cy - goalY) === 1) {
          foundIdx = cur;
          break;
        }
        // Also allow stopping across a healing counter from an NPC
        const dx = goalX - cx;
        const dy = goalY - cy;
        if ((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0)) {
          const midTile = getTile(cx + dx / 2, cy + dy / 2);
          if (midTile === TILE.HEAL_COUNTER) {
            foundIdx = cur;
            break;
          }
        }
      } else if (cx === goalX && cy === goalY) {
        foundIdx = cur;
        break;
      }

      for (let i = 0; i < 4; i++) {
        const nx = cx + dirs[i][0];
        const ny = cy + dirs[i][1];
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const nIdx = ny * cols + nx;
        if (visited[nIdx]) continue;
        if (!isWalkable(nx, ny)) continue;
        visited[nIdx] = 1;
        parent[nIdx] = cur;
        queue.push(nIdx);
      }
    }

    if (foundIdx === -1) return [];
    const path = [];
    let p = foundIdx;
    while (p !== -1 && p !== startIdx) {
      const px = p % cols;
      const py = (p - px) / cols;
      path.push({ x: px, y: py });
      p = parent[p];
    }
    path.reverse();
    return path.length <= 18 ? path : path.slice(0, 18);
  }

  function findInteractableTarget() {
    if (!world) return null;
    const d = DIR_DELTA[player.dir] || DIR_DELTA.down;
    const fx = player.x + d.dx;
    const fy = player.y + d.dy;

    // 1. NPC directly in front
    let npc = getNpcAt(fx, fy);
    if (npc) return { npc: npc, faceDir: player.dir };

    // 2. NPC behind a healing counter (tile 11) directly in front
    if (getTile(fx, fy) === TILE.HEAL_COUNTER) {
      npc = getNpcAt(fx + d.dx, fy + d.dy);
      if (npc) return { npc: npc, faceDir: player.dir };
    }

    // 3. Any adjacent NPC (or across adjacent counter) — turns player toward them
    const order = ['up', 'down', 'left', 'right'];
    for (let i = 0; i < order.length; i++) {
      const dir = order[i];
      const delta = DIR_DELTA[dir];
      const nx = player.x + delta.dx;
      const ny = player.y + delta.dy;
      const adj = getNpcAt(nx, ny);
      if (adj) return { npc: adj, faceDir: dir };
      if (getTile(nx, ny) === TILE.HEAL_COUNTER) {
        const behind = getNpcAt(nx + delta.dx, ny + delta.dy);
        if (behind) return { npc: behind, faceDir: dir };
      }
    }

    // 4. Facing or standing on a door tile with a matching building
    const doorCheckCoords = [
      { x: fx, y: fy },
      { x: player.x, y: player.y }
    ];
    if (Array.isArray(world.buildings)) {
      for (let dIdx = 0; dIdx < doorCheckCoords.length; dIdx++) {
        const dc = doorCheckCoords[dIdx];
        if (getTile(dc.x, dc.y) !== TILE.DOOR) continue;
        for (let i = 0; i < world.buildings.length; i++) {
          const b = world.buildings[i];
          if (b.doorX === dc.x && b.doorY === dc.y) {
            const nearNpc = getNpcAt(b.doorX, b.doorY - 1) || getNpcAt(b.doorX, b.doorY + 1);
            if (nearNpc) return { npc: nearNpc, faceDir: player.dir };
            return {
              npc: {
                id: 'door_' + i,
                name: b.label || 'Entrada',
                role: 'sign',
                x: dc.x,
                y: dc.y,
                dir: 'down',
                dialogue: 'Você está na entrada de ' + (b.label || 'um local acolhedor') + '. Converse com quem cuida do lugar logo ao lado!'
              },
              faceDir: player.dir
            };
          }
        }
      }
    }

    return null;
  }

  function triggerNpcInteract(npc, faceDir) {
    if (!npc) return;
    if (faceDir && VALID_DIRS.has(faceDir)) {
      player.dir = faceDir;
      syncPlayerPosToState(state, player.x, player.y, player.dir);
    }
    if (npc.role !== 'sign' && npc.role !== 'box') {
      const dx = player.x - npc.x;
      const dy = player.y - npc.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        npcFacingOverrides[npc.id] = dx > 0 ? 'right' : 'left';
      } else {
        npcFacingOverrides[npc.id] = dy > 0 ? 'down' : 'up';
      }
    }
    clearInputs();
    if (HM.Audio && typeof HM.Audio.playSelect === 'function') {
      HM.Audio.playSelect();
    }
    if (callbacks && typeof callbacks.onNpcInteract === 'function') {
      try {
        callbacks.onNpcInteract(npc);
      } catch (err) {
        console.error('[Overworld] onNpcInteract error:', err);
      }
    }
  }

  function pickWeightedWild(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    let total = 0;
    for (let i = 0; i < pool.length; i++) {
      total += Math.max(0.01, Number(pool[i].weight) || 1);
    }
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= Math.max(0.01, Number(pool[i].weight) || 1);
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function hasAlivePartyMember() {
    if (!state || !Array.isArray(state.party) || state.party.length === 0) return true;
    for (let i = 0; i < state.party.length; i++) {
      if (state.party[i] && state.party[i].hp > 0) return true;
    }
    return false;
  }

  function checkWildEncounter() {
    if (!isEncounterTile(getTile(player.x, player.y))) return false;
    if (tallGrassCooldown > 0) {
      tallGrassCooldown--;
      return false;
    }
    if (!hasAlivePartyMember()) return false;
    const zone = currentZone || (world && typeof world.getZoneAt === 'function' ? world.getZoneAt(player.x, player.y) : null);
    if (!zone || !Array.isArray(zone.wildPool) || zone.wildPool.length === 0) return false;
    if (typeof HM.createCreature !== 'function') return false;

    if (Math.random() >= ENCOUNTER_CHANCE) return false;

    const entry = pickWeightedWild(zone.wildPool);
    if (!entry) return false;
    const minLv = Math.max(1, Number(entry.minLv) || 2);
    const maxLv = Math.max(minLv, Number(entry.maxLv) || minLv);
    const level = minLv + Math.floor(Math.random() * (maxLv - minLv + 1));
    const wildCreature = HM.createCreature(entry.speciesId, level);
    if (!wildCreature) return false;

    tallGrassCooldown = ENCOUNTER_COOLDOWN_STEPS;
    clearInputs();
    if (HM.Audio && typeof HM.Audio.playEncounter === 'function') {
      HM.Audio.playEncounter();
    }
    encounterPending = {
      elapsed: 0,
      wildCreature: wildCreature,
      zone: zone
    };
    return true;
  }

  function checkTrainerSight() {
    if (!world || !Array.isArray(world.npcs)) return false;
    if (!hasAlivePartyMember()) return false;
    const now = performance.now();
    for (let i = 0; i < world.npcs.length; i++) {
      const npc = world.npcs[i];
      if (isNpcHidden(npc)) continue;
      // Only regular undefeated trainers auto-spot at 1 tile directly in front;
      // Leader Flora lets the player approach & challenge when ready!
      if (npc.role !== 'trainer') continue;
      if (isNpcDefeated(state, npc)) continue;
      if (trainerSightCooldowns[npc.id] && now < trainerSightCooldowns[npc.id]) continue;

      const d = DIR_DELTA[npc.dir] || DIR_DELTA.down;
      if (player.x === npc.x + d.dx && player.y === npc.y + d.dy) {
        trainerSightCooldowns[npc.id] = now + 5000;
        clearInputs();
        player.dir = OPPOSITE_DIR[npc.dir] || 'up';
        syncPlayerPosToState(state, player.x, player.y, player.dir);
        if (HM.Audio && typeof HM.Audio.playSelect === 'function') {
          HM.Audio.playSelect();
        }
        trainerAlert = { npc: npc, elapsed: 0 };
        return true;
      }
    }
    return false;
  }

  function tryStartStep(dir) {
    if (!VALID_DIRS.has(dir)) return false;
    const d = DIR_DELTA[dir];
    const nx = player.x + d.dx;
    const ny = player.y + d.dy;

    player.dir = dir;
    syncPlayerPosToState(state, player.x, player.y, player.dir);

    if (!isWalkable(nx, ny)) {
      // If click-walking got blocked, clear clickPath
      clickPath = [];
      return false;
    }

    player.fromX = player.x;
    player.fromY = player.y;
    player.x = nx;
    player.y = ny;
    player.moving = true;
    player.stepElapsed = 0;

    if (clickPath.length > 0 && clickPath[0].x === nx && clickPath[0].y === ny) {
      clickPath.shift();
    }

    // Subtle trail effects on departure/entry
    const destTile = getTile(nx, ny);
    if (destTile === TILE.TALL_GRASS) {
      spawnLeafParticles(nx, ny, 6);
    } else if (destTile === TILE.CAVE_GRASS) {
      spawnLeafParticles(nx, ny, 6, ['#c084fc', '#a78bfa', '#22d3ee', '#e9d5ff']);
    } else if (destTile === TILE.FLOWERS) {
      spawnLeafParticles(nx, ny, 4, ['#f9a8d4', '#fde047', '#9ba97e', '#fbcfe8']);
    } else if (destTile === TILE.DIRT) {
      spawnDustPuff(player.fromX, player.fromY);
    }

    if (HM.Audio && typeof HM.Audio.playStep === 'function') {
      HM.Audio.playStep();
    }
    return true;
  }

  function onStepFinished() {
    player.moving = false;
    player.renderX = player.x;
    player.renderY = player.y;
    syncPlayerPosToState(state, player.x, player.y, player.dir);
    if (state && state.stats && typeof state.stats.steps === 'number') {
      state.stats.steps += 1;
    }

    updateZone(player.x, player.y, true);

    if (callbacks && typeof callbacks.onStep === 'function') {
      try {
        callbacks.onStep(player.x, player.y);
      } catch (err) {
        console.error('[Overworld] onStep error:', err);
      }
    }

    // Check wild encounter first
    if (checkWildEncounter()) return;

    // Check trainer 1-tile sight alert
    if (checkTrainerSight()) return;

    // If tap-to-interact reached adjacent tile of target NPC
    if (clickInteractNpc && clickPath.length === 0) {
      const target = clickInteractNpc;
      clickInteractNpc = null;
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      let canTalk = dist === 1;
      if (!canTalk && dist === 2 && (dx === 0 || dy === 0)) {
        if (getTile(player.x + dx / 2, player.y + dy / 2) === TILE.HEAL_COUNTER) {
          canTalk = true;
        }
      }
      if (canTalk) {
        const faceDir = Math.abs(dx) >= Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up');
        triggerNpcInteract(target, faceDir);
      }
    }
  }

  function updateSimulation(dt) {
    elapsedTime += dt * 1000;

    // Update ambient particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vrot) p.rot += p.vrot * dt;
    }

    // Update ambient butterflies & pollen
    const tSec = elapsedTime * 0.001;
    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];
      const ang = tSec * b.speed + b.phase;
      b.x = b.anchorX + Math.sin(ang) * b.radiusX;
      b.y = b.anchorY + Math.sin(ang * 1.6) * b.radiusY;
    }
    if (world) {
      const S = world.tileSize || 48;
      const worldW = world.cols * S;
      const worldH = world.rows * S;
      for (let i = 0; i < pollen.length; i++) {
        const m = pollen[i];
        m.x += m.vx * dt;
        m.y += (m.vy + Math.sin(tSec * 1.4 + m.phase) * 5) * dt;
        if (m.x > worldW) m.x -= worldW;
        if (m.y < 0) m.y += worldH;
        if (m.y > worldH) m.y -= worldH;
      }
    }

    // Zone banner timer
    if (zoneBanner) {
      zoneBanner.elapsed += dt * 1000;
      if (zoneBanner.elapsed >= ZONE_BANNER_MS) {
        zoneBanner = null;
      }
    }

    // Encounter flash transition
    if (encounterPending) {
      encounterPending.elapsed += dt * 1000;
      if (encounterPending.elapsed >= ENCOUNTER_FLASH_MS) {
        const payload = encounterPending;
        encounterPending = null;
        if (callbacks && typeof callbacks.onEncounter === 'function') {
          try {
            callbacks.onEncounter(payload.wildCreature, payload.zone);
          } catch (err) {
            console.error('[Overworld] onEncounter error:', err);
          }
        }
      }
      updateCamera(dt);
      return;
    }

    // Trainer exclamation transition
    if (trainerAlert) {
      trainerAlert.elapsed += dt * 1000;
      if (trainerAlert.elapsed >= TRAINER_ALERT_MS) {
        const npc = trainerAlert.npc;
        trainerAlert = null;
        triggerNpcInteract(npc, player.dir);
      }
      updateCamera(dt);
      return;
    }

    if (paused) {
      updateCamera(dt);
      return;
    }

    // Player tile-to-tile movement
    if (player.moving) {
      player.stepElapsed += dt * 1000;
      player.walkCycle += dt * 10.5;
      player.walkFrame = Math.floor(player.walkCycle) % 4;

      if (player.stepElapsed >= STEP_DURATION_MS) {
        const overflow = player.stepElapsed - STEP_DURATION_MS;
        onStepFinished();

        // Seamless continuous stepping if still holding a direction
        if (!paused && !encounterPending && !trainerAlert) {
          const nextDir = getDesiredDirection();
          if (nextDir && tryStartStep(nextDir)) {
            player.stepElapsed = Math.min(overflow, STEP_DURATION_MS * 0.5);
            const t = player.stepElapsed / STEP_DURATION_MS;
            player.renderX = player.fromX + (player.x - player.fromX) * t;
            player.renderY = player.fromY + (player.y - player.fromY) * t;
          } else {
            player.walkFrame = 0;
          }
        } else {
          player.walkFrame = 0;
        }
      } else {
        const t = player.stepElapsed / STEP_DURATION_MS;
        player.renderX = player.fromX + (player.x - player.fromX) * t;
        player.renderY = player.fromY + (player.y - player.fromY) * t;
      }
    } else {
      const dir = getDesiredDirection();
      if (dir) {
        if (tryStartStep(dir)) {
          player.walkFrame = 1;
        } else {
          player.walkFrame = 0;
        }
      } else {
        player.walkFrame = 0;
      }
    }

    updateCamera(dt);
  }

  // ==================== RENDERING ====================

  function drawGrassTile(ctx, px, py, col, row, S) {
    const h = hash2D(col, row, 1);
    ctx.fillStyle = h > 0.56 ? '#57744a' : '#58764a';
    ctx.fillRect(px, py, S, S);

    // Subtle sunlit patch
    if (h > 0.68) {
      ctx.fillStyle = 'rgba(185, 191, 127, 0.16)';
      ctx.beginPath();
      ctx.ellipse(px + S * (0.3 + (h * 0.4) % 0.4), py + S * 0.5, S * 0.34, S * 0.22, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cute deterministic cartoon grass tufts
    if (h < 0.36) {
      const tx = px + 10 + hash2D(col, row, 2) * (S - 20);
      const ty = py + 16 + hash2D(col, row, 3) * (S - 24);
      ctx.strokeStyle = '#435e3d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx - 4, ty - 6, tx - 6, ty - 8);
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + 1, ty - 7, tx + 1, ty - 10);
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + 5, ty - 6, tx + 7, ty - 7);
      ctx.stroke();
    } else if (h > 0.86) {
      // Pedrinhas nas áreas de gramado.
      const cx = px + 12 + hash2D(col, row, 4) * (S - 24);
      const cy = py + 12 + hash2D(col, row, 5) * (S - 24);
      ctx.fillStyle = '#476343';
      ctx.beginPath();
      ctx.arc(cx - 2.5, cy, 2.3, 0, Math.PI * 2);
      ctx.arc(cx + 2.5, cy, 2.3, 0, Math.PI * 2);
      ctx.arc(cx, cy - 2.5, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function isPathLike(tile) {
    return (
      tile === TILE.DIRT ||
      tile === TILE.BRIDGE ||
      tile === TILE.DOOR ||
      tile === TILE.GREENHOUSE_FLOOR ||
      tile === TILE.SAND
    );
  }

  function drawDirtTile(ctx, px, py, col, row, S) {
    // Base warm dirt
    ctx.fillStyle = '#b2a07c';
    ctx.fillRect(px, py, S, S);

    // Subtle soft dirt variation
    const h = hash2D(col, row, 10);
    if (h > 0.45) {
      ctx.fillStyle = 'rgba(98, 79, 52, 0.13)';
      ctx.beginPath();
      ctx.ellipse(px + S * 0.5, py + S * 0.52, S * 0.32, S * 0.22, h * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft organic edges against grass/other terrain
    const up = isPathLike(getTile(col, row - 1));
    const down = isPathLike(getTile(col, row + 1));
    const left = isPathLike(getTile(col - 1, row));
    const right = isPathLike(getTile(col + 1, row));

    ctx.fillStyle = '#58764a';
    if (!up) {
      ctx.fillRect(px, py, S, 4);
      ctx.fillStyle = '#89775b';
      ctx.fillRect(px, py + 4, S, 2);
      ctx.fillStyle = '#58764a';
    }
    if (!down) {
      ctx.fillRect(px, py + S - 4, S, 4);
      ctx.fillStyle = '#89775b';
      ctx.fillRect(px, py + S - 6, S, 2);
      ctx.fillStyle = '#58764a';
    }
    if (!left) {
      ctx.fillRect(px, py, 4, S);
      ctx.fillStyle = '#89775b';
      ctx.fillRect(px + 4, py, 2, S);
      ctx.fillStyle = '#58764a';
    }
    if (!right) {
      ctx.fillRect(px + S - 4, py, 4, S);
      ctx.fillStyle = '#89775b';
      ctx.fillRect(px + S - 6, py, 2, S);
    }

    // Warm pebbles
    if (h < 0.55) {
      const rx = px + 11 + hash2D(col, row, 11) * (S - 22);
      const ry = py + 11 + hash2D(col, row, 12) * (S - 22);
      ctx.fillStyle = '#cca064';
      ctx.beginPath();
      ctx.ellipse(rx, ry, 3.4, 2.2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5dfb8';
      ctx.beginPath();
      ctx.arc(rx - 0.8, ry - 0.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    if (h > 0.72) {
      const rx2 = px + 12 + hash2D(col, row, 13) * (S - 24);
      const ry2 = py + 12 + hash2D(col, row, 14) * (S - 24);
      ctx.fillStyle = '#d4aa70';
      ctx.beginPath();
      ctx.arc(rx2, ry2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTallGrassBase(ctx, px, py, col, row, S, time) {
    drawGrassTile(ctx, px, py, col, row, S);
    // Lush darker meadow cushion
    ctx.fillStyle = '#4ba636';
    roundRectPath(ctx, px + 3, py + 4, S - 6, S - 7, 10);
    ctx.fill();

    // Back row of tall swaying blades
    const sway = Math.sin(time * 0.0028 + col * 0.65 + row * 0.35) * 3.4;
    drawTallGrassBladeRow(ctx, px, py + S * 0.44, col, row, S, sway, '#297a2c', '#57bd42', 0);
  }

  function drawTallGrassFront(ctx, px, py, col, row, S, time) {
    const sway = Math.sin(time * 0.0028 + col * 0.65 + row * 0.35 + 0.6) * 3.8;
    drawTallGrassBladeRow(ctx, px, py + S * 0.82, col, row, S, sway, '#2f8c31', '#7ae057', 1);
  }

  function drawTallGrassBladeRow(ctx, px, baseY, col, row, S, sway, darkCol, lightCol, rowIdx, midCol, strokeCol) {
    const blades = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < blades; i++) {
      const bx = px + 8 + i * ((S - 16) / (blades - 1)) + (hash2D(col + i, row + rowIdx, 21) - 0.5) * 3;
      const bh = 16 + hash2D(col + i, row + rowIdx, 22) * 7;
      const lean = (i - 1.5) * 2.2 + sway;

      // Leaf blade fill
      ctx.fillStyle = i % 2 === 0 ? darkCol : midCol || '#379c35';
      ctx.strokeStyle = strokeCol || '#1f4f1c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - 4.2, baseY);
      ctx.quadraticCurveTo(bx - 3 + lean * 0.5, baseY - bh * 0.6, bx + lean, baseY - bh);
      ctx.quadraticCurveTo(bx + 4 + lean * 0.5, baseY - bh * 0.55, bx + 4.2, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sunlit tip highlight
      ctx.strokeStyle = lightCol;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + lean * 0.35, baseY - bh * 0.38);
      ctx.quadraticCurveTo(bx + lean * 0.7, baseY - bh * 0.7, bx + lean * 0.92, baseY - bh + 2);
      ctx.stroke();
    }
  }

  function drawWaterTile(ctx, px, py, col, row, S, time) {
    // Turquoise cartoon water
    const wavePulse = Math.sin(time * 0.0025 + col * 0.5 + row * 0.4);
    ctx.fillStyle = '#2eb8eb';
    ctx.fillRect(px, py, S, S);

    // Gentle sunlit band
    ctx.fillStyle = 'rgba(125, 226, 255, 0.25)';
    ctx.fillRect(px, py + ((S * 0.28 + wavePulse * 3) % S), S, 8);

    // Animated ripples
    const shift = Math.sin(time * 0.003 + col * 0.9 + row * 0.7) * 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + 8 + shift, py + 15);
    ctx.quadraticCurveTo(px + 15 + shift, py + 12, px + 22 + shift, py + 15);
    ctx.moveTo(px + 24 - shift * 0.7, py + 34);
    ctx.quadraticCurveTo(px + 31 - shift * 0.7, py + 31, px + 38 - shift * 0.7, py + 34);
    ctx.stroke();

    // Auto-tiled shoreline rims where water meets land
    const upW = getTile(col, row - 1) === TILE.WATER || getTile(col, row - 1) === TILE.BRIDGE;
    const downW = getTile(col, row + 1) === TILE.WATER || getTile(col, row + 1) === TILE.BRIDGE;
    const leftW = getTile(col - 1, row) === TILE.WATER || getTile(col - 1, row) === TILE.BRIDGE;
    const rightW = getTile(col + 1, row) === TILE.WATER || getTile(col + 1, row) === TILE.BRIDGE;

    const foamW = 2 + Math.sin(time * 0.004 + col + row) * 0.8;
    if (!upW) {
      ctx.fillStyle = '#58764a';
      ctx.fillRect(px, py, S, 4);
      ctx.fillStyle = '#c9b07c';
      ctx.fillRect(px, py + 4, S, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(px + 2, py + 7, S - 4, foamW);
    }
    if (!downW) {
      ctx.fillStyle = '#58764a';
      ctx.fillRect(px, py + S - 4, S, 4);
      ctx.fillStyle = '#c9b07c';
      ctx.fillRect(px, py + S - 7, S, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(px + 2, py + S - 7 - foamW, S - 4, foamW);
    }
    if (!leftW) {
      ctx.fillStyle = '#58764a';
      ctx.fillRect(px, py, 4, S);
      ctx.fillStyle = '#c9b07c';
      ctx.fillRect(px + 4, py, 3, S);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(px + 7, py + 2, foamW, S - 4);
    }
    if (!rightW) {
      ctx.fillStyle = '#58764a';
      ctx.fillRect(px + S - 4, py, 4, S);
      ctx.fillStyle = '#c9b07c';
      ctx.fillRect(px + S - 7, py, 3, S);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(px + S - 7 - foamW, py + 2, foamW, S - 4);
    }

    // Occasional cartoon lily pad on open water
    if (upW && downW && leftW && rightW && hash2D(col, row, 31) > 0.85) {
      const bob = Math.sin(time * 0.0026 + col + row) * 1.6;
      const lx = px + S * 0.52;
      const ly = py + S * 0.52 + bob;
      ctx.fillStyle = '#2fa84f';
      ctx.strokeStyle = '#1b5e2e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(lx, ly, 9.5, 0.35, Math.PI * 2 - 0.15);
      ctx.lineTo(lx, ly);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (hash2D(col, row, 32) > 0.55) {
        // Tiny pink lotus flower
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        ctx.arc(lx - 1, ly - 1, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(lx - 1, ly - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBridgeTile(ctx, px, py, col, row, S, time) {
    // Draw animated water beneath bridge edges
    drawWaterTile(ctx, px, py, col, row, S, time);

    const waterUpDown = getTile(col, row - 1) === TILE.WATER || getTile(col, row + 1) === TILE.WATER;
    const horizontalBridge = waterUpDown || (getTile(col - 1, row) !== TILE.WATER && getTile(col + 1, row) !== TILE.WATER);

    const bridgeUp = getTile(col, row - 1) === TILE.BRIDGE;
    const bridgeDown = getTile(col, row + 1) === TILE.BRIDGE;
    const bridgeLeft = getTile(col - 1, row) === TILE.BRIDGE;
    const bridgeRight = getTile(col + 1, row) === TILE.BRIDGE;

    ctx.save();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;

    if (horizontalBridge) {
      const topPad = bridgeUp ? 0 : 4;
      const botPad = bridgeDown ? 0 : 4;

      if (!bridgeDown) {
        ctx.fillStyle = 'rgba(20, 45, 70, 0.25)';
        ctx.fillRect(px, py + S - 4, S, 4);
      }

      // Vertical wooden planks
      const planks = 4;
      const pw = S / planks;
      for (let i = 0; i < planks; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#c78c52' : '#b87c43';
        ctx.fillRect(px + i * pw, py + topPad, pw, S - topPad - botPad);
        ctx.strokeRect(px + i * pw, py + topPad, pw, S - topPad - botPad);
        ctx.fillStyle = '#5c3a1e';
        ctx.beginPath();
        ctx.arc(px + i * pw + pw * 0.5, py + topPad + 5, 1.3, 0, Math.PI * 2);
        ctx.arc(px + i * pw + pw * 0.5, py + S - botPad - 5, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Outer rails only (so 2-tile-wide bridges stay wide & seamless!)
      ctx.fillStyle = '#68543e';
      if (!bridgeUp) {
        ctx.fillRect(px, py + 1, S, 6);
        ctx.strokeRect(px, py + 1, S, 6);
      }
      if (!bridgeDown) {
        ctx.fillRect(px, py + S - 7, S, 6);
        ctx.strokeRect(px, py + S - 7, S, 6);
      }
    } else {
      const leftPad = bridgeLeft ? 0 : 4;
      const rightPad = bridgeRight ? 0 : 4;

      // Vertical bridge (horizontal planks)
      const planks = 4;
      const ph = S / planks;
      for (let i = 0; i < planks; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#c78c52' : '#b87c43';
        ctx.fillRect(px + leftPad, py + i * ph, S - leftPad - rightPad, ph);
        ctx.strokeRect(px + leftPad, py + i * ph, S - leftPad - rightPad, ph);
        ctx.fillStyle = '#5c3a1e';
        ctx.beginPath();
        ctx.arc(px + leftPad + 5, py + i * ph + ph * 0.5, 1.3, 0, Math.PI * 2);
        ctx.arc(px + S - rightPad - 5, py + i * ph + ph * 0.5, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#68543e';
      if (!bridgeLeft) {
        ctx.fillRect(px + 1, py, 6, S);
        ctx.strokeRect(px + 1, py, 6, S);
      }
      if (!bridgeRight) {
        ctx.fillRect(px + S - 7, py, 6, S);
        ctx.strokeRect(px + S - 7, py, 6, S);
      }
    }
    ctx.restore();
  }

  function drawFlowersTile(ctx, px, py, col, row, S, time) {
    drawGrassTile(ctx, px, py, col, row, S);
    const petalSets = [
      { petal: '#ff6b9d', center: '#fde047' },
      { petal: '#fde047', center: '#f97316' },
      { petal: '#ffffff', center: '#d6b872' },
      { petal: '#c084fc', center: '#fef08a' },
      { petal: '#fb7185', center: '#fef9c3' }
    ];

    const spots = [
      { ox: 0.24, oy: 0.28 },
      { ox: 0.72, oy: 0.26 },
      { ox: 0.48, oy: 0.54 },
      { ox: 0.25, oy: 0.76 },
      { ox: 0.75, oy: 0.74 }
    ];

    for (let i = 0; i < spots.length; i++) {
      const h = hash2D(col, row, 40 + i);
      const sway = Math.sin(time * 0.0034 + col * 0.8 + row * 0.5 + i * 1.1) * 2.2;
      const fx = px + spots[i].ox * S + (h - 0.5) * 6;
      const fy = py + spots[i].oy * S + (hash2D(col, row, 50 + i) - 0.5) * 5;
      const scheme = petalSets[Math.floor(h * petalSets.length) % petalSets.length];

      // Stem
      ctx.strokeStyle = '#2d8a34';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx, fy + 6);
      ctx.quadraticCurveTo(fx + sway * 0.5, fy + 2, fx + sway, fy);
      ctx.stroke();

      const bx = fx + sway;
      const by = fy;
      // 4 cute petals
      ctx.fillStyle = scheme.petal;
      for (let p = 0; p < 4; p++) {
        const a = (p * Math.PI) / 2 + 0.4;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(a) * 3.1, by + Math.sin(a) * 3.1, 2.7, 0, Math.PI * 2);
        ctx.fill();
      }
      // Sunny center
      ctx.fillStyle = scheme.center;
      ctx.beginPath();
      ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGreenhouseFloorTile(ctx, px, py, col, row, S) {
    const alt = (col + row) % 2 === 0;
    ctx.fillStyle = alt ? '#f5ecd8' : '#ece0c5';
    ctx.fillRect(px, py, S, S);

    // Elegant stone slab bevel & grout
    ctx.strokeStyle = '#d3c2a1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 1, py + 1, S - 2, S - 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 3, py + S - 3);
    ctx.lineTo(px + 3, py + 3);
    ctx.lineTo(px + S - 3, py + 3);
    ctx.stroke();

    // Subtle golden botanical inlay every few tiles
    if ((col + row) % 4 === 0) {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
      ctx.beginPath();
      ctx.moveTo(px + S * 0.5, py + S * 0.34);
      ctx.lineTo(px + S * 0.64, py + S * 0.5);
      ctx.lineTo(px + S * 0.5, py + S * 0.66);
      ctx.lineTo(px + S * 0.36, py + S * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawDoorTile(ctx, px, py, col, row, S) {
    // Cozy stone entrance + welcome doormat
    drawGreenhouseFloorTile(ctx, px, py, col, row, S);
    ctx.fillStyle = '#c97b4b';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    roundRectPath(ctx, px + 8, py + 10, S - 16, S - 20, 5);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 12, py + 14, S - 24, S - 28);
  }

  // ---------------------------------------------------------------------------
  // REGIÃO LESTE: areia, coqueiros, caverna, rochas e canteiros sombrios
  // ---------------------------------------------------------------------------
  function drawSandTile(ctx, px, py, col, row, S) {
    const h = hash2D(col, row, 30);
    ctx.fillStyle = (col + row) % 2 === 0 ? '#fde9a8' : '#fbe29a';
    ctx.fillRect(px, py, S, S);
    // Ondulações de vento na areia
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + 8, py + S * (0.3 + h * 0.2));
    ctx.quadraticCurveTo(px + S * 0.35, py + S * (0.22 + h * 0.2), px + S * 0.6, py + S * (0.3 + h * 0.2));
    ctx.stroke();
    if (h > 0.55) {
      // Conchinha
      const cx = px + 12 + hash2D(col, row, 31) * (S - 24);
      const cy = py + 14 + hash2D(col, row, 32) * (S - 26);
      ctx.fillStyle = '#fda4af';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 2);
      ctx.quadraticCurveTo(cx, cy - 6, cx + 4, cy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (h < 0.25) {
      ctx.fillStyle = '#e8c574';
      ctx.beginPath();
      ctx.arc(px + 14 + h * 60, py + S * 0.7, 1.8, 0, Math.PI * 2);
      ctx.arc(px + 20 + h * 60, py + S * 0.74, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPalmObject(ctx, col, row, S, time) {
    const px = col * S;
    const py = row * S;
    const cx = px + S * 0.5;
    const baseY = py + S * 0.9;
    const lean = (hash2D(col, row, 40) - 0.5) * 10;
    const sway = Math.sin(time * 0.0018 + col * 0.9 + row * 0.6) * 0.07;

    ctx.fillStyle = 'rgba(28, 56, 22, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + 3, baseY - 1, S * 0.34, S * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tronco anelado
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.3;
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#917551';
    ctx.beginPath();
    ctx.moveTo(cx - 6, baseY);
    ctx.quadraticCurveTo(cx - 4 + lean * 0.3, baseY - 22, cx - 3 + lean, baseY - 40);
    ctx.lineTo(cx + 3 + lean, baseY - 40);
    ctx.quadraticCurveTo(cx + 4 + lean * 0.3, baseY - 22, cx + 6, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)';
    ctx.lineWidth = 1.4;
    for (let i = 1; i < 5; i++) {
      const ty = baseY - i * 8;
      const tx = cx + lean * (i / 5);
      ctx.beginPath();
      ctx.moveTo(tx - 4.5, ty);
      ctx.quadraticCurveTo(tx, ty + 2, tx + 4.5, ty);
      ctx.stroke();
    }

    // Copa de folhas compridas
    const topX = cx + lean;
    const topY = baseY - 41;
    const angles = [-2.9, -2.3, -1.6, -0.9, -0.25, 0.4];
    ctx.lineWidth = 2.2;
    for (let i = 0; i < angles.length; i++) {
      ctx.save();
      ctx.translate(topX, topY);
      ctx.rotate(angles[i] + sway);
      ctx.fillStyle = i % 2 === 0 ? '#527653' : '#3b5948';
      ctx.strokeStyle = OUTLINE;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(12, -8, 26, 3);
      ctx.quadraticCurveTo(12, 1, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Cocos
    ctx.fillStyle = '#7c4a1e';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(topX - 3, topY + 4, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(topX + 3.5, topY + 5, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawCaveFloorTile(ctx, px, py, col, row, S) {
    const h = hash2D(col, row, 50);
    ctx.fillStyle = (col + row) % 2 === 0 ? '#5b4b6b' : '#564766';
    ctx.fillRect(px, py, S, S);
    if (h > 0.6) {
      ctx.fillStyle = 'rgba(30, 20, 45, 0.28)';
      ctx.beginPath();
      ctx.ellipse(px + S * 0.5, py + S * 0.55, S * 0.3, S * 0.18, h * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (h < 0.3) {
      ctx.fillStyle = '#7a6890';
      ctx.beginPath();
      ctx.ellipse(px + 10 + h * 80, py + 14 + h * 40, 3, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (h > 0.9) {
      // Cristal brilhante no chão
      const cx = px + 12 + hash2D(col, row, 51) * (S - 24);
      const cy = py + 14 + hash2D(col, row, 52) * (S - 26);
      ctx.fillStyle = '#67e8f9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 3.5, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 3.5, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawRockObject(ctx, col, row, S) {
    const px = col * S;
    const py = row * S;
    const h = hash2D(col, row, 55);
    ctx.fillStyle = 'rgba(15, 10, 25, 0.3)';
    ctx.beginPath();
    ctx.ellipse(px + S * 0.52, py + S * 0.86, S * 0.44, S * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = h > 0.5 ? '#6d5c80' : '#655577';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(px + 4, py + S * 0.86);
    ctx.lineTo(px + 6, py + S * 0.4);
    ctx.lineTo(px + S * 0.3, py + S * (0.08 + h * 0.08));
    ctx.lineTo(px + S * 0.66, py + S * 0.12);
    ctx.lineTo(px + S - 5, py + S * 0.42);
    ctx.lineTo(px + S - 3, py + S * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Faces de luz da pedra
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(px + 9, py + S * 0.42);
    ctx.lineTo(px + S * 0.31, py + S * 0.16);
    ctx.lineTo(px + S * 0.42, py + S * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 29, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + S * 0.55, py + S * 0.2);
    ctx.lineTo(px + S * 0.5, py + S * 0.5);
    ctx.lineTo(px + S * 0.62, py + S * 0.7);
    ctx.stroke();
  }

  function drawCaveGrassBase(ctx, px, py, col, row, S, time) {
    drawCaveFloorTile(ctx, px, py, col, row, S);
    ctx.fillStyle = '#3b2a55';
    roundRectPath(ctx, px + 3, py + 4, S - 6, S - 7, 10);
    ctx.fill();
    const sway = Math.sin(time * 0.0024 + col * 0.65 + row * 0.35) * 2.6;
    drawTallGrassBladeRow(ctx, px, py + S * 0.44, col, row, S, sway, '#6d28d9', '#c4b5fd', 0, '#8b5cf6', '#2e1065');
  }

  function drawCaveGrassFront(ctx, px, py, col, row, S, time) {
    const sway = Math.sin(time * 0.0024 + col * 0.65 + row * 0.35 + 0.6) * 3;
    drawTallGrassBladeRow(ctx, px, py + S * 0.82, col, row, S, sway, '#7e22ce', '#e9d5ff', 1, '#9333ea', '#2e1065');
    // Cogumelo brilhante no meio do canteiro
    if (hash2D(col, row, 57) > 0.5) {
      const glow = 0.55 + 0.45 * Math.sin(time * 0.003 + col + row);
      const mx = px + S * (0.3 + hash2D(col, row, 58) * 0.4);
      const my = py + S * 0.8;
      ctx.save();
      ctx.globalAlpha = 0.25 * glow;
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(mx, my - 6, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#f5f5f4';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.3;
      ctx.fillRect(mx - 1.6, my - 6, 3.2, 6);
      ctx.strokeRect(mx - 1.6, my - 6, 3.2, 6);
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(mx - 6, my - 5);
      ctx.quadraticCurveTo(mx, my - 14, mx + 6, my - 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawTreeObject(ctx, col, row, S, time) {
    const x = (col + 0.5) * S;
    const y = (row + 0.88) * S;
    const height = S * (1.64 + hash2D(col, row, 60) * 0.52);
    const sway = Math.sin(time * 0.002 + col * 1.1 + row * 0.7) * 1.4;

    ctx.fillStyle = '#22322268';
    ctx.beginPath();
    ctx.ellipse(x + S * 0.18, y + 1, S * 0.64, S * 0.13, -0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#50483b';
    ctx.lineWidth = S * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 2, y - height * 0.38, x + 3, y - height * 0.75);
    ctx.stroke();

    const canopy = ctx.createLinearGradient(x - S * 0.5, y - height, x + S * 0.45, y - height * 0.22);
    canopy.addColorStop(0, '#8da46d');
    canopy.addColorStop(0.55, '#567b55');
    canopy.addColorStop(1, '#2e4d40');
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.moveTo(x + sway, y - height);
    ctx.bezierCurveTo(x + S * 0.45, y - height, x + S * 0.78, y - height * 0.51,
      x + S * 0.52, y - height * 0.37);
    ctx.quadraticCurveTo(x + 6, y - height * 0.19, x - S * 0.26, y - height * 0.34);
    ctx.bezierCurveTo(x - S * 0.7, y - height * 0.36, x - S * 0.54, y - height * 0.82,
      x + sway, y - height);
    ctx.fill();

    ctx.strokeStyle = '#d3ce8342';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - S * 0.32, y - height * 0.66);
    ctx.quadraticCurveTo(x - 3, y - height * 0.84, x + S * 0.24, y - height * 0.75);
    ctx.stroke();
  }

  function drawFenceObject(ctx, col, row, S) {
    const px = col * S;
    const py = row * S;
    const hasLeft = getTile(col - 1, row) === TILE.FENCE;
    const hasRight = getTile(col + 1, row) === TILE.FENCE;
    const hasUp = getTile(col, row - 1) === TILE.FENCE;
    const hasDown = getTile(col, row + 1) === TILE.FENCE;

    ctx.save();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';

    // Shadow
    ctx.fillStyle = 'rgba(30, 50, 20, 0.22)';
    ctx.fillRect(px + 6, py + S - 10, S - 12, 6);

    // Horizontal rails
    const railLeft = hasLeft ? px : px + 10;
    const railRight = hasRight ? px + S : px + S - 10;
    if (hasLeft || hasRight || (!hasUp && !hasDown)) {
      ctx.fillStyle = '#b97e46';
      ctx.fillRect(railLeft, py + 15, railRight - railLeft, 6);
      ctx.strokeRect(railLeft, py + 15, railRight - railLeft, 6);
      ctx.fillRect(railLeft, py + 28, railRight - railLeft, 6);
      ctx.strokeRect(railLeft, py + 28, railRight - railLeft, 6);
    }

    // Vertical connector if fence turns vertically
    if (hasUp) {
      ctx.fillStyle = '#a86e39';
      ctx.fillRect(px + S * 0.5 - 4, py, 8, S * 0.5);
      ctx.strokeRect(px + S * 0.5 - 4, py, 8, S * 0.5);
    }
    if (hasDown) {
      ctx.fillStyle = '#a86e39';
      ctx.fillRect(px + S * 0.5 - 4, py + S * 0.5, 8, S * 0.5);
      ctx.strokeRect(px + S * 0.5 - 4, py + S * 0.5, 8, S * 0.5);
    }

    // Center post
    ctx.fillStyle = '#a56934';
    roundRectPath(ctx, px + S * 0.5 - 6, py + 9, 12, S - 15, 4);
    ctx.fill();
    ctx.stroke();

    // Post cap highlight
    ctx.fillStyle = '#d49a60';
    roundRectPath(ctx, px + S * 0.5 - 4, py + 11, 8, 5, 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHealCounterObject(ctx, col, row, S) {
    const px = col * S;
    const py = row * S;
    ctx.save();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';

    // Shadow
    ctx.fillStyle = 'rgba(35, 30, 25, 0.22)';
    roundRectPath(ctx, px + 3, py + S - 8, S - 6, 8, 4);
    ctx.fill();

    // Front wood panel
    ctx.fillStyle = '#b97b45';
    roundRectPath(ctx, px + 2, py + 16, S - 4, S - 20, 6);
    ctx.fill();
    ctx.stroke();

    // Cream countertop
    ctx.fillStyle = '#fff9ec';
    roundRectPath(ctx, px + 1, py + 8, S - 2, 13, 5);
    ctx.fill();
    ctx.stroke();

    // Healing heart + leaf emblem on front
    const cx = px + S * 0.5;
    const cy = py + 31;
    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Cute heart
    ctx.fillStyle = '#c47965';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4.8);
    ctx.bezierCurveTo(cx - 7, cy + 0.5, cx - 5.5, cy - 5.5, cx, cy - 1.5);
    ctx.bezierCurveTo(cx + 5.5, cy - 5.5, cx + 7, cy + 0.5, cx, cy + 4.8);
    ctx.fill();

    // Tiny emerald leaf sprout on counter top
    ctx.fillStyle = '#789263';
    ctx.beginPath();
    ctx.ellipse(cx + 12, py + 12, 4.5, 2.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawBuildingObject(ctx, b, S) {
    const x = b.x * S;
    const y = b.y * S;
    const w = b.w * S;
    const h = b.h * S;

    const roofColor = b.roofColor || '#e05a47';
    const wallColor = b.wallColor || '#fff7e6';
    const label = b.label || '';
    const isGreenhouse = /estufa|arena/i.test(label);
    const isHealer = /cura/i.test(label);
    const isShop = /loja|sement/i.test(label);

    const roofH = Math.max(S * 1.05, h * 0.48);
    const wallY = y + roofH - 6;
    const wallH = h - roofH + 6;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Ground drop shadow
    ctx.fillStyle = 'rgba(28, 45, 22, 0.26)';
    roundRectPath(ctx, x + 7, y + 10, w, h - 2, 12);
    ctx.fill();

    // Main wall body
    ctx.fillStyle = wallColor;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    roundRectPath(ctx, x + 4, wallY, w - 8, wallH - 2, 8);
    ctx.fill();
    ctx.stroke();

    // Warm stone foundation strip
    ctx.fillStyle = darkenHex(wallColor, 0.84);
    ctx.fillRect(x + 6, y + h - 13, w - 12, 9);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + h - 13);
    ctx.lineTo(x + w - 5, y + h - 13);
    ctx.stroke();

    // Timber corner posts
    ctx.fillStyle = '#9c6637';
    ctx.fillRect(x + 5, wallY + 2, 7, wallH - 6);
    ctx.fillRect(x + w - 12, wallY + 2, 7, wallH - 6);

    // Door aligned precisely to b.doorX (or centered)
    const doorCenterX = typeof b.doorX === 'number' ? (b.doorX + 0.5) * S : x + w * 0.5;
    const doorW = Math.min(34, S * 0.72);
    const doorH = Math.min(wallH - 10, 38);
    const doorX = clamp(doorCenterX - doorW * 0.5, x + 16, x + w - 16 - doorW);
    const doorY = y + h - doorH - 3;

    // Arched welcoming door
    ctx.fillStyle = '#8b542c';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(doorX, doorY + doorH);
    ctx.lineTo(doorX, doorY + 11);
    ctx.arc(doorX + doorW * 0.5, doorY + 11, doorW * 0.5, Math.PI, 0);
    ctx.lineTo(doorX + doorW, doorY + doorH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Door window / doorknob
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(doorX + doorW * 0.5, doorY + 13, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#d6b872';
    ctx.beginPath();
    ctx.arc(doorX + doorW - 7, doorY + doorH * 0.64, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Bright cartoon windows (placed safely away from door)
    const winW = 24;
    const winH = 22;
    const winY = wallY + Math.max(10, (wallH - winH) * 0.34);
    const candidateWinX = [];
    if (doorX - (x + 16) >= winW + 8) {
      candidateWinX.push(x + 18 + (doorX - (x + 18) - winW) * 0.5);
    }
    if ((x + w - 16) - (doorX + doorW) >= winW + 8) {
      candidateWinX.push(doorX + doorW + ((x + w - 18) - (doorX + doorW) - winW) * 0.5);
    }

    for (let i = 0; i < candidateWinX.length; i++) {
      const wx = candidateWinX[i];
      // Window frame & glowing sky glass
      ctx.fillStyle = '#7dd3fc';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      roundRectPath(ctx, wx, winY, winW, winH, 5);
      ctx.fill();
      ctx.stroke();

      // Diagonal specular glass shine
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(wx + 5, winY + 14);
      ctx.lineTo(wx + 13, winY + 5);
      ctx.stroke();

      // Window cross muntins
      ctx.strokeStyle = '#9c6637';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx + winW * 0.5, winY + 1);
      ctx.lineTo(wx + winW * 0.5, winY + winH - 1);
      ctx.moveTo(wx + 1, winY + winH * 0.5);
      ctx.lineTo(wx + winW - 1, winY + winH * 0.5);
      ctx.stroke();

      // Tiny flower box underneath
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.fillRect(wx - 2, winY + winH - 1, winW + 4, 6);
      ctx.strokeRect(wx - 2, winY + winH - 1, winW + 4, 6);
      ctx.fillStyle = i % 2 === 0 ? '#c78993' : '#fde047';
      ctx.beginPath();
      ctx.arc(wx + 5, winY + winH - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(wx + 12, winY + winH - 3, 2.5, 0, Math.PI * 2);
      ctx.arc(wx + 19, winY + winH - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sloped pitched cartoon roof (overhanging nicely)
    const roofOver = 6;
    const rx = x - roofOver;
    const ry = y - 8;
    const rw = w + roofOver * 2;
    const rh = roofH + 10;

    ctx.fillStyle = roofColor;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx + 18, ry);
    ctx.lineTo(rx + rw - 18, ry);
    ctx.lineTo(rx + rw, ry + rh);
    ctx.lineTo(rx, ry + rh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Roof top highlight band
    ctx.fillStyle = lightenHex(roofColor, 0.24);
    ctx.beginPath();
    ctx.moveTo(rx + 20, ry + 3);
    ctx.lineTo(rx + rw - 20, ry + 3);
    ctx.lineTo(rx + rw - 12, ry + 14);
    ctx.lineTo(rx + 12, ry + 14);
    ctx.closePath();
    ctx.fill();

    // Greenhouse glass skylights OR roof shingle stripes
    if (isGreenhouse) {
      const panes = Math.max(2, Math.floor((rw - 36) / 34));
      const paneSpan = (rw - 42) / panes;
      for (let i = 0; i < panes; i++) {
        const gx = rx + 21 + i * paneSpan + 3;
        const gw = paneSpan - 6;
        ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.strokeStyle = darkenHex(roofColor, 0.72);
        ctx.lineWidth = 2;
        roundRectPath(ctx, gx, ry + 10, gw, rh - 22, 4);
        ctx.fill();
        ctx.stroke();
        // Glass gleam
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx + 5, ry + rh - 18);
        ctx.lineTo(gx + Math.min(gw - 5, 16), ry + 15);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = darkenHex(roofColor, 0.78);
      ctx.lineWidth = 2;
      for (let sy = ry + 18; sy < ry + rh - 8; sy += 13) {
        const inset = ((ry + rh - sy) / rh) * 16;
        ctx.beginPath();
        ctx.moveTo(rx + inset + 4, sy);
        ctx.lineTo(rx + rw - inset - 4, sy);
        ctx.stroke();
      }
    }

    // Subtle thematic roof emblem
    if (isHealer || isShop) {
      const badgeCx = x + w * 0.5;
      const badgeCy = ry + 12;
      ctx.fillStyle = '#fffdf5';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(badgeCx, badgeCy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 13px "Nunito", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isHealer ? '#567655' : '#d97706';
      ctx.fillText(isHealer ? '♥' : '★', badgeCx, badgeCy + 1);
    }

    // Crisp readable wooden signboard with building name!
    if (label) {
      ctx.font = '700 12px "Nunito", system-ui, sans-serif';
      const textW = ctx.measureText(label).width;
      const signW = Math.min(w + 26, Math.max(textW + 18, 72));
      const signH = 22;
      const signX = x + (w - signW) * 0.5;
      const signY = ry + rh - signH * 0.65;

      // Sign drop shadow
      ctx.fillStyle = 'rgba(43, 29, 20, 0.35)';
      roundRectPath(ctx, signX + 1, signY + 3, signW, signH, 7);
      ctx.fill();

      // Parchment signboard
      ctx.fillStyle = '#fffdf5';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      roundRectPath(ctx, signX, signY, signW, signH, 7);
      ctx.fill();
      ctx.stroke();

      // Label text
      ctx.fillStyle = OUTLINE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w * 0.5, signY + signH * 0.52, signW - 10);
    }

    ctx.restore();
  }

  function drawFallbackBuildingTile(ctx, col, row, S) {
    const px = col * S;
    const py = row * S;
    ctx.fillStyle = '#f5e6cc';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.fillRect(px, py, S, S);
    ctx.strokeRect(px + 1, py + 1, S - 2, S - 2);
  }

  function drawCharacterEntity(ctx, cx, cy, size, style, dir, walkFrame, isMoving) {
    // Ground shadow
    ctx.fillStyle = 'rgba(28, 48, 22, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.37, size * 0.33, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    const stepBounce = isMoving ? Math.abs(Math.sin(player.stepElapsed / STEP_DURATION_MS * Math.PI)) * 3.5 : 0;

    if (HM.Sprites && typeof HM.Sprites.drawCharacter === 'function') {
      try {
        HM.Sprites.drawCharacter(ctx, cx, cy - stepBounce, size, style, dir, walkFrame);
        return;
      } catch (err) {
        // Fallback safely if sprite call fails
      }
    }
    drawFallbackCharacter(ctx, cx, cy - stepBounce, size, style, dir, walkFrame);
  }

  function getNpcBadgeInfo(npc) {
    const defeated = isNpcDefeated(state, npc);
    switch (npc.role) {
      case 'leader':
        return {
          icon: '👑',
          bg: defeated ? '#fef9c3' : '#d6b872',
          border: OUTLINE,
          actionLabel: defeated ? 'Revanche' : 'Desafiar!'
        };
      case 'trainer':
        return {
          icon: defeated ? '✓' : '⚔️',
          bg: defeated ? '#dcfce7' : '#fee2e2',
          border: OUTLINE,
          actionLabel: defeated ? 'Falar' : 'Desafiar!'
        };
      case 'healer':
        return { icon: '💚', bg: '#dcfce7', border: OUTLINE, actionLabel: 'Curar' };
      case 'shop':
        return { icon: '🪙', bg: '#fef3c7', border: OUTLINE, actionLabel: 'Loja' };
      case 'box':
        return { icon: '📦', bg: '#e0f2fe', border: OUTLINE, actionLabel: 'Caixa' };
      case 'prof':
        return { icon: '💬', bg: '#fffdf5', border: OUTLINE, actionLabel: 'Falar' };
      case 'sign':
        return { icon: '💬', bg: '#fef3c7', border: OUTLINE, actionLabel: 'Ler', onlyWhenNear: true };
      default:
        return { icon: '💬', bg: '#fffdf5', border: OUTLINE, actionLabel: 'Falar' };
    }
  }

  function drawNpcFloatingBadges(ctx, S, time) {
    if (!world || !Array.isArray(world.npcs)) return;
    const activeTarget = (!paused && !encounterPending && !trainerAlert) ? findInteractableTarget() : null;
    const activeNpcId = activeTarget && activeTarget.npc ? activeTarget.npc.id : null;

    ctx.save();
    for (let i = 0; i < world.npcs.length; i++) {
      const npc = world.npcs[i];
      if (isNpcHidden(npc)) continue;
      const cx = (npc.x + 0.5) * S;
      const topY = npc.y * S - 6;

      // Skip if offscreen
      if (cx < camera.x - 60 || cx > camera.x + viewport.width + 60 ||
          topY < camera.y - 60 || topY > camera.y + viewport.height / GROUND_TILT + 60) {
        continue;
      }

      // Active trainer exclamation alert (!)
      if (trainerAlert && trainerAlert.npc.id === npc.id) {
        const pop = Math.min(1, trainerAlert.elapsed / 120);
        const scale = 0.6 + pop * 0.45;
        ctx.save();
        ctx.translate(cx, topY - 12);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#c47965';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.5;
        roundRectPath(ctx, -14, -16, 28, 28, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 18px "Nunito", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, -1);
        ctx.restore();
        continue;
      }

      const info = getNpcBadgeInfo(npc);
      const isFocused = activeNpcId === npc.id;
      const dist = Math.abs(npc.x - player.x) + Math.abs(npc.y - player.y);

      if (!isFocused && dist > (info.onlyWhenNear ? 2 : 6)) continue;

      const bob = Math.sin(time * 0.0042 + i * 1.3) * 3;

      if (isFocused) {
        // Prominent [Espaço] interaction pill!
        const label = '[Espaço] ' + info.actionLabel;
        ctx.font = '700 11.5px "Nunito", system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const pw = tw + 18;
        const ph = 24;
        const bx = cx - pw * 0.5;
        const by = topY - 24 + bob;

        // Shadow
        ctx.fillStyle = 'rgba(43, 29, 20, 0.35)';
        roundRectPath(ctx, bx, by + 3, pw, ph, 12);
        ctx.fill();

        // Bright golden-cream pill
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        roundRectPath(ctx, bx, by, pw, ph, 12);
        ctx.fill();
        ctx.stroke();

        // Pointer triangle
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(cx - 5, by + ph - 1);
        ctx.lineTo(cx + 5, by + ph - 1);
        ctx.lineTo(cx, by + ph + 5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 5, by + ph);
        ctx.lineTo(cx, by + ph + 5);
        ctx.lineTo(cx + 5, by + ph);
        ctx.stroke();

        ctx.fillStyle = OUTLINE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, by + ph * 0.52);
      } else {
        // Gentle floating icon bubble (💬 / ⚔️ / 👑 / 💚 / 🪙 / 📦)
        const r = 12;
        const by = topY - 12 + bob;

        // Subtle shadow
        ctx.fillStyle = 'rgba(43, 29, 20, 0.22)';
        ctx.beginPath();
        ctx.arc(cx, by + 2.5, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = info.bg;
        ctx.strokeStyle = info.border;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, by, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '700 12px "Nunito", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = OUTLINE;
        ctx.fillText(info.icon, cx, by + 0.8);
      }
    }
    ctx.restore();
  }

  function drawParticlesAndAmbient(ctx, time) {
    ctx.save();

    // Sunlit drifting pollen motes
    for (let i = 0; i < pollen.length; i++) {
      const m = pollen[i];
      if (m.x < camera.x - 10 || m.x > camera.x + viewport.width + 10 ||
          m.y < camera.y - 10 || m.y > camera.y + viewport.height / GROUND_TILT + 10) continue;
      const alpha = 0.25 + 0.25 * Math.sin(time * 0.002 + m.phase);
      ctx.fillStyle = 'rgba(255, 252, 210, ' + alpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Butterflies
    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];
      if (b.x < camera.x - 20 || b.x > camera.x + viewport.width + 20 ||
          b.y < camera.y - 20 || b.y > camera.y + viewport.height / GROUND_TILT + 20) continue;
      const flap = Math.abs(Math.sin(time * 0.015 + b.phase));
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = b.color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(-3.2 * flap - 0.8, -1, 3.6 * flap + 1, 2.8, -0.3, 0, Math.PI * 2);
      ctx.ellipse(3.2 * flap + 0.8, -1, 3.6 * flap + 1, 2.8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Interactive particles (leaves, dust, sparkles)
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const alpha = clamp(1 - p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      if (p.kind === 'leaf') {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#1f4f1c';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'sparkle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.35, -p.size * 0.35);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(p.size * 0.35, p.size * 0.35);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.35, p.size * 0.35);
        ctx.lineTo(-p.size, 0);
        ctx.lineTo(-p.size * 0.35, -p.size * 0.35);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.6 + (1 - alpha) * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function findKeyLandmarks() {
    let healPos = null;
    let arenaPos = null;

    if (world && Array.isArray(world.buildings)) {
      for (let i = 0; i < world.buildings.length; i++) {
        const b = world.buildings[i];
        const lbl = b.label || '';
        if (!healPos && /cura|enferm/i.test(lbl)) {
          healPos = { x: b.x + b.w * 0.5, y: b.y + b.h * 0.5 };
        }
        if (!arenaPos && /arena|dourad|flora/i.test(lbl)) {
          arenaPos = { x: b.x + b.w * 0.5, y: b.y + b.h * 0.5 };
        }
      }
    }
    if (world && Array.isArray(world.npcs)) {
      for (let i = 0; i < world.npcs.length; i++) {
        const n = world.npcs[i];
        if (!healPos && n.role === 'healer') healPos = { x: n.x, y: n.y };
        if (!arenaPos && n.role === 'leader') arenaPos = { x: n.x, y: n.y };
      }
    }
    if (!healPos && world && world.healSpot) {
      healPos = { x: world.healSpot.x, y: world.healSpot.y };
    }
    return { healPos: healPos, arenaPos: arenaPos };
  }

  function drawMinimapHUD(ctx, time) {
    if (!world || !canvas) return;
    const pad = 10;

    if (minimapCompact) {
      const w = 92;
      const h = 28;
      const x = viewport.width - w - pad;
      const y = pad;
      minimapRect.x = x;
      minimapRect.y = y;
      minimapRect.w = w;
      minimapRect.h = h;

      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = '#fffdf5';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      roundRectPath(ctx, x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 11px "Nunito", system-ui, sans-serif';
      ctx.fillStyle = OUTLINE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🗺️ Mapa', x + w * 0.5, y + h * 0.52);
      ctx.restore();
      return;
    }

    const mapW = world.cols > 40 ? 158 : 116;
    const mapH = Math.round(mapW * (world.rows / world.cols));
    const frameW = mapW + 10;
    const frameH = mapH + 24;
    const fx = viewport.width - frameW - pad;
    const fy = pad;
    minimapRect.x = fx;
    minimapRect.y = fy;
    minimapRect.w = frameW;
    minimapRect.h = frameH;

    ctx.save();
    ctx.globalAlpha = 0.88;

    // Frame shadow
    ctx.fillStyle = 'rgba(43, 29, 20, 0.25)';
    roundRectPath(ctx, fx, fy + 3, frameW, frameH, 10);
    ctx.fill();

    // Parchment frame
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    roundRectPath(ctx, fx, fy, frameW, frameH, 10);
    ctx.fill();
    ctx.stroke();

    const mx = fx + 5;
    const my = fy + 5;

    // Draw cached terrain minimap
    ctx.save();
    roundRectPath(ctx, mx, my, mapW, mapH, 5);
    ctx.clip();
    if (minimapCanvas) {
      ctx.drawImage(minimapCanvas, mx, my, mapW, mapH);
    } else {
      ctx.fillStyle = '#78c850';
      ctx.fillRect(mx, my, mapW, mapH);
    }

    const sx = mapW / world.cols;
    const sy = mapH / world.rows;

    // Undefeated trainers (small orange dots)
    if (Array.isArray(world.npcs)) {
      for (let i = 0; i < world.npcs.length; i++) {
        const npc = world.npcs[i];
        if (npc.role === 'trainer' && !isNpcHidden(npc) && !isNpcDefeated(state, npc)) {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(mx + (npc.x + 0.5) * sx, my + (npc.y + 0.5) * sy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const { healPos, arenaPos } = findKeyLandmarks();

    // Healing Greenhouse marker (green/white cross dot)
    if (healPos) {
      const hx = mx + healPos.x * sx;
      const hy = my + healPos.y * sy;
      ctx.fillStyle = '#789263';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx, hy, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx - 2.3, hy - 0.8, 4.6, 1.6);
      ctx.fillRect(hx - 0.8, hy - 2.3, 1.6, 4.6);
    }

    // Leader Flora's Golden Arena marker (gold star dot)
    if (arenaPos) {
      const ax = mx + arenaPos.x * sx;
      const ay = my + arenaPos.y * sy;
      ctx.fillStyle = '#d6b872';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ax, ay, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Player pulsing pin
    const px = mx + (player.renderX + 0.5) * sx;
    const py = my + (player.renderY + 0.5) * sy;
    const pulse = 3.5 + Math.sin(time * 0.008) * 1.1;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(px, py, pulse + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c47965';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Inner border around map
    ctx.strokeStyle = 'rgba(43, 29, 20, 0.45)';
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, mx, my, mapW, mapH, 5);
    ctx.stroke();

    // Compact legend footer
    const legY = my + mapH + 10;
    ctx.font = '700 9.5px "Nunito", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#789263';
    ctx.beginPath();
    ctx.arc(fx + 11, legY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.fillText('Cura', fx + 17, legY + 0.5);

    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(fx + 52, legY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.fillText('Arena', fx + 58, legY + 0.5);

    ctx.fillStyle = '#c47965';
    ctx.beginPath();
    ctx.arc(fx + 96, legY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.fillText('Você', fx + 101, legY + 0.5);

    ctx.restore();
  }

  function drawZoneBanner(ctx) {
    if (!zoneBanner || !canvas) return;
    const t = zoneBanner.elapsed;
    let alpha = 1;
    let yOffset = 0;

    if (t < 280) {
      const p = t / 280;
      alpha = p;
      yOffset = (1 - p) * -18;
    } else if (t > ZONE_BANNER_MS - 420) {
      const p = (ZONE_BANNER_MS - t) / 420;
      alpha = clamp(p, 0, 1);
      yOffset = (1 - alpha) * -14;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 15px "Nunito", system-ui, sans-serif';
    const titleW = ctx.measureText(zoneBanner.name).width;
    ctx.font = '600 11px "Nunito", system-ui, sans-serif';
    const subW = zoneBanner.subtitle ? ctx.measureText(zoneBanner.subtitle).width : 0;

    const bw = Math.max(168, Math.max(titleW, subW) + 38);
    const bh = zoneBanner.subtitle ? 44 : 30;
    const bx = 14;
    const by = 12 + yOffset;

    ctx.fillStyle = 'rgba(43, 29, 20, 0.28)';
    roundRectPath(ctx, bx, by + 3, bw, bh, 12);
    ctx.fill();

    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    roundRectPath(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.stroke();

    // Accent green leaf bar on left
    ctx.fillStyle = '#789263';
    roundRectPath(ctx, bx + 4, by + 4, 6, bh - 8, 4);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = OUTLINE;
    ctx.font = '700 14.5px "Nunito", system-ui, sans-serif';
    ctx.fillText(zoneBanner.name, bx + 18, zoneBanner.subtitle ? by + 15 : by + bh * 0.52);

    if (zoneBanner.subtitle) {
      ctx.fillStyle = '#5c4b3c';
      ctx.font = '600 11px "Nunito", system-ui, sans-serif';
      ctx.fillText(zoneBanner.subtitle, bx + 18, by + 31);
    }

    ctx.restore();
  }

  function drawEncounterTransition(ctx) {
    if (!encounterPending || !canvas) return;
    const p = clamp(encounterPending.elapsed / ENCOUNTER_FLASH_MS, 0, 1);
    // Double cartoon flash + bright sunlit radial burst
    const flashWave = Math.abs(Math.sin(p * Math.PI * 3));
    const finalCover = p > 0.65 ? (p - 0.65) / 0.35 : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 253, 235, ' + clamp(flashWave * 0.72 + finalCover * 0.9, 0, 0.95).toFixed(2) + ')';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Expanding vibrant green ring around center
    const cx = viewport.width * 0.5;
    const cy = viewport.height * 0.5;
    ctx.strokeStyle = 'rgba(34, 197, 94, ' + (1 - p * 0.5).toFixed(2) + ')';
    ctx.lineWidth = 10 * (1 - p * 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, p * Math.hypot(cx, cy) * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    if (!ctx || !canvas || !world) return;

    if (!syncViewport()) return;
    if (!camera.snapped) updateCamera(0, true);
    ctx.setTransform(viewport.scaleX, 0, 0, viewport.scaleY, 0, 0);

    const S = world.tileSize || 48;
    const camX = Math.round(camera.x);
    const camY = Math.round(camera.y);
    const time = elapsedTime;

    ctx.save();
    ctx.fillStyle = '#25372d';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.scale(1, GROUND_TILT);
    ctx.translate(-camX, -camY);

    const startCol = Math.max(0, Math.floor(camX / S) - 1);
    const endCol = Math.min(world.cols - 1, Math.ceil((camX + viewport.width) / S) + 1);
    const startRow = Math.max(0, Math.floor(camY / S) - 2);
    const endRow = Math.min(world.rows - 1, Math.ceil((camY + viewport.height / GROUND_TILT) / S) + 2);

    // PASS 1: Ground Terrain
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const t = getTile(c, r);
        const px = c * S;
        const py = r * S;

        switch (t) {
          case TILE.DIRT:
            drawDirtTile(ctx, px, py, c, r, S);
            break;
          case TILE.TALL_GRASS:
            drawTallGrassBase(ctx, px, py, c, r, S, time);
            break;
          case TILE.WATER:
            drawWaterTile(ctx, px, py, c, r, S, time);
            break;
          case TILE.BRIDGE:
            drawBridgeTile(ctx, px, py, c, r, S, time);
            break;
          case TILE.FLOWERS:
            drawFlowersTile(ctx, px, py, c, r, S, time);
            break;
          case TILE.GREENHOUSE_FLOOR:
            drawGreenhouseFloorTile(ctx, px, py, c, r, S);
            break;
          case TILE.DOOR:
            drawDoorTile(ctx, px, py, c, r, S);
            break;
          case TILE.BUILDING:
            drawGrassTile(ctx, px, py, c, r, S);
            if (!buildingTileSet.has(c + ',' + r)) {
              drawFallbackBuildingTile(ctx, c, r, S);
            }
            break;
          case TILE.SAND:
            drawSandTile(ctx, px, py, c, r, S);
            break;
          case TILE.PALM:
            if (getTile(c, r + 1) === TILE.SAND || getTile(c, r - 1) === TILE.SAND) {
              drawSandTile(ctx, px, py, c, r, S);
            } else {
              drawGrassTile(ctx, px, py, c, r, S);
            }
            break;
          case TILE.CAVE_FLOOR:
          case TILE.ROCK:
            drawCaveFloorTile(ctx, px, py, c, r, S);
            break;
          case TILE.CAVE_GRASS:
            drawCaveGrassBase(ctx, px, py, c, r, S, time);
            break;
          case TILE.HEAL_COUNTER:
            // Draw stone/grass under healing counter depending on neighbors
            if (getTile(c, r + 1) === TILE.GREENHOUSE_FLOOR || getTile(c, r - 1) === TILE.GREENHOUSE_FLOOR) {
              drawGreenhouseFloorTile(ctx, px, py, c, r, S);
            } else {
              drawGrassTile(ctx, px, py, c, r, S);
            }
            break;
          default:
            drawGrassTile(ctx, px, py, c, r, S);
            break;
        }
      }
    }

    // Subtle click-to-walk destination ring
    if (clickPath.length > 0) {
      const dest = clickPath[clickPath.length - 1];
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.01);
      ctx.strokeStyle = 'rgba(255, 253, 245, ' + (0.45 + pulse * 0.35).toFixed(2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse((dest.x + 0.5) * S, (dest.y + 0.55) * S, 10 + pulse * 4, 6 + pulse * 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // PASS 2: Y-Sorted Depth Drawables (Buildings, Trees, Fences, Counters, Tall Grass Front, NPCs, Player)
    const drawList = [];
    function upright(anchorY, draw) {
      ctx.save();
      ctx.translate(0, anchorY);
      ctx.scale(1, 1 / GROUND_TILT);
      ctx.translate(0, -anchorY);
      draw();
      ctx.restore();
    }

    // Buildings
    if (Array.isArray(world.buildings)) {
      for (let i = 0; i < world.buildings.length; i++) {
        const b = world.buildings[i];
        if (b.x + b.w < startCol - 1 || b.x > endCol + 1 ||
            b.y + b.h < startRow - 1 || b.y > endRow + 2) {
          continue;
        }
        drawList.push({
          sortY: (b.y + b.h - 0.55) * S,
          draw: function () {
            drawBuildingObject(ctx, b, S);
          }
        });
      }
    }

    // Solid props + Tall Grass Front Blade Rows
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const t = getTile(c, r);
        if (t === TILE.TREE) {
          drawList.push({
            sortY: (r + 0.88) * S,
            draw: function () {
              upright((r + 0.88) * S, () => drawTreeObject(ctx, c, r, S, time));
            }
          });
        } else if (t === TILE.FENCE) {
          drawList.push({
            sortY: (r + 0.72) * S,
            draw: function () {
              drawFenceObject(ctx, c, r, S);
            }
          });
        } else if (t === TILE.HEAL_COUNTER) {
          drawList.push({
            sortY: (r + 0.78) * S,
            draw: function () {
              drawHealCounterObject(ctx, c, r, S);
            }
          });
        } else if (t === TILE.TALL_GRASS) {
          drawList.push({
            sortY: (r + 0.86) * S,
            draw: function () {
              drawTallGrassFront(ctx, c * S, r * S, c, r, S, time);
            }
          });
        } else if (t === TILE.PALM) {
          drawList.push({
            sortY: (r + 0.9) * S,
            draw: function () {
              upright((r + 0.90) * S, () => drawPalmObject(ctx, c, r, S, time));
            }
          });
        } else if (t === TILE.ROCK) {
          drawList.push({
            sortY: (r + 0.85) * S,
            draw: function () {
              drawRockObject(ctx, c, r, S);
            }
          });
        } else if (t === TILE.CAVE_GRASS) {
          drawList.push({
            sortY: (r + 0.86) * S,
            draw: function () {
              drawCaveGrassFront(ctx, c * S, r * S, c, r, S, time);
            }
          });
        }
      }
    }

    // NPCs
    if (Array.isArray(world.npcs)) {
      for (let i = 0; i < world.npcs.length; i++) {
        const npc = world.npcs[i];
        if (isNpcHidden(npc)) continue;
        if (npc.x < startCol - 1 || npc.x > endCol + 1 ||
            npc.y < startRow - 1 || npc.y > endRow + 1) {
          continue;
        }
        const npcDir = npcFacingOverrides[npc.id] || npc.dir || 'down';
        drawList.push({
          sortY: (npc.y + 0.78) * S,
          draw: function () {
            upright((npc.y + 0.78) * S, () => drawCharacterEntity(ctx,
              (npc.x + 0.5) * S, (npc.y + 0.44) * S, S * 0.92,
              npc.style || npc.role || 'prof', npcDir, 0, false));
          }
        });
      }
    }

    // Player
    drawList.push({
      sortY: (player.renderY + 0.8) * S,
      draw: function () {
        upright((player.renderY + 0.80) * S, () => drawCharacterEntity(ctx,
          (player.renderX + 0.5) * S, (player.renderY + 0.44) * S, S * 0.94,
          'player', player.dir, player.walkFrame, player.moving));
      }
    });

    drawList.sort(function (a, b) {
      return a.sortY - b.sortY;
    });

    for (let i = 0; i < drawList.length; i++) {
      drawList[i].draw();
    }

    // PASS 3: Particles, Butterflies & Sunlit Pollen
    drawParticlesAndAmbient(ctx, time);

    // PASS 4: Floating NPC Badges & [Espaço] Prompts
    drawNpcFloatingBadges(ctx, S, time);

    ctx.restore();

    const light = ctx.createRadialGradient(
      viewport.width * 0.42, viewport.height * 0.40, 10,
      viewport.width * 0.42, viewport.height * 0.40, viewport.width * 0.72
    );
    light.addColorStop(0, 'rgba(234, 218, 175, 0.09)');
    light.addColorStop(1, 'rgba(15, 29, 31, 0.36)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    drawZoneBanner(ctx);
    drawMinimapHUD(ctx, time);
    drawEncounterTransition(ctx);
  }

  function loop(now) {
    if (!initialized) return;
    if (!lastFrameTime) lastFrameTime = now;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    updateSimulation(dt);
    render();

    rafId = global.requestAnimationFrame(loop);
  }

  // ==================== INPUT HANDLERS ====================

  function mapKeyToDir(e) {
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();
    if (code === 'ArrowUp' || code === 'KeyW' || key === 'w' || key === 'arrowup') return 'up';
    if (code === 'ArrowDown' || code === 'KeyS' || key === 's' || key === 'arrowdown') return 'down';
    if (code === 'ArrowLeft' || code === 'KeyA' || key === 'a' || key === 'arrowleft') return 'left';
    if (code === 'ArrowRight' || code === 'KeyD' || key === 'd' || key === 'arrowright') return 'right';
    return null;
  }

  function isTextInputElement(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function handleKeyDown(e) {
    if (HM.Audio && typeof HM.Audio.unlock === 'function') {
      HM.Audio.unlock();
    }
    if (paused || encounterPending || trainerAlert) return;
    if (isTextInputElement(e.target)) return;

    const dir = mapKeyToDir(e);
    if (dir) {
      e.preventDefault();
      if (keyDirStack.indexOf(dir) === -1) {
        keyDirStack.push(dir);
      }
      return;
    }

    const code = e.code || '';
    const key = (e.key || '').toLowerCase();
    if (code === 'Space' || code === 'Enter' || code === 'KeyE' || key === ' ' || key === 'enter' || key === 'e') {
      if (e.repeat) return;
      e.preventDefault();
      HM.Overworld.interact();
    }
  }

  function handleKeyUp(e) {
    const dir = mapKeyToDir(e);
    if (dir) {
      const idx = keyDirStack.indexOf(dir);
      if (idx !== -1) keyDirStack.splice(idx, 1);
    }
  }

  function handleWindowBlur() {
    clearInputs();
  }

  function clientToCanvasCoords(clientX, clientY) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * viewport.width,
      y: ((clientY - rect.top) / rect.height) * viewport.height
    };
  }

  function handlePointerDown(e) {
    if (HM.Audio && typeof HM.Audio.unlock === 'function') {
      HM.Audio.unlock();
    }
    if (paused || encounterPending || trainerAlert || !world || !canvas) return;
    if (e.button !== undefined && e.button !== 0) return;

    const pos = clientToCanvasCoords(e.clientX, e.clientY);
    if (!pos) return;

    // Clicking the corner minimap toggles compact mode without walking
    if (pos.x >= minimapRect.x && pos.x <= minimapRect.x + minimapRect.w &&
        pos.y >= minimapRect.y && pos.y <= minimapRect.y + minimapRect.h) {
      minimapCompact = !minimapCompact;
      if (HM.Audio && typeof HM.Audio.playSelect === 'function') {
        HM.Audio.playSelect();
      }
      return;
    }

    pointerDown = true;
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    pointerDownTime = performance.now();
    pointerMoved = false;
  }

  function handlePointerMove(e) {
    if (!pointerDown) return;
    const dx = e.clientX - pointerClientX;
    const dy = e.clientY - pointerClientY;
    if (Math.hypot(dx, dy) > 10) {
      pointerMoved = true;
    }
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
  }

  function handlePointerUp(e) {
    if (!pointerDown) return;
    const wasQuickTap = !pointerMoved && (performance.now() - pointerDownTime < 260);
    pointerDown = false;
    pointerMoved = false;

    if (!wasQuickTap || paused || encounterPending || trainerAlert || !world || !canvas) return;

    const pos = clientToCanvasCoords(e.clientX, e.clientY);
    if (!pos) return;

    const S = world.tileSize || 48;
    const worldX = pos.x + Math.round(camera.x);
    const worldY = pos.y / GROUND_TILT + Math.round(camera.y);
    const tileCol = Math.floor(worldX / S);
    const tileRow = Math.floor(worldY / S);

    if (tileCol < 0 || tileCol >= world.cols || tileRow < 0 || tileRow >= world.rows) return;

    // Check if user clicked on an NPC (exact tile or slight upper body overlap)
    let clickedNpc = getNpcAt(tileCol, tileRow);
    if (!clickedNpc && Array.isArray(world.npcs)) {
      for (let i = 0; i < world.npcs.length; i++) {
        const n = world.npcs[i];
        if (isNpcHidden(n)) continue;
        const ncx = (n.x + 0.5) * S;
        const ncy = (n.y + 0.45) * S;
        if (Math.hypot(worldX - ncx, worldY - ncy) <= S * 0.62) {
          clickedNpc = n;
          break;
        }
      }
    }

    if (clickedNpc) {
      const dx = clickedNpc.x - player.x;
      const dy = clickedNpc.y - player.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      const acrossCounter = dist === 2 && (dx === 0 || dy === 0) &&
        getTile(player.x + dx / 2, player.y + dy / 2) === TILE.HEAL_COUNTER;

      if (dist <= 1 || acrossCounter) {
        const faceDir = Math.abs(dx) >= Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up');
        triggerNpcInteract(clickedNpc, faceDir);
        return;
      }

      // Walk smoothly to adjacent tile of the clicked NPC and talk on arrival
      const path = computePath(player.x, player.y, clickedNpc.x, clickedNpc.y, true);
      if (path.length > 0) {
        clickPath = path;
        clickInteractNpc = clickedNpc;
      }
      return;
    }

    // Clicked on a walkable tile -> walk there via smooth BFS path
    if (tileCol === player.x && tileRow === player.y) return;
    if (isWalkable(tileCol, tileRow)) {
      const path = computePath(player.x, player.y, tileCol, tileRow, false);
      if (path.length > 0) {
        clickPath = path;
        clickInteractNpc = null;
      }
    } else {
      // Clicked on a solid tile (e.g. door/counter/tree): nudge 1 step in that cardinal direction
      const dx = tileCol - player.x;
      const dy = tileRow - player.y;
      const dir = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      const d = DIR_DELTA[dir];
      if (isWalkable(player.x + d.dx, player.y + d.dy)) {
        clickPath = [{ x: player.x + d.dx, y: player.y + d.dy }];
        clickInteractNpc = null;
      } else {
        player.dir = dir;
        syncPlayerPosToState(state, player.x, player.y, player.dir);
      }
    }
  }

  function attachListeners() {
    onKeyDownBound = handleKeyDown;
    onKeyUpBound = handleKeyUp;
    onWindowBlurBound = handleWindowBlur;
    onPointerDownBound = handlePointerDown;
    onPointerMoveBound = handlePointerMove;
    onPointerUpBound = handlePointerUp;

    global.addEventListener('keydown', onKeyDownBound);
    global.addEventListener('keyup', onKeyUpBound);
    global.addEventListener('blur', onWindowBlurBound);

    if (canvas) {
      canvas.addEventListener('pointerdown', onPointerDownBound);
      global.addEventListener('pointermove', onPointerMoveBound);
      global.addEventListener('pointerup', onPointerUpBound);
      global.addEventListener('pointercancel', onPointerUpBound);
    }
  }

  function detachListeners() {
    if (onKeyDownBound) global.removeEventListener('keydown', onKeyDownBound);
    if (onKeyUpBound) global.removeEventListener('keyup', onKeyUpBound);
    if (onWindowBlurBound) global.removeEventListener('blur', onWindowBlurBound);
    if (canvas && onPointerDownBound) {
      canvas.removeEventListener('pointerdown', onPointerDownBound);
    }
    if (onPointerMoveBound) global.removeEventListener('pointermove', onPointerMoveBound);
    if (onPointerUpBound) {
      global.removeEventListener('pointerup', onPointerUpBound);
      global.removeEventListener('pointercancel', onPointerUpBound);
    }
    onKeyDownBound = null;
    onKeyUpBound = null;
    onWindowBlurBound = null;
    onPointerDownBound = null;
    onPointerMoveBound = null;
    onPointerUpBound = null;
  }

  // ==================== PUBLIC API (HM.Overworld) ====================

  HM.Overworld = {
    init: function (opts) {
      if (initialized) {
        HM.Overworld.destroy();
      }
      opts = opts || {};
      canvas = opts.canvas || null;
      ctx = canvas ? canvas.getContext('2d') : null;
      state = opts.state || null;
      callbacks = opts.callbacks || {};
      world = HM.WORLD || null;

      if (!canvas || !ctx || !world) {
        console.warn('[Overworld] init chamado sem canvas ou HM.WORLD.');
        return;
      }

      const startPos = readPlayerPosFromState(state, world);
      player.x = clamp(Math.round(startPos.x), 0, world.cols - 1);
      player.y = clamp(Math.round(startPos.y), 0, world.rows - 1);
      player.fromX = player.x;
      player.fromY = player.y;
      player.renderX = player.x;
      player.renderY = player.y;
      player.dir = startPos.dir;
      player.moving = false;
      player.stepElapsed = 0;
      player.walkCycle = 0;
      player.walkFrame = 0;
      syncPlayerPosToState(state, player.x, player.y, player.dir);

      paused = false;
      encounterPending = null;
      trainerAlert = null;
      tallGrassCooldown = 2;
      minimapCompact = canvas.clientWidth < 540;
      currentZone = null;
      zoneBanner = null;
      particles = [];
      clearInputs();

      for (const k in npcFacingOverrides) {
        delete npcFacingOverrides[k];
      }
      for (const k in trainerSightCooldowns) {
        delete trainerSightCooldowns[k];
      }

      buildWorldCaches();
      camera.snapped = false;
      updateCamera(0, true);
      updateZone(player.x, player.y, true);

      attachListeners();
      initialized = true;
      lastFrameTime = 0;
      rafId = global.requestAnimationFrame(loop);
    },

    setState: function (newState) {
      state = newState || null;
      if (!world || !state) return;
      const pos = readPlayerPosFromState(state, world);
      const nx = clamp(Math.round(pos.x), 0, world.cols - 1);
      const ny = clamp(Math.round(pos.y), 0, world.rows - 1);
      if (nx !== player.x || ny !== player.y) {
        player.x = nx;
        player.y = ny;
        player.fromX = nx;
        player.fromY = ny;
        player.renderX = nx;
        player.renderY = ny;
        player.moving = false;
        player.stepElapsed = 0;
        player.walkFrame = 0;
        updateCamera(0, true);
        updateZone(player.x, player.y, false);
      }
      if (VALID_DIRS.has(pos.dir)) {
        player.dir = pos.dir;
      }
    },

    pause: function () {
      paused = true;
      clearInputs();
    },

    resume: function () {
      paused = false;
      clearInputs();
      encounterPending = null;
      trainerAlert = null;
      // Garante cooldown mínimo de 3 passos na grama alta após retornar de batalha
      tallGrassCooldown = Math.max(tallGrassCooldown, ENCOUNTER_COOLDOWN_STEPS);
      if (world) {
        updateZone(player.x, player.y, false);
      }
    },

    isPaused: function () {
      return Boolean(paused);
    },

    setHeldDirection: function (dir) {
      if (dir && VALID_DIRS.has(dir)) {
        heldDpadDir = dir;
        if (HM.Audio && typeof HM.Audio.unlock === 'function') {
          HM.Audio.unlock();
        }
      } else {
        heldDpadDir = null;
      }
    },

    interact: function () {
      if (!initialized || paused || encounterPending || trainerAlert) return false;
      // Allow finishing tiny end of step cleanly or interacting right away
      const target = findInteractableTarget();
      if (!target || !target.npc) return false;
      triggerNpcInteract(target.npc, target.faceDir);
      return true;
    },

    teleport: function (x, y, dir) {
      if (!world) return;
      const nx = clamp(Math.round(Number(x) || 0), 0, world.cols - 1);
      const ny = clamp(Math.round(Number(y) || 0), 0, world.rows - 1);
      player.x = nx;
      player.y = ny;
      player.fromX = nx;
      player.fromY = ny;
      player.renderX = nx;
      player.renderY = ny;
      player.moving = false;
      player.stepElapsed = 0;
      player.walkFrame = 0;
      if (VALID_DIRS.has(dir)) {
        player.dir = dir;
      }
      clearInputs();
      encounterPending = null;
      trainerAlert = null;
      tallGrassCooldown = ENCOUNTER_COOLDOWN_STEPS;

      syncPlayerPosToState(state, player.x, player.y, player.dir);
      updateCamera(0, true);
      spawnTeleportSparkles(player.x, player.y);
      updateZone(player.x, player.y, true);
    },

    destroy: function () {
      initialized = false;
      paused = false;
      if (rafId !== null) {
        global.cancelAnimationFrame(rafId);
        rafId = null;
      }
      detachListeners();
      clearInputs();
      encounterPending = null;
      trainerAlert = null;
      zoneBanner = null;
      particles = [];
      butterflies = [];
      pollen = [];
      minimapCanvas = null;
      canvas = null;
      ctx = null;
      state = null;
      callbacks = {};
    }
  };
})(window);
