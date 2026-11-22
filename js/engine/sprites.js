(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  const INK = '#2b1d14';
  const dataUrlCache = new Map();
  const illustrations = new Map();
  const artReady = Promise.all(Object.entries(HM.creatureArt || {}).map(([id, url]) => {
    const image = new Image();
    return new Promise((resolve) => {
      image.onload = () => {
        illustrations.set(id, { image, bounds: visibleBounds(image) });
        resolve();
      };
      image.onerror = () => resolve();
      image.src = url;
    });
  }));
  let scratchCanvas = null;
  let scratchCtx = null;

  function visibleBounds(image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { x: 0, y: 0, width, height };
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] < 32) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    return left <= right
      ? { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
      : { x: 0, y: 0, width, height };
  }

  // =========================================================================
  // CORE CARTOON DRAWING HELPERS
  // =========================================================================

  function setInk(ctx, lw) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw !== undefined ? lw : 3.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  function fillStroke(ctx, fill, lw) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (lw !== 0) {
      setInk(ctx, lw);
      ctx.stroke();
    }
  }

  function radGrad(ctx, x0, y0, r0, x1, y1, r1, stops) {
    const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (let i = 0; i < stops.length; i++) {
      g.addColorStop(stops[i][0], stops[i][1]);
    }
    return g;
  }

  function linGrad(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i++) {
      g.addColorStop(stops[i][0], stops[i][1]);
    }
    return g;
  }

  function drawEllipse(ctx, x, y, rx, ry, rot, fill, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    fillStroke(ctx, fill, lw);
  }

  function drawCircle(ctx, x, y, r, fill, lw) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    fillStroke(ctx, fill, lw);
  }

  function drawHighlight(ctx, x, y, rx, ry, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha !== undefined ? alpha : 0.6) + ')';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCheek(ctx, x, y, rx, ry, color) {
    ctx.save();
    ctx.fillStyle = color || 'rgba(255, 118, 145, 0.52)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx || 4.8, ry || 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEye(ctx, x, y, r, opts) {
    const o = opts || {};
    ctx.save();
    ctx.translate(x, y);

    if (o.sleeping) {
      setInk(ctx, 2.6);
      ctx.beginPath();
      ctx.arc(0, 1, r * 0.85, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (o.happy) {
      setInk(ctx, 2.8);
      ctx.beginPath();
      ctx.arc(0, 2, r * 0.88, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Optional sclera ring for older/mystic eyes
    if (o.sclera) {
      ctx.fillStyle = o.sclera;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.22, r * 1.18, 0, 0, Math.PI * 2);
      ctx.fill();
      setInk(ctx, 2.1);
      ctx.stroke();
    }

    // Main dark iris/pupil
    ctx.fillStyle = o.iris || INK;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.92, r * (o.tall ? 1.12 : 1.0), 0, 0, Math.PI * 2);
    ctx.fill();

    // Optional inner glowing rim (for mystic/fiery eyes)
    if (o.innerGlow) {
      ctx.fillStyle = o.innerGlow;
      ctx.beginPath();
      ctx.arc(0, r * 0.22, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Big upper-left white catchlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.3, r * 0.36, 0, Math.PI * 2);
    ctx.fill();

    // Small lower-right sparkle
    ctx.beginPath();
    ctx.arc(r * 0.28, r * 0.28, r * 0.17, 0, Math.PI * 2);
    ctx.fill();

    // Optional eyebrow
    if (o.brow !== undefined && o.brow !== null) {
      ctx.strokeStyle = o.browColor || INK;
      ctx.lineWidth = o.browWidth || 2.8;
      ctx.lineCap = 'round';
      ctx.save();
      ctx.translate(0, -r * 1.28);
      ctx.rotate(o.brow);
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, 0);
      ctx.lineTo(r * 1.15, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawMouth(ctx, x, y, w, mood) {
    ctx.save();
    ctx.translate(x, y);
    setInk(ctx, 2.4);

    if (mood === 'open') {
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, w * 1.35, w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cute pink tongue
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.ellipse(0, w * 0.46, w * 0.52, w * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === 'grin') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-w, -0.5);
      ctx.quadraticCurveTo(0, w * 1.15, w, -1.5);
      ctx.quadraticCurveTo(0, w * 0.2, -w, -0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (mood === 'smirk') {
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, 1);
      ctx.quadraticCurveTo(w * 0.1, w * 0.65, w, -2.5);
      ctx.stroke();
    } else if (mood === 'fierce') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-w, 1.5);
      ctx.quadraticCurveTo(0, -w * 0.55, w, 1.5);
      ctx.quadraticCurveTo(0, w * 0.85, -w, 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (mood === 'o') {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.ellipse(0, 1, w * 0.48, w * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (mood === 'serene') {
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, 0);
      ctx.quadraticCurveTo(0, w * 0.55, w * 0.8, 0);
      ctx.stroke();
    } else {
      // 'smile' default
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, w * 0.85, w, -0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLeaf(ctx, x, y, len, wid, angle, c1, c2, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    const grad = linGrad(ctx, 0, 0, len, 0, [
      [0, c1 || '#4ade80'],
      [1, c2 || '#15803d']
    ]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.48, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.48, wid, 0, 0);
    ctx.closePath();
    fillStroke(ctx, grad, lw !== undefined ? lw : 2.6);

    // Leaf center vein
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(len * 0.14, 0);
    ctx.lineTo(len * 0.78, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlame(ctx, x, y, sc, angle, sway) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.scale(sc || 1, sc || 1);
    const w = sway || 0;

    // Outer fiery red-orange
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-9, -4, -10, -14, w * 4, -22);
    ctx.bezierCurveTo(10, -14, 9, -4, 0, 0);
    ctx.closePath();
    fillStroke(ctx, linGrad(ctx, 0, 0, 0, -22, [[0, '#f97316'], [0.65, '#ef4444'], [1, '#facc15']]), 2.4);

    // Bright yellow core
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.bezierCurveTo(-4.5, -5, -4, -10, w * 2, -14);
    ctx.bezierCurveTo(4, -10, 4.5, -5, 0, -2);
    ctx.closePath();
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.restore();
  }

  function drawStar4(ctx, x, y, r, fill, stroke) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : r * 0.34;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill || '#fef08a';
    ctx.fill();
    if (stroke) {
      setInk(ctx, 1.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFlower(ctx, x, y, r, petalColor, centerColor, petals) {
    const count = petals || 5;
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.rotate(a);
      drawEllipse(ctx, 0, -r * 0.72, r * 0.48, r * 0.65, 0, petalColor || '#f472b6', 2.0);
      ctx.restore();
    }
    drawCircle(ctx, 0, 0, r * 0.42, centerColor || '#facc15', 2.0);
    ctx.restore();
  }

  function drawBolt(ctx, x, y, sc, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.scale(sc || 1, sc || 1);
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(1, 0);
    ctx.lineTo(-3, 10);
    ctx.lineTo(6, -2);
    ctx.lineTo(0, -2);
    ctx.closePath();
    fillStroke(ctx, color || '#fde047', 1.9);
    ctx.restore();
  }

  function drawFallbackCreature(ctx) {
    drawCircle(ctx, 0, 0, 24, '#e5e7eb', 3.2);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('?', 0, 1);
  }

  // =========================================================================
  // STATUS EFFECTS OVERLAY (UNFLIPPED SO 'Zzz' READS PROPERLY!)
  // =========================================================================

  function drawStatusOverlay(ctx, status, size, t) {
    if (!status) return;
    ctx.save();
    const s = size / 100;
    ctx.scale(s, s);

    if (status === 'burn') {
      for (let i = 0; i < 3; i++) {
        const phase = (t * 2.4 + i * 2.1) % (Math.PI * 2);
        const rise = ((t * 1.1 + i * 0.33) % 1);
        const fx = -22 + i * 22 + Math.sin(phase) * 5;
        const fy = 22 - rise * 48;
        ctx.globalAlpha = Math.sin(rise * Math.PI);
        drawFlame(ctx, fx, fy, 0.55 + (i % 2) * 0.15, Math.sin(phase) * 0.2, Math.sin(phase));
      }
    } else if (status === 'sleep') {
      ctx.font = 'bold 14px "Fredoka", "Nunito", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const letters = ['Z', 'z', 'z'];
      for (let i = 0; i < 3; i++) {
        const cycle = (t * 0.55 + i * 0.33) % 1;
        const zx = 12 + cycle * 18 + Math.sin(cycle * 6) * 3;
        const zy = -16 - cycle * 26;
        const sc = 0.7 + cycle * 0.55;
        ctx.save();
        ctx.globalAlpha = Math.sin(cycle * Math.PI);
        ctx.translate(zx, zy);
        ctx.scale(sc, sc);
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = INK;
        ctx.strokeText(letters[i], 0, 0);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillText(letters[i], 0, 0);
        ctx.restore();
      }
    } else if (status === 'paralyze') {
      const flick = Math.sin(t * 18);
      if (flick > -0.6) {
        drawBolt(ctx, -28, -14 + Math.sin(t * 9) * 5, 0.85, -0.4, '#fde047');
      }
      if (flick < 0.7) {
        drawBolt(ctx, 29, 2 + Math.cos(t * 11) * 5, 0.8, 0.35, '#fef08a');
      }
      drawBolt(ctx, 4, -34 + Math.sin(t * 13) * 3, 0.65, 0.15, '#facc15');
    }

    ctx.restore();
  }

  // =========================================================================
  // VERSÃO DOURADA (rara, tipo "shiny")
  // =========================================================================

  let goldScratch = null;
  let goldScratchCtx = null;
  let canvasFilterSupport = null;

  function supportsCanvasFilter(ctx) {
    if (canvasFilterSupport === null) {
      canvasFilterSupport = typeof ctx.filter === 'string';
    }
    return canvasFilterSupport;
  }

  // Desenha a imagem com tom dourado (mantendo o contorno escuro)
  function drawGoldenImage(ctx, img, x, y) {
    if (typeof document === 'undefined') {
      ctx.drawImage(img, x, y);
      return;
    }
    if (!goldScratch) {
      goldScratch = document.createElement('canvas');
      goldScratchCtx = goldScratch.getContext('2d');
    }
    if (goldScratch.width !== img.width || goldScratch.height !== img.height) {
      goldScratch.width = img.width;
      goldScratch.height = img.height;
    } else {
      goldScratchCtx.clearRect(0, 0, img.width, img.height);
    }
    const g = goldScratchCtx;
    g.save();
    if (supportsCanvasFilter(g)) {
      g.filter = 'sepia(1) saturate(2.6) hue-rotate(-6deg) brightness(1.12)';
    }
    g.drawImage(img, 0, 0);
    g.restore();
    // Véu dourado só sobre a criatura (source-atop não pinta o fundo)
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const grad = g.createLinearGradient(0, 0, img.width, img.height);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
    grad.addColorStop(0.5, 'rgba(250, 204, 21, 0.26)');
    grad.addColorStop(1, 'rgba(202, 138, 4, 0.32)');
    g.fillStyle = grad;
    g.fillRect(0, 0, img.width, img.height);
    g.restore();
    ctx.drawImage(goldScratch, x, y);
  }

  function drawGoldenSparkles(ctx, size, t) {
    const s = size / 100;
    const spots = [[-34, -30, 0], [36, -18, 1.7], [-30, 22, 3.1], [30, 28, 4.4]];
    ctx.save();
    ctx.scale(s, s);
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i];
      const pulse = t > 0 ? 0.5 + 0.5 * Math.sin(t * 3.2 + p[2]) : (i % 2 === 0 ? 1 : 0.6);
      ctx.globalAlpha = 0.35 + pulse * 0.65;
      drawStar4(ctx, p[0], p[1], 3.5 + pulse * 3.5, '#fde047', true);
    }
    ctx.restore();
  }

  function getScratch(w, h) {
    if (!scratchCanvas && typeof document !== 'undefined') {
      scratchCanvas = document.createElement('canvas');
      scratchCtx = scratchCanvas.getContext('2d');
    }
    if (!scratchCanvas || !scratchCtx) return null;
    if (scratchCanvas.width !== w || scratchCanvas.height !== h) {
      scratchCanvas.width = w;
      scratchCanvas.height = h;
    } else {
      scratchCtx.clearRect(0, 0, w, h);
    }
    return { canvas: scratchCanvas, ctx: scratchCtx };
  }

  function drawCreatureInternal(ctx, speciesId, sleeping) {
    const art = illustrations.get(speciesId);
    if (art) {
      const { image, bounds } = art;
      const scale = 92 / Math.max(bounds.width, bounds.height);
      const width = bounds.width * scale;
      const height = bounds.height * scale * (sleeping ? 0.90 : 1);
      ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height,
        -width / 2, 39 - height, width, height);
      return;
    }
    ctx.save();
    drawFallbackCreature(ctx);
    ctx.restore();
  }

  // =========================================================================
  // PUBLIC: HM.Sprites.drawCreature
  // =========================================================================

  function drawCreature(ctx, speciesId, cx, cy, size, opts) {
    if (!ctx || !size || size <= 0) return;
    const o = opts || {};
    const facing = o.facing === 'left' ? 'left' : 'right';
    const timeMs = typeof o.time === 'number' ? o.time : 0;
    const t = timeMs * 0.001;
    const hitFlash = Math.max(0, Math.min(1, o.hitFlash || 0));
    const alpha = o.alpha !== undefined ? Math.max(0, Math.min(1, o.alpha)) : 1;
    const scaleX = o.scaleX !== undefined ? o.scaleX : 1;
    const scaleY = o.scaleY !== undefined ? o.scaleY : 1;
    const status = o.status || null;
    const silhouette = Boolean(o.silhouette);
    const golden = Boolean(o.golden) && !silhouette;
    const showShadow = o.shadow !== false;
    const sleeping = status === 'sleep';

    if (alpha <= 0.001) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha *= alpha;

    // 1. Ground oval shadow (drawn before creature & unaffected by hitFlash)
    if (showShadow) {
      ctx.save();
      ctx.fillStyle = silhouette ? 'rgba(43, 29, 20, 0.14)' : 'rgba(43, 29, 20, 0.22)';
      ctx.beginPath();
      ctx.ellipse(
        0,
        size * 0.37 * Math.abs(scaleY),
        size * 0.30 * Math.abs(scaleX),
        size * 0.085 * Math.abs(scaleY),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Subtle idle breathing squash-and-stretch (only when time > 0)
    const idleBreath = timeMs > 0 ? Math.sin(t * 2.5) * 0.022 : 0;
    const finalScaleX = (facing === 'left' ? -1 : 1) * scaleX * (1 + idleBreath);
    const finalScaleY = scaleY * (1 - idleBreath);
    const unitScale = size / 100;

    // 2. Render creature body (use offscreen scratch for exact silhouette or hitFlash)
    const needsScratch = silhouette || hitFlash > 0.01 || golden;
    let usedScratch = false;

    if (needsScratch) {
      const maxS = Math.max(Math.abs(scaleX), Math.abs(scaleY), 1);
      const box = Math.ceil(size * 1.48 * maxS);
      const scratch = getScratch(box, box);
      if (scratch) {
        usedScratch = true;
        const sctx = scratch.ctx;
        sctx.save();
        sctx.globalCompositeOperation = 'source-over';
        sctx.translate(box / 2, box / 2);
        sctx.scale(unitScale * finalScaleX, unitScale * finalScaleY);
        drawCreatureInternal(sctx, speciesId, sleeping);
        sctx.restore();

        if (silhouette) {
          sctx.save();
          sctx.globalCompositeOperation = 'source-in';
          sctx.fillStyle = '#3d312a';
          sctx.fillRect(0, 0, box, box);
          sctx.restore();
          ctx.drawImage(scratch.canvas, -box / 2, -box / 2);
        } else {
          // Normal creature first (versão Dourada recebe um banho de ouro)
          if (golden) {
            drawGoldenImage(ctx, scratch.canvas, -box / 2, -box / 2);
          } else {
            ctx.drawImage(scratch.canvas, -box / 2, -box / 2);
          }
          // Then crisp shape-matched white hitFlash overlay
          sctx.save();
          sctx.globalCompositeOperation = 'source-in';
          sctx.fillStyle = '#ffffff';
          sctx.fillRect(0, 0, box, box);
          sctx.restore();
          ctx.save();
          ctx.globalAlpha *= hitFlash * 0.88;
          ctx.drawImage(scratch.canvas, -box / 2, -box / 2);
          ctx.restore();
        }
      }
    }

    if (!usedScratch) {
      ctx.save();
      ctx.scale(unitScale * finalScaleX, unitScale * finalScaleY);
      drawCreatureInternal(ctx, speciesId, sleeping);
      ctx.restore();
    }

    // 2b. Brilhos da versão Dourada
    if (golden) {
      drawGoldenSparkles(ctx, size, t);
    }

    // 3. Status effect overlay (unflipped so 'Zzz' stays legible)
    if (!silhouette && status) {
      drawStatusOverlay(ctx, status, size * Math.max(Math.abs(scaleX), Math.abs(scaleY)), t);
    }

    ctx.restore();
  }

  // =========================================================================
  // PUBLIC: HM.Sprites.renderCreatureToDataURL
  // =========================================================================

  function renderCreatureToDataURL(speciesId, size, silhouette, golden) {
    const px = size || 128;
    const sil = Boolean(silhouette);
    const gold = Boolean(golden) && !sil;
    const key = speciesId + '|' + px + '|' + (sil ? '1' : '0') + (gold ? '|g' : '');
    if (dataUrlCache.has(key)) return dataUrlCache.get(key);
    if (typeof document === 'undefined') return '';

    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    drawCreature(ctx, speciesId, px * 0.5, px * 0.56, px, {
      facing: 'right',
      time: 0,
      silhouette: sil,
      golden: gold,
      shadow: false
    });

    const url = canvas.toDataURL('image/png');
    dataUrlCache.set(key, url);
    return url;
  }

  // =========================================================================
  // PUBLIC: HM.Sprites.drawCharacter (OVERWORLD CHARACTERS & PROPS — HD-2D READY)
  // =========================================================================

  function rrectPath(ctx, x, y, w, h, r) {
    const rad = Math.min(r || 0, Math.abs(w) * 0.5, Math.abs(h) * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function drawStar5(ctx, x, y, outerR, innerR, fill, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outerR : innerR;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    fillStroke(ctx, fill || '#facc15', lw !== undefined ? lw : 1.5);
    ctx.restore();
  }

  function drawHeartEmblem(ctx, x, y, s, fill, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.15, s * 0.15, -s * 1.15, -s * 0.85, 0, -s * 0.3);
    ctx.bezierCurveTo(s * 1.15, -s * 0.85, s * 1.15, s * 0.15, 0, s * 0.85);
    ctx.closePath();
    fillStroke(ctx, fill || '#22c55e', lw !== undefined ? lw : 1.4);
    ctx.restore();
  }

  function drawCrystalBrooch(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.translate(x, y);
    // Soft bioluminescent cyan halo
    const glow = radGrad(ctx, 0, 0, 1, 0, 0, ry * 2.1, [
      [0, 'rgba(34, 211, 238, 0.72)'],
      [0.6, 'rgba(56, 189, 248, 0.25)'],
      [1, 'rgba(56, 189, 248, 0)']
    ]);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, ry * 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Brass setting ring
    ctx.beginPath();
    ctx.moveTo(0, -ry - 1.4);
    ctx.lineTo(rx + 1.4, 0);
    ctx.lineTo(0, ry + 1.4);
    ctx.lineTo(-rx - 1.4, 0);
    ctx.closePath();
    fillStroke(ctx, '#f59e0b', 1.7);

    // Faceted cyan crystal
    ctx.beginPath();
    ctx.moveTo(0, -ry);
    ctx.lineTo(rx, 0);
    ctx.lineTo(0, ry);
    ctx.lineTo(-rx, 0);
    ctx.closePath();
    fillStroke(ctx, linGrad(ctx, -rx, -ry, rx, ry, [
      [0, '#cffafe'],
      [0.45, '#22d3ee'],
      [1, '#0284c7']
    ]), 1.4);

    // Inner bright facet glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.beginPath();
    ctx.moveTo(0, -ry * 0.72);
    ctx.lineTo(rx * 0.35, -ry * 0.1);
    ctx.lineTo(-rx * 0.28, -ry * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawChibiEye(ctx, x, y, r, irisColor, browAngle, isSide) {
    ctx.save();
    ctx.translate(x, y);
    const rw = isSide ? r * 0.88 : r * 1.02;
    const rh = r * 1.24;

    // Soft white sclera
    ctx.fillStyle = '#fffdf8';
    ctx.beginPath();
    ctx.ellipse(0, 0, rw * 1.06, rh * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rich dark-brown/colored iris
    ctx.fillStyle = irisColor || '#3b2416';
    ctx.beginPath();
    ctx.ellipse(isSide ? 0.5 : 0, 0.2, rw * 0.84, rh * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Warm lower iris bounce light
    ctx.fillStyle = 'rgba(255, 232, 198, 0.32)';
    ctx.beginPath();
    ctx.ellipse(isSide ? 0.5 : 0, rh * 0.34, rw * 0.48, rh * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupil core
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(isSide ? 0.6 : 0, 0.1, rw * 0.48, rh * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid lash arc for crisp HD-2D pop
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0.2, rw * 1.04, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    // Crisp dual white sparkles!
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-rw * 0.28, -rh * 0.32, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rw * 0.28, rh * 0.28, r * 0.17, 0, Math.PI * 2);
    ctx.fill();

    // Expressive eyebrow
    if (browAngle !== null && browAngle !== undefined) {
      ctx.save();
      ctx.translate(0, -rh * 1.25);
      ctx.rotate(browAngle);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(-rw * 0.9, 0);
      ctx.lineTo(rw * 0.9, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSignProp(ctx) {
    // Lush grass tuft & mini blossom around post base
    drawLeaf(ctx, -6, 33, 12, 4.4, -2.55, '#86efac', '#15803d', 2.0);
    drawLeaf(ctx, 5, 33, 12, 4.4, -0.55, '#86efac', '#16a34a', 2.0);
    drawLeaf(ctx, 0, 34, 10, 3.6, -1.57, '#4ade80', '#166534', 1.8);
    drawFlower(ctx, -12, 32, 3.6, '#fde047', '#ea580c', 5);

    // Carved wooden post with side shading
    rrectPath(ctx, -5.5, 4, 11, 30, 3);
    fillStroke(ctx, linGrad(ctx, -5.5, 4, 5.5, 34, [
      [0, '#b4783c'],
      [0.5, '#925723'],
      [1, '#633713']
    ]), 2.7);

    // Beveled wooden sign board with subtle top-cap plank
    ctx.beginPath();
    ctx.moveTo(-27, -21);
    ctx.lineTo(27, -21);
    ctx.quadraticCurveTo(30, -21, 30, -17);
    ctx.lineTo(30, 5);
    ctx.quadraticCurveTo(30, 9, 26, 9);
    ctx.lineTo(-26, 9);
    ctx.quadraticCurveTo(-30, 9, -30, 5);
    ctx.lineTo(-30, -17);
    ctx.quadraticCurveTo(-30, -21, -27, -21);
    ctx.closePath();
    fillStroke(ctx, linGrad(ctx, 0, -21, 0, 9, [
      [0, '#f3ca8c'],
      [0.5, '#d69754'],
      [1, '#9c622b']
    ]), 2.9);

    // Inner inset recessed plank bevel
    rrectPath(ctx, -25, -17, 50, 22, 3);
    ctx.fillStyle = linGrad(ctx, 0, -17, 0, 5, [
      [0, '#fae0b2'],
      [1, '#dfb070']
    ]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(107, 62, 27, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Decorative corner brass nails
    drawCircle(ctx, -22, -14, 1.5, '#78350f', 0.9);
    drawCircle(ctx, 22, -14, 1.5, '#78350f', 0.9);
    drawCircle(ctx, -22, 2, 1.5, '#78350f', 0.9);
    drawCircle(ctx, 22, 2, 1.5, '#78350f', 0.9);

    // Mini leaf emblem + crisp carved text dashes
    drawLeaf(ctx, -18, -3, 9, 3.8, -0.75, '#4ade80', '#15803d', 1.6);
    ctx.strokeStyle = '#6b3e1b';
    ctx.lineWidth = 2.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(17, -11);
    ctx.moveTo(-6, -5);
    ctx.lineTo(14, -5);
    ctx.moveTo(-6, 1);
    ctx.lineTo(8, 1);
    ctx.stroke();

    // Charming sprouting leaves curling over top-right corner
    drawLeaf(ctx, 22, -19, 13, 5.2, -0.68, '#86efac', '#15803d', 2.1);
    drawLeaf(ctx, 20, -20, 9, 3.8, -1.65, '#4ade80', '#166534', 1.9);
  }

  function drawBoxTerminalProp(ctx) {
    // Polished Greenhouse Computerized Box Kiosk!
    // Sturdy terracotta plinth base
    rrectPath(ctx, -27, 23, 54, 12, 4);
    fillStroke(ctx, linGrad(ctx, -27, 23, 27, 35, [
      [0, '#e07a5f'],
      [0.55, '#c8553d'],
      [1, '#8c3120']
    ]), 2.8);

    // Main mint-botanical curved kiosk cabinet
    rrectPath(ctx, -26, -19, 52, 45, 7);
    fillStroke(ctx, linGrad(ctx, -26, -19, 26, 26, [
      [0, '#ecfdf5'],
      [0.45, '#86efac'],
      [1, '#16a34a']
    ]), 2.9);

    // Top bevel gloss on cabinet
    drawHighlight(ctx, -12, -15, 9, 2.2, 0, 0.55);

    // Dark bezel frame around screen
    rrectPath(ctx, -21, -13, 42, 26, 4);
    fillStroke(ctx, '#1e3a2f', 2.4);

    // Luminous sky-cyan monitor screen
    rrectPath(ctx, -18.5, -10.5, 37, 21, 3);
    fillStroke(ctx, linGrad(ctx, -18, -10, 18, 10, [
      [0, '#e0f2fe'],
      [0.55, '#7dd3fc'],
      [1, '#0284c7']
    ]), 1.6);

    // Subtle glass scanlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-16, -5); ctx.lineTo(16, -5);
    ctx.moveTo(-16, 1); ctx.lineTo(16, 1);
    ctx.moveTo(-16, 6); ctx.lineTo(16, 6);
    ctx.stroke();

    // Vibrant botanical leaf icon on screen + diagonal screen glint
    drawLeaf(ctx, -7, 4, 16, 6.5, -0.62, '#86efac', '#15803d', 2.0);
    drawHighlight(ctx, -11, -6.5, 4.5, 1.8, -0.35, 0.72);

    // Control deck strip + glowing LED buttons
    rrectPath(ctx, -21, 15.5, 42, 8.5, 3);
    fillStroke(ctx, '#14532d', 2.0);
    drawCircle(ctx, -13, 19.7, 2.6, '#fde047', 1.4);
    drawCircle(ctx, -5, 19.7, 2.6, '#4ade80', 1.4);
    drawCircle(ctx, 3, 19.7, 2.6, '#38bdf8', 1.4);
    rrectPath(ctx, 10, 17.5, 8.5, 4.4, 2);
    fillStroke(ctx, '#fb7185', 1.4);

    // Mini glass terrarium dome with healthy twin-leaf sprout on top!
    rrectPath(ctx, -15, -21, 30, 4.5, 2);
    fillStroke(ctx, '#d97706', 2.0);
    ctx.beginPath();
    ctx.arc(0, -21, 13.5, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, radGrad(ctx, -4, -29, 2, 0, -22, 14, [
      [0, 'rgba(255, 255, 255, 0.9)'],
      [0.5, 'rgba(224, 242, 254, 0.72)'],
      [1, 'rgba(125, 211, 252, 0.55)']
    ]), 2.3);
    drawLeaf(ctx, 0, -22.5, 9.5, 4.0, -0.8, '#86efac', '#15803d', 1.6);
    drawLeaf(ctx, 0, -22.5, 8.5, 3.6, -2.25, '#4ade80', '#166534', 1.6);
    drawHighlight(ctx, -5.5, -28.5, 3.4, 1.6, -0.55, 0.8);
  }

  function drawHumanCharacter(ctx, style, dir, walkFrame) {
    const stride = Math.sin((walkFrame || 0) * Math.PI * 0.5);
    const bounce = Math.abs(stride) * -2.6;
    const isSide = dir === 'left' || dir === 'right';
    const isUp = dir === 'up';

    const themes = {
      player: {
        skin: '#fde0c2', skinShade: '#eeb992', hair: '#5a361f', hairHi: '#8a5837',
        eye: '#3b2416', shirt: '#fffbeb', sleeve: '#fffbeb', boot: '#78350f', bootSole: '#3f1d0b',
        hat: 'straw', backpack: true, scarf: true
      },
      prof: {
        skin: '#f9d6b6', skinShade: '#e2b089', hair: '#cbd5e1', hairHi: '#f8fafc',
        eye: '#334155', shirt: '#ffffff', sleeve: '#f8fafc', boot: '#334155', bootSole: '#0f172a',
        hat: 'prof'
      },
      healer: {
        skin: '#fde2c8', skinShade: '#efbc99', hair: '#f472b6', hairHi: '#fbcfe8',
        eye: '#9d174d', shirt: '#fb7185', sleeve: '#fda4af', boot: '#be185d', bootSole: '#831843',
        hat: 'nurse'
      },
      shop: {
        skin: '#f4cca6', skinShade: '#d9a478', hair: '#6b3e1b', hairHi: '#9a6030',
        eye: '#3b2416', shirt: '#fef3c7', sleeve: '#fef3c7', boot: '#451a03', bootSole: '#271002',
        hat: 'beret'
      },
      trainer: {
        skin: '#f6d0ab', skinShade: '#dda87d', hair: '#3b2414', hairHi: '#6b4328',
        eye: '#2d1c12', shirt: '#fef08a', sleeve: '#fde047', boot: '#9a3412', bootSole: '#431407',
        hat: 'cap'
      },
      guard: {
        skin: '#f5cfa9', skinShade: '#daa57c', hair: '#1e293b', hairHi: '#475569',
        eye: '#1e293b', shirt: '#155e75', sleeve: '#0e4f63', boot: '#0f172a', bootSole: '#020617',
        hat: 'guardCap'
      },
      leader: {
        skin: '#fde1c6', skinShade: '#eebb98', hair: '#9a4318', hairHi: '#d97736',
        eye: '#14532d', shirt: '#16a34a', sleeve: '#22c55e', boot: '#a16207', bootSole: '#5c3605',
        hat: 'flowerCrown', cape: 'emerald', longHair: true
      },
      leader2: {
        skin: '#e8b88d', skinShade: '#c68f61', hair: '#3f2818', hairHi: '#6b452a',
        eye: '#0e7490', shirt: '#78350f', sleeve: '#92400e', boot: '#292524', bootSole: '#0c0a09',
        hat: 'minerHelmet', cape: 'terracotta'
      }
    };
    const th = themes[style] || themes.player;

    ctx.save();
    ctx.translate(0, bounce);
    if (dir === 'left') ctx.scale(-1, 1);

    // -----------------------------------------------------------------------
    // 1. BACK LAYERS (Capes, Long Hair Back, Side Backpack)
    // -----------------------------------------------------------------------
    if (th.cape === 'emerald') {
      ctx.beginPath();
      ctx.moveTo(isSide ? -10 : -15, 2);
      ctx.lineTo(isSide ? -23 : -24, 30);
      ctx.quadraticCurveTo(isSide ? -10 : 0, 36, isSide ? 8 : 24, 30);
      ctx.lineTo(isSide ? 8 : 15, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, 2, 0, 35, [
        [0, '#22c55e'],
        [0.55, '#15803d'],
        [1, '#064e3b']
      ]), 2.7);
      // Ornate gold hem & vertical shimmer
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(isSide ? -21 : -21, 28);
      ctx.quadraticCurveTo(isSide ? -9 : 0, 33, isSide ? 6 : 21, 28);
      ctx.stroke();
    } else if (th.cape === 'terracotta') {
      ctx.beginPath();
      ctx.moveTo(isSide ? -10 : -16, 2);
      ctx.lineTo(isSide ? -24 : -25, 29);
      ctx.quadraticCurveTo(isSide ? -10 : 0, 35, isSide ? 8 : 25, 29);
      ctx.lineTo(isSide ? 9 : 16, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, 2, 0, 34, [
        [0, '#ea580c'],
        [0.55, '#c2410c'],
        [1, '#7c2d12']
      ]), 2.7);
      // Warm amber-gold explorer trim
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(isSide ? -21 : -22, 26.5);
      ctx.quadraticCurveTo(isSide ? -10 : 0, 31.5, isSide ? 6 : 22, 26.5);
      ctx.stroke();
    }

    // Leader Flora's flowing long hair behind shoulders (on down/side)
    if (th.longHair && !isUp) {
      ctx.beginPath();
      if (isSide) {
        ctx.moveTo(-14, -12);
        ctx.bezierCurveTo(-22, -2, -22, 12, -14, 17);
        ctx.quadraticCurveTo(-5, 16, -4, 4);
      } else {
        ctx.moveTo(-17, -12);
        ctx.bezierCurveTo(-23, -1, -22, 12, -15, 16);
        ctx.lineTo(15, 16);
        ctx.bezierCurveTo(22, 12, 23, -1, 17, -12);
      }
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, -12, 0, 17, [[0, th.hair], [1, '#6b290c']]), 2.5);
    }

    // Player adventure backpack peeking behind on side views!
    if (th.backpack && isSide) {
      rrectPath(ctx, -21, 5, 12, 19, 4.5);
      fillStroke(ctx, linGrad(ctx, -21, 5, -9, 24, [[0, '#d97706'], [1, '#92400e']]), 2.5);
      // Top flap + brass buckle + rolled green bedroll
      rrectPath(ctx, -20, 4, 10, 6, 3);
      fillStroke(ctx, '#f59e0b', 2.0);
      drawCircle(ctx, -18, 2.5, 3.6, '#22c55e', 1.8);
    }

    // -----------------------------------------------------------------------
    // 2. LEGS & DETAILED BOOTS
    // -----------------------------------------------------------------------
    const leftLegY = 29 + (isSide ? stride * 2.8 : stride * 3.4);
    const rightLegY = 29 - (isSide ? stride * 2.8 : stride * 3.4);
    const leftLegX = isSide ? -3 + stride * 7 : -7.5;
    const rightLegX = isSide ? 4 - stride * 7 : 7.5;

    function drawBoot(bx, by) {
      // Boot sole
      drawEllipse(ctx, bx + (isSide ? 1 : 0), by + 2.5, 6.2, 3.0, 0, th.bootSole, 2.1);
      // Boot upper
      drawEllipse(ctx, bx + (isSide ? 1.2 : 0), by, 6.0, 4.3, 0, linGrad(ctx, bx - 4, by - 4, bx + 4, by + 4, [
        [0, th.boot],
        [1, th.bootSole]
      ]), 2.4);
      // Toe highlight
      drawHighlight(ctx, bx + (isSide ? 3 : -1.5), by - 1.5, 2.0, 1.1, -0.2, 0.42);
    }
    drawBoot(leftLegX, leftLegY);
    drawBoot(rightLegX, rightLegY);

    // -----------------------------------------------------------------------
    // 3. BACK ARM (SIDE VIEW) OR BOTH ARMS (FRONT/BACK VIEW)
    // -----------------------------------------------------------------------
    function drawArm(ax, ay, rot) {
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(rot);
      // Sleeve
      drawEllipse(ctx, 0, 0, 4.8, 7.6, 0, linGrad(ctx, -4, -6, 4, 6, [[0, th.sleeve], [1, th.shirt]]), 2.4);
      // Cute round hand at sleeve end
      drawCircle(ctx, 0, 7.0, 3.2, th.skin, 2.1);
      ctx.restore();
    }

    if (isSide) {
      drawArm(-4 - stride * 7, 13, -stride * 0.48);
    } else {
      drawArm(-17, 13 + stride * 2.4, 0.24);
      drawArm(17, 13 - stride * 2.4, -0.24);
    }

    // -----------------------------------------------------------------------
    // 4. TORSO & ROLE-SPECIFIC OUTFITS (WITH SHADING & SIGNATURE DETAILS)
    // -----------------------------------------------------------------------
    const torsoW = isSide ? 11.5 : 14.5;
    ctx.beginPath();
    ctx.moveTo(-torsoW + 1, 2);
    ctx.lineTo(torsoW - 1, 2);
    ctx.quadraticCurveTo(torsoW + 3, 15, torsoW + 1, 28);
    ctx.quadraticCurveTo(0, 30.5, -torsoW - 1, 28);
    ctx.quadraticCurveTo(-torsoW - 3, 15, -torsoW + 1, 2);
    ctx.closePath();
    fillStroke(ctx, linGrad(ctx, -torsoW, 2, torsoW, 28, [[0, th.shirt], [1, '#e5e7eb']]), 2.7);

    if (style === 'player') {
      // Garden-blue denim overalls + straps + golden buttons + pocket!
      ctx.beginPath();
      ctx.moveTo(-torsoW, 11);
      ctx.lineTo(torsoW, 11);
      ctx.quadraticCurveTo(torsoW + 1.5, 20, torsoW, 28);
      ctx.quadraticCurveTo(0, 30.5, -torsoW, 28);
      ctx.quadraticCurveTo(-torsoW - 1.5, 20, -torsoW, 11);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -torsoW, 11, torsoW, 29, [[0, '#3b82f6'], [0.55, '#2563eb'], [1, '#1d4ed8']]), 2.4);

      if (!isSide) {
        // Bib & straps
        rrectPath(ctx, -9.5, 4, 4.4, 10, 1.5);
        fillStroke(ctx, '#2563eb', 2.0);
        rrectPath(ctx, 5.1, 4, 4.4, 10, 1.5);
        fillStroke(ctx, '#2563eb', 2.0);
        if (!isUp) {
          drawCircle(ctx, -7.3, 13, 2.0, '#facc15', 1.3);
          drawCircle(ctx, 7.3, 13, 2.0, '#facc15', 1.3);
          // Cute denim front pocket
          rrectPath(ctx, -5, 16, 10, 7, 2.2);
          fillStroke(ctx, '#1d4ed8', 1.7);
        }
      } else {
        // Side overall strap & button
        rrectPath(ctx, -2, 4, 5, 10, 1.5);
        fillStroke(ctx, '#2563eb', 2.0);
        drawCircle(ctx, 1, 13, 1.9, '#facc15', 1.2);
      }

      // Adventurer red neckerchief/scarf at collar!
      ctx.beginPath();
      ctx.moveTo(-torsoW + 1, 2);
      ctx.quadraticCurveTo(0, 8.5, torsoW - 1, 2);
      ctx.lineTo(torsoW - 2, 6.2);
      ctx.quadraticCurveTo(0, 11.5, -torsoW + 2, 6.2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -12, 2, 12, 9, [[0, '#ef4444'], [1, '#b91c1c']]), 2.1);
      if (!isUp) {
        // Little scarf knot & tail
        ctx.beginPath();
        ctx.moveTo(isSide ? 5 : 2, 7.5);
        ctx.lineTo(isSide ? 11 : 7, 13.5);
        ctx.lineTo(isSide ? 4 : 0, 12.5);
        ctx.closePath();
        fillStroke(ctx, '#dc2626', 1.8);
      }

      // Adventure backpack on back when facing UP!
      if (isUp) {
        rrectPath(ctx, -12, 6, 24, 19, 5);
        fillStroke(ctx, linGrad(ctx, -12, 6, 12, 25, [[0, '#d97706'], [1, '#92400e']]), 2.5);
        // Rolled green bedroll on top of pack
        rrectPath(ctx, -10.5, 2.5, 21, 5.5, 2.8);
        fillStroke(ctx, '#22c55e', 2.0);
        // Pack flap & golden buckles
        rrectPath(ctx, -11, 7.5, 22, 7.5, 3);
        fillStroke(ctx, '#f59e0b', 2.0);
        drawCircle(ctx, -5.5, 14.5, 1.8, '#fef08a', 1.2);
        drawCircle(ctx, 5.5, 14.5, 1.8, '#fef08a', 1.2);
      }
    } else if (style === 'prof') {
      // Crisp white lab coat with collar lapels, green tie & pocket leaf/clipboard!
      ctx.beginPath();
      ctx.moveTo(-torsoW - 1, 2);
      ctx.lineTo(torsoW + 1, 2);
      ctx.quadraticCurveTo(torsoW + 3, 16, torsoW + 1.5, 29);
      ctx.lineTo(-torsoW - 1.5, 29);
      ctx.quadraticCurveTo(-torsoW - 3, 16, -torsoW - 1, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -torsoW, 2, torsoW, 29, [[0, '#ffffff'], [0.65, '#f1f5f9'], [1, '#cbd5e1']]), 2.6);

      if (!isUp && !isSide) {
        // Inner dark shirt V & emerald tie
        ctx.beginPath();
        ctx.moveTo(-5.5, 2);
        ctx.lineTo(5.5, 2);
        ctx.lineTo(0, 15);
        ctx.closePath();
        fillStroke(ctx, '#e2e8f0', 1.6);

        ctx.beginPath();
        ctx.moveTo(-2.8, 3);
        ctx.lineTo(2.8, 3);
        ctx.lineTo(2.2, 16.5);
        ctx.lineTo(0, 20);
        ctx.lineTo(-2.2, 16.5);
        ctx.closePath();
        fillStroke(ctx, linGrad(ctx, 0, 3, 0, 20, [[0, '#4ade80'], [1, '#15803d']]), 1.7);

        // Coat lapel lines & center seam
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 19); ctx.lineTo(0, 28.5);
        ctx.stroke();

        // Breast pocket with tiny sprouting leaf & clipboard pen!
        rrectPath(ctx, 4.5, 13, 8.2, 7.2, 1.8);
        fillStroke(ctx, '#ffffff', 1.7);
        drawLeaf(ctx, 8.5, 13.2, 6.2, 2.6, -1.1, '#4ade80', '#15803d', 1.4);
      } else if (isSide) {
        rrectPath(ctx, 2, 13, 7, 7, 1.8);
        fillStroke(ctx, '#ffffff', 1.6);
        drawLeaf(ctx, 6, 13, 5.5, 2.4, -0.9, '#4ade80', '#15803d', 1.3);
      } else {
        // Back coat belt tab
        rrectPath(ctx, -8, 17, 16, 4, 1.5);
        fillStroke(ctx, '#e2e8f0', 1.6);
      }
    } else if (style === 'healer') {
      // Rose-salmon dress with crisp scalloped white apron & floral heart detail!
      ctx.beginPath();
      ctx.moveTo(-torsoW, 2);
      ctx.lineTo(torsoW, 2);
      ctx.quadraticCurveTo(torsoW + 3.5, 16, torsoW + 3, 29);
      ctx.quadraticCurveTo(0, 31.5, -torsoW - 3, 29);
      ctx.quadraticCurveTo(-torsoW - 3.5, 16, -torsoW, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, 2, 0, 30, [[0, '#fda4af'], [0.55, '#fb7185'], [1, '#e11d48']]), 2.6);

      // Crisp white apron over dress
      rrectPath(ctx, isSide ? -5 : -11.5, 8, isSide ? 14.5 : 23, 20.5, 4);
      fillStroke(ctx, linGrad(ctx, 0, 8, 0, 28, [[0, '#ffffff'], [1, '#fce7f3']]), 2.2);

      // Emerald collar bow & sweet floral emblem on apron
      if (!isUp) {
        drawHeartEmblem(ctx, isSide ? 4 : 0, 18, 4.4, '#22c55e', 1.5);
        if (!isSide) {
          drawCircle(ctx, 0, 6, 2.8, '#22c55e', 1.5);
        }
      } else {
        // Apron waist tie bow in back
        drawEllipse(ctx, -4, 16, 4.5, 2.6, -0.25, '#ffffff', 1.7);
        drawEllipse(ctx, 4, 16, 4.5, 2.6, 0.25, '#ffffff', 1.7);
        drawCircle(ctx, 0, 16, 2.4, '#fda4af', 1.5);
      }
    } else if (style === 'shop') {
      // Olive-green shopkeeper apron with straps + golden coin pouch!
      rrectPath(ctx, -torsoW + 0.5, 8, torsoW * 2 - 1, 20.5, 3.5);
      fillStroke(ctx, linGrad(ctx, -torsoW, 8, torsoW, 28, [[0, '#65a30d'], [0.55, '#4d7c0f'], [1, '#365314']]), 2.4);

      if (!isSide) {
        rrectPath(ctx, -9, 3, 4, 7, 1.5);
        fillStroke(ctx, '#4d7c0f', 1.8);
        rrectPath(ctx, 5, 3, 4, 7, 1.5);
        fillStroke(ctx, '#4d7c0f', 1.8);
      }
      if (!isUp) {
        // Front apron pocket + golden coin pouch at waist!
        rrectPath(ctx, isSide ? 0 : -7.5, 16, isSide ? 9 : 15, 7.5, 2.2);
        fillStroke(ctx, '#fef08a', 1.8);
        // Cute dangling coin pouch
        drawCircle(ctx, isSide ? 7 : 10, 22, 4.8, linGrad(ctx, 7, 18, 13, 26, [[0, '#fde047'], [1, '#d97706']]), 1.9);
        drawCircle(ctx, isSide ? 7 : 10, 22, 2.0, '#fef9c3', 1.1);
      }
    } else if (style === 'trainer') {
      // Sporty forest-green & khaki field vest with pockets over yellow tee!
      rrectPath(ctx, -torsoW, 3, torsoW * 2, 18, 3);
      fillStroke(ctx, linGrad(ctx, -torsoW, 3, torsoW, 21, [[0, '#22c55e'], [0.6, '#15803d'], [1, '#14532d']]), 2.4);
      // Dark khaki field shorts/pants
      rrectPath(ctx, -torsoW + 0.5, 20.5, torsoW * 2 - 1, 8, 2.5);
      fillStroke(ctx, '#475569', 2.2);

      if (!isUp && !isSide) {
        // Center open yellow stripe + two orange-trimmed chest pockets
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-3.2, 3.5, 6.4, 17);
        setInk(ctx, 1.7);
        ctx.strokeRect(-3.2, 3.5, 6.4, 17);
        rrectPath(ctx, -11.5, 10, 6, 5.5, 1.5);
        fillStroke(ctx, '#f97316', 1.6);
        rrectPath(ctx, 5.5, 10, 6, 5.5, 1.5);
        fillStroke(ctx, '#f97316', 1.6);
      } else if (isSide) {
        rrectPath(ctx, 1, 10, 6.5, 5.5, 1.5);
        fillStroke(ctx, '#f97316', 1.6);
      }
    } else if (style === 'guard') {
      // Guarda Tom: structured petrol-blue uniform jacket + diagonal golden sash + golden star badge!
      ctx.beginPath();
      ctx.moveTo(-torsoW - 0.5, 2);
      ctx.lineTo(torsoW + 0.5, 2);
      ctx.quadraticCurveTo(torsoW + 2, 14, torsoW, 22);
      ctx.lineTo(-torsoW, 22);
      ctx.quadraticCurveTo(-torsoW - 2, 14, -torsoW - 0.5, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -torsoW, 2, torsoW, 22, [
        [0, '#0e7490'],
        [0.55, '#155e75'],
        [1, '#0c4a6e']
      ]), 2.6);

      // Navy uniform trousers
      rrectPath(ctx, -torsoW + 0.5, 21.5, torsoW * 2 - 1, 7.5, 2.5);
      fillStroke(ctx, '#1e3a8a', 2.2);

      // Golden-trimmed officer waist belt & buckle
      rrectPath(ctx, -torsoW, 18.5, torsoW * 2, 4.2, 1.2);
      fillStroke(ctx, '#0f172a', 1.9);
      if (!isUp) {
        rrectPath(ctx, isSide ? 4 : -3.5, 18.3, 7, 4.6, 1.2);
        fillStroke(ctx, '#facc15', 1.6);
      }

      // Diagonal officer shoulder sash (gold) & gleaming golden chest star!
      if (!isSide) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.moveTo(-11, 3.5);
        ctx.lineTo(10, 18.5);
        ctx.stroke();
        setInk(ctx, 1.3);
        ctx.stroke();
        if (!isUp) {
          // Crisp collar & golden star badge on right chest
          drawStar5(ctx, 7.2, 10.2, 4.6, 2.1, '#fde047', 1.4);
          // Gold shoulder epaulets
          rrectPath(ctx, -14.5, 2.5, 5.5, 2.8, 1.2);
          fillStroke(ctx, '#facc15', 1.4);
          rrectPath(ctx, 9, 2.5, 5.5, 2.8, 1.2);
          fillStroke(ctx, '#facc15', 1.4);
        }
      } else {
        drawStar5(ctx, 5.5, 10.5, 4.0, 1.8, '#fde047', 1.3);
      }
    } else if (style === 'leader') {
      // Líder Flora: regal emerald gown/tunic with golden vertical embroidery & shoulder brooches!
      ctx.beginPath();
      ctx.moveTo(-torsoW, 2);
      ctx.lineTo(torsoW, 2);
      ctx.quadraticCurveTo(torsoW + 3.5, 16, torsoW + 3, 29.5);
      ctx.quadraticCurveTo(0, 32, -torsoW - 3, 29.5);
      ctx.quadraticCurveTo(-torsoW - 3.5, 16, -torsoW, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -torsoW, 2, torsoW, 30, [
        [0, '#22c55e'],
        [0.5, '#15803d'],
        [1, '#065f46']
      ]), 2.6);

      // Ornate gold waist sash & center royal embroidery
      rrectPath(ctx, -torsoW - 1, 15, (torsoW + 1) * 2, 4.2, 1.5);
      fillStroke(ctx, linGrad(ctx, -14, 15, 14, 19, [[0, '#fef08a'], [0.5, '#facc15'], [1, '#ca8a04']]), 1.7);

      if (!isUp) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(isSide ? 5 : 0, 4);
        ctx.lineTo(isSide ? 5 : 0, 29);
        ctx.stroke();
        // Golden floral collar clasp
        drawCircle(ctx, isSide ? 5 : 0, 6.2, 3.2, '#facc15', 1.6);
        drawCircle(ctx, isSide ? 5 : 0, 6.2, 1.4, '#4ade80', 0);
      }
    } else if (style === 'leader2') {
      // Líder Mandi: rugged subterranean expedition tunic, leather belt & glowing CYAN CRYSTAL BROOCH!
      ctx.beginPath();
      ctx.moveTo(-torsoW - 0.5, 2);
      ctx.lineTo(torsoW + 0.5, 2);
      ctx.quadraticCurveTo(torsoW + 2.5, 15, torsoW + 1, 28.5);
      ctx.lineTo(-torsoW - 1, 28.5);
      ctx.quadraticCurveTo(-torsoW - 2.5, 15, -torsoW - 0.5, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -torsoW, 2, torsoW, 28, [
        [0, '#b45309'],
        [0.55, '#78350f'],
        [1, '#451a03']
      ]), 2.6);

      // Terracotta-amber expedition poncho/mantle draped over shoulders!
      ctx.beginPath();
      ctx.moveTo(-torsoW - 2, 2);
      ctx.lineTo(torsoW + 2, 2);
      ctx.lineTo(torsoW + 4, 14);
      ctx.quadraticCurveTo(0, 19, -torsoW - 4, 14);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, 2, 0, 18, [[0, '#f59e0b'], [0.55, '#d97706'], [1, '#9a3412']]), 2.3);

      // Leather utility belt
      rrectPath(ctx, -torsoW, 19.5, torsoW * 2, 4, 1.2);
      fillStroke(ctx, '#292524', 1.8);

      // Gleaming CYAN CRYSTAL BROOCH pinned at center chest!
      if (!isUp) {
        drawCrystalBrooch(ctx, isSide ? 6 : 0, 10.5, 4.2, 5.8);
      }
    }

    // -----------------------------------------------------------------------
    // 5. FRONT ARM (SIDE VIEW)
    // -----------------------------------------------------------------------
    if (isSide) {
      drawArm(4 + stride * 7, 13, stride * 0.48);
    }

    // -----------------------------------------------------------------------
    // 6. HEAD, SHADED SKIN & HAIR
    // -----------------------------------------------------------------------
    drawCircle(ctx, 0, -12, 15.8, radGrad(ctx, -4, -17, 2, 0, -11, 17, [
      [0, th.skin],
      [0.72, th.skin],
      [1, th.skinShade]
    ]), 2.8);

    // Cute subtle ear on side/front
    if (isSide) {
      drawCircle(ctx, -3, -10.5, 3.3, th.skin, 2.0);
    }

    // Hair sculpting (rich bangs on front/side, full shaded back hair on up)
    if (isUp) {
      ctx.beginPath();
      ctx.arc(0, -12, 16.4, 0, Math.PI * 2);
      fillStroke(ctx, radGrad(ctx, -5, -18, 2, 0, -12, 18, [
        [0, th.hairHi],
        [0.45, th.hair],
        [1, th.hair]
      ]), 2.7);
      if (style === 'prof') {
        // Friendly wispy professor hair tufts at sides & crown
        drawEllipse(ctx, -14.5, -13, 4.2, 5.2, -0.3, th.hair, 2.1);
        drawEllipse(ctx, 14.5, -13, 4.2, 5.2, 0.3, th.hair, 2.1);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, -12, 11.5, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
      }
      if (th.longHair) {
        // Flowing back hair locks for Líder Flora
        ctx.beginPath();
        ctx.moveTo(-16, -9);
        ctx.bezierCurveTo(-19, 3, -18, 14, -11, 18);
        ctx.quadraticCurveTo(0, 21, 11, 18);
        ctx.bezierCurveTo(18, 14, 19, 3, 16, -9);
        ctx.closePath();
        fillStroke(ctx, linGrad(ctx, 0, -9, 0, 20, [[0, th.hairHi], [0.4, th.hair], [1, '#6b290c']]), 2.5);
      }
      drawHighlight(ctx, -5, -17, 5.2, 2.2, -0.35, 0.36);
    } else {
      // Sculpted bangs framing forehead
      ctx.beginPath();
      ctx.arc(0, -13.5, 16.2, Math.PI * 0.9, Math.PI * 2.1);
      if (isSide) {
        ctx.quadraticCurveTo(8, -19, 2, -14);
        ctx.quadraticCurveTo(-5, -17, -15, -10);
      } else {
        ctx.lineTo(14, -13);
        ctx.quadraticCurveTo(9, -18.5, 4, -14.5);
        ctx.quadraticCurveTo(0, -19.5, -5, -14.5);
        ctx.quadraticCurveTo(-10, -18.5, -15, -13);
      }
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -12, -26, 12, -10, [[0, th.hairHi], [0.55, th.hair], [1, th.hair]]), 2.5);
      if (style === 'prof') {
        // Classic fluffy professor side-tufts
        if (!isSide) {
          drawEllipse(ctx, -15.5, -13, 3.6, 4.8, -0.25, th.hair, 2.0);
          drawEllipse(ctx, 15.5, -13, 3.6, 4.8, 0.25, th.hair, 2.0);
        } else {
          drawEllipse(ctx, -14.5, -12, 4.2, 5.2, -0.2, th.hair, 2.0);
        }
      }
      drawHighlight(ctx, -5, -21, 4.6, 1.8, -0.3, 0.35);
    }

    // Healer cute rose hair buns (both on front/back, clean single rear bun on side profile)
    if (style === 'healer') {
      if (isSide) {
        drawCircle(ctx, -15.5, -14.5, 5.6, radGrad(ctx, -17, -16, 1, -15.5, -14.5, 6, [[0, '#fbcfe8'], [1, '#ec4899']]), 2.3);
      } else {
        drawCircle(ctx, -16.5, -15.5, 5.6, radGrad(ctx, -18, -17, 1, -16.5, -15.5, 6, [[0, '#fbcfe8'], [1, '#ec4899']]), 2.3);
        drawCircle(ctx, 16.5, -15.5, 5.6, radGrad(ctx, 15, -17, 1, 16.5, -15.5, 6, [[0, '#fbcfe8'], [1, '#ec4899']]), 2.3);
      }
    }

    // -----------------------------------------------------------------------
    // 7. EXPRESSIVE FACE FEATURES (FRONT & SIDE)
    // -----------------------------------------------------------------------
    if (!isUp) {
      const browL = style === 'trainer' ? 0.16 : style === 'guard' ? 0.12 : style === 'leader2' ? 0.1 : -0.06;
      const browR = -browL;

      if (isSide) {
        drawChibiEye(ctx, 7.2, -10.8, 3.2, th.eye, browR, true);
        drawCheek(ctx, 10.2, -6.0, 3.2, 1.9);
        drawMouth(ctx, 8.8, -4.2, 3.2, style === 'trainer' || style === 'leader2' ? 'smirk' : 'smile');
      } else {
        drawChibiEye(ctx, -5.8, -10.8, 3.2, th.eye, browL, false);
        drawChibiEye(ctx, 5.8, -10.8, 3.2, th.eye, browR, false);
        drawCheek(ctx, -10.6, -6.0, 3.2, 1.9);
        drawCheek(ctx, 10.6, -6.0, 3.2, 1.9);
        drawMouth(ctx, 0, -4.4, 3.8, style === 'trainer' || style === 'leader2' ? 'smirk' : 'smile');
      }

      // Prof. Pomar gleaming round glasses with tinted glass lenses & white shine!
      if (style === 'prof') {
        const drawLens = function (lx, ly) {
          ctx.fillStyle = 'rgba(224, 242, 254, 0.42)';
          ctx.beginPath();
          ctx.arc(lx, ly, 5.1, 0, Math.PI * 2);
          ctx.fill();
          setInk(ctx, 2.0);
          ctx.stroke();
          // Crisp diagonal glass glint
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(lx - 2.6, ly - 1.2);
          ctx.lineTo(lx - 0.6, ly - 3.2);
          ctx.stroke();
        };
        if (isSide) {
          drawLens(7.2, -10.8);
        } else {
          drawLens(-5.8, -10.8);
          drawLens(5.8, -10.8);
          setInk(ctx, 2.0);
          ctx.beginPath();
          ctx.moveTo(-0.7, -10.8);
          ctx.lineTo(0.7, -10.8);
          ctx.stroke();
        }
      }

      // Seu Bento stylish curling handlebar mustache!
      if (style === 'shop') {
        ctx.save();
        ctx.translate(isSide ? 9.5 : 0, -5.6);
        ctx.beginPath();
        if (isSide) {
          ctx.moveTo(-3, 0);
          ctx.quadraticCurveTo(3, -3.2, 6.8, -0.5);
          ctx.quadraticCurveTo(4.2, 2.6, -3, 1.2);
        } else {
          ctx.moveTo(0, -1.2);
          ctx.bezierCurveTo(-4, -3.8, -9.5, -2.5, -10.2, 0.5);
          ctx.bezierCurveTo(-9.5, 2.8, -5.5, 2.5, 0, 0.8);
          ctx.bezierCurveTo(5.5, 2.5, 9.5, 2.8, 10.2, 0.5);
          ctx.bezierCurveTo(9.5, -2.5, 4, -3.8, 0, -1.2);
        }
        ctx.closePath();
        fillStroke(ctx, linGrad(ctx, -10, -2, 10, 2, [[0, '#92400e'], [0.5, '#78350f'], [1, '#451a03']]), 1.7);
        ctx.restore();
      }
    }

    // -----------------------------------------------------------------------
    // 8. SIGNATURE HEADGEAR (100% DISTINCT FOR EVERY SINGLE STYLE!)
    // -----------------------------------------------------------------------
    if (th.hat === 'straw') {
      // PLAYER: Woven golden straw hat with vivid RED ribbon band & back bow!
      drawEllipse(ctx, 0, -21.5, 24.5, 6.4, 0, linGrad(ctx, -24, -22, 24, -20, [
        [0, '#fef08a'],
        [0.5, '#facc15'],
        [1, '#ca8a04']
      ]), 2.6);
      ctx.beginPath();
      ctx.arc(0, -22.5, 14.8, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -5, -31, 2, 0, -23, 16, [
        [0, '#fef9c3'],
        [0.55, '#fde047'],
        [1, '#eab308']
      ]), 2.6);
      // Subtle straw weave arcs
      ctx.strokeStyle = 'rgba(161, 98, 7, 0.35)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(0, -22.5, 11.2, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
      // Vivid RED ribbon band!
      ctx.beginPath();
      ctx.moveTo(-14.6, -22);
      ctx.quadraticCurveTo(0, -18.5, 14.6, -22);
      ctx.lineTo(14.2, -25.8);
      ctx.quadraticCurveTo(0, -22.5, -14.2, -25.8);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -14, -24, 14, -22, [[0, '#f87171'], [0.5, '#ef4444'], [1, '#b91c1c']]), 1.9);
      // Ribbon tails visible on UP or back of SIDE
      if (isUp) {
        drawLeaf(ctx, -2, -21, 9, 3.2, 2.2, '#ef4444', '#991b1b', 1.6);
        drawLeaf(ctx, 2, -21, 9, 3.2, 0.9, '#ef4444', '#991b1b', 1.6);
        drawCircle(ctx, 0, -21.5, 2.5, '#dc2626', 1.5);
      } else if (isSide) {
        drawLeaf(ctx, -12, -22, 8.5, 2.8, 2.5, '#ef4444', '#991b1b', 1.5);
      }
    } else if (th.hat === 'nurse') {
      // HEALER: Charming floral greenhouse nurse cap with green heart & pink blossom!
      ctx.beginPath();
      ctx.moveTo(-13, -24);
      ctx.quadraticCurveTo(-11, -35.5, 0, -36.5);
      ctx.quadraticCurveTo(11, -35.5, 13, -24);
      ctx.quadraticCurveTo(0, -21.5, -13, -24);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, -36, 0, -23, [[0, '#ffffff'], [1, '#fce7f3']]), 2.4);
      // Salmon trim line
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-11, -25);
      ctx.quadraticCurveTo(0, -23, 11, -25);
      ctx.stroke();
      if (!isUp) {
        drawHeartEmblem(ctx, isSide ? 4 : 0, -30, 3.8, '#22c55e', 1.4);
      }
      // Cute side flower pinned to nurse cap!
      drawFlower(ctx, isSide ? -5 : 11, -26.5, 4.2, '#f472b6', '#fde047', 5);
    } else if (th.hat === 'beret') {
      // SHOP (Seu Bento): Classic warm chestnut wool beret with stem nub & highlight
      drawEllipse(ctx, -1.5, -26, 18.8, 8.0, -0.14, radGrad(ctx, -6, -29, 2, -1, -26, 18, [
        [0, '#a16207'],
        [0.55, '#78350f'],
        [1, '#451a03']
      ]), 2.6);
      drawHighlight(ctx, -7, -28.5, 5.2, 2.0, -0.25, 0.35);
      // Beret top nub
      ctx.beginPath();
      ctx.moveTo(-3, -33.5);
      ctx.quadraticCurveTo(-2, -37.5, 1.5, -36.5);
      ctx.lineTo(-0.5, -33);
      ctx.closePath();
      fillStroke(ctx, '#451a03', 2.0);
    } else if (th.hat === 'cap') {
      // TRAINER: Sporty ORANGE & GREEN field cap with white leaf emblem!
      ctx.beginPath();
      ctx.arc(0, -20.5, 16.2, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -5, -30, 2, 0, -22, 16, [
        [0, '#fb923c'],
        [0.6, '#f97316'],
        [1, '#c2410c']
      ]), 2.6);
      // Emerald green sporty brim pointing in facing direction!
      if (isSide) {
        drawEllipse(ctx, 13.5, -20.2, 10.5, 3.8, 0.1, '#16a34a', 2.4);
      } else if (!isUp) {
        drawEllipse(ctx, 0, -19.5, 16.8, 4.2, 0, '#16a34a', 2.4);
      } else {
        // Back snapback strap
        rrectPath(ctx, -5, -23.5, 10, 3.2, 1.4);
        fillStroke(ctx, '#16a34a', 1.6);
      }
      if (!isUp) {
        drawCircle(ctx, isSide ? 8.5 : 0, -27.2, 3.8, '#fffdf5', 1.6);
        drawLeaf(ctx, isSide ? 6.5 : -2, -26.2, 5.5, 2.2, -0.7, '#4ade80', '#15803d', 1.1);
      }
    } else if (th.hat === 'guardCap') {
      // GUARD (Guarda Tom): Navy-blue peaked officer cap (quepe) with visor, gold band & GOLDEN STAR!
      ctx.beginPath();
      ctx.moveTo(-16.5, -22);
      ctx.lineTo(-19.5, -32);
      ctx.quadraticCurveTo(0, -38.5, 19.5, -32);
      ctx.lineTo(16.5, -22);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, -38, 0, -22, [
        [0, '#1d4ed8'],
        [0.55, '#1e3a8a'],
        [1, '#172554']
      ]), 2.6);
      // Golden officer braid band
      rrectPath(ctx, -16.5, -25.2, 33, 3.8, 1.2);
      fillStroke(ctx, linGrad(ctx, -16, -24, 16, -24, [[0, '#fef08a'], [0.5, '#facc15'], [1, '#ca8a04']]), 1.7);
      // Glossy dark-navy officer visor
      if (isSide) {
        drawEllipse(ctx, 13.5, -21.2, 10.5, 3.6, 0.14, '#0f172a', 2.3);
        drawHighlight(ctx, 14, -21.8, 4.0, 1.1, 0.1, 0.45);
      } else if (!isUp) {
        drawEllipse(ctx, 0, -20.6, 17.2, 4.0, 0, '#0f172a', 2.3);
        drawHighlight(ctx, -5, -21.2, 5.2, 1.1, 0, 0.4);
      }
      // Gleaming GOLDEN STAR crest on front of officer cap!
      if (!isUp) {
        drawStar5(ctx, isSide ? 8.5 : 0, -30.5, 5.0, 2.2, '#fde047', 1.5);
      }
    } else if (th.hat === 'flowerCrown') {
      // LEADER (Líder Flora): Exuberant golden-leaf & vibrant flower crown!
      // Golden leafy wreath arc
      drawLeaf(ctx, -16, -24, 12, 4.5, -2.25, '#fde047', '#16a34a', 1.8);
      drawLeaf(ctx, 16, -24, 12, 4.5, -0.88, '#fde047', '#16a34a', 1.8);
      drawLeaf(ctx, -8, -28, 11, 4.2, -1.9, '#86efac', '#15803d', 1.8);
      drawLeaf(ctx, 8, -28, 11, 4.2, -1.25, '#86efac', '#15803d', 1.8);
      // Exuberant colorful blossoms + central golden bloom!
      drawFlower(ctx, -12.5, -25.5, 5.4, '#f472b6', '#fef08a', 5);
      drawFlower(ctx, 12.5, -25.5, 5.4, '#c084fc', '#fef08a', 5);
      drawFlower(ctx, 0, -29.5, 6.6, '#facc15', '#ea580c', 5);
      drawCircle(ctx, -6, -23.5, 2.2, '#fde047', 1.2);
      drawCircle(ctx, 6, -23.5, 2.2, '#fde047', 1.2);
    } else if (th.hat === 'minerHelmet') {
      // LEADER2 (Líder Mandi): Underground explorer helmet with GLOWING YELLOW HEADLAMP!
      // Helmet brim
      drawEllipse(ctx, isSide ? 2 : 0, -21.2, 20.5, 5.0, 0, linGrad(ctx, -20, -21, 20, -21, [
        [0, '#f59e0b'],
        [0.5, '#d97706'],
        [1, '#92400e']
      ]), 2.5);
      // Helmet dome
      ctx.beginPath();
      ctx.arc(0, -22, 16.2, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -5, -31, 2, 0, -22, 17, [
        [0, '#fde68a'],
        [0.45, '#f59e0b'],
        [1, '#b45309']
      ]), 2.6);
      // Central reinforcement ridge on helmet
      rrectPath(ctx, -2.8, -38.5, 5.6, 15, 2.5);
      fillStroke(ctx, '#b45309', 1.9);

      // Headlamp band
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-16, -24.5);
      ctx.quadraticCurveTo(0, -22, 16, -24.5);
      ctx.stroke();

      // LIT YELLOW HEADLAMP LANTERN with warm radial light beam!
      if (!isUp) {
        const lx = isSide ? 14.5 : 0;
        const ly = -28.5;
        // Soft warm glowing light halo
        const beam = radGrad(ctx, lx, ly, 2, lx + (isSide ? 5 : 0), ly, 16, [
          [0, 'rgba(254, 249, 195, 0.92)'],
          [0.45, 'rgba(250, 204, 21, 0.45)'],
          [1, 'rgba(250, 204, 21, 0)']
        ]);
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.arc(lx + (isSide ? 3 : 0), ly, 15, 0, Math.PI * 2);
        ctx.fill();

        // Brass lamp housing + glowing bulb
        drawCircle(ctx, lx, ly, 5.2, '#78350f', 2.0);
        drawCircle(ctx, lx + (isSide ? 1 : 0), ly, 3.8, radGrad(ctx, lx, ly - 1, 0.5, lx, ly, 4, [
          [0, '#ffffff'],
          [0.5, '#fef08a'],
          [1, '#facc15']
        ]), 1.2);
      }
    }

    ctx.restore();
  }

  function drawCharacter(ctx, cx, cy, size, style, dir, walkFrame) {
    if (!ctx || !size || size <= 0) return;
    const d = dir || 'down';
    const wf = walkFrame || 0;
    const unitScale = size / 84;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(unitScale, unitScale);

    // Subtle ground oval shadow hugging boots cleanly
    ctx.fillStyle = 'rgba(43, 29, 20, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 34, 19.5, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (style === 'sign') {
      drawSignProp(ctx);
    } else if (style === 'box') {
      drawBoxTerminalProp(ctx);
    } else {
      drawHumanCharacter(ctx, style, d, wf);
    }

    ctx.restore();
  }

  // =========================================================================
  // PUBLIC: HM.Sprites.drawCapturePot (VASO DE CAPTURA)
  // =========================================================================

  function drawCapturePot(ctx, cx, cy, radius, isSuper, angle, openAmount) {
    if (!ctx || !radius || radius <= 0) return;
    const open = Math.max(0, Math.min(1, openAmount || 0));
    const sup = Boolean(isSuper);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle || 0);
    const s = radius / 36;
    ctx.scale(s, s);

    // Palette: Terracotta + Leaf Green (normal) vs Gold + Sapphire Blue (Super)
    const bodyLight = sup ? '#fef08a' : '#f29e74';
    const bodyMid = sup ? '#facc15' : '#d96b43';
    const bodyDark = sup ? '#b45309' : '#9b3b28';
    const bandColor = sup ? '#2563eb' : '#22c55e';
    const bandDark = sup ? '#1e40af' : '#15803d';
    const innerGlowColor = sup ? 'rgba(253, 224, 71, 0.85)' : 'rgba(134, 239, 172, 0.85)';

    // Inner magical glow pouring out when opening!
    if (open > 0.02) {
      ctx.save();
      const glowR = 26 + open * 24;
      const g = radGrad(ctx, 0, -4, 3, 0, -6, glowR, [
        [0, '#ffffff'],
        [0.45, innerGlowColor],
        [1, 'rgba(255, 255, 255, 0)']
      ]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -4, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- LOWER POT HALF ----
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI);
    ctx.closePath();
    fillStroke(ctx, radGrad(ctx, -10, 6, 4, 0, 8, 36, [
      [0, bodyLight],
      [0.55, bodyMid],
      [1, bodyDark]
    ]), 3.4);

    // Subtle pot base foot curve
    ctx.strokeStyle = 'rgba(43, 29, 20, 0.25)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 4, 28, 0.28 * Math.PI, 0.72 * Math.PI);
    ctx.stroke();

    // Lower rim shadow when open
    if (open > 0.02) {
      drawEllipse(ctx, 0, 0, 32, 6.5 * open + 2, 0, '#14532d', 2.4);
      drawEllipse(ctx, 0, 0, 26, 4.5 * open + 1, 0, '#ffffff', 0);
    }

    // ---- UPPER LID HALF (tilts & lifts with openAmount!) ----
    ctx.save();
    ctx.translate(-32, 0);
    ctx.rotate(-open * 0.72);
    ctx.translate(32, -open * 12);

    // Upper dome
    ctx.beginPath();
    ctx.arc(0, 0, 34, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, radGrad(ctx, -12, -16, 4, 0, -6, 36, [
      [0, sup ? '#ffffff' : '#fcd5b5'],
      [0.32, bodyLight],
      [0.72, bodyMid],
      [1, bodyDark]
    ]), 3.4);

    // Glossy cartoon highlight on top-left dome
    drawHighlight(ctx, -14, -15, 7.5, 4.2, -0.55, 0.65);

    // Super Pot golden decorative twin chevrons/wings on lid
    if (sup) {
      ctx.fillStyle = '#2563eb';
      setInk(ctx, 2.2);
      ctx.beginPath();
      ctx.moveTo(-24, -10);
      ctx.lineTo(-14, -22);
      ctx.lineTo(-9, -15);
      ctx.lineTo(-18, -7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(24, -10);
      ctx.lineTo(14, -22);
      ctx.lineTo(9, -15);
      ctx.lineTo(18, -7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Center botanical band along the seam
    ctx.beginPath();
    ctx.rect(-34, -5.5, 68, 11);
    fillStroke(ctx, linGrad(ctx, 0, -5.5, 0, 5.5, [[0, bandColor], [1, bandDark]]), 3.0);

    // Center Clasp Medallion
    drawCircle(ctx, 0, 0, 12.5, '#fffdf5', 3.0);
    drawCircle(ctx, 0, 0, 8.8, sup ? '#fef08a' : '#dcfce7', 2.0);

    if (sup) {
      // Golden Star-Leaf emblem inside Super clasp
      drawStar4(ctx, 0, 0, 6.8, '#f59e0b', true);
    } else {
      // Cute green Sprout (brotinho) inside Normal clasp!
      setInk(ctx, 2.2);
      ctx.beginPath();
      ctx.moveTo(0, 5.5);
      ctx.lineTo(0, -1);
      ctx.stroke();
      drawLeaf(ctx, 0, -0.5, 7.2, 3.2, -0.65, '#4ade80', '#15803d', 1.6);
      drawLeaf(ctx, 0, -0.5, 7.2, 3.2, -2.5, '#86efac', '#16a34a', 1.6);
    }

    ctx.restore();
    ctx.restore();
  }

  // =========================================================================
  // EXPORT TO window.HortaMon.Sprites
  // =========================================================================

  HM.Sprites = {
    artReady: artReady,
    drawCreature: drawCreature,
    renderCreatureToDataURL: renderCreatureToDataURL,
    drawCharacter: drawCharacter,
    drawCapturePot: drawCapturePot
  };
})(window);
