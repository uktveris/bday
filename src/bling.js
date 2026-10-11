import * as THREE from 'three';

// Shared Juicy-glam bits: velour/gold/crystal materials, crystal lettering
// and sparkle glints. Used by the throne and the coffee table.

const rand = (a, b) => a + Math.random() * (b - a);

const CRYSTAL_FONT = "italic 900 {size}px Georgia, 'Times New Roman', serif";

export function materials(envMap) {
  const velour = (color, sheen) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.85,
      sheen: 1,
      sheenColor: new THREE.Color(sheen),
      sheenRoughness: 0.4,
      envMap,
      envMapIntensity: 0.35,
    });
  return {
    velour: velour('#ff5fa8', '#ffd3ec'),
    velourDeep: velour('#e33d86', '#ffb3d9'),
    velourHeart: velour('#ff2e74', '#ffc2d8'),
    platform: new THREE.MeshStandardMaterial({
      color: '#161618',
      roughness: 0.55,
      envMap,
      envMapIntensity: 0.3,
    }),
    lacquer: new THREE.MeshPhysicalMaterial({
      color: '#ff5fa8',
      roughness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMap,
      envMapIntensity: 0.6,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: '#f6c870',
      metalness: 1,
      roughness: 0.22,
      envMap,
      envMapIntensity: 1.2,
    }),
    crystal: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      metalness: 1,
      roughness: 0.04,
      flatShading: true,
      envMap,
      envMapIntensity: 1.8,
    }),
  };
}

/* ------------------------------ Crystal lettering ------------------------------ */

// Splits the words into the line count that allows the biggest font.
function layoutLines(ctx, words, W, H) {
  let best = { size: 0, lines: [words.join(' ')] };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const per = Math.ceil(words.length / n);
    const lines = [];
    for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(' '));
    let size = (H / (lines.length * 1.05)) | 0;
    ctx.font = CRYSTAL_FONT.replace('{size}', 100);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    size = Math.min(size, ((W * 0.94) / widest) * 100);
    if (size > best.size) best = { size, lines };
  }
  return best;
}

// Returns crystal positions (in box-local units, centred) tracing the text.
export function crystalPoints(text, boxW, boxH) {
  const W = 1024;
  const H = Math.round((W * boxH) / boxW);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const { size, lines } = layoutLines(ctx, text.split(/\s+/), W, H);

  ctx.font = CRYSTAL_FONT.replace('{size}', size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  const lh = size * 1.05;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));

  const data = ctx.getImageData(0, 0, W, H).data;
  const step = Math.max(6, size * 0.075);
  const pts = [];
  // Hex grid sampling so the crystals pack nicely.
  for (let row = 0, y = step / 2; y < H; row++, y += step * 0.866) {
    for (let x = (row % 2) * (step / 2) + step / 2; x < W; x += step) {
      const jx = x + rand(-0.12, 0.12) * step;
      const jy = y + rand(-0.12, 0.12) * step;
      const a = data[((jy | 0) * W + (jx | 0)) * 4 + 3];
      if (a > 140) pts.push(new THREE.Vector2((jx / W - 0.5) * boxW, (0.5 - jy / H) * boxH));
    }
  }
  return { pts, gemSize: (step / W) * boxW * 0.62 };
}

export function gemField(points, size, material, tint = 0.25) {
  const geo = new THREE.OctahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(geo, material, points.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const white = new THREE.Color('#ffffff');
  const pinks = ['#ffc6e3', '#ff9fd0', '#e8d4ff'].map((c) => new THREE.Color(c));
  points.forEach((p, i) => {
    e.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    q.setFromEuler(e);
    const k = size * rand(0.85, 1.2);
    s.set(k, k, k * 0.7);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, Math.random() < tint ? pinks[(Math.random() * pinks.length) | 0] : white);
  });
  return mesh;
}

/* ---------------------------------- Sparkles --------------------------------- */

function sparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,230,245,0.8)');
  g.addColorStop(1, 'rgba(255,200,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [w, h] of [[2.5, 30], [30, 2.5]]) {
    ctx.beginPath();
    ctx.ellipse(32, 32, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

// Little star glints that pop on random crystals.
export function createSparkles(anchors, count = 12, size = 7) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phase = Array.from({ length: count }, () => Math.random());
  const speed = Array.from({ length: count }, () => rand(0.5, 0.9));
  const cycle = new Array(count).fill(-1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: sparkleTexture() } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (300.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      void main() { gl_FragColor = texture2D(uMap, gl_PointCoord); }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;

  return {
    points,
    update(time) {
      if (anchors.length === 0) return; // nothing to sparkle on (e.g. blank text)
      for (let i = 0; i < count; i++) {
        const t = time * speed[i] + phase[i];
        const n = Math.floor(t);
        if (n !== cycle[i]) {
          cycle[i] = n;
          anchors[(Math.random() * anchors.length) | 0].toArray(positions, i * 3);
        }
        const f = t - n;
        // Short bright pop, then rest.
        sizes[i] = f < 0.35 ? Math.sin((f / 0.35) * Math.PI) * size : 0;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

