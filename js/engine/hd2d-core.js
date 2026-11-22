(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  const STORAGE_KEY = 'hortamon_3d_enabled';
  const TEX_SIZE = 256;

  let webglAvailableCache = null;
  let enabledState = null;
  const enabledListeners = new Set();

  let sharedTextures = null;
  let sharedShadowTexture = null;
  const creatureTexCache = new Map();
  const characterTexCache = new Map();
  let artReadyHooked = false;

  // =========================================================================
  // DETERMINISTIC SEEDED PRNG (texturas pictóricas consistentes)
  // =========================================================================
  function createRng(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function drawWrapped(size, x, y, drawFn) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox * size;
        const ny = y + oy * size;
        if (nx < -64 || nx > size + 64 || ny < -64 || ny > size + 64) continue;
        drawFn(nx, ny);
      }
    }
  }

  function finalizeTileTexture(canvas, repeat) {
    const THREE = global.THREE;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    tex.userData = tex.userData || {};
    tex.userData._hd2dShared = true;
    tex.needsUpdate = true;
    return tex;
  }

  // =========================================================================
  // WEBGL AVAILABILITY & ENABLED PREFERENCE
  // =========================================================================
  function isAvailable() {
    if (webglAvailableCache !== null) return webglAvailableCache;
    try {
      if (typeof global.THREE === 'undefined' || typeof document === 'undefined') {
        webglAvailableCache = false;
        return false;
      }
      const probe = document.createElement('canvas');
      probe.width = 2;
      probe.height = 2;
      const opts = { failIfMajorPerformanceCaveat: false };
      const gl =
        probe.getContext('webgl2', opts) ||
        probe.getContext('webgl', opts) ||
        probe.getContext('experimental-webgl', opts);
      if (!gl) {
        webglAvailableCache = false;
        return false;
      }
      try {
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose && typeof lose.loseContext === 'function') lose.loseContext();
      } catch (_e) {
        // Ignore cleanup extension errors
      }
      webglAvailableCache = true;
      return true;
    } catch (_err) {
      webglAvailableCache = false;
      return false;
    }
  }

  function readSavedPref() {
    try {
      if (!global.localStorage) return null;
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      if (raw === 'false' || raw === '0') return false;
      if (raw === 'true' || raw === '1') return true;
      return null;
    } catch (_err) {
      return null;
    }
  }

  function isEnabled() {
    if (!isAvailable()) return false;
    if (enabledState === null) {
      const saved = readSavedPref();
      enabledState = saved === null ? true : saved;
    }
    return Boolean(enabledState);
  }

  function setEnabled(bool) {
    const next = Boolean(bool);
    enabledState = next;
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
      }
    } catch (_err) {
      // Ignore storage quota / privacy mode errors
    }
    const effective = next && isAvailable();
    enabledListeners.forEach(function (fn) {
      try {
        fn(effective);
      } catch (_err) {
        // Keep listener dispatch isolated
      }
    });
    return effective;
  }

  function onEnabledChange(fn) {
    if (typeof fn !== 'function') return function () {};
    enabledListeners.add(fn);
    return function () {
      enabledListeners.delete(fn);
    };
  }

  // =========================================================================
  // RENDERER FACTORY
  // =========================================================================
  function createRenderer(canvas, width, height) {
    const THREE = global.THREE;
    if (!THREE) {
      throw new Error('HortaMon.HD2D: THREE is not loaded.');
    }
    const w = width || (canvas && canvas.width) || 768;
    const h = height || (canvas && canvas.height) || 480;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    return renderer;
  }

  // =========================================================================
  // PICTORIAL HAND-PAINTED PROCEDURAL TEXTURES (14 MATERIAIS)
  // =========================================================================
  function paintGrass(ctx, S) {
    const rng = createRng(101);
    ctx.fillStyle = '#5eb84d';
    ctx.fillRect(0, 0, S, S);

    // Manchas aquareladas de luz solar e sombra de relva
    const blotches = ['#70ca58', '#4da342', '#7fd660', '#48993f', '#66c052'];
    for (let i = 0; i < 65; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 14 + rng() * 30;
      const col = blotches[Math.floor(rng() * blotches.length)];
      drawWrapped(S, x, y, function (nx, ny) {
        const g = ctx.createRadialGradient(nx, ny, 2, nx, ny, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(94,184,77,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Fios de grama curvados e pequenos trevos
    ctx.lineCap = 'round';
    for (let i = 0; i < 160; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const h = 6 + rng() * 10;
      const lean = (rng() - 0.5) * 7;
      const bright = rng() > 0.45;
      ctx.strokeStyle = bright ? 'rgba(167, 240, 112, 0.55)' : 'rgba(34, 96, 36, 0.36)';
      ctx.lineWidth = 1.2 + rng() * 1.1;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.quadraticCurveTo(nx + lean * 0.6, ny - h * 0.5, nx + lean, ny - h);
        ctx.stroke();
      });
    }

    // Mini florzinhas e trevinhos sutis
    for (let i = 0; i < 18; i++) {
      const x = rng() * S;
      const y = rng() * S;
      ctx.fillStyle = rng() > 0.35 ? 'rgba(254, 249, 195, 0.65)' : 'rgba(255, 255, 255, 0.55)';
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.beginPath();
        ctx.arc(nx, ny, 1.5 + rng() * 1.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function paintDirt(ctx, S) {
    const rng = createRng(202);
    ctx.fillStyle = '#c89b66';
    ctx.fillRect(0, 0, S, S);

    const tones = ['#d7ae78', '#b78652', '#dfb984', '#a87847', '#cca16d'];
    for (let i = 0; i < 75; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const rx = 12 + rng() * 26;
      const ry = 8 + rng() * 18;
      const col = tones[Math.floor(rng() * tones.length)];
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.ellipse(nx, ny, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;

    // Pedrinhas quentes e grãos de terra
    for (let i = 0; i < 130; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 1.2 + rng() * 3.2;
      const light = rng() > 0.45;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.fillStyle = light ? 'rgba(246, 224, 184, 0.55)' : 'rgba(116, 76, 39, 0.44)';
        ctx.beginPath();
        ctx.ellipse(nx, ny, r, r * 0.72, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function paintTallGrass(ctx, S) {
    const rng = createRng(303);
    ctx.fillStyle = '#2d7a36';
    ctx.fillRect(0, 0, S, S);

    // Fundo de sombras folhosas profundas
    for (let i = 0; i < 55; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 16 + rng() * 26;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(22, 83, 35, 0.42)' : 'rgba(67, 160, 71, 0.35)';
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Lâminas largas de grama alta em camadas
    ctx.lineCap = 'round';
    const bladeColors = ['#1b5e20', '#2e7d32', '#43a047', '#66bb6a', '#9ccc65'];
    for (let layer = 0; layer < 5; layer++) {
      ctx.strokeStyle = bladeColors[layer];
      for (let i = 0; i < 55; i++) {
        const x = rng() * S;
        const y = rng() * S;
        const h = 16 + rng() * 22;
        const bend = (rng() - 0.5) * 18;
        ctx.lineWidth = 3.2 - layer * 0.35;
        drawWrapped(S, x, y, function (nx, ny) {
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.quadraticCurveTo(nx + bend * 0.5, ny - h * 0.55, nx + bend, ny - h);
          ctx.stroke();
        });
      }
    }
  }

  function paintSand(ctx, S) {
    const rng = createRng(404);
    ctx.fillStyle = '#f2d38c';
    ctx.fillRect(0, 0, S, S);

    // Ondulações suaves sopradas pela brisa tropical
    for (let row = 0; row < 12; row++) {
      const baseY = (row / 12) * S;
      ctx.strokeStyle = row % 2 === 0 ? 'rgba(255, 248, 220, 0.46)' : 'rgba(205, 158, 82, 0.28)';
      ctx.lineWidth = 6 + (row % 3) * 2;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const wy = baseY + Math.sin((x / S) * Math.PI * 2 + row * 0.9) * 5;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // Grãos dourados e pedacinhos de concha
    for (let i = 0; i < 220; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 0.9 + rng() * 1.8;
      ctx.fillStyle =
        rng() > 0.65
          ? 'rgba(255, 252, 238, 0.65)'
          : rng() > 0.3
            ? 'rgba(196, 145, 72, 0.35)'
            : 'rgba(244, 180, 146, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintCaveFloor(ctx, S) {
    const rng = createRng(505);
    ctx.fillStyle = '#3c4559';
    ctx.fillRect(0, 0, S, S);

    // Placas rochosas suaves e variações minerais
    const slateTones = ['#48536a', '#323a4c', '#4f5a72', '#2c3345', '#424d63'];
    for (let i = 0; i < 70; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const rx = 14 + rng() * 28;
      const ry = 10 + rng() * 20;
      const col = slateTones[Math.floor(rng() * slateTones.length)];
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.42;
        ctx.beginPath();
        ctx.ellipse(nx, ny, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;

    // Fissuras sutis e veios de musgo bioluminescente
    ctx.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const len = 14 + rng() * 26;
      const ang = rng() * Math.PI * 2;
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(94, 234, 212, 0.25)' : 'rgba(20, 24, 36, 0.45)';
      ctx.lineWidth = i % 5 === 0 ? 1.8 : 1.3;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + Math.cos(ang) * len, ny + Math.sin(ang) * len);
        ctx.stroke();
      });
    }

    // Cristaizinhos brilhantes incrustados no chão
    for (let i = 0; i < 42; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const isGlow = rng() > 0.72;
      ctx.fillStyle = isGlow ? 'rgba(103, 232, 249, 0.55)' : 'rgba(148, 163, 184, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, isGlow ? 1.7 : 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintGreenhouseFloor(ctx, S) {
    const rng = createRng(606);
    ctx.fillStyle = '#e7dfcb';
    ctx.fillRect(0, 0, S, S);

    const grid = 4;
    const cell = S / grid;
    const tilePalette = ['#efe8d6', '#e6dec9', '#f3ede0', '#dfd6bf'];
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const x = c * cell;
        const y = r * cell;
        ctx.fillStyle = tilePalette[(r * 3 + c * 5) % tilePalette.length];
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);

        // Brilho sutil superior-esquerdo e chanfro inferior
        ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
        ctx.fillRect(x + 3, y + 3, cell - 6, 4);
        ctx.fillStyle = 'rgba(138, 121, 93, 0.16)';
        ctx.fillRect(x + 3, y + cell - 6, cell - 6, 3);

        // Rejunte botânico quente
        ctx.strokeStyle = 'rgba(122, 108, 84, 0.48)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);

        // Detalhe geométrico discreto de mármore
        ctx.strokeStyle = 'rgba(182, 165, 134, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 8 + rng() * 14, y + 10 + rng() * 12);
        ctx.quadraticCurveTo(x + cell * 0.5, y + cell * 0.5, x + cell - 10, y + cell - 10 - rng() * 14);
        ctx.stroke();
      }
    }
  }

  function paintWood(ctx, S) {
    const rng = createRng(707);
    ctx.fillStyle = '#a46c3b';
    ctx.fillRect(0, 0, S, S);

    const planks = 4;
    const ph = S / planks;
    const plankColors = ['#b57b45', '#9d6636', '#ad733f', '#a66d3b'];
    for (let p = 0; p < planks; p++) {
      const py = p * ph;
      ctx.fillStyle = plankColors[p % plankColors.length];
      ctx.fillRect(0, py, S, ph);

      // Veios orgânicos da madeira
      for (let g = 0; g < 18; g++) {
        const gy = py + 3 + rng() * (ph - 6);
        ctx.strokeStyle = g % 2 === 0 ? 'rgba(72, 40, 18, 0.25)' : 'rgba(235, 192, 138, 0.22)';
        ctx.lineWidth = 1 + rng() * 1.6;
        ctx.beginPath();
        for (let x = 0; x <= S; x += 16) {
          const wave = Math.sin((x / S) * Math.PI * 2 + g) * 2.2;
          if (x === 0) ctx.moveTo(x, gy + wave);
          else ctx.lineTo(x, gy + wave);
        }
        ctx.stroke();
      }

      // Nó de madeira
      const kx = 28 + rng() * (S - 56);
      const ky = py + ph * (0.35 + rng() * 0.3);
      ctx.strokeStyle = 'rgba(72, 40, 18, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 9, 4.2, 0.1, 0, Math.PI * 2);
      ctx.stroke();

      // Fenda entre tábuas + rebites
      ctx.fillStyle = 'rgba(54, 29, 12, 0.58)';
      ctx.fillRect(0, py, S, 2.5);
      ctx.fillStyle = 'rgba(244, 212, 168, 0.22)';
      ctx.fillRect(0, py + 2.5, S, 1.5);

      ctx.fillStyle = '#4a2c16';
      ctx.beginPath();
      ctx.arc(14, py + ph * 0.5, 2.6, 0, Math.PI * 2);
      ctx.arc(S - 14, py + ph * 0.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintWater(ctx, S) {
    const rng = createRng(808);
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#29b6d8');
    g.addColorStop(0.5, '#1ea5cc');
    g.addColorStop(1, '#29b6d8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Cáusticas suaves
    for (let i = 0; i < 42; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const rx = 18 + rng() * 28;
      const ry = 7 + rng() * 12;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.strokeStyle = 'rgba(186, 244, 255, 0.34)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(nx, ny, rx, ry, -0.15, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // Ondinhas brilhantes horizontais
    ctx.lineCap = 'round';
    for (let i = 0; i < 36; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const w = 16 + rng() * 28;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.58)' : 'rgba(125, 232, 250, 0.42)';
        ctx.lineWidth = i % 3 === 0 ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.moveTo(nx - w * 0.5, ny);
        ctx.quadraticCurveTo(nx, ny - 3.5, nx + w * 0.5, ny);
        ctx.stroke();
      });
    }
  }

  function paintRoof(ctx, S) {
    // Base clara e neutra para receber colorização vibrante via material.color (roofColor)
    ctx.fillStyle = '#e7e2d9';
    ctx.fillRect(0, 0, S, S);

    const rows = 8;
    const cols = 6;
    const rh = S / rows;
    const cw = S / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + offset;
        const y = r * rh;
        const shade = 235 + ((r * 7 + c * 11) % 18);
        const grad = ctx.createLinearGradient(x, y, x, y + rh);
        grad.addColorStop(0, 'rgb(' + shade + ',' + (shade - 2) + ',' + (shade - 6) + ')');
        grad.addColorStop(0.75, 'rgb(' + (shade - 22) + ',' + (shade - 24) + ',' + (shade - 28) + ')');
        grad.addColorStop(1, 'rgb(' + (shade - 54) + ',' + (shade - 56) + ',' + (shade - 58) + ')');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cw, y);
        ctx.lineTo(x + cw, y + rh * 0.65);
        ctx.quadraticCurveTo(x + cw * 0.5, y + rh * 1.12, x, y + rh * 0.65);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(43, 29, 20, 0.28)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Brilho especular suave no topo da telha
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x + 4, y + 3, cw - 8, 3);
      }
    }
  }

  function paintWall(ctx, S) {
    const rng = createRng(909);
    // Reboco artesanal claro para preservar a cor do prédio (wallColor)
    ctx.fillStyle = '#f5f2ea';
    ctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 90; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 12 + rng() * 28;
      const light = rng() > 0.5;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.35)' : 'rgba(180, 165, 142, 0.14)';
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Finas faixas sutis de textura artesanal
    for (let i = 0; i < 140; i++) {
      const x = rng() * S;
      const y = rng() * S;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(140, 125, 102, 0.12)' : 'rgba(255, 255, 255, 0.32)';
      ctx.fillRect(x, y, 2 + rng() * 4, 1.4);
    }
  }

  function paintStone(ctx, S) {
    const rng = createRng(1010);
    ctx.fillStyle = '#737c8c';
    ctx.fillRect(0, 0, S, S);

    const rows = 6;
    const rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -28;
      while (x < S) {
        const w = 44 + Math.floor(rng() * 34);
        const lum = 108 + Math.floor(rng() * 36);
        const warm = Math.floor((rng() - 0.4) * 12);
        ctx.fillStyle = 'rgb(' + (lum + warm) + ',' + (lum + 2) + ',' + (lum + 10) + ')';
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(x + 2, r * rh + 2, w - 4, rh - 4, 6)
          : ctx.rect(x + 2, r * rh + 2, w - 4, rh - 4);
        ctx.fill();

        // Highlight superior e sombra inferior
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(x + 5, r * rh + 4, Math.max(4, w - 10), 4);
        ctx.fillStyle = 'rgba(28, 34, 46, 0.26)';
        ctx.fillRect(x + 5, (r + 1) * rh - 7, Math.max(4, w - 10), 4);

        ctx.strokeStyle = 'rgba(34, 40, 52, 0.55)';
        ctx.lineWidth = 2.2;
        ctx.strokeRect(x + 2, r * rh + 2, w - 4, rh - 4);
        x += w;
      }
    }

    // Pintinhas de musgo e textura mineral
    for (let i = 0; i < 70; i++) {
      const x = rng() * S;
      const y = rng() * S;
      ctx.fillStyle = i % 6 === 0 ? 'rgba(116, 178, 92, 0.34)' : 'rgba(230, 236, 245, 0.18)';
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + rng() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintBark(ctx, S) {
    const rng = createRng(1111);
    ctx.fillStyle = '#6f4828';
    ctx.fillRect(0, 0, S, S);

    // Sulcos verticais de casca de árvore
    for (let i = 0; i < 64; i++) {
      const x = rng() * S;
      const w = 3 + rng() * 9;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(52, 30, 14, 0.45)' : 'rgba(145, 98, 56, 0.35)';
      ctx.fillRect(x, 0, w, S);
    }

    ctx.lineCap = 'round';
    for (let i = 0; i < 55; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const h = 28 + rng() * 54;
      ctx.strokeStyle = rng() > 0.5 ? 'rgba(42, 22, 10, 0.52)' : 'rgba(182, 128, 76, 0.32)';
      ctx.lineWidth = 1.6 + rng() * 2.2;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.quadraticCurveTo(nx + (rng() - 0.5) * 6, ny + h * 0.5, nx, ny + h);
        ctx.stroke();
      });
    }

    // Manchinhas suaves de musgo no tronco
    for (let i = 0; i < 14; i++) {
      const x = rng() * S;
      const y = rng() * S;
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.fillStyle = 'rgba(98, 168, 76, 0.28)';
        ctx.beginPath();
        ctx.ellipse(nx, ny, 7 + rng() * 8, 4 + rng() * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function paintLeaf(ctx, S) {
    const rng = createRng(1212);
    ctx.fillStyle = '#2d8a3e';
    ctx.fillRect(0, 0, S, S);

    const greens = ['#1f6e2f', '#2c8a3d', '#3ca349', '#57bd53', '#7ad45e'];
    for (let i = 0; i < 150; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const rx = 10 + rng() * 14;
      const ry = 6 + rng() * 9;
      const rot = rng() * Math.PI * 2;
      const col = greens[Math.floor(rng() * greens.length)];
      drawWrapped(S, x, y, function (nx, ny) {
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(rot);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(18, 62, 28, 0.34)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Nervura central luminosa
        ctx.strokeStyle = 'rgba(218, 255, 178, 0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-rx * 0.6, 0);
        ctx.lineTo(rx * 0.6, 0);
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  function paintCrystal(ctx, S) {
    const rng = createRng(1313);
    const bg = ctx.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#c8f8ff');
    bg.addColorStop(0.5, '#7ee7f7');
    bg.addColorStop(1, '#b6f2ff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    // Facetas prismáticas diagonais
    for (let i = 0; i < 34; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const w = 22 + rng() * 44;
      const h = 36 + rng() * 68;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.36)' : 'rgba(14, 116, 144, 0.2)';
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.5);
      ctx.lineTo(x + w * 0.5, y);
      ctx.lineTo(x, y + h * 0.5);
      ctx.lineTo(x - w * 0.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Estrelinhas de brilho interno
    for (let i = 0; i < 24; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 3 + rng() * 6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
    }
  }

  function buildPaintedTexture(painterFn) {
    const canvas = makeCanvas(TEX_SIZE, TEX_SIZE);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) painterFn(ctx, TEX_SIZE);
    return finalizeTileTexture(canvas, true);
  }

  function getTextures() {
    if (sharedTextures) return sharedTextures;
    if (typeof global.THREE === 'undefined') return {};

    sharedTextures = {
      grass: buildPaintedTexture(paintGrass),
      dirt: buildPaintedTexture(paintDirt),
      tallGrass: buildPaintedTexture(paintTallGrass),
      sand: buildPaintedTexture(paintSand),
      caveFloor: buildPaintedTexture(paintCaveFloor),
      greenhouseFloor: buildPaintedTexture(paintGreenhouseFloor),
      wood: buildPaintedTexture(paintWood),
      water: buildPaintedTexture(paintWater),
      roof: buildPaintedTexture(paintRoof),
      wall: buildPaintedTexture(paintWall),
      stone: buildPaintedTexture(paintStone),
      bark: buildPaintedTexture(paintBark),
      leaf: buildPaintedTexture(paintLeaf),
      crystal: buildPaintedTexture(paintCrystal)
    };
    return sharedTextures;
  }

  // =========================================================================
  // SOFT CONTACT SHADOW DISC TEXTURE (para Standees HD-2D)
  // =========================================================================
  function getShadowDiscTexture() {
    if (sharedShadowTexture) return sharedShadowTexture;
    const canvas = makeCanvas(128, 128);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
      g.addColorStop(0, 'rgba(28, 18, 10, 0.46)');
      g.addColorStop(0.55, 'rgba(28, 18, 10, 0.24)');
      g.addColorStop(1, 'rgba(28, 18, 10, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    sharedShadowTexture = finalizeTileTexture(canvas, false);
    return sharedShadowTexture;
  }

  // =========================================================================
  // CREATURE & CHARACTER TEXTURES (COM CACHE + ARTREADY AUTO-REFRESH)
  // =========================================================================
  function redrawCreatureEntry(entry) {
    if (!entry || !entry.ctx || !HM.Sprites || !HM.Sprites.drawCreature) return;
    entry.ctx.clearRect(0, 0, 256, 256);
    HM.Sprites.drawCreature(entry.ctx, entry.speciesId, 128, 134, 212, entry.drawOpts);
    if (entry.texture) {
      entry.texture.needsUpdate = true;
    }
  }

  function ensureArtReadyHook() {
    if (artReadyHooked) return;
    if (HM.Sprites && HM.Sprites.artReady && typeof HM.Sprites.artReady.then === 'function') {
      artReadyHooked = true;
      HM.Sprites.artReady.then(function () {
        creatureTexCache.forEach(function (entry) {
          redrawCreatureEntry(entry);
        });
      });
    }
  }

  function getCreatureTexture(speciesId, opts) {
    ensureArtReadyHook();
    const THREE = global.THREE;
    if (!THREE) return null;
    const o = opts || {};
    const facing = o.facing || 'right';
    const golden = Boolean(o.golden);
    const silhouette = Boolean(o.silhouette);
    const status = o.status || '';
    const key = speciesId + '|' + facing + '|' + (golden ? 'g' : '') + '|' + (silhouette ? 's' : '') + '|' + status;

    if (creatureTexCache.has(key)) {
      return creatureTexCache.get(key).texture;
    }

    const canvas = makeCanvas(256, 256);
    const ctx = canvas ? canvas.getContext('2d') : null;
    const drawOpts = Object.assign({ facing: 'right', time: 0, shadow: false }, o, { shadow: false });

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.userData = tex.userData || {};
    tex.userData._hd2dShared = true;

    const entry = {
      speciesId: speciesId,
      drawOpts: drawOpts,
      canvas: canvas,
      ctx: ctx,
      texture: tex
    };
    redrawCreatureEntry(entry);
    creatureTexCache.set(key, entry);
    return tex;
  }

  function getCharacterTexture(style, dir, walkFrame) {
    const THREE = global.THREE;
    if (!THREE) return null;
    const st = style || 'player';
    const d = dir || 'down';
    const rawWf = typeof walkFrame === 'number' && isFinite(walkFrame) ? walkFrame : 0;
    // Quantiza a meio-passo módulo 4 para suportar frames inteiros e contínuos sem vazar memória
    const qStep = (((Math.round(rawWf * 2) % 8) + 8) % 8) / 2;
    const key = st + '|' + d + '|' + qStep;

    if (characterTexCache.has(key)) {
      return characterTexCache.get(key);
    }

    const canvas = makeCanvas(128, 128);
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (ctx && HM.Sprites && HM.Sprites.drawCharacter) {
      ctx.clearRect(0, 0, 128, 128);
      HM.Sprites.drawCharacter(ctx, 64, 72, 92, st, d, qStep);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.userData = tex.userData || {};
    tex.userData._hd2dShared = true;
    tex.needsUpdate = true;

    characterTexCache.set(key, tex);
    return tex;
  }

  // =========================================================================
  // HD-2D STANDEE BUILDER (pivô na base y = 0 + sombra real recortada)
  // =========================================================================
  function createStandee(texture, width, height) {
    const THREE = global.THREE;
    const w = width || 1.2;
    const h = height || 1.2;

    const group = new THREE.Group();

    const geo = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshStandardMaterial({
      map: texture || null,
      transparent: true,
      alphaTest: 0.14,
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = h * 0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    // Depth material com alphaTest para a sombra direcional ter a silhueta exata do sprite!
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: texture || null,
      alphaTest: 0.14
    });
    mesh.customDepthMaterial = depthMat;
    group.add(mesh);

    // Disco oval de sombra de contato suave no chão (y = 0.025)
    const shadowGeo = new THREE.CircleGeometry(w * 0.42, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: getShadowDiscTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.95
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI * 0.5;
    shadowMesh.scale.set(1, 0.72, 1);
    shadowMesh.position.y = 0.025;
    shadowMesh.renderOrder = 1;
    group.add(shadowMesh);

    return {
      group: group,
      mesh: mesh,
      material: material,
      shadowMesh: shadowMesh,
      setTexture: function (tex) {
        if (material.map === tex) return;
        material.map = tex || null;
        material.needsUpdate = true;
        if (mesh.customDepthMaterial) {
          mesh.customDepthMaterial.map = tex || null;
          mesh.customDepthMaterial.needsUpdate = true;
        }
      },
      setFlipX: function (flipBool) {
        const mag = Math.abs(mesh.scale.x) || 1;
        mesh.scale.x = flipBool ? -mag : mag;
      },
      setFlash: function (amount) {
        const t = Math.max(0, Math.min(1, Number(amount) || 0));
        if (t <= 0.001) {
          material.emissive.setRGB(0, 0, 0);
          material.emissiveIntensity = 0;
        } else {
          material.emissive.setRGB(1, 1, 1);
          material.emissiveIntensity = t * 1.35;
        }
      }
    };
  }

  // =========================================================================
  // SKY DOME GRADIENTE SUAVE (3 CORES COM INTERPOLAÇÃO EM TEMPO REAL)
  // =========================================================================
  function createSkyDome(topHex, midHex, bottomHex) {
    const THREE = global.THREE;
    const uniforms = {
      uTopColor: { value: new THREE.Color(topHex || '#38bdf8') },
      uMidColor: { value: new THREE.Color(midHex || '#93c5fd') },
      uBottomColor: { value: new THREE.Color(bottomHex || '#fef3c7') }
    };

    const vertexShader = [
      'varying vec3 vWorldDir;',
      'void main() {',
      '  vWorldDir = normalize(position);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n');

    const fragmentShader = [
      'uniform vec3 uTopColor;',
      'uniform vec3 uMidColor;',
      'uniform vec3 uBottomColor;',
      'varying vec3 vWorldDir;',
      'void main() {',
      '  float h = clamp(vWorldDir.y, -0.25, 1.0);',
      '  vec3 col;',
      '  if (h >= 0.22) {',
      '    float t = smoothstep(0.22, 0.92, h);',
      '    col = mix(uMidColor, uTopColor, t);',
      '  } else {',
      '    float t = smoothstep(-0.18, 0.22, h);',
      '    col = mix(uBottomColor, uMidColor, t);',
      '  }',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    const geo = new THREE.SphereGeometry(125, 32, 20);
    const mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });

    const dome = new THREE.Mesh(geo, mat);
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    dome.userData.uniforms = uniforms;
    dome.userData.setColors = function (top, mid, bottom) {
      if (top !== undefined) uniforms.uTopColor.value.set(top);
      if (mid !== undefined) uniforms.uMidColor.value.set(mid);
      if (bottom !== undefined) uniforms.uBottomColor.value.set(bottom);
    };
    return dome;
  }

  // =========================================================================
  // PRESETS CINEMATOGRÁFICOS POR BIOMA
  // =========================================================================
  const BIOME_PRESETS = {
    jardim: {
      skyTop: '#38bdf8',
      skyMid: '#99d5ff',
      skyBottom: '#fef3c7',
      fogColor: '#d9f2e6',
      fogNear: 26,
      fogFar: 68,
      sunColor: '#fff5d6',
      sunIntensity: 1.32,
      hemiSky: '#c7ecff',
      hemiGround: '#5f8a4b',
      hemiIntensity: 0.74,
      sunPos: [18, 32, 16]
    },
    rota2: {
      skyTop: '#2e7d6b',
      skyMid: '#74b99c',
      skyBottom: '#d8f3dc',
      fogColor: '#bfe3cf',
      fogNear: 22,
      fogFar: 58,
      sunColor: '#eef8c8',
      sunIntensity: 1.08,
      hemiSky: '#a7e8cc',
      hemiGround: '#3d5c3b',
      hemiIntensity: 0.72,
      sunPos: [14, 28, 12]
    },
    arena: {
      skyTop: '#60a5fa',
      skyMid: '#fde68a',
      skyBottom: '#fff7ed',
      fogColor: '#f7ecc9',
      fogNear: 26,
      fogFar: 66,
      sunColor: '#ffe79e',
      sunIntensity: 1.38,
      hemiSky: '#fff1c1',
      hemiGround: '#7a6c45',
      hemiIntensity: 0.78,
      sunPos: [16, 30, 18]
    },
    tropical: {
      skyTop: '#0284c7',
      skyMid: '#38bdf8',
      skyBottom: '#fde68a',
      fogColor: '#d7f3f2',
      fogNear: 25,
      fogFar: 66,
      sunColor: '#ffe0a3',
      sunIntensity: 1.42,
      hemiSky: '#bae6fd',
      hemiGround: '#b5844c',
      hemiIntensity: 0.78,
      sunPos: [22, 28, 14]
    },
    caverna: {
      skyTop: '#0f172a',
      skyMid: '#1e2942',
      skyBottom: '#2b3d59',
      fogColor: '#1b263b',
      fogNear: 16,
      fogFar: 46,
      sunColor: '#8be9fd',
      sunIntensity: 0.78,
      hemiSky: '#6ee7d8',
      hemiGround: '#3b2d47',
      hemiIntensity: 0.68,
      sunPos: [-10, 22, 12]
    }
  };

  // =========================================================================
  // SAFE CLEANUP HELPER (preserva texturas compartilhadas em cache)
  // =========================================================================
  function disposeMaterial(mat) {
    if (!mat) return;
    if (Array.isArray(mat)) {
      mat.forEach(disposeMaterial);
      return;
    }
    if (mat.map && !(mat.map.userData && mat.map.userData._hd2dShared)) {
      mat.map.dispose();
    }
    if (typeof mat.dispose === 'function') {
      mat.dispose();
    }
  }

  function disposeObject(root) {
    if (!root || typeof root.traverse !== 'function') return;
    root.traverse(function (obj) {
      if (obj.geometry && typeof obj.geometry.dispose === 'function') {
        obj.geometry.dispose();
      }
      if (obj.material) {
        disposeMaterial(obj.material);
      }
      if (obj.customDepthMaterial) {
        disposeMaterial(obj.customDepthMaterial);
      }
    });
  }

  // =========================================================================
  // EXPORT TO window.HortaMon.HD2D
  // =========================================================================
  HM.HD2D = {
    isAvailable: isAvailable,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    onEnabledChange: onEnabledChange,
    createRenderer: createRenderer,
    getTextures: getTextures,
    getCreatureTexture: getCreatureTexture,
    getCharacterTexture: getCharacterTexture,
    createStandee: createStandee,
    createSkyDome: createSkyDome,
    disposeObject: disposeObject,
    BIOME_PRESETS: BIOME_PRESETS
  };
})(window);
