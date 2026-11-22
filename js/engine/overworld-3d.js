(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  const TILE = {
    GRASS: 0,
    DIRT: 1,
    TALL_GRASS: 2,
    WATER: 3,
    TREE: 4,
    FENCE: 5,
    BUILDING: 6,
    DOOR: 7,
    FLOWERS: 8,
    GREENHOUSE_FLOOR: 9,
    BRIDGE: 10,
    HEAL_COUNTER: 11,
    SAND: 12,
    PALM: 13,
    CAVE_FLOOR: 14,
    ROCK: 15,
    CAVE_GRASS: 16
  };

  const DIR_LOOK_AHEAD = {
    up: { x: 0, z: -0.58 },
    down: { x: 0, z: 0.58 },
    left: { x: -0.62, z: 0 },
    right: { x: 0.62, z: 0 }
  };

  // Fallback biome presets if HM.HD2D.BIOME_PRESETS is missing a key
  const FALLBACK_BIOMES = {
    jardim: {
      skyTop: 0x5aa9e6,
      skyMid: 0xbfe6ff,
      skyBottom: 0xfef3c7,
      fogColor: 0xd9efd8,
      fogNear: 20,
      fogFar: 46,
      sunColor: 0xfff5d6,
      sunIntensity: 1.38,
      hemiSky: 0xcbeeff,
      hemiGround: 0x5c7f4b,
      hemiIntensity: 0.78,
      sunPos: [14, 22, 12]
    },
    rota2: {
      skyTop: 0x4b8ec2,
      skyMid: 0xa9d7e0,
      skyBottom: 0xe2f0d4,
      fogColor: 0xc9e3d5,
      fogNear: 18,
      fogFar: 42,
      sunColor: 0xfff0cc,
      sunIntensity: 1.24,
      hemiSky: 0xbce6e0,
      hemiGround: 0x4b6a48,
      hemiIntensity: 0.82,
      sunPos: [12, 20, 10]
    },
    arena: {
      skyTop: 0x62a8e5,
      skyMid: 0xdceeff,
      skyBottom: 0xfef08a,
      fogColor: 0xf1ebd0,
      fogNear: 21,
      fogFar: 48,
      sunColor: 0xffefc2,
      sunIntensity: 1.48,
      hemiSky: 0xfff6d6,
      hemiGround: 0x857852,
      hemiIntensity: 0.85,
      sunPos: [15, 24, 13]
    },
    tropical: {
      skyTop: 0x3b9ae1,
      skyMid: 0xffd59e,
      skyBottom: 0xffb385,
      fogColor: 0xf5dcb8,
      fogNear: 20,
      fogFar: 46,
      sunColor: 0xffdfa8,
      sunIntensity: 1.5,
      hemiSky: 0xffe4bd,
      hemiGround: 0x9b8053,
      hemiIntensity: 0.82,
      sunPos: [18, 19, 14]
    },
    caverna: {
      skyTop: 0x161228,
      skyMid: 0x241d3d,
      skyBottom: 0x332852,
      fogColor: 0x241d3c,
      fogNear: 11,
      fogFar: 30,
      sunColor: 0xa5b4fc,
      sunIntensity: 0.62,
      hemiSky: 0x67e8f9,
      hemiGround: 0x2c1f42,
      hemiIntensity: 0.65,
      sunPos: [8, 18, 10]
    }
  };

  function hash2D(col, row, seed) {
    let h = (col * 374761393 + row * 668265263 + (seed || 0) * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function parseHexColor(hex, fallback) {
    if (typeof hex === 'number') return hex;
    if (typeof hex === 'string' && hex[0] === '#') {
      const cleaned = hex.length === 4
        ? hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
        : hex.slice(1, 7);
      const parsed = parseInt(cleaned, 16);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return fallback;
  }

  function zoneToBiomeKey(zone) {
    if (!zone) return 'jardim';
    if (zone.id === 'subterranea' || zone.scene === 'caverna') return 'caverna';
    if (zone.id === 'pomar' || zone.scene === 'tropical') return 'tropical';
    if (zone.id === 'arena') return 'arena';
    if (zone.id === 'rota2') return 'rota2';
    return 'jardim';
  }

  function getBiomePreset(key) {
    const core = HM.HD2D && HM.HD2D.BIOME_PRESETS;
    if (core && core[key]) {
      return Object.assign({}, FALLBACK_BIOMES[key] || FALLBACK_BIOMES.jardim, core[key]);
    }
    return FALLBACK_BIOMES[key] || FALLBACK_BIOMES.jardim;
  }

  // ==================== RUNTIME SINGLETON STATE ====================

  let active = false;
  let overlayCanvas = null;
  let glCanvas = null;
  let prevOverlayStyles = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let world = null;

  // Lights & atmosphere
  let sunLight = null;
  let hemiLight = null;
  let ambientLight = null;
  let skyDome = null;
  let cavePointLights = [];
  let currentBiome = {
    skyTop: null,
    skyMid: null,
    skyBottom: null,
    fogColor: null,
    sunColor: null,
    hemiSky: null,
    hemiGround: null,
    fogNear: 24,
    fogFar: 64,
    sunIntensity: 1.35,
    hemiIntensity: 0.76,
    sunOffset: null
  };

  // Camera tracking
  let camFocus = null;
  let camSnapped = false;
  let biomeSnapped = false;
  let lookAheadX = 0;
  let lookAheadZ = 0;
  let lastViewportW = 768;
  let lastViewportH = 480;
  let lastPixelW = 0;
  let lastPixelH = 0;

  // Animated environment references
  let waterTextureClone = null;
  let waterMesh = null;
  let lilyPadInst = null;
  let lilyPadEntries = [];
  let tallGrassInst = null;
  let tallGrassEntries = [];
  let caveGrassInst = null;
  let caveGrassEntries = [];
  let treeCanopyGroup = []; // { mesh, baseEntries } — subtle gentle wind sway
  let palmCanopyInst = null;
  let palmCanopyEntries = [];
  let flowerInst = null;
  let flowerEntries = [];
  let crystalMaterials = [];

  // Entities (Standees)
  let playerStandee = null;
  let playerLastTexKey = '';
  let npcStandees = Object.create(null); // id -> { standee, npc, lastTexKey }
  let activeNpcMeshes = [];

  // Click destination indicator
  let destRingMesh = null;

  // 3D particles & ambient motes & butterflies
  let burstParticles = [];
  let burstGeo = null;
  let ambientPoints = null;
  let ambientPositions = null;
  let ambientPhases = null;
  let ambientMaterial = null;
  let butterflies3D = [];

  // Raycasting & projection scratch objects
  let raycaster = null;
  let groundPlane = null;
  let scratchVec3 = null;
  let scratchVec2 = null;
  let scratchMat4 = null;
  let scratchPos = null;
  let scratchQuat = null;
  let scratchScale = null;
  let scratchEuler = null;
  let scratchColor = null;

  // Resource tracking for clean disposal (never disposes shared HM.HD2D textures!)
  let ownedGeometries = [];
  let ownedMaterials = [];
  let ownedTextures = [];

  function trackGeo(g) {
    if (g) ownedGeometries.push(g);
    return g;
  }

  function trackMat(m) {
    if (m) ownedMaterials.push(m);
    return m;
  }

  function trackTex(t) {
    if (t) ownedTextures.push(t);
    return t;
  }

  function makeInstanced(THREE, geo, mat, count) {
    const inst = new THREE.InstancedMesh(geo, mat, count);
    // Important in Three.js r147: InstancedMesh uses base geometry boundingSphere at (0,0,0) for frustum culling!
    inst.frustumCulled = false;
    return inst;
  }

  function getTile(col, row) {
    if (!world || !world.tiles) return TILE.TREE;
    if (row < 0 || row >= world.rows || col < 0 || col >= world.cols) return TILE.TREE;
    const r = world.tiles[row];
    return r && r[col] !== undefined ? r[col] : TILE.GRASS;
  }

  // ==================== PROCEDURAL HELPER GEOMETRIES & TEXTURES ====================

  // Crossed 3-plane lush botanical tuft geometry (great from every perspective!)
  function createGrassTuftGeometry(THREE) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const blades = 5;
    let vCount = 0;

    for (let i = 0; i < blades; i++) {
      const ang = (i / blades) * Math.PI * 2 + 0.25;
      const rad = i === 0 ? 0.0 : 0.14;
      const ox = Math.cos(ang) * rad;
      const oz = Math.sin(ang) * rad;
      const w = 0.125;
      const h = i === 0 ? 0.52 : 0.44 + (i % 2) * 0.07;
      const lean = i === 0 ? 0.04 : 0.13;

      const tx = -Math.sin(ang) * w;
      const tz = Math.cos(ang) * w;
      const lx = Math.cos(ang) * lean;
      const lz = Math.sin(ang) * lean;

      // Tapered quad (base wide, mid slightly curved, tip narrow)
      // 4 vertices per blade: base-L, base-R, tip-R, tip-L
      positions.push(
        ox - tx, 0.0, oz - tz,
        ox + tx, 0.0, oz + tz,
        ox + tx * 0.18 + lx, h, oz + tz * 0.18 + lz,
        ox - tx * 0.18 + lx, h, oz - tz * 0.18 + lz
      );
      for (let k = 0; k < 4; k++) {
        normals.push(0, 1, 0);
      }
      uvs.push(0, 0, 1, 0, 0.75, 1, 0.25, 1);
      indices.push(vCount, vCount + 1, vCount + 2, vCount, vCount + 2, vCount + 3);
      vCount += 4;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return trackGeo(geo);
  }

  // Graceful curved palm frond crown (6 arched leaves merged into 1 single geometry for fast instancing!)
  function createPalmCrownGeometry(THREE) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let vBase = 0;
    const frondCount = 6;
    const segs = 4;

    for (let f = 0; f < frondCount; f++) {
      const ang = (f / frondCount) * Math.PI * 2 + 0.3;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const sideX = -sinA;
      const sideZ = cosA;
      const len = 1.12 + (f % 2) * 0.14;
      const lift = 0.26 + (f % 2) * 0.08;

      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const dist = t * len;
        const archY = Math.sin(t * Math.PI * 0.85) * lift - t * t * 0.48;
        const halfW = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.22 + (1 - t) * 0.04;

        const cx = cosA * dist;
        const cz = sinA * dist;

        positions.push(
          cx - sideX * halfW, archY - 0.04 * t, cz - sideZ * halfW,
          cx + sideX * halfW, archY - 0.04 * t, cz + sideZ * halfW
        );
        normals.push(0, 1, 0, 0, 1, 0);
        uvs.push(0, t, 1, t);
      }

      for (let s = 0; s < segs; s++) {
        const a = vBase + s * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, d, a, d, c);
      }
      vBase += (segs + 1) * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return trackGeo(geo);
  }

  // Soft glowing circular mote texture for 3D pollen & cave fireflies
  function createSoftMoteTexture(THREE) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,240,0.82)');
      grad.addColorStop(0.75, 'rgba(255,245,190,0.22)');
      grad.addColorStop(1, 'rgba(255,245,190,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return trackTex(tex);
  }

  // Crisp readable wooden signboard texture for 3D buildings
  function createSignboardTexture(THREE, label, accentHex) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 112;
    const g = c.getContext('2d');
    if (g) {
      g.clearRect(0, 0, c.width, c.height);

      // Outer cartoon outline & parchment plaque
      g.fillStyle = '#2b1d14';
      roundRectCanvas(g, 6, 8, 500, 96, 22);
      g.fill();

      g.fillStyle = '#fffdf5';
      roundRectCanvas(g, 14, 15, 484, 82, 16);
      g.fill();

      // Subtle inner wood/accent trim
      g.strokeStyle = accentHex || '#c98f55';
      g.lineWidth = 4;
      roundRectCanvas(g, 22, 23, 468, 66, 11);
      g.stroke();

      // Label text
      g.fillStyle = '#2b1d14';
      g.font = '800 38px "Fredoka", "Nunito", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label || '', 256, 58, 444);
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return trackTex(tex);
  }

  function roundRectCanvas(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ==================== BUILD 3D DIORAMA WORLD ====================

  function buildScene(THREE, w) {
    const cols = w.cols;
    const rows = w.rows;
    const textures = (HM.HD2D && typeof HM.HD2D.getTextures === 'function')
      ? HM.HD2D.getTextures()
      : {};

    // ----- 1. Lighting & SkyDome -----
    const initialPreset = getBiomePreset('jardim');
    scene.background = new THREE.Color(initialPreset.fogColor);
    scene.fog = new THREE.Fog(initialPreset.fogColor, initialPreset.fogNear, initialPreset.fogFar);

    currentBiome.skyTop = new THREE.Color(initialPreset.skyTop);
    currentBiome.skyMid = new THREE.Color(initialPreset.skyMid);
    currentBiome.skyBottom = new THREE.Color(initialPreset.skyBottom);
    currentBiome.fogColor = new THREE.Color(initialPreset.fogColor);
    currentBiome.sunColor = new THREE.Color(initialPreset.sunColor);
    currentBiome.hemiSky = new THREE.Color(initialPreset.hemiSky);
    currentBiome.hemiGround = new THREE.Color(initialPreset.hemiGround);
    currentBiome.fogNear = initialPreset.fogNear;
    currentBiome.fogFar = initialPreset.fogFar;
    currentBiome.sunIntensity = initialPreset.sunIntensity;
    currentBiome.hemiIntensity = initialPreset.hemiIntensity;
    currentBiome.sunOffset = new THREE.Vector3(
      initialPreset.sunPos[0],
      initialPreset.sunPos[1],
      initialPreset.sunPos[2]
    );

    if (HM.HD2D && typeof HM.HD2D.createSkyDome === 'function') {
      skyDome = HM.HD2D.createSkyDome(initialPreset.skyTop, initialPreset.skyMid, initialPreset.skyBottom);
      if (skyDome) {
        skyDome.position.set(cols * 0.5, 0, rows * 0.5);
        scene.add(skyDome);
      }
    }

    ambientLight = new THREE.AmbientLight(0xfffaf0, 0.22);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(
      initialPreset.hemiSky,
      initialPreset.hemiGround,
      initialPreset.hemiIntensity
    );
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(initialPreset.sunColor, initialPreset.sunIntensity);
    sunLight.position.set(cols * 0.5 + initialPreset.sunPos[0], initialPreset.sunPos[1], rows * 0.5 + initialPreset.sunPos[2]);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 95;
    const shadowBound = 16;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // ----- 2. Outer Diorama Skirt & Under-Bed -----
    const skirtGeo = trackGeo(new THREE.PlaneGeometry(cols + 32, rows + 32));
    skirtGeo.rotateX(-Math.PI / 2);
    const skirtMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x3b5839,
      roughness: 0.95,
      metalness: 0.0
    }));
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.position.set(cols * 0.5, -0.56, rows * 0.5);
    skirtMesh.receiveShadow = true;
    scene.add(skirtMesh);

    // Sculpted earth border plinth underneath the 60x26 world
    const plinthGeo = trackGeo(new THREE.BoxGeometry(cols + 0.6, 0.7, rows + 0.6));
    const plinthMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x5d4430,
      roughness: 0.92
    }));
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.set(cols * 0.5, -0.78, rows * 0.5);
    plinthMesh.receiveShadow = true;
    scene.add(plinthMesh);

    // ----- 3. Categorize all 60×26 tiles for batched InstancedMeshes -----
    const grassTiles = [];
    const dirtTiles = [];
    const sandTiles = [];
    const caveFloorTiles = [];
    const stoneFloorTiles = [];
    const waterTiles = [];
    const bridgeTiles = [];
    const treeTiles = [];
    const palmTiles = [];
    const rockTiles = [];
    const fenceTiles = [];
    const flowerTiles = [];
    const tallGrassTiles = [];
    const caveGrassTiles = [];
    const healCounterTiles = [];
    const doorTiles = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = getTile(c, r);
        switch (t) {
          case TILE.DIRT:
            dirtTiles.push([c, r]);
            break;
          case TILE.SAND:
            sandTiles.push([c, r]);
            break;
          case TILE.CAVE_FLOOR:
            caveFloorTiles.push([c, r]);
            break;
          case TILE.ROCK:
            caveFloorTiles.push([c, r]);
            rockTiles.push([c, r]);
            break;
          case TILE.CAVE_GRASS:
            caveFloorTiles.push([c, r]);
            caveGrassTiles.push([c, r]);
            break;
          case TILE.GREENHOUSE_FLOOR:
            stoneFloorTiles.push([c, r]);
            break;
          case TILE.DOOR:
            stoneFloorTiles.push([c, r]);
            doorTiles.push([c, r]);
            break;
          case TILE.WATER:
            waterTiles.push([c, r]);
            break;
          case TILE.BRIDGE:
            waterTiles.push([c, r]);
            bridgeTiles.push([c, r]);
            break;
          case TILE.TREE:
            grassTiles.push([c, r]);
            treeTiles.push([c, r]);
            break;
          case TILE.PALM: {
            const nearSand =
              getTile(c, r + 1) === TILE.SAND ||
              getTile(c, r - 1) === TILE.SAND ||
              getTile(c + 1, r) === TILE.SAND ||
              getTile(c - 1, r) === TILE.SAND ||
              c >= 36;
            if (nearSand) sandTiles.push([c, r]);
            else grassTiles.push([c, r]);
            palmTiles.push([c, r]);
            break;
          }
          case TILE.FENCE:
            grassTiles.push([c, r]);
            fenceTiles.push([c, r]);
            break;
          case TILE.FLOWERS:
            grassTiles.push([c, r]);
            flowerTiles.push([c, r]);
            break;
          case TILE.TALL_GRASS:
            grassTiles.push([c, r]);
            tallGrassTiles.push([c, r]);
            break;
          case TILE.HEAL_COUNTER: {
            const nearStone =
              getTile(c, r + 1) === TILE.GREENHOUSE_FLOOR ||
              getTile(c, r - 1) === TILE.GREENHOUSE_FLOOR ||
              getTile(c + 1, r) === TILE.GREENHOUSE_FLOOR;
            if (nearStone) stoneFloorTiles.push([c, r]);
            else grassTiles.push([c, r]);
            healCounterTiles.push([c, r]);
            break;
          }
          case TILE.BUILDING:
            if (c >= 36 && r <= 12) caveFloorTiles.push([c, r]);
            else if (c >= 36) sandTiles.push([c, r]);
            else grassTiles.push([c, r]);
            break;
          case TILE.GRASS:
          default:
            grassTiles.push([c, r]);
            break;
        }
      }
    }

    // ----- 4. Sculpted 3D Terrain Blocks (InstancedMesh per ground biome) -----
    buildTerrainBlockLayer(THREE, grassTiles, 0.55, 0.0, textures.grass, 0xffffff, 0.88, function (c, r) {
      const h = hash2D(c, r, 1);
      // Slight tropical warm tint in east orchard, cooler deep green in Bosque dos Esporos
      if (c >= 36 && r > 12) {
        return h > 0.5 ? 0xdff5be : 0xd2eba8;
      }
      if (r <= 12 && c >= 17 && c <= 34) {
        return h > 0.5 ? 0xc8e4bf : 0xbddbb4;
      }
      return h > 0.62 ? 0xf6ffe8 : h < 0.25 ? 0xe1f1d4 : 0xedf9de;
    });

    buildTerrainBlockLayer(THREE, dirtTiles, 0.52, -0.022, textures.dirt, 0xffffff, 0.92, function (c, r) {
      const h = hash2D(c, r, 10);
      return h > 0.5 ? 0xfff5e4 : 0xf2e4cc;
    });

    buildTerrainBlockLayer(THREE, sandTiles, 0.535, -0.012, textures.sand, 0xffffff, 0.9, function (c, r) {
      const h = hash2D(c, r, 30);
      return h > 0.5 ? 0xfff8dc : 0xf9e9bd;
    });

    buildTerrainBlockLayer(THREE, caveFloorTiles, 0.53, -0.02, textures.caveFloor, 0xffffff, 0.86, function (c, r) {
      const h = hash2D(c, r, 50);
      return h > 0.55 ? 0xdad0ec : 0xc4b8dc;
    });

    buildTerrainBlockLayer(THREE, stoneFloorTiles, 0.585, 0.035, textures.greenhouseFloor, 0xffffff, 0.65, function (c, r) {
      return (c + r) % 2 === 0 ? 0xfffcf2 : 0xf2ead7;
    });

    // Welcome doormats on door tiles
    buildDoorMats(THREE, doorTiles);

    // ----- 5. Recessed Water Bed, Animated Glossy Water Surface & 3D Lily Pads -----
    buildWaterAndBridges(THREE, waterTiles, bridgeTiles, textures, cols, rows);

    // ----- 6. 3D Botanical Foliage & Obstacles (InstancedMesh) -----
    buildFruitTrees(THREE, treeTiles, textures);
    buildPalmTrees(THREE, palmTiles, textures);
    buildCaveRocksAndCrystals(THREE, rockTiles, textures);
    buildFences(THREE, fenceTiles, textures);
    buildFlowers(THREE, flowerTiles);
    buildTallGrass(THREE, tallGrassTiles, textures);
    buildCaveGrass(THREE, caveGrassTiles, textures);
    buildHealCounters(THREE, healCounterTiles, textures);

    // ----- 7. True 3D Buildings (all 6 in HM.WORLD.buildings!) -----
    if (Array.isArray(w.buildings)) {
      for (let i = 0; i < w.buildings.length; i++) {
        build3DBuilding(THREE, w.buildings[i], textures);
      }
    }

    // ----- 8. Cave Bioluminescent PointLights -----
    buildCaveLights(THREE);

    // ----- 9. Click-to-Walk Glowing Destination Ring -----
    const ringGeo = trackGeo(new THREE.RingGeometry(0.22, 0.34, 24));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = trackMat(new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false
    }));
    destRingMesh = new THREE.Mesh(ringGeo, ringMat);
    destRingMesh.position.y = 0.055;
    destRingMesh.visible = false;
    scene.add(destRingMesh);

    // ----- 10. HD-2D Character Standees (Player & NPCs) -----
    buildCharacterStandees(THREE, w);

    // ----- 11. Ambient 3D Pollen / Cave Fireflies & Butterflies -----
    buildAmbientAtmosphere(THREE, w, flowerTiles);
  }

  function buildTerrainBlockLayer(THREE, coords, height, topY, mapTex, baseColor, roughness, tintFn) {
    if (!coords || coords.length === 0) return;
    const geo = trackGeo(new THREE.BoxGeometry(1.004, height, 1.004));
    const mat = trackMat(new THREE.MeshStandardMaterial({
      color: baseColor,
      map: mapTex || null,
      roughness: roughness,
      metalness: 0.02
    }));
    const inst = makeInstanced(THREE, geo, mat, coords.length);
    inst.receiveShadow = true;
    inst.castShadow = false;

    const dummy = new THREE.Object3D();
    const colObj = new THREE.Color();
    const centerY = topY - height * 0.5;

    for (let i = 0; i < coords.length; i++) {
      const c = coords[i][0];
      const r = coords[i][1];
      dummy.position.set(c + 0.5, centerY, r + 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (tintFn) {
        colObj.setHex(tintFn(c, r));
        inst.setColorAt(i, colObj);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }

  function buildDoorMats(THREE, doorTiles) {
    if (!doorTiles || doorTiles.length === 0) return;
    const matGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.025, 0.44));
    const matMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xc97b4b,
      roughness: 0.92
    }));
    const inst = makeInstanced(THREE, matGeo, matMat, doorTiles.length);
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < doorTiles.length; i++) {
      const c = doorTiles[i][0];
      const r = doorTiles[i][1];
      dummy.position.set(c + 0.5, 0.048, r + 0.65);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }

  function buildWaterAndBridges(THREE, waterTiles, bridgeTiles, textures, cols, rows) {
    if (waterTiles.length > 0) {
      // Riverbed under water tiles
      const bedGeo = trackGeo(new THREE.BoxGeometry(1.01, 0.2, 1.01));
      const bedMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x1d687d,
        roughness: 0.95
      }));
      const bedInst = makeInstanced(THREE, bedGeo, bedMat, waterTiles.length);
      bedInst.receiveShadow = true;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < waterTiles.length; i++) {
        dummy.position.set(waterTiles[i][0] + 0.5, -0.5, waterTiles[i][1] + 0.5);
        dummy.updateMatrix();
        bedInst.setMatrixAt(i, dummy.matrix);
      }
      bedInst.instanceMatrix.needsUpdate = true;
      scene.add(bedInst);

      // Animated glossy water tiles
      if (textures.water) {
        waterTextureClone = trackTex(textures.water.clone());
        waterTextureClone.needsUpdate = true;
        waterTextureClone.wrapS = THREE.RepeatWrapping;
        waterTextureClone.wrapT = THREE.RepeatWrapping;
        waterTextureClone.repeat.set(1, 1);
      }

      const surfGeo = trackGeo(new THREE.PlaneGeometry(1.02, 1.02));
      surfGeo.rotateX(-Math.PI / 2);
      const surfMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x52d1f7,
        map: waterTextureClone || null,
        roughness: 0.14,
        metalness: 0.18,
        transparent: true,
        opacity: 0.88
      }));
      waterMesh = makeInstanced(THREE, surfGeo, surfMat, waterTiles.length);
      waterMesh.receiveShadow = true;
      for (let i = 0; i < waterTiles.length; i++) {
        dummy.position.set(waterTiles[i][0] + 0.5, -0.15, waterTiles[i][1] + 0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        waterMesh.setMatrixAt(i, dummy.matrix);
      }
      waterMesh.instanceMatrix.needsUpdate = true;
      scene.add(waterMesh);

      // 3D Lily pads on open non-bridge water
      lilyPadEntries = [];
      for (let i = 0; i < waterTiles.length; i++) {
        const c = waterTiles[i][0];
        const r = waterTiles[i][1];
        if (getTile(c, r) !== TILE.WATER) continue;
        if (hash2D(c, r, 31) > 0.78) {
          lilyPadEntries.push({
            x: c + 0.35 + hash2D(c, r, 33) * 0.32,
            z: r + 0.35 + hash2D(c, r, 34) * 0.32,
            rot: hash2D(c, r, 35) * Math.PI * 2,
            scale: 0.75 + hash2D(c, r, 36) * 0.45,
            phase: c * 0.7 + r * 0.9,
            hasFlower: hash2D(c, r, 32) > 0.55
          });
        }
      }
      if (lilyPadEntries.length > 0) {
        const padGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12, 1, false, 0.3, Math.PI * 1.85));
        const padMat = trackMat(new THREE.MeshStandardMaterial({
          color: 0x38a852,
          roughness: 0.65
        }));
        lilyPadInst = makeInstanced(THREE, padGeo, padMat, lilyPadEntries.length);
        lilyPadInst.castShadow = true;
        lilyPadInst.receiveShadow = true;

        const lotusSpots = lilyPadEntries.filter(function (e) { return e.hasFlower; });
        if (lotusSpots.length > 0) {
          const lotusGeo = trackGeo(new THREE.DodecahedronGeometry(0.085, 0));
          const lotusMat = trackMat(new THREE.MeshStandardMaterial({
            color: 0xf9a8d4,
            emissive: 0x701a4a,
            emissiveIntensity: 0.15,
            roughness: 0.55
          }));
          const lotusInst = makeInstanced(THREE, lotusGeo, lotusMat, lotusSpots.length);
          for (let i = 0; i < lotusSpots.length; i++) {
            dummy.position.set(lotusSpots[i].x, -0.09, lotusSpots[i].z);
            dummy.rotation.set(0, lotusSpots[i].rot, 0);
            dummy.scale.set(1, 0.65, 1);
            dummy.updateMatrix();
            lotusInst.setMatrixAt(i, dummy.matrix);
          }
          lotusInst.instanceMatrix.needsUpdate = true;
          scene.add(lotusInst);
        }

        for (let i = 0; i < lilyPadEntries.length; i++) {
          const e = lilyPadEntries[i];
          dummy.position.set(e.x, -0.13, e.z);
          dummy.rotation.set(0, e.rot, 0);
          dummy.scale.set(e.scale, 1, e.scale);
          dummy.updateMatrix();
          lilyPadInst.setMatrixAt(i, dummy.matrix);
        }
        lilyPadInst.instanceMatrix.needsUpdate = true;
        scene.add(lilyPadInst);
      }
    }

    // 3D Wooden Bridges (wide seamless 2-tile bridges with outer railings & pilings!)
    if (bridgeTiles.length > 0) {
      const woodMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xc98c54,
        map: textures.wood || null,
        roughness: 0.85
      }));
      const railMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x8b5a2b,
        map: textures.wood || null,
        roughness: 0.88
      }));
      const plankGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.09, 0.96));
      const postGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.72, 0.11));
      const beamGeo = trackGeo(new THREE.BoxGeometry(1.02, 0.08, 0.08));

      for (let i = 0; i < bridgeTiles.length; i++) {
        const c = bridgeTiles[i][0];
        const r = bridgeTiles[i][1];
        const cx = c + 0.5;
        const cz = r + 0.5;

        const waterUpDown = getTile(c, r - 1) === TILE.WATER || getTile(c, r + 1) === TILE.WATER;
        const horizontalBridge = waterUpDown || (getTile(c - 1, r) !== TILE.WATER && getTile(c + 1, r) !== TILE.WATER);
        const bUp = getTile(c, r - 1) === TILE.BRIDGE;
        const bDown = getTile(c, r + 1) === TILE.BRIDGE;
        const bLeft = getTile(c - 1, r) === TILE.BRIDGE;
        const bRight = getTile(c + 1, r) === TILE.BRIDGE;

        const grp = new THREE.Group();
        grp.position.set(cx, 0, cz);

        // 4 textured deck planks
        for (let p = 0; p < 4; p++) {
          const offset = -0.375 + p * 0.25;
          const m = new THREE.Mesh(plankGeo, woodMat);
          m.castShadow = true;
          m.receiveShadow = true;
          if (horizontalBridge) {
            m.position.set(offset, 0.015, 0);
          } else {
            m.rotation.y = Math.PI / 2;
            m.position.set(0, 0.015, offset);
          }
          grp.add(m);
        }

        // Outer railings & support posts only on non-shared edges
        if (horizontalBridge) {
          if (!bUp) addBridgeRail(THREE, grp, beamGeo, postGeo, railMat, 0, -0.46, false);
          if (!bDown) addBridgeRail(THREE, grp, beamGeo, postGeo, railMat, 0, 0.46, false);
        } else {
          if (!bLeft) addBridgeRail(THREE, grp, beamGeo, postGeo, railMat, -0.46, 0, true);
          if (!bRight) addBridgeRail(THREE, grp, beamGeo, postGeo, railMat, 0.46, 0, true);
        }

        scene.add(grp);
      }
    }
  }

  function addBridgeRail(THREE, grp, beamGeo, postGeo, railMat, ox, oz, rotateY) {
    const rail = new THREE.Mesh(beamGeo, railMat);
    rail.position.set(ox, 0.34, oz);
    if (rotateY) rail.rotation.y = Math.PI / 2;
    rail.castShadow = true;
    grp.add(rail);

    for (let k = -1; k <= 1; k += 2) {
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(
        rotateY ? ox : ox + k * 0.42,
        0.06,
        rotateY ? oz + k * 0.42 : oz
      );
      post.castShadow = true;
      grp.add(post);
    }
  }

  function buildFruitTrees(THREE, treeTiles, textures) {
    if (!treeTiles || treeTiles.length === 0) return;

    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.22, 0.92, 8));
    const trunkMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      map: textures.bark || null,
      roughness: 0.92
    }));
    const trunkInst = makeInstanced(THREE, trunkGeo, trunkMat, treeTiles.length);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;

    // 2 layered foliage puffs per tree (lower lush crown + upper sunlit puff)
    const canopyGeo = trackGeo(new THREE.DodecahedronGeometry(0.58, 1));
    const canopyMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.leaf || null,
      roughness: 0.78
    }));
    const canopyInst = makeInstanced(THREE, canopyGeo, canopyMat, treeTiles.length * 3);
    canopyInst.castShadow = true;
    canopyInst.receiveShadow = true;

    // Colorful shiny fruits (3 per tree!)
    const fruitGeo = trackGeo(new THREE.SphereGeometry(0.095, 8, 6));
    const fruitMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.08
    }));
    const fruitInst = makeInstanced(THREE, fruitGeo, fruitMat, treeTiles.length * 3);
    fruitInst.castShadow = false;

    const fruitPalette = [0xef4444, 0xf97316, 0xfacc15, 0xec4899];
    const greenPalette = [0x4c9e47, 0x56ae4d, 0x3d8b40, 0x62b853];
    const dummy = new THREE.Object3D();
    const colObj = new THREE.Color();

    let canopyIdx = 0;
    let fruitIdx = 0;

    for (let i = 0; i < treeTiles.length; i++) {
      const c = treeTiles[i][0];
      const r = treeTiles[i][1];
      const h1 = hash2D(c, r, 60);
      const h2 = hash2D(c, r, 61);
      const scale = 0.88 + h1 * 0.28;
      const cx = c + 0.5 + (h2 - 0.5) * 0.1;
      const cz = r + 0.5 + (hash2D(c, r, 62) - 0.5) * 0.1;

      // Trunk
      dummy.position.set(cx, 0.42 * scale, cz);
      dummy.rotation.set(0, h1 * Math.PI * 2, (h2 - 0.5) * 0.08);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      // 3 overlapping lush foliage puffs
      const baseGreen = greenPalette[Math.floor(h1 * greenPalette.length) % greenPalette.length];
      const puffs = [
        { ox: -0.18, oy: 1.15, oz: 0.1, sx: 0.92, sy: 0.82, sz: 0.92, tint: baseGreen },
        { ox: 0.2, oy: 1.18, oz: -0.08, sx: 0.88, sy: 0.8, sz: 0.88, tint: baseGreen },
        { ox: 0.0, oy: 1.48, oz: 0.02, sx: 0.96, sy: 0.86, sz: 0.96, tint: 0x73c95b }
      ];
      for (let p = 0; p < puffs.length; p++) {
        const pf = puffs[p];
        dummy.position.set(cx + pf.ox * scale, pf.oy * scale, cz + pf.oz * scale);
        dummy.rotation.set(h2 * 1.2, h1 * 4 + p * 1.4, 0);
        dummy.scale.set(pf.sx * scale, pf.sy * scale, pf.sz * scale);
        dummy.updateMatrix();
        canopyInst.setMatrixAt(canopyIdx, dummy.matrix);
        colObj.setHex(pf.tint);
        canopyInst.setColorAt(canopyIdx, colObj);
        canopyIdx++;
      }

      // 3 bright fruits perched on outer canopy
      const fruitCol = fruitPalette[Math.floor(hash2D(c, r, 63) * fruitPalette.length) % fruitPalette.length];
      colObj.setHex(fruitCol);
      for (let f = 0; f < 3; f++) {
        const ang = h1 * Math.PI * 2 + f * 2.1 + 0.4;
        const fx = cx + Math.cos(ang) * 0.48 * scale;
        const fz = cz + Math.sin(ang) * 0.48 * scale;
        const fy = (1.12 + (f % 2) * 0.26) * scale;
        dummy.position.set(fx, fy, fz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fruitInst.setMatrixAt(fruitIdx, dummy.matrix);
        fruitInst.setColorAt(fruitIdx, colObj);
        fruitIdx++;
      }
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    fruitInst.instanceMatrix.needsUpdate = true;
    if (fruitInst.instanceColor) fruitInst.instanceColor.needsUpdate = true;

    scene.add(trunkInst);
    scene.add(canopyInst);
    scene.add(fruitInst);
    treeCanopyGroup.push(canopyInst);
  }

  function buildPalmTrees(THREE, palmTiles, textures) {
    if (!palmTiles || palmTiles.length === 0) return;

    // 3 curved trunk segments per palm
    const segGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.15, 0.62, 7));
    const trunkMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xa47d52,
      map: textures.bark || null,
      roughness: 0.92
    }));
    const trunkInst = makeInstanced(THREE, segGeo, trunkMat, palmTiles.length * 3);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;

    const crownGeo = createPalmCrownGeometry(THREE);
    const crownMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x4ca650,
      map: textures.leaf || null,
      roughness: 0.72,
      side: THREE.DoubleSide
    }));
    palmCanopyInst = makeInstanced(THREE, crownGeo, crownMat, palmTiles.length);
    palmCanopyInst.castShadow = true;
    palmCanopyInst.receiveShadow = true;

    const cocoGeo = trackGeo(new THREE.SphereGeometry(0.095, 7, 6));
    const cocoMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x6b3e1b,
      roughness: 0.75
    }));
    const cocoInst = makeInstanced(THREE, cocoGeo, cocoMat, palmTiles.length * 2);

    const dummy = new THREE.Object3D();
    palmCanopyEntries = [];
    let segIdx = 0;
    let cocoIdx = 0;

    for (let i = 0; i < palmTiles.length; i++) {
      const c = palmTiles[i][0];
      const r = palmTiles[i][1];
      const h = hash2D(c, r, 40);
      const leanAngle = h * Math.PI * 2;
      const leanMag = 0.22 + hash2D(c, r, 41) * 0.16;
      const scale = 0.92 + hash2D(c, r, 42) * 0.24;
      const lx = Math.cos(leanAngle) * leanMag;
      const lz = Math.sin(leanAngle) * leanMag;

      const baseX = c + 0.5;
      const baseZ = r + 0.5;

      // 3 stacked curving segments
      for (let s = 0; s < 3; s++) {
        const t = (s + 0.5) / 3;
        const sx = baseX + lx * t * t * 1.4;
        const sz = baseZ + lz * t * t * 1.4;
        const sy = (0.28 + s * 0.54) * scale;
        dummy.position.set(sx, sy, sz);
        dummy.rotation.set(lz * 0.45 * (s + 1), 0, -lx * 0.45 * (s + 1));
        const taper = 1 - s * 0.14;
        dummy.scale.set(scale * taper, scale, scale * taper);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(segIdx++, dummy.matrix);
      }

      const topX = baseX + lx * 1.38;
      const topY = 1.72 * scale;
      const topZ = baseZ + lz * 1.38;
      const rotY = h * Math.PI * 2;

      palmCanopyEntries.push({
        x: topX,
        y: topY,
        z: topZ,
        rotY: rotY,
        scale: scale,
        phase: c * 0.9 + r * 0.6
      });

      dummy.position.set(topX, topY, topZ);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      palmCanopyInst.setMatrixAt(i, dummy.matrix);

      // 2 Coconuts under crown
      for (let k = 0; k < 2; k++) {
        const ca = rotY + k * 2.2;
        dummy.position.set(topX + Math.cos(ca) * 0.13, topY - 0.14, topZ + Math.sin(ca) * 0.13);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1.15, 1);
        dummy.updateMatrix();
        cocoInst.setMatrixAt(cocoIdx++, dummy.matrix);
      }
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    palmCanopyInst.instanceMatrix.needsUpdate = true;
    cocoInst.instanceMatrix.needsUpdate = true;

    scene.add(trunkInst);
    scene.add(palmCanopyInst);
    scene.add(cocoInst);
  }

  function buildCaveRocksAndCrystals(THREE, rockTiles, textures) {
    if (!rockTiles || rockTiles.length === 0) return;

    const rockGeo = trackGeo(new THREE.DodecahedronGeometry(0.56, 0));
    const rockMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.stone || null,
      roughness: 0.88,
      metalness: 0.08
    }));
    const rockInst = makeInstanced(THREE, rockGeo, rockMat, rockTiles.length);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;

    const crystalSpots = [];
    const dummy = new THREE.Object3D();
    const colObj = new THREE.Color();

    for (let i = 0; i < rockTiles.length; i++) {
      const c = rockTiles[i][0];
      const r = rockTiles[i][1];
      const h = hash2D(c, r, 55);
      const h2 = hash2D(c, r, 56);
      const sx = 0.85 + h * 0.3;
      const sy = 0.95 + h2 * 0.85;
      const sz = 0.85 + hash2D(c, r, 57) * 0.3;

      dummy.position.set(c + 0.5, sy * 0.38, r + 0.5);
      dummy.rotation.set(h * 0.4, h2 * Math.PI * 2, (h - 0.5) * 0.3);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      rockInst.setMatrixAt(i, dummy.matrix);

      colObj.setHex(h > 0.5 ? 0x76648c : 0x625378);
      rockInst.setColorAt(i, colObj);

      // Sprout glowing bioluminescent crystal clusters on ~46% of cave rocks!
      if (hash2D(c, r, 58) > 0.54) {
        const pal = hash2D(c, r, 59);
        const colorHex = pal > 0.65 ? 0x22d3ee : pal > 0.3 ? 0xc084fc : 0xfbbf24;
        crystalSpots.push({ x: c + 0.5, y: sy * 0.62, z: r + 0.5, color: colorHex, seed: h });
      }
    }

    rockInst.instanceMatrix.needsUpdate = true;
    if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
    scene.add(rockInst);

    //Glowing 3D crystal clusters
    if (crystalSpots.length > 0) {
      const crysGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.52, 5));
      const crysMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.crystal || null,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.15
      }));
      crystalMaterials.push(crysMat);

      const crysInst = makeInstanced(THREE, crysGeo, crysMat, crystalSpots.length * 3);
      let idx = 0;
      for (let i = 0; i < crystalSpots.length; i++) {
        const sp = crystalSpots[i];
        colObj.setHex(sp.color);
        for (let k = 0; k < 3; k++) {
          const ang = sp.seed * 6.28 + k * 2.1;
          const sc = k === 0 ? 1.05 : 0.68 + k * 0.1;
          dummy.position.set(
            sp.x + Math.cos(ang) * 0.18,
            sp.y + 0.16 * sc,
            sp.z + Math.sin(ang) * 0.18
          );
          dummy.rotation.set(Math.sin(ang) * 0.38, ang, -Math.cos(ang) * 0.38);
          dummy.scale.set(sc, sc * 1.15, sc);
          dummy.updateMatrix();
          crysInst.setMatrixAt(idx, dummy.matrix);
          crysInst.setColorAt(idx, colObj);
          idx++;
        }
      }
      crysInst.instanceMatrix.needsUpdate = true;
      if (crysInst.instanceColor) crysInst.instanceColor.needsUpdate = true;
      scene.add(crysInst);
    }
  }

  function buildFences(THREE, fenceTiles, textures) {
    if (!fenceTiles || fenceTiles.length === 0) return;

    const woodMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xb67b44,
      map: textures.wood || null,
      roughness: 0.88
    }));
    const postGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.66, 0.18));
    const postInst = makeInstanced(THREE, postGeo, woodMat, fenceTiles.length);
    postInst.castShadow = true;
    postInst.receiveShadow = true;

    const railSpecs = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < fenceTiles.length; i++) {
      const c = fenceTiles[i][0];
      const r = fenceTiles[i][1];
      dummy.position.set(c + 0.5, 0.33, r + 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postInst.setMatrixAt(i, dummy.matrix);

      // Connect East & South (avoids duplicate overlapping rails!)
      if (getTile(c + 1, r) === TILE.FENCE) {
        railSpecs.push({ x: c + 1.0, z: r + 0.5, horiz: true });
      }
      if (getTile(c, r + 1) === TILE.FENCE) {
        railSpecs.push({ x: c + 0.5, z: r + 1.0, horiz: false });
      }
      // Standalone post still gets short decorative stub rails
      if (
        getTile(c - 1, r) !== TILE.FENCE &&
        getTile(c + 1, r) !== TILE.FENCE &&
        getTile(c, r - 1) !== TILE.FENCE &&
        getTile(c, r + 1) !== TILE.FENCE
      ) {
        railSpecs.push({ x: c + 0.5, z: r + 0.5, horiz: true, short: true });
      }
    }

    postInst.instanceMatrix.needsUpdate = true;
    scene.add(postInst);

    if (railSpecs.length > 0) {
      const railGeo = trackGeo(new THREE.BoxGeometry(1.0, 0.1, 0.08));
      const railInst = makeInstanced(THREE, railGeo, woodMat, railSpecs.length * 2);
      railInst.castShadow = true;
      let idx = 0;
      for (let i = 0; i < railSpecs.length; i++) {
        const rs = railSpecs[i];
        for (let tier = 0; tier < 2; tier++) {
          dummy.position.set(rs.x, tier === 0 ? 0.24 : 0.48, rs.z);
          dummy.rotation.set(0, rs.horiz ? 0 : Math.PI / 2, 0);
          dummy.scale.set(rs.short ? 0.65 : 1.0, 1, 1);
          dummy.updateMatrix();
          railInst.setMatrixAt(idx++, dummy.matrix);
        }
      }
      railInst.instanceMatrix.needsUpdate = true;
      scene.add(railInst);
    }
  }

  function buildFlowers(THREE, flowerTiles) {
    if (!flowerTiles || flowerTiles.length === 0) return;

    const spotsPerTile = 4;
    const total = flowerTiles.length * spotsPerTile;
    const stemGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 0.22, 5));
    const stemMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b8c3e, roughness: 0.85 }));
    const stemInst = makeInstanced(THREE, stemGeo, stemMat, total);

    const headGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.05, 0.055, 6));
    const headMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
    flowerInst = makeInstanced(THREE, headGeo, headMat, total);

    const gardenColors = [0xff6b9d, 0xfde047, 0xffffff, 0xc084fc, 0xfb7185];
    const tropColors = [0xff5e7e, 0xfacc15, 0xfb923c, 0xf472b6, 0x38bdf8];
    const offsets = [
      [-0.25, -0.22],
      [0.24, -0.2],
      [-0.2, 0.24],
      [0.23, 0.22]
    ];

    const dummy = new THREE.Object3D();
    const colObj = new THREE.Color();
    flowerEntries = [];
    let idx = 0;

    for (let i = 0; i < flowerTiles.length; i++) {
      const c = flowerTiles[i][0];
      const r = flowerTiles[i][1];
      const pal = c >= 36 ? tropColors : gardenColors;

      for (let k = 0; k < spotsPerTile; k++) {
        const h = hash2D(c, r, 40 + k);
        const fx = c + 0.5 + offsets[k][0] + (h - 0.5) * 0.12;
        const fz = r + 0.5 + offsets[k][1] + (hash2D(c, r, 50 + k) - 0.5) * 0.12;
        const fy = 0.2 + h * 0.06;

        dummy.position.set(fx, fy * 0.5, fz);
        dummy.rotation.set(0, h * 6.28, 0);
        dummy.scale.set(1, fy / 0.22, 1);
        dummy.updateMatrix();
        stemInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(fx, fy, fz);
        dummy.rotation.set(0.25, h * 6.28, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        flowerInst.setMatrixAt(idx, dummy.matrix);

        colObj.setHex(pal[Math.floor(h * pal.length) % pal.length]);
        flowerInst.setColorAt(idx, colObj);

        flowerEntries.push({ x: fx, y: fy, z: fz, col: c, row: r, phase: c * 0.8 + r * 0.5 + k });
        idx++;
      }
    }

    stemInst.instanceMatrix.needsUpdate = true;
    flowerInst.instanceMatrix.needsUpdate = true;
    if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
    scene.add(stemInst);
    scene.add(flowerInst);
  }

  function buildTallGrass(THREE, tallGrassTiles, textures) {
    if (!tallGrassTiles || tallGrassTiles.length === 0) return;

    const tuftsPerTile = 3;
    const tuftGeo = createGrassTuftGeometry(THREE);
    const mat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.tallGrass || null,
      roughness: 0.78,
      side: THREE.DoubleSide
    }));

    tallGrassInst = makeInstanced(THREE, tuftGeo, mat, tallGrassTiles.length * tuftsPerTile);
    tallGrassInst.castShadow = true;
    tallGrassInst.receiveShadow = true;

    const offsets = [
      [-0.22, -0.18],
      [0.21, -0.14],
      [0.0, 0.2]
    ];
    const greens = [0x3ea83b, 0x4db844, 0x339436, 0x5cc44d];
    const dummy = new THREE.Object3D();
    const colObj = new THREE.Color();
    tallGrassEntries = [];
    let idx = 0;

    for (let i = 0; i < tallGrassTiles.length; i++) {
      const c = tallGrassTiles[i][0];
      const r = tallGrassTiles[i][1];
      for (let k = 0; k < tuftsPerTile; k++) {
        const h = hash2D(c, r, 70 + k);
        const x = c + 0.5 + offsets[k][0] + (h - 0.5) * 0.1;
        const z = r + 0.5 + offsets[k][1] + (hash2D(c, r, 80 + k) - 0.5) * 0.1;
        const rotY = h * Math.PI * 2;
        const scale = 0.92 + h * 0.28;

        dummy.position.set(x, 0.0, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        tallGrassInst.setMatrixAt(idx, dummy.matrix);

        colObj.setHex(greens[Math.floor(h * greens.length) % greens.length]);
        tallGrassInst.setColorAt(idx, colObj);

        tallGrassEntries.push({ idx: idx, col: c, row: r, x: x, z: z, rotY: rotY, scale: scale, phase: c * 0.65 + r * 0.4 + k });
        idx++;
      }
    }

    tallGrassInst.instanceMatrix.needsUpdate = true;
    if (tallGrassInst.instanceColor) tallGrassInst.instanceColor.needsUpdate = true;
    scene.add(tallGrassInst);
  }

  function buildCaveGrass(THREE, caveGrassTiles, textures) {
    if (!caveGrassTiles || caveGrassTiles.length === 0) return;

    const tuftsPerTile = 3;
    const tuftGeo = createGrassTuftGeometry(THREE);
    const mat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.tallGrass || null,
      emissive: 0x3b1270,
      emissiveIntensity: 0.45,
      roughness: 0.65,
      side: THREE.DoubleSide
    }));

    caveGrassInst = makeInstanced(THREE, tuftGeo, mat, caveGrassTiles.length * tuftsPerTile);
    caveGrassInst.receiveShadow = true;

    const offsets = [
      [-0.22, -0.18],
      [0.21, -0.14],
      [0.0, 0.2]
    ];
    const purples = [0x8b5cf6, 0x9333ea, 0x7c3aed, 0xa855f7];
    const dummy = new THREE.Object3D();
    const colObj = new THREE.Color();
    const mushSpots = [];
    caveGrassEntries = [];
    let idx = 0;

    for (let i = 0; i < caveGrassTiles.length; i++) {
      const c = caveGrassTiles[i][0];
      const r = caveGrassTiles[i][1];
      for (let k = 0; k < tuftsPerTile; k++) {
        const h = hash2D(c, r, 90 + k);
        const x = c + 0.5 + offsets[k][0] + (h - 0.5) * 0.1;
        const z = r + 0.5 + offsets[k][1] + (hash2D(c, r, 95 + k) - 0.5) * 0.1;
        const rotY = h * Math.PI * 2;
        const scale = 0.88 + h * 0.26;

        dummy.position.set(x, -0.02, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        caveGrassInst.setMatrixAt(idx, dummy.matrix);

        colObj.setHex(purples[Math.floor(h * purples.length) % purples.length]);
        caveGrassInst.setColorAt(idx, colObj);

        caveGrassEntries.push({ idx: idx, col: c, row: r, x: x, z: z, rotY: rotY, scale: scale, phase: c * 0.7 + r * 0.5 + k });
        idx++;
      }

      if (hash2D(c, r, 57) > 0.48) {
        mushSpots.push({
          x: c + 0.3 + hash2D(c, r, 58) * 0.4,
          z: r + 0.3 + hash2D(c, r, 59) * 0.4
        });
      }
    }

    caveGrassInst.instanceMatrix.needsUpdate = true;
    if (caveGrassInst.instanceColor) caveGrassInst.instanceColor.needsUpdate = true;
    scene.add(caveGrassInst);

    // Bioluminescent cyan mushrooms inside cave encounter beds!
    if (mushSpots.length > 0) {
      const stemGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6));
      const stemMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 }));
      const capGeo = trackGeo(new THREE.SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55));
      const capMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
        roughness: 0.35
      }));
      crystalMaterials.push(capMat);

      const stemInst = makeInstanced(THREE, stemGeo, stemMat, mushSpots.length);
      const capInst = makeInstanced(THREE, capGeo, capMat, mushSpots.length);

      for (let i = 0; i < mushSpots.length; i++) {
        const m = mushSpots[i];
        dummy.position.set(m.x, 0.06, m.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        stemInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(m.x, 0.14, m.z);
        dummy.updateMatrix();
        capInst.setMatrixAt(i, dummy.matrix);
      }
      stemInst.instanceMatrix.needsUpdate = true;
      capInst.instanceMatrix.needsUpdate = true;
      scene.add(stemInst);
      scene.add(capInst);
    }
  }

  function buildHealCounters(THREE, counterTiles, textures) {
    if (!counterTiles || counterTiles.length === 0) return;

    const baseGeo = trackGeo(new THREE.BoxGeometry(0.88, 0.62, 0.72));
    const baseMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xb97b45,
      map: textures.wood || null,
      roughness: 0.85
    }));
    const topGeo = trackGeo(new THREE.BoxGeometry(0.96, 0.12, 0.8));
    const topMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xfff9ec,
      roughness: 0.45
    }));
    const badgeGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16));
    badgeGeo.rotateX(Math.PI / 2);
    const badgeMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 0.35,
      roughness: 0.4
    }));

    for (let i = 0; i < counterTiles.length; i++) {
      const c = counterTiles[i][0];
      const r = counterTiles[i][1];
      const grp = new THREE.Group();
      grp.position.set(c + 0.5, 0.03, r + 0.5);

      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.31;
      base.castShadow = true;
      base.receiveShadow = true;
      grp.add(base);

      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = 0.66;
      top.castShadow = true;
      top.receiveShadow = true;
      grp.add(top);

      const badge = new THREE.Mesh(badgeGeo, badgeMat);
      badge.position.set(0, 0.36, 0.37);
      grp.add(badge);

      scene.add(grp);
    }
  }

  function build3DBuilding(THREE, b, textures) {
    const label = b.label || '';
    const isGreenhouse = /estufa/i.test(label);
    const isGoldenArena = /estufa dourada/i.test(label);
    const isDeepArena = /raiz profunda/i.test(label);
    const isHealer = /cura/i.test(label);
    const isShop = /loja|sement/i.test(label);

    const roofHex = parseHexColor(b.roofColor, 0xa8553b);
    const wallHex = parseHexColor(b.wallColor, 0xf2e8cf);

    // Leave front 0.46 of the bottom row open so player standing on walkable door tile (b.doorX, b.doorY) never clips into the wall!
    const bw = b.w - 0.18;
    const bd = Math.max(1.6, b.h - 0.56);
    const wallH = (isGoldenArena || isDeepArena) ? 1.62 : 1.32;
    const roofH = (isGoldenArena || isDeepArena) ? 1.15 : 0.92;

    const cx = b.x + b.w * 0.5;
    const cz = b.y + 0.1 + bd * 0.5;
    const frontZ = cz + bd * 0.5;

    const grp = new THREE.Group();

    // Stone foundation plinth
    const baseGeo = trackGeo(new THREE.BoxGeometry(bw + 0.14, 0.26, bd + 0.14));
    const baseMat = trackMat(new THREE.MeshStandardMaterial({
      color: isDeepArena ? 0x57534e : 0x8d8272,
      map: textures.stone || null,
      roughness: 0.92
    }));
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(cx, 0.13, cz);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    grp.add(baseMesh);

    // Main wall body
    const wallGeo = trackGeo(new THREE.BoxGeometry(bw, wallH, bd));
    const wallMat = trackMat(new THREE.MeshStandardMaterial({
      color: wallHex,
      map: textures.wall || null,
      roughness: 0.85
    }));
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(cx, 0.24 + wallH * 0.5, cz);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    grp.add(wallMesh);

    // Timber / carved stone corner pillars
    const pillarGeo = trackGeo(new THREE.BoxGeometry(0.18, wallH + 0.06, 0.18));
    const pillarMat = trackMat(new THREE.MeshStandardMaterial({
      color: isDeepArena ? 0x44403c : isGoldenArena ? 0xc29b40 : 0x7c512c,
      map: isDeepArena ? textures.stone || null : textures.wood || null,
      roughness: isGoldenArena ? 0.45 : 0.88,
      metalness: isGoldenArena ? 0.35 : 0.02
    }));
    const cornerOffsets = [
      [-bw * 0.5, -bd * 0.5],
      [bw * 0.5, -bd * 0.5],
      [-bw * 0.5, bd * 0.5],
      [bw * 0.5, bd * 0.5]
    ];
    for (let i = 0; i < cornerOffsets.length; i++) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(cx + cornerOffsets[i][0], 0.24 + wallH * 0.5, cz + cornerOffsets[i][1]);
      p.castShadow = true;
      grp.add(p);
    }

    // Welcoming Door aligned to b.doorX
    const doorX = typeof b.doorX === 'number'
      ? clamp(b.doorX + 0.5, cx - bw * 0.35, cx + bw * 0.35)
      : cx;
    const doorGeo = trackGeo(new THREE.BoxGeometry(0.76, 1.04, 0.1));
    const doorMat = trackMat(new THREE.MeshStandardMaterial({
      color: isDeepArena ? 0x3b2a22 : 0x7a4924,
      map: textures.wood || null,
      roughness: 0.82
    }));
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(doorX, 0.72, frontZ + 0.02);
    grp.add(doorMesh);

    // Door brass handle + warm porch awning
    const awningGeo = trackGeo(new THREE.BoxGeometry(1.16, 0.1, 0.46));
    const awningMat = trackMat(new THREE.MeshStandardMaterial({
      color: isShop ? 0xd97706 : roofHex,
      roughness: 0.75
    }));
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(doorX, 1.32, frontZ + 0.22);
    awning.rotation.x = 0.22;
    awning.castShadow = true;
    grp.add(awning);

    // Warm illuminated windows flanking the door
    const winGeo = trackGeo(new THREE.BoxGeometry(0.62, 0.56, 0.08));
    const winGlassMat = trackMat(new THREE.MeshStandardMaterial({
      color: isDeepArena ? 0xfef08a : 0xbae6fd,
      emissive: isDeepArena ? 0xd97706 : 0xffe8a3,
      emissiveIntensity: isDeepArena ? 0.65 : 0.38,
      roughness: 0.18,
      metalness: 0.12
    }));
    const frameGeo = trackGeo(new THREE.BoxGeometry(0.72, 0.66, 0.05));
    const flowerBoxGeo = trackGeo(new THREE.BoxGeometry(0.72, 0.15, 0.18));

    const winCandidates = [];
    if (doorX - (cx - bw * 0.5) > 1.05) {
      winCandidates.push((cx - bw * 0.5 + doorX - 0.4) * 0.5);
    }
    if ((cx + bw * 0.5) - doorX > 1.05) {
      winCandidates.push((doorX + 0.4 + cx + bw * 0.5) * 0.5);
    }
    for (let i = 0; i < winCandidates.length; i++) {
      const wx = winCandidates[i];
      const wy = 0.88;
      const frame = new THREE.Mesh(frameGeo, pillarMat);
      frame.position.set(wx, wy, frontZ + 0.01);
      grp.add(frame);

      const glass = new THREE.Mesh(winGeo, winGlassMat);
      glass.position.set(wx, wy, frontZ + 0.03);
      grp.add(glass);

      const fbox = new THREE.Mesh(flowerBoxGeo, pillarMat);
      fbox.position.set(wx, wy - 0.34, frontZ + 0.08);
      grp.add(fbox);
    }

    // Pitched 3D Roof (ExtrudeGeometry triangular gable prism with overhanging eaves!)
    const overX = 0.28;
    const overZ = 0.3;
    const halfD = bd * 0.5 + overZ;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-halfD, 0);
    roofShape.lineTo(halfD, 0);
    roofShape.lineTo(0, roofH);
    roofShape.closePath();

    const roofGeo = trackGeo(new THREE.ExtrudeGeometry(roofShape, {
      depth: bw + overX * 2,
      bevelEnabled: false
    }));
    // ExtrudeGeometry extrudes along +Z; rotate so ridge runs along X axis!
    roofGeo.rotateY(Math.PI / 2);
    roofGeo.translate(-(bw + overX * 2) * 0.5, 0, 0);

    const roofMat = trackMat(new THREE.MeshStandardMaterial({
      color: roofHex,
      map: textures.roof || null,
      roughness: 0.78,
      metalness: isGoldenArena ? 0.2 : 0.03
    }));
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(cx, 0.24 + wallH - 0.04, cz);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    grp.add(roofMesh);

    // Greenhouse Translucent Glass Skylights (Estufa de Cura & Arena da Estufa Dourada)
    if (isGreenhouse) {
      const skyGlassMat = trackMat(new THREE.MeshStandardMaterial({
        color: isGoldenArena ? 0xfef3c7 : 0xbae6fd,
        emissive: isGoldenArena ? 0xf59e0b : 0x38bdf8,
        emissiveIntensity: 0.24,
        roughness: 0.12,
        metalness: 0.28,
        transparent: true,
        opacity: 0.76
      }));
      const slopeLen = Math.hypot(halfD, roofH) * 0.74;
      const slopeAngle = Math.atan2(roofH, halfD);
      const paneCount = isGoldenArena ? 3 : 2;
      const paneW = (bw - 0.5) / paneCount - 0.14;
      const paneGeo = trackGeo(new THREE.BoxGeometry(paneW, 0.08, slopeLen));

      for (let i = 0; i < paneCount; i++) {
        const px = cx - (bw - 0.5) * 0.5 + (i + 0.5) * ((bw - 0.5) / paneCount);
        const pane = new THREE.Mesh(paneGeo, skyGlassMat);
        pane.position.set(px, 0.24 + wallH + roofH * 0.48, cz + halfD * 0.48);
        pane.rotation.x = slopeAngle;
        grp.add(pane);
      }

      if (isGoldenArena) {
        // Golden glass dome lantern crest on top of the Golden Greenhouse Arena!
        const domeGeo = trackGeo(new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55));
        const dome = new THREE.Mesh(domeGeo, skyGlassMat);
        dome.position.set(cx, 0.24 + wallH + roofH - 0.12, cz);
        grp.add(dome);
      }
    }

    // Deep Root Arena glowing crystal sconces flanking entrance
    if (isDeepArena) {
      const sconceGeo = trackGeo(new THREE.OctahedronGeometry(0.18, 0));
      const sconceMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.0,
        roughness: 0.2
      }));
      crystalMaterials.push(sconceMat);
      for (let s = -1; s <= 1; s += 2) {
        const sc = new THREE.Mesh(sconceGeo, sconceMat);
        sc.position.set(doorX + s * 0.78, 1.08, frontZ + 0.16);
        grp.add(sc);
      }
    }

    // Thematic glowing badge crest on Estufa de Cura / Loja
    if (isHealer || isShop) {
      const crestGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16));
      crestGeo.rotateX(Math.PI / 2);
      const crestMat = trackMat(new THREE.MeshStandardMaterial({
        color: isHealer ? 0x4ade80 : 0xfacc15,
        emissive: isHealer ? 0x16a34a : 0xca8a04,
        emissiveIntensity: 0.35,
        roughness: 0.35
      }));
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.set(cx, 0.24 + wallH + roofH * 0.62, cz + halfD * 0.42);
      grp.add(crest);
    }

    // Crisp Readable 3D Signboard Plaque above the front eave!
    if (label) {
      const signTex = createSignboardTexture(THREE, label, b.roofColor);
      if (signTex) {
        const signW = Math.min(b.w * 0.94, Math.max(2.35, label.length * 0.145));
        const signH = signW * (112 / 512);
        const signGeo = trackGeo(new THREE.PlaneGeometry(signW, signH));
        const signMat = trackMat(new THREE.MeshBasicMaterial({
          map: signTex,
          transparent: true,
          side: THREE.DoubleSide
        }));
        const signMesh = new THREE.Mesh(signGeo, signMat);
        signMesh.position.set(cx, 0.24 + wallH + 0.16, frontZ + overZ + 0.08);
        signMesh.rotation.x = -0.32;
        grp.add(signMesh);
      }
    }

    scene.add(grp);
  }

  function buildCaveLights(THREE) {
    cavePointLights = [];
    // Strategic glowing pools inside Horta Subterrânea (col 36..58, row 1..11)
    const spots = [
      { x: 43.5, y: 1.9, z: 5.5, color: 0xfbbf24, intensity: 2.0, dist: 11 }, // Arena da Raiz Profunda
      { x: 39.0, y: 1.6, z: 8.5, color: 0x22d3ee, intensity: 1.7, dist: 10 }, // Canteiro Oeste
      { x: 48.0, y: 1.7, z: 9.5, color: 0x38bdf8, intensity: 1.7, dist: 10 }, // Entrada da Ponte
      { x: 52.5, y: 1.6, z: 5.0, color: 0xc084fc, intensity: 1.8, dist: 10 }, // Canteiro Leste
      { x: 54.5, y: 1.6, z: 9.2, color: 0x22d3ee, intensity: 1.6, dist: 9 }   // Sudeste da Caverna
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const pl = new THREE.PointLight(s.color, s.intensity, s.dist, 1.5);
      pl.position.set(s.x, s.y, s.z);
      scene.add(pl);
      cavePointLights.push({ light: pl, baseIntensity: s.intensity, phase: i * 1.4 });
    }
  }

  function buildCharacterStandees(THREE, w) {
    if (!HM.HD2D || typeof HM.HD2D.createStandee !== 'function') return;

    const getCharTex = HM.HD2D.getCharacterTexture;
    const pTex = typeof getCharTex === 'function' ? getCharTex('player', 'down', 0) : null;
    playerStandee = HM.HD2D.createStandee(pTex, 1.18, 1.18);
    if (playerStandee && playerStandee.group) {
      if (playerStandee.mesh) {
        playerStandee.mesh.rotation.x = -0.3;
        playerStandee.mesh.position.z = -0.05;
      }
      scene.add(playerStandee.group);
    }
    playerLastTexKey = 'player|down|0';

    npcStandees = Object.create(null);
    activeNpcMeshes = [];

    if (Array.isArray(w.npcs)) {
      for (let i = 0; i < w.npcs.length; i++) {
        const npc = w.npcs[i];
        const style = npc.style || npc.role || 'prof';
        const dir = npc.dir || 'down';
        const nTex = typeof getCharTex === 'function' ? getCharTex(style, dir, 0) : null;
        const size = npc.role === 'sign' ? 0.96 : 1.16;
        const st = HM.HD2D.createStandee(nTex, size, size);
        if (!st || !st.group) continue;
        if (st.mesh) {
          st.mesh.rotation.x = -0.3;
          st.mesh.position.z = -0.05;
          st.mesh.userData = { npc: npc };
        }
        st.group.position.set(npc.x + 0.5, getGroundSurfaceY(npc.x, npc.y), npc.y + 0.5);
        scene.add(st.group);
        npcStandees[npc.id] = {
          standee: st,
          npc: npc,
          lastTexKey: style + '|' + dir + '|0'
        };
      }
    }
  }

  function getGroundSurfaceY(col, row) {
    const t = getTile(Math.round(col), Math.round(row));
    if (t === TILE.GREENHOUSE_FLOOR || t === TILE.DOOR) return 0.036;
    if (t === TILE.BRIDGE) return 0.06;
    if (t === TILE.DIRT || t === TILE.CAVE_FLOOR || t === TILE.CAVE_GRASS) return -0.015;
    if (t === TILE.SAND) return -0.008;
    return 0.005;
  }

  function buildAmbientAtmosphere(THREE, w, flowerTiles) {
    // 1. Floating 3D Pollen / Bioluminescent Spores around camera
    const count = 85;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = 0.4 + Math.random() * 4.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = trackGeo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const moteTex = createSoftMoteTexture(THREE);
    ambientMaterial = trackMat(new THREE.PointsMaterial({
      color: 0xfff7b8,
      map: moteTex || null,
      size: 0.24,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));

    ambientPoints = new THREE.Points(geo, ambientMaterial);
    ambientPoints.frustumCulled = false;
    scene.add(ambientPoints);
    ambientPositions = positions;
    ambientPhases = phases;

    // 2. Cute 3D Flapping Butterflies fluttering over garden/tropical flowers
    butterflies3D = [];
    const wingGeo = trackGeo(new THREE.PlaneGeometry(0.14, 0.11));
    wingGeo.translate(0.07, 0, 0);
    const colors = [0xfde047, 0xf472b6, 0x60a5fa, 0xfb923c, 0xffffff];
    const bfCount = Math.min(8, Math.max(4, Math.floor((flowerTiles.length || 4) / 6)));

    for (let i = 0; i < bfCount; i++) {
      const tile = flowerTiles.length > 0
        ? flowerTiles[(i * 7 + 2) % flowerTiles.length]
        : [10 + i * 4, 18];
      const wingMat = trackMat(new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide
      }));
      const grp = new THREE.Group();
      const leftW = new THREE.Mesh(wingGeo, wingMat);
      leftW.rotation.y = Math.PI;
      const rightW = new THREE.Mesh(wingGeo, wingMat);
      grp.add(leftW);
      grp.add(rightW);
      scene.add(grp);

      butterflies3D.push({
        group: grp,
        leftWing: leftW,
        rightWing: rightW,
        anchorX: tile[0] + 0.5,
        anchorZ: tile[1] + 0.5,
        phase: i * 1.9,
        speed: 0.8 + (i % 3) * 0.25,
        rx: 0.9 + (i % 3) * 0.45,
        rz: 0.7 + (i % 2) * 0.4
      });
    }

    // Shared leaf/sparkle quad geometry for interactive 3D burst particles
    burstGeo = trackGeo(new THREE.PlaneGeometry(0.16, 0.1));
  }

  // ==================== INTERACTIVE 3D PARTICLES ====================

  function spawnBurst3D(kind, col, row, palette) {
    if (!active || !scene || !global.THREE || !burstGeo) return;
    const THREE = global.THREE;
    const count = kind === 'sparkle' ? 12 : kind === 'dust' ? 4 : 7;
    const defaultColors = kind === 'sparkle'
      ? ['#fde047', '#86efac', '#ffffff', '#38bdf8']
      : kind === 'dust'
        ? ['#f3dfb9', '#e5cca0']
        : ['#4ade80', '#22c55e', '#86efac', '#16a34a'];
    const colors = palette && palette.length > 0 ? palette : defaultColors;

    for (let i = 0; i < count; i++) {
      const colHex = parseHexColor(colors[i % colors.length], 0x4ade80);
      const mat = new THREE.MeshBasicMaterial({
        color: colHex,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(burstGeo, mat);
      const ang = Math.random() * Math.PI * 2;
      const spd = kind === 'sparkle' ? 1.4 + Math.random() * 1.0 : 0.7 + Math.random() * 1.1;
      mesh.position.set(
        col + 0.5 + (Math.random() - 0.5) * 0.35,
        kind === 'dust' ? 0.08 : 0.32 + Math.random() * 0.25,
        row + 0.5 + (Math.random() - 0.5) * 0.35
      );
      if (kind === 'dust') mesh.scale.set(0.75, 0.75, 0.75);
      else if (kind === 'sparkle') mesh.scale.set(0.9, 1.3, 0.9);
      scene.add(mesh);

      burstParticles.push({
        mesh: mesh,
        mat: mat,
        vx: Math.cos(ang) * spd,
        vy: (kind === 'dust' ? 0.55 : 1.55) + Math.random() * 0.95,
        vz: Math.sin(ang) * spd,
        gravity: kind === 'dust' ? 0.6 : 4.2,
        vrotX: (Math.random() - 0.5) * 9,
        vrotY: (Math.random() - 0.5) * 9,
        life: 0,
        maxLife: kind === 'sparkle' ? 0.6 : 0.52 + Math.random() * 0.24
      });
    }
  }

  // ==================== PER-FRAME UPDATE & RENDER ====================

  function updateBiomeAtmosphere(dt, currentZone) {
    if (!scene || !sunLight || !hemiLight) return;
    const biomeKey = zoneToBiomeKey(currentZone);
    const target = getBiomePreset(biomeKey);
    const alpha = !biomeSnapped ? 1 : 1 - Math.exp(-dt * 2.8);
    biomeSnapped = true;

    scratchColor.set(target.fogColor);
    currentBiome.fogColor.lerp(scratchColor, alpha);
    scene.fog.color.copy(currentBiome.fogColor);
    scene.background.copy(currentBiome.fogColor);

    currentBiome.fogNear += (target.fogNear - currentBiome.fogNear) * alpha;
    currentBiome.fogFar += (target.fogFar - currentBiome.fogFar) * alpha;
    scene.fog.near = currentBiome.fogNear;
    scene.fog.far = currentBiome.fogFar;

    scratchColor.set(target.sunColor);
    currentBiome.sunColor.lerp(scratchColor, alpha);
    sunLight.color.copy(currentBiome.sunColor);
    currentBiome.sunIntensity += (target.sunIntensity - currentBiome.sunIntensity) * alpha;
    sunLight.intensity = currentBiome.sunIntensity;

    scratchColor.set(target.hemiSky);
    currentBiome.hemiSky.lerp(scratchColor, alpha);
    hemiLight.color.copy(currentBiome.hemiSky);

    scratchColor.set(target.hemiGround);
    currentBiome.hemiGround.lerp(scratchColor, alpha);
    hemiLight.groundColor.copy(currentBiome.hemiGround);

    currentBiome.hemiIntensity += (target.hemiIntensity - currentBiome.hemiIntensity) * alpha;
    hemiLight.intensity = currentBiome.hemiIntensity;

    if (target.sunPos && target.sunPos.length >= 3) {
      currentBiome.sunOffset.x += (target.sunPos[0] - currentBiome.sunOffset.x) * alpha;
      currentBiome.sunOffset.y += (target.sunPos[1] - currentBiome.sunOffset.y) * alpha;
      currentBiome.sunOffset.z += (target.sunPos[2] - currentBiome.sunOffset.z) * alpha;
    }

    if (skyDome && skyDome.userData && typeof skyDome.userData.setColors === 'function') {
      scratchColor.set(target.skyTop);
      currentBiome.skyTop.lerp(scratchColor, alpha);
      scratchColor.set(target.skyMid);
      currentBiome.skyMid.lerp(scratchColor, alpha);
      scratchColor.set(target.skyBottom);
      currentBiome.skyBottom.lerp(scratchColor, alpha);
      skyDome.userData.setColors(currentBiome.skyTop, currentBiome.skyMid, currentBiome.skyBottom);
    }

    if (ambientMaterial) {
      const moteTarget = biomeKey === 'caverna' ? 0x67e8f9 : biomeKey === 'tropical' ? 0xffe69c : 0xfff7b8;
      scratchColor.setHex(moteTarget);
      ambientMaterial.color.lerp(scratchColor, alpha);
      ambientMaterial.size = biomeKey === 'caverna' ? 0.3 : 0.22;
    }
  }

  function updateCameraAndLights(dt, player, snap) {
    if (!camera || !world) return;
    const desiredLook = DIR_LOOK_AHEAD[player.dir] || DIR_LOOK_AHEAD.down;
    const lookAlpha = snap ? 1 : 1 - Math.exp(-dt * 4.2);
    lookAheadX += (desiredLook.x - lookAheadX) * lookAlpha;
    lookAheadZ += (desiredLook.z - lookAheadZ) * lookAlpha;

    const minX = Math.min(world.cols * 0.5, 4.4);
    const maxX = Math.max(world.cols * 0.5, world.cols - 4.4);
    const minZ = Math.min(world.rows * 0.5, 3.3);
    const maxZ = Math.max(world.rows * 0.5, world.rows - 2.6);

    const targetX = clamp(player.renderX + 0.5 + lookAheadX, minX, maxX);
    const targetZ = clamp(player.renderY + 0.5 + lookAheadZ, minZ, maxZ);

    const camAlpha = (snap || !camSnapped) ? 1 : 1 - Math.exp(-dt * 9.5);
    camFocus.x += (targetX - camFocus.x) * camAlpha;
    camFocus.z += (targetZ - camFocus.z) * camAlpha;
    camSnapped = true;

    // 44-degree Octopath / Link's Awakening diorama camera framing
    camera.position.set(camFocus.x, 9.5, camFocus.z + 9.8);
    camera.lookAt(camFocus.x, 0.25, camFocus.z - 0.15);

    if (skyDome) {
      skyDome.position.set(camFocus.x, 0, camFocus.z);
    }

    // Keep shadow frustum tightly centered on the player so shadows are crisp everywhere across 60 cols!
    if (sunLight) {
      sunLight.target.position.set(camFocus.x, 0, camFocus.z);
      sunLight.target.updateMatrixWorld();
      sunLight.position.set(
        camFocus.x + currentBiome.sunOffset.x,
        currentBiome.sunOffset.y,
        camFocus.z + currentBiome.sunOffset.z
      );
    }
  }

  function updateCharacters(frameData) {
    const player = frameData.player;
    const getCharTex = HM.HD2D && HM.HD2D.getCharacterTexture;

    // Player HD-2D standee
    if (playerStandee && playerStandee.group) {
      const groundY = getGroundSurfaceY(player.renderX, player.renderY);
      const stepBounce = player.moving
        ? Math.abs(Math.sin((player.stepElapsed / 165) * Math.PI)) * 0.14
        : 0;
      playerStandee.group.position.set(player.renderX + 0.5, groundY + stepBounce, player.renderY + 0.5);
      if (playerStandee.shadowMesh) {
        playerStandee.shadowMesh.position.y = 0.025 - stepBounce;
        const sScale = Math.max(0.75, 1 - stepBounce * 1.4);
        playerStandee.shadowMesh.scale.set(sScale, sScale, 1);
      }

      const wf = player.moving ? player.walkFrame : 0;
      const texKey = 'player|' + player.dir + '|' + wf;
      if (texKey !== playerLastTexKey && typeof getCharTex === 'function') {
        playerStandee.setTexture(getCharTex('player', player.dir, wf));
        playerLastTexKey = texKey;
      }
    }

    // NPC HD-2D standees (respecting hideIfBadge dynamically!)
    activeNpcMeshes.length = 0;
    const overrides = frameData.npcFacingOverrides || {};
    const isHiddenFn = frameData.isNpcHidden;

    for (const id in npcStandees) {
      const entry = npcStandees[id];
      const npc = entry.npc;
      const hidden = typeof isHiddenFn === 'function' ? Boolean(isHiddenFn(npc)) : false;
      entry.standee.group.visible = !hidden;
      if (hidden) continue;

      if (entry.standee.mesh) {
        activeNpcMeshes.push(entry.standee.mesh);
      }

      const style = npc.style || npc.role || 'prof';
      const dir = overrides[npc.id] || npc.dir || 'down';
      const texKey = style + '|' + dir + '|0';
      if (texKey !== entry.lastTexKey && typeof getCharTex === 'function') {
        entry.standee.setTexture(getCharTex(style, dir, 0));
        entry.lastTexKey = texKey;
      }
    }
  }

  function updateAnimatedEnvironment(dt, elapsedMs, player) {
    const tSec = elapsedMs * 0.001;

    // 1. Water UV scrolling
    if (waterTextureClone) {
      waterTextureClone.offset.x = (tSec * 0.14) % 1;
      waterTextureClone.offset.y = Math.sin(tSec * 0.65) * 0.08;
    }

    // 2. Lily pad gentle bob
    if (lilyPadInst && lilyPadEntries.length > 0) {
      for (let i = 0; i < lilyPadEntries.length; i++) {
        const e = lilyPadEntries[i];
        if (Math.abs(e.x - camFocus.x) > 16 || Math.abs(e.z - camFocus.z) > 12) continue;
        scratchPos.set(e.x, -0.13 + Math.sin(tSec * 2.2 + e.phase) * 0.015, e.z);
        scratchEuler.set(0, e.rot + Math.sin(tSec * 0.9 + e.phase) * 0.08, 0);
        scratchQuat.setFromEuler(scratchEuler);
        scratchScale.set(e.scale, 1, e.scale);
        scratchMat4.compose(scratchPos, scratchQuat, scratchScale);
        lilyPadInst.setMatrixAt(i, scratchMat4);
      }
      lilyPadInst.instanceMatrix.needsUpdate = true;
    }

    // 3. Tall Grass & Cave Grass gentle wind sway + physical rustle near player!
    updateGrassWave(tallGrassInst, tallGrassEntries, 0.0, tSec, player);
    updateGrassWave(caveGrassInst, caveGrassEntries, -0.02, tSec, player);

    // 4. Palm Fronds gentle tropical breeze
    if (palmCanopyInst && palmCanopyEntries.length > 0) {
      let dirty = false;
      for (let i = 0; i < palmCanopyEntries.length; i++) {
        const e = palmCanopyEntries[i];
        if (Math.abs(e.x - camFocus.x) > 18 || Math.abs(e.z - camFocus.z) > 13) continue;
        const swayX = Math.sin(tSec * 1.7 + e.phase) * 0.075;
        const swayZ = Math.cos(tSec * 1.3 + e.phase) * 0.06;
        scratchPos.set(e.x, e.y, e.z);
        scratchEuler.set(swayX, e.rotY, swayZ);
        scratchQuat.setFromEuler(scratchEuler);
        scratchScale.set(e.scale, e.scale, e.scale);
        scratchMat4.compose(scratchPos, scratchQuat, scratchScale);
        palmCanopyInst.setMatrixAt(i, scratchMat4);
        dirty = true;
      }
      if (dirty) palmCanopyInst.instanceMatrix.needsUpdate = true;
    }

    // 5. Bioluminescent cave point lights & crystal pulse
    for (let i = 0; i < cavePointLights.length; i++) {
      const pl = cavePointLights[i];
      pl.light.intensity = pl.baseIntensity * (0.86 + 0.18 * Math.sin(tSec * 2.1 + pl.phase));
    }
    for (let i = 0; i < crystalMaterials.length; i++) {
      crystalMaterials[i].emissiveIntensity = 0.7 + 0.22 * Math.sin(tSec * 2.4 + i);
    }

    // 6. Ambient floating 3D pollen / fireflies around camera
    if (ambientPoints && ambientPositions && ambientPhases) {
      const count = ambientPhases.length;
      for (let i = 0; i < count; i++) {
        let px = ambientPositions[i * 3];
        let py = ambientPositions[i * 3 + 1];
        let pz = ambientPositions[i * 3 + 2];

        px += (0.28 + Math.sin(tSec * 0.9 + ambientPhases[i]) * 0.18) * dt;
        py += Math.sin(tSec * 1.4 + ambientPhases[i]) * 0.24 * dt;
        pz += Math.cos(tSec * 0.7 + ambientPhases[i]) * 0.14 * dt;

        // Wrap softly around camera focus box
        if (px - camFocus.x > 13) px -= 26;
        else if (px - camFocus.x < -13) px += 26;
        if (pz - camFocus.z > 10) pz -= 20;
        else if (pz - camFocus.z < -10) pz += 20;
        if (py > 4.8) py = 0.5;
        else if (py < 0.35) py = 4.2;

        ambientPositions[i * 3] = px;
        ambientPositions[i * 3 + 1] = py;
        ambientPositions[i * 3 + 2] = pz;
      }
      ambientPoints.geometry.attributes.position.needsUpdate = true;
    }

    // 7. 3D Butterflies
    for (let i = 0; i < butterflies3D.length; i++) {
      const bf = butterflies3D[i];
      const ang = tSec * bf.speed + bf.phase;
      const nx = bf.anchorX + Math.sin(ang) * bf.rx;
      const nz = bf.anchorZ + Math.sin(ang * 1.5) * bf.rz;
      const ny = 0.72 + Math.sin(ang * 2.6) * 0.24;
      bf.group.position.set(nx, ny, nz);
      bf.group.rotation.y = Math.atan2(Math.cos(ang) * bf.rx, Math.cos(ang * 1.5) * 1.5 * bf.rz);
      const flap = Math.sin(tSec * 18 + bf.phase) * 0.85;
      bf.leftWing.rotation.z = flap;
      bf.rightWing.rotation.z = -flap;
    }

    // 8. Interactive 3D burst particles (leaves, petals, sparkles, dust)
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const p = burstParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        scene.remove(p.mesh);
        p.mat.dispose();
        burstParticles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.03, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.vrotX * dt;
      p.mesh.rotation.y += p.vrotY * dt;
      p.mat.opacity = clamp(1 - p.life / p.maxLife, 0, 1);
    }
  }

  function updateGrassWave(inst, entries, baseY, tSec, player) {
    if (!inst || !entries || entries.length === 0) return;
    let dirty = false;
    const px = player.renderX + 0.5;
    const pz = player.renderY + 0.5;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (Math.abs(e.x - camFocus.x) > 14 || Math.abs(e.z - camFocus.z) > 10) continue;

      let leanZ = Math.sin(tSec * 2.4 + e.phase) * 0.13;
      let leanX = Math.cos(tSec * 1.8 + e.phase) * 0.08;

      // Physically part blades when the player steps right through the tuft!
      const dx = e.x - px;
      const dz = e.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq < 0.55 && distSq > 0.0001) {
        const push = (1 - Math.sqrt(distSq) / 0.74) * 0.55;
        leanX += (dz / Math.sqrt(distSq)) * push;
        leanZ -= (dx / Math.sqrt(distSq)) * push;
      }

      scratchPos.set(e.x, baseY, e.z);
      scratchEuler.set(leanX, e.rotY, leanZ);
      scratchQuat.setFromEuler(scratchEuler);
      scratchScale.set(e.scale, e.scale, e.scale);
      scratchMat4.compose(scratchPos, scratchQuat, scratchScale);
      inst.setMatrixAt(e.idx, scratchMat4);
      dirty = true;
    }
    if (dirty) inst.instanceMatrix.needsUpdate = true;
  }

  function syncCanvasSize(vp) {
    if (!renderer || !camera || !overlayCanvas || !glCanvas) return false;
    const w = overlayCanvas.clientWidth || (vp && vp.width) || 768;
    const h = overlayCanvas.clientHeight || (vp && vp.height) || 480;
    if (w <= 0 || h <= 0) return false;

    lastViewportW = (vp && vp.width) || w;
    lastViewportH = (vp && vp.height) || h;

    if (w !== lastPixelW || h !== lastPixelH) {
      lastPixelW = w;
      lastPixelH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    return true;
  }

  // ==================== PUBLIC API (HM.Overworld3D) ====================

  HM.Overworld3D = {
    isActive: function () {
      return active;
    },

    init: function (opts) {
      if (active) {
        HM.Overworld3D.destroy();
      }
      opts = opts || {};
      overlayCanvas = opts.overlayCanvas || null;
      world = opts.world || HM.WORLD || null;

      if (!overlayCanvas || !world || !global.THREE || !HM.HD2D) {
        return false;
      }
      if (typeof HM.HD2D.isAvailable === 'function' && !HM.HD2D.isAvailable()) {
        return false;
      }
      if (typeof document === 'undefined' || !overlayCanvas.parentNode) {
        return false;
      }

      const THREE = global.THREE;
      try {
        // Save overlay inline styles so we restore cleanly if switching back to 2D
        prevOverlayStyles = {
          position: overlayCanvas.style.position,
          zIndex: overlayCanvas.style.zIndex,
          background: overlayCanvas.style.background
        };

        // Remove any stray leftover layer in the container
        const existing = overlayCanvas.parentNode.querySelector('.overworld-3d-layer');
        if (existing && existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }

        glCanvas = document.createElement('canvas');
        glCanvas.className = 'overworld-3d-layer';
        glCanvas.setAttribute('aria-hidden', 'true');
        glCanvas.style.position = 'absolute';
        glCanvas.style.inset = '0';
        glCanvas.style.width = '100%';
        glCanvas.style.height = '100%';
        glCanvas.style.display = 'block';
        glCanvas.style.pointerEvents = 'none';
        glCanvas.style.zIndex = '1';

        overlayCanvas.parentNode.insertBefore(glCanvas, overlayCanvas);
        overlayCanvas.style.position = 'relative';
        overlayCanvas.style.zIndex = '2';
        overlayCanvas.style.background = 'transparent';

        const initW = overlayCanvas.clientWidth || overlayCanvas.width || 768;
        const initH = overlayCanvas.clientHeight || overlayCanvas.height || 480;

        renderer = HM.HD2D.createRenderer(glCanvas, initW, initH);
        if (!renderer) {
          throw new Error('HM.HD2D.createRenderer retornou null');
        }
        lastPixelW = initW;
        lastPixelH = initH;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(36, initW / Math.max(1, initH), 0.5, 260);

        raycaster = new THREE.Raycaster();
        groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        camFocus = new THREE.Vector3(world.cols * 0.5, 0, world.rows * 0.5);
        camSnapped = false;
        biomeSnapped = false;
        lookAheadX = 0;
        lookAheadZ = 0;

        scratchVec3 = new THREE.Vector3();
        scratchVec2 = new THREE.Vector2();
        scratchMat4 = new THREE.Matrix4();
        scratchPos = new THREE.Vector3();
        scratchQuat = new THREE.Quaternion();
        scratchScale = new THREE.Vector3();
        scratchEuler = new THREE.Euler();
        scratchColor = new THREE.Color();

        ownedGeometries = [];
        ownedMaterials = [];
        ownedTextures = [];
        burstParticles = [];
        treeCanopyGroup = [];
        crystalMaterials = [];

        buildScene(THREE, world);
        active = true;
        return true;
      } catch (err) {
        console.warn('[Overworld3D] Falha ao iniciar WebGL 3D, voltando para 2.5D:', err);
        HM.Overworld3D.destroy();
        return false;
      }
    },

    snapCamera: function () {
      camSnapped = false;
      biomeSnapped = false;
    },

    spawnBurst: function (kind, col, row, palette) {
      spawnBurst3D(kind, col, row, palette);
    },

    render: function (frameData) {
      if (!active || !renderer || !scene || !camera || !frameData) return false;
      if (!syncCanvasSize(frameData.viewport)) return false;

      const dt = Math.min(0.05, Math.max(0.001, frameData.dt || 0.016));
      const elapsedTime = frameData.elapsedTime || 0;
      const player = frameData.player;

      updateBiomeAtmosphere(dt, frameData.currentZone);
      updateCameraAndLights(dt, player, !camSnapped);
      updateCharacters(frameData);
      updateAnimatedEnvironment(dt, elapsedTime, player);

      // Click-to-walk glowing 3D ground ring
      if (destRingMesh) {
        const path = frameData.clickPath;
        if (path && path.length > 0) {
          const dest = path[path.length - 1];
          const pulse = 1 + Math.sin(elapsedTime * 0.01) * 0.18;
          destRingMesh.visible = true;
          destRingMesh.position.set(dest.x + 0.5, getGroundSurfaceY(dest.x, dest.y) + 0.05, dest.y + 0.5);
          destRingMesh.scale.set(pulse, pulse, pulse);
        } else {
          destRingMesh.visible = false;
        }
      }

      renderer.render(scene, camera);
      return true;
    },

    // Projects a 3D world point (wx, wy, wz) into logical overlay viewport coordinates
    projectToScreen: function (wx, wy, wz) {
      if (!active || !camera || !scratchVec3) return null;
      scratchVec3.set(wx, wy, wz).project(camera);
      const visible = scratchVec3.z >= -1 && scratchVec3.z <= 1;
      return {
        x: (scratchVec3.x * 0.5 + 0.5) * lastViewportW,
        y: (-scratchVec3.y * 0.5 + 0.5) * lastViewportH,
        visible: visible
      };
    },

    // Real 3D Raycasting from browser clientX/clientY -> clicked NPC standee OR ground plane tile (tileCol, tileRow)
    pickAtClient: function (clientX, clientY) {
      if (!active || !camera || !overlayCanvas || !raycaster || !groundPlane) return null;
      const rect = overlayCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      scratchVec2.set(ndcX, ndcY);
      raycaster.setFromCamera(scratchVec2, camera);

      // 1. Check active 3D NPC standees first so clicking an NPC's head/body is pinpoint accurate!
      let hitNpc = null;
      if (activeNpcMeshes.length > 0) {
        const npcHits = raycaster.intersectObjects(activeNpcMeshes, false);
        if (npcHits && npcHits.length > 0 && npcHits[0].object && npcHits[0].object.userData) {
          hitNpc = npcHits[0].object.userData.npc || null;
        }
      }

      // 2. Intersect mathematical ground plane y = 0
      const hitPoint = raycaster.ray.intersectPlane(groundPlane, scratchVec3);
      if (!hitPoint && !hitNpc) return null;

      const wx = hitPoint ? hitPoint.x : (hitNpc.x + 0.5);
      const wz = hitPoint ? hitPoint.z : (hitNpc.y + 0.5);
      return {
        x: wx,
        z: wz,
        tileCol: Math.floor(wx),
        tileRow: Math.floor(wz),
        npc: hitNpc
      };
    },

    destroy: function () {
      active = false;

      // Clean up active burst particles
      for (let i = 0; i < burstParticles.length; i++) {
        if (scene && burstParticles[i].mesh) scene.remove(burstParticles[i].mesh);
        if (burstParticles[i].mat) burstParticles[i].mat.dispose();
      }
      burstParticles = [];

      // Dispose standees' geometries/materials (NOT shared HD2D textures!)
      if (playerStandee && playerStandee.group) {
        disposeStandee(playerStandee);
      }
      playerStandee = null;

      for (const id in npcStandees) {
        if (npcStandees[id] && npcStandees[id].standee) {
          disposeStandee(npcStandees[id].standee);
        }
      }
      npcStandees = Object.create(null);
      activeNpcMeshes = [];

      if (skyDome) {
        if (skyDome.geometry) skyDome.geometry.dispose();
        if (skyDome.material) {
          if (skyDome.material.map) skyDome.material.map.dispose();
          skyDome.material.dispose();
        }
        skyDome = null;
      }

      for (let i = 0; i < ownedGeometries.length; i++) {
        try { ownedGeometries[i].dispose(); } catch (_e) {}
      }
      for (let i = 0; i < ownedMaterials.length; i++) {
        try { ownedMaterials[i].dispose(); } catch (_e) {}
      }
      for (let i = 0; i < ownedTextures.length; i++) {
        try { ownedTextures[i].dispose(); } catch (_e) {}
      }
      ownedGeometries = [];
      ownedMaterials = [];
      ownedTextures = [];

      if (renderer) {
        try {
          renderer.dispose();
          if (typeof renderer.forceContextLoss === 'function') {
            renderer.forceContextLoss();
          }
        } catch (_e) {}
        renderer = null;
      }

      if (glCanvas && glCanvas.parentNode) {
        glCanvas.parentNode.removeChild(glCanvas);
      }
      glCanvas = null;

      if (overlayCanvas && prevOverlayStyles) {
        overlayCanvas.style.position = prevOverlayStyles.position || '';
        overlayCanvas.style.zIndex = prevOverlayStyles.zIndex || '';
        overlayCanvas.style.background = prevOverlayStyles.background || '';
      }
      prevOverlayStyles = null;
      overlayCanvas = null;

      scene = null;
      camera = null;
      world = null;
      sunLight = null;
      hemiLight = null;
      ambientLight = null;
      cavePointLights = [];
      waterTextureClone = null;
      waterMesh = null;
      lilyPadInst = null;
      lilyPadEntries = [];
      tallGrassInst = null;
      tallGrassEntries = [];
      caveGrassInst = null;
      caveGrassEntries = [];
      treeCanopyGroup = [];
      palmCanopyInst = null;
      palmCanopyEntries = [];
      flowerInst = null;
      flowerEntries = [];
      crystalMaterials = [];
      destRingMesh = null;
      ambientPoints = null;
      ambientPositions = null;
      ambientPhases = null;
      ambientMaterial = null;
      butterflies3D = [];
      burstGeo = null;
      camSnapped = false;
      lastPixelW = 0;
      lastPixelH = 0;
    }
  };

  function disposeStandee(st) {
    try {
      if (HM.HD2D && typeof HM.HD2D.disposeObject === 'function' && st.group) {
        HM.HD2D.disposeObject(st.group);
        return;
      }
      if (st.mesh) {
        if (st.mesh.geometry) st.mesh.geometry.dispose();
        if (st.mesh.material) st.mesh.material.dispose();
        if (st.mesh.customDepthMaterial) st.mesh.customDepthMaterial.dispose();
      }
      if (st.shadowMesh) {
        if (st.shadowMesh.geometry) st.shadowMesh.geometry.dispose();
        if (st.shadowMesh.material) st.shadowMesh.material.dispose();
      }
    } catch (_e) {}
  }
})(window);
