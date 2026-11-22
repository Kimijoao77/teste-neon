(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});
  const palettes = {
    jardim: ['#182a30', '#a5b596', '#648276', '#365850', '#233f36', '#54705a', '#263f36', '#cdd1ab'],
    tropical: ['#243e46', '#d3be9a', '#8e9b79', '#526a56', '#334940', '#887b5d', '#4e4c39', '#eed6a4'],
    estufa: ['#1a3030', '#9faf8c', '#677e65', '#416055', '#284841', '#6c7964', '#34493e', '#dfcca3'],
    caverna: ['#101720', '#4d586c', '#394955', '#303c4d', '#222d39', '#4c565b', '#272f3a', '#a9bdc7']
  };

  function polygon(ctx, points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }

  function noise(index) {
    const n = Math.sin(index * 91.713 + 12.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function paint(ctx, width, height, scene = 'jardim') {
    const [sky, haze, distant, middle, near, soil, foreground, light] = palettes[scene] || palettes.jardim;
    const horizon = height * 0.47;
    const atmosphere = ctx.createLinearGradient(0, 0, 0, horizon * 1.15);
    atmosphere.addColorStop(0, sky);
    atmosphere.addColorStop(1, haze);
    ctx.fillStyle = atmosphere;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.69, horizon * 0.65, 0,
      width * 0.69, horizon * 0.65, height * 0.5);
    glow.addColorStop(0, '#f0e4bb55');
    glow.addColorStop(1, '#f0e4bb00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, horizon * 1.2);

    [distant, middle, near].forEach((color, layer) => {
      const line = horizon * (0.68 + layer * 0.16);
      const points = [[0, height], [0, line]];
      for (let i = 0; i <= 46; i++) {
        const x = i * width / 46;
        const valley = Math.sin(i * 0.23 + layer * 2) * height * 0.048;
        points.push([x, line + valley - noise(i + 46 * layer) * height * (0.11 + layer * 0.016)]);
      }
      points.push([width, height]);
      polygon(ctx, points, color);
    });

    if (scene === 'estufa') {
      ctx.strokeStyle = '#bcc9a66b';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        const x = width * i / 8;
        ctx.beginPath();
        ctx.moveTo(x, horizon);
        ctx.lineTo(width * 0.5 + (x - width * 0.5) * 0.56, 0);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, horizon * 0.43);
      ctx.lineTo(width, horizon * 0.43);
      ctx.stroke();
    } else if (scene === 'caverna') {
      for (let i = 0; i < 15; i++) {
        const x = width * i / 14;
        const drop = height * (0.08 + noise(i) * 0.21);
        polygon(ctx, [[x - width * 0.075, 0], [x + width * 0.07, 0],
          [x + width * 0.02 * (noise(i + 6) - 0.45), drop]], i % 2 ? near : sky);
      }
    } else {
      for (const [i, position] of [0.03, 0.12, 0.25, 0.8, 0.91, 0.99].entries()) {
        const x = width * position;
        const base = horizon + height * 0.035 * (i % 2);
        const size = height * (0.16 + noise(i + 20) * 0.2);
        polygon(ctx, [[x - size * 0.04, base], [x + size * 0.035, base],
          [x + size * 0.015, base - size * 0.83], [x - size * 0.025, base - size]], foreground);
        for (let branch = 0; branch < 3; branch++) {
          const y = base - size * (0.44 + branch * 0.2);
          const span = size * (0.53 - branch * 0.12);
          polygon(ctx, [[x - span, y + size * 0.11], [x - span * 0.55, y - size * 0.09],
            [x + size * 0.02, y - size * 0.29], [x + span * 0.59, y - size * 0.06],
            [x + span * 0.84, y + size * 0.1], [x, y + size * 0.037]], branch === 1 ? near : foreground);
        }
      }
    }

    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, soil);
    ground.addColorStop(1, foreground);
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);

    // Sulcos e pedras aumentam em direção à câmera.
    for (let i = 0; i < 85; i++) {
      const depth = noise(i + 410);
      const y = horizon + depth ** 1.6 * (height - horizon);
      const x = noise(i + 275) * width;
      const size = 2 + depth * (5 + noise(i + 320) * 12);
      ctx.globalAlpha = 0.08 + depth * 0.13;
      polygon(ctx, [[x - size, y], [x + size * 0.65, y - size * 0.2],
        [x + size, y + size * 0.09], [x - size * 0.3, y + size * 0.16]], light);
    }
    ctx.globalAlpha = 1;

    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.55, height * 0.16,
      width * 0.5, height * 0.55, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, '#08141900');
    vignette.addColorStop(1, '#081419ad');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  HM.Scenery = { paint };
})(window);
