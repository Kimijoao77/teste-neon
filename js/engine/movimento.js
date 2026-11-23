(function (HM) {
  'use strict';

  const acceleration = 31;
  const braking = 53;
  const followDistance = .74;

  function advance(step, seconds, maxSpeed, continues) {
    while (seconds > 0 && step.progress < 1) {
      const dt = Math.min(seconds, 1 / 120);
      const remaining = 1 - step.progress;
      const limit = continues ? maxSpeed : Math.max(.8, Math.sqrt(2 * braking * remaining));
      const target = Math.min(maxSpeed, limit);
      const oldSpeed = step.speed;
      step.speed = Math.max(oldSpeed - braking * dt, Math.min(target, oldSpeed + acceleration * dt));
      const distance = (oldSpeed + step.speed) * .5 * dt;
      if (distance >= remaining) {
        step.progress = 1;
        return Math.max(0, seconds - dt * remaining / distance);
      }
      step.progress += distance;
      seconds -= dt;
    }
    return 0;
  }

  function direction(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }

  function startFollower(x, y, dir, walkable) {
    const back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[dir];
    const beside = [[-1, 0], [1, 0], [0, 1], [0, -1]];
    const offset = [back, ...beside].find(([dx, dy]) => walkable(x + dx, y + dy));
    const start = offset
      ? { x: x + offset[0] * followDistance, y: y + offset[1] * followDistance }
      : { x: x - .28, y };
    return { ...start, dir, distance: 0, hop: 0, trail: [start, { x, y }] };
  }

  function follow(follower, x, y, speed) {
    const points = follower.trail;
    const last = points[points.length - 1];
    if (last.x === x && last.y === y) {
      follower.hop = 0;
      return;
    }
    points.push({ x, y });
    let remaining = followDistance;
    let index = points.length - 1;
    let next = points[0];
    for (; index > 0; index--) {
      const end = points[index];
      const start = points[index - 1];
      const segment = Math.hypot(end.x - start.x, end.y - start.y);
      if (segment >= remaining) {
        const ratio = remaining / segment;
        next = { x: end.x + (start.x - end.x) * ratio, y: end.y + (start.y - end.y) * ratio };
        break;
      }
      remaining -= segment;
    }
    if (index > 1) points.splice(0, index - 1);
    const dx = next.x - follower.x;
    const dy = next.y - follower.y;
    const distance = Math.hypot(dx, dy);
    if (distance > .0001) {
      follower.dir = direction(dx, dy);
      follower.distance += distance;
    }
    follower.x = next.x;
    follower.y = next.y;
    follower.hop = Math.abs(Math.sin(follower.distance * Math.PI / .45)) * .075 * Math.min(1, speed / 4);
  }

  function facing(dir) {
    return dir === 'left' || dir === 'up' ? 'left' : 'right';
  }

  HM.Motion = { advance, direction, startFollower, follow, facing };
})(window.HortaMon);
