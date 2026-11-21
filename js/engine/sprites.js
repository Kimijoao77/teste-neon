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
        illustrations.set(id, image);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = url;
    });
  }));
  let scratchCanvas = null;
  let scratchCtx = null;

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

  function drawDroplet(ctx, x, y, sc, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.scale(sc || 1, sc || 1);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.bezierCurveTo(6, -1, 6, 7, 0, 7);
    ctx.bezierCurveTo(-6, 7, -6, -1, 0, -8);
    ctx.closePath();
    fillStroke(ctx, color || '#38bdf8', 2.0);
    drawHighlight(ctx, -1.6, 1, 1.3, 2.2, -0.2, 0.75);
    ctx.restore();
  }

  function drawFoot(ctx, x, y, rx, ry, color, rot) {
    drawEllipse(ctx, x, y, rx, ry, rot || 0, color, 2.8);
  }

  // =========================================================================
  // ALL 22 ORIGINAL HORTAMON SPECIES (NORMALIZED [-50, 50], FACING RIGHT)
  // =========================================================================

  const SPECIES_DRAWERS = {
    // 1. PIMENTICO: cute red chili pepper with green calyx, curly stem & tiny flame spark
    pimentico: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.4);
      const hop = Math.sin(t * 2.8) * 1.8;
      ctx.translate(0, hop);

      // Cute stubby feet
      drawFoot(ctx, -9, 32, 7.5, 4.8, '#b91c1c', -0.1);
      drawFoot(ctx, 10, 32, 7.5, 4.8, '#dc2626', 0.1);

      // Plump curved chili body
      ctx.beginPath();
      ctx.moveTo(-2, -18);
      ctx.bezierCurveTo(22, -16, 28, 12, 16, 28);
      ctx.bezierCurveTo(4, 38, -18, 32, -24, 15);
      ctx.bezierCurveTo(-29, 0, -20, -19, -2, -18);
      ctx.closePath();
      const bodyGrad = radGrad(ctx, -6, -6, 3, 0, 10, 34, [
        [0, '#ff8080'],
        [0.32, '#ef4444'],
        [1, '#b91c1c']
      ]);
      fillStroke(ctx, bodyGrad, 3.2);

      // Glossy pepper shine
      drawHighlight(ctx, -12, -2, 4.2, 9.5, -0.35, 0.58);
      drawHighlight(ctx, -15, 11, 2.2, 3.2, -0.2, 0.45);

      // Little waving arm
      drawEllipse(ctx, 21, 9, 5.5, 3.5, 0.35 + sway * 0.15, '#ef4444', 2.6);

      // Green calyx crown
      ctx.beginPath();
      ctx.moveTo(-16, -13);
      ctx.quadraticCurveTo(-8, -24, 0, -21);
      ctx.quadraticCurveTo(9, -24, 15, -13);
      ctx.quadraticCurveTo(7, -8, 2, -13);
      ctx.quadraticCurveTo(-4, -7, -9, -13);
      ctx.quadraticCurveTo(-13, -9, -16, -13);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -16, -24, 15, -10, [[0, '#4ade80'], [1, '#15803d']]), 2.8);

      // Curly stem + little bouncing flame spark
      ctx.save();
      ctx.translate(0, -21);
      ctx.rotate(sway * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-6, -11, 5, -15);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6.2;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3.0;
      ctx.stroke();

      // Cute fiery spark at stem tip!
      drawFlame(ctx, 8, -13, 0.62 + sway * 0.05, 0.25, sway * 0.5);
      ctx.restore();

      // Expressive face (facing right)
      drawEye(ctx, -5, 4, 4.5, { sleeping: sleep });
      drawEye(ctx, 11, 4, 4.5, { sleeping: sleep });
      drawCheek(ctx, -11, 11, 4.2, 2.4);
      drawCheek(ctx, 16, 11, 4.2, 2.4);
      drawMouth(ctx, 3.5, 11.5, 4.8, sleep ? 'serene' : 'open');
    },

    // 2. JALAPAO: sturdy emerald-green jalapeño brawler with fierce brows & blazing fire crown
    jalapao: function (ctx, t, sleep) {
      const sway = Math.sin(t * 4.2);
      const bob = Math.sin(t * 2.6) * 1.4;
      ctx.translate(0, bob);

      // Blazing fire crown behind calyx
      drawFlame(ctx, -12, -20, 0.95, -0.35 + sway * 0.08, sway * 0.6);
      drawFlame(ctx, 0, -23, 1.2, sway * 0.06, -sway * 0.6);
      drawFlame(ctx, 13, -19, 0.95, 0.35 - sway * 0.08, sway * 0.5);

      // Sturdy feet
      drawFoot(ctx, -11, 33, 9, 5.5, '#14532d', -0.1);
      drawFoot(ctx, 12, 33, 9, 5.5, '#166534', 0.1);

      // Muscular back arm
      drawEllipse(ctx, -23, 8, 7.5, 5.5, -0.5, '#15803d', 2.9);

      // Robust jalapeño pepper body (deep emerald green flushing hot orange-red near bottom)
      ctx.beginPath();
      ctx.moveTo(-2, -21);
      ctx.bezierCurveTo(22, -20, 26, 8, 17, 29);
      ctx.bezierCurveTo(7, 37, -11, 36, -19, 27);
      ctx.bezierCurveTo(-27, 12, -24, -20, -2, -21);
      ctx.closePath();
      const bodyGrad = linGrad(ctx, -18, -20, 14, 34, [
        [0, '#4ade80'],
        [0.45, '#16a34a'],
        [0.82, '#ea580c'],
        [1, '#dc2626']
      ]);
      fillStroke(ctx, bodyGrad, 3.3);

      // Glossy jalapeño highlight
      drawHighlight(ctx, -13, -3, 3.6, 11, -0.2, 0.45);

      // Calyx spiky collar on top
      ctx.beginPath();
      ctx.moveTo(-18, -16);
      ctx.lineTo(-10, -26);
      ctx.lineTo(-2, -20);
      ctx.lineTo(5, -27);
      ctx.lineTo(13, -20);
      ctx.lineTo(19, -15);
      ctx.quadraticCurveTo(10, -10, 0, -13);
      ctx.quadraticCurveTo(-10, -10, -18, -16);
      ctx.closePath();
      fillStroke(ctx, '#15803d', 2.8);

      // Front flexed fist with spicy heat glow
      drawEllipse(ctx, 24, 11, 8, 6.2, 0.25 + sway * 0.1, linGrad(ctx, 18, 8, 30, 14, [[0, '#22c55e'], [1, '#f97316']]), 2.9);

      // Fierce determined eyes & thick angry brows
      drawEye(ctx, -4, 0, 4.6, { sleeping: sleep, sclera: '#fef9c3', brow: 0.32, browWidth: 3.4 });
      drawEye(ctx, 12, 0, 4.6, { sleeping: sleep, sclera: '#fef9c3', brow: -0.34, browWidth: 3.4 });
      drawCheek(ctx, -11, 8, 4.2, 2.4, 'rgba(249, 115, 22, 0.55)');
      drawCheek(ctx, 17, 8, 4.2, 2.4, 'rgba(249, 115, 22, 0.55)');
      drawMouth(ctx, 4.5, 11, 7.2, sleep ? 'serene' : 'grin');
    },

    // 3. HABANEIRO: majestic flaming habanero with billowing leaf cape & heat aura
    habaneiro: function (ctx, t, sleep) {
      const sway = Math.sin(t * 4.5);
      const pulse = 1 + Math.sin(t * 3.2) * 0.06;

      // Radiant heat aura behind
      ctx.save();
      ctx.scale(pulse, pulse);
      const aura = radGrad(ctx, 0, 2, 12, 0, 2, 46, [
        [0, 'rgba(251, 146, 60, 0.45)'],
        [0.6, 'rgba(239, 68, 68, 0.22)'],
        [1, 'rgba(239, 68, 68, 0)']
      ]);
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 2, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Billowing leaf cape behind body
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-10, -14);
      ctx.bezierCurveTo(-36, -6, -42, 18 + sway * 3, -34, 34 + sway * 2);
      ctx.quadraticCurveTo(-18, 28, -8, 33);
      ctx.quadraticCurveTo(10, 31, 24, 34 - sway * 2);
      ctx.bezierCurveTo(36, 18, 28, -4, 14, -14);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -34, -10, 26, 34, [
        [0, '#166534'],
        [0.65, '#15803d'],
        [1, '#b91c1c']
      ]), 3.0);
      ctx.restore();

      // Blazing triple flame crown
      drawFlame(ctx, -14, -22, 1.05, -0.4 + sway * 0.1, sway);
      drawFlame(ctx, 0, -25, 1.38, sway * 0.08, -sway);
      drawFlame(ctx, 14, -22, 1.05, 0.4 - sway * 0.1, sway);

      // Regal legs/stance
      drawFoot(ctx, -11, 34, 9, 5.2, '#7f1d1d', -0.15);
      drawFoot(ctx, 12, 34, 9, 5.2, '#991b1b', 0.15);

      // Sculpted ribbed Habanero lantern body
      ctx.beginPath();
      ctx.moveTo(-4, -20);
      ctx.bezierCurveTo(18, -22, 28, -6, 24, 12);
      ctx.bezierCurveTo(21, 27, 10, 34, 1, 33);
      ctx.bezierCurveTo(-10, 35, -22, 27, -25, 11);
      ctx.bezierCurveTo(-28, -7, -18, -22, -4, -20);
      ctx.closePath();
      const bodyGrad = radGrad(ctx, -5, -8, 4, 0, 8, 34, [
        [0, '#fde047'],
        [0.25, '#fb923c'],
        [0.65, '#ef4444'],
        [1, '#991b1b']
      ]);
      fillStroke(ctx, bodyGrad, 3.3);

      // Characteristic habanero vertical rib lines
      ctx.strokeStyle = 'rgba(127, 29, 29, 0.42)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-12, -16);
      ctx.quadraticCurveTo(-17, 6, -10, 29);
      ctx.moveTo(14, -15);
      ctx.quadraticCurveTo(19, 6, 12, 28);
      ctx.stroke();

      drawHighlight(ctx, -11, -5, 3.5, 9, -0.25, 0.55);

      // Royal green leafy shoulder mantle / collar
      ctx.beginPath();
      ctx.moveTo(-22, -13);
      ctx.lineTo(-12, -24);
      ctx.lineTo(-4, -17);
      ctx.lineTo(3, -25);
      ctx.lineTo(12, -17);
      ctx.lineTo(22, -13);
      ctx.quadraticCurveTo(10, -6, 0, -10);
      ctx.quadraticCurveTo(-12, -6, -22, -13);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -20, -24, 20, -8, [[0, '#4ade80'], [1, '#14532d']]), 2.8);

      // Flame-wreathed confident fists
      drawEllipse(ctx, -22, 12, 7.5, 5.8, -0.3, '#ea580c', 2.8);
      drawEllipse(ctx, 25, 10, 8.0, 6.0, 0.2, '#f97316', 2.8);

      // Majestic glowing golden-rimmed eyes & flame brows
      drawEye(ctx, -5, 1, 4.7, { sleeping: sleep, sclera: '#fef08a', innerGlow: '#f97316', brow: 0.35, browColor: '#fef08a', browWidth: 3.4 });
      drawEye(ctx, 12, 1, 4.7, { sleeping: sleep, sclera: '#fef08a', innerGlow: '#f97316', brow: -0.35, browColor: '#fef08a', browWidth: 3.4 });
      drawMouth(ctx, 4, 12, 7.8, sleep ? 'serene' : 'grin');
    },

    // 4. MELANCITO: joyful round striped baby watermelon with bouncy sprout
    melancito: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.2);
      const bob = Math.sin(t * 2.8) * 1.8;
      ctx.translate(0, bob);

      // Stubby little feet
      drawFoot(ctx, -10, 32, 7.5, 4.8, '#15803d', -0.1);
      drawFoot(ctx, 11, 32, 7.5, 4.8, '#16a34a', 0.1);

      // Tiny happy nub arms
      drawEllipse(ctx, -26, 9, 5.5, 3.8, -0.4 - sway * 0.15, '#22c55e', 2.6);
      drawEllipse(ctx, 26, 9, 5.5, 3.8, 0.4 + sway * 0.15, '#22c55e', 2.6);

      // Round plump watermelon sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 6, 26, 0, Math.PI * 2);
      const rindGrad = radGrad(ctx, -8, -4, 3, 0, 6, 28, [
        [0, '#86efac'],
        [0.45, '#22c55e'],
        [1, '#15803d']
      ]);
      ctx.fillStyle = rindGrad;
      ctx.fill();

      // Clipped wavy dark-green watermelon stripes!
      ctx.clip();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 4.6;
      ctx.lineCap = 'round';
      const stripes = [-18, -7, 5, 17];
      for (let i = 0; i < stripes.length; i++) {
        const sx = stripes[i];
        ctx.beginPath();
        ctx.moveTo(sx, -22);
        ctx.bezierCurveTo(sx - 5, -6, sx + 5, 16, sx - 2, 34);
        ctx.stroke();
      }
      ctx.restore();

      // Crisp outline on top of stripes
      ctx.beginPath();
      ctx.arc(0, 6, 26, 0, Math.PI * 2);
      setInk(ctx, 3.2);
      ctx.stroke();

      // Glossy dew highlight
      drawHighlight(ctx, -11, -7, 4.2, 7.5, -0.55, 0.55);

      // Cute bouncing vine sprout on top
      ctx.save();
      ctx.translate(0, -19);
      ctx.rotate(sway * 0.12);
      setInk(ctx, 3.2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-3, -10, 2, -14);
      ctx.stroke();
      drawLeaf(ctx, 1, -12, 13, 6.2, -0.55, '#86efac', '#16a34a', 2.4);
      drawLeaf(ctx, 0, -10, 11, 5.2, -2.5, '#4ade80', '#15803d', 2.4);
      ctx.restore();

      // Cute fresh dewdrop
      drawDroplet(ctx, 22, -13 + sway * 1.5, 0.55, 0.2, '#38bdf8');

      // Super cheerful face
      drawEye(ctx, -6, 4, 4.6, { sleeping: sleep });
      drawEye(ctx, 11, 4, 4.6, { sleeping: sleep });
      drawCheek(ctx, -13, 11, 4.6, 2.6, 'rgba(251, 113, 133, 0.65)');
      drawCheek(ctx, 17, 11, 4.6, 2.6, 'rgba(251, 113, 133, 0.65)');
      drawMouth(ctx, 3, 11, 5.6, sleep ? 'serene' : 'open');
    },

    // 5. MELANCOR: warrior watermelon holding a juicy slice-shield & glistening droplets
    melancor: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.5);
      const bob = Math.sin(t * 2.4) * 1.4;
      ctx.translate(0, bob);

      // Orbiting glistening water droplets
      drawDroplet(ctx, -32, -8 + sway * 3, 0.68, -0.25, '#38bdf8');
      drawDroplet(ctx, 30, -20 - sway * 3, 0.62, 0.25, '#7dd3fc');

      // Athletic feet
      drawFoot(ctx, -12, 33, 9.5, 5.2, '#14532d', -0.1);
      drawFoot(ctx, 11, 33, 9.5, 5.2, '#166534', 0.1);

      // Back warrior arm
      drawEllipse(ctx, -26, 7, 8, 5.2, -0.45, '#16a34a', 2.9);

      // Sturdy striped watermelon torso
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-2, 4, 24, 27, 0, 0, Math.PI * 2);
      ctx.fillStyle = radGrad(ctx, -9, -6, 3, -2, 4, 29, [
        [0, '#86efac'],
        [0.5, '#22c55e'],
        [1, '#15803d']
      ]);
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 4.8;
      [-18, -7, 4, 15].forEach(function (sx) {
        ctx.beginPath();
        ctx.moveTo(sx, -26);
        ctx.bezierCurveTo(sx - 5, -5, sx + 4, 15, sx - 2, 34);
        ctx.stroke();
      });
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(-2, 4, 24, 27, 0, 0, Math.PI * 2);
      setInk(ctx, 3.2);
      ctx.stroke();

      // Sporty turquoise-blue sweatband / crest on forehead
      ctx.beginPath();
      ctx.moveTo(-23, -10);
      ctx.quadraticCurveTo(-2, -16, 19, -10);
      ctx.lineTo(18, -16);
      ctx.quadraticCurveTo(-2, -22, -22, -16);
      ctx.closePath();
      fillStroke(ctx, '#0ea5e9', 2.6);

      // Leafy crest sprout on top
      drawLeaf(ctx, -2, -23, 15, 6.2, -1.1 + sway * 0.1, '#4ade80', '#15803d', 2.4);
      drawLeaf(ctx, -3, -22, 13, 5.5, -2.1 - sway * 0.1, '#86efac', '#16a34a', 2.4);

      // Determined warrior face
      drawEye(ctx, -8, -1, 4.4, { sleeping: sleep, sclera: '#ffffff', brow: 0.28, browWidth: 3.0 });
      drawEye(ctx, 7, -1, 4.4, { sleeping: sleep, sclera: '#ffffff', brow: -0.28, browWidth: 3.0 });
      drawMouth(ctx, 0, 9, 5.8, sleep ? 'serene' : 'smirk');

      // ICONIC WATERMELON-SLICE SHIELD held in front-right!
      ctx.save();
      ctx.translate(21, 13 + sway * 1.2);
      ctx.rotate(-0.22);
      // Outer dark-green rind arc
      ctx.beginPath();
      ctx.arc(0, 0, 20, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      fillStroke(ctx, '#16a34a', 3.0);

      // White pith layer
      ctx.beginPath();
      ctx.arc(-1, 0, 16.5, -Math.PI * 0.52, Math.PI * 0.52);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fillStyle = '#dcfce7';
      ctx.fill();

      // Juicy pink-red watermelon flesh
      ctx.beginPath();
      ctx.arc(-2, 0, 14, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fillStyle = linGrad(ctx, -4, -12, 12, 12, [[0, '#fb7185'], [1, '#e11d48']]);
      ctx.fill();

      // Little black watermelon seeds on shield
      ctx.fillStyle = INK;
      [
        [4, -6, 0.3],
        [7, 0, 0],
        [4, 6, -0.3],
        [1, -2, 0.2]
      ].forEach(function (s) {
        ctx.beginPath();
        ctx.ellipse(s[0], s[1], 1.4, 2.3, s[2], 0, Math.PI * 2);
        ctx.fill();
      });

      // Shield glossy shine
      drawHighlight(ctx, 6, -7, 2.2, 4.5, 0.3, 0.5);
      ctx.restore();
    },

    // 6. MELANREI: royal watermelon king with golden seed-crown & swirling juice waves
    melanrei: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.4);

      // Royal pink-crimson splash mantle behind
      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.bezierCurveTo(-36, 0, -38, 22, -28, 32);
      ctx.lineTo(28, 32);
      ctx.bezierCurveTo(38, 22, 36, 0, 18, -12);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, -12, 0, 32, [[0, '#f43f5e'], [1, '#be123c']]), 2.9);

      // Grand striped watermelon torso
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 2, 26, 26, 0, 0, Math.PI * 2);
      ctx.fillStyle = radGrad(ctx, -8, -8, 4, 0, 2, 28, [
        [0, '#86efac'],
        [0.45, '#22c55e'],
        [1, '#14532d']
      ]);
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = '#0f3d21';
      ctx.lineWidth = 5.2;
      [-18, -6, 6, 18].forEach(function (sx) {
        ctx.beginPath();
        ctx.moveTo(sx, -26);
        ctx.bezierCurveTo(sx - 5, -4, sx + 5, 14, sx - 2, 32);
        ctx.stroke();
      });
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(0, 2, 26, 26, 0, 0, Math.PI * 2);
      setInk(ctx, 3.2);
      ctx.stroke();

      // Golden royal collar trim
      ctx.beginPath();
      ctx.moveTo(-22, -13);
      ctx.quadraticCurveTo(0, -4, 22, -13);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5.2;
      ctx.lineCap = 'round';
      ctx.stroke();
      setInk(ctx, 2.2);
      ctx.stroke();

      // Golden Crown studded with shiny watermelon-seed gems!
      ctx.save();
      ctx.translate(0, -24 + sway * 0.6);
      ctx.beginPath();
      ctx.moveTo(-16, 4);
      ctx.lineTo(-19, -12);
      ctx.lineTo(-8, -4);
      ctx.lineTo(0, -17);
      ctx.lineTo(8, -4);
      ctx.lineTo(19, -12);
      ctx.lineTo(16, 4);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -18, -16, 18, 4, [
        [0, '#fef08a'],
        [0.5, '#facc15'],
        [1, '#ca8a04']
      ]), 2.8);
      // Seed-shaped royal gems
      drawEllipse(ctx, 0, -5, 2.3, 4.2, 0, '#e11d48', 1.6);
      drawEllipse(ctx, -10, -2, 1.8, 3.2, -0.2, INK, 1.2);
      drawEllipse(ctx, 10, -2, 1.8, 3.2, 0.2, INK, 1.2);
      ctx.restore();

      // Noble regal face
      drawEye(ctx, -7, -2, 4.6, { sleeping: sleep, sclera: '#ffffff', brow: 0.18, browWidth: 3.0 });
      drawEye(ctx, 11, -2, 4.6, { sleeping: sleep, sclera: '#ffffff', brow: -0.18, browWidth: 3.0 });
      drawCheek(ctx, -14, 5, 4.2, 2.3, 'rgba(244, 63, 94, 0.5)');
      drawCheek(ctx, 17, 5, 4.2, 2.3, 'rgba(244, 63, 94, 0.5)');
      drawMouth(ctx, 2.5, 8, 6.8, sleep ? 'serene' : 'grin');

      // Swirling juice/water waves at base!
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-36, 27);
      ctx.quadraticCurveTo(-24, 15 + sway * 2.5, -12, 24);
      ctx.quadraticCurveTo(0, 14 - sway * 2.5, 13, 24);
      ctx.quadraticCurveTo(26, 15 + sway * 2.5, 36, 26);
      ctx.quadraticCurveTo(32, 38, 0, 38);
      ctx.quadraticCurveTo(-32, 38, -36, 27);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, 16, 0, 38, [
        [0, '#7dd3fc'],
        [0.45, '#0ea5e9'],
        [1, '#0369a1']
      ]), 2.8);
      // White wave foam sheen
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-26, 26);
      ctx.quadraticCurveTo(-18, 22 + sway, -10, 27);
      ctx.moveTo(4, 26);
      ctx.quadraticCurveTo(14, 21 - sway, 24, 27);
      ctx.stroke();
      ctx.restore();

      // Splashing droplets
      drawDroplet(ctx, -32, -10 - sway * 2.5, 0.65, -0.3, '#38bdf8');
      drawDroplet(ctx, 33, -8 + sway * 2.5, 0.65, 0.3, '#fb7185');
    },

    // 7. BROCOLINO: fluffy green broccoli floret head & cute pale-green stalk body/arms
    brocolino: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.1);
      const bob = Math.sin(t * 2.7) * 1.6;
      ctx.translate(0, bob);

      // Little stalk feet
      drawFoot(ctx, -8, 33, 7, 4.5, '#86efac', -0.1);
      drawFoot(ctx, 9, 33, 7, 4.5, '#86efac', 0.1);

      // Cute waving stalk arms
      drawEllipse(ctx, -18, 16, 8, 4.2, -0.55 - sway * 0.2, '#bbf7d0', 2.7);
      drawEllipse(ctx, 19, 15, 8, 4.2, 0.45 + sway * 0.2, '#bbf7d0', 2.7);

      // Plump broccoli stalk torso
      ctx.beginPath();
      ctx.moveTo(-13, -2);
      ctx.bezierCurveTo(-18, 12, -16, 30, 0, 32);
      ctx.bezierCurveTo(16, 30, 18, 12, 13, -2);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -14, 0, 14, 30, [
        [0, '#dcfce7'],
        [0.5, '#bbf7d0'],
        [1, '#86efac']
      ]), 3.1);

      // Fluffy cloud-like broccoli floret canopy!
      ctx.save();
      ctx.translate(0, -14);
      ctx.rotate(sway * 0.04);
      const puffs = [
        [-20, 4, 13],
        [20, 4, 13],
        [-13, -10, 14],
        [13, -10, 14],
        [0, -14, 15],
        [0, 3, 14]
      ];
      // Shadow/outline pass first so puffs merge into one lush cartoon cloud
      ctx.fillStyle = INK;
      for (let i = 0; i < puffs.length; i++) {
        ctx.beginPath();
        ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2] + 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Lush vibrant green gradient fill
      const canopyGrad = radGrad(ctx, -6, -12, 4, 0, -2, 34, [
        [0, '#86efac'],
        [0.42, '#22c55e'],
        [1, '#15803d']
      ]);
      ctx.fillStyle = canopyGrad;
      for (let i = 0; i < puffs.length; i++) {
        ctx.beginPath();
        ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2], 0, Math.PI * 2);
        ctx.fill();
      }
      // Subtle broccoli bud texture arcs & dots
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 2.0;
      [[-10, -4, 6], [10, -4, 6], [0, -12, 6]].forEach(function (a) {
        ctx.beginPath();
        ctx.arc(a[0], a[1], a[2], 0.2 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      });
      drawHighlight(ctx, -10, -16, 4.5, 3.2, -0.3, 0.45);
      // Tiny sprout on top
      drawLeaf(ctx, 2, -26, 10, 4.5, -0.8 + sway * 0.15, '#bbf7d0', '#22c55e', 2.2);
      ctx.restore();

      // Sweet face on the pale stalk
      drawEye(ctx, -5, 11, 4.1, { sleeping: sleep });
      drawEye(ctx, 8, 11, 4.1, { sleeping: sleep });
      drawCheek(ctx, -11, 16, 3.8, 2.2);
      drawCheek(ctx, 13, 16, 3.8, 2.2);
      drawMouth(ctx, 2, 17, 4.4, sleep ? 'serene' : 'smile');
    },

    // 8. BROCOLAO: buff muscular broccoli brawler with huge floret shoulder pads
    brocolao: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.0);

      // Sturdy brawler legs
      drawFoot(ctx, -12, 33, 9.5, 5.5, '#4ade80', -0.1);
      drawFoot(ctx, 13, 33, 9.5, 5.5, '#4ade80', 0.1);

      // Muscular wide broccoli stalk torso
      ctx.beginPath();
      ctx.moveTo(-19, -8);
      ctx.lineTo(19, -8);
      ctx.quadraticCurveTo(22, 16, 14, 31);
      ctx.lineTo(-14, 31);
      ctx.quadraticCurveTo(-22, 16, -19, -8);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -20, -6, 20, 30, [
        [0, '#dcfce7'],
        [0.45, '#86efac'],
        [1, '#4ade80']
      ]), 3.3);

      // Leafy belt
      ctx.beginPath();
      ctx.rect(-15, 20, 30, 6);
      fillStroke(ctx, '#15803d', 2.4);

      // Flexed thick stalk arms & fists
      ctx.save();
      drawEllipse(ctx, -28, 14 + sway * 1.2, 8.5, 9.5, -0.2, '#86efac', 3.0);
      drawEllipse(ctx, 29, 13 - sway * 1.2, 9, 10, 0.2, '#86efac', 3.0);
      ctx.restore();

      // HUGE bushy floret shoulder pads + heroic pompadour broccoli crown!
      const puffs = [
        [-27, -4, 13],
        [-20, -14, 12],
        [27, -4, 13],
        [20, -14, 12],
        [-10, -22, 13],
        [10, -22, 13],
        [0, -26, 14]
      ];
      ctx.fillStyle = INK;
      for (let i = 0; i < puffs.length; i++) {
        ctx.beginPath();
        ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2] + 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
      const bushGrad = radGrad(ctx, -6, -24, 5, 0, -10, 40, [
        [0, '#4ade80'],
        [0.5, '#16a34a'],
        [1, '#14532d']
      ]);
      ctx.fillStyle = bushGrad;
      for (let i = 0; i < puffs.length; i++) {
        ctx.beginPath();
        ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2], 0, Math.PI * 2);
        ctx.fill();
      }
      // Floret details
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2.0;
      [[-26, -5, 5], [26, -5, 5], [0, -24, 6]].forEach(function (a) {
        ctx.beginPath();
        ctx.arc(a[0], a[1], a[2], 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      });

      // Determined buff face
      drawEye(ctx, -6, 1, 4.3, { sleeping: sleep, sclera: '#ffffff', brow: 0.34, browWidth: 3.4 });
      drawEye(ctx, 10, 1, 4.3, { sleeping: sleep, sclera: '#ffffff', brow: -0.34, browWidth: 3.4 });
      drawMouth(ctx, 2.5, 11, 7.2, sleep ? 'serene' : 'grin');
    },

    // 9. BROCOLOSSO: ancient broccoli colossus with golden blossoms & emerald leaf shield
    brocolosso: function (ctx, t, sleep) {
      const sway = Math.sin(t * 2.2);

      // Ancient mossy root feet
      drawFoot(ctx, -14, 34, 10.5, 5.5, '#15803d', -0.08);
      drawFoot(ctx, 14, 34, 10.5, 5.5, '#166534', 0.08);

      // Massive ancient stalk trunk
      ctx.beginPath();
      ctx.moveTo(-21, -8);
      ctx.lineTo(21, -8);
      ctx.bezierCurveTo(26, 12, 22, 28, 17, 34);
      ctx.lineTo(-17, 34);
      ctx.bezierCurveTo(-22, 28, -26, 12, -21, -8);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -22, -6, 22, 34, [
        [0, '#bbf7d0'],
        [0.45, '#4ade80'],
        [1, '#166534']
      ]), 3.3);

      // Bark-like ancient stalk grooves
      ctx.strokeStyle = 'rgba(20, 83, 45, 0.45)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-12, 16);
      ctx.lineTo(-13, 30);
      ctx.moveTo(8, 18);
      ctx.lineTo(9, 30);
      ctx.stroke();

      // Massive wise canopy crown
      const puffs = [
        [-28, -10, 14],
        [28, -10, 14],
        [-18, -22, 15],
        [18, -22, 15],
        [0, -27, 16],
        [-6, -12, 14],
        [8, -12, 14]
      ];
      ctx.fillStyle = INK;
      for (let i = 0; i < puffs.length; i++) {
        ctx.beginPath();
        ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2] + 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = radGrad(ctx, -8, -26, 5, 0, -14, 42, [
        [0, '#4ade80'],
        [0.5, '#15803d'],
        [1, '#064e3b']
      ]);
      for (let i = 0; i < puffs.length; i++) {
        ctx.beginPath();
        ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2], 0, Math.PI * 2);
        ctx.fill();
      }

      // Blooming GOLDEN broccoli flowers across the ancient canopy!
      drawFlower(ctx, -18, -23 + sway * 0.5, 5.5, '#facc15', '#ea580c', 5);
      drawFlower(ctx, 2, -31 - sway * 0.5, 6.2, '#fde047', '#ea580c', 5);
      drawFlower(ctx, 21, -21 + sway * 0.5, 5.5, '#facc15', '#ea580c', 5);
      drawFlower(ctx, -27, -10, 4.5, '#fef08a', '#f59e0b', 4);

      // Wise leafy beard/collar
      ctx.beginPath();
      ctx.moveTo(-14, 13);
      ctx.lineTo(-6, 23);
      ctx.lineTo(2, 16);
      ctx.lineTo(10, 22);
      ctx.lineTo(15, 12);
      ctx.quadraticCurveTo(0, 10, -14, 13);
      ctx.closePath();
      fillStroke(ctx, '#16a34a', 2.4);

      // Calm ancient amber eyes
      drawEye(ctx, -7, 2, 4.3, { sleeping: sleep, sclera: '#fef08a', innerGlow: '#d97706', brow: 0.14, browColor: '#14532d', browWidth: 3.2 });
      drawEye(ctx, 9, 2, 4.3, { sleeping: sleep, sclera: '#fef08a', innerGlow: '#d97706', brow: -0.14, browColor: '#14532d', browWidth: 3.2 });
      drawMouth(ctx, 1.5, 11, 5.2, 'serene');

      // Huge Emerald LEAF SHIELD held on the front-right!
      ctx.save();
      ctx.translate(23, 14 + sway * 1.0);
      ctx.rotate(0.15);
      ctx.beginPath();
      ctx.moveTo(0, -19);
      ctx.bezierCurveTo(16, -12, 16, 12, 0, 21);
      ctx.bezierCurveTo(-15, 12, -15, -12, 0, -19);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -12, -16, 12, 18, [
        [0, '#4ade80'],
        [0.5, '#16a34a'],
        [1, '#14532d']
      ]), 3.0);
      // Golden leaf shield veins
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, 16);
      ctx.moveTo(0, -4);
      ctx.lineTo(8, -9);
      ctx.moveTo(0, 4);
      ctx.lineTo(-8, -1);
      ctx.moveTo(0, 8);
      ctx.lineTo(7, 4);
      ctx.stroke();
      ctx.restore();
    },

    // 10. LIMONINHO: energetic yellow Sicilian lemon with sparkling zest bolts
    limoninho: function (ctx, t, sleep) {
      const sway = Math.sin(t * 5.0);
      const bob = Math.sin(t * 3.8) * 2.0;
      ctx.translate(0, bob);

      // Electric yellow zest sparks popping around!
      drawBolt(ctx, -29, -12 + sway * 2, 0.72, -0.4, '#fde047');
      drawBolt(ctx, 30, -9 - sway * 2, 0.78, 0.45, '#facc15');
      drawStar4(ctx, 24, 19, 4.5, '#fef08a', true);

      // Bouncy little feet
      drawFoot(ctx, -9, 31, 7.2, 4.4, '#ca8a04', -0.15);
      drawFoot(ctx, 10, 31, 7.2, 4.4, '#eab308', 0.15);

      // Iconic pinched-ends Sicilian lemon silhouette (slightly jaunty tilt)
      ctx.save();
      ctx.rotate(-0.12);
      ctx.beginPath();
      ctx.moveTo(-30, 4);
      ctx.bezierCurveTo(-24, -22, 24, -22, 30, 4);
      ctx.bezierCurveTo(24, 28, -24, 28, -30, 4);
      ctx.closePath();
      const lemonGrad = radGrad(ctx, -8, -8, 3, 0, 4, 30, [
        [0, '#fef9c3'],
        [0.45, '#facc15'],
        [1, '#ca8a04']
      ]);
      fillStroke(ctx, lemonGrad, 3.2);

      // Glossy lemon peel shine + cute citrus pores
      drawHighlight(ctx, -10, -9, 7, 3.8, -0.3, 0.65);
      ctx.fillStyle = 'rgba(161, 98, 7, 0.35)';
      [[-17, 8], [-13, 13], [18, 9], [14, -7]].forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Fresh green lemon leaves on top
      drawLeaf(ctx, 1, -18, 15, 6.2, -0.55 + sway * 0.08, '#4ade80', '#15803d', 2.4);
      drawLeaf(ctx, -2, -17, 12, 5.2, -2.4 - sway * 0.08, '#86efac', '#16a34a', 2.4);

      // Energetic bright face
      drawEye(ctx, -5, 2, 4.5, { sleeping: sleep });
      drawEye(ctx, 11, 2, 4.5, { sleeping: sleep });
      drawCheek(ctx, -12, 9, 4.4, 2.5, 'rgba(251, 146, 60, 0.55)');
      drawCheek(ctx, 17, 9, 4.4, 2.5, 'rgba(251, 146, 60, 0.55)');
      drawMouth(ctx, 3.5, 9.5, 5.2, sleep ? 'serene' : 'open');
    },

    // 11. LIMOTROVAO: turbo lemon surrounded by electric arcs & cool green leaf visor
    limotrovao: function (ctx, t, sleep) {
      const sway = Math.sin(t * 6.0);
      const hover = Math.sin(t * 4.5) * 2.4;
      ctx.translate(0, hover);

      // Vibrant electric yellow aura ring & orbiting arcs!
      ctx.save();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 2, 34, sway * 0.4, sway * 0.4 + 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 2, 34, Math.PI + sway * 0.4, Math.PI + sway * 0.4 + 1.4);
      ctx.stroke();
      ctx.restore();

      drawBolt(ctx, -33, -15 + sway * 2, 0.95, -0.5, '#fef08a');
      drawBolt(ctx, 34, -14 - sway * 2, 0.95, 0.5, '#facc15');
      drawBolt(ctx, -28, 22 - sway * 2, 0.8, 0.6, '#fde047');
      drawBolt(ctx, 30, 20 + sway * 2, 0.8, -0.6, '#fef08a');

      // Aerodynamic leafy lightning-wing crest on back/top
      drawLeaf(ctx, -12, -16, 22, 7.5, -2.5 + sway * 0.1, '#4ade80', '#15803d', 2.6);
      drawLeaf(ctx, -4, -20, 20, 7.0, -1.9 - sway * 0.1, '#86efac', '#16a34a', 2.6);

      // Sleek turbo lemon body angled forward
      ctx.save();
      ctx.rotate(-0.18);
      ctx.beginPath();
      ctx.moveTo(-34, 4);
      ctx.bezierCurveTo(-24, -25, 22, -25, 34, 2);
      ctx.bezierCurveTo(22, 27, -24, 27, -34, 4);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -8, -8, 4, 0, 2, 34, [
        [0, '#ffffff'],
        [0.25, '#fef08a'],
        [0.65, '#facc15'],
        [1, '#d97706']
      ]), 3.3);

      // Racing lightning stripe along side
      ctx.beginPath();
      ctx.moveTo(-24, 9);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-11, 11);
      ctx.lineTo(14, 6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.0;
      ctx.stroke();
      ctx.restore();

      // Cool stylized GREEN LEAF VISOR / SHADES!
      ctx.save();
      ctx.translate(3, -3);
      ctx.beginPath();
      ctx.moveTo(-20, -4);
      ctx.lineTo(2, -7);
      ctx.lineTo(23, -3);
      ctx.lineTo(17, 7);
      ctx.lineTo(3, 3);
      ctx.lineTo(-14, 8);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -18, -6, 20, 8, [
        [0, '#166534'],
        [0.5, '#15803d'],
        [1, '#064e3b']
      ]), 2.8);
      // Cool bright visor specular glint
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-12, 3);
      ctx.lineTo(-5, -3);
      ctx.moveTo(6, 2);
      ctx.lineTo(13, -3);
      ctx.stroke();
      ctx.restore();

      // If sleeping, show tiny closed line below visor, else cool smirk
      drawMouth(ctx, 6, 11, 7.2, sleep ? 'serene' : 'smirk');
    },

    // 12. ABACAXIL: armored tropical pineapple with diamond scales, spiky crown & confident grin
    abacaxil: function (ctx, t, sleep) {
      const sway = Math.sin(t * 2.8);

      // Sturdy tropical feet
      drawFoot(ctx, -11, 33, 8.5, 5, '#b45309', -0.1);
      drawFoot(ctx, 11, 33, 8.5, 5, '#d97706', 0.1);

      // Spiky emerald pineapple crown (tall & jagged!)
      ctx.save();
      ctx.translate(0, -16);
      ctx.rotate(sway * 0.04);
      const fronds = [
        [-22, -4, -1.9, 20, 6],
        [22, -4, -1.2, 20, 6],
        [-13, -8, -1.75, 24, 6.5],
        [13, -8, -1.35, 24, 6.5],
        [0, -10, -1.57, 27, 7.5]
      ];
      for (let i = 0; i < fronds.length; i++) {
        const f = fronds[i];
        drawLeaf(ctx, f[0] * 0.35, 0, f[3], f[4], f[2], '#4ade80', '#15803d', 2.6);
      }
      ctx.restore();

      // Leaf-armored arms
      drawEllipse(ctx, -25, 11, 7, 5, -0.35, '#16a34a', 2.8);
      drawEllipse(ctx, 25, 11, 7, 5, 0.35, '#16a34a', 2.8);

      // Plump armored pineapple body with crisp diamond crosshatch texture
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 8, 22, 26, 0, 0, Math.PI * 2);
      ctx.fillStyle = radGrad(ctx, -8, -2, 4, 0, 8, 28, [
        [0, '#fde047'],
        [0.5, '#f59e0b'],
        [1, '#b45309']
      ]);
      ctx.fill();

      // Clipped diamond crosshatch scales!
      ctx.clip();
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.52)';
      ctx.lineWidth = 2.0;
      for (let d = -40; d <= 40; d += 11) {
        ctx.beginPath();
        ctx.moveTo(d - 24, -22);
        ctx.lineTo(d + 24, 38);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d + 24, -22);
        ctx.lineTo(d - 24, 38);
        ctx.stroke();
      }
      // Subtle center armor dots in diamonds
      ctx.fillStyle = 'rgba(120, 53, 15, 0.38)';
      for (let ry = -6; ry <= 28; ry += 11) {
        for (let rx = -14; rx <= 14; rx += 11) {
          ctx.beginPath();
          ctx.arc(rx + ((ry % 22 === 0) ? 0 : 5.5), ry, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Crisp body outline
      ctx.beginPath();
      ctx.ellipse(0, 8, 22, 26, 0, 0, Math.PI * 2);
      setInk(ctx, 3.3);
      ctx.stroke();
      drawHighlight(ctx, -10, -2, 3.8, 9, -0.25, 0.48);

      // Confident face
      drawEye(ctx, -6, 3, 4.5, { sleeping: sleep, sclera: '#ffffff', brow: 0.25, browWidth: 3.1 });
      drawEye(ctx, 10, 3, 4.5, { sleeping: sleep, sclera: '#ffffff', brow: -0.25, browWidth: 3.1 });
      drawMouth(ctx, 2.5, 14, 7.0, sleep ? 'serene' : 'grin');
    },

    // 13. CENOURITO: bouncy orange carrot with feathery green top tuft & cute little paws
    cenourito: function (ctx, t, sleep) {
      const sway = Math.sin(t * 4.2);
      const hop = Math.abs(Math.sin(t * 3.2)) * -4.2;
      ctx.translate(0, hop);

      // Feathery bouncy green carrot-top leaves!
      ctx.save();
      ctx.translate(0, -18);
      ctx.rotate(sway * 0.12);
      drawLeaf(ctx, 0, 2, 19, 5.5, -2.25, '#86efac', '#16a34a', 2.4);
      drawLeaf(ctx, 0, 2, 23, 6.2, -1.57, '#4ade80', '#15803d', 2.5);
      drawLeaf(ctx, 0, 2, 19, 5.5, -0.9, '#86efac', '#16a34a', 2.4);
      ctx.restore();

      // Cute hopping little root paws
      drawFoot(ctx, -9, 30, 6.5, 4.2, '#ea580c', -0.35 + sway * 0.15);
      drawFoot(ctx, 10, 29, 6.5, 4.2, '#f97316', 0.35 - sway * 0.15);

      // Tiny eager side paws
      drawEllipse(ctx, -19, 5, 5.5, 3.5, -0.5, '#fb923c', 2.6);
      drawEllipse(ctx, 20, 4, 5.5, 3.5, 0.5, '#fb923c', 2.6);

      // Tapered glossy orange carrot body
      ctx.beginPath();
      ctx.moveTo(-19, -11);
      ctx.quadraticCurveTo(0, -22, 19, -11);
      ctx.bezierCurveTo(22, 5, 11, 27, 0, 34);
      ctx.bezierCurveTo(-11, 27, -22, 5, -19, -11);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -6, -8, 3, 0, 8, 32, [
        [0, '#fed7aa'],
        [0.32, '#fb923c'],
        [0.75, '#f97316'],
        [1, '#c2410c']
      ]), 3.2);

      // Classic horizontal carrot ridge marks
      ctx.strokeStyle = 'rgba(154, 52, 18, 0.45)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.lineTo(-7, 11);
      ctx.moveTo(8, 16);
      ctx.lineTo(13, 15);
      ctx.moveTo(-8, 22);
      ctx.lineTo(-2, 23);
      ctx.stroke();

      drawHighlight(ctx, -10, -4, 3.4, 8.5, -0.2, 0.55);

      // Cheerful curious face
      drawEye(ctx, -5, -2, 4.4, { sleeping: sleep });
      drawEye(ctx, 9, -2, 4.4, { sleeping: sleep });
      drawCheek(ctx, -12, 4, 4.0, 2.3);
      drawCheek(ctx, 15, 4, 4.0, 2.3);
      drawMouth(ctx, 2.5, 5, 4.8, sleep ? 'serene' : 'open');
    },

    // 14. CENOURACO: athletic drill-carrot with root-claw gauntlets & blazing green leaf crest
    cenouraco: function (ctx, t, sleep) {
      const sway = Math.sin(t * 4.5);

      // Wild flame-shaped green leaf crest shooting upward!
      ctx.save();
      ctx.translate(-2, -18);
      ctx.rotate(sway * 0.08);
      drawLeaf(ctx, -4, 2, 22, 6.8, -2.35, '#86efac', '#15803d', 2.5);
      drawLeaf(ctx, 0, 2, 28, 8.2, -1.7, '#4ade80', '#166534', 2.6);
      drawLeaf(ctx, 4, 2, 24, 7.2, -1.1, '#86efac', '#15803d', 2.5);
      drawLeaf(ctx, 8, 2, 18, 5.5, -0.65, '#bbf7d0', '#16a34a', 2.3);
      ctx.restore();

      // Athletic dynamic drill-carrot body
      ctx.beginPath();
      ctx.moveTo(-22, -12);
      ctx.quadraticCurveTo(0, -24, 22, -12);
      ctx.bezierCurveTo(25, 4, 14, 26, 0, 38);
      ctx.bezierCurveTo(-14, 26, -25, 4, -22, -12);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -20, -14, 18, 34, [
        [0, '#fdba74'],
        [0.45, '#f97316'],
        [1, '#9a3412']
      ]), 3.3);

      // Spiral drill-groove lines toward the pointed root drill tip!
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-16, 12);
      ctx.quadraticCurveTo(0, 18, 16, 11);
      ctx.moveTo(-11, 21);
      ctx.quadraticCurveTo(0, 26, 11, 20);
      ctx.moveTo(-6, 29);
      ctx.quadraticCurveTo(0, 32, 6, 28);
      ctx.stroke();

      // Fierce ROOT-CLAW GAUNTLETS on both sides!
      function drawClawArm(cx, cy, dir) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(dir, 1);
        drawEllipse(ctx, 0, 0, 8, 6.2, 0.2, '#ea580c', 2.8);
        // 3 sharp earthy-cream digging claws
        ctx.fillStyle = '#fef3c7';
        setInk(ctx, 2.3);
        for (let c = -1; c <= 1; c++) {
          ctx.beginPath();
          ctx.moveTo(4, c * 4 - 2);
          ctx.lineTo(15, c * 4.8);
          ctx.lineTo(4, c * 4 + 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      drawClawArm(-22, 6 - sway * 1.5, -1);
      drawClawArm(23, 5 + sway * 1.5, 1);

      // Sharp athletic face
      drawEye(ctx, -6, -4, 4.4, { sleeping: sleep, sclera: '#ffffff', brow: 0.36, browWidth: 3.3 });
      drawEye(ctx, 10, -4, 4.4, { sleeping: sleep, sclera: '#ffffff', brow: -0.36, browWidth: 3.3 });
      drawMouth(ctx, 3, 5.5, 6.8, sleep ? 'serene' : 'grin');
    },

    // 15. BATATAO: giant round friendly potato tank with cute green sprouts & serene smile
    batatao: function (ctx, t, sleep) {
      const sway = Math.sin(t * 2.2);
      const breathe = Math.sin(t * 2.0) * 0.025;
      ctx.scale(1 + breathe, 1 - breathe);

      // Chunky grounded feet
      drawFoot(ctx, -16, 33, 10, 5.5, '#78350f', -0.08);
      drawFoot(ctx, 16, 33, 10, 5.5, '#92400e', 0.08);

      // Cute potato sprouts on top & side
      ctx.save();
      ctx.translate(-5, -24);
      ctx.rotate(sway * 0.1);
      setInk(ctx, 3.0);
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(-2, -8, 2, -13);
      ctx.stroke();
      drawLeaf(ctx, 1, -11, 12, 5.2, -0.6, '#86efac', '#16a34a', 2.3);
      drawLeaf(ctx, 0, -9, 10, 4.6, -2.5, '#4ade80', '#15803d', 2.3);
      ctx.restore();

      // Side tiny sprout
      drawLeaf(ctx, -29, -4, 10, 4.2, -2.6 - sway * 0.1, '#86efac', '#16a34a', 2.2);

      // Giant chubby bumpy potato body!
      ctx.beginPath();
      ctx.moveTo(-31, 6);
      ctx.bezierCurveTo(-34, -18, -14, -29, 3, -27);
      ctx.bezierCurveTo(22, -25, 34, -12, 33, 8);
      ctx.bezierCurveTo(32, 28, 17, 35, 0, 35);
      ctx.bezierCurveTo(-19, 35, -30, 26, -31, 6);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -10, -10, 5, 0, 6, 38, [
        [0, '#f5deb3'],
        [0.48, '#d4a36a'],
        [1, '#925d2d']
      ]), 3.4);

      // Cozy potato spots & dimples
      ctx.fillStyle = 'rgba(120, 53, 15, 0.24)';
      drawEllipse(ctx, -20, 14, 5.2, 3.4, 0.3, 'rgba(120, 53, 15, 0.24)', 0);
      drawEllipse(ctx, 21, -8, 4.2, 2.8, -0.2, 'rgba(120, 53, 15, 0.24)', 0);
      drawEllipse(ctx, 17, 22, 4.8, 3.0, 0.15, 'rgba(120, 53, 15, 0.24)', 0);
      drawHighlight(ctx, -14, -12, 7.5, 4.5, -0.35, 0.45);

      // Relaxed stubby potato arms
      drawEllipse(ctx, -29, 12, 6.5, 4.5, -0.4, '#c48f56', 2.7);
      drawEllipse(ctx, 30, 12, 6.5, 4.5, 0.4, '#c48f56', 2.7);

      // Serene friendly gentle-giant face!
      drawEye(ctx, -8, 2, 4.5, { sleeping: sleep, happy: !sleep && false });
      drawEye(ctx, 11, 2, 4.5, { sleeping: sleep });
      // Soft peaceful gentle brows
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(-8, -4.5, 4.5, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(11, -4.5, 4.5, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();

      drawCheek(ctx, -16, 9, 5.2, 2.8, 'rgba(244, 114, 182, 0.42)');
      drawCheek(ctx, 19, 9, 5.2, 2.8, 'rgba(244, 114, 182, 0.42)');
      drawMouth(ctx, 2, 11, 6.5, 'serene');
    },

    // 16. COGUMIM: adorable red-capped mushroom with white polka dots & curious eyes
    cogumim: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.4);
      const bob = Math.sin(t * 2.9) * 1.8;
      ctx.translate(0, bob);

      // Little cream feet
      drawFoot(ctx, -8, 33, 6.8, 4.2, '#fde68a', -0.1);
      drawFoot(ctx, 9, 33, 6.8, 4.2, '#fde68a', 0.1);

      // Tiny waving stem nubs
      drawEllipse(ctx, -16, 17, 5.5, 3.6, -0.45 - sway * 0.2, '#fef3c7', 2.6);
      drawEllipse(ctx, 17, 17, 5.5, 3.6, 0.45 + sway * 0.2, '#fef3c7', 2.6);

      // Plump creamy-beige stem body
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.bezierCurveTo(-18, 16, -15, 32, 0, 33);
      ctx.bezierCurveTo(15, 32, 18, 16, 14, 0);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -4, 10, 3, 0, 16, 22, [
        [0, '#fffbeb'],
        [0.6, '#fef3c7'],
        [1, '#e7d5a8']
      ]), 3.1);

      // Underside cream mushroom gills peeking beneath cap
      drawEllipse(ctx, 0, 0, 26, 7.5, 0, '#f5e6c4', 2.8);

      // Big charming RED MUSHROOM CAP with white spots!
      ctx.save();
      ctx.rotate(sway * 0.045);
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.bezierCurveTo(-32, -26, -14, -36, 0, -36);
      ctx.bezierCurveTo(14, -36, 32, -26, 30, 0);
      ctx.quadraticCurveTo(0, -6, -30, 0);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -8, -22, 4, 0, -14, 34, [
        [0, '#fca5a5'],
        [0.35, '#ef4444'],
        [1, '#b91c1c']
      ]), 3.3);

      // Cute creamy-white mushroom polka dots!
      drawCircle(ctx, -14, -14, 5.2, '#fffdf5', 2.0);
      drawCircle(ctx, 4, -22, 6.0, '#fffdf5', 2.0);
      drawCircle(ctx, 18, -11, 4.6, '#fffdf5', 2.0);
      drawCircle(ctx, -2, -8, 3.5, '#fffdf5', 1.8);
      drawHighlight(ctx, -16, -24, 5.0, 2.8, -0.45, 0.5);
      ctx.restore();

      // Big wide curious eyes on stem
      drawEye(ctx, -5, 13, 4.5, { sleeping: sleep });
      drawEye(ctx, 8, 13, 4.5, { sleeping: sleep });
      drawCheek(ctx, -11, 18.5, 3.8, 2.2);
      drawCheek(ctx, 13, 18.5, 3.8, 2.2);
      drawMouth(ctx, 2, 19.5, 4.0, sleep ? 'serene' : 'o');
    },

    // 17. COGUMAGO: mystic wizard mushroom with pointed purple-magenta hat & spore staff
    cogumago: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.0);
      const bob = Math.sin(t * 2.5) * 1.5;
      ctx.translate(0, bob);

      // Drifting glowing spore motes
      drawCircle(ctx, -31, -14 + sway * 3, 2.8, '#f0abfc', 1.5);
      drawCircle(ctx, 31, -22 - sway * 3, 3.2, '#e879f9', 1.5);
      drawStar4(ctx, -25, 16 - sway * 2, 4.2, '#fef08a', false);

      // Robed mystic fungal body
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.bezierCurveTo(-20, 16, -22, 32, -14, 35);
      ctx.quadraticCurveTo(0, 38, 15, 35);
      ctx.bezierCurveTo(22, 32, 20, 16, 14, 0);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, 0, 0, 0, 36, [
        [0, '#f5f3ff'],
        [0.4, '#ddd6fe'],
        [1, '#7c3aed']
      ]), 3.1);

      // Golden mystic robe trim
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-15, 30);
      ctx.quadraticCurveTo(0, 34, 15, 30);
      ctx.stroke();

      // Underside mystic violet gills
      drawEllipse(ctx, 0, 0, 27, 7.2, 0, '#581c87', 2.8);

      // Tall POINTED WIZARD-HAT MUSHROOM CAP!
      ctx.save();
      ctx.rotate(sway * 0.04);
      ctx.beginPath();
      ctx.moveTo(-31, 1);
      ctx.bezierCurveTo(-28, -14, -15, -24, -6, -34);
      ctx.quadraticCurveTo(2, -45, 16, -38); // Curled wizard tip!
      ctx.quadraticCurveTo(10, -29, 14, -22);
      ctx.bezierCurveTo(24, -15, 30, -7, 31, 1);
      ctx.quadraticCurveTo(0, -6, -31, 1);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -18, -36, 18, 2, [
        [0, '#f0abfc'],
        [0.4, '#c026d3'],
        [0.8, '#7e22ce'],
        [1, '#4c1d95']
      ]), 3.2);

      // Glowing lavender-gold spots & hat band
      drawCircle(ctx, -13, -11, 4.4, '#f5d0fe', 1.8);
      drawCircle(ctx, 2, -23, 4.8, '#fde047', 1.8);
      drawCircle(ctx, 16, -9, 3.8, '#f5d0fe', 1.8);
      ctx.restore();

      // Wise glowing golden eyes peering beneath cap
      drawEye(ctx, -5, 11, 4.2, { sleeping: sleep, iris: '#4c1d95', sclera: '#fef08a', innerGlow: '#facc15' });
      drawEye(ctx, 8, 11, 4.2, { sleeping: sleep, iris: '#4c1d95', sclera: '#fef08a', innerGlow: '#facc15' });
      drawMouth(ctx, 2, 19, 4.4, 'serene');

      // SPORE STAFF held on the right!
      ctx.save();
      ctx.translate(25, 8 + sway * 1.4);
      ctx.rotate(0.14);
      // Gnarly wooden staff shaft
      setInk(ctx, 6.2);
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(-2, 4, 2, 26);
      ctx.stroke();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 3.0;
      ctx.stroke();
      // Glowing violet spore orb at tip!
      drawCircle(ctx, 0, -20, 7.5, radGrad(ctx, -2, -22, 1, 0, -20, 8, [
        [0, '#ffffff'],
        [0.45, '#f0abfc'],
        [1, '#9333ea']
      ]), 2.4);
      drawStar4(ctx, 5, -27, 4.0, '#fef08a', false);
      ctx.restore();
    },

    // 18. BERINJELUX: mystical glossy purple eggplant with petal collar & starry aura
    berinjelux: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.0);
      const hover = Math.sin(t * 2.5) * 2.4;
      ctx.translate(0, hover);

      // Starry twinkling aura behind!
      drawStar4(ctx, -32, -16 + sway * 2, 6.2, '#fef08a', true);
      drawStar4(ctx, 31, -12 - sway * 2, 5.5, '#e9d5ff', true);
      drawStar4(ctx, -28, 20 - sway * 2, 4.6, '#f0abfc', false);
      drawStar4(ctx, 29, 18 + sway * 2, 5.0, '#fef08a', true);

      // Plump pear-shaped mystical glossy eggplant body
      ctx.beginPath();
      ctx.moveTo(-2, -22);
      ctx.bezierCurveTo(14, -22, 20, -6, 25, 10);
      ctx.bezierCurveTo(28, 26, 15, 35, 0, 35);
      ctx.bezierCurveTo(-16, 35, -27, 25, -24, 9);
      ctx.bezierCurveTo(-21, -7, -14, -22, -2, -22);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -9, -4, 3, 0, 12, 34, [
        [0, '#d8b4fe'],
        [0.35, '#9333ea'],
        [0.78, '#581c87'],
        [1, '#3b0764']
      ]), 3.3);

      // Lustrous glossy eggplant specular shine
      drawHighlight(ctx, -12, 7, 4.5, 12, -0.25, 0.55);

      // Ruffled green & lavender PETAL COLLAR around top!
      const petals = [
        [-18, -11, -2.5],
        [-10, -15, -1.9],
        [0, -16, -1.57],
        [10, -15, -1.2],
        [18, -11, -0.6]
      ];
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        drawLeaf(ctx, p[0] * 0.5, -15, 15, 6.2, p[2] + Math.PI, '#c084fc', '#16a34a', 2.4);
      }

      // Eggplant green crown cap + curly purple-green stem
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.quadraticCurveTo(0, -28, 14, -18);
      ctx.quadraticCurveTo(0, -12, -14, -18);
      ctx.closePath();
      fillStroke(ctx, '#16a34a', 2.7);

      ctx.save();
      ctx.translate(0, -23);
      ctx.rotate(sway * 0.1);
      setInk(ctx, 5.2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-5, -9, 4, -13);
      ctx.stroke();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();

      // Golden gem medallion at center of petal collar
      drawCircle(ctx, 1, -8, 4.0, '#facc15', 2.0);

      // Expressive dreamy mystic eyes
      drawEye(ctx, -6, 6, 4.6, { sleeping: sleep, iris: '#2e1065', sclera: '#fef9c3', innerGlow: '#c084fc' });
      drawEye(ctx, 11, 6, 4.6, { sleeping: sleep, iris: '#2e1065', sclera: '#fef9c3', innerGlow: '#c084fc' });
      drawCheek(ctx, -13, 13, 4.2, 2.3, 'rgba(232, 121, 249, 0.5)');
      drawCheek(ctx, 17, 13, 4.2, 2.3, 'rgba(232, 121, 249, 0.5)');
      drawMouth(ctx, 3, 15, 5.0, 'serene');
    },

    // 19. MORANGELO: plump juicy crimson strawberry with golden seeds, leaf crown & sparkles
    morangelo: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.5);
      const bob = Math.sin(t * 3.0) * 1.8;
      ctx.translate(0, bob);

      // Sweet sparkles
      drawStar4(ctx, -28, -12 + sway * 2, 5.2, '#fef08a', true);
      drawStar4(ctx, 29, -8 - sway * 2, 4.6, '#ffffff', true);

      // Cute tiny pink-red feet
      drawFoot(ctx, -8, 32, 6.5, 4.2, '#be123c', -0.1);
      drawFoot(ctx, 9, 32, 6.5, 4.2, '#e11d48', 0.1);

      // Plump heart-shaped juicy strawberry body!
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.bezierCurveTo(24, -22, 30, 0, 21, 18);
      ctx.bezierCurveTo(14, 30, 4, 35, 0, 35);
      ctx.bezierCurveTo(-4, 35, -14, 30, -21, 18);
      ctx.bezierCurveTo(-30, 0, -24, -22, 0, -18);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -8, -8, 3, 0, 8, 34, [
        [0, '#fda4af'],
        [0.35, '#f43f5e'],
        [0.78, '#e11d48'],
        [1, '#9f1239']
      ]), 3.2);

      // Glossy berry shine
      drawHighlight(ctx, -13, -4, 4.0, 8.5, -0.35, 0.62);

      // Cute GOLDEN strawberry seeds!
      const seeds = [
        [-16, 10], [-11, 21], [0, 26], [13, 20], [18, 9],
        [-17, -4], [18, -3], [5, 19]
      ];
      for (let i = 0; i < seeds.length; i++) {
        drawEllipse(ctx, seeds[i][0], seeds[i][1], 1.7, 2.6, 0, '#fde047', 1.2);
      }

      // Starburst emerald-green leafy strawberry crown!
      ctx.save();
      ctx.translate(0, -18);
      ctx.rotate(sway * 0.06);
      drawLeaf(ctx, 0, 0, 18, 6.0, -2.85, '#4ade80', '#15803d', 2.4);
      drawLeaf(ctx, 0, 0, 17, 6.0, -2.1, '#86efac', '#16a34a', 2.4);
      drawLeaf(ctx, 0, 0, 17, 6.0, -1.0, '#86efac', '#16a34a', 2.4);
      drawLeaf(ctx, 0, 0, 18, 6.0, -0.25, '#4ade80', '#15803d', 2.4);
      drawLeaf(ctx, 0, 0, 14, 5.2, 1.57, '#4ade80', '#15803d', 2.3);
      // Little berry stem
      setInk(ctx, 4.6);
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(2, -10, 6, -13);
      ctx.stroke();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();

      // Sweet adorable face
      drawEye(ctx, -6, 3, 4.6, { sleeping: sleep });
      drawEye(ctx, 10, 3, 4.6, { sleeping: sleep });
      drawCheek(ctx, -13, 10, 4.2, 2.4, 'rgba(255, 228, 230, 0.55)');
      drawCheek(ctx, 16, 10, 4.2, 2.4, 'rgba(255, 228, 230, 0.55)');
      drawMouth(ctx, 2.5, 10.5, 4.8, sleep ? 'serene' : 'smile');
    },

    // 20. ALHINO: brave cream-white garlic bulb with fluttering green leaf headband!
    alhino: function (ctx, t, sleep) {
      const sway = Math.sin(t * 4.8);
      const bob = Math.sin(t * 3.0) * 1.5;
      ctx.translate(0, bob);

      // Fluttering leaf-headband ribbon tails streaming behind on the left!
      drawLeaf(ctx, -17, -11, 20, 4.8, -2.85 + sway * 0.18, '#4ade80', '#15803d', 2.4);
      drawLeaf(ctx, -17, -9, 17, 4.2, 2.95 - sway * 0.16, '#86efac', '#16a34a', 2.4);

      // Little earthy root-fringe feet
      drawFoot(ctx, -9, 32, 7.5, 4.5, '#d6c5a8', -0.1);
      drawFoot(ctx, 10, 32, 7.5, 4.5, '#d6c5a8', 0.1);

      // Determined tiny fists
      drawEllipse(ctx, -23, 12, 6, 4.5, -0.3, '#f5ebd6', 2.7);
      drawEllipse(ctx, 24, 11, 6.2, 4.6, 0.25, '#f5ebd6', 2.7);

      // Plump segmented cream-white GARLIC BULB silhouette!
      ctx.beginPath();
      ctx.moveTo(0, -34); // Pointed garlic top!
      ctx.bezierCurveTo(6, -22, 16, -16, 23, -4);
      ctx.bezierCurveTo(30, 12, 22, 31, 0, 32);
      ctx.bezierCurveTo(-22, 31, -30, 12, -23, -4);
      ctx.bezierCurveTo(-16, -16, -6, -22, 0, -34);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -8, -4, 4, 0, 8, 32, [
        [0, '#ffffff'],
        [0.52, '#fef9e7'],
        [1, '#d6c3a5']
      ]), 3.3);

      // Characteristic vertical garlic clove crease lines
      ctx.strokeStyle = 'rgba(148, 124, 96, 0.5)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-12, -13);
      ctx.quadraticCurveTo(-19, 8, -11, 29);
      ctx.moveTo(12, -13);
      ctx.quadraticCurveTo(19, 8, 11, 29);
      ctx.stroke();

      // Brave GREEN LEAF HEADBAND tied across forehead!
      ctx.beginPath();
      ctx.moveTo(-22, -6);
      ctx.quadraticCurveTo(0, -12, 22, -6);
      ctx.lineTo(19, -13);
      ctx.quadraticCurveTo(0, -19, -19, -13);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -20, -14, 20, -8, [[0, '#4ade80'], [1, '#15803d']]), 2.6);

      // Brave little fierce-cute face!
      drawEye(ctx, -5, 5, 4.4, { sleeping: sleep, brow: 0.34, browWidth: 3.1 });
      drawEye(ctx, 10, 5, 4.4, { sleeping: sleep, brow: -0.34, browWidth: 3.1 });
      drawCheek(ctx, -13, 12, 4.0, 2.2);
      drawCheek(ctx, 16, 12, 4.0, 2.2);
      drawMouth(ctx, 3, 13.5, 5.8, sleep ? 'serene' : 'grin');
    },

    // 21. CACTOLINO: cute rounded green cactus with bright pink flower on head & stylized spines
    cactolino: function (ctx, t, sleep) {
      const sway = Math.sin(t * 2.9);
      const bob = Math.sin(t * 2.4) * 1.3;
      ctx.translate(0, bob);

      // Cute raised cactus arms (classic saguaro style!)
      ctx.save();
      // Left arm
      ctx.beginPath();
      ctx.moveTo(-17, 12);
      ctx.quadraticCurveTo(-30, 12, -30, 0);
      ctx.quadraticCurveTo(-30, -10, -23, -10);
      ctx.quadraticCurveTo(-17, -10, -17, 0);
      ctx.closePath();
      fillStroke(ctx, '#16a34a', 3.0);

      // Right arm
      ctx.beginPath();
      ctx.moveTo(17, 8);
      ctx.quadraticCurveTo(30, 8, 30, -4);
      ctx.quadraticCurveTo(30, -14, 23, -14);
      ctx.quadraticCurveTo(17, -14, 17, -4);
      ctx.closePath();
      fillStroke(ctx, '#22c55e', 3.0);
      ctx.restore();

      // Rounded little cactus base/feet
      drawFoot(ctx, -9, 32, 7.5, 4.5, '#15803d', -0.08);
      drawFoot(ctx, 10, 32, 7.5, 4.5, '#15803d', 0.08);

      // Plump rounded cactus body
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-20, -21, 40, 53, 20) : (function () {
        ctx.ellipse(0, 5, 20, 27, 0, 0, Math.PI * 2);
      })();
      fillStroke(ctx, radGrad(ctx, -7, -6, 4, 0, 6, 30, [
        [0, '#86efac'],
        [0.45, '#22c55e'],
        [1, '#15803d']
      ]), 3.3);

      // Vertical cactus ribs
      ctx.strokeStyle = 'rgba(20, 83, 45, 0.45)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.quadraticCurveTo(-13, 6, -9, 29);
      ctx.moveTo(9, -18);
      ctx.quadraticCurveTo(13, 6, 9, 29);
      ctx.stroke();

      // Cute stylized cream-yellow spines along edges
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      const spines = [
        [-21, -8, -25, -10], [-21, 18, -25, 19],
        [21, -12, 25, -14], [21, 18, 25, 19],
        [-30, -4, -34, -6], [30, -8, 34, -10]
      ];
      for (let i = 0; i < spines.length; i++) {
        ctx.beginPath();
        ctx.moveTo(spines[i][0], spines[i][1]);
        ctx.lineTo(spines[i][2], spines[i][3]);
        ctx.stroke();
      }

      // Gorgeous blooming BRIGHT PINK CACTUS FLOWER on head!
      ctx.save();
      ctx.translate(2, -25);
      ctx.rotate(sway * 0.08);
      drawFlower(ctx, 0, 0, 10.5, '#f472b6', '#facc15', 5);
      ctx.restore();

      // Super cheerful friendly face
      drawEye(ctx, -5, 1, 4.4, { sleeping: sleep });
      drawEye(ctx, 9, 1, 4.4, { sleeping: sleep });
      drawCheek(ctx, -12, 8, 4.2, 2.4);
      drawCheek(ctx, 15, 8, 4.2, 2.4);
      drawMouth(ctx, 2.5, 9, 5.2, sleep ? 'serene' : 'open');
    },

    // 22. BETERRABOSS: imposing royal wine-magenta beetroot with leaf crown & majestic mustache!
    beterraboss: function (ctx, t, sleep) {
      const sway = Math.sin(t * 2.5);

      // Magnificent ROYAL CROWN OF SWEEPING BEET LEAVES (deep green with crimson veins!)
      ctx.save();
      ctx.translate(0, -17);
      ctx.rotate(sway * 0.04);
      const leaves = [
        [-10, 0, 26, 8.2, -2.35],
        [-3, 0, 30, 9.0, -1.85],
        [3, 0, 30, 9.0, -1.28],
        [10, 0, 26, 8.2, -0.78]
      ];
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        drawLeaf(ctx, l[0], l[1], l[2], l[3], l[4], '#22c55e', '#14532d', 2.7);
        // Crimson beet-leaf central vein!
        ctx.save();
        ctx.translate(l[0], l[1]);
        ctx.rotate(l[4]);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(3, 0);
        ctx.lineTo(l[2] * 0.78, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Golden royal headband/crown ring at leaf base
      ctx.beginPath();
      ctx.moveTo(-16, -15);
      ctx.lineTo(-14, -24);
      ctx.lineTo(-6, -19);
      ctx.lineTo(0, -26);
      ctx.lineTo(6, -19);
      ctx.lineTo(14, -24);
      ctx.lineTo(16, -15);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -16, -24, 16, -14, [[0, '#fef08a'], [0.5, '#facc15'], [1, '#b45309']]), 2.6);
      drawCircle(ctx, 0, -19, 2.8, '#e11d48', 1.4);

      // Commanding root arms
      drawEllipse(ctx, -28, 8, 8.5, 6.0, -0.3, '#881337', 3.0);
      drawEllipse(ctx, 28, 8, 8.5, 6.0, 0.3, '#9f1239', 3.0);

      // Imposing regal wine-magenta BEETROOT body with tapered royal root tip!
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.bezierCurveTo(24, -18, 30, 0, 25, 16);
      ctx.bezierCurveTo(20, 28, 6, 33, 0, 39); // Pointed beet taproot!
      ctx.bezierCurveTo(-6, 33, -20, 28, -25, 16);
      ctx.bezierCurveTo(-30, 0, -24, -18, 0, -18);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -9, -4, 4, 0, 10, 36, [
        [0, '#f472b6'],
        [0.32, '#be185d'],
        [0.72, '#881337'],
        [1, '#4c0519']
      ]), 3.4);

      drawHighlight(ctx, -13, -3, 4.2, 10, -0.3, 0.45);

      // Grand royal eyes & thick bushy eyebrows!
      drawEye(ctx, -7, -1, 4.6, { sleeping: sleep, sclera: '#fef9c3', innerGlow: '#fb7185', brow: 0.28, browColor: '#fef08a', browWidth: 3.8 });
      drawEye(ctx, 11, -1, 4.6, { sleeping: sleep, sclera: '#fef9c3', innerGlow: '#fb7185', brow: -0.28, browColor: '#fef08a', browWidth: 3.8 });

      // MAJESTIC CURLING ROOT-MUSTACHE! (Instant unforgettable boss look!)
      ctx.save();
      ctx.translate(2, 9);
      ctx.beginPath();
      // Left handlebar curl
      ctx.moveTo(0, -1);
      ctx.bezierCurveTo(-8, -6, -20, -2, -22, 4);
      ctx.bezierCurveTo(-24, 9, -15, 11, -12, 6);
      ctx.quadraticCurveTo(-6, 4, 0, 3);
      // Right handlebar curl
      ctx.quadraticCurveTo(6, 4, 12, 6);
      ctx.bezierCurveTo(15, 11, 24, 9, 22, 4);
      ctx.bezierCurveTo(20, -2, 8, -6, 0, -1);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -20, 0, 20, 6, [
        [0, '#fce7f3'],
        [0.5, '#fbcfe8'],
        [1, '#f9a8d4']
      ]), 2.6);
      ctx.restore();

      // Confident boss smile beneath mustache
      drawMouth(ctx, 2, 17, 5.2, sleep ? 'serene' : 'smirk');
    }
  };

  // =========================================================================
  // NOVAS ESPÉCIES — POMAR TROPICAL E HORTA SUBTERRÂNEA (23..30)
  // =========================================================================
  Object.assign(SPECIES_DRAWERS, {
    // 23. BANANINJA: banana curvinha com faixa ninja vermelha
    bananinja: function (ctx, t, sleep) {
      const sway = Math.sin(t * 5.2);
      const bob = Math.sin(t * 4.0) * 1.8;
      ctx.translate(0, bob);

      // Fitas da faixa ninja tremulando para trás
      ctx.save();
      ctx.translate(-20, -17);
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(-10, -8 + sway * 3, -22, -6 + sway * 4);
      ctx.lineTo(-20, 0 + sway * 4);
      ctx.quadraticCurveTo(-10, -2 + sway * 2, 0, 3);
      ctx.closePath();
      fillStroke(ctx, '#ef4444', 2.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-8, 4 - sway * 2, -18, 10 - sway * 3);
      ctx.lineTo(-14, 14 - sway * 3);
      ctx.quadraticCurveTo(-6, 7, 1, 4);
      ctx.closePath();
      fillStroke(ctx, '#dc2626', 2.4);
      ctx.restore();

      // Pezinhos
      drawFoot(ctx, -13, 32, 6.4, 4, '#a16207', -0.2);
      drawFoot(ctx, 5, 32, 6.4, 4, '#ca8a04', 0.2);

      // Corpo de banana (curva, lado de dentro côncavo)
      ctx.beginPath();
      ctx.moveTo(-2, -34);
      ctx.bezierCurveTo(-24, -24, -28, 12, -10, 30);
      ctx.quadraticCurveTo(0, 36, 12, 29);
      ctx.bezierCurveTo(2, 14, 4, -14, 7, -33);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -24, 0, 10, 0, [
        [0, '#ca8a04'],
        [0.35, '#facc15'],
        [0.75, '#fde047'],
        [1, '#eab308']
      ]), 3.2);
      // Linhas da casca
      ctx.strokeStyle = 'rgba(161, 98, 7, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-1, -30);
      ctx.bezierCurveTo(-14, -18, -16, 10, -4, 28);
      ctx.stroke();
      drawHighlight(ctx, -16, -8, 3, 9, 0.1, 0.5);

      // Cabinho e pontinha marrom
      ctx.beginPath();
      ctx.moveTo(-1, -33);
      ctx.lineTo(1, -41);
      ctx.lineTo(7, -40);
      ctx.lineTo(6, -32);
      ctx.closePath();
      fillStroke(ctx, '#78350f', 2.4);
      drawEllipse(ctx, 2, 31, 3.4, 2.4, 0, '#78350f', 2);

      // Bracinhos
      drawEllipse(ctx, -24, 6, 5, 3.4, -0.6, '#facc15', 2.4);
      drawEllipse(ctx, 9, 4, 4.6, 3.2, 0.6, '#facc15', 2.4);

      // Faixa na testa
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-21, -21);
      ctx.quadraticCurveTo(-8, -24, 5, -21);
      ctx.lineTo(4, -13);
      ctx.quadraticCurveTo(-8, -16, -22, -13);
      ctx.closePath();
      fillStroke(ctx, '#ef4444', 2.4);
      drawCircle(ctx, -8, -17.5, 2.6, '#e5e7eb', 1.6);
      ctx.restore();

      // Rosto determinado
      drawEye(ctx, -14, -5, 3.8, { sleeping: sleep, brow: 0.35 });
      drawEye(ctx, -2, -5, 3.8, { sleeping: sleep, brow: -0.35 });
      drawCheek(ctx, -19, 3, 3.4, 2, 'rgba(251, 146, 60, 0.55)');
      drawMouth(ctx, -8, 5, 4, sleep ? 'serene' : 'smirk');
    },

    // 24. ABACATINHO: meio abacate fofo com caroço na barriga
    abacatinho: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.4);
      const roll = Math.sin(t * 2.6) * 0.05;
      ctx.rotate(roll);

      drawFoot(ctx, -11, 31, 7, 4.2, '#365314', -0.2);
      drawFoot(ctx, 11, 31, 7, 4.2, '#3f6212', 0.2);

      // Casca (formato de pera)
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.bezierCurveTo(15, -32, 19, -12, 23, 6);
      ctx.bezierCurveTo(29, 31, -29, 31, -23, 6);
      ctx.bezierCurveTo(-19, -12, -15, -32, 0, -32);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -24, 0, 24, 0, [[0, '#365314'], [0.5, '#4d7c0f'], [1, '#3f6212']]), 3.2);

      // Polpa clarinha
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.bezierCurveTo(11, -25, 14, -10, 17, 6);
      ctx.bezierCurveTo(22, 25, -22, 25, -17, 6);
      ctx.bezierCurveTo(-14, -10, -11, -25, 0, -25);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -4, -6, 2, 0, 4, 26, [[0, '#f7fee7'], [0.55, '#d9f99d'], [1, '#a3e635']]), 0);

      // Caroço
      drawCircle(ctx, 0, 13, 9.5, radGrad(ctx, -3, 9, 1, 0, 13, 10, [[0, '#d97706'], [0.6, '#a16207'], [1, '#78350f']]), 2.6);
      drawHighlight(ctx, -3, 9, 2.6, 1.8, -0.4, 0.6);

      // Brotinho no topo
      drawLeaf(ctx, 0, -31, 13, 5, -1.9 + sway * 0.1, '#a3e635', '#4d7c0f', 2.2);

      drawEye(ctx, -7, -8, 3.6, { sleeping: sleep });
      drawEye(ctx, 7, -8, 3.6, { sleeping: sleep });
      drawCheek(ctx, -12, -2, 3.4, 2);
      drawCheek(ctx, 12, -2, 3.4, 2);
      drawMouth(ctx, 0, -1, 3.6, sleep ? 'serene' : 'smile');
    },

    // 25. ABACATAO: abacate guardião com coroa de folhas e caroço-escudo
    abacatao: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.0);

      drawFoot(ctx, -14, 34, 8.5, 5, '#1a2e05', -0.15);
      drawFoot(ctx, 14, 34, 8.5, 5, '#365314', 0.15);

      // Braços fortes
      drawEllipse(ctx, -31, 6, 7, 11, 0.35, '#3f6212', 2.8);
      drawEllipse(ctx, 31, 4, 7, 11, -0.35, '#3f6212', 2.8);

      // Casca grande
      ctx.beginPath();
      ctx.moveTo(0, -38);
      ctx.bezierCurveTo(19, -38, 24, -14, 29, 8);
      ctx.bezierCurveTo(35, 37, -35, 37, -29, 8);
      ctx.bezierCurveTo(-24, -14, -19, -38, 0, -38);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -30, 0, 30, 0, [[0, '#1a2e05'], [0.5, '#3f6212'], [1, '#365314']]), 3.4);

      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.bezierCurveTo(14, -30, 18, -12, 22, 8);
      ctx.bezierCurveTo(27, 30, -27, 30, -22, 8);
      ctx.bezierCurveTo(-18, -12, -14, -30, 0, -30);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -4, -8, 2, 0, 6, 32, [[0, '#ecfccb'], [0.55, '#bef264'], [1, '#84cc16']]), 0);

      // Caroço-escudo com rachadura
      drawCircle(ctx, 0, 15, 12.5, radGrad(ctx, -4, 10, 1, 0, 15, 13, [[0, '#d97706'], [0.6, '#92400e'], [1, '#78350f']]), 2.8);
      ctx.strokeStyle = 'rgba(43, 29, 20, 0.6)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-4, 5);
      ctx.lineTo(1, 12);
      ctx.lineTo(-2, 17);
      ctx.lineTo(3, 24);
      ctx.stroke();
      drawHighlight(ctx, -5, 9, 3.2, 2, -0.4, 0.55);

      // Coroa de folhas
      drawLeaf(ctx, 0, -36, 17, 6, -2.4 + sway * 0.06, '#a3e635', '#3f6212', 2.4);
      drawLeaf(ctx, 0, -37, 19, 6.4, -1.57, '#bef264', '#4d7c0f', 2.4);
      drawLeaf(ctx, 0, -36, 17, 6, -0.75 - sway * 0.06, '#a3e635', '#3f6212', 2.4);

      drawEye(ctx, -8, -12, 4, { sleeping: sleep, brow: 0.22 });
      drawEye(ctx, 8, -12, 4, { sleeping: sleep, brow: -0.22 });
      drawCheek(ctx, -14, -5, 3.6, 2.1);
      drawCheek(ctx, 14, -5, 3.6, 2.1);
      drawMouth(ctx, 0, -4, 4.4, sleep ? 'serene' : 'grin');
    },

    // 26. COCORAL: coco cascudo com raminho de palmeira e gota de água
    cocoral: function (ctx, t, sleep) {
      const sway = Math.sin(t * 3.2);
      const bob = Math.sin(t * 2.4) * 1.4;
      ctx.translate(0, bob);

      drawDroplet(ctx, 30, -14 + Math.sin(t * 3) * 2, 0.9, 0.3, '#38bdf8');

      drawFoot(ctx, -13, 31, 7.5, 4.4, '#451a03', -0.15);
      drawFoot(ctx, 13, 31, 7.5, 4.4, '#78350f', 0.15);

      // Raminho de palmeira
      ctx.save();
      ctx.translate(0, -24);
      drawLeaf(ctx, 0, 0, 20, 5.6, -2.6 + sway * 0.08, '#4ade80', '#15803d', 2.3);
      drawLeaf(ctx, 0, 0, 22, 6, -1.5, '#22c55e', '#166534', 2.3);
      drawLeaf(ctx, 0, 0, 20, 5.6, -0.5 - sway * 0.08, '#4ade80', '#15803d', 2.3);
      ctx.restore();

      // Casca redonda
      drawCircle(ctx, 0, 5, 28, radGrad(ctx, -9, -6, 3, 0, 5, 30, [[0, '#b45309'], [0.55, '#92400e'], [1, '#5b2a0b']]), 3.3);
      // Fibras
      ctx.strokeStyle = 'rgba(254, 215, 170, 0.45)';
      ctx.lineWidth = 1.5;
      [[-22, -4, -16, -12], [20, -6, 25, 2], [-24, 14, -18, 20], [22, 16, 15, 24], [-6, 28, 2, 31]].forEach(function (f) {
        ctx.beginPath();
        ctx.moveTo(f[0], f[1]);
        ctx.lineTo(f[2], f[3]);
        ctx.stroke();
      });
      // Os três "olhinhos" do coco no topo
      drawCircle(ctx, -7, -15, 2.2, '#451a03', 0);
      drawCircle(ctx, 0, -18, 2.2, '#451a03', 0);
      drawCircle(ctx, 7, -15, 2.2, '#451a03', 0);

      // Rosto num círculo de polpa branca
      drawEllipse(ctx, 0, 8, 17, 13, 0, '#fef3c7', 2.4);
      drawEye(ctx, -6, 6, 3.6, { sleeping: sleep });
      drawEye(ctx, 6, 6, 3.6, { sleeping: sleep });
      drawCheek(ctx, -11, 12, 3, 1.8, 'rgba(56, 189, 248, 0.45)');
      drawCheek(ctx, 11, 12, 3, 1.8, 'rgba(56, 189, 248, 0.45)');
      drawMouth(ctx, 0, 13, 3.4, sleep ? 'serene' : 'smile');
    },

    // 27. RABANITO: rabanete vermelho com folhas e uma chaminha
    rabanito: function (ctx, t, sleep) {
      const hop = Math.abs(Math.sin(t * 3.6)) * -4;
      const sway = Math.sin(t * 4.4);
      ctx.translate(0, hop);

      // Folhas
      ctx.save();
      ctx.translate(0, -18);
      ctx.rotate(sway * 0.1);
      drawLeaf(ctx, 0, 0, 18, 6, -2.3, '#86efac', '#16a34a', 2.4);
      drawLeaf(ctx, 0, 0, 22, 6.6, -1.57, '#4ade80', '#15803d', 2.4);
      drawLeaf(ctx, 0, 0, 18, 6, -0.84, '#86efac', '#16a34a', 2.4);
      ctx.restore();
      drawFlame(ctx, 13, -36, 0.55, 0.4, sway);

      // Raiz branquinha embaixo
      ctx.beginPath();
      ctx.moveTo(-7, 24);
      ctx.quadraticCurveTo(-1, 34, 2, 42);
      ctx.quadraticCurveTo(4, 34, 8, 24);
      ctx.closePath();
      fillStroke(ctx, '#fff1f2', 2.4);

      drawFoot(ctx, -15, 26, 5.6, 3.6, '#be123c', -0.4);
      drawFoot(ctx, 16, 26, 5.6, 3.6, '#be123c', 0.4);

      // Bulbo redondo
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.bezierCurveTo(22, -20, 28, 2, 18, 18);
      ctx.quadraticCurveTo(0, 32, -18, 18);
      ctx.bezierCurveTo(-28, 2, -22, -20, 0, -20);
      ctx.closePath();
      fillStroke(ctx, radGrad(ctx, -7, -8, 3, 0, 4, 28, [[0, '#fda4af'], [0.4, '#f43f5e'], [1, '#9f1239']]), 3.2);
      // Parte de baixo clarinha (rabanete bicolor)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-19, 12);
      ctx.quadraticCurveTo(0, 22, 19, 12);
      ctx.quadraticCurveTo(10, 26, 0, 27);
      ctx.quadraticCurveTo(-10, 26, -19, 12);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 241, 242, 0.85)';
      ctx.fill();
      ctx.restore();
      drawHighlight(ctx, -10, -8, 4, 7, -0.3, 0.5);

      drawEye(ctx, -7, -2, 4, { sleeping: sleep, brow: 0.3 });
      drawEye(ctx, 8, -2, 4, { sleeping: sleep, brow: -0.3 });
      drawCheek(ctx, -13, 6, 3.4, 2, 'rgba(255, 200, 120, 0.6)');
      drawCheek(ctx, 14, 6, 3.4, 2, 'rgba(255, 200, 120, 0.6)');
      drawMouth(ctx, 0.5, 7, 4.4, sleep ? 'serene' : 'grin');
    },

    // 28. TRUFIM: trufa escura e encaroçada com narizinho farejador
    trufim: function (ctx, t, sleep) {
      const sniff = Math.max(0, Math.sin(t * 6)) * 1.2;
      const bob = Math.sin(t * 2.8) * 1.5;
      ctx.translate(0, bob);

      // Esporinhos brilhando
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.6 + i * 0.33) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        drawStar4(ctx, -22 + i * 20, -22 - ph * 16, 2.6, '#e9d5ff', false);
      }
      ctx.restore();

      drawFoot(ctx, -11, 31, 6.4, 3.8, '#1c1917', -0.2);
      drawFoot(ctx, 11, 31, 6.4, 3.8, '#292524', 0.2);

      // Calombos ao redor
      const bumps = [[-20, -8, 9], [-6, -19, 10], [11, -17, 9], [22, -2, 9], [20, 16, 9], [-21, 15, 9], [0, 25, 9]];
      const fill = radGrad(ctx, -6, -6, 2, 0, 6, 32, [[0, '#78716c'], [0.5, '#57534e'], [1, '#292524']]);
      bumps.forEach(function (b) {
        drawCircle(ctx, b[0], b[1], b[2], fill, 3);
      });
      drawCircle(ctx, 0, 4, 23, fill, 0);
      // Pintinhas de textura
      ctx.fillStyle = 'rgba(28, 25, 23, 0.55)';
      [[-12, 16], [14, 12], [-16, -4], [6, -12], [16, -6], [-4, 20]].forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
      drawHighlight(ctx, -10, -10, 5, 3, -0.4, 0.3);

      drawEye(ctx, -7, 0, 3.4, { sleeping: sleep, sclera: '#fafaf9' });
      drawEye(ctx, 7, 0, 3.4, { sleeping: sleep, sclera: '#fafaf9' });
      // Narizinho rosa farejando
      drawEllipse(ctx, 0, 7, 4.2 + sniff, 3 + sniff * 0.6, 0, '#f9a8d4', 2);
      drawHighlight(ctx, -1.2, 6, 1.3, 0.9, 0, 0.8);
      drawMouth(ctx, 0, 12, 2.8, sleep ? 'serene' : 'smile');
    },

    // 29. TRUFANTE: trufa majestosa com coroa de cogumelos e olhos místicos
    trufante: function (ctx, t, sleep) {
      const bob = Math.sin(t * 2.2) * 1.6;
      const glow = 0.5 + 0.5 * Math.sin(t * 2.6);
      ctx.translate(0, bob);

      // Aura roxa
      ctx.save();
      ctx.globalAlpha = 0.18 + glow * 0.14;
      drawCircle(ctx, 0, 2, 44, '#a855f7', 0);
      ctx.restore();

      drawFoot(ctx, -15, 34, 8, 4.6, '#1c1917', -0.2);
      drawFoot(ctx, 15, 34, 8, 4.6, '#292524', 0.2);

      const bumps = [[-27, -6, 11], [-12, -21, 12], [12, -21, 12], [27, -6, 11], [26, 18, 11], [-26, 18, 11], [0, 30, 11]];
      const fill = radGrad(ctx, -8, -8, 2, 0, 6, 38, [[0, '#6b6461'], [0.5, '#44403c'], [1, '#1c1917']]);
      bumps.forEach(function (b) {
        drawCircle(ctx, b[0], b[1], b[2], fill, 3.2);
      });
      drawCircle(ctx, 0, 5, 29, fill, 0);
      ctx.fillStyle = 'rgba(12, 10, 9, 0.55)';
      [[-15, 20], [17, 15], [-20, -2], [8, -15], [20, -4], [-5, 24], [-10, -14]].forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.9, 0, Math.PI * 2);
        ctx.fill();
      });

      // Coroa de cogumelinhos
      [[-14, -30, 0.85, '#c084fc'], [0, -35, 1.05, '#a855f7'], [14, -30, 0.85, '#c084fc']].forEach(function (m) {
        ctx.save();
        ctx.translate(m[0], m[1]);
        ctx.scale(m[2], m[2]);
        ctx.beginPath();
        ctx.moveTo(-3, 6);
        ctx.lineTo(-2.5, -2);
        ctx.lineTo(2.5, -2);
        ctx.lineTo(3, 6);
        ctx.closePath();
        fillStroke(ctx, '#f5f5f4', 2);
        ctx.beginPath();
        ctx.moveTo(-10, -1);
        ctx.quadraticCurveTo(0, -16, 10, -1);
        ctx.closePath();
        fillStroke(ctx, m[3], 2.2);
        drawCircle(ctx, -3, -6, 1.6, '#faf5ff', 0);
        drawCircle(ctx, 3, -8, 1.2, '#faf5ff', 0);
        ctx.restore();
      });

      drawEye(ctx, -9, 0, 4.4, { sleeping: sleep, sclera: '#f5f3ff', iris: '#3b0764', innerGlow: 'rgba(192, 132, 252, 0.9)', brow: 0.25, browColor: '#e9d5ff' });
      drawEye(ctx, 9, 0, 4.4, { sleeping: sleep, sclera: '#f5f3ff', iris: '#3b0764', innerGlow: 'rgba(192, 132, 252, 0.9)', brow: -0.25, browColor: '#e9d5ff' });
      drawEllipse(ctx, 0, 9, 5, 3.4, 0, '#f0abfc', 2);
      drawMouth(ctx, 0, 15, 3.6, sleep ? 'serene' : 'smirk');
    },

    // 30. MANDIOCAO: mandioca colossal com casca de raiz, topo cortado e folhas palmadas
    mandiocao: function (ctx, t, sleep) {
      const sway = Math.sin(t * 2.4);

      // Folhas de mandioca (palmadas) saindo do topo
      ctx.save();
      ctx.translate(0, -30);
      [-2.75, -2.25, -1.57, -0.9, -0.4].forEach(function (a, i) {
        drawLeaf(ctx, 0, 0, i === 2 ? 22 : 18, 4.6, a + sway * 0.05, '#4ade80', '#15803d', 2.2);
      });
      ctx.restore();

      // Raízes-pés
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      [[-12, 30, -24, 40], [12, 30, 24, 40]].forEach(function (r) {
        ctx.lineWidth = 9;
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ctx.moveTo(r[0], r[1]);
        ctx.quadraticCurveTo((r[0] + r[2]) / 2, r[3], r[2], r[3] - 2);
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#a16207';
        ctx.stroke();
      });

      // Braços de raiz
      [[-22, -4, -38, 10, -40, 20], [22, -4, 38, 8, 41, 18]].forEach(function (r) {
        ctx.lineWidth = 9;
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ctx.moveTo(r[0], r[1]);
        ctx.quadraticCurveTo(r[2], r[3], r[4], r[5]);
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#b45309';
        ctx.stroke();
      });

      // Corpo de raiz grossa
      ctx.beginPath();
      ctx.moveTo(-23, -26);
      ctx.quadraticCurveTo(0, -34, 23, -26);
      ctx.bezierCurveTo(28, -4, 22, 22, 10, 34);
      ctx.quadraticCurveTo(0, 38, -10, 34);
      ctx.bezierCurveTo(-22, 22, -28, -4, -23, -26);
      ctx.closePath();
      fillStroke(ctx, linGrad(ctx, -26, 0, 26, 0, [[0, '#713f12'], [0.45, '#a16207'], [1, '#78350f']]), 3.4);
      // Anéis da casca
      ctx.strokeStyle = 'rgba(69, 26, 3, 0.55)';
      ctx.lineWidth = 2;
      [[-6, 0.0], [8, 0.1], [20, -0.05]].forEach(function (b) {
        ctx.beginPath();
        ctx.moveTo(-21, b[0]);
        ctx.quadraticCurveTo(0, b[0] + 6, 21, b[0] - 2);
        ctx.stroke();
      });

      // Topo cortado mostrando a polpa branca
      drawEllipse(ctx, 0, -27, 21, 7, 0, '#fef3c7', 2.8);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, -27, 12, 3.8, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Rosto de chefão
      drawEye(ctx, -9, -10, 4.4, { sleeping: sleep, brow: 0.32, sclera: '#fef3c7' });
      drawEye(ctx, 9, -10, 4.4, { sleeping: sleep, brow: -0.32, sclera: '#fef3c7' });
      // Bigodão de raizinhas
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.quadraticCurveTo(-8, -3, -14, 3);
      ctx.moveTo(1, 0);
      ctx.quadraticCurveTo(8, -3, 14, 3);
      ctx.stroke();
      drawMouth(ctx, 0, 6, 4.6, sleep ? 'serene' : 'smirk');
    }
  });


  function drawFallbackCreature(ctx, t, sleep) {
    drawCircle(ctx, 0, 6, 22, '#4ade80', 3.2);
    drawLeaf(ctx, 0, -16, 14, 6, -1.1, '#86efac', '#16a34a', 2.4);
    drawEye(ctx, -6, 4, 4.2, { sleeping: sleep });
    drawEye(ctx, 8, 4, 4.2, { sleeping: sleep });
    drawMouth(ctx, 1, 11, 4.5, 'smile');
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

  function drawCreatureInternal(ctx, speciesId, t, sleeping) {
    const art = illustrations.get(speciesId);
    if (art) {
      const scale = 92 / Math.max(art.naturalWidth, art.naturalHeight);
      const width = art.naturalWidth * scale;
      const height = art.naturalHeight * scale * (sleeping ? 0.90 : 1);
      ctx.drawImage(art, -width / 2, 39 - height, width, height);
      return;
    }
    const fn = SPECIES_DRAWERS[speciesId] || drawFallbackCreature;
    ctx.save();
    fn(ctx, t, sleeping);
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
        drawCreatureInternal(sctx, speciesId, t, sleeping);
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
      drawCreatureInternal(ctx, speciesId, t, sleeping);
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

    drawCreature(ctx, speciesId, px * 0.5, px * 0.53, px * 0.88, {
      facing: 'right',
      time: 0,
      silhouette: sil,
      golden: gold,
      shadow: true
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
