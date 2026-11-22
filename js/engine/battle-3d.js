(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  // =========================================================================
  // COORDENADAS BASE DO DIORAMA 3D DA ARENA DE BATALHA
  // =========================================================================
  const PLAYER_POS = { x: -2.2, y: 0.18, z: 1.7 };
  const ENEMY_POS = { x: 2.55, y: 0.18, z: -1.75 };

  const CAM_BASE_POS = { x: -0.15, y: 3.85, z: 10.65 };
  const CAM_BASE_TARGET = { x: 0.0, y: 1.32, z: -0.05 };

  // =========================================================================
  // ESTADO INTERNO DO RENDERIZADOR 3D
  // =========================================================================
  let renderer = null;
  let glCanvas = null;
  let overlayCanvas = null;
  let contextLost = false;

  let scene = null;
  let camera = null;
  let biomeGroup = null;
  let dynamicGroup = null;

  let active = false;
  let currentBiome = 'jardim';
  let sceneTime = 0;

  // Controle de descarte limpo (nunca descartar texturas cacheadas do HM.HD2D!)
  let ownedGeometries = [];
  let ownedMaterials = [];
  let ownedTextures = [];

  // Standees das criaturas HD-2D
  let playerStandee = null;
  let enemyStandee = null;
  let playerSpecKey = '';
  let enemySpecKey = '';
  let playerStageScale = 1;
  let enemyStageScale = 1;
  let playerAuraRing = null;
  let enemyAuraRing = null;
  let playerStatusGroup = null;
  let enemyStatusGroup = null;
  let playerGoldenGroup = null;
  let enemyGoldenGroup = null;

  // Vaso de Captura 3D real
  let potRoot = null;
  let potMeshGroup = null;
  let potLidGroup = null;
  let potBeamMesh = null;
  let potInnerGlow = null;
  let potLight = null;
  let potBuiltSuper = null;

  // Elementos animados do bioma
  let biomeAnimItems = []; // nuvens, coqueiros, água, cestos, cristais, raios
  let ambientParticles = []; // pólen, pétalas, esporos
  let crystalLights = [];
  let impactLight = null;
  let impactLightLife = 0;

  // Partículas 3D de golpes e captura
  let fxParticles = [];
  let sharedFxGeos = null;

  // Câmera cinematográfica
  let camFocusMode = 'idle'; // 'idle' | 'attack_player' | 'attack_enemy' | 'hit_player' | 'hit_enemy' | 'capture_throw' | 'capture_wobble' | 'capture_win' | 'evolve'
  let camFocusTimer = 0;
  let camCurPos = null;
  let camCurTarget = null;
  let camShakeTime = 0;
  let camShakeDur = 0;
  let camShakeIntensity = 0;

  // Cache de retângulo da camada para evitar reflow desnecessário
  let lastRect = { left: -1, top: -1, width: -1, height: -1 };

  // =========================================================================
  // HELPERS DE MEMÓRIA E MATEMÁTICA
  // =========================================================================
  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function trackGeo(g) {
    ownedGeometries.push(g);
    return g;
  }

  function trackMat(m) {
    ownedMaterials.push(m);
    return m;
  }

  function getThree() {
    return global.THREE || null;
  }

  function canRun3D() {
    const THREE = getThree();
    if (!THREE || contextLost) return false;
    if (!HM.HD2D || typeof HM.HD2D.isAvailable !== 'function') return false;
    if (!HM.HD2D.isAvailable()) return false;
    if (typeof HM.HD2D.isEnabled === 'function' && !HM.HD2D.isEnabled()) return false;
    return true;
  }

  function resolveBiomeKey(sceneKey, battleType, trainerNpc) {
    if (battleType === 'leader') {
      if (
        sceneKey === 'caverna' ||
        (trainerNpc && (trainerNpc.style === 'leader2' || trainerNpc.id === 'leader_mandi'))
      ) {
        return 'leader2';
      }
      return 'leader';
    }
    if (sceneKey === 'tropical') return 'tropical';
    if (sceneKey === 'caverna') return 'caverna';
    return 'jardim';
  }

  function getCreatureStageScale(creature) {
    if (!creature) return 1;
    const sp = HM.SPECIES && HM.SPECIES[creature.speciesId];
    const stage = sp ? sp.stage : 2;
    return (HM.LIFE_STAGES && HM.LIFE_STAGES[stage] && HM.LIFE_STAGES[stage].battleScale) || 1;
  }

  // =========================================================================
  // GERENCIAMENTO DA CAMADA WEBGL (2 CAMADAS: 3D ATRÁS + 2D OVERLAY NA FRENTE)
  // =========================================================================
  function ensureCanvasLayer(targetOverlayCanvas) {
    if (!targetOverlayCanvas || !targetOverlayCanvas.parentNode) return false;
    const parent = targetOverlayCanvas.parentNode;

    // Garantir container posicionado sem quebrar CSS Grid de .battle-stage
    try {
      const computed = global.getComputedStyle ? global.getComputedStyle(parent) : null;
      if (computed && computed.position === 'static') {
        parent.style.position = 'relative';
      }
    } catch (_) {
      parent.style.position = 'relative';
    }

    if (!glCanvas) {
      glCanvas = document.createElement('canvas');
      glCanvas.className = 'battle-3d-layer';
      glCanvas.setAttribute('aria-hidden', 'true');
      glCanvas.style.position = 'absolute';
      glCanvas.style.inset = 'auto';
      glCanvas.style.pointerEvents = 'none';
      glCanvas.style.zIndex = '1';
      glCanvas.style.display = 'none';

      glCanvas.addEventListener('webglcontextlost', function (ev) {
        ev.preventDefault();
        contextLost = true;
        active = false;
        if (glCanvas) glCanvas.style.display = 'none';
      });
      glCanvas.addEventListener('webglcontextrestored', function () {
        contextLost = false;
      });
    }

    if (glCanvas.parentNode !== parent) {
      parent.insertBefore(glCanvas, targetOverlayCanvas);
    }

    // Garantir que o canvas 2D fique exatamente acima e transparente
    targetOverlayCanvas.style.position = 'relative';
    targetOverlayCanvas.style.zIndex = '2';
    targetOverlayCanvas.style.background = 'transparent';

    if (!renderer) {
      const w = Math.max(320, targetOverlayCanvas.clientWidth || targetOverlayCanvas.width || 760);
      const h = Math.max(200, targetOverlayCanvas.clientHeight || targetOverlayCanvas.height || 480);
      try {
        renderer = HM.HD2D.createRenderer(glCanvas, w, h);
      } catch (err) {
        console.warn('[HortaMon Battle3D] Falha ao criar WebGLRenderer, usando fallback 2D:', err);
        renderer = null;
        return false;
      }
    }

    return Boolean(renderer);
  }

  function syncCanvasBounds() {
    if (!glCanvas || !overlayCanvas || !renderer || !camera) return;
    const left = overlayCanvas.offsetLeft || 0;
    const top = overlayCanvas.offsetTop || 0;
    const w = Math.max(1, overlayCanvas.clientWidth || overlayCanvas.width || 760);
    const h = Math.max(1, overlayCanvas.clientHeight || overlayCanvas.height || 480);

    if (
      lastRect.left !== left ||
      lastRect.top !== top ||
      lastRect.width !== w ||
      lastRect.height !== h
    ) {
      lastRect = { left: left, top: top, width: w, height: h };
      glCanvas.style.left = left + 'px';
      glCanvas.style.top = top + 'px';
      glCanvas.style.width = w + 'px';
      glCanvas.style.height = h + 'px';
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  // =========================================================================
  // CONSTRUÇÃO DOS 5 BIOMAS 3D DA ARENA
  // =========================================================================
  function getTexSafe(textures, name) {
    if (!textures || !textures[name]) return null;
    return textures[name];
  }

  function getTiledTex(textures, name, rx, ry) {
    const base = getTexSafe(textures, name);
    if (!base || typeof base.clone !== 'function') return base;
    const THREE = getThree();
    const cloned = base.clone();
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.repeat.set(rx || 1, ry || 1);
    cloned.encoding = THREE.sRGBEncoding;
    cloned.userData = { _hd2dShared: false };
    cloned.needsUpdate = true;
    ownedTextures.push(cloned);
    return cloned;
  }

  function buildBiome(biomeKey) {
    const THREE = getThree();
    const textures = HM.HD2D && typeof HM.HD2D.getTextures === 'function' ? HM.HD2D.getTextures() : {};
    const presets = (HM.HD2D && HM.HD2D.BIOME_PRESETS) || {};

    biomeGroup = new THREE.Group();
    scene.add(biomeGroup);

    biomeAnimItems = [];
    ambientParticles = [];
    crystalLights = [];

    if (biomeKey === 'leader') {
      buildGoldenGreenhouseBiome(THREE, textures, presets.arena);
    } else if (biomeKey === 'tropical') {
      buildTropicalOrchardBiome(THREE, textures, presets.tropical);
    } else if (biomeKey === 'caverna' || biomeKey === 'leader2') {
      buildSubterraneanBiome(THREE, textures, presets.caverna, biomeKey === 'leader2');
    } else {
      buildSunnyGardenBiome(THREE, textures, presets.jardim);
    }

    // 2 Plataformas 3D da batalha (Jogador frente-esquerda, Inimigo fundo-direita)
    buildBattlePlatform(THREE, textures, PLAYER_POS.x, PLAYER_POS.z, 1.68, biomeKey, true);
    buildBattlePlatform(THREE, textures, ENEMY_POS.x, ENEMY_POS.z, 1.56, biomeKey, false);

    // Luz dinâmica temporária para impacto de golpes / captura
    impactLight = new THREE.PointLight('#fffbeb', 0, 9, 1.6);
    impactLight.position.set(0, 2.2, 0);
    scene.add(impactLight);
  }

  function addSkyAndLights(THREE, cfg) {
    // SkyDome via HM.HD2D (raio 125, bem dentro do far plane 320 da câmera)
    if (HM.HD2D && typeof HM.HD2D.createSkyDome === 'function') {
      const dome = HM.HD2D.createSkyDome(cfg.skyTop, cfg.skyMid, cfg.skyBottom);
      if (dome) {
        biomeGroup.add(dome);
        if (dome.geometry) trackGeo(dome.geometry);
        if (dome.material) trackMat(dome.material);
      }
    }
    scene.background = new THREE.Color(cfg.fogColor);
    scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);

    const hemi = new THREE.HemisphereLight(cfg.hemiSky, cfg.hemiGround, cfg.hemiIntensity);
    biomeGroup.add(hemi);

    const sun = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
    // Normalizar distância do sol para ~18 unidades para sombra nítida em todos os biomas
    const sVec = new THREE.Vector3(cfg.sunPos[0], cfg.sunPos[1], cfg.sunPos[2]);
    if (sVec.lengthSq() > 0.01) sVec.normalize().multiplyScalar(18);
    sun.position.copy(sVec);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 52;
    const d = 10.5;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    biomeGroup.add(sun);

    // Luz de preenchimento suave do lado oposto para os standees ficarem radiantes
    const fill = new THREE.DirectionalLight(cfg.fillColor || '#fff7ed', cfg.fillIntensity || 0.35);
    fill.position.set(-sVec.x * 0.55, 5.5, 7);
    biomeGroup.add(fill);
  }

  // -------------------------------------------------------------------------
  // BIOMA 1: JARDIM ENSOLARADO ('jardim')
  // -------------------------------------------------------------------------
  function buildSunnyGardenBiome(THREE, textures, preset) {
    const p = preset || {};
    addSkyAndLights(THREE, {
      skyTop: p.skyTop || '#3ea8f4',
      skyMid: p.skyMid || '#9de0ff',
      skyBottom: p.skyBottom || '#eefce6',
      fogColor: p.fogColor || '#d7f2dc',
      fogNear: 18,
      fogFar: 46,
      sunColor: p.sunColor || '#fff6d6',
      sunIntensity: p.sunIntensity || 1.28,
      hemiSky: p.hemiSky || '#b8e8ff',
      hemiGround: p.hemiGround || '#4d8b3f',
      hemiIntensity: p.hemiIntensity || 0.78,
      sunPos: p.sunPos || [-9, 13, 8],
      fillColor: '#fffbeb',
      fillIntensity: 0.32
    });

    // Platô principal gramado 3D (textura tiled nítida)
    const grassTex = getTiledTex(textures, 'grass', 10, 10);
    const groundMat = trackMat(new THREE.MeshStandardMaterial({
      map: grassTex,
      color: grassTex ? '#ffffff' : '#52c456',
      roughness: 0.9,
      metalness: 0.02
    }));
    const ground = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(18, 20, 1.2, 40)), groundMat);
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    biomeGroup.add(ground);

    // Trilha de terra suave cruzando o fundo do gramado
    const dirtTex = getTiledTex(textures, 'dirt', 8, 1.5);
    const pathMat = trackMat(new THREE.MeshStandardMaterial({
      map: dirtTex,
      color: dirtTex ? '#f5e4c8' : '#c69964',
      roughness: 0.94
    }));
    const pathPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(24, 2.6)), pathMat);
    pathPlane.rotation.x = -Math.PI / 2;
    pathPlane.rotation.z = -0.18;
    pathPlane.position.set(0, 0.015, -0.15);
    pathPlane.receiveShadow = true;
    biomeGroup.add(pathPlane);

    // Colinas verdejantes 3D ao fundo
    const hillMat1 = trackMat(new THREE.MeshStandardMaterial({ color: '#45b852', roughness: 0.92 }));
    const hillMat2 = trackMat(new THREE.MeshStandardMaterial({ color: '#6fd86c', roughness: 0.92 }));
    const hills = [
      [-11, -1.6, -15, 7.5, 4.4, 6.2, hillMat1],
      [-2.5, -2.0, -17, 9.2, 5.1, 7.0, hillMat2],
      [7.8, -1.5, -15.5, 8.2, 4.7, 6.5, hillMat1],
      [15, -2.1, -12, 6.8, 3.6, 5.5, hillMat2]
    ];
    for (let i = 0; i < hills.length; i++) {
      const h = hills[i];
      const hm = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 20, 14)), h[6]);
      hm.position.set(h[0], h[1], h[2]);
      hm.scale.set(h[3], h[4], h[5]);
      biomeGroup.add(hm);
    }

    // Cerca de madeira 3D curvada ao fundo
    const woodTex = getTexSafe(textures, 'wood');
    const fenceMat = trackMat(new THREE.MeshStandardMaterial({
      map: woodTex,
      color: woodTex ? '#f5d7b0' : '#b7793f',
      roughness: 0.85
    }));
    const postGeo = trackGeo(new THREE.BoxGeometry(0.18, 1.05, 0.14));
    const capGeo = trackGeo(new THREE.ConeGeometry(0.13, 0.2, 4));
    const railGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.12, 0.08));

    for (let i = -8; i <= 8; i++) {
      const ang = i * 0.115;
      const r = 8.4;
      const fx = Math.sin(ang) * r;
      const fz = -Math.cos(ang) * r + 1.1;

      const post = new THREE.Mesh(postGeo, fenceMat);
      post.position.set(fx, 0.52, fz);
      post.rotation.y = -ang;
      post.castShadow = true;
      post.receiveShadow = true;
      biomeGroup.add(post);

      const cap = new THREE.Mesh(capGeo, fenceMat);
      cap.position.set(fx, 1.14, fz);
      cap.rotation.y = -ang + Math.PI * 0.25;
      biomeGroup.add(cap);

      if (i < 8) {
        const nextAng = (i + 1) * 0.115;
        const midAng = (ang + nextAng) * 0.5;
        const mx = Math.sin(midAng) * r;
        const mz = -Math.cos(midAng) * r + 1.1;
        for (let row = 0; row < 2; row++) {
          const rail = new THREE.Mesh(railGeo, fenceMat);
          rail.position.set(mx, row === 0 ? 0.34 : 0.72, mz);
          rail.rotation.y = -midAng;
          rail.castShadow = true;
          biomeGroup.add(rail);
        }
      }
    }

    // Árvores frutíferas cartoon 3D atrás da cerca
    const treePositions = [
      { x: -7.8, z: -7.5, s: 1.2, fruit: '#ef4444' },
      { x: -4.2, z: -9.4, s: 1.0, fruit: '#facc15' },
      { x: 0.8, z: -9.9, s: 1.15, fruit: '#fb923c' },
      { x: 5.8, z: -8.8, s: 1.25, fruit: '#ef4444' },
      { x: 8.8, z: -5.4, s: 1.05, fruit: '#facc15' },
      { x: -9.0, z: -3.2, s: 0.95, fruit: '#fb923c' }
    ];
    for (let i = 0; i < treePositions.length; i++) {
      const tp = treePositions[i];
      addFruitTree3D(THREE, textures, tp.x, tp.z, tp.s, tp.fruit, i);
    }

    // Flores 3D coloridas e tufinhos de grama
    const flowerPalette = ['#fde047', '#f472b6', '#ffffff', '#fb923c', '#c084fc'];
    const flowerSpots = [
      [-5.5, 1.2], [-4.8, -1.8], [-3.2, -4.6], [-0.4, -4.8], [3.6, -5.2],
      [5.9, -2.5], [5.4, 1.4], [1.4, 3.6], [-0.9, 3.4], [4.2, 2.8],
      [-6.1, -3.5], [6.4, -4.1], [-1.8, -2.9], [1.1, -3.4]
    ];
    for (let i = 0; i < flowerSpots.length; i++) {
      addFlowerCluster3D(THREE, flowerSpots[i][0], flowerSpots[i][1], flowerPalette[i % flowerPalette.length], i);
    }

    // Sol suave no céu + nuvens 3D flutuando
    const sunDisc = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(1.4, 16, 16)),
      trackMat(new THREE.MeshBasicMaterial({ color: '#fef08a', fog: false }))
    );
    sunDisc.position.set(-12, 11.5, -22);
    biomeGroup.add(sunDisc);

    const cloudConfigs = [
      { x: -11, y: 7.4, z: -18, s: 1.35, speed: 0.55 },
      { x: -1.5, y: 8.6, z: -20, s: 1.1, speed: 0.42 },
      { x: 8.5, y: 7.1, z: -17, s: 1.25, speed: 0.5 },
      { x: 15, y: 8.1, z: -19, s: 0.95, speed: 0.36 }
    ];
    for (let i = 0; i < cloudConfigs.length; i++) {
      addCloud3D(THREE, cloudConfigs[i]);
    }

    // Pólen dourado flutuando em 3D
    spawnAmbientMotes3D(THREE, 28, ['#fef08a', '#dcfce7', '#ffffff'], 0.055, false);
  }

  function addFruitTree3D(THREE, textures, x, z, scale, fruitHex, seed) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);

    const barkTex = getTexSafe(textures, 'bark');
    const leafTex = getTexSafe(textures, 'leaf');

    const trunkMat = trackMat(new THREE.MeshStandardMaterial({
      map: barkTex,
      color: barkTex ? '#d4a373' : '#8b5a2b',
      roughness: 0.92
    }));
    const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.38, 2.2, 10)), trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    group.add(trunk);

    const crownGroup = new THREE.Group();
    crownGroup.position.y = 2.45;
    const crownMat = trackMat(new THREE.MeshStandardMaterial({
      map: leafTex,
      color: '#34c759',
      roughness: 0.82
    }));
    const crownDarkMat = trackMat(new THREE.MeshStandardMaterial({
      map: leafTex,
      color: '#22a148',
      roughness: 0.85
    }));

    const puffs = [
      [0, 0.2, 0, 1.35, crownMat],
      [-0.85, -0.15, 0.3, 0.95, crownDarkMat],
      [0.85, -0.1, 0.25, 0.98, crownMat],
      [0.1, 0.85, -0.15, 0.88, crownMat],
      [-0.25, -0.1, -0.75, 0.92, crownDarkMat]
    ];
    for (let i = 0; i < puffs.length; i++) {
      const m = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(puffs[i][3], 1)), puffs[i][4]);
      m.position.set(puffs[i][0], puffs[i][1], puffs[i][2]);
      m.castShadow = true;
      crownGroup.add(m);
    }

    // Frutinhas 3D coloridas
    const fruitMat = trackMat(new THREE.MeshStandardMaterial({
      color: fruitHex,
      roughness: 0.35,
      metalness: 0.05
    }));
    const fruitGeo = trackGeo(new THREE.SphereGeometry(0.15, 10, 10));
    const fSpots = [[-0.7, 0.1, 0.95], [0.55, 0.35, 1.05], [0.1, -0.35, 1.15], [-0.2, 0.8, 0.72]];
    for (let i = 0; i < fSpots.length; i++) {
      const fr = new THREE.Mesh(fruitGeo, fruitMat);
      fr.position.set(fSpots[i][0], fSpots[i][1], fSpots[i][2]);
      crownGroup.add(fr);
    }

    group.add(crownGroup);
    biomeGroup.add(group);
    biomeAnimItems.push({ kind: 'sway', obj: crownGroup, amp: 0.035, speed: 1.5, phase: seed * 1.1 });
  }

  function addFlowerCluster3D(THREE, x, z, petalColor, seed) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const stemMat = trackMat(new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.85 }));
    const petalMat = trackMat(new THREE.MeshStandardMaterial({ color: petalColor, roughness: 0.55 }));
    const centerMat = trackMat(new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5 }));

    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 0.22;
      const oz = (i % 2 === 0 ? 1 : -1) * 0.14;
      const h = 0.28 + (i % 2) * 0.1;

      const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.03, h, 5)), stemMat);
      stem.position.set(ox, h * 0.5, oz);
      group.add(stem);

      const head = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.08, 0.05, 7)), petalMat);
      head.position.set(ox, h + 0.02, oz);
      group.add(head);

      const dot = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 6, 6)), centerMat);
      dot.position.set(ox, h + 0.05, oz);
      group.add(dot);
    }

    biomeGroup.add(group);
    biomeAnimItems.push({ kind: 'sway', obj: group, amp: 0.09, speed: 2.3, phase: seed * 0.8 });
  }

  function addCloud3D(THREE, cfg) {
    const g = new THREE.Group();
    g.position.set(cfg.x, cfg.y, cfg.z);
    g.scale.setScalar(cfg.s);
    const mat = trackMat(new THREE.MeshStandardMaterial({
      color: '#fffef9',
      roughness: 0.95,
      emissive: '#ffffff',
      emissiveIntensity: 0.18,
      fog: false
    }));
    const blobs = [[-1.1, 0, 0, 0.85], [0, 0.35, 0, 1.18], [1.15, 0.05, 0, 0.88], [0.4, -0.1, 0.35, 0.72]];
    for (let i = 0; i < blobs.length; i++) {
      const m = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(blobs[i][3], 12, 10)), mat);
      m.position.set(blobs[i][0], blobs[i][1], blobs[i][2]);
      g.add(m);
    }
    biomeGroup.add(g);
    biomeAnimItems.push({ kind: 'cloud', obj: g, speed: cfg.speed, limitX: 20 });
  }

  // -------------------------------------------------------------------------
  // BIOMA 2: ARENA DA ESTUFA DOURADA ('leader' — Líder Flora)
  // -------------------------------------------------------------------------
  function buildGoldenGreenhouseBiome(THREE, textures, preset) {
    const p = preset || {};
    addSkyAndLights(THREE, {
      skyTop: p.skyTop || '#f5c654',
      skyMid: p.skyMid || '#fef3b8',
      skyBottom: p.skyBottom || '#e8fbe0',
      fogColor: p.fogColor || '#f7f1d0',
      fogNear: 18,
      fogFar: 42,
      sunColor: '#ffe7a3',
      sunIntensity: 1.38,
      hemiSky: '#fff7d1',
      hemiGround: '#829c5c',
      hemiIntensity: 0.85,
      sunPos: [7, 14, 7],
      fillColor: '#fde68a',
      fillIntensity: 0.42
    });

    // Piso polido de mármore / estufa real (tiled nítido)
    const floorTex = getTiledTex(textures, 'greenhouseFloor', 8, 8);
    const floorMat = trackMat(new THREE.MeshStandardMaterial({
      map: floorTex,
      color: floorTex ? '#fff9e6' : '#f3e9cb',
      roughness: 0.36,
      metalness: 0.08
    }));
    const floor = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(16, 16.5, 0.8, 48)), floorMat);
    floor.position.y = -0.4;
    floor.receiveShadow = true;
    biomeGroup.add(floor);

    // Medalhão dourado central no chão da estufa
    const goldMat = trackMat(new THREE.MeshStandardMaterial({
      color: '#eab308',
      roughness: 0.28,
      metalness: 0.72
    }));
    const goldDarkMat = trackMat(new THREE.MeshStandardMaterial({
      color: '#b45309',
      roughness: 0.38,
      metalness: 0.65
    }));

    const centerRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(2.6, 2.86, 48)), goldMat);
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.y = 0.015;
    biomeGroup.add(centerRing);

    const outerRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(6.8, 7.1, 48)), goldDarkMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.015;
    biomeGroup.add(outerRing);

    // Arcos metálicos dourados 3D da Estufa + painéis translúcidos de vidro
    const glassMat = trackMat(new THREE.MeshStandardMaterial({
      color: '#e0f7fa',
      transparent: true,
      opacity: 0.22,
      roughness: 0.12,
      metalness: 0.2,
      side: THREE.DoubleSide
    }));

    // 4 grandes arcos transversais criando o túnel abobadado de estufa
    const archZs = [-8.2, -4.4, -0.6, 3.2];
    for (let i = 0; i < archZs.length; i++) {
      const z = archZs[i];
      const arch = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(9.6, 0.16, 10, 42, Math.PI)), goldMat);
      arch.position.set(0, 1.4, z);
      biomeGroup.add(arch);

      // Pilares laterais
      const colGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 4.2, 10));
      const leftCol = new THREE.Mesh(colGeo, goldDarkMat);
      leftCol.position.set(-9.6, 2.1, z);
      biomeGroup.add(leftCol);
      const rightCol = new THREE.Mesh(colGeo, goldDarkMat);
      rightCol.position.set(9.6, 2.1, z);
      biomeGroup.add(rightCol);
    }

    // Longarinas horizontais conectando os arcos + abóbada de vidro translúcido
    const glassVault = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(9.5, 9.5, 13.5, 24, 1, true, -Math.PI * 0.5, Math.PI)),
      glassMat
    );
    glassVault.rotation.z = Math.PI * 0.5;
    glassVault.rotation.y = Math.PI * 0.5;
    glassVault.position.set(0, 1.4, -2.5);
    biomeGroup.add(glassVault);

    // Mureta curva traseira com floreiras floridas 3D
    const marbleMat = trackMat(new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.5 }));
    const hedgeMat = trackMat(new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.85 }));
    const bloomColors = ['#f43f5e', '#facc15', '#ec4899', '#a855f7', '#fb923c'];

    for (let i = -7; i <= 7; i++) {
      const ang = i * 0.145;
      const r = 8.4;
      const bx = Math.sin(ang) * r;
      const bz = -Math.cos(ang) * r + 0.6;

      const planter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.28, 0.72, 0.78)), marbleMat);
      planter.position.set(bx, 0.36, bz);
      planter.rotation.y = -ang;
      planter.receiveShadow = true;
      planter.castShadow = true;
      biomeGroup.add(planter);

      const bush = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.56, 1)), hedgeMat);
      bush.position.set(bx, 0.92, bz);
      bush.scale.set(1.15, 0.75, 0.9);
      biomeGroup.add(bush);

      // Flores brilhantes na floreira
      for (let f = 0; f < 3; f++) {
        const fl = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.14, 8, 8)),
          trackMat(new THREE.MeshStandardMaterial({
            color: bloomColors[(Math.abs(i) + f) % bloomColors.length],
            roughness: 0.45
          }))
        );
        fl.position.set(bx + (f - 1) * 0.32, 1.22 + (f % 2) * 0.14, bz + 0.18);
        biomeGroup.add(fl);
      }
    }

    // Cestos de flores suspensos balançando suavemente
    const basketSpots = [[-4.8, 5.4, -4.4], [0, 6.2, -4.4], [4.8, 5.4, -4.4], [-3.2, 5.8, -0.6], [3.2, 5.8, -0.6]];
    const cordMat = trackMat(new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.7 }));
    const potMat = trackMat(new THREE.MeshStandardMaterial({ color: '#c2854c', roughness: 0.8 }));

    for (let i = 0; i < basketSpots.length; i++) {
      const bs = basketSpots[i];
      const pivot = new THREE.Group();
      pivot.position.set(bs[0], bs[1] + 2.4, bs[2]);

      const cord = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6)), cordMat);
      cord.position.y = -1.15;
      pivot.add(cord);

      const bowl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.52, 0.32, 0.36, 12)), potMat);
      bowl.position.y = -2.35;
      pivot.add(bowl);

      const foliage = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.52, 10, 8)), hedgeMat);
      foliage.position.y = -2.1;
      foliage.scale.set(1.1, 0.65, 1.1);
      pivot.add(foliage);

      for (let f = 0; f < 4; f++) {
        const a = (f / 4) * Math.PI * 2;
        const fl = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.13, 8, 8)),
          trackMat(new THREE.MeshStandardMaterial({ color: bloomColors[(i + f) % bloomColors.length] }))
        );
        fl.position.set(Math.cos(a) * 0.38, -1.9, Math.sin(a) * 0.38);
        pivot.add(fl);
      }

      biomeGroup.add(pivot);
      biomeAnimItems.push({ kind: 'sway', obj: pivot, amp: 0.045, speed: 1.35, phase: i * 1.4 });
    }

    // Feixes diagonais de luz dourada entrando pela estufa
    const rayMat = trackMat(new THREE.MeshBasicMaterial({
      color: '#fef08a',
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    for (let i = 0; i < 3; i++) {
      const ray = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.1, 13, 12, 1, true)), rayMat);
      ray.position.set(-4.2 + i * 4.2, 5.2, -3.5 + i * 1.1);
      ray.rotation.z = -0.34;
      biomeGroup.add(ray);
      biomeAnimItems.push({ kind: 'pulseOpacity', obj: ray, base: 0.1, amp: 0.04, speed: 0.9, phase: i * 1.8 });
    }

    // Pétalas douradas e rosadas flutuando
    spawnAmbientMotes3D(THREE, 34, ['#fde047', '#fbcfe8', '#fef08a', '#f9a8d4'], 0.075, false);
  }

  // -------------------------------------------------------------------------
  // BIOMA 3: POMAR TROPICAL ('tropical')
  // -------------------------------------------------------------------------
  function buildTropicalOrchardBiome(THREE, textures, preset) {
    const p = preset || {};
    addSkyAndLights(THREE, {
      skyTop: p.skyTop || '#258ad4',
      skyMid: p.skyMid || '#f7b267',
      skyBottom: p.skyBottom || '#fde4a6',
      fogColor: p.fogColor || '#f5d9a8',
      fogNear: 18,
      fogFar: 52,
      sunColor: '#ffd485',
      sunIntensity: 1.4,
      hemiSky: '#ffe3ad',
      hemiGround: '#b5844c',
      hemiIntensity: 0.78,
      sunPos: [10, 9.5, -10],
      fillColor: '#7dd3fc',
      fillIntensity: 0.35
    });

    // Oceano azul-turquesa cintilante ao fundo e ao redor (clone dedicado para animar offset sem afetar overworld)
    const waterTex = getTiledTex(textures, 'water', 14, 10);
    const oceanMat = trackMat(new THREE.MeshStandardMaterial({
      map: waterTex,
      color: '#22d3ee',
      roughness: 0.18,
      metalness: 0.25,
      emissive: '#0891b2',
      emissiveIntensity: 0.22
    }));
    const ocean = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(90, 60)), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.45, -18);
    biomeGroup.add(ocean);
    biomeAnimItems.push({ kind: 'water', obj: ocean, baseY: -0.45, tex: waterTex });

    // Clareira de areia dourada 3D
    const sandTex = getTiledTex(textures, 'sand', 7, 7);
    const sandMat = trackMat(new THREE.MeshStandardMaterial({
      map: sandTex,
      color: sandTex ? '#fff3d6' : '#f2cf88',
      roughness: 0.92
    }));
    const island = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(10.2, 13.5, 1.1, 36)), sandMat);
    island.position.set(0, -0.55, 0.8);
    island.receiveShadow = true;
    biomeGroup.add(island);

    // Espuma suave na linha da água
    const foamMat = trackMat(new THREE.MeshBasicMaterial({
      color: '#e0f7fa',
      transparent: true,
      opacity: 0.6
    }));
    const foamRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(10.1, 11.1, 40)), foamMat);
    foamRing.rotation.x = -Math.PI / 2;
    foamRing.position.set(0, -0.4, 0.8);
    biomeGroup.add(foamRing);
    biomeAnimItems.push({ kind: 'pulseScale', obj: foamRing, base: 1, amp: 0.035, speed: 1.6, phase: 0 });

    // Sol dourado de pôr-do-sol sobre o oceano
    const sunsetSun = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(2.4, 18, 18)),
      trackMat(new THREE.MeshBasicMaterial({ color: '#fde68a', fog: false }))
    );
    sunsetSun.position.set(11.5, 7.2, -32);
    biomeGroup.add(sunsetSun);

    // Ilhotas distantes no horizonte
    const isletMat = trackMat(new THREE.MeshStandardMaterial({ color: '#2b7a69', roughness: 0.9 }));
    const islets = [[-15, -0.5, -24, 5.5, 2.2, 3.2], [5.5, -0.6, -26, 6.2, 2.6, 3.6]];
    for (let i = 0; i < islets.length; i++) {
      const isl = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 14, 10)), isletMat);
      isl.position.set(islets[i][0], islets[i][1], islets[i][2]);
      isl.scale.set(islets[i][3], islets[i][4], islets[i][5]);
      biomeGroup.add(isl);
    }

    // Coqueiros 3D balançando com tronco curvo e cocos
    const palms = [
      { x: -7.5, z: -4.2, lean: 0.9, rotY: 0.4, scale: 1.15 },
      { x: -5.2, z: -6.8, lean: 0.7, rotY: -0.3, scale: 1.0 },
      { x: 5.4, z: -6.5, lean: -0.8, rotY: 0.6, scale: 1.2 },
      { x: 7.8, z: -3.4, lean: -0.95, rotY: -0.5, scale: 1.05 }
    ];
    for (let i = 0; i < palms.length; i++) {
      addPalmTree3D(THREE, textures, palms[i], i);
    }

    // Pedras praianas lisas e hibiscos tropicais
    const rockMat = trackMat(new THREE.MeshStandardMaterial({ color: '#9c8c78', roughness: 0.85 }));
    const rocks = [[-6.2, -1.6, 0.55], [6.1, -1.8, 0.65], [-1.8, -5.5, 0.45], [2.4, -5.8, 0.5]];
    for (let i = 0; i < rocks.length; i++) {
      const r = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(rocks[i][2], 1)), rockMat);
      r.position.set(rocks[i][0], rocks[i][2] * 0.45, rocks[i][1]);
      r.scale.set(1.2, 0.68, 1.0);
      r.castShadow = true;
      r.receiveShadow = true;
      biomeGroup.add(r);
    }

    const hibiscusColors = ['#fb7185', '#f97316', '#facc15', '#ec4899'];
    const hibiscusSpots = [[-5.6, -2.5], [5.5, -2.8], [-3.8, -5.2], [3.8, -4.9], [-6.6, 1.6], [6.2, 1.4]];
    for (let i = 0; i < hibiscusSpots.length; i++) {
      addFlowerCluster3D(THREE, hibiscusSpots[i][0], hibiscusSpots[i][1], hibiscusColors[i % hibiscusColors.length], i + 10);
    }

    // Faíscas quentes de brisa tropical
    spawnAmbientMotes3D(THREE, 26, ['#fde68a', '#fed7aa', '#bae6fd'], 0.06, false);
  }

  function addPalmTree3D(THREE, textures, cfg, seed) {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;
    group.scale.setScalar(cfg.scale);

    const barkTex = getTexSafe(textures, 'bark');
    const trunkMat = trackMat(new THREE.MeshStandardMaterial({
      map: barkTex,
      color: '#b78451',
      roughness: 0.9
    }));

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(cfg.lean * 0.35, 1.5, 0.1),
      new THREE.Vector3(cfg.lean * 0.8, 3.1, 0.2),
      new THREE.Vector3(cfg.lean, 4.35, 0.25)
    ]);
    const trunkGeo = trackGeo(new THREE.TubeGeometry(curve, 12, 0.21, 8, false));
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    group.add(trunk);

    const topGroup = new THREE.Group();
    topGroup.position.set(cfg.lean, 4.35, 0.25);

    // Cocos sob a copa
    const cocoMat = trackMat(new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.75 }));
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2;
      const coco = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.19, 8, 8)), cocoMat);
      coco.position.set(Math.cos(a) * 0.24, -0.15, Math.sin(a) * 0.24);
      topGroup.add(coco);
    }

    // Folhas de palmeira em arco
    const leafTex = getTexSafe(textures, 'leaf');
    const frondMat = trackMat(new THREE.MeshStandardMaterial({
      map: leafTex,
      color: '#22c55e',
      roughness: 0.72,
      side: THREE.DoubleSide
    }));
    const frondGeo = trackGeo(new THREE.BoxGeometry(0.52, 0.05, 2.25));
    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * Math.PI * 2;
      const frondPivot = new THREE.Group();
      frondPivot.rotation.y = a;
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(0, 0.1, 1.1);
      frond.rotation.x = 0.42;
      frond.castShadow = true;
      frondPivot.add(frond);
      topGroup.add(frondPivot);
    }

    group.add(topGroup);
    biomeGroup.add(group);
    biomeAnimItems.push({ kind: 'sway', obj: topGroup, amp: 0.075, speed: 1.75, phase: seed * 1.5 });
  }

  // -------------------------------------------------------------------------
  // BIOMA 4 & 5: HORTA SUBTERRÂNEA ('caverna') & ARENA RAIZ PROFUNDA ('leader2')
  // -------------------------------------------------------------------------
  function buildSubterraneanBiome(THREE, textures, preset, isLeader2) {
    const p = preset || {};
    addSkyAndLights(THREE, {
      skyTop: p.skyTop || '#070d16',
      skyMid: p.skyMid || '#112130',
      skyBottom: p.skyBottom || '#1c3242',
      fogColor: p.fogColor || '#10202c',
      fogNear: 11,
      fogFar: 32,
      sunColor: isLeader2 ? '#fde68a' : '#80e5ff',
      sunIntensity: isLeader2 ? 0.78 : 0.65,
      hemiSky: isLeader2 ? '#7cc4d9' : '#4fa8c7',
      hemiGround: '#241c17',
      hemiIntensity: 0.62,
      sunPos: [4, 11, 5],
      fillColor: isLeader2 ? '#fbbf24' : '#38bdf8',
      fillIntensity: 0.48
    });

    // Chão rochoso da caverna (tiled nítido)
    const caveTex = getTiledTex(textures, 'caveFloor', 9, 9);
    const floorMat = trackMat(new THREE.MeshStandardMaterial({
      map: caveTex,
      color: caveTex ? '#8aa3ad' : '#2f4048',
      roughness: 0.92,
      metalness: 0.06
    }));
    const floor = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(16, 17, 1.0, 36)), floorMat);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    biomeGroup.add(floor);

    // Anel rúnico brilhante no piso da Arena da Raiz Profunda (Líder Mandi!)
    if (isLeader2) {
      const runeMat = trackMat(new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending
      }));
      const rune1 = new THREE.Mesh(trackGeo(new THREE.RingGeometry(2.7, 2.88, 36)), runeMat);
      rune1.rotation.x = -Math.PI / 2;
      rune1.position.y = 0.02;
      biomeGroup.add(rune1);
      biomeAnimItems.push({ kind: 'pulseOpacity', obj: rune1, base: 0.48, amp: 0.22, speed: 2.0, phase: 0 });

      const rune2 = new THREE.Mesh(trackGeo(new THREE.RingGeometry(4.6, 4.74, 36)), runeMat);
      rune2.rotation.x = -Math.PI / 2;
      rune2.position.y = 0.02;
      biomeGroup.add(rune2);
    }

    // Pilares de pedra, estalagmites e estalactites
    const stoneTex = getTexSafe(textures, 'stone');
    const rockMat = trackMat(new THREE.MeshStandardMaterial({
      map: stoneTex,
      color: '#3c4c57',
      roughness: 0.92
    }));

    const pillars = [
      [-8.5, -5.5, 1.25, 6.2],
      [-5.2, -8.5, 1.4, 7.2],
      [0.4, -9.6, 1.5, 6.8],
      [5.8, -8.2, 1.35, 7.4],
      [8.6, -4.6, 1.2, 5.8]
    ];
    for (let i = 0; i < pillars.length; i++) {
      const pl = pillars[i];
      const pillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(pl[2] * 0.72, pl[2], pl[3], 7)), rockMat);
      pillar.position.set(pl[0], pl[3] * 0.5 - 0.2, pl[1]);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      biomeGroup.add(pillar);
    }

    // Estalagmites no perímetro e estalactites no topo
    const stalagSpots = [
      [-6.8, -2.5, 0.55, 1.9], [-3.1, -6.4, 0.48, 1.6], [3.5, -6.5, 0.6, 2.2],
      [7.1, -1.8, 0.52, 1.7], [-7.4, 1.2, 0.46, 1.5], [6.6, 1.8, 0.5, 1.6]
    ];
    for (let i = 0; i < stalagSpots.length; i++) {
      const st = stalagSpots[i];
      const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(st[2], st[3], 6)), rockMat);
      cone.position.set(st[0], st[3] * 0.5, st[1]);
      cone.castShadow = true;
      biomeGroup.add(cone);
    }

    const ceilingSpots = [[-6.5, 6.6, -5], [-2.2, 7.1, -6.5], [2.8, 7.0, -6], [6.8, 6.5, -4.5]];
    for (let i = 0; i < ceilingSpots.length; i++) {
      const cs = ceilingSpots[i];
      const icicle = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.65, 2.6, 6)), rockMat);
      icicle.position.set(cs[0], cs[1], cs[2]);
      icicle.rotation.x = Math.PI;
      biomeGroup.add(icicle);
    }

    // Raízes ancestrais 3D serpenteando pela caverna
    const barkTex = getTexSafe(textures, 'bark');
    const rootMat = trackMat(new THREE.MeshStandardMaterial({
      map: barkTex,
      color: isLeader2 ? '#7c4d2b' : '#5e3d24',
      roughness: 0.9
    }));
    const rootCurves = [
      [[-8.2, 5.2, -5.0], [-5.4, 2.2, -5.8], [-2.5, 0.3, -4.8], [0.5, 0.08, -4.2]],
      [[8.0, 5.5, -4.5], [5.2, 2.6, -5.6], [2.4, 0.4, -4.7], [-0.8, 0.08, -4.6]]
    ];
    if (isLeader2) {
      // Arco monumental de raízes ancestrais atrás do Líder Mandi!
      rootCurves.push([
        [-5.2, 0, -6.4], [-3.8, 3.6, -6.6], [0, 5.2, -6.8], [3.8, 3.6, -6.6], [5.2, 0, -6.4]
      ]);
    }
    for (let i = 0; i < rootCurves.length; i++) {
      const pts = rootCurves[i].map(function (pt) { return new THREE.Vector3(pt[0], pt[1], pt[2]); });
      const curve = new THREE.CatmullRomCurve3(pts);
      const rad = i === 2 ? 0.36 : 0.24;
      const rootMesh = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 18, rad, 8, false)), rootMat);
      rootMesh.castShadow = true;
      biomeGroup.add(rootMesh);
    }

    // Cristais bioluminescentes 3D (ciano & âmbar) com PointLight real!
    const crystalClusters = [
      { x: -5.4, z: -2.2, color: '#22d3ee', emissive: '#06b6d4', scale: 1.05, light: true },
      { x: 5.5, z: -3.2, color: '#fbbf24', emissive: '#f59e0b', scale: isLeader2 ? 1.35 : 1.05, light: true },
      { x: -1.2, z: -5.6, color: isLeader2 ? '#fbbf24' : '#38bdf8', emissive: isLeader2 ? '#d97706' : '#0284c7', scale: isLeader2 ? 1.45 : 1.15, light: true },
      { x: 4.9, z: 1.6, color: '#22d3ee', emissive: '#0891b2', scale: 0.85, light: false },
      { x: -5.2, z: 2.3, color: '#fbbf24', emissive: '#d97706', scale: 0.82, light: false }
    ];

    for (let i = 0; i < crystalClusters.length; i++) {
      const cc = crystalClusters[i];
      addBiolumCrystalCluster(THREE, textures, cc, i);
    }

    // Esporos luminosos / vaga-lumes flutuando
    spawnAmbientMotes3D(
      THREE,
      36,
      isLeader2 ? ['#fde047', '#22d3ee', '#fbbf24'] : ['#67e8f9', '#a5f3fc', '#fde68a'],
      0.065,
      true
    );
  }

  function addBiolumCrystalCluster(THREE, textures, cfg, seed) {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.scale.setScalar(cfg.scale);

    const crystalTex = getTexSafe(textures, 'crystal');
    const mat = trackMat(new THREE.MeshStandardMaterial({
      map: crystalTex,
      color: cfg.color,
      emissive: cfg.emissive,
      emissiveIntensity: 0.95,
      roughness: 0.18,
      metalness: 0.25,
      transparent: true,
      opacity: 0.92
    }));

    const shards = [
      { ox: 0, oz: 0, r: 0.28, h: 1.65, rx: 0.06, rz: -0.08 },
      { ox: -0.32, oz: 0.16, r: 0.2, h: 1.15, rx: 0.22, rz: 0.34 },
      { ox: 0.3, oz: -0.14, r: 0.22, h: 1.25, rx: -0.18, rz: -0.3 },
      { ox: 0.08, oz: 0.28, r: 0.16, h: 0.85, rx: 0.35, rz: 0.1 }
    ];
    for (let i = 0; i < shards.length; i++) {
      const sh = shards[i];
      const prism = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(sh.r, sh.h, 6)), mat);
      prism.position.set(sh.ox, sh.h * 0.45, sh.oz);
      prism.rotation.set(sh.rx, i * 0.9, sh.rz);
      group.add(prism);
    }

    biomeGroup.add(group);

    if (cfg.light) {
      const pl = new THREE.PointLight(cfg.color, 2.2 * cfg.scale, 10.5, 1.5);
      pl.position.set(cfg.x, 1.5 * cfg.scale, cfg.z);
      biomeGroup.add(pl);
      crystalLights.push({ light: pl, base: 2.2 * cfg.scale, phase: seed * 1.7 });
    }
  }

  // -------------------------------------------------------------------------
  // PLATAFORMAS CIRCULARES 3D DA ARENA
  // -------------------------------------------------------------------------
  function buildBattlePlatform(THREE, textures, x, z, radius, biomeKey, isPlayer) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    let rimColor = '#8b5a2b';
    let topColor = '#4ade80';
    let ringColor = '#dcfce7';
    let topTex = getTexSafe(textures, 'grass');
    let rimTex = getTexSafe(textures, 'stone');

    if (biomeKey === 'leader') {
      rimColor = '#d97706';
      topColor = '#fef9c3';
      ringColor = '#fde047';
      topTex = getTexSafe(textures, 'greenhouseFloor');
      rimTex = null;
    } else if (biomeKey === 'tropical') {
      rimColor = '#a1622e';
      topColor = '#f7df9c';
      ringColor = '#67e8f9';
      topTex = getTexSafe(textures, 'sand');
      rimTex = getTexSafe(textures, 'wood');
    } else if (biomeKey === 'caverna') {
      rimColor = '#334155';
      topColor = '#475569';
      ringColor = '#22d3ee';
      topTex = getTexSafe(textures, 'stone');
    } else if (biomeKey === 'leader2') {
      rimColor = '#78350f';
      topColor = '#44403c';
      ringColor = '#fbbf24';
      topTex = getTexSafe(textures, 'stone');
    }

    // Base chanfrada 3D
    const baseMat = trackMat(new THREE.MeshStandardMaterial({
      map: rimTex,
      color: rimColor,
      roughness: biomeKey === 'leader' ? 0.35 : 0.82,
      metalness: biomeKey === 'leader' ? 0.55 : 0.08
    }));
    const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(radius, radius * 1.08, 0.18, 28)), baseMat);
    base.position.y = 0.09;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Superfície interna iluminada
    const topMat = trackMat(new THREE.MeshStandardMaterial({
      map: topTex,
      color: topColor,
      roughness: biomeKey === 'leader' ? 0.42 : 0.85,
      metalness: 0.04
    }));
    const top = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(radius * 0.9, radius * 0.92, 0.04, 28)), topMat);
    top.position.y = 0.18;
    top.receiveShadow = true;
    group.add(top);

    // Anel luminoso suave na borda da plataforma
    const ringMat = trackMat(new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: biomeKey === 'caverna' || biomeKey === 'leader2' ? 0.78 : 0.58
    }));
    const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(radius * 0.88, 0.035, 8, 36)), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    group.add(ring);
    biomeAnimItems.push({
      kind: 'pulseOpacity',
      obj: ring,
      base: biomeKey === 'caverna' || biomeKey === 'leader2' ? 0.72 : 0.5,
      amp: 0.16,
      speed: 2.2,
      phase: isPlayer ? 0 : 1.5
    });

    biomeGroup.add(group);
  }

  function spawnAmbientMotes3D(THREE, count, colors, size, glowing) {
    const geo = trackGeo(new THREE.OctahedronGeometry(size, 0));
    for (let i = 0; i < count; i++) {
      const mat = trackMat(new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: glowing ? 0.85 : 0.65,
        blending: glowing ? THREE.AdditiveBlending : THREE.NormalBlending
      }));
      const m = new THREE.Mesh(geo, mat);
      m.position.set(
        (Math.random() - 0.5) * 14,
        0.5 + Math.random() * 4.8,
        (Math.random() - 0.5) * 10
      );
      biomeGroup.add(m);
      ambientParticles.push({
        mesh: m,
        vx: (glowing ? 0.25 : 0.55) * (Math.random() - 0.3),
        vy: glowing ? 0.15 + Math.random() * 0.22 : -0.18 - Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
        glowing: glowing
      });
    }
  }

  // =========================================================================
  // STANDEES HD-2D DAS CRIATURAS + AURAS + STATUS 3D
  // =========================================================================
  function ensureStandee(side, creature) {
    const THREE = getThree();
    if (!creature || !dynamicGroup || !HM.HD2D) return;

    const key = creature.speciesId + '|' + (creature.golden ? 'g' : 'n');
    const stageScale = getCreatureStageScale(creature);
    const isPlayer = side === 'player';

    if (isPlayer && playerSpecKey === key && playerStandee) return;
    if (!isPlayer && enemySpecKey === key && enemyStandee) return;

    const tex = HM.HD2D.getCreatureTexture(creature.speciesId, {
      facing: isPlayer ? 'right' : 'left',
      golden: !!creature.golden
    });

    const baseSize = isPlayer ? 2.68 : 2.52;
    const size = baseSize * stageScale;

    let standee = isPlayer ? playerStandee : enemyStandee;
    if (!standee) {
      standee = HM.HD2D.createStandee(tex, size, size);
      dynamicGroup.add(standee.group);

      // Anel de aura 3D (usado em buffs, curas e evolução)
      const auraGeo = trackGeo(new THREE.CylinderGeometry(1.15, 0.95, 2.2, 20, 1, true));
      const auraMat = trackMat(new THREE.MeshBasicMaterial({
        color: '#facc15',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      }));
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      auraMesh.position.y = 1.1;
      standee.group.add(auraMesh);

      // Grupo para efeitos visuais de status 3D (burn / sleep / paralyze)
      const stGroup = createStatusVisualGroup(THREE);
      standee.group.add(stGroup);

      // Grupo para brilhos orbitais de criatura Dourada
      const goldGroup = createGoldenSparkleGroup(THREE);
      standee.group.add(goldGroup);

      if (isPlayer) {
        playerStandee = standee;
        playerAuraRing = auraMesh;
        playerStatusGroup = stGroup;
        playerGoldenGroup = goldGroup;
      } else {
        enemyStandee = standee;
        enemyAuraRing = auraMesh;
        enemyStatusGroup = stGroup;
        enemyGoldenGroup = goldGroup;
      }
    } else {
      standee.setTexture(tex);
      // Ajustar escala da geometria quando troca/evolui para outro estágio
      const prevScale = isPlayer ? playerStageScale : enemyStageScale;
      if (Math.abs(prevScale - stageScale) > 0.001 && standee.mesh) {
        const ratio = size / (baseSize * prevScale);
        standee.mesh.scale.x *= ratio;
        standee.mesh.scale.y *= ratio;
        standee.mesh.position.y = size * 0.5;
        if (standee.shadowMesh) {
          standee.shadowMesh.scale.x *= ratio;
          standee.shadowMesh.scale.y *= ratio;
        }
      }
    }

    standee.setFlipX(false);

    if (isPlayer) {
      playerSpecKey = key;
      playerStageScale = stageScale;
      if (playerGoldenGroup) playerGoldenGroup.visible = Boolean(creature.golden);
    } else {
      enemySpecKey = key;
      enemyStageScale = stageScale;
      if (enemyGoldenGroup) enemyGoldenGroup.visible = Boolean(creature.golden);
    }
  }

  function createStatusVisualGroup(THREE) {
    const group = new THREE.Group();
    const embers = [];
    const emberGeo = trackGeo(new THREE.OctahedronGeometry(0.1, 0));
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        emberGeo,
        trackMat(new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? '#f97316' : '#facc15',
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        }))
      );
      m.visible = false;
      group.add(m);
      embers.push(m);
    }
    group.userData = { orbs: embers, lastStatus: null };
    return group;
  }

  function createGoldenSparkleGroup(THREE) {
    const group = new THREE.Group();
    group.visible = false;
    const starGeo = trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    const starMat = trackMat(new THREE.MeshBasicMaterial({
      color: '#fef08a',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending
    }));
    const list = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(starGeo, starMat);
      group.add(m);
      list.push(m);
    }
    group.userData = { stars: list };
    return group;
  }

  function updateStatusGroup(stGroup, status, t) {
    if (!stGroup || !stGroup.userData) return;
    const orbs = stGroup.userData.orbs;
    if (!status) {
      if (stGroup.userData.lastStatus !== null) {
        for (let i = 0; i < orbs.length; i++) orbs[i].visible = false;
        stGroup.userData.lastStatus = null;
      }
      return;
    }

    stGroup.userData.lastStatus = status;
    for (let i = 0; i < orbs.length; i++) {
      const orb = orbs[i];
      orb.visible = true;
      const phase = t * (status === 'paralyze' ? 6.5 : status === 'burn' ? 3.2 : 1.4) + i * 1.05;
      if (status === 'burn') {
        orb.material.color.set(i % 2 === 0 ? '#f97316' : '#ef4444');
        const cycle = (phase * 0.45) % 1;
        orb.position.set(Math.cos(phase * 1.4) * 0.85, 0.35 + cycle * 1.9, Math.sin(phase * 1.4) * 0.65);
        orb.scale.setScalar(1.0 - cycle * 0.5);
      } else if (status === 'sleep') {
        orb.material.color.set(i % 2 === 0 ? '#c084fc' : '#e9d5ff');
        const cycle = (phase * 0.3) % 1;
        orb.position.set(Math.sin(phase) * 0.45 + 0.35, 1.45 + cycle * 1.15, 0.25);
        orb.scale.setScalar(0.65 + cycle * 0.55);
      } else if (status === 'paralyze') {
        orb.material.color.set(i % 2 === 0 ? '#fde047' : '#ffffff');
        const jitter = Math.sin(phase * 3.1) > 0.2 ? 1 : 0.2;
        orb.position.set(
          Math.cos(phase * 2.1 + i) * 0.95,
          0.65 + ((i * 0.35 + Math.sin(phase * 4)) % 1.4),
          Math.sin(phase * 2.1 + i) * 0.55
        );
        orb.scale.set(0.6 * jitter, 1.7 * jitter, 0.6 * jitter);
      }
    }
  }

  function updateGoldenGroup(gGroup, t) {
    if (!gGroup || !gGroup.visible || !gGroup.userData) return;
    const stars = gGroup.userData.stars;
    for (let i = 0; i < stars.length; i++) {
      const a = t * 1.6 + (i / stars.length) * Math.PI * 2;
      stars[i].position.set(Math.cos(a) * 1.08, 0.75 + Math.sin(t * 2.4 + i) * 0.55 + (i % 2) * 0.5, Math.sin(a) * 0.65);
      const pulse = 0.6 + Math.abs(Math.sin(t * 4 + i * 1.3)) * 0.7;
      stars[i].scale.setScalar(pulse);
      stars[i].rotation.y = t * 3;
    }
  }

  // =========================================================================
  // VASO DE CAPTURA 3D REAL + FEIXE DE LUZ DE ABSORÇÃO
  // =========================================================================
  function ensureCapturePot3D(isSuper) {
    const THREE = getThree();
    if (!dynamicGroup) return;

    if (potRoot && potBuiltSuper === Boolean(isSuper)) return;

    // Limpar malha anterior se mudou entre Comum e Super Vaso
    if (potRoot) {
      dynamicGroup.remove(potRoot);
      potRoot = null;
    }

    potBuiltSuper = Boolean(isSuper);
    potRoot = new THREE.Group();
    potRoot.visible = false;

    potMeshGroup = new THREE.Group();
    potRoot.add(potMeshGroup);

    // Materiais do vaso (terracota + verde para comum; ouro + safira para Super Vaso)
    const bodyMat = trackMat(new THREE.MeshStandardMaterial({
      color: isSuper ? '#eab308' : '#c96432',
      roughness: isSuper ? 0.25 : 0.72,
      metalness: isSuper ? 0.68 : 0.08
    }));
    const bandMat = trackMat(new THREE.MeshStandardMaterial({
      color: isSuper ? '#2563eb' : '#22c55e',
      roughness: 0.35,
      metalness: isSuper ? 0.35 : 0.1
    }));
    const claspMat = trackMat(new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#f59e0b',
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.6
    }));

    // Corpo inferior do vaso
    const lowerBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.4, 0.28, 0.44, 18)), bodyMat);
    lowerBody.position.y = -0.18;
    lowerBody.castShadow = true;
    potMeshGroup.add(lowerBody);

    // Faixa central decorativa
    const band = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.425, 0.41, 0.11, 18)), bandMat);
    band.position.y = 0.02;
    potMeshGroup.add(band);

    // Fecho frontal brilhante
    const clasp = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.1, 12, 12)), claspMat);
    clasp.position.set(0, 0.04, 0.41);
    potMeshGroup.add(clasp);

    // Brilho interno quando a tampa abre
    const innerMat = trackMat(new THREE.MeshBasicMaterial({
      color: '#bbf7d0',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    }));
    potInnerGlow = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.32, 12, 12)), innerMat);
    potInnerGlow.position.y = 0.08;
    potMeshGroup.add(potInnerGlow);

    // Tampa articulada na borda traseira (abre de 0 a ~75° com openAmount)
    potLidGroup = new THREE.Group();
    potLidGroup.position.set(0, 0.07, -0.36);

    const lidRim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.44, 0.43, 0.1, 18)), bodyMat);
    lidRim.position.set(0, 0.05, 0.36);
    potLidGroup.add(lidRim);

    const lidDome = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      bodyMat
    );
    lidDome.position.set(0, 0.09, 0.36);
    potLidGroup.add(lidDome);

    if (isSuper) {
      // Estrela dourada no topo do Super Vaso
      const starCrest = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.18, 0)), claspMat);
      starCrest.position.set(0, 0.52, 0.36);
      potLidGroup.add(starCrest);
    } else {
      // Brotinho verde fofo no topo do Vaso Comum
      const leafMat = trackMat(new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 0.5 }));
      const leaf1 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.13, 8, 8)), leafMat);
      leaf1.scale.set(1.5, 0.45, 0.7);
      leaf1.position.set(-0.14, 0.52, 0.36);
      leaf1.rotation.z = 0.45;
      potLidGroup.add(leaf1);

      const leaf2 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.13, 8, 8)), leafMat);
      leaf2.scale.set(1.5, 0.45, 0.7);
      leaf2.position.set(0.14, 0.52, 0.36);
      leaf2.rotation.z = -0.45;
      potLidGroup.add(leaf2);
    }

    potMeshGroup.add(potLidGroup);

    // Feixe de luz vertical/cônico 3D absorvendo a criatura
    const beamMat = trackMat(new THREE.MeshBasicMaterial({
      color: '#86efac',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    }));
    potBeamMesh = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.35, 3.2, 20, 1, true)), beamMat);
    potBeamMesh.position.set(0, -1.6, 0);
    potRoot.add(potBeamMesh);

    // Luz pontual emanando do vaso durante absorção / sucesso
    potLight = new THREE.PointLight('#86efac', 0, 7, 1.5);
    potRoot.add(potLight);

    dynamicGroup.add(potRoot);
  }

  function syncCapturePot3D(potAnim) {
    if (!potAnim || !potAnim.active) {
      if (potRoot) potRoot.visible = false;
      return;
    }

    ensureCapturePot3D(Boolean(potAnim.isSuper));
    if (!potRoot) return;
    potRoot.visible = true;

    const startX = PLAYER_POS.x + 0.55;
    const startY = PLAYER_POS.y + 1.45;
    const startZ = PLAYER_POS.z - 0.35;

    const apexX = ENEMY_POS.x;
    const apexY = ENEMY_POS.y + 2.55;
    const apexZ = ENEMY_POS.z;

    const groundY = ENEMY_POS.y + 0.42;

    const phase = potAnim.phase || 'throw';
    const t = clamp(potAnim.phaseT != null ? potAnim.phaseT : 0, 0, 1);

    let px = apexX;
    let py = groundY;
    let pz = apexZ;
    let rotX = 0;
    let rotZ = 0;
    let scl = potAnim.scale != null ? potAnim.scale : 1;

    if (phase === 'throw') {
      px = lerp(startX, apexX, t);
      pz = lerp(startZ, apexZ, t);
      py = lerp(startY, apexY, t) + Math.sin(t * Math.PI) * 2.4;
      rotX = t * Math.PI * 5;
      rotZ = -t * Math.PI * 3;
      scl = lerp(0.82, 1.08, t);
    } else if (phase === 'absorb') {
      px = apexX;
      py = apexY;
      pz = apexZ;
      rotZ = Math.sin(sceneTime * 16) * 0.06;
    } else if (phase === 'drop') {
      let yNorm;
      if (t < 0.55) {
        const p = t / 0.55;
        yNorm = p * p;
      } else if (t < 0.82) {
        const p = (t - 0.55) / 0.27;
        yNorm = 1 - Math.sin(p * Math.PI) * 0.32;
      } else {
        const p = (t - 0.82) / 0.18;
        yNorm = 1 - Math.sin(p * Math.PI) * 0.11;
      }
      px = apexX;
      py = lerp(apexY, groundY, yNorm);
      pz = apexZ;
      scl = 1.0;
    } else if (phase === 'wobble') {
      const ang = potAnim.angle || 0;
      px = apexX + Math.sin(ang) * 0.22;
      py = groundY + Math.abs(Math.sin(ang)) * 0.08;
      pz = apexZ;
      rotZ = -ang * 1.15;
    } else if (phase === 'caught') {
      px = apexX;
      py = groundY;
      pz = apexZ;
    } else if (phase === 'escape') {
      px = apexX;
      py = groundY + t * 0.45;
      pz = apexZ;
      scl = Math.max(0.01, 1 - t);
    }

    potRoot.position.set(px, py, pz);
    potMeshGroup.rotation.set(rotX, -0.38, rotZ);
    potMeshGroup.scale.setScalar(scl);

    // Tampa abrindo conforme openAmount (0..1)
    if (potLidGroup) {
      potLidGroup.rotation.x = -(potAnim.openAmount || 0) * 1.32;
    }

    // Feixe luminoso 3D + brilho interno
    const beamA = potAnim.beamAlpha || 0;
    if (potBeamMesh) {
      potBeamMesh.visible = beamA > 0.01;
      potBeamMesh.material.opacity = beamA * 0.65;
      potBeamMesh.rotation.y = sceneTime * 4.5;
    }
    if (potInnerGlow) {
      const glow = Math.max(beamA, (potAnim.openAmount || 0) * 0.6);
      potInnerGlow.material.opacity = glow * 0.88;
    }
    if (potLight) {
      if (potAnim.settled) {
        potLight.color.set('#facc15');
        potLight.intensity = 2.6 + Math.sin(sceneTime * 7) * 0.6;
      } else if (beamA > 0.02) {
        potLight.color.set('#86efac');
        potLight.intensity = beamA * 4.2;
      } else {
        potLight.intensity = 0;
      }
    }
  }

  // =========================================================================
  // PARTÍCULAS 3D TEMÁTICAS (TODOS OS 11 FX DOS 35+ GOLPES + CAPTURA)
  // =========================================================================
  function getSharedFxGeos(THREE) {
    if (sharedFxGeos) return sharedFxGeos;
    sharedFxGeos = {
      octa: trackGeo(new THREE.OctahedronGeometry(0.22, 0)),
      sphere: trackGeo(new THREE.SphereGeometry(0.18, 10, 8)),
      dodeca: trackGeo(new THREE.DodecahedronGeometry(0.24, 0)),
      leaf: trackGeo(new THREE.BoxGeometry(0.32, 0.04, 0.16)),
      ring: trackGeo(new THREE.TorusGeometry(0.55, 0.06, 8, 28)),
      bolt: trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 1.45, 6)),
      ribbon: trackGeo(new THREE.TorusGeometry(0.85, 0.05, 6, 20, Math.PI * 1.15)),
      plus: trackGeo(new THREE.BoxGeometry(0.26, 0.08, 0.08))
    };
    return sharedFxGeos;
  }

  function sideAnchor3D(side, heightOff) {
    const base = side === 'player' ? PLAYER_POS : ENEMY_POS;
    return { x: base.x, y: base.y + (heightOff != null ? heightOff : 1.15), z: base.z };
  }

  function addFxParticle(geo, color, x, y, z, vx, vy, vz, opts) {
    const THREE = getThree();
    if (!dynamicGroup) return;
    const o = opts || {};
    const mat = trackMat(new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: o.opacity != null ? o.opacity : 0.95,
      blending: o.additive !== false ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: false
    }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (o.rotX) mesh.rotation.x = o.rotX;
    if (o.rotY) mesh.rotation.y = o.rotY;
    if (o.rotZ) mesh.rotation.z = o.rotZ;
    if (o.scale) mesh.scale.setScalar(o.scale);

    dynamicGroup.add(mesh);
    fxParticles.push({
      mesh: mesh,
      vx: vx,
      vy: vy,
      vz: vz,
      gravity: o.gravity || 0,
      vrotX: o.vrotX || 0,
      vrotY: o.vrotY || 0,
      vrotZ: o.vrotZ || 0,
      baseScale: o.scale || 1,
      expandTo: o.expandTo || 0,
      baseOpacity: o.opacity != null ? o.opacity : 0.95,
      age: o.delay ? -o.delay : 0,
      life: o.life || 0.55
    });
  }

  function pulseImpactLight(colorHex, side, intensity) {
    if (!impactLight) return;
    const pos = sideAnchor3D(side, 1.35);
    impactLight.color.set(colorHex);
    impactLight.position.set(pos.x, pos.y, pos.z);
    impactLight.intensity = intensity || 4.0;
    impactLightLife = 0.34;
  }

  function spawnMoveFx(fxType, fromSide, toSide) {
    const THREE = getThree();
    if (!active || !THREE || !dynamicGroup) return;

    const geos = getSharedFxGeos(THREE);
    const from = sideAnchor3D(fromSide, 1.15);
    const to = sideAnchor3D(toSide, 1.15);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;

    if (fxType === 'fire') {
      pulseImpactLight('#f97316', toSide, 4.8);
      for (let i = 0; i < 24; i++) {
        const isStream = i < 10;
        const frac = i / 10;
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.6 + Math.random() * 2.8;
        addFxParticle(
          geos.octa,
          i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#f97316' : '#ef4444',
          isStream ? lerp(from.x, to.x, frac * 0.65) : to.x + (Math.random() - 0.5) * 0.9,
          isStream ? lerp(from.y, to.y, frac * 0.65) : to.y + (Math.random() - 0.5) * 0.8,
          isStream ? lerp(from.z, to.z, frac * 0.65) : to.z + (Math.random() - 0.5) * 0.9,
          isStream ? dx * 1.85 : Math.cos(ang) * spd,
          isStream ? dy * 1.85 + 0.8 : 1.2 + Math.random() * 2.5,
          isStream ? dz * 1.85 : Math.sin(ang) * spd,
          { gravity: 1.5, scale: 0.7 + Math.random() * 0.8, vrotY: 7, life: 0.48 + Math.random() * 0.28 }
        );
      }
    } else if (fxType === 'leaf') {
      pulseImpactLight('#4ade80', toSide, 3.2);
      for (let i = 0; i < 24; i++) {
        const isProj = i < 12;
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.8 + Math.random() * 2.6;
        addFxParticle(
          geos.leaf,
          i % 3 === 0 ? '#86efac' : i % 3 === 1 ? '#22c55e' : '#15803d',
          isProj ? lerp(from.x, to.x, Math.random() * 0.6) : to.x + (Math.random() - 0.5) * 0.9,
          isProj ? lerp(from.y, to.y, Math.random() * 0.6) : to.y + (Math.random() - 0.5) * 0.8,
          isProj ? lerp(from.z, to.z, Math.random() * 0.6) : to.z + (Math.random() - 0.5) * 0.9,
          isProj ? dx * 1.9 + (Math.random() - 0.5) : Math.cos(ang) * spd,
          isProj ? dy * 1.9 + (Math.random() - 0.5) : 0.8 + Math.random() * 1.8,
          isProj ? dz * 1.9 + (Math.random() - 0.5) : Math.sin(ang) * spd,
          { additive: false, gravity: -2.4, scale: 0.95 + Math.random() * 0.65, vrotX: 9, vrotY: 11, life: 0.56 + Math.random() * 0.3 }
        );
      }
    } else if (fxType === 'water') {
      pulseImpactLight('#38bdf8', toSide, 4.0);
      for (let r = 0; r < 3; r++) {
        addFxParticle(geos.ring, r === 0 ? '#e0f2fe' : '#38bdf8', to.x, to.y - 0.75, to.z, 0, 0.35, 0, {
          rotX: Math.PI / 2, scale: 0.45, expandTo: 2.9 + r * 0.55, delay: r * 0.08, life: 0.5
        });
      }
      for (let i = 0; i < 22; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.6 + Math.random() * 2.8;
        addFxParticle(
          geos.sphere,
          i % 3 === 0 ? '#e0f2fe' : i % 3 === 1 ? '#38bdf8' : '#0284c7',
          to.x + (Math.random() - 0.5) * 0.7,
          to.y + (Math.random() - 0.5) * 0.6,
          to.z + (Math.random() - 0.5) * 0.7,
          Math.cos(ang) * spd,
          2.1 + Math.random() * 2.6,
          Math.sin(ang) * spd,
          { gravity: -7.5, scale: 0.55 + Math.random() * 0.6, life: 0.48 + Math.random() * 0.25 }
        );
      }
    } else if (fxType === 'earth') {
      pulseImpactLight('#d97706', toSide, 3.6);
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.3 + Math.random() * 2.3;
        addFxParticle(
          geos.dodeca,
          i % 3 === 0 ? '#d97706' : i % 3 === 1 ? '#92400e' : '#78350f',
          to.x + (Math.random() - 0.5) * 1.1,
          to.y - 0.65,
          to.z + (Math.random() - 0.5) * 1.1,
          Math.cos(ang) * spd,
          3.4 + Math.random() * 2.6,
          Math.sin(ang) * spd,
          { additive: false, gravity: -10.5, scale: 0.65 + Math.random() * 0.75, vrotX: 8, vrotZ: 7, life: 0.58 + Math.random() * 0.25 }
        );
      }
      for (let d = 0; d < 10; d++) {
        const ang = Math.random() * Math.PI * 2;
        addFxParticle(
          geos.sphere,
          '#e7d5b8',
          to.x + Math.cos(ang) * 0.7,
          to.y - 0.55,
          to.z + Math.sin(ang) * 0.7,
          Math.cos(ang) * 1.2,
          0.9 + Math.random() * 0.9,
          Math.sin(ang) * 1.2,
          { additive: false, opacity: 0.65, scale: 0.9, expandTo: 2.2, life: 0.55 }
        );
      }
    } else if (fxType === 'citrus' || fxType === 'voltaic') {
      const isVoltaic = fxType === 'voltaic';
      pulseImpactLight(isVoltaic ? '#67e8f9' : '#facc15', toSide, 5.2);
      for (let b = 0; b < 6; b++) {
        addFxParticle(
          geos.bolt,
          isVoltaic ? (b % 2 === 0 ? '#67e8f9' : '#fef08a') : (b % 2 === 0 ? '#fef08a' : '#facc15'),
          to.x + (Math.random() - 0.5) * 1.25,
          to.y + 0.65 + (Math.random() - 0.5) * 0.5,
          to.z + (Math.random() - 0.5) * 1.0,
          0, -1.5, 0,
          { rotZ: (Math.random() - 0.5) * 0.95, rotX: (Math.random() - 0.5) * 0.45, scale: 1.0, delay: b * 0.035, life: 0.26 }
        );
      }
      for (let i = 0; i < 20; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.4 + Math.random() * 3.4;
        addFxParticle(
          geos.octa,
          isVoltaic ? (i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#22d3ee' : '#fde047') : (i % 3 === 0 ? '#ffffff' : '#facc15'),
          to.x, to.y, to.z,
          Math.cos(ang) * spd, (Math.random() - 0.2) * spd, Math.sin(ang) * spd,
          { scale: 0.55 + Math.random() * 0.55, vrotY: 14, life: 0.36 + Math.random() * 0.22 }
        );
      }
    } else if (fxType === 'spore') {
      pulseImpactLight('#c084fc', toSide, 4.2);
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.1;
        addFxParticle(
          geos.sphere,
          i % 3 === 0 ? '#f0abfc' : i % 3 === 1 ? '#c084fc' : '#9333ea',
          to.x + Math.cos(ang) * r,
          to.y - 0.4 + Math.random() * 1.1,
          to.z + Math.sin(ang) * r,
          Math.cos(ang) * 0.9,
          1.35 + Math.random() * 1.6,
          Math.sin(ang) * 0.9,
          { scale: 0.55 + Math.random() * 0.85, expandTo: 1.5, life: 0.65 + Math.random() * 0.4 }
        );
      }
    } else if (fxType === 'wind') {
      pulseImpactLight('#bbf7d0', toSide, 3.6);
      for (let r = 0; r < 4; r++) {
        addFxParticle(
          geos.ribbon,
          r % 2 === 0 ? '#f0fdf4' : '#86efac',
          to.x, to.y - 0.5 + r * 0.45, to.z,
          0, 1.5, 0,
          { rotX: Math.PI / 2 + 0.18, rotZ: r * 1.4, vrotY: 11, scale: 0.9, expandTo: 2.1, delay: r * 0.05, life: 0.48 }
        );
      }
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        addFxParticle(
          geos.leaf,
          i % 2 === 0 ? '#ffffff' : '#a7f3d0',
          to.x + Math.cos(ang) * 0.6, to.y - 0.3, to.z + Math.sin(ang) * 0.6,
          Math.cos(ang + 1.2) * 2.8, 2.2 + Math.random() * 1.4, Math.sin(ang + 1.2) * 2.8,
          { vrotX: 12, vrotY: 10, scale: 0.8, life: 0.5 }
        );
      }
    } else if (fxType === 'heal') {
      pulseImpactLight('#4ade80', toSide, 3.8);
      for (let r = 0; r < 2; r++) {
        addFxParticle(geos.ring, '#86efac', to.x, to.y - 0.7, to.z, 0, 1.45, 0, {
          rotX: Math.PI / 2, scale: 0.75, expandTo: 2.1, delay: r * 0.12, life: 0.62
        });
      }
      for (let i = 0; i < 20; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = 0.4 + Math.random() * 0.85;
        addFxParticle(
          i % 3 === 0 ? geos.plus : geos.octa,
          i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#4ade80' : '#bbf7d0',
          to.x + Math.cos(ang) * r,
          to.y - 0.65 + Math.random() * 0.7,
          to.z + Math.sin(ang) * r,
          0, 1.85 + Math.random() * 1.5, 0,
          { scale: 0.6 + Math.random() * 0.55, vrotY: 5, delay: Math.random() * 0.16, life: 0.65 + Math.random() * 0.3 }
        );
      }
    } else if (fxType === 'buff') {
      pulseImpactLight('#facc15', toSide, 4.2);
      for (let r = 0; r < 3; r++) {
        addFxParticle(geos.ring, '#facc15', to.x, to.y - 0.75, to.z, 0, 1.9, 0, {
          rotX: Math.PI / 2, scale: 0.85, expandTo: 2.25, delay: r * 0.09, life: 0.56
        });
      }
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2;
        addFxParticle(
          geos.octa,
          i % 2 === 0 ? '#facc15' : '#fef08a',
          to.x + Math.cos(ang) * 0.9,
          to.y - 0.6,
          to.z + Math.sin(ang) * 0.9,
          Math.cos(ang) * 0.4, 2.2 + Math.random() * 1.5, Math.sin(ang) * 0.4,
          { scale: 0.65, vrotY: 8, delay: Math.random() * 0.14, life: 0.6 + Math.random() * 0.28 }
        );
      }
    } else {
      // 'impact' (padrão)
      pulseImpactLight('#fef08a', toSide, 4.0);
      addFxParticle(geos.ring, '#fef08a', to.x, to.y, to.z, 0, 0, 0, {
        rotY: -0.3, scale: 0.4, expandTo: 2.35, life: 0.32
      });
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const spd = 2.4 + Math.random() * 3.0;
        addFxParticle(
          geos.octa,
          i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fde047' : '#fb923c',
          to.x, to.y, to.z,
          Math.cos(ang) * spd, (Math.random() - 0.25) * spd, Math.sin(ang) * spd,
          { gravity: -2.0, scale: 0.6 + Math.random() * 0.5, vrotY: 12, life: 0.36 + Math.random() * 0.2 }
        );
      }
    }
  }

  function spawnAbsorptionFx() {
    const THREE = getThree();
    if (!active || !THREE || !dynamicGroup) return;
    const geos = getSharedFxGeos(THREE);
    const base = ENEMY_POS;
    const targetY = base.y + 2.55;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.1;
      const sx = base.x + Math.cos(a) * r;
      const sy = base.y + 0.3 + Math.random() * 1.4;
      const sz = base.z + Math.sin(a) * r;
      const dur = 0.32 + Math.random() * 0.16;
      addFxParticle(
        geos.octa,
        i % 2 === 0 ? '#86efac' : '#fef08a',
        sx, sy, sz,
        (base.x - sx) / dur, (targetY - sy) / dur, (base.z - sz) / dur,
        { scale: 0.55 + Math.random() * 0.4, vrotY: 12, delay: Math.random() * 0.12, life: dur }
      );
    }
  }

  function spawnCaptureBurst(success) {
    const THREE = getThree();
    if (!active || !THREE || !dynamicGroup) return;
    const geos = getSharedFxGeos(THREE);
    const cx = ENEMY_POS.x;
    const cy = ENEMY_POS.y + 0.55;
    const cz = ENEMY_POS.z;

    if (success) {
      pulseImpactLight('#facc15', 'enemy', 5.5);
      addFxParticle(geos.ring, '#fde047', cx, cy, cz, 0, 0.2, 0, {
        rotX: Math.PI / 2, scale: 0.4, expandTo: 3.3, life: 0.55
      });
      for (let i = 0; i < 30; i++) {
        const ang = (i / 30) * Math.PI * 2;
        const spd = 2.0 + Math.random() * 3.4;
        const isLeaf = i % 3 === 0;
        addFxParticle(
          isLeaf ? geos.leaf : geos.octa,
          isLeaf ? (i % 2 === 0 ? '#4ade80' : '#22c55e') : (i % 3 === 1 ? '#facc15' : '#fef08a'),
          cx, cy, cz,
          Math.cos(ang) * spd, 2.8 + Math.random() * 3.0, Math.sin(ang) * spd,
          { additive: !isLeaf, gravity: -6.2, scale: 0.75 + Math.random() * 0.65, vrotX: 8, vrotY: 10, life: 0.78 + Math.random() * 0.42 }
        );
      }
    } else {
      pulseImpactLight('#ffffff', 'enemy', 4.0);
      addFxParticle(geos.ring, '#ffffff', cx, cy, cz, 0, 0.2, 0, {
        rotX: Math.PI / 2, scale: 0.4, expandTo: 2.6, life: 0.36
      });
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.0 + Math.random() * 2.4;
        addFxParticle(
          geos.sphere,
          i % 2 === 0 ? '#ffffff' : '#fef3c7',
          cx, cy, cz,
          Math.cos(ang) * spd, 1.2 + Math.random() * 2.0, Math.sin(ang) * spd,
          { additive: false, opacity: 0.85, gravity: -2.5, scale: 0.7 + Math.random() * 0.6, life: 0.42 + Math.random() * 0.22 }
        );
      }
    }
  }

  // =========================================================================
  // CÂMERA CINEMATOGRÁFICA DINÂMICA + PROJEÇÃO 3D → TELA 2D
  // =========================================================================
  function setCameraFocus(mode, durationSec) {
    camFocusMode = mode || 'idle';
    camFocusTimer = typeof durationSec === 'number' ? durationSec : (mode === 'idle' ? 0 : 0.75);
  }

  function triggerShake(intensity, durationMs) {
    // Escala de shake 2D (5..13) → amplitude 3D suave (0.08..0.28)
    camShakeIntensity = Math.max(camShakeIntensity, (intensity || 6) * 0.021);
    camShakeDur = Math.max(durationMs || 180, 100);
    camShakeTime = camShakeDur;
  }

  function updateCamera(dt) {
    const THREE = getThree();
    if (!camera || !THREE) return;

    if (!camCurPos) {
      camCurPos = new THREE.Vector3(CAM_BASE_POS.x, CAM_BASE_POS.y, CAM_BASE_POS.z);
      camCurTarget = new THREE.Vector3(CAM_BASE_TARGET.x, CAM_BASE_TARGET.y, CAM_BASE_TARGET.z);
    }

    if (camFocusTimer > 0) {
      camFocusTimer -= dt;
      if (camFocusTimer <= 0 && camFocusMode !== 'capture_wobble' && camFocusMode !== 'capture_win') {
        camFocusMode = 'idle';
      }
    }

    // Ajuste suave para telas estreitas (celular em pé!) para não cortar os 2 standees
    const aspect = camera.aspect || 1.58;
    const narrowScale = aspect < 1.56 ? clamp(1.56 / aspect, 1, 1.52) : 1;

    // Respiração suave estilo diorama
    const breathX = Math.sin(sceneTime * 0.48) * 0.26;
    const breathY = Math.sin(sceneTime * 0.75) * 0.08;

    let goalX = CAM_BASE_POS.x * narrowScale + breathX;
    let goalY = CAM_BASE_POS.y * (0.94 + narrowScale * 0.06) + breathY;
    let goalZ = CAM_BASE_POS.z * narrowScale;

    let lookX = CAM_BASE_TARGET.x + breathX * 0.2;
    let lookY = CAM_BASE_TARGET.y;
    let lookZ = CAM_BASE_TARGET.z;

    let dampSpeed = 4.2;

    if (camFocusMode === 'attack_player') {
      goalX += 0.95;
      goalY -= 0.22;
      goalZ -= 1.25;
      lookX += 0.85;
      lookY += 0.06;
      lookZ -= 0.65;
      dampSpeed = 6.0;
    } else if (camFocusMode === 'attack_enemy') {
      goalX -= 0.95;
      goalY -= 0.18;
      goalZ -= 1.15;
      lookX -= 0.85;
      lookY += 0.05;
      lookZ += 0.55;
      dampSpeed = 6.0;
    } else if (camFocusMode === 'hit_enemy') {
      goalX += 1.25;
      goalY -= 0.28;
      goalZ -= 1.65;
      lookX = lerp(CAM_BASE_TARGET.x, ENEMY_POS.x, 0.52);
      lookY = 1.35;
      lookZ = lerp(CAM_BASE_TARGET.z, ENEMY_POS.z, 0.52);
      dampSpeed = 7.2;
    } else if (camFocusMode === 'hit_player') {
      goalX -= 1.15;
      goalY -= 0.22;
      goalZ -= 1.35;
      lookX = lerp(CAM_BASE_TARGET.x, PLAYER_POS.x, 0.45);
      lookY = 1.25;
      lookZ = lerp(CAM_BASE_TARGET.z, PLAYER_POS.z, 0.45);
      dampSpeed = 7.2;
    } else if (camFocusMode === 'capture_throw') {
      goalX = 0.85;
      goalY = 3.2;
      goalZ = 7.6 * narrowScale;
      lookX = ENEMY_POS.x * 0.68;
      lookY = 1.55;
      lookZ = ENEMY_POS.z * 0.68;
      dampSpeed = 5.2;
    } else if (camFocusMode === 'capture_wobble') {
      // Close cinematográfico no Vaso de Captura balançando!
      goalX = 1.55;
      goalY = 2.05;
      goalZ = 3.45 * narrowScale;
      lookX = ENEMY_POS.x;
      lookY = ENEMY_POS.y + 0.62;
      lookZ = ENEMY_POS.z;
      dampSpeed = 4.6;
    } else if (camFocusMode === 'capture_win') {
      goalX = 0.95;
      goalY = 2.45;
      goalZ = 5.4 * narrowScale;
      lookX = ENEMY_POS.x * 0.85;
      lookY = ENEMY_POS.y + 0.72;
      lookZ = ENEMY_POS.z * 0.85;
      dampSpeed = 3.6;
    } else if (camFocusMode === 'evolve') {
      goalX = -1.35;
      goalY = 2.35;
      goalZ = 6.2 * narrowScale;
      lookX = PLAYER_POS.x;
      lookY = PLAYER_POS.y + 1.35;
      lookZ = PLAYER_POS.z;
      dampSpeed = 4.4;
    }

    const alpha = 1 - Math.exp(-dampSpeed * dt);
    camCurPos.x = lerp(camCurPos.x, goalX, alpha);
    camCurPos.y = lerp(camCurPos.y, goalY, alpha);
    camCurPos.z = lerp(camCurPos.z, goalZ, alpha);

    camCurTarget.x = lerp(camCurTarget.x, lookX, alpha);
    camCurTarget.y = lerp(camCurTarget.y, lookY, alpha);
    camCurTarget.z = lerp(camCurTarget.z, lookZ, alpha);

    let sx = 0;
    let sy = 0;
    if (camShakeTime > 0 && camShakeIntensity > 0) {
      camShakeTime = Math.max(0, camShakeTime - dt * 1000);
      const damp = camShakeTime / Math.max(1, camShakeDur);
      sx = (Math.random() - 0.5) * 2 * camShakeIntensity * damp;
      sy = (Math.random() - 0.5) * 2 * camShakeIntensity * damp;
      if (camShakeTime === 0) camShakeIntensity = 0;
    }

    camera.position.set(camCurPos.x + sx, camCurPos.y + sy, camCurPos.z);
    camera.lookAt(camCurTarget.x + sx * 0.4, camCurTarget.y + sy * 0.4, camCurTarget.z);
  }

  function projectToScreen(side, yOffset, logicalW, logicalH) {
    const THREE = getThree();
    if (!active || !camera || !THREE) return null;
    const base = side === 'player' ? PLAYER_POS : ENEMY_POS;
    const scale = side === 'player' ? playerStageScale : enemyStageScale;
    const h = (side === 'player' ? 2.68 : 2.52) * scale;

    const v = new THREE.Vector3(base.x, base.y + h * 0.88 + (yOffset || 0), base.z);
    v.project(camera);

    const W = logicalW || 760;
    const H = logicalH || 480;
    return {
      x: (v.x * 0.5 + 0.5) * W,
      y: (-v.y * 0.5 + 0.5) * H
    };
  }

  // =========================================================================
  // ATUALIZAÇÃO POR QUADRO (STANDEES, BIOMA, PARTÍCULAS, RENDER)
  // =========================================================================
  function syncStandeeTransform(standee, auraMesh, statusGroup, goldenGroup, basePos, anim, creature, isPlayer, nowMs) {
    if (!standee) return;
    if (!creature || anim.alpha <= 0.01) {
      standee.group.visible = false;
      return;
    }
    standee.group.visible = true;

    // Converter deslocamentos 2D (lunge, recuo, slide) em deslocamentos 3D ao longo da diagonal da arena!
    const diagX = ENEMY_POS.x - PLAYER_POS.x; // +5.3
    const diagZ = ENEMY_POS.z - PLAYER_POS.z; // -3.7
    const diagLen = Math.hypot(diagX, diagZ);
    const dirX = diagX / diagLen;
    const dirZ = diagZ / diagLen;

    // offsetX positivo para jogador = avanço em direção ao inimigo; negativo = recuo/slide para fora
    const ox = anim.offsetX || 0;
    const oy = anim.offsetY || 0;
    const drop = (anim.faintDrop || 0) * 0.022;

    let wx = basePos.x;
    let wz = basePos.z;
    if (Math.abs(ox) > 65) {
      // Slide-in / slide-out lateral cinematográfico
      wx += ox * 0.022;
      wz += (isPlayer ? 1 : -1) * Math.abs(ox) * 0.004;
    } else {
      // Lunge / recuo na linha real de combate 3D entre os 2 HortaMons
      const forward = ox * 0.032;
      wx += dirX * forward;
      wz += dirZ * forward;
    }
    const wy = basePos.y - oy * 0.024 - drop;

    standee.group.position.set(wx, wy, wz);

    // Respiração suave e squash/stretch
    const t = nowMs * 0.001 + (isPlayer ? 0 : 1.7);
    const sleeping = creature.status === 'sleep';
    const breathSpeed = sleeping ? 1.3 : 2.9;
    const breathAmp = sleeping ? 0.014 : 0.024;
    const breathY = 1 + Math.sin(t * breathSpeed) * breathAmp;
    const breathX = 1 - Math.sin(t * breathSpeed) * (breathAmp * 0.65);

    standee.group.scale.set(
      Math.max(0.001, (anim.scaleX || 1) * breathX),
      Math.max(0.001, (anim.scaleY || 1) * breathY),
      1
    );

    // Leve inclinação voltada para a câmera mantendo o visual HD-2D de livro/diorama
    standee.group.rotation.y = isPlayer ? -0.18 : 0.14;
    if (sleeping) {
      standee.group.rotation.z = Math.sin(t * 1.3) * 0.05;
    } else {
      standee.group.rotation.z = 0;
    }

    // Opacidade e Hit-Flash branco brilhante
    if (standee.material) {
      standee.material.opacity = clamp(anim.alpha != null ? anim.alpha : 1, 0, 1);
    }
    if (typeof standee.setFlash === 'function') {
      standee.setFlash(clamp(anim.hitFlash || 0, 0, 1));
    }
    if (standee.shadowMesh) {
      standee.shadowMesh.visible = anim.alpha > 0.25 && drop < 0.5;
      standee.shadowMesh.position.y = 0.025 + Math.max(0, oy * 0.024);
    }

    // Aura de buff / cura / evolução
    if (auraMesh) {
      const aa = anim.auraAlpha || 0;
      auraMesh.visible = aa > 0.01 && Boolean(anim.auraColor);
      if (auraMesh.visible) {
        auraMesh.material.color.set(anim.auraColor);
        auraMesh.material.opacity = aa * 0.65;
        auraMesh.rotation.y = sceneTime * 3.5;
        const pulse = 0.92 + Math.sin(sceneTime * 9) * 0.08;
        auraMesh.scale.set(pulse, 1, pulse);
      }
    }

    // Efeitos 3D de status e brilhos dourados
    updateStatusGroup(statusGroup, creature.status || null, t);
    updateGoldenGroup(goldenGroup, t);
  }

  function updateBiomeAnimations(dt) {
    for (let i = 0; i < biomeAnimItems.length; i++) {
      const it = biomeAnimItems[i];
      if (it.kind === 'sway') {
        it.obj.rotation.z = Math.sin(sceneTime * it.speed + it.phase) * it.amp;
      } else if (it.kind === 'cloud') {
        it.obj.position.x += it.speed * dt;
        if (it.obj.position.x > it.limitX) it.obj.position.x = -it.limitX;
      } else if (it.kind === 'water') {
        it.obj.position.y = it.baseY + Math.sin(sceneTime * 1.4) * 0.045;
        if (it.tex && it.tex.offset) {
          it.tex.offset.x = (it.tex.offset.x + dt * 0.045) % 1;
          it.tex.offset.y = (it.tex.offset.y + dt * 0.02) % 1;
        }
      } else if (it.kind === 'pulseOpacity') {
        it.obj.material.opacity = it.base + Math.sin(sceneTime * it.speed + it.phase) * it.amp;
      } else if (it.kind === 'pulseScale') {
        const s = it.base + Math.sin(sceneTime * it.speed + it.phase) * it.amp;
        it.obj.scale.set(s, s, 1);
      }
    }

    // Pulsação suave dos cristais bioluminescentes da caverna
    for (let i = 0; i < crystalLights.length; i++) {
      const cl = crystalLights[i];
      cl.light.intensity = cl.base * (0.86 + Math.sin(sceneTime * 2.1 + cl.phase) * 0.18);
    }

    // Decaimento da luz dinâmica de impacto
    if (impactLight && impactLightLife > 0) {
      impactLightLife = Math.max(0, impactLightLife - dt);
      impactLight.intensity = impactLightLife > 0 ? impactLight.intensity * Math.pow(0.06, dt) : 0;
    }

    // Pólen, pétalas e esporos 3D
    for (let i = 0; i < ambientParticles.length; i++) {
      const ap = ambientParticles[i];
      const m = ap.mesh;
      m.position.x += (ap.vx + Math.sin(sceneTime * 1.4 + ap.phase) * 0.16) * dt;
      m.position.y += ap.vy * dt;
      m.rotation.y += 1.6 * dt;
      m.rotation.x += 1.1 * dt;
      if (ap.glowing) {
        if (m.position.y > 5.4) m.position.y = 0.4;
      } else {
        if (m.position.y < 0.2) {
          m.position.y = 5.2;
          m.position.x = (Math.random() - 0.5) * 14;
        }
      }
      if (m.position.x > 8) m.position.x = -8;
      if (m.position.x < -8) m.position.x = 8;
    }

    // Partículas 3D de golpes e captura
    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const p = fxParticles[i];
      p.age += dt;
      if (p.age < 0) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.visible = true;
      if (p.age >= p.life) {
        if (dynamicGroup) dynamicGroup.remove(p.mesh);
        if (p.mesh.material) {
          const midx = ownedMaterials.indexOf(p.mesh.material);
          if (midx >= 0) ownedMaterials.splice(midx, 1);
          p.mesh.material.dispose();
        }
        fxParticles.splice(i, 1);
        continue;
      }

      const t = clamp(p.age / p.life, 0, 1);
      p.vy += p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.vrotX) p.mesh.rotation.x += p.vrotX * dt;
      if (p.vrotY) p.mesh.rotation.y += p.vrotY * dt;
      if (p.vrotZ) p.mesh.rotation.z += p.vrotZ * dt;

      if (p.expandTo > 0) {
        p.mesh.scale.setScalar(lerp(p.baseScale, p.expandTo, t));
      } else {
        p.mesh.scale.setScalar(p.baseScale * (1 - t * 0.45));
      }
      p.mesh.material.opacity = p.baseOpacity * (1 - t * t);
    }
  }

  // =========================================================================
  // API PÚBLICA: HM.Battle3D
  // =========================================================================
  function start(opts) {
    stop();
    if (!canRun3D()) return false;

    const THREE = getThree();
    const o = opts || {};
    overlayCanvas = o.overlayCanvas || (typeof document !== 'undefined' ? document.getElementById('battle-canvas') : null);
    if (!overlayCanvas) return false;

    if (!ensureCanvasLayer(overlayCanvas)) return false;

    currentBiome = resolveBiomeKey(o.sceneKey || 'jardim', o.battleType || 'wild', o.trainerNpc || null);
    sceneTime = 0;
    camFocusMode = 'idle';
    camFocusTimer = 0;
    camShakeTime = 0;
    camShakeIntensity = 0;
    camCurPos = null;
    camCurTarget = null;
    lastRect = { left: -1, top: -1, width: -1, height: -1 };

    scene = new THREE.Scene();
    const w = Math.max(1, overlayCanvas.clientWidth || overlayCanvas.width || 760);
    const h = Math.max(1, overlayCanvas.clientHeight || overlayCanvas.height || 480);
    camera = new THREE.PerspectiveCamera(35, w / h, 0.2, 320);

    buildBiome(currentBiome);

    dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);

    playerStandee = null;
    enemyStandee = null;
    playerSpecKey = '';
    enemySpecKey = '';
    potRoot = null;
    potBuiltSuper = null;
    fxParticles = [];
    sharedFxGeos = null;

    if (o.playerCreature) ensureStandee('player', o.playerCreature);
    if (o.enemyCreature) ensureStandee('enemy', o.enemyCreature);

    glCanvas.style.display = 'block';
    syncCanvasBounds();
    updateCamera(0.016);

    active = true;
    try {
      renderer.render(scene, camera);
    } catch (err) {
      console.warn('[HortaMon Battle3D] Erro no primeiro render WebGL, voltando para 2D:', err);
      stop();
      return false;
    }
    return true;
  }

  function setCreatures(playerCreature, enemyCreature) {
    if (!active) return;
    if (playerCreature) ensureStandee('player', playerCreature);
    if (enemyCreature) ensureStandee('enemy', enemyCreature);
  }

  function syncState(frameData) {
    if (!active || !renderer || !scene || !camera) return false;

    const dt = clamp(frameData.dt || 0.016, 0.001, 0.05);
    const nowMs = frameData.nowMs || performance.now();
    sceneTime += dt;

    syncCanvasBounds();

    if (frameData.playerCreature) ensureStandee('player', frameData.playerCreature);
    if (frameData.enemyCreature) ensureStandee('enemy', frameData.enemyCreature);

    syncStandeeTransform(
      playerStandee,
      playerAuraRing,
      playerStatusGroup,
      playerGoldenGroup,
      PLAYER_POS,
      frameData.playerAnim,
      frameData.playerCreature,
      true,
      nowMs
    );
    syncStandeeTransform(
      enemyStandee,
      enemyAuraRing,
      enemyStatusGroup,
      enemyGoldenGroup,
      ENEMY_POS,
      frameData.enemyAnim,
      frameData.enemyCreature,
      false,
      nowMs
    );

    syncCapturePot3D(frameData.potAnim);
    updateBiomeAnimations(dt);
    updateCamera(dt);

    try {
      renderer.render(scene, camera);
      return true;
    } catch (err) {
      console.warn('[HortaMon Battle3D] Erro durante render WebGL:', err);
      stop();
      return false;
    }
  }

  function disposeOwnedResources() {
    // Usar HM.HD2D.disposeObject quando disponível (descarta geometrias, materiais e customDepthMaterial preservando texturas _hd2dShared)
    if (scene && HM.HD2D && typeof HM.HD2D.disposeObject === 'function') {
      try { HM.HD2D.disposeObject(scene); } catch (_) {}
    }

    for (let i = 0; i < ownedGeometries.length; i++) {
      try { ownedGeometries[i].dispose(); } catch (_) {}
    }
    for (let i = 0; i < ownedMaterials.length; i++) {
      try { ownedMaterials[i].dispose(); } catch (_) {}
    }
    for (let i = 0; i < ownedTextures.length; i++) {
      try { ownedTextures[i].dispose(); } catch (_) {}
    }

    ownedGeometries = [];
    ownedMaterials = [];
    ownedTextures = [];
    sharedFxGeos = null;
    fxParticles = [];
    biomeAnimItems = [];
    ambientParticles = [];
    crystalLights = [];
  }

  function stop() {
    active = false;
    disposeOwnedResources();

    if (scene) {
      scene.clear();
      scene = null;
    }
    camera = null;
    biomeGroup = null;
    dynamicGroup = null;
    playerStandee = null;
    enemyStandee = null;
    playerAuraRing = null;
    enemyAuraRing = null;
    playerStatusGroup = null;
    enemyStatusGroup = null;
    playerGoldenGroup = null;
    enemyGoldenGroup = null;
    playerSpecKey = '';
    enemySpecKey = '';
    potRoot = null;
    potMeshGroup = null;
    potLidGroup = null;
    potBeamMesh = null;
    potInnerGlow = null;
    potLight = null;
    potBuiltSuper = null;
    impactLight = null;

    if (glCanvas) {
      glCanvas.style.display = 'none';
    }
    if (renderer && typeof renderer.renderLists === 'object' && renderer.renderLists && renderer.renderLists.dispose) {
      try { renderer.renderLists.dispose(); } catch (_) {}
    }
  }

  function isActive() {
    return active;
  }

  HM.Battle3D = {
    isActive: isActive,
    start: start,
    setCreatures: setCreatures,
    syncState: syncState,
    spawnMoveFx: spawnMoveFx,
    spawnAbsorptionFx: spawnAbsorptionFx,
    spawnCaptureBurst: spawnCaptureBurst,
    triggerShake: triggerShake,
    setCameraFocus: setCameraFocus,
    projectToScreen: projectToScreen,
    stop: stop
  };
})(window);
