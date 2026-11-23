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
  // PUBLIC: HM.Sprites.drawCharacter (OVERWORLD CHARACTERS & PROPS)
  // =========================================================================

  function drawSignProp(ctx) {
    // Little grass tuft at post base
    drawLeaf(ctx, -6, 34, 10, 4, -2.5, '#4ade80', '#16a34a', 2.0);
    drawLeaf(ctx, 6, 34, 10, 4, -0.6, '#4ade80', '#16a34a', 2.0);

    // Wooden post
    ctx.beginPath();
    ctx.rect(-5, 6, 10, 28);
    fillStroke(ctx, linGrad(ctx, -5, 6, 5, 34, [[0, '#a16207'], [1, '#713f12']]), 2.8);

    // Wooden sign board
    ctx.beginPath();
    ctx.moveTo(-27, -20);
    ctx.lineTo(27, -20);
    ctx.lineTo(29, -8);
    ctx.lineTo(27, 8);
    ctx.lineTo(-27, 8);
    ctx.lineTo(-29, -6);
    ctx.closePath();
    fillStroke(ctx, linGrad(ctx, 0, -20, 0, 8, [[0, '#eab676'], [1, '#b4783c']]), 3.0);

    // Wood grain & painted text lines
    ctx.strokeStyle = '#6b3e1b';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-19, -11);
    ctx.lineTo(17, -11);
    ctx.moveTo(-19, -3);
    ctx.lineTo(13, -3);
    ctx.moveTo(-19, 3);
    ctx.lineTo(6, 3);
    ctx.stroke();

    // Cute sprouting leaf on corner!
    drawLeaf(ctx, 21, -18, 12, 5, -0.7, '#4ade80', '#15803d', 2.2);
  }

  function drawBoxTerminalProp(ctx) {
    // Greenhouse Computerized Box Kiosk!
    // Base cabinet
    ctx.beginPath();
    ctx.moveTo(-24, -18);
    ctx.lineTo(24, -18);
    ctx.quadraticCurveTo(28, -18, 28, -12);
    ctx.lineTo(28, 30);
    ctx.quadraticCurveTo(28, 35, 22, 35);
    ctx.lineTo(-22, 35);
    ctx.quadraticCurveTo(-28, 35, -28, 30);
    ctx.lineTo(-28, -12);
    ctx.quadraticCurveTo(-28, -18, -24, -18);
    ctx.closePath();
    fillStroke(ctx, linGrad(ctx, -26, -18, 26, 35, [[0, '#dcfce7'], [0.5, '#86efac'], [1, '#22c55e']]), 3.0);

    // Terracotta lower trim
    ctx.beginPath();
    ctx.rect(-24, 18, 48, 14);
    fillStroke(ctx, '#c8553d', 2.4);

    // Glowing sky-blue monitor screen
    ctx.beginPath();
    ctx.rect(-20, -12, 40, 24);
    fillStroke(ctx, linGrad(ctx, -20, -12, 20, 12, [[0, '#e0f2fe'], [1, '#38bdf8']]), 2.6);

    // Leaf icon on screen
    drawLeaf(ctx, -6, 4, 15, 6.2, -0.65, '#4ade80', '#15803d', 2.0);
    drawHighlight(ctx, -12, -7, 4, 2, -0.2, 0.7);

    // Little status LED buttons
    drawCircle(ctx, -14, 25, 3, '#fde047', 1.6);
    drawCircle(ctx, -5, 25, 3, '#4ade80', 1.6);
    drawCircle(ctx, 12, 25, 3, '#fb7185', 1.6);

    // Mini glass dome with a sprout on top!
    ctx.beginPath();
    ctx.arc(0, -18, 13, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, 'rgba(224, 242, 254, 0.78)', 2.4);
    drawLeaf(ctx, 0, -21, 9, 4, -1.1, '#4ade80', '#15803d', 1.8);
  }

  function drawHumanCharacter(ctx, style, dir, walkFrame) {
    const stride = Math.sin((walkFrame || 0) * Math.PI * 0.5);
    const bounce = Math.abs(stride) * -2.6;
    const isSide = dir === 'left' || dir === 'right';
    const isUp = dir === 'up';
    const faceDir = dir === 'left' ? -1 : 1;

    // Style palettes
    const themes = {
      player: {
        skin: '#fde0c2', hair: '#5c3a21', shirt: '#fffbeb', outfit: '#16a34a',
        pants: '#2563eb', boot: '#78350f', hat: 'straw'
      },
      prof: {
        skin: '#fad7b8', hair: '#94a3b8', shirt: '#22c55e', outfit: '#ffffff',
        pants: '#475569', boot: '#334155', hat: 'prof'
      },
      healer: {
        skin: '#fde0c2', hair: '#f472b6', shirt: '#ffffff', outfit: '#fbcfe8',
        pants: '#fce7f3', boot: '#db2777', hat: 'nurse'
      },
      shop: {
        skin: '#f5cfa8', hair: '#78350f', shirt: '#fef3c7', outfit: '#15803d',
        pants: '#713f12', boot: '#451a03', hat: 'beret'
      },
      trainer: {
        skin: '#f7d2ae', hair: '#3b2414', shirt: '#facc15', outfit: '#0284c7',
        pants: '#1e3a8a', boot: '#9a3412', hat: 'cap'
      },
      leader: {
        skin: '#fde0c2', hair: '#92400e', shirt: '#fef08a', outfit: '#15803d',
        pants: '#065f46', boot: '#a16207', hat: 'flowerCrown', cape: true
      },
      leader2: {
        skin: '#e8b98f', hair: '#3f2a19', shirt: '#fde68a', outfit: '#92400e',
        pants: '#44403c', boot: '#1c1917', hat: 'cap', cape: true
      },
      guard: {
        skin: '#f7d2ae', hair: '#1c1917', shirt: '#e0f2fe', outfit: '#1d4ed8',
        pants: '#1e3a8a', boot: '#0f172a', hat: 'cap'
      }
    };
    const th = themes[style] || themes.player;

    ctx.save();
    ctx.translate(0, bounce);
    if (dir === 'left') ctx.scale(-1, 1);

    // Optional Leader flowing emerald-and-gold cape (behind body)
    if (th.cape) {
      ctx.beginPath();
      ctx.moveTo(-15, 2);
      ctx.lineTo(-24, 30);
      ctx.quadraticCurveTo(0, 35, 24, 30);
      ctx.lineTo(15, 2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, 2, 0, 34, [[0, '#16a34a'], [1, '#065f46']]), 2.8);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-21, 28);
      ctx.quadraticCurveTo(0, 32, 21, 28);
      ctx.stroke();
    }

    // Legs / Boots with walking animation
    const leftLegY = 29 + (isSide ? stride * 3 : stride * 3.5);
    const rightLegY = 29 - (isSide ? stride * 3 : stride * 3.5);
    const leftLegX = isSide ? -4 + stride * 7 : -8;
    const rightLegX = isSide ? 4 - stride * 7 : 8;

    drawEllipse(ctx, leftLegX, leftLegY, 6.2, 4.8, 0, th.boot, 2.7);
    drawEllipse(ctx, rightLegX, rightLegY, 6.2, 4.8, 0, th.boot, 2.7);

    // Back arm (when side-facing)
    if (isSide) {
      drawEllipse(ctx, -4 - stride * 7, 15, 5.2, 8.2, -stride * 0.45, th.shirt, 2.6);
    } else {
      // Both arms on sides
      drawEllipse(ctx, -18, 15 + stride * 2.5, 5.0, 8.2, 0.25, th.shirt, 2.6);
      drawEllipse(ctx, 18, 15 - stride * 2.5, 5.0, 8.2, -0.25, th.shirt, 2.6);
    }

    // Torso / Outfit
    ctx.beginPath();
    ctx.moveTo(-14, 3);
    ctx.lineTo(14, 3);
    ctx.quadraticCurveTo(17, 16, 15, 28);
    ctx.lineTo(-15, 28);
    ctx.quadraticCurveTo(-17, 16, -14, 3);
    ctx.closePath();
    fillStroke(ctx, th.shirt, 2.9);

    // Role-specific clothes overlay
    if (style === 'player') {
      // Cute green/denim gardener overalls
      ctx.beginPath();
      ctx.rect(-13, 12, 26, 16);
      fillStroke(ctx, th.pants, 2.5);
      ctx.fillStyle = th.outfit;
      ctx.fillRect(-10, 4, 5, 11);
      ctx.fillRect(5, 4, 5, 11);
      setInk(ctx, 2.2);
      ctx.strokeRect(-10, 4, 5, 11);
      ctx.strokeRect(5, 4, 5, 11);
      drawCircle(ctx, -7.5, 13, 2, '#facc15', 1.2);
      drawCircle(ctx, 7.5, 13, 2, '#facc15', 1.2);
    } else if (style === 'prof') {
      // White lab coat with green tie
      ctx.beginPath();
      ctx.rect(-15, 4, 30, 25);
      fillStroke(ctx, '#ffffff', 2.6);
      if (!isUp) {
        ctx.beginPath();
        ctx.moveTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.lineTo(2, 18);
        ctx.lineTo(-2, 18);
        ctx.closePath();
        fillStroke(ctx, '#16a34a', 1.8);
      }
    } else if (style === 'healer') {
      // Pink floral apron
      ctx.beginPath();
      ctx.rect(-13, 8, 26, 20);
      fillStroke(ctx, '#fbcfe8', 2.4);
      if (!isUp) {
        drawFlower(ctx, 0, 18, 4.5, '#f472b6', '#fde047', 5);
      }
    } else if (style === 'shop') {
      // Green shopkeeper apron
      ctx.beginPath();
      ctx.rect(-13, 8, 26, 20);
      fillStroke(ctx, '#15803d', 2.5);
      if (!isUp) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-7, 15, 14, 7);
        setInk(ctx, 1.8);
        ctx.strokeRect(-7, 15, 14, 7);
      }
    } else if (style === 'leader') {
      // Emerald & gold royal tunic
      ctx.beginPath();
      ctx.rect(-14, 4, 28, 24);
      fillStroke(ctx, '#15803d', 2.6);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.lineTo(0, 27);
      ctx.stroke();
    } else {
      // Trainer vest
      ctx.beginPath();
      ctx.rect(-14, 4, 28, 17);
      fillStroke(ctx, th.outfit, 2.5);
      ctx.beginPath();
      ctx.rect(-13, 21, 26, 7);
      fillStroke(ctx, th.pants, 2.4);
    }

    // Front arm when side-facing
    if (isSide) {
      drawEllipse(ctx, 4 + stride * 7, 15, 5.2, 8.2, stride * 0.45, th.shirt, 2.6);
    }

    // Head!
    drawCircle(ctx, 0, -12, 16, th.skin, 3.0);

    // Hair base
    if (isUp) {
      ctx.beginPath();
      ctx.arc(0, -12, 16.5, 0, Math.PI * 2);
      fillStroke(ctx, th.hair, 2.8);
    } else {
      ctx.beginPath();
      ctx.arc(0, -14, 16.2, Math.PI * 0.92, Math.PI * 2.08);
      ctx.quadraticCurveTo(0, -19, -15, -13);
      ctx.closePath();
      fillStroke(ctx, th.hair, 2.6);
    }

    // Healer cute side buns
    if (style === 'healer') {
      drawCircle(ctx, -16, -15, 5.5, th.hair, 2.4);
      drawCircle(ctx, 16, -15, 5.5, th.hair, 2.4);
    }

    // Face features (when not facing 'up')
    if (!isUp) {
      const exOff = isSide ? 4 : 0;
      if (isSide) {
        drawEye(ctx, 7, -11, 2.8, {});
        drawCheek(ctx, 10, -6.5, 3.0, 1.8);
        drawMouth(ctx, 8, -4.5, 3.2, 'smile');
      } else {
        drawEye(ctx, -6 + exOff, -11, 2.8, {});
        drawEye(ctx, 6 + exOff, -11, 2.8, {});
        drawCheek(ctx, -10.5, -6.5, 3.0, 1.8);
        drawCheek(ctx, 10.5, -6.5, 3.0, 1.8);
        drawMouth(ctx, 0, -5, 3.6, style === 'trainer' ? 'smirk' : 'smile');
      }

      // Prof. Pomar round glasses!
      if (style === 'prof') {
        setInk(ctx, 2.0);
        if (isSide) {
          ctx.beginPath();
          ctx.arc(7, -11, 4.8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(-6, -11, 4.8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(6, -11, 4.8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-1.2, -11);
          ctx.lineTo(1.2, -11);
          ctx.stroke();
        }
      }

      // Seu Bento cheerful mustache!
      if (style === 'shop') {
        ctx.beginPath();
        ctx.moveTo(isSide ? 3 : -7, -6);
        ctx.quadraticCurveTo(isSide ? 8 : 0, -9, isSide ? 13 : 7, -6);
        ctx.quadraticCurveTo(isSide ? 8 : 0, -3, isSide ? 3 : -7, -6);
        fillStroke(ctx, '#78350f', 1.8);
      }
    }

    // Iconic Hats / Headgear!
    if (th.hat === 'straw') {
      // Young Gardener Straw Hat with emerald ribbon!
      drawEllipse(ctx, 0, -22, 24, 6.2, 0, '#facc15', 2.8);
      ctx.beginPath();
      ctx.arc(0, -23, 14.5, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, '#fde047', 2.8);
      // Green ribbon band
      ctx.beginPath();
      ctx.moveTo(-14, -22);
      ctx.quadraticCurveTo(0, -19, 14, -22);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 4.2;
      ctx.stroke();
      setInk(ctx, 1.8);
      ctx.stroke();
    } else if (th.hat === 'nurse') {
      // Nurse cap with leaf-heart badge
      ctx.beginPath();
      ctx.moveTo(-12, -25);
      ctx.lineTo(-9, -35);
      ctx.lineTo(9, -35);
      ctx.lineTo(12, -25);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 2.5);
      drawCircle(ctx, 0, -30, 3.2, '#22c55e', 1.5);
    } else if (th.hat === 'beret') {
      // Seu Bento cozy beret (boina)
      drawEllipse(ctx, -2, -26, 18, 7.5, -0.15, '#78350f', 2.8);
      drawCircle(ctx, -2, -33, 2.5, '#78350f', 2.0);
    } else if (th.hat === 'cap') {
      // Rival trainer bright ORANGE CAP!
      ctx.beginPath();
      ctx.arc(0, -20, 16, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, '#f97316', 2.8);
      // Cap brim facing walk direction
      if (isSide) {
        drawEllipse(ctx, 14, -20, 10, 3.8, 0.1, '#ea580c', 2.5);
      } else if (!isUp) {
        drawEllipse(ctx, 0, -19, 16, 4.2, 0, '#ea580c', 2.5);
      }
      // White circle emblem on cap
      if (!isUp) {
        drawCircle(ctx, isSide ? 8 : 0, -27, 3.2, '#ffffff', 1.6);
      }
    } else if (th.hat === 'flowerCrown') {
      // Mestra Flora colorful flower crown!
      drawFlower(ctx, -11, -26, 5.2, '#f472b6', '#fde047', 5);
      drawFlower(ctx, 0, -29, 6.0, '#facc15', '#ea580c', 5);
      drawFlower(ctx, 11, -26, 5.2, '#c084fc', '#fef08a', 5);
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

    // Ground oval shadow
    ctx.fillStyle = 'rgba(43, 29, 20, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 34, 21, 7.2, 0, 0, Math.PI * 2);
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
