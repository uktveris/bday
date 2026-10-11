import * as THREE from 'three';
import { createTable } from './table.js';
import { createThrone } from './throne.js';

// All objects are built from code (lathe/sphere geometry + canvas textures),
// so there are no model or image files to download.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function colorTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const rand = (a, b) => a + Math.random() * (b - a);

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function blob(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// A leaf in the XY plane, base at the origin, tip at +Y, curled back along -Z.
function leafGeometry(length, width) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width, length * 0.25, width * 0.8, length * 0.75, 0, length);
  s.bezierCurveTo(-width * 0.8, length * 0.75, -width, length * 0.25, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) / length;
    pos.setZ(i, -y * y * length * 0.28 + Math.abs(x) * 0.25);
  }
  geo.computeVertexNormals();
  return geo;
}

const leafMaterial = () =>
  new THREE.MeshStandardMaterial({ color: '#3f9a3a', roughness: 0.55, side: THREE.DoubleSide });

/* ---------------------------------- Apple ---------------------------------- */

function createApple() {
  const R = 10;
  const Hh = 9;
  const pts = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI;
    const x = Math.sin(t) * R * (1 - 0.13 * Math.cos(t));
    let y = -Math.cos(t) * Hh;
    y += 2.4 * Math.exp(-Math.pow(t / 0.55, 2)); // bottom dimple
    y -= 3.2 * Math.exp(-Math.pow((Math.PI - t) / 0.6, 2)); // top dimple
    pts.push(new THREE.Vector2(x, y));
  }

  const W = 512;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  // Canvas top = apple top (lathe v runs bottom -> top, texture is flipped).
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6e0b16');
  g.addColorStop(0.2, '#a8121f');
  g.addColorStop(0.65, '#c41d27');
  g.addColorStop(0.92, '#cf5a2a');
  g.addColorStop(1, '#d8a040');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  blob(ctx, W * 0.5, H * 0.62, 150, 'rgba(235,190,70,0.35)');

  ctx.lineCap = 'round';
  for (let i = 0; i < 700; i++) {
    const x = rand(0, W);
    const y0 = rand(0, H * 0.8);
    const len = rand(30, 180);
    ctx.strokeStyle = Math.random() < 0.7 ? 'rgba(90,0,12,0.18)' : 'rgba(255,200,90,0.1)';
    ctx.lineWidth = rand(1, 3.5);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + rand(-6, 6), y0 + len / 2, x + rand(-4, 4), y0 + len);
    ctx.stroke();
  }
  for (let i = 0; i < 600; i++) {
    dot(ctx, rand(0, W), rand(H * 0.1, H), rand(0.6, 1.3), 'rgba(255,225,170,0.35)');
  }

  const mat = new THREE.MeshPhysicalMaterial({
    map: colorTexture(c),
    roughness: 0.38,
    clearcoat: 0.6,
    clearcoatRoughness: 0.35,
  });

  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), mat);
  group.add(body);

  const brown = new THREE.MeshStandardMaterial({ color: '#5a3a1c', roughness: 0.9 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 4.2, 8), brown);
  stem.position.set(0.35, 7.3, 0);
  stem.rotation.z = -0.2;
  group.add(stem);

  const leaf = new THREE.Mesh(leafGeometry(6.5, 2.4), leafMaterial());
  leaf.position.set(0.6, 8.4, 0);
  leaf.rotation.order = 'YXZ';
  leaf.rotation.set(-Math.PI / 2 + 0.6, -0.6, 0);
  group.add(leaf);

  group.rotation.z = 0.12;
  return { group, body, radius: 11, juice: '#ffe9a8' };
}

/* -------------------------------- Watermelon ------------------------------- */

// Small seeded 3D value noise, so the rind pattern can be sampled on the
// melon's surface in 3D (no texture seam, no smearing at the ends).
function createNoise3D(seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = rnd();
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const at = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];

  function noise(x, y, z) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const w = fade(z - zi);
    return lerp(
      lerp(lerp(at(xi, yi, zi), at(xi + 1, yi, zi), u), lerp(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), u), lerp(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), u), v),
      w,
    );
  }
  // Fractal noise in 0..1.
  return function fbm(x, y, z, octaves = 3) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x, y, z) * amp;
      norm += amp;
      amp *= 0.5;
      x *= 2.03;
      y *= 2.03;
      z *= 2.03;
    }
    return sum / norm;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Which way is "down" on the body once the melon is laid on its side; the
// pale ground spot and the flattened side go here.
const MELON_TILT = Math.PI / 2 - 0.35;
const MELON_UNDER = new THREE.Vector3(-Math.sin(MELON_TILT), -Math.cos(MELON_TILT), 0);

// Samples a smooth noise field on a coarse grid over the sphere (same layout
// as the texture), returning a bilinear lookup. Much cheaper than evaluating
// slow-changing noise at every texel.
function coarseField(w, h, fn) {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const theta = ((y + 0.5) / h) * Math.PI;
    const st = Math.sin(theta);
    const dy = Math.cos(theta);
    for (let x = 0; x < w; x++) {
      const phi = (x / w) * Math.PI * 2;
      data[y * w + x] = fn(-Math.cos(phi) * st, dy, Math.sin(phi) * st);
    }
  }
  return (u, v) => {
    const fx = u * w;
    const fy = Math.min(h - 1, Math.max(0, v * h - 0.5));
    const x0 = Math.floor(fx) % w;
    const x1 = (x0 + 1) % w; // wraps around the seam
    const y0 = Math.floor(fy);
    const y1 = Math.min(h - 1, y0 + 1);
    const tx = fx - Math.floor(fx);
    const ty = fy - y0;
    const a = data[y0 * w + x0] + (data[y0 * w + x1] - data[y0 * w + x0]) * tx;
    const b = data[y1 * w + x0] + (data[y1 * w + x1] - data[y1 * w + x0]) * tx;
    return a + (b - a) * ty;
  };
}

function watermelonTextures(fbm) {
  // Generated per texel at startup; phones get a smaller texture (it's also
  // smaller on screen there) to keep load time down.
  const small = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const W = small ? 768 : 1024;
  const H = W / 2;
  const [c, ctx] = makeCanvas(W, H);
  const [b, bctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const bump = bctx.createImageData(W, H);
  const px = img.data;
  const bpx = bump.data;
  const stripes = 16;
  const ux = MELON_UNDER.x;
  const uy = MELON_UNDER.y;
  const uz = MELON_UNDER.z;

  // Palette (sRGB 0..255)
  const lightA = [150, 186, 98];
  const lightB = [192, 212, 134];
  const vein = [104, 146, 68];
  const darkA = [24, 54, 22];
  const darkB = [46, 88, 34];
  const ground = [218, 204, 132];
  const scar = [118, 98, 56];
  const stemRing = [86, 104, 52];

  // Slow-changing layers, computed at quarter resolution.
  const CW = W / 4;
  const CH = H / 4;
  const warpF = coarseField(CW, CH, (x, y, z) => (fbm(x * 2.2, y * 2.2, z * 2.2, 2) - 0.5) * 0.1 + (fbm(x * 7 + 9, y * 7, z * 7, 2) - 0.5) * 0.035);
  const mottleF = coarseField(CW, CH, (x, y, z) => fbm(x * 6 + 3, y * 6, z * 6, 2));
  const veinF = coarseField(CW, CH, (x, y, z) => fbm(x * 13 + 5, y * 13, z * 13, 2));
  const groundF = coarseField(CW, CH, (x, y, z) => fbm(x * 5, y * 5 + 4, z * 5, 2));

  const cosPhi = new Float32Array(W);
  const sinPhi = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    cosPhi[x] = Math.cos((x / W) * Math.PI * 2);
    sinPhi[x] = Math.sin((x / W) * Math.PI * 2);
  }
  let seed = 12345;

  for (let y = 0; y < H; y++) {
    // Same mapping as SphereGeometry: canvas top = +Y pole (the stem end).
    const vy = (y + 0.5) / H;
    const theta = ((y + 0.5) / H) * Math.PI;
    const st = Math.sin(theta);
    const dy = Math.cos(theta);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const dx = -cosPhi[x] * st;
      const dz = sinPhi[x] * st;

      // Stripes run stem to blossom; warp them so they wander, then roughen
      // the edges with fine noise so they look feathered and jagged.
      const warp = warpF(u, vy);
      const band = Math.sin((u + warp) * Math.PI * 2 * stripes);
      const fine = fbm(dx * 34, dy * 34, dz * 34, 2);
      let dark = smooth(-0.3, 0.12, band + (fine - 0.5) * 1.1);
      // Near the ends the stripes converge into a mottled blend.
      const end = smooth(0.12, 0.3, st);
      const mottle = mottleF(u, vy);
      dark = dark * end + 0.45 * (1 - end) * (0.6 + mottle * 0.8);

      // Plain scalar mixing (this loop runs half a million times).
      let r = lightA[0] + (lightB[0] - lightA[0]) * mottle;
      let g = lightA[1] + (lightB[1] - lightA[1]) * mottle;
      let bl = lightA[2] + (lightB[2] - lightA[2]) * mottle;
      // Faint veining in the pale bands.
      const v = (1 - smooth(0, 0.035, Math.abs(veinF(u, vy) - 0.5))) * 0.5;
      r += (vein[0] - r) * v;
      g += (vein[1] - g) * v;
      bl += (vein[2] - bl) * v;
      const dk = mottle * 0.9 + fine * 0.2;
      r += (darkA[0] + (darkB[0] - darkA[0]) * dk - r) * dark;
      g += (darkA[1] + (darkB[1] - darkA[1]) * dk - g) * dark;
      bl += (darkA[2] + (darkB[2] - darkA[2]) * dk - bl) * dark;

      // Pale ground spot where it rested in the field.
      const down = dx * ux + dy * uy + dz * uz;
      if (down > 0.35) {
        const t = smooth(0.62, 0.86, down + (groundF(u, vy) - 0.5) * 0.35) * 0.85;
        r += (ground[0] - r) * t;
        g += (ground[1] - g) * t;
        bl += (ground[2] - bl) * t;
      }
      // Little brown blossom scar opposite the stem, and a ring at the stem.
      if (dy < -0.95) {
        const t = smooth(0.975, 0.993, -dy + (fine - 0.5) * 0.01);
        r += (scar[0] - r) * t;
        g += (scar[1] - g) * t;
        bl += (scar[2] - bl) * t;
      }
      if (dy > 0.97) {
        const t = smooth(0.975, 0.995, dy) * 0.7;
        r += (stemRing[0] - r) * t;
        g += (stemRing[1] - g) * t;
        bl += (stemRing[2] - bl) * t;
      }

      seed = (seed * 1103515245 + 12345) & 0x7fffffff; // cheap grain
      const j = (seed / 0x7fffffff - 0.5) * 6;
      const i = (y * W + x) * 4;
      px[i] = r + j;
      px[i + 1] = g + j;
      px[i + 2] = bl + j;
      px[i + 3] = 255;

      const h = 128 + (fine - 0.5) * 70 + (mottle - 0.5) * 40;
      bpx[i] = bpx[i + 1] = bpx[i + 2] = h;
      bpx[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bump, 0, 0);
  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.anisotropy = 4;
  return { map: colorTexture(c), bumpMap };
}

// A unit sphere made slightly lumpy and egg-shaped, flattened where it sat.
function watermelonGeometry(fbm) {
  const geo = new THREE.SphereGeometry(1, 128, 96);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let r = 1 + (fbm(v.x * 1.4 + 11, v.y * 1.4, v.z * 1.4, 2) - 0.5) * 0.07;
    r *= 1 - v.y * 0.035; // a touch fuller toward the blossom end
    const down = v.dot(MELON_UNDER);
    if (down > 0.55) r -= (down - 0.55) * 0.16;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }
  geo.computeVertexNormals();

  // The sphere's seam and poles have duplicate vertices; average their
  // normals so no lighting seam shows.
  const nrm = geo.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  const n = new THREE.Vector3();
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of idx) n.x += nrm.getX(i), n.y += nrm.getY(i), n.z += nrm.getZ(i);
    n.normalize();
    for (const i of idx) nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}

function createWatermelon() {
  const fbm = createNoise3D(7);
  const { map, bumpMap } = watermelonTextures(fbm);
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 1.2,
    roughness: 0.5,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
  });

  const inner = new THREE.Group();
  const body = new THREE.Mesh(watermelonGeometry(fbm), mat);
  body.scale.set(11, 15, 11);
  inner.add(body);

  // Dried, curly stem stub at the top pole.
  const stemMat = new THREE.MeshStandardMaterial({ color: '#6e5a33', roughness: 0.9 });
  const topY = 15 * (1 - 0.035) - 0.15;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.35, 12), stemMat);
  base.position.y = topY;
  inner.add(base);
  const curl = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.1, 0.8, 0.05),
    new THREE.Vector3(0.55, 1.45, 0.2),
    new THREE.Vector3(1.2, 1.6, 0.1),
    new THREE.Vector3(1.6, 1.25, -0.1),
  ]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(curl, 24, 0.22, 8, false), stemMat);
  stem.position.y = topY + 0.1;
  inner.add(stem);

  inner.rotation.z = MELON_TILT;
  const group = new THREE.Group();
  group.add(inner);
  return { group, body, radius: 15, juice: '#ff4d6d' };
}

const BUILDERS = {
  throne: createThrone,
  apple: createApple,
  table: createTable,
  watermelon: createWatermelon,
};

export function createFruit(kind, options = {}) {
  const fruit = BUILDERS[kind](options);
  // holder: position, tap tilt/squash/hop.  pivot: idle sway + tap spin around
  // world Y, regardless of each fruit's own tilt. The label goes on the pivot.
  const holder = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.add(fruit.group);
  holder.add(pivot);
  return { ...fruit, group: holder, pivot };
}
