import * as THREE from 'three';

// A big sheet of paper with a title and a long letter on it. The text is
// sized automatically to fill the page, so longer letters get smaller type.
// The sheet has faint fold creases (as if it had been folded in thirds) and
// barely ripples, so it stays readable; tapping it makes it flutter.

const PAGE_W = 22;
const PAGE_H = 30;
const CANVAS_W = 1448;
const CANVAS_H = Math.round((CANVAS_W * PAGE_H) / PAGE_W);
const MARGIN = 120;
const SERIF = "Georgia, 'Times New Roman', serif";

const rand = (a, b) => a + Math.random() * (b - a);

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Lays the title and paragraphs out at a given body size; returns the draw
// list and total height, or null if a single word is too wide.
function layout(ctx, title, paragraphs, size) {
  const width = CANVAS_W - MARGIN * 2;
  const items = [];
  let y = 0;

  const titleSize = size * 1.75;
  ctx.font = `700 ${titleSize}px ${SERIF}`;
  for (const l of wrap(ctx, title, width)) {
    if (ctx.measureText(l).width > width) return null;
    items.push({ text: l, y: y + titleSize * 0.85, font: ctx.font, center: true });
    y += titleSize * 1.15;
  }
  const ruleY = y + size * 0.35;
  y += size * 1.3;

  ctx.font = `400 ${size}px ${SERIF}`;
  const lh = size * 1.42;
  for (const p of paragraphs) {
    for (const l of wrap(ctx, p, width)) {
      if (ctx.measureText(l).width > width) return null;
      items.push({ text: l, y: y + size * 0.85, font: ctx.font });
      y += lh;
    }
    y += lh * 0.55; // paragraph gap
  }
  return { items, height: y - lh * 0.55, ruleY };
}

function pageTexture(title, text) {
  const c = document.createElement('canvas');
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  const ctx = c.getContext('2d');

  // Slightly warm paper with faint fibres.
  ctx.fillStyle = '#fbfaf4';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.lineWidth = 1;
  for (let i = 0; i < 1800; i++) {
    const x = rand(0, CANVAS_W);
    const y = rand(0, CANVAS_H);
    ctx.strokeStyle = `rgba(120,110,90,${rand(0.02, 0.06)})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand(-14, 14), y + rand(-14, 14));
    ctx.stroke();
  }
  // Fold creases at one and two thirds: a light edge above a shadowed one.
  for (const f of [1 / 3, 2 / 3]) {
    const y = CANVAS_H * f;
    const g = ctx.createLinearGradient(0, y - 14, 0, y + 14);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.55, 'rgba(60,50,40,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 14, CANVAS_W, 28);
  }

  // Biggest body size at which everything fits.
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const available = CANVAS_H - MARGIN * 2;
  let best = null;
  for (let size = 96; size >= 18; size -= 2) {
    const l = layout(ctx, title, paragraphs, size);
    if (l && l.height <= available) {
      best = l;
      break;
    }
  }
  if (best) {
    // Start a little above centre if there's room to spare.
    const top = MARGIN + Math.max(0, (available - best.height) * 0.35);
    ctx.fillStyle = '#141414';
    ctx.textBaseline = 'alphabetic';
    for (const it of best.items) {
      ctx.font = it.font;
      ctx.textAlign = it.center ? 'center' : 'left';
      ctx.fillText(it.text, it.center ? CANVAS_W / 2 : MARGIN, top + it.y);
    }
    ctx.fillRect(CANVAS_W / 2 - 110, top + best.ruleY, 220, 3);
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 16;
  return map;
}

export function createLetter({ content }) {
  const map = pageTexture(content.title, content.text);

  const geo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 20, 36);
  const flat = geo.attributes.position.array.slice();
  // Written side faces the viewer; the back is blank paper.
  const front = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map, roughness: 0.92, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.22 }),
  );
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f1f0e8', roughness: 0.92, side: THREE.BackSide }));
  const group = new THREE.Group();
  group.add(front, back);
  group.rotation.z = -0.02;

  let flutter = 0; // 1 right after a tap, decaying to 0

  function shape(time) {
    const pos = geo.attributes.position;
    const amp = 1 + flutter * 7;
    for (let i = 0; i < pos.count; i++) {
      const x = flat[i * 3];
      const y = flat[i * 3 + 1];
      // Zigzag left over from being folded in thirds...
      const v = y / PAGE_H + 0.5;
      const fold = 0.4 * (Math.abs(((v * 3) % 2) - 1) - 0.5);
      // ...plus a slow, shallow ripple.
      const ripple = 0.07 * Math.sin(x * 0.3 + time * 1.2) + 0.05 * Math.sin(y * 0.25 + x * 0.1 + time * 0.9);
      pos.setZ(i, fold + ripple * amp);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  shape(0);

  return {
    group,
    radius: 15, // used for flight paths and how far the motes spread
    extent: { w: PAGE_W, h: PAGE_H }, // framed by its real size, to fill the screen
    sway: 0.2, // barely sways, so the text stays readable
    juice: '#ffffff',
    labelled: false,
    // Tapping makes the sheet flutter instead of the usual wobble and juice.
    onTap() {
      flutter = 1;
      return true;
    },
    update(time, dt) {
      flutter = Math.max(0, flutter - dt * 0.9);
      shape(time);
    },
  };
}
