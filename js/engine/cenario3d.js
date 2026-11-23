(function (window) {
  'use strict';

  const HM = window.HortaMon;
  const T = window.THREE;
  if (!T || !HM.Models3D) return;
  const { oval, block, facet, beam, paint } = HM.Models3D;
  const circle = new T.CircleGeometry(1, 22);
  const actorPlane = new T.PlaneGeometry(1, 1).translate(0, .455, 0);
  const palette = {
    jardim: { sky: '#8aa79b', grass: '#667e54', tree: '#3d6849', ground: '#9d8966', fog: 22 },
    tropical: { sky: '#90b5ae', grass: '#718957', tree: '#517e4e', ground: '#bfaa77', fog: 24 },
    caverna: { sky: '#424657', grass: '#545365', tree: '#62617d', ground: '#747086', fog: 15 },
    estufa: { sky: '#a5aa82', grass: '#768665', tree: '#53714e', ground: '#a49464', fog: 23 }
  };
  const commonMaterial = new T.MeshStandardMaterial({ color: 'white', roughness: .91 });
  const shadowMaterial = new T.MeshBasicMaterial({ color: '#293b31', transparent: true, opacity: .19, depthWrite: false });
  const targetMaterial = new T.MeshBasicMaterial({ color: '#edd09a', transparent: true, opacity: .70, side: T.DoubleSide });
  const waterMaterial = new T.MeshStandardMaterial({ color: '#47868f', metalness: .13, roughness: .36 });
  const aim = new T.Vector3(), screen = new T.Vector3(), cameraTarget = new T.Vector3();
  const ray = new T.Raycaster(), cursor = new T.Vector2();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const worldCamera = new T.PerspectiveCamera(39, 1, .11, 80);
  const shownCamera = worldCamera.clone();
  const battleCamera = new T.PerspectiveCamera(37, 1, .12, 90);
  const directions = ['up', 'right', 'down', 'left'];
  const orbitStep = Math.PI / 4;
  const cameraControls = document.getElementById('camera-controls');
  const mapCanvas = document.getElementById('overworld-canvas');
  const cardColor = new T.Color();
  let renderer, failed, canvasOwner, world, worldScene, battleScene3d;
  let playerActor, playerShadow, leadActor, leadShadow, marker, walkTarget, ocean, cameraMode = 0;
  let cameraX, cameraZ, cameraBlend = 0, cameraRevision, worldTime, lastWidth, lastHeight;
  let orbit = 0, orbitTarget = 0, shownSector = 0;
  let dragPointer = null, dragX = 0;
  let worldRendered = false;
  let oldCamera = null;
  const isOverworldActive = () => worldRendered && canvasOwner?.id === 'overworld-canvas';
  let npcs = [];
  let arenas = {};
  const characterImages = new Map();

  function drawCharacter(ctx, style, dir, walk, x, y, size) {
    const key = style + '_' + (style === 'player' ? dir + '_' + walk : 'down_0');
    if (!characterImages.has(key)) {
      const img = new Image();
      img.src = 'arte/personagens/' + key + '.png';
      characterImages.set(key, img);
    }
    const image = characterImages.get(key);
    if (image.naturalWidth) {
      const w = size * image.naturalWidth / image.naturalHeight;
      ctx.drawImage(image, x - w / 2, y - size, w, size);
    } else if (image.complete && HM.Sprites) {
      HM.Sprites.drawCharacter(ctx, x, y - size * .39, size * .90, style, dir, walk);
    } else return false;
    return true;
  }

  function billboard(x = 0, z = 0) {
    const actor = new T.Mesh(actorPlane, new T.MeshBasicMaterial({ alphaTest: .14, fog: false }));
    actor.userData.billboard = true;
    actor.position.set(x, .025, z);
    worldScene.add(actor);
    return actor;
  }

  function paintBillboard(actor, key, height, ratio, draw) {
    const { x, y, z } = project(actor.position, worldCamera, lastWidth, lastHeight);
    if (z < -1 || z > 1 || x < -190 || x > lastWidth + 190 || y < -90 || y > lastHeight + 200) {
      actor.visible = false;
      return;
    }
    const { userData, material } = actor;
    if (!material.map) {
      const image = document.createElement('canvas');
      image.height = 300;
      image.width = Math.ceil(image.height * ratio);
      userData.ctx = image.getContext('2d', { willReadFrequently: true });
      material.map = new T.CanvasTexture(image);
      material.map.colorSpace = T.SRGBColorSpace;
      material.map.generateMipmaps = false;
      material.map.minFilter = T.LinearFilter;
      material.needsUpdate = true;
    }
    if (userData.key !== key) {
      const { ctx } = userData;
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      if (!draw(ctx, width / 2, height * .955, height * .97)) {
        actor.visible = false;
        return;
      }
      userData.key = key;
      material.map.needsUpdate = true;
    }
    const cameraRight = worldCamera.matrixWorld.elements;
    actor.rotation.y = Math.atan2(-cameraRight[2], cameraRight[0]);
    actor.scale.set(height * ratio, height, 1);
    actor.visible = true;
  }

  function random(seed) {
    let n = seed | 0;
    return function () {
      n = (n * 1664525 + 1013904223) | 0;
      return (n >>> 0) / 4294967296;
    };
  }
  function mix(color, amount) {
    return cardColor.set(color).multiplyScalar(amount).getHex();
  }

  function fail() {
    failed = true;
    worldRendered = false;
    renderer?.domElement.remove();
    const status = document.getElementById('webgl-fallback');
    if (status) status.hidden = false;
    if (cameraControls) cameraControls.hidden = true;
  }

  function decorateCanvas() {
    renderer.domElement.className = 'render-3d';
    renderer.domElement.setAttribute('aria-hidden', 'true');
  }

  function useSoftware() {
    try {
      renderer = new HM.SoftwareRenderer();
      decorateCanvas();
    } catch (_) {
      fail();
    }
  }

  function setup(canvas) {
    if (failed || canvas.clientWidth === 0 || canvas.clientHeight === 0) return false;
    if (!renderer) {
      const surface = document.createElement('canvas');
      const context = surface.getContext('webgl2', { antialias: true }) || surface.getContext('webgl', { antialias: true });
      if (context) {
        try {
          renderer = new T.WebGLRenderer({ canvas: surface, context, antialias: true });
          renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
          renderer.outputColorSpace = T.SRGBColorSpace;
          surface.addEventListener('webglcontextlost', function () {
            renderer?.domElement.remove();
            renderer = null;
            canvasOwner = null;
            lastWidth = lastHeight = 0;
            useSoftware();
          }, { once: true });
        } catch (_) {
          useSoftware();
        }
      } else useSoftware();
      if (!renderer) return false;
      decorateCanvas();
    }

    if (canvasOwner !== canvas) {
      canvas.before(renderer.domElement);
      canvasOwner = canvas;
    }
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (lastWidth !== width || lastHeight !== height) {
      renderer.setSize(width, height, false);
      lastWidth = width;
      lastHeight = height;
    }
    return true;
  }

  function setupLights(scene) {
    scene.add(new T.HemisphereLight('#fff0d4', '#6d8278', 2.22));
    const sun = new T.DirectionalLight('#fff0d8', 2.07);
    sun.position.set(-9, 15, 7);
    scene.add(sun);
    const rim = new T.DirectionalLight('#ddeffc', .41);
    rim.position.set(7, 5, -14);
    scene.add(rim);
  }

  function atmosphere(scene, colors) {
    scene.background = new T.Color(colors.sky);
    scene.fog = new T.Fog(colors.sky, colors.fog * .51, colors.fog * 1.65);
  }

  function mergePlants(root, source) {
    source.updateMatrixWorld(true);
    const types = new Map();
    source.traverse(function (obj) {
      if (!obj.isMesh) return;
      if (!types.has(obj.geometry)) types.set(obj.geometry, []);
      types.get(obj.geometry).push(obj);
    });
    for (const [geometry, plants] of types) {
      const batch = new T.InstancedMesh(geometry, commonMaterial, plants.length);
      for (let i = 0; i < plants.length; i++) {
        batch.setMatrixAt(i, plants[i].matrixWorld);
        batch.setColorAt(i, plants[i].material.color);
      }
      batch.computeBoundingSphere();
      root.add(batch);
    }
  }

  function shadow(scene, x = 0, y = .014, z = 0, w = .55, d = .35) {
    const mesh = new T.Mesh(circle, shadowMaterial);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, d, 1);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    return mesh;
  }

  function tree(root, x, z, size, rand, tint, palm = false) {
    const h = (palm ? 2.15 : 1.83) * size;
    const lean = (rand() - .5) * size * .40;
    beam(root, '#624c3a', [x, -.05, z], [x + lean, h, z], size * .13);
    if (palm) {
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const leaf = facet(root, mix(tint, .70 + rand() * .36),
          x + lean + Math.cos(angle) * size * .47, h, z + Math.sin(angle) * size * .47,
          .96 * size, .09 * size, .27 * size);
        leaf.rotation.y = -angle;
        leaf.rotation.z = -.20;
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const ta = i * Math.PI * .67, off = i === 3 ? 0 : .39 * size;
        facet(root, mix(tint, .72 + rand() * .43), x + lean + Math.cos(ta) * off, h + (i === 3 ? .36 : 0) * size,
          z + Math.sin(ta) * off, (.67 + rand() * .16) * size, (.52 + rand() * .33) * size, .73 * size);
      }
    }
  }

  function grass(root, x, z, rand, tall, cave = false) {
    for (let blade = 0; blade < (tall ? 7 : 3); blade++) {
      const ox = x + (rand() - .5) * .74, oz = z + (rand() - .5) * .78;
      const height = (tall ? .29 : .099) * (.56 + rand() * .67);
      const col = cave ? '#777287' : tall ? (blade % 2 === 0 ? '#859955' : '#536d40') : '#879664';
      const point = facet(root, mix(col, .79 + rand() * .26), ox, height * .58, oz, .047, height, .031);
      point.rotation.set((rand() - .5) * .7, rand() * 6, (rand() - .5) * .67);
    }
  }

  function stones(root, x, z, rand, colors, large) {
    for (let i = 0; i < (large ? 2 : 1); i++) {
      const h = (large ? .53 : .072) * (.56 + rand() * .79);
      const stone = facet(root, mix(colors, .69 + rand() * .47), x + (rand() - .5) * .46, h * .65, z + (rand() - .5) * .43, h * 1.1, h, h * .75);
      stone.rotation.y = rand() * 6;
    }
  }

  function building(meshes, b, i) {
    const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
    const w = b.w - .12, d = b.h - .12, eave = i === 3 || i === 5 ? 1.95 : 1.56;
    block(meshes, mix(b.wallColor, .59), cx, .11, cz, w + .09, .24, d + .09);
    block(meshes, b.wallColor, cx, eave / 2, cz, w, eave, d);
    const front = cz + d * .5;
    block(meshes, '#4d4138', b.doorX + .50, .57, front + .032, .60, 1.14, .075);
    block(meshes, '#9e7e51', b.doorX + .50, 1.21, front + .071, .81, .13, .19);
    for (let x = b.x; x < b.x + b.w; x++) {
      if (x === b.doorX) continue;
      block(meshes, '#766955', x + .5, .99, front + .037, .51, .55, .09);
      block(meshes, '#527b7b', x + .5, .99, front + .089, .40, .42, .042);
      block(meshes, '#d9caa2', x + .5, .99, front + .119, .44, .035, .04);
    }
    for (const face of [-1, 1]) {
      const rafters = block(meshes, b.roofColor, cx, eave + .29, cz + face * d * .271, w + .29, .14, d * .61);
      rafters.rotation.x = .37 * face;
      for (let j = 0; j <= 9; j++) {
        const strip = block(meshes, mix(b.roofColor, j % 2 === 0 ? .73 : .88), cx - w * .46 + j * w * .102,
          eave + .365, cz + face * d * .270, .043, .052, d * .58);
        strip.rotation.x = .37 * face;
      }
    }
    block(meshes, mix(b.roofColor, .63), cx, eave + .61, cz, w + .33, .113, .19);
  }

  function buildWorld(data) {
    world = data;
    worldScene = new T.Scene();
    setupLights(worldScene);
    const tiles = new T.Group();
    const scenery = new T.Group();
    const water = new T.Group();
    const waterGeo = new T.PlaneGeometry(1.005, 1.005);
    const groundGeo = new T.PlaneGeometry(8.04, 8.04, 3, 3);
    const hillGrass = ['#63785b', '#687f61', '#647b59'].map((color) => new T.MeshBasicMaterial({ color }));
    for (let y = -24; y < data.rows + 24; y += 8) {
      for (let x = -24; x < data.cols + 24; x += 8) {
        const ground = new T.Mesh(groundGeo, hillGrass[Math.abs(x * 19 + y * 13) % hillGrass.length]);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(x + 4, -.17, y + 4);
        worldScene.add(ground);
      }
    }
    const borderRandom = random(4912);
    for (let y = -10; y < data.rows + 10; y += 2.2) {
      for (let x = -10; x < data.cols + 10; x += 2.5) {
        if (x >= -1 && x <= data.cols + 1 && y >= -1 && y <= data.rows + 1) continue;
        if (borderRandom() < .35) continue;
        tree(scenery, x + borderRandom(), y + borderRandom(), .75 + borderRandom() * .55, borderRandom, '#526b45');
      }
    }
    for (let r = 0; r < data.rows; r++) {
      for (let c = 0; c < data.cols; c++) {
        const code = data.tiles[r][c], x = c + .5, z = r + .5;
        const region = data.getZoneAt(c, r).scene;
        const style = palette[region] || palette.jardim;
        const rand = random(801 + c * 12253 + r * 76519);
        const cave = region === 'caverna';
        const village = c <= 16 && r >= 13;
        const color =
          village && (code === 1 || code === 7) ? '#aa7850' :
          village && (code === 0 || code === 8) ? '#a2a953' :
          code === 1 || code === 7 ? style.ground :
          code === 2 ? '#596e47' :
          code === 8 ? '#657850' :
          code === 9 ? (cave ? '#777384' : '#a29d80') :
          code === 12 ? '#b4a47e' :
          code === 16 ? '#474453' : style.grass;
        if (code === 3 || code === 10) {
          const surface = new T.Mesh(waterGeo, waterMaterial);
          surface.rotation.x = -Math.PI / 2;
          surface.position.set(x, -.119, z);
          water.add(surface);
          for (let i = 0; i < 2; i++) block(scenery, '#85b6ab', x + (rand() - .5) * .53, -.114,
            z + (rand() - .5) * .70, .13 + rand() * .26, .006, .015);
        } else {
          block(tiles, mix(color, .91 + rand() * .16), x, -.129, z, 1, .26, 1);
        }

        if ((code === 4 || code === 13) && !HM.BrowserScenery.hasPlant(c,r)) tree(scenery, x, z, .65 + rand() * .49, rand, style.tree, code === 13);
        if (code === 15) stones(scenery, x, z, rand, '#9994a0', true);
        if ((code === 0 && rand() > .46) || code === 2 || code === 8 || code === 16) grass(scenery, x, z, rand, code === 2 || code === 16, cave);
        if ((code === 1 || code === 14) && rand() > .7) stones(scenery, x, z, rand, '#a49b7f', false);
        if (code === 8) for (let i = 0; i < 3; i++) facet(scenery, i % 2 ? '#e3b27d' : '#ddb586',
          x + (rand() - .5) * .78, .12 + rand() * .091, z + (rand() - .5) * .68, .065, .044, .055);
        if (code === 9) for (let k = -1; k <= 1; k += 2) block(scenery, mix(color, .83), x, .005, z + k * .235, .88, .008, .014);
        if (code === 5) {
          block(scenery, '#756047', x, .38, z, .14, .76, .14);
          block(scenery, '#a1845e', x, .30, z, 1.03, .095, .083);
          block(scenery, '#a1845e', x, .56, z, 1.03, .097, .086);
        }
        if (code === 10 && !HM.BrowserScenery.bridge(c,r)) {
          const turn = data.tiles[r]?.[c - 1] === 3 || data.tiles[r]?.[c + 1] === 3;
          for (let i = 0; i < 6; i++) {
            const gap = (i - 2.5) / 6;
            block(scenery, mix('#a78b68', .76 + rand() * .32), x + (turn ? 0 : gap), .018, z + (turn ? gap : 0),
              turn ? 1.0 : .156, .103, turn ? .156 : 1.0);
          }
        }
        if (code === 11) block(scenery, '#82765a', x, .47, z, 1.01, .94, .72);
      }
    }
    data.buildings.forEach((b, i) => { if (!HM.BrowserScenery.hasFacade(b)) building(scenery, b, i); });
    HM.BrowserScenery.add(worldScene, data.buildings);
    mergePlants(worldScene, tiles);
    mergePlants(worldScene, scenery);
    ocean = water;
    worldScene.add(water);
    npcs = data.npcs.map(function (npc) {
      const actor = billboard(npc.x + .5, npc.y + .5);
      return { npc, actor, shade: shadow(worldScene, npc.x + .5, undefined, npc.y + .5) };
    });
    playerActor = billboard();
    leadActor = billboard();
    playerShadow = shadow(worldScene);
    leadShadow = shadow(worldScene, 0, .015, 0, .26, .20);
    marker = new T.Mesh(new T.RingGeometry(.17, .24, 32), targetMaterial);
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    worldScene.add(marker);
  }

  function project(point, cam, width, height) {
    screen.copy(point).project(cam);
    return { x: (screen.x + 1) * width * .5, y: (1 - screen.y) * height * .5, z: screen.z };
  }

  function worldPoint(x, y, width, height, camera, out, elevation = 0) {
    cursor.set(x / width * 2 - 1, 1 - y / height * 2);
    ray.setFromCamera(cursor, camera);
    plane.constant = -elevation;
    return ray.ray.intersectPlane(plane, out);
  }

  function renderOverworld(canvas, options) {
    if (!setup(canvas)) return false;
    try {
      if (world !== options.world) buildWorld(options.world);
      const now = options.time || 0;
      const player = options.player;
      const px = player.renderX + .5, pz = player.renderY + .5;
      const height = lastHeight, width = lastWidth;
      worldCamera.aspect = width / height;
      worldCamera.fov = width / height < .86 ? 49 : 40;
      worldCamera.updateProjectionMatrix();
      const snap = oldCamera !== canvas || cameraRevision !== options.cameraRevision;
      if (snap) { cameraX = px; cameraZ = pz; }
      const dt = Math.max(0, Math.min(.12, (now - (worldTime ?? now)) / 1000));
      const fraction = 1 - Math.exp(-dt * 12);
      cameraX += (px - cameraX) * fraction;
      cameraZ += (pz - cameraZ) * fraction;
      cameraBlend += (cameraMode - cameraBlend) * (snap ? 1 : 1 - Math.exp(-dt * 8));
      orbit += (orbitTarget - orbit) * (snap ? 1 : 1 - Math.exp(-dt * 12));
      const cos = Math.cos(orbit), sin = Math.sin(orbit);
      const narrow = width / height < .86;
      const lateral = 4.4 - 1.7 * cameraBlend, distance = 8.8 - 2 * cameraBlend;
      const lookAhead = narrow ? 1.10 : 1.15 + .95 * cameraBlend;
      worldCamera.position.set(cameraX + lateral * cos + distance * sin, 9.5 - 4.15 * cameraBlend,
        cameraZ + distance * cos - lateral * sin);
      cameraTarget.set(cameraX - lookAhead * sin, .28 + .57 * cameraBlend, cameraZ - lookAhead * cos);
      worldCamera.lookAt(cameraTarget);
      worldCamera.updateMatrixWorld();
      const sector = Math.round((orbit + Math.atan2(lateral, distance + lookAhead)) / (Math.PI / 2));
      worldTime = now;
      oldCamera = canvas;
      cameraRevision = options.cameraRevision;

      const region = world.getZoneAt(player.x, player.y).scene;
      if (worldScene.userData.region !== region) {
        atmosphere(worldScene, palette[region] || palette.jardim);
        worldScene.userData.region = region;
      }
      const previewAvatar = HM.CharacterArt.ready();
      const bounce = !previewAvatar && player.moving ? Math.abs(Math.sin(player.distance * Math.PI * 2)) * .035 : .006;
      playerActor.position.set(px, .022 + bounce, pz);
      const frame = player.moving ? player.walkFrame : 0;
      const playerView = turnDirection(player.dir, sector);
      paintBillboard(playerActor, [previewAvatar, playerView, player.moving, frame].join('/'), previewAvatar ? 1.55 : 1.17, .72,
        (ctx, x, feet, size) => previewAvatar
          ? HM.CharacterArt.drawPlayer(ctx, x, feet, size, playerView, frame, player.moving)
          : drawCharacter(ctx, 'player', playerView, frame, x, feet, size));
      playerShadow.position.set(px, .014, pz);
      playerShadow.scale.set(previewAvatar ? .33 : .55, previewAvatar ? .23 : .35, 1);
      leadActor.visible = false;
      leadShadow.visible = Boolean(options.lead);
      if (options.lead) {
        const { follower, lead } = options;
        const facing = HM.Motion.facing(turnDirection(follower.dir, sector));
        leadShadow.position.set(follower.x + .5, .015, follower.y + .5);
        leadActor.position.set(follower.x + .5, .04 + follower.hop, follower.y + .5);
        paintBillboard(leadActor, [lead.speciesId, Boolean(lead.golden), facing].join('/'), .71, 1.16,
          (ctx, x, feet, size) => {
            HM.Sprites.drawCreature(ctx, lead.speciesId, x, feet - size * .39, size,
              { golden: lead.golden, facing, shadow: false });
            return true;
          });
      }
      for (const entry of npcs) {
        const { npc, actor, shade } = entry;
        const visible = !options.hidden(npc);
        actor.visible = shade.visible = visible;
        if (!visible) continue;
        const dir = turnDirection(options.facings[npc.id] || npc.dir || 'down', sector);
        const hasArt = HM.CharacterArt.npcReady(npc.id);
        const height = hasArt ? 1.49 : npc.role === 'sign' ? .79 : 1.16;
        paintBillboard(actor, [hasArt, dir].join('/'), height, .72, (ctx, x, feet, size) => hasArt
          ? HM.CharacterArt.drawNpc(ctx, npc.id, x, feet, size, dir)
          : drawCharacter(ctx, npc.style || npc.role || 'prof', dir, 0, x, feet, size));
      }
      walkTarget = options.target;
      marker.visible = Boolean(walkTarget);
      if (walkTarget) marker.position.set(walkTarget.x + .5, .055, walkTarget.y + .5);
      marker.scale.setScalar(1 + Math.sin(now / 210) * .22);
      ocean.position.y = Math.sin(now / 750) * .011;
      if (renderer.render(worldScene, worldCamera) !== false) {
        shownCamera.copy(worldCamera);
        shownSector = sector;
      }
      worldRendered = true;
      return true;
    } catch (error) {
      console.warn('[HortaMon 3D]', error);
      fail();
      return false;
    }
  }

  function hitWorld(x, y, width, height, tryNpc = false) {
    if (!isOverworldActive()) return null;
    if (tryNpc) {
      let best, closest = 1;
      for (const entry of npcs) {
        if (!entry.actor.visible) continue;
        const base = project(aim.copy(entry.actor.position), shownCamera, width, height);
        const head = project(aim.copy(entry.actor.position).add(new T.Vector3(0, entry.npc.role === 'sign' ? 1.13 : 1.56, 0)),
          shownCamera, width, height);
        const dx = Math.abs(x - base.x), max = Math.max(12, (base.y - head.y) * .31);
        if (base.z < closest && base.z > -1 && dx <= max && y >= head.y - 3 && y <= base.y + 4) {
          best = entry.npc;
          closest = base.z;
        }
      }
      if (best) return { x: best.x + .5, z: best.y + .5, npc: best };
    }
    const point = worldPoint(x, y, width, height, shownCamera, aim);
    return point && { x: point.x, z: point.z, npc: null };
  }

  function npcMarker(npc, width, height) {
    if (!worldRendered) return null;
    return project(aim.set(npc.x + .5, npc.role === 'sign' ? 1.31 : 1.79, npc.y + .5), shownCamera, width, height);
  }

  function turnDirection(dir, sector) {
    const index = directions.indexOf(dir);
    return index < 0 ? 'down' : directions[((index + sector) % 4 + 4) % 4];
  }

  function buildArena(region) {
    const scene = new T.Scene();
    const randomArena = random(819);
    const base = palette[region] || palette.jardim;
    atmosphere(scene, base);
    setupLights(scene);
    const meshes = new T.Group();
    for (let z = -27; z <= 16; z += 2)
    for (let x = -27; x <= 27; x += 2) {
      const arenaFloor = Math.abs(x) <= 8 && z >= -4 && z <= 10;
      block(meshes, mix(arenaFloor ? base.ground : base.grass, .92 + randomArena() * .09), x, -.16, z, 2, .32, 2);
    }
    for (let i = 0; i < 102; i++) {
      const x = (randomArena() - .5) * 49, z = (randomArena() - .86) * 26;
      if (Math.abs(x) < 7 && z > -4.5 && z < 7) continue;
      if (region === 'caverna') stones(meshes, x, z, randomArena, base.tree, true);
      else tree(meshes, x, z, 1.1 + randomArena() * 1.1, randomArena, base.tree, region === 'tropical');
    }
    for (let i = 0; i < 31; i++) {
      const x = (randomArena() - .5) * 19, z = (randomArena() - .74) * 27;
      if (Math.abs(x) > 6.5 || z < -4.6) grass(meshes, x, z, randomArena, false, region === 'caverna');
    }
    mergePlants(scene, meshes);

    const platforms = ['#6c8a72', '#a98060'].map((col) => {
      const group = new T.Group();
      const baseGeo = new T.CylinderGeometry(1, 1.1, .17, 36);
      const topGeo = new T.CylinderGeometry(.95, 1, .095, 36);
      const bottom = new T.Mesh(baseGeo, paint(mix(col, .65)));
      bottom.position.y = .091;
      group.add(bottom);
      const top = new T.Mesh(topGeo, paint(col));
      top.position.y = .209;
      group.add(top);
      shadow(group, 0, .258, 0, .66, .42);
      scene.add(group);
      return group;
    });

    return { scene, platforms };
  }

  function battleSide(arena, width, height, layout, index) {
    const x = index === 0 ? layout.playerPlatformX : layout.enemyPlatformX;
    const y = index === 0 ? layout.playerPlatformY : layout.enemyPlatformY;
    const ground = worldPoint(x, y, width, height, battleCamera, aim, .23);
    if (!ground) return;
    arena.platforms[index].position.set(ground.x, 0, ground.z);
    const baseScale = Math.min(1.36, 1.07 * (width / height) + .10);
    arena.platforms[index].scale.set(baseScale, 1, baseScale);
  }

  function renderBattle(canvas, region, layout) {
    if (!setup(canvas)) return false;
    try {
      if (!arenas[region]) arenas[region] = buildArena(region);
      const arena = arenas[region], { W, H } = layout;
      battleCamera.aspect = lastWidth / lastHeight;
      battleCamera.position.set(0, 5.5, 9.15);
      battleCamera.lookAt(0, .85, -.25);
      battleCamera.updateProjectionMatrix();
      battleCamera.updateMatrixWorld();
      battleScene3d = arena.scene;
      arena.platforms.forEach((_, i) => battleSide(arena, W, H, layout, i));
      renderer.render(battleScene3d, battleCamera);
      return true;
    } catch (error) {
      console.warn('[HortaMon 3D]', error);
      fail();
      return false;
    }
  }

  document.getElementById('btn-view-3d')?.addEventListener('click', function (event) {
    cameraMode = 1 - cameraMode;
    event.currentTarget.textContent = cameraMode ? 'Câmera alta' : 'Câmera baixa';
  });

  function canOrbit() {
    return isOverworldActive() && mapCanvas?.closest('.screen')?.classList.contains('active') &&
      !HM.Overworld?.isPaused();
  }

  document.getElementById('btn-rotate-left')?.addEventListener('click', () => { if (canOrbit()) orbitTarget -= orbitStep; });
  document.getElementById('btn-rotate-right')?.addEventListener('click', () => { if (canOrbit()) orbitTarget += orbitStep; });
  window.addEventListener('keydown', event => {
    const turn = event.code === 'KeyQ' ? -1 : event.code === 'KeyR' ? 1 : 0;
    if (!turn || !canOrbit() || event.ctrlKey || event.metaKey || event.altKey ||
      event.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    if (!event.repeat) orbitTarget += turn * orbitStep;
  });
  mapCanvas?.addEventListener('pointerdown', event => {
    if (event.button !== 2 || !canOrbit()) return;
    event.preventDefault();
    dragPointer = event.pointerId;
    dragX = event.clientX;
    mapCanvas.setPointerCapture(dragPointer);
  });
  mapCanvas?.addEventListener('pointermove', event => {
    if (event.pointerId !== dragPointer || !canOrbit()) return;
    if (event.buttons & 2) orbitTarget -= (event.clientX - dragX) * .007;
    dragX = event.clientX;
  });
  mapCanvas?.addEventListener('lostpointercapture', event => {
    if (event.pointerId === dragPointer) dragPointer = null;
  });
  mapCanvas?.addEventListener('contextmenu', event => { if (canOrbit()) event.preventDefault(); });

  HM.Scene3D = {
    renderOverworld, renderBattle, hitWorld, npcMarker, isOverworldActive,
    worldDirection: dir => isOverworldActive() ? turnDirection(dir, -shownSector) : dir
  };
})(window);
