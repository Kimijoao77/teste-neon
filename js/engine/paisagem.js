(function (HM, T) {
  'use strict';

  const facades = {
    'Lab do Prof. Pomar': 'casa_pomar',
    'Estufa de Cura': 'casa_cura',
    'Loja de Sementes': 'casa_sementes'
  };
  const colors = new T.Color();
  const geometries = new Map();
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide });
  const plants = new Set();
  const scenery = HM.browserScenery.filter((prop, i) => !prop.model.startsWith('arvore_') || i % 3 === 0);
  for (const p of scenery) {
    if (p.model.startsWith('arvore_') || p.model === 'mandacaru') {
      plants.add(Math.round(p.x) + ',' + Math.round(p.y));
    }
  }

  function geometry(name) {
    if (geometries.has(name)) return geometries.get(name);
    const [pos, rgb] = HM.browserModels[name].map(atob);
    const positions = new Float32Array(pos.length / 2);
    const shades = new Float32Array(rgb.length);
    for (let i = 0; i < positions.length; i++) {
      const n = pos.charCodeAt(i * 2) | pos.charCodeAt(i * 2 + 1) << 8;
      positions[i] = (n << 16 >> 16) / 1024;
    }
    for (let i = 0; i < shades.length; i += 3) {
      colors.setRGB(rgb.charCodeAt(i) / 255, rgb.charCodeAt(i + 1) / 255, rgb.charCodeAt(i + 2) / 255, T.SRGBColorSpace);
      shades[i] = colors.r;
      shades[i+1] = colors.g;
      shades[i+2] = colors.b;
    }
    const result = new T.BufferGeometry();
    result.setAttribute('position', new T.BufferAttribute(positions, 3));
    result.setAttribute('color', new T.BufferAttribute(shades, 3));
    result.computeVertexNormals();
    geometries.set(name, result);
    return result;
  }

  function add(scene, buildings) {
    const models = [...scenery];
    buildings.forEach((b) => {
      if (facades[b.label]) models.push({
        model: facades[b.label], x: b.x + (b.w - 1) / 2, y: b.y + (b.h - 1) / 2, face: true
      });
    });
    for (const p of models) {
      if (!HM.browserModels[p.model]) continue;
      const mesh = new T.Mesh(geometry(p.model), material);
      mesh.position.set(p.x + .5, 0, p.y + .5);
      mesh.rotation.y = p.face ? -.40 : -(p.angle ?? p.rot ?? 0) * Math.PI / 180;
      mesh.scale.setScalar(p.scale || 1);
      scene.add(mesh);
    }
  }

  HM.BrowserScenery = {
    add,
    hasFacade: (b) => Boolean(facades[b.label] && HM.browserModels[facades[b.label]]),
    hasPlant: (x,y) => plants.has(x + ',' + y),
    bridge: (x,y) => x >= 27 && x <= 28 && Math.abs(y - 12) <= 1
  };
})(window.HortaMon, window.THREE);
