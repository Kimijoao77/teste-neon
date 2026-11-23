(function (HM) {
  'use strict';

  const Motion = HM.Motion;
  const walkSpeed = 3.9;
  const deltas = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  const keys = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
  };
  let room;
  let frame;
  let held;
  const pressed = new Map();
  const images = new Map();

  function image(url) {
    if (!images.has(url)) {
      const sprite = new Image();
      sprite.src = url;
      images.set(url, sprite);
    }
    return images.get(url);
  }

  function tile(layout, x, y) {
    return layout.rows[y]?.[x] || '#';
  }

  function walkable(layout, x, y) {
    return ['.', 'E'].includes(tile(layout, x, y));
  }

  function point(layout, x, y) {
    return layout.origin.map((o, i) => o + x * layout.axisX[i] + y * layout.axisY[i]);
  }

  function nearHost(x, y) {
    return Math.abs(x - room.host.x) + Math.abs(y - room.host.y) === 1;
  }

  function interact() {
    if (!room?.canMove()) return false;
    const { x, y } = room.position;
    if (room.step.dir) {
      room.path = [];
      room.talk = true;
    } else if (nearHost(x, y)) {
      const { host } = room;
      room.position.dir = Motion.direction(host.x - x, host.y - y);
      host.dir = Motion.direction(x - host.x, y - host.y);
      room.onNpc(host.npc);
    } else if (tile(room.layout, x, y) === 'E') {
      room.onLeave();
    } else {
      return false;
    }
    return true;
  }

  function route(nx, ny, talk) {
    const { x, y } = room.step.dir ? room.step : room.position;
    const queue = [{ x, y, steps: [] }];
    const seen = new Set([x + ',' + y]);
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      if (talk ? nearHost(cell.x, cell.y) : cell.x === nx && cell.y === ny) return cell.steps;
      for (const [dir, [dx, dy]] of Object.entries(deltas)) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        const code = tile(room.layout, x, y);
        const tag = x + ',' + y;
        if (seen.has(tag) || (code !== '.' && !(code === 'E' && !talk && x === nx && y === ny))) continue;
        seen.add(tag);
        queue.push({ x, y, steps: [...cell.steps, dir] });
      }
    }
    return null;
  }

  function click(event) {
    if (!room?.canMove() || !room.view) return;
    const { x, y, w, h } = room.view;
    const rect = room.canvas.getBoundingClientRect();
    const nx = (event.clientX - rect.left - x) / w;
    const ny = (event.clientY - rect.top - y) / h;
    const [hostX, hostY] = point(room.layout, room.host.x, room.host.y);
    const talk = Math.abs(nx - hostX) <= .033 && ny >= hostY - .14 && ny <= hostY + .018;
    const { origin, axisX: [ax, ay], axisY: [bx, by] } = room.layout;
    const a = nx - origin[0];
    const b = ny - origin[1];
    const det = ax * by - ay * bx;
    const tx = Math.round((a * by - b * bx) / det);
    const ty = Math.round((b * ax - a * ay) / det);
    const path = route(tx, ty, talk);
    if (path) {
      room.path = path;
      room.talk = talk;
    }
  }

  function tick(now) {
    if (!room) return;
    const dt = Math.min(.12, (now - (room.time ?? now)) / 1000);
    room.time = now;
    if (room.canMove() && !walk(dt)) return;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function nextDirection() {
    return room.queuedDir || held || Array.from(pressed.values()).at(-1) || room.path[0];
  }

  function queueDirection(dir) {
    room.queuedDir = dir;
    room.path = [];
    room.talk = false;
  }

  function walk(dt) {
    const { position, layout, step, follower } = room;
    while (dt > 0) {
      if (!step.dir) {
        if (room.talk && room.path.length === 0) {
          room.talk = false;
          if (interact()) return Boolean(room);
        }
        const dir = nextDirection();
        room.queuedDir = null;
        if (!dir) break;
        if (room.path[0] === dir) room.path.shift();
        const [dx, dy] = deltas[dir];
        position.dir = dir;
        if (tile(layout, position.x, position.y) === 'E' && dy > 0) {
          room.onLeave();
          return false;
        }
        const x = position.x + dx;
        const y = position.y + dy;
        if (!walkable(layout, x, y)) {
          room.path = [];
          room.talk = false;
          break;
        }
        Object.assign(step, { x, y, dir, progress: 0 });
      }
      const [dx, dy] = deltas[step.dir];
      const continues = nextDirection() === step.dir && tile(layout, step.x + dx, step.y + dy) === '.';
      const previous = step.progress;
      dt = Motion.advance(step, dt, walkSpeed, continues);
      step.distance += step.progress - previous;
      step.renderX = position.x + dx * step.progress;
      step.renderY = position.y + dy * step.progress;
      Motion.follow(follower, step.renderX, step.renderY, step.speed);
      if (step.progress < 1) return true;
      position.x = step.x;
      position.y = step.y;
      if (tile(layout, step.x, step.y) === 'E') {
        room.onLeave();
        return false;
      }
      const next = nextDirection();
      step.speed = !next ? 0 : next === step.dir ? step.speed : step.speed * .45;
      step.dir = null;
    }
    if (!step.dir) {
      step.speed = 0;
      follower.hop = 0;
    }
    return true;
  }

  function draw() {
    const { canvas, layout, position, host, step, follower } = room;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.floor(width * ratio);
    const ch = Math.floor(height * ratio);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = layout.backdrop;
    ctx.fillRect(0, 0, width, height);
    const backdrop = image('arte/interior-' + layout.id + '.jpg');
    if (backdrop.naturalWidth) {
      const scale = Math.min(width / backdrop.naturalWidth, height / backdrop.naturalHeight);
      const w = backdrop.naturalWidth * scale;
      const h = backdrop.naturalHeight * scale;
      const x = (width - w) / 2;
      const y = (height - h) / 2;
      room.view = { x, y, w, h };
      ctx.drawImage(backdrop, x, y, w, h);
      const moving = Boolean(step.dir);
      const avatarFrame = Math.floor(step.distance / .23) % 4;
      const classicFrame = moving ? 1 + avatarFrame % 3 : 0;
      const style = { laboratorio: 'prof', estufa: 'healer', loja: 'shop' }[layout.id];
      const lead = room.state.party[0];
      const actors = [
        { x: host.x, y: host.y, npcId: host.npc.id, art: style + '_down_0' },
        { x: step.renderX, y: step.renderY, player: true, art: 'player_' + position.dir + '_' + classicFrame }
      ];
      if (lead) actors.push({ x: follower.x, y: follower.y, lead });
      for (const actor of actors.sort((a,b) => point(layout,a.x,a.y)[1] - point(layout,b.x,b.y)[1])) {
        const [u, v] = point(layout, actor.x, actor.y);
        const feet = y + v * h;
        const base = x + u * w;
        const size = h * .145;
        ctx.fillStyle = '#1b24254d';
        ctx.beginPath();
        ctx.ellipse(base, feet, size * (actor.lead ? .145 : .21), size * .06, 0, 0, Math.PI * 2);
        ctx.fill();
        if (actor.lead) {
          HM.Sprites.drawCreature(ctx, lead.speciesId, base, feet - h * (.034 + follower.hop * .06),
            h * .09, { golden: lead.golden, facing: Motion.facing(follower.dir), shadow: false });
          continue;
        }
        const drawn = actor.player
          ? HM.CharacterArt.drawPlayer(ctx, base, feet, size * 1.10, position.dir, avatarFrame, moving)
          : HM.CharacterArt.drawNpc(ctx, actor.npcId, base, feet, size * 1.06, host.dir);
        if (drawn) continue;
        const sprite = image('arte/personagens/' + actor.art + '.png');
        if (!sprite.naturalWidth) continue;
        const sw = size * sprite.naturalWidth / sprite.naturalHeight;
        ctx.drawImage(sprite, base - sw / 2, feet - size, sw, size);
      }
    }
  }

  function release() {
    held = null;
    pressed.clear();
    if (room) room.queuedDir = null;
  }

  HM.Rooms = {
    active: () => Boolean(room),
    name: () => room?.layout.name,
    find: (x,y) => HM.browserRooms.find((r) => r.doorX === x && r.doorY === y),
    interact,
    leave() { if (room?.canMove()) room.onLeave(); },
    setHeldDirection(dir) {
      if (dir && room && held !== dir) queueDirection(dir);
      held = dir;
    },
    open(layout, state, callbacks) {
      this.close();
      const y = layout.rows.findIndex((row) => row.includes('E'));
      const x = layout.rows[y].indexOf('E');
      const saved = state.interior;
      const position = saved?.id === layout.id && (tile(layout, saved.x, saved.y) === '.' || tile(layout,saved.x,saved.y) === 'E')
        ? { ...saved, dir: deltas[saved.dir] ? saved.dir : 'up' }
        : { id: layout.id, x, y, dir: 'up' };
      const hostY = layout.rows.findIndex((row) => row.includes('N'));
      const host = { y: hostY, x: layout.rows[hostY].indexOf('N'), dir: 'down',
        npc: HM.WORLD.npcs.find((n) => n.id === layout.npc) };
      const canvas = document.getElementById('room-canvas');
      state.interior = position;
      const step = { progress: 0, speed: 0, distance: 0, renderX: position.x, renderY: position.y };
      const follower = Motion.startFollower(position.x, position.y, position.dir, (x, y) => tile(layout, x, y) === '.');
      room = { layout, canvas, state, position, host, step, follower, path: [], ...callbacks };
      canvas.classList.remove('hidden');
      canvas.addEventListener('click', click);
      document.getElementById('screen-overworld').classList.add('is-interior');
      frame = requestAnimationFrame(tick);
    },
    close() {
      if (!room) return;
      cancelAnimationFrame(frame);
      room.canvas.removeEventListener('click', click);
      room.canvas.classList.add('hidden');
      document.getElementById('screen-overworld').classList.remove('is-interior');
      room = null;
      release();
    }
  };

  window.addEventListener('keydown', (event) => {
    if (!room?.canMove() || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const dir = keys[event.code];
    if (dir) {
      event.preventDefault();
      if (!event.repeat) {
        pressed.set(event.code, dir);
        queueDirection(dir);
      }
    } else if (['Space','Enter','KeyE'].includes(event.code) && event.target.tagName !== 'BUTTON' && !event.repeat && interact()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('keyup', (event) => { pressed.delete(event.code); });
  window.addEventListener('blur', release);
})(window.HortaMon);
