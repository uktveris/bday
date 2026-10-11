import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

// Prints a title + message onto the front of a fruit as a decal. Lines are
// wrapped to the fruit's actual silhouette (from its vertices), so text
// narrows toward the top and bottom of round fruit and follows their shape.

const CANVAS = 1024;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function addLabel(fruit, { title, text }) {
  const { group, body } = fruit;
  group.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(body);
  const size = box.getSize(new THREE.Vector3());
  const S = Math.max(size.x, size.y); // decal is square, covers the whole silhouette

  const chord = silhouette(body, box);
  const midX = (box.min.x + box.max.x) / 2;

  // Centre the text block on the "visual mass" of the silhouette.
  let sumW = 0;
  let sumWY = 0;
  for (let i = 1; i < 24; i++) {
    const y = box.min.y + (size.y * i) / 24;
    const c = chord(y);
    if (!c) continue;
    const w = c[1] - c[0];
    sumW += w;
    sumWY += w * y;
  }
  const centerY = sumW > 0 ? sumWY / sumW : (box.min.y + box.max.y) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CANVAS;
  const ctx = canvas.getContext('2d');
  const toPx = CANVAS / S;

  const layout = fitText(ctx, { title, text, S, toPx, chord, centerY, maxHeight: size.y * 0.72 });
  drawText(ctx, layout, { S, toPx, cx: midX, cy: centerY });

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const raycaster = new THREE.Raycaster(new THREE.Vector3(midX, centerY, box.max.z + 10), new THREE.Vector3(0, 0, -1));
  const frontHit = raycaster.intersectObject(body, false)[0];
  const point = frontHit ? frontHit.point : new THREE.Vector3(midX, centerY, box.max.z);
  // The canvas centre maps to the projector centre, i.e. (midX, centerY).
  const depth = Math.min(size.z, S) * 0.75;
  const geo = new DecalGeometry(body, point, new THREE.Euler(0, 0, 0), new THREE.Vector3(S, S, depth));

  // Lift the decal slightly off the surface.
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const lift = 0.05;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * lift, pos.getY(i) + nrm.getY(i) * lift, pos.getZ(i) + nrm.getZ(i) * lift);
  }

  const mat = new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: 0.45,
    emissive: '#ffffff',
    emissiveMap: map,
    emissiveIntensity: 0.45,
  });
  const decal = new THREE.Mesh(geo, mat);
  decal.renderOrder = 1;
  (fruit.pivot ?? group).add(decal);
  return decal;
}

// Front-view outline of a mesh: bins its world-space vertices by height and
// returns chord(y) -> [minX, maxX], or null outside the shape.
function silhouette(mesh, box) {
  const BINS = 48;
  const minX = new Float32Array(BINS).fill(Infinity);
  const maxX = new Float32Array(BINS).fill(-Infinity);
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  const h = box.max.y - box.min.y;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const b = Math.min(BINS - 1, Math.floor(((v.y - box.min.y) / h) * BINS));
    if (v.x < minX[b]) minX[b] = v.x;
    if (v.x > maxX[b]) maxX[b] = v.x;
  }
  // Fill empty bins from their neighbours.
  for (let b = 0; b < BINS; b++) {
    if (minX[b] !== Infinity) continue;
    const prev = b > 0 ? b - 1 : b + 1;
    minX[b] = minX[prev];
    maxX[b] = maxX[prev];
  }
  return (y) => {
    const f = ((y - box.min.y) / h) * BINS - 0.5;
    if (f < 0 || f > BINS - 1) return null;
    const i = Math.floor(f);
    const j = Math.min(BINS - 1, i + 1);
    const t = f - i;
    return [minX[i] + (minX[j] - minX[i]) * t, maxX[i] + (maxX[j] - maxX[i]) * t];
  };
}

function wrapLines(ctx, words, fontPx, lineH, startTop, { toPx, chord }) {
  ctx.font = fontPx;
  const lines = [];
  let i = 0;
  let top = startTop;
  while (i < words.length) {
    const c1 = chord(top);
    const c2 = chord(top - lineH);
    if (!c1 || !c2) return null; // ran off the fruit
    const x0 = Math.max(c1[0], c2[0]);
    const x1 = Math.min(c1[1], c2[1]);
    const maxW = (x1 - x0) * 0.84 * toPx;
    let line = words[i];
    if (ctx.measureText(line).width > maxW) return null; // a single word doesn't fit
    i++;
    while (i < words.length && ctx.measureText(`${line} ${words[i]}`).width <= maxW) {
      line += ` ${words[i]}`;
      i++;
    }
    lines.push({ text: line, mid: (x0 + x1) / 2, baseline: top - lineH * 0.78 });
    top -= lineH;
  }
  return { lines, bottom: top };
}

function fitText(ctx, { title, text, S, toPx, chord, centerY, maxHeight }) {
  const titleWords = title.split(/\s+/);
  const bodyWords = text.split(/\s+/);

  for (let scale = 1; scale > 0.3; scale *= 0.92) {
    const titleSize = S * 0.105 * scale;
    const bodySize = S * 0.056 * scale;
    const titleLH = titleSize * 1.12;
    const bodyLH = bodySize * 1.38;
    const gap = bodySize * 0.7;
    const titleFont = `800 ${titleSize * toPx}px ${FONT}`;
    const bodyFont = `600 ${bodySize * toPx}px ${FONT}`;

    // Block height depends on line count, which depends on where the block
    // sits; iterate a few times to settle.
    let height = titleLH + gap + bodyLH * 3;
    let result = null;
    for (let iter = 0; iter < 5; iter++) {
      const top = centerY + height / 2;
      const t = wrapLines(ctx, titleWords, titleFont, titleLH, top, { toPx, chord });
      if (!t) break;
      const b = wrapLines(ctx, bodyWords, bodyFont, bodyLH, t.bottom - gap, { toPx, chord });
      if (!b) break;
      const newHeight = top - b.bottom;
      result = { title: t.lines, body: b.lines, titleFont, bodyFont, titleSize, bodySize, height: newHeight };
      if (Math.abs(newHeight - height) < 1e-3) break;
      height = newHeight;
    }
    if (result && result.height <= maxHeight) return result;
  }
  return { title: [], body: [], titleFont: '', bodyFont: '' };
}

function drawText(ctx, layout, { S, toPx, cx, cy }) {
  const px = (x) => (x - cx) * toPx + CANVAS / 2;
  const py = (y) => CANVAS / 2 - (y - cy) * toPx;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  const draw = (lines, font, sizeWorld) => {
    ctx.font = font;
    const sizePx = sizeWorld * toPx;
    for (const l of lines) {
      const x = px(l.mid);
      const y = py(l.baseline);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = sizePx * 0.35;
      ctx.lineWidth = sizePx * 0.16;
      ctx.strokeStyle = 'rgba(35,8,12,0.6)';
      ctx.strokeText(l.text, x, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fffaf2';
      ctx.fillText(l.text, x, y);
    }
  };
  draw(layout.title, layout.titleFont, layout.titleSize ?? S * 0.1);
  draw(layout.body, layout.bodyFont, layout.bodySize ?? S * 0.05);
}
