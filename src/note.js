import * as THREE from 'three';

// A sheet of white paper with a handwritten message, hovering beside an
// object around `home` (in the object's own space). It drifts, tilts and
// ripples a little, and twirls when tapped: meshes are tagged with
// `userData.note` so the owner can route taps to twirl().
export function createNote(text, home) {
  const PW = 10;
  const PH = 7;
  const CW = 1024;
  const CH = Math.round((CW * PH) / PW);
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fdfdf9';
  ctx.fillRect(0, 0, CW, CH);

  // Handwritten-looking text, as big as fits above the arrow doodle.
  const hand = (s) => `700 ${s}px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Chalkboard SE', cursive`;
  const pad = 90;
  const textH = CH - pad * 2 - 110;
  const words = text.split(/\s+/);
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let size = 190; size > 30; size -= 6) {
    ctx.font = hand(size);
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > CW - pad * 2 && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    lines.push(line);
    const lh = size * 1.15;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > CW - pad * 2 || lines.length * lh > textH) continue;
    lines.forEach((l, i) => ctx.fillText(l, CW / 2, pad + textH / 2 + (i - (lines.length - 1) / 2) * lh));
    break;
  }

  // Doodled arrow pointing down-left, toward the object.
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(CW * 0.5, CH - 150);
  ctx.quadraticCurveTo(CW * 0.34, CH - 40, CW * 0.14, CH - 70);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(CW * 0.2, CH - 118);
  ctx.lineTo(CW * 0.14, CH - 70);
  ctx.lineTo(CW * 0.21, CH - 34);
  ctx.stroke();

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  // Written side faces the viewer; the back is blank paper.
  const geo = new THREE.PlaneGeometry(PW, PH, 24, 16);
  const flat = geo.attributes.position.array.slice();
  const front = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map, roughness: 0.9, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.18 }),
  );
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f4f4ee', roughness: 0.9, side: THREE.BackSide }));
  front.userData.note = back.userData.note = true;
  const sheet = new THREE.Group();
  sheet.add(front, back);

  const g = new THREE.Group();
  g.add(sheet);
  g.position.copy(home);

  let twirl = 1; // 0..1 progress of the tap twirl
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  return {
    group: g,
    twirl() {
      if (twirl >= 1) twirl = 0;
    },
    update(time, dt) {
      // Drift around its spot and tilt as if riding a light breeze.
      g.position.set(
        home.x + Math.sin(time * 0.55) * 1.4,
        home.y + Math.sin(time * 0.85 + 1) * 1.0,
        home.z + Math.cos(time * 0.45) * 0.9,
      );
      twirl = Math.min(1, twirl + dt / 0.9);
      sheet.rotation.set(
        Math.sin(time * 0.6 + 2) * 0.1,
        Math.sin(time * 0.5) * 0.3 + ease(twirl) * Math.PI * 2,
        -0.08 + Math.sin(time * 0.7) * 0.12,
      );
      // Ripple the sheet.
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = flat[i * 3];
        const y = flat[i * 3 + 1];
        pos.setZ(i, 0.28 * Math.sin(x * 0.45 + time * 1.7) + 0.16 * Math.sin(y * 0.7 + x * 0.25 + time * 2.4));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}
