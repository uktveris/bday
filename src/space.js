import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

/* -------------------------------- Starfield -------------------------------- */

const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * uPixelRatio * (240.0 / -mv.z);
    gl_PointSize = clamp(size, 1.0, 7.0 * uPixelRatio);
    vColor = aColor;
    vAlpha = 0.6 + 0.4 * sin(uTime * (0.6 + aPhase * 1.8) + aPhase * 6.2831);
  }
`;

const starFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a * a * vAlpha);
  }
`;

// Each star also gets a line segment whose tail trails along the camera
// velocity, so the faster we fly the longer the streaks get.
const streakVertex = /* glsl */ `
  uniform vec3 uVel;
  uniform float uStretch;
  uniform float uOpacity;
  attribute float aEnd;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position + uVel * uStretch * aEnd;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = uOpacity * (1.0 - aEnd) * smoothstep(1100.0, 80.0, -mv.z);
  }
`;

const streakFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

export function createStarfield({ count, bounds, avoid = [] }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const palette = ['#ffffff', '#ffffff', '#cfe0ff', '#ffe7c2', '#ffc9de', '#bfe9ff'].map((c) => new THREE.Color(c));

  const p = new THREE.Vector3();
  let i = 0;
  while (i < count) {
    p.set(rand(bounds.min.x, bounds.max.x), rand(bounds.min.y, bounds.max.y), rand(bounds.min.z, bounds.max.z));
    if (avoid.some((a) => a.center.distanceTo(p) < a.radius)) continue;
    p.toArray(positions, i * 3);
    palette[(Math.random() * palette.length) | 0].toArray(colors, i * 3);
    sizes[i] = Math.random() < 0.06 ? rand(2.4, 3.6) : rand(0.8, 1.8);
    phases[i] = Math.random();
    i++;
  }

  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointsGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  pointsGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  pointsGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const pointsMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pointsGeo, pointsMat);
  points.frustumCulled = false;

  const linePos = new Float32Array(count * 6);
  const lineColor = new Float32Array(count * 6);
  const lineEnd = new Float32Array(count * 2);
  for (let s = 0; s < count; s++) {
    for (let e = 0; e < 2; e++) {
      const v = s * 2 + e;
      linePos[v * 3] = positions[s * 3];
      linePos[v * 3 + 1] = positions[s * 3 + 1];
      linePos[v * 3 + 2] = positions[s * 3 + 2];
      lineColor[v * 3] = colors[s * 3];
      lineColor[v * 3 + 1] = colors[s * 3 + 1];
      lineColor[v * 3 + 2] = colors[s * 3 + 2];
      lineEnd[v] = e;
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('aColor', new THREE.BufferAttribute(lineColor, 3));
  lineGeo.setAttribute('aEnd', new THREE.BufferAttribute(lineEnd, 1));

  const lineMat = new THREE.ShaderMaterial({
    uniforms: {
      uVel: { value: new THREE.Vector3() },
      uStretch: { value: 0.12 },
      uOpacity: { value: 0 },
    },
    vertexShader: streakVertex,
    fragmentShader: streakFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const streaks = new THREE.LineSegments(lineGeo, lineMat);
  streaks.frustumCulled = false;
  streaks.visible = false;

  const group = new THREE.Group();
  group.add(points, streaks);

  return {
    group,
    setPixelRatio(pr) {
      pointsMat.uniforms.uPixelRatio.value = pr;
    },
    update(time, velocity, intensity) {
      pointsMat.uniforms.uTime.value = time;
      lineMat.uniforms.uVel.value.copy(velocity);
      lineMat.uniforms.uOpacity.value = intensity;
      streaks.visible = intensity > 0.01;
    },
  };
}

/* ------------------------------ Nebula skybox ------------------------------ */

export function createSky(sunDirection) {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#04040d';
  ctx.fillRect(0, 0, W, H);

  // Draw at x, x-W and x+W so blobs wrap seamlessly around the sphere.
  const wrapBlob = (x, y, r, color) => {
    for (const ox of [-W, 0, W]) {
      const g = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  };

  ctx.globalCompositeOperation = 'lighter';
  const nebula = ['rgba(120,60,200,0.10)', 'rgba(40,90,200,0.10)', 'rgba(200,60,140,0.07)', 'rgba(30,160,170,0.06)'];
  // A faint milky-way band winding around the sky.
  for (let i = 0; i < 90; i++) {
    const x = (i / 90) * W;
    const y = H * 0.5 + Math.sin((x / W) * Math.PI * 2) * H * 0.16 + rand(-30, 30);
    wrapBlob(x, y, rand(40, 110), nebula[i % nebula.length]);
  }
  for (let i = 0; i < 14; i++) {
    wrapBlob(rand(0, W), rand(H * 0.15, H * 0.85), rand(80, 200), nebula[(Math.random() * nebula.length) | 0]);
  }
  for (let i = 0; i < 2200; i++) {
    const a = Math.random();
    ctx.fillStyle = `rgba(255,255,255,${0.15 + a * a * 0.6})`;
    ctx.fillRect(rand(0, W), rand(0, H), 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 48, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, toneMapped: false }),
  );
  sphere.renderOrder = -2;
  group.add(sphere);

  // Distant sun glow, lined up with the key light.
  const [gc, gctx] = (() => {
    const cc = document.createElement('canvas');
    cc.width = cc.height = 256;
    return [cc, cc.getContext('2d')];
  })();
  const g = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,250,235,1)');
  g.addColorStop(0.08, 'rgba(255,230,180,0.9)');
  g.addColorStop(0.3, 'rgba(255,170,90,0.25)');
  g.addColorStop(1, 'rgba(255,120,60,0)');
  gctx.fillStyle = g;
  gctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(gc);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sun.position.copy(sunDirection).normalize().multiplyScalar(3500);
  sun.scale.setScalar(900);
  sun.renderOrder = -1;
  group.add(sun);

  return group;
}

/* --------------------------------- Planets --------------------------------- */

function bandTexture(colors) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const tmp = new THREE.Color();
  const a = new THREE.Color();
  const b = new THREE.Color();
  const cols = colors.map((x) => new THREE.Color(x));
  const seed = Math.random() * 10;
  for (let y = 0; y < 256; y++) {
    const v = y / 256;
    const n = 0.5 + 0.5 * Math.sin(v * 23 + seed) * Math.sin(v * 7.3 + seed * 2) + rand(-0.04, 0.04);
    const f = Math.min(0.999, Math.max(0, n)) * (cols.length - 1);
    a.copy(cols[Math.floor(f)]);
    b.copy(cols[Math.min(cols.length - 1, Math.floor(f) + 1)]);
    tmp.copy(a).lerp(b, f - Math.floor(f));
    ctx.fillStyle = `#${tmp.getHexString()}`;
    ctx.fillRect(0, y, 64, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlanets(defs) {
  const group = new THREE.Group();
  const spinners = [];
  for (const d of defs) {
    const planet = new THREE.Group();
    planet.position.copy(d.position);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(d.radius, 48, 32),
      new THREE.MeshStandardMaterial({ map: bandTexture(d.colors), roughness: 0.9 }),
    );
    planet.add(mesh);
    if (d.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(d.radius * 1.35, d.radius * 2.1, 96),
        new THREE.MeshBasicMaterial({
          color: d.ring,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2 - 0.35;
      ring.rotation.y = 0.25;
      planet.add(ring);
    }
    planet.rotation.z = d.tilt ?? 0.2;
    group.add(planet);
    spinners.push(mesh);
  }
  return {
    group,
    update(dt) {
      for (const m of spinners) m.rotation.y += dt * 0.03;
    },
  };
}
