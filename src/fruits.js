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

function createWatermelon() {
  const W = 1024;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const stripes = 16;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const pole = Math.min(1, Math.min(v, 1 - v) / 0.06);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // Integer frequencies in u keep the texture seamless.
      const wobble = 0.012 * Math.sin(v * Math.PI * 14 + u * Math.PI * 2 * 3) + 0.006 * Math.sin(v * Math.PI * 37 + u * Math.PI * 2 * 7);
      const s = Math.sin((u + wobble) * Math.PI * 2 * stripes) + (Math.random() - 0.5) * 0.45;
      const dark = s > 0.1;
      const j = (Math.random() - 0.5) * 14;
      let r = dark ? 26 : 140;
      let g = dark ? 72 : 190;
      let b = dark ? 30 : 92;
      // Blend toward a mid green at the poles where the stripes pinch.
      r = r * pole + 60 * (1 - pole) + j;
      g = g * pole + 110 * (1 - pole) + j;
      b = b * pole + 50 * (1 - pole) + j;
      const idx = (y * W + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const mat = new THREE.MeshStandardMaterial({ map: colorTexture(c), roughness: 0.42 });

  const inner = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
  body.scale.set(11, 15, 11);
  inner.add(body);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.6, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: '#6b5a2a', roughness: 0.9 }),
  );
  stem.position.y = 15.4;
  inner.add(stem);

  inner.rotation.z = Math.PI / 2 - 0.35;
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
