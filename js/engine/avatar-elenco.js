(function (HM) {
  'use strict';

  const preference = 'hortamon-estilo-personagens';
  const directions = { down: 0, left: 1, up: 2, right: 3 };
  const humanRoles = new Set(['prof', 'healer', 'shop', 'trainer', 'leader', 'guard']);
  const roster = new Set(HM.WORLD.npcs.filter(npc => humanRoles.has(npc.role)).map(npc => npc.id));
  const npcImages = new Map();
  const urlChoice = new URLSearchParams(window.location.search).get('avatar');
  let enabled = urlChoice !== 'classico';
  let playerImage;

  if (!urlChoice) {
    try {
      enabled = window.localStorage.getItem(preference) !== 'classico';
    } catch (_) {
      // VRoid is the default when storage is unavailable.
    }
  }

  function loadImage(path) {
    const image = new Image();
    image.src = 'arte/avatar-vroid/' + path;
    return image;
  }

  function loadPlayer() {
    if (!playerImage) playerImage = loadImage('explorador.webp');
  }

  function npcImage(id) {
    if (!enabled || !roster.has(id)) return null;
    if (!npcImages.has(id)) npcImages.set(id, loadImage('elenco/' + id + '.webp'));
    return npcImages.get(id);
  }

  function ready() {
    return enabled && Boolean(playerImage?.naturalWidth);
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    document.documentElement.classList.toggle('personagens-classicos', !enabled);
    if (enabled) loadPlayer();
    try {
      window.localStorage.setItem(preference, enabled ? 'vroid' : 'classico');
    } catch (_) {
      // The in-game choice remains active for this session.
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has('avatar')) {
      url.searchParams.set('avatar', enabled ? 'vroid' : 'classico');
      window.history.replaceState(window.history.state, '', url);
    }
  }

  function drawPlayer(ctx, x, feet, height, direction, walkFrame, isMoving) {
    if (!ready()) return false;
    const row = directions[direction] ?? directions.down;
    const column = isMoving ? 1 + (Math.floor(walkFrame) % 4) : 0;
    const frameWidth = playerImage.naturalWidth / 5;
    const frameHeight = playerImage.naturalHeight / 4;
    const width = height * frameWidth / frameHeight;
    ctx.drawImage(playerImage, column * frameWidth, row * frameHeight, frameWidth, frameHeight,
      x - width / 2, feet - height * .95, width, height);
    return true;
  }

  function drawNpc(ctx, id, x, feet, height, direction) {
    const image = npcImage(id);
    if (!image?.naturalWidth) return false;
    const cellWidth = image.naturalWidth / 5;
    const cellHeight = image.naturalHeight;
    const width = height * cellWidth / cellHeight;
    const frame = directions[direction] ?? directions.down;
    ctx.drawImage(image, frame * cellWidth, 0, cellWidth, cellHeight,
      x - width / 2, feet - height * .95, width, height);
    return true;
  }

  function drawPortrait(ctx, id, size, onReady) {
    const image = npcImage(id);
    if (!image?.naturalWidth) {
      if (image && !image.complete) image.addEventListener('load', onReady, { once: true });
      return false;
    }
    const cell = image.naturalWidth / 5;
    ctx.drawImage(image, cell * 4, 0, cell, cell,
      (ctx.canvas.width - size) / 2, (ctx.canvas.height - size) / 2, size, size);
    return true;
  }

  document.documentElement.classList.toggle('personagens-classicos', !enabled);
  if (enabled) loadPlayer();

  HM.CharacterArt = {
    isEnabled: () => enabled, setEnabled, ready, npcReady: id => Boolean(npcImage(id)?.naturalWidth),
    drawPlayer, drawNpc, drawPortrait
  };
})(window.HortaMon);
