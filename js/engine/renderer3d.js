(function (window) {
  'use strict';

  const T = window.THREE;
  if (!T) return;
  const sphere = new T.SphereGeometry(1, 9, 7);
  const pyramid = new T.IcosahedronGeometry(1, 0);
  const bevel = new T.IcosahedronGeometry(1, 1);
  const column = new T.CylinderGeometry(1, 1, 1, 7);
  const cone = new T.ConeGeometry(1, 1, 7);
  const cache = new WeakMap();
  const towardSun = new T.Vector3(-.42, .82, .39).normalize();

  function meshData(geometry, small) {
    const type = geometry.type;
    if (type === 'SphereGeometry') geometry = sphere;
    if (type === 'IcosahedronGeometry') geometry = small ? pyramid : bevel;
    if (type === 'ConeGeometry') geometry = cone;
    if (type === 'CylinderGeometry' && geometry.parameters.radiusTop === 1 && geometry.parameters.radiusBottom === 1) geometry = column;
    if (!cache.has(geometry)) {
      const points = geometry.attributes.position.array;
      const indices = geometry.index?.array ?? Array.from({ length: points.length / 3 }, (_, i) => i);
      cache.set(geometry, { points, indices });
    }
    return cache.get(geometry);
  }

  class SoftwareRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      this.context = this.domElement.getContext('2d', { alpha: false });
      this.worldCanvas = document.createElement('canvas');
      this.worldContext = this.worldCanvas.getContext('2d', { alpha: false });
      this.actorCanvas = document.createElement('canvas');
      this.actorContext = this.actorCanvas.getContext('2d');
      this.matrix = new T.Matrix4();
      this.instance = new T.Matrix4();
      this.world = new T.Matrix4();
      this.localClip = new T.Matrix4();
      this.center = new T.Vector3();
      this.cameraSide = new T.Vector3();
      this.instanceColor = new T.Color();
      this.fogColor = new T.Color();
      this.projected = new Float32Array(0);
      this.worldPoints = new Float32Array(0);
      this.triangles = [];
      this.sprites = [];
      this.spriteImages = new WeakMap();
      this.ready = false;
      this.lastScene = null;
      this.lastPitch = 0;
      this.drawAt = 0;
    }

    setSize(width, height) {
      const sceneRatio = Math.min(1, 1000 / width, 700 / height);
      const displayRatio = Math.min(window.devicePixelRatio || 1, 1.75, 1920 / width, 1200 / height);
      this.width = this.worldCanvas.width = Math.max(1, Math.round(width * sceneRatio));
      this.height = this.worldCanvas.height = Math.max(1, Math.round(height * sceneRatio));
      this.displayWidth = this.domElement.width = this.actorCanvas.width = Math.max(1, Math.round(width * displayRatio));
      this.displayHeight = this.domElement.height = this.actorCanvas.height = Math.max(1, Math.round(height * displayRatio));
      this.image = this.worldContext.createImageData(this.width, this.height);
      this.pixels = new Uint32Array(this.image.data.buffer);
      this.actorImage = this.actorContext.createImageData(this.displayWidth, this.displayHeight);
      this.depth = new Float32Array(this.width * this.height);
      this.ready = false;
    }

    render(scene, camera) {
      const now = performance.now();
      if (this.ready && this.lastScene === scene && Math.abs(this.lastPitch - camera.position.y) < .04 && now < this.drawAt) return false;
      this.lastScene = scene;
      this.lastPitch = camera.position.y;
      this.ready = true;
      this.count = 0;
      this.sprites.length = 0;
      const mist = scene.fog;
      this.fogColor.copy(scene.background).convertLinearToSRGB();
      this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.cameraSide.setFromMatrixPosition(camera.matrixWorld);
      scene.updateMatrixWorld(true);
      scene.traverseVisible((object) => {
        if (object.userData.billboard && object.material.map) {
          this.sprites.push(object);
          return;
        }
        if (!object.isMesh) return;
        const material = object.material;
        if (object.isInstancedMesh) {
          for (let i = 0; i < object.count; i++) {
            object.getMatrixAt(i, this.instance);
            this.world.multiplyMatrices(object.matrixWorld, this.instance);
            if (object.instanceColor) object.getColorAt(i, this.instanceColor);
            this.mesh(object.geometry, this.world, object.instanceColor ? this.instanceColor : material.color, material, mist);
          }
        } else this.mesh(object.geometry, object.matrixWorld, material.color, material, mist);
      });

      this.depth.fill(0);
      this.pixels.fill(this.pixel(this.fogColor.r * 255, this.fogColor.g * 255, this.fogColor.b * 255));
      for (let i = 0; i < this.count; i++) {
        const tri = this.triangles[i];
        if (tri.opacity >= 1) this.rasterize(tri);
      }
      for (let i = 0; i < this.count; i++) {
        const tri = this.triangles[i];
        if (tri.opacity < 1) this.rasterize(tri);
      }
      this.worldContext.putImageData(this.image, 0, 0);
      this.context.drawImage(this.worldCanvas, 0, 0, this.displayWidth, this.displayHeight);
      if (this.sprites.length) {
        // Neighboring sprites are parallel vertical planes. Paint the farthest first.
        const view = camera.matrixWorldInverse.elements;
        this.sprites.sort((a, b) => (a.position.x - b.position.x) * view[2] + (a.position.z - b.position.z) * view[10]);
        this.actorImage.data.fill(0);
        for (const sprite of this.sprites) this.rasterizeSprite(sprite, camera);
        this.actorContext.putImageData(this.actorImage, 0, 0);
        this.context.drawImage(this.actorCanvas, 0, 0);
      }
      const spent = performance.now() - now;
      this.drawAt = now + (spent > 48 ? Math.min(84, spent + 12) : 32);
      return true;
    }

    pixel(red, green, blue) {
      return (255 << 24) | ((blue | 0) << 16) | ((green | 0) << 8) | (red | 0);
    }

    rasterizeSprite(sprite, camera) {
      const view = this.center.setFromMatrixPosition(sprite.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      if (view.z >= -camera.near || view.z <= -camera.far) return;
      const projection = camera.projectionMatrix.elements;
      // The character planes stand vertically, so screen rows have different depths.
      const up = camera.matrixWorldInverse.elements;
      const { displayWidth, displayHeight } = this;
      const height = sprite.scale.y;
      const lower = -.045 * height;
      const upper = .955 * height;
      const depthTop = -1 / (view.z + up[6] * upper);
      const depthBottom = -1 / (view.z + up[6] * lower);
      const sy = projection[5] * displayHeight * .5;
      const top = displayHeight * .5 - (view.y + up[5] * upper) * sy * depthTop;
      const bottom = displayHeight * .5 - (view.y + up[5] * lower) * sy * depthBottom;
      const y0 = Math.max(0, Math.ceil(top - .5));
      const y1 = Math.min(displayHeight, Math.ceil(bottom - .5));
      if (y0 >= y1) return;

      const texture = sprite.material.map;
      let image = this.spriteImages.get(texture);
      if (!image || image.version !== texture.version) {
        const surface = texture.image;
        const data = surface.getContext('2d').getImageData(0, 0, surface.width, surface.height);
        image = { data: data.data, width: data.width, height: data.height, version: texture.version };
        this.spriteImages.set(texture, image);
      }
      const threshold = sprite.material.alphaTest * 255;
      const sx = projection[0] * displayWidth * .5;
      const pixels = image.data;
      const output = this.actorImage.data;
      const depthScaleX = this.width / displayWidth;
      const depthScaleY = this.height / displayHeight;
      for (let y = y0; y < y1; y++) {
        const mix = (y + .5 - top) / (bottom - top);
        const depth = depthTop + (depthBottom - depthTop) * mix;
        const v = Math.max(0, Math.min(image.height - 1, mix * depthBottom / depth * image.height - .5));
        const line = Math.floor(v);
        const high = v - line;
        const row = line * image.width * 4;
        const nextRow = Math.min(line + 1, image.height - 1) * image.width * 4;
        const width = sprite.scale.x * sx * depth;
        const left = displayWidth * .5 + view.x * sx * depth - width * .5;
        const x0 = Math.max(0, Math.ceil(left - .5));
        const x1 = Math.min(displayWidth, Math.ceil(left + width - .5));
        const depthRow = Math.floor((y + .5) * depthScaleY) * this.width;
        let offset = (y * displayWidth + x0) * 4;
        for (let x = x0; x < x1; x++, offset += 4) {
          if (depth <= this.depth[depthRow + Math.floor((x + .5) * depthScaleX)]) continue;
          const u = Math.max(0, Math.min(image.width - 1, (x + .5 - left) * image.width / width - .5));
          const col = Math.floor(u);
          const across = u - col;
          const a = row + col * 4;
          const b = row + Math.min(col + 1, image.width - 1) * 4;
          const c = nextRow + col * 4;
          const d = nextRow + Math.min(col + 1, image.width - 1) * 4;
          const wa = (1 - high) * (1 - across) * pixels[a + 3];
          const wb = (1 - high) * across * pixels[b + 3];
          const wc = high * (1 - across) * pixels[c + 3];
          const wd = high * across * pixels[d + 3];
          const opacity = wa + wb + wc + wd;
          if (opacity < threshold) continue;
          const behind = output[offset + 3] * (1 - opacity / 255);
          const alpha = opacity + behind;
          for (let channel = 0; channel < 3; channel++) {
            const color = wa * pixels[a + channel] + wb * pixels[b + channel] + wc * pixels[c + channel] + wd * pixels[d + channel];
            output[offset + channel] = (color + behind * output[offset + channel]) / alpha;
          }
          output[offset + 3] = alpha;
        }
      }
    }

    rasterize(t) {
      const x0 = Math.max(0, Math.floor(Math.min(t.ax, t.bx, t.cx)));
      const y0 = Math.max(0, Math.floor(Math.min(t.ay, t.by, t.cy)));
      const x1 = Math.min(this.width - 1, Math.ceil(Math.max(t.ax, t.bx, t.cx)));
      const y1 = Math.min(this.height - 1, Math.ceil(Math.max(t.ay, t.by, t.cy)));
      const e0x = (t.by - t.cy) / t.area, e0y = (t.cx - t.bx) / t.area;
      const e1x = (t.cy - t.ay) / t.area, e1y = (t.ax - t.cx) / t.area;
      const e2x = -e0x - e1x;
      let aRow = e0x * (x0 + .5 - t.cx) + e0y * (y0 + .5 - t.cy);
      let bRow = e1x * (x0 + .5 - t.ax) + e1y * (y0 + .5 - t.ay);
      const dz = e0x * t.aDepth + e1x * t.bDepth + e2x * t.cDepth;
      const opacity = t.opacity;
      const red = t.pixel & 255, green = t.pixel >>> 8 & 255, blue = t.pixel >>> 16 & 255;
      for (let y = y0; y <= y1; y++) {
        let a = aRow, b = bRow, c = 1 - a - b;
        let z = a * t.aDepth + b * t.bDepth + c * t.cDepth;
        let offset = y * this.width + x0;
        for (let x = x0; x <= x1; x++, offset++) {
          if (a >= -.00001 && b >= -.00001 && c >= -.00001 && z > this.depth[offset]) {
            if (opacity >= 1) {
              this.depth[offset] = z;
              this.pixels[offset] = t.pixel;
            } else {
              const old = this.pixels[offset], fade = 1 - opacity;
              this.pixels[offset] = this.pixel((old & 255) * fade + red * opacity,
                (old >>> 8 & 255) * fade + green * opacity, (old >>> 16 & 255) * fade + blue * opacity);
            }
          }
          a += e0x; b += e1x; c += e2x; z += dz;
        }
        aRow += e0y;
        bRow += e1y;
      }
    }

    mesh(geometry, matrix, color, material, mist) {
      const mw = matrix.elements;
      const size = Math.max(Math.hypot(mw[0], mw[1], mw[2]), Math.hypot(mw[4], mw[5], mw[6]), Math.hypot(mw[8], mw[9], mw[10]));
      const distance = Math.hypot(mw[12] - this.cameraSide.x, mw[13] - this.cameraSide.y, mw[14] - this.cameraSide.z);
      if (distance > Math.min(mist.far + size, 41)) return;
      this.center.set(mw[12], mw[13], mw[14]).applyMatrix4(this.matrix);
      const buffer = Math.min(2.2, .20 + size * 4.4 / Math.max(1, distance));
      if (Math.abs(this.center.x) > 1 + buffer || Math.abs(this.center.y) > 1 + buffer || this.center.z > 1.04) return;

      const { points, indices } = meshData(geometry, size < .47 || distance > 13);
      if (this.projected.length < points.length) {
        this.projected = new Float32Array(points.length);
        this.worldPoints = new Float32Array(points.length);
      }
      const xy = this.projected, p = this.worldPoints;
      const m = this.localClip.multiplyMatrices(this.matrix, matrix).elements;
      const sw = this.width * .5, sh = this.height * .5;
      for (let i = 0; i < points.length; i += 3) {
        const x = points[i], y = points[i + 1], z = points[i + 2];
        const d = m[3] * x + m[7] * y + m[11] * z + m[15];
        xy[i + 2] = d;
        if (d <= .12) continue;
        xy[i] = (1 + (m[0] * x + m[4] * y + m[8] * z + m[12]) / d) * sw;
        xy[i + 1] = (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / d) * sh;
        p[i] = mw[0] * x + mw[4] * y + mw[8] * z;
        p[i + 1] = mw[1] * x + mw[5] * y + mw[9] * z;
        p[i + 2] = mw[2] * x + mw[6] * y + mw[10] * z;
      }

      const red = Math.sqrt(color.r), green = Math.sqrt(color.g), blue = Math.sqrt(color.b);
      const vertexColors = material.vertexColors ? geometry.attributes.color?.array : null;
      const unlit = material.isMeshBasicMaterial;
      const opacity = material.opacity;
      const light = towardSun;
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
        const az = xy[a + 2], bz = xy[b + 2], cz = xy[c + 2];
        if (az <= .12 || bz <= .12 || cz <= .12) continue;
        const ax = xy[a], bx = xy[b], cx = xy[c], ay = xy[a + 1], by = xy[b + 1], cy = xy[c + 1];
        if (Math.max(ax, bx, cx) < 0 || Math.min(ax, bx, cx) > this.width ||
            Math.max(ay, by, cy) < 0 || Math.min(ay, by, cy) > this.height) continue;
        const face = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (face >= -.22 && (material.side !== T.DoubleSide || face < .22)) continue;
        let shade = 1;
        if (!unlit) {
          const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
          const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const lambert = Math.max(0, (nx * light.x + ny * light.y + nz * light.z) / (Math.hypot(nx, ny, nz) || 1));
          shade = .68 + .35 * lambert;
        }
        const depth = (az + bz + cz) / 3;
        const fog = Math.min(.94, Math.max(0, (depth - mist.near) / (mist.far - mist.near)));
        const tri = this.triangles[this.count] ?? (this.triangles[this.count] = {});
        tri.ax = ax; tri.ay = ay; tri.bx = bx; tri.by = by; tri.cx = cx; tri.cy = cy;
        tri.area = face;
        tri.aDepth = 1 / az; tri.bDepth = 1 / bz; tri.cDepth = 1 / cz;
        tri.opacity = opacity;
        const rr = vertexColors ? Math.sqrt(vertexColors[a]) : red;
        const gg = vertexColors ? Math.sqrt(vertexColors[a + 1]) : green;
        const bb = vertexColors ? Math.sqrt(vertexColors[a + 2]) : blue;
        const r = Math.min(255, (255 * (rr * shade * (1 - fog) + this.fogColor.r * fog)) | 0);
        const g = Math.min(255, (255 * (gg * shade * (1 - fog) + this.fogColor.g * fog)) | 0);
        const b8 = Math.min(255, (255 * (bb * shade * (1 - fog) + this.fogColor.b * fog)) | 0);
        tri.pixel = this.pixel(r, g, b8);
        this.count++;
      }
    }
  }

  window.HortaMon.SoftwareRenderer = SoftwareRenderer;
})(window);
