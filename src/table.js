import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  canvasTexture,
  createSparkles,
  crystalPoints,
  gemField,
  paddedSurface,
  richMaterials,
  softDot,
  studs,
} from './bling.js';
import { createNote } from './note.js';

// A simple square coffee table (four legs, an apron plank between each pair),
// done up Juicy-style: pink-stained lacquered wood, gold trim, crystal
// lettering on every apron and a curtained glass case with a book on top,
// standing on a square dark stone platform. A violet puddle light under the
// top projects a glowing message onto the platform, like a car-door logo light.

const PLATFORM = 32; // square platform side
const TOP_W = 23;
const TOP_D = 21;
const TOP_T = 1.6;
const LEG = 2;
const LEG_H = 17;
const APRON_H = 4;
const APRON_T = 0.8;
const LIGHT_COLOR = '#9b5cff'; // puddle light (violet)
// The platform, table and light all turn together like a turntable.
const SPIN_SPEED = 0.15; // rad/s: one full turn every ~42 s, so every apron gets shown
const START_ANGLE = -0.7; // a corner and two aprons face the viewer at first

const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------ Wood and stone ------------------------------ */

// Pink-stained wood grain, running along the texture's U axis. With several
// planks, each board gets its own figure and tone, with a glue line between.
// Returns a colour map and a matching bump map (the grain is slightly open).
function woodTextures(planks) {
  const W = 1024;
  const H = 512;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')];
  };
  const [color, ctx] = make();
  const [bump, bctx] = make();
  ctx.fillStyle = '#f2609f';
  ctx.fillRect(0, 0, W, H);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, W, H);

  // Draws the same stroke on both maps: stain-dark on colour, recessed on bump.
  const stroke = (alpha, width, path) => {
    for (const [c, style] of [[ctx, `rgba(150,25,85,${alpha})`], [bctx, `rgba(30,30,30,${Math.min(1, alpha * 1.3)})`]]) {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.beginPath();
      path(c);
      c.stroke();
    }
  };

  const ph = H / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    for (const c of [ctx, bctx]) {
      c.save();
      c.beginPath();
      c.rect(0, y0, W, ph);
      c.clip();
    }
    // Each board is a slightly different shade.
    const tone = rand(-1, 1);
    ctx.fillStyle = tone > 0 ? `rgba(255,225,238,${tone * 0.16})` : `rgba(140,20,80,${-tone * 0.13})`;
    ctx.fillRect(0, y0, W, ph);

    // "Cathedral" figure: nested, stretched ovals where the cut crosses the rings.
    const cx = rand(0.1, 0.9) * W;
    const cy = y0 + rand(0.3, 0.7) * ph;
    const step = rand(35, 60);
    for (let k = 1; k <= 9; k++) {
      stroke(rand(0.1, 0.2), rand(0.8, 2), (c) => c.ellipse(cx, cy, k * step, k * ph * 0.055, 0, 0, Math.PI * 2));
    }
    // Long, gently wandering grain lines.
    for (let i = 0, n = Math.max(16, ph / 2.2); i < n; i++) {
      const y = y0 + rand(0, ph);
      const amp = rand(1, 5);
      const wl = rand(300, 900);
      const phase = rand(0, 6.28);
      stroke(rand(0.06, 0.26), rand(0.5, 2), (c) => {
        c.moveTo(0, y + amp * Math.sin(phase));
        for (let x = 24; x <= W; x += 24) c.lineTo(x, y + amp * Math.sin((x / wl) * 6.28 + phase));
      });
    }
    // Pores: short dashes along the grain.
    for (let i = 0, n = ph * 2.5; i < n; i++) {
      const x = rand(0, W);
      const y = y0 + rand(0, ph);
      const len = rand(4, 16);
      stroke(0.22, 0.8, (c) => {
        c.moveTo(x, y);
        c.lineTo(x + len, y);
      });
    }
    for (const c of [ctx, bctx]) c.restore();
    // Glue line between boards.
    if (p > 0) {
      stroke(0.55, 1.6, (c) => {
        c.moveTo(0, y0);
        c.lineTo(W, y0);
      });
    }
  }

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump);
  for (const t of [map, bumpMap]) {
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, bumpMap };
}

// Lacquered wood using (a window of) a grain texture. `along` picks which
// way the grain runs across a box face: 'u' (horizontal) or 'v' (vertical).
function woodMaterial(tex, envMap, { across = 1, along = 'u', shift = 0 } = {}) {
  const maps = [tex.map.clone(), tex.bumpMap.clone()];
  for (const t of maps) {
    t.center.set(0.5, 0.5);
    if (along === 'v') {
      t.rotation = Math.PI / 2;
      t.repeat.set(across, 1);
    } else {
      t.repeat.set(1, across);
    }
    t.offset.set(0, shift);
    t.needsUpdate = true;
  }
  return new THREE.MeshPhysicalMaterial({
    map: maps[0],
    bumpMap: maps[1],
    bumpScale: 0.35,
    roughness: 0.42,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
    envMap,
    envMapIntensity: 0.7,
  });
}

// Polished, very dark grey stone with a fine speckle.
function stoneMaterial(envMap) {
  const map = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#17171a';
    ctx.fillRect(0, 0, s, s);
    const tones = ['rgba(52,52,58,0.7)', 'rgba(6,6,8,0.8)', 'rgba(78,78,86,0.5)'];
    for (let i = 0; i < 7000; i++) softDot(ctx, rand(0, s), rand(0, s), rand(0.8, 2.4), tones[(Math.random() * 3) | 0]);
  }, true);
  map.repeat.set(2, 2);
  const roughnessMap = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#909090';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) softDot(ctx, rand(0, s), rand(0, s), rand(10, 50), Math.random() < 0.5 ? 'rgba(60,60,60,0.4)' : 'rgba(220,220,220,0.35)');
  });
  return new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: 0.55, envMap, envMapIntensity: 0.7 });
}

function puddleTexture(text) {
  const W = 1024;
  const H = 384;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Soft elliptical pool of light.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, H / W);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W / 2);
  g.addColorStop(0, 'rgba(165,110,255,0.55)');
  g.addColorStop(0.55, 'rgba(135,70,255,0.22)');
  g.addColorStop(1, 'rgba(120,50,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-W / 2, -W / 2, W, W);
  ctx.restore();

  // The projected lettering, with a glow.
  let size = 170;
  const font = (s) => `italic 900 ${s}px Georgia, 'Times New Roman', serif`;
  ctx.font = font(size);
  size = Math.min(size, (size * W * 0.78) / ctx.measureText(text).width);
  ctx.font = font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(150,90,255,1)';
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = 'rgba(232,220,255,1)';
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = size * 0.1;
  ctx.fillText(text, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(LIGHT_COLOR) } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying float vFacing;
      void main() {
        vH = uv.y; // 1 at the projector, 0 at the platform
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vH;
      varying float vFacing;
      void main() {
        float a = mix(0.04, 0.28, vH) * pow(vFacing, 1.5);
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/* -------------------------------- Display case ------------------------------- */

// Cover art for the book: gold-foil title + border on black. Returns a colour
// map and a matching metalness mask, so only the foil reflects like metal.
function coverTextures(title, aspect) {
  // Laid out on a 512-wide grid, drawn at twice that so the title stays crisp.
  const SCALE = 2;
  const W = 512;
  const H = Math.round(W * aspect);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W * SCALE;
    c.height = H * SCALE;
    const ctx = c.getContext('2d');
    ctx.scale(SCALE, SCALE);
    return [c, ctx];
  };
  const [color, cctx] = make();
  const [metal, mctx] = make();
  cctx.fillStyle = '#0b0b0c';
  cctx.fillRect(0, 0, W, H);
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, W, H);

  const foil = (ctx, fill) => {
    ctx.strokeStyle = fill;
    ctx.fillStyle = fill;
    ctx.lineWidth = 6;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    // Metal corner pieces.
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sx * 62, y);
      ctx.lineTo(x, y + sy * 62);
      ctx.closePath();
      ctx.fill();
    }

    // Wrap the title to fit, largest size first.
    const words = title.split(/\s+/);
    for (let size = 110; size > 20; size -= 4) {
      ctx.font = `italic 900 ${size}px Georgia, 'Times New Roman', serif`;
      const lines = [];
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > W - 120 && line) {
          lines.push(line);
          line = w;
        } else line = next;
      }
      lines.push(line);
      const lh = size * 1.12;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (widest > W - 120 || lines.length * lh > H * 0.6) continue;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
      break;
    }
  };
  foil(cctx, '#f2c96b');
  foil(mctx, '#fff');

  // The cover is seen at a shallow angle, so use strong anisotropic filtering.
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 16;
  const metalnessMap = new THREE.CanvasTexture(metal);
  metalnessMap.anisotropy = 16;
  return { map, metalnessMap };
}

function book(title, envMap, gold) {
  const W = 6.4; // across the cover
  const D = 8.6; // top to bottom of the cover
  const T = 1.3; // thickness
  const board = 0.14;
  const g = new THREE.Group();

  // Black leather: a fine pebbled grain.
  const grain = canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const v = Math.random() < 0.5 ? 50 : 205;
      softDot(ctx, rand(0, s), rand(0, s), rand(1.5, 3.5), `rgba(${v},${v},${v},0.55)`);
    }
  });
  grain.repeat.set(3, 4);
  const black = new THREE.MeshStandardMaterial({
    color: '#0d0d0f',
    roughness: 0.6,
    bumpMap: grain,
    bumpScale: 0.5,
    envMap,
    envMapIntensity: 0.5,
  });
  const { map, metalnessMap } = coverTextures(title, D / W);
  const front = new THREE.MeshStandardMaterial({
    map,
    metalnessMap,
    metalness: 1,
    roughness: 0.42,
    bumpMap: grain,
    bumpScale: 0.5,
    envMap,
    envMapIntensity: 1.2,
  });

  // BoxGeometry faces: +x, -x, +y, -y, +z, -z. The cover art goes on +y,
  // whose texture "up" points to -z, so the title reads from the front.
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, board, D), [black, black, front, black, black, black]);
  top.position.y = T / 2 - board / 2;
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, board, D), black);
  bottom.position.y = -T / 2 + board / 2;

  // Page block with gilt edges: fine lines where the pages stack.
  const leaves = canvasTexture(64, (ctx, s) => {
    for (let y = 0; y < s; y++) {
      const v = y % 4 < 2 ? 150 + rand(-20, 20) : 95 + rand(-20, 20);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, s, 1);
    }
  });
  leaves.repeat.set(1, 3);
  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.35, T - board * 2, D - 0.3),
    new THREE.MeshStandardMaterial({
      color: '#dcb65e',
      metalness: 0.85,
      roughness: 0.45,
      bumpMap: leaves,
      bumpScale: 0.6,
      envMap,
      envMapIntensity: 1,
    }),
  );
  pages.position.x = 0.1;
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(T / 2, T / 2, D, 20, 1, false, Math.PI, Math.PI), black);
  spine.rotation.x = Math.PI / 2;
  spine.position.x = -W / 2 + 0.05;
  g.add(top, bottom, pages, spine);

  // Raised gold bands across the spine.
  for (const z of [-D / 2 + 0.9, -D / 6, D / 6, D / 2 - 0.9]) {
    const bandGeo = new THREE.CylinderGeometry(T / 2 + 0.03, T / 2 + 0.03, 0.16, 20, 1, true, Math.PI, Math.PI);
    const band = new THREE.Mesh(bandGeo, gold);
    band.rotation.x = Math.PI / 2;
    band.position.set(-W / 2 + 0.05, 0, z);
    g.add(band);
  }

  // Satin ribbon marker trailing out of the bottom edge onto the cushion.
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.025, 1.9),
    new THREE.MeshStandardMaterial({ color: '#ff4f9a', roughness: 0.35, envMap, envMapIntensity: 0.6 }),
  );
  ribbon.position.set(1.1, -0.28, D / 2 + 0.55);
  ribbon.rotation.x = 0.42;
  g.add(ribbon);
  return g;
}

/* ---------------------------------- Curtains --------------------------------- */

const CURTAIN_SEG_X = 48;
const CURTAIN_SEG_Y = 12;
const CURTAIN_PLEATS = 6; // folds per half-panel when closed

// Lays out one half-panel. It hangs from its corner (x = 0) toward the middle
// (x = +L/2). `open` 0..1 gathers it into the corner, cinched at the waist
// like a tie-back, with deeper folds as the cloth bunches up.
function layoutHalfCurtain(geo, L, height, open) {
  const pos = geo.attributes.position;
  const { u, v } = geo.userData;
  const half = L / 2;
  for (let i = 0; i < pos.count; i++) {
    const waist = 1 - open * 0.45 * Math.exp(-(((v[i] - 0.38) / 0.16) ** 2));
    const span = half * (1 - open * 0.8) * waist;
    const amp = 0.18 + open * 0.75;
    const fold = 0.5 - 0.5 * Math.cos(u[i] * Math.PI * 2 * CURTAIN_PLEATS);
    // A little hem flare at the bottom when closed.
    const flare = (1 - open) * (1 - v[i]) * 0.15;
    pos.setXYZ(i, u[i] * span, v[i] * height, amp * fold + flare);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function halfCurtainGeometry() {
  const geo = new THREE.PlaneGeometry(1, 1, CURTAIN_SEG_X, CURTAIN_SEG_Y);
  const pos = geo.attributes.position;
  const u = new Float32Array(pos.count);
  const v = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    u[i] = pos.getX(i) + 0.5;
    v[i] = pos.getY(i) + 0.5;
  }
  geo.userData = { u, v };
  return geo;
}

// Draped canopy around the glass case: two half-curtains per side on a gold
// rail, under a puffy velour roof. Tap to open/close (see toggle()).
function createCurtains(mat, { W, D, bottom, top }) {
  const g = new THREE.Group();
  const gap = 0.35; // clearance from the glass
  const height = top - bottom;
  // Velvet with a gold band and line woven in near the hem.
  const cloth = mat.velourDeep.clone();
  cloth.color.set('#ffffff');
  cloth.map = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#e33d86';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 50; i++) {
      softDot(ctx, rand(0, s), rand(0, s), rand(20, 60), Math.random() < 0.6 ? 'rgba(150,25,85,0.2)' : 'rgba(255,150,200,0.2)');
    }
    ctx.fillStyle = '#e9c063';
    ctx.fillRect(0, s * 0.925, s, s * 0.045);
    ctx.fillRect(0, s * 0.895, s, s * 0.012);
  }, true);
  cloth.side = THREE.DoubleSide;

  const halves = [];
  const sides = [
    { L: W + 2 * gap, dist: D / 2 + gap, rot: 0 },
    { L: D + 2 * gap, dist: W / 2 + gap, rot: Math.PI / 2 },
    { L: W + 2 * gap, dist: D / 2 + gap, rot: Math.PI },
    { L: D + 2 * gap, dist: W / 2 + gap, rot: -Math.PI / 2 },
  ];
  for (const s of sides) {
    const side = new THREE.Group();
    side.rotation.y = s.rot;
    side.position.set(Math.sin(s.rot) * s.dist, bottom, Math.cos(s.rot) * s.dist);
    for (const dir of [1, -1]) {
      const geo = halfCurtainGeometry();
      layoutHalfCurtain(geo, s.L, height, 0);
      const mesh = new THREE.Mesh(geo, cloth);
      mesh.position.x = (-dir * s.L) / 2; // hang from this side's corner
      mesh.scale.x = dir; // mirror the right-hand half
      mesh.userData.toggleCurtains = true;
      side.add(mesh);
      halves.push({ geo, L: s.L });
    }
    g.add(side);
  }

  // Gold rail, then the lid: puffy roof, trim, corner finials and a crystal.
  // The lid flies off when the curtains open and lands back when they close.
  const lid = new THREE.Group();
  g.add(lid);
  const rw = W + 2 * gap;
  const rd = D + 2 * gap;
  for (const [len, x, z, ry] of [
    [rw, 0, rd / 2, 0],
    [rw, 0, -rd / 2, 0],
    [rd, rw / 2, 0, Math.PI / 2],
    [rd, -rw / 2, 0, Math.PI / 2],
  ]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 8), mat.gold);
    rail.rotation.set(0, ry, Math.PI / 2);
    rail.position.set(x, top, z);
    g.add(rail);
  }
  const finialGeo = new THREE.SphereGeometry(0.4, 14, 10);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const f = new THREE.Mesh(finialGeo, mat.gold);
    f.position.set((x * rw) / 2, top + 1.05, (z * rd) / 2);
    lid.add(f);
  }
  const roof = new THREE.Mesh(new RoundedBoxGeometry(rw + 0.5, 1.4, rd + 0.5, 5, 0.6), mat.velour);
  roof.position.y = top + 0.3;
  roof.userData.toggleCurtains = true;
  lid.add(roof);
  const roofTrim = new THREE.Mesh(new RoundedBoxGeometry(rw + 0.75, 0.22, rd + 0.75, 2, 0.1), mat.gold);
  roofTrim.position.y = top - 0.35;
  lid.add(roofTrim);
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), mat.crystal);
  jewel.position.y = top + 1.6;
  jewel.scale.y = 1.4;
  lid.add(jewel);

  let open = 0;
  let from = 0;
  let to = 0;
  let t = 1;
  const DURATION = 1.8;
  const LID_FLIGHT = 45; // how far up the lid flies (out of view)
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  return {
    group: g,
    toggle() {
      from = open;
      to = to > 0.5 ? 0 : 1;
      t = 0;
    },
    update(dt) {
      if (t >= 1) return;
      t = Math.min(1, t + dt / DURATION);
      open = from + (to - from) * ease(t);
      for (const h of halves) layoutHalfCurtain(h.geo, h.L, height, open);

      // The lid leaves early in the opening and arrives late in the closing,
      // so it's off before the curtains part and back after they meet.
      const p = Math.min(1, open * 1.25);
      lid.position.y = LID_FLIGHT * Math.pow(p, 2.2);
      lid.rotation.y = p * Math.PI * 2;
      lid.rotation.z = Math.sin(p * Math.PI) * 0.25;
      lid.visible = p < 0.999;
    },
  };
}

// A gold-framed glass case on a gold plinth, holding a book on a cushion,
// hidden behind tap-to-open curtains.
function displayCase(mat, envMap, title) {
  const g = new THREE.Group();
  const W = 12;
  const H = 6.5;
  const D = 10.5;
  const plinthH = 0.9;

  // Stepped plinth with a row of beading on the ledge.
  const lower = new THREE.Mesh(new RoundedBoxGeometry(W + 1.8, 0.45, D + 1.8, 2, 0.15), mat.gold);
  lower.position.y = 0.225;
  const upper = new THREE.Mesh(new RoundedBoxGeometry(W + 0.8, 0.45, D + 0.8, 2, 0.15), mat.gold);
  upper.position.y = 0.675;
  g.add(lower, upper);
  const beads = [];
  const bx = (W + 1.3) / 2;
  const bz = (D + 1.3) / 2;
  for (let x = -bx; x <= bx + 0.01; x += (2 * bx) / 26) beads.push(new THREE.Vector3(x, 0.5, bz), new THREE.Vector3(x, 0.5, -bz));
  for (let z = -bz; z <= bz + 0.01; z += (2 * bz) / 22) beads.push(new THREE.Vector3(bx, 0.5, z), new THREE.Vector3(-bx, 0.5, z));
  g.add(studs(beads, 0.17, mat.gold));

  // Velvet pillow: fat in the middle, pinched to a seam at the edges and
  // corners, pressed flat where the book lies. Built as a top half and a
  // flatter bottom half meeting at the piped seam.
  const PW = 9;
  const PD = 9.2;
  const PT = 0.95;
  const BOOK_REST = 0.78; // height the book presses the pillow down to
  const pillowHeight = (x, y) => {
    const h = PT * Math.sqrt(Math.max(0, (1 - Math.abs((2 * x) / PW) ** 2.4) * (1 - Math.abs((2 * y) / PD) ** 2.4)));
    return Math.abs(x) < 3.2 && Math.abs(y) < 4.3 ? Math.min(h, BOOK_REST) : h;
  };
  const pillowGeo = paddedSurface(44, 44, (u, v) => [(u - 0.5) * PW, (v - 0.5) * PD], pillowHeight);
  const rest = new THREE.Group();
  rest.position.y = plinthH + PT * 0.5;
  for (const flip of [1, -0.5]) {
    const half = new THREE.Mesh(pillowGeo, mat.velour);
    half.rotation.x = -Math.PI / 2; // (x, y, height) -> (x, height, -y)
    half.scale.z = flip; // local z is the height: mirror and flatten the underside
    rest.add(half);
  }
  const seam = [];
  for (let x = -PW / 2; x < PW / 2; x += 0.75) seam.push(new THREE.Vector3(x, 0, PD / 2));
  for (let z = PD / 2; z > -PD / 2; z -= 0.75) seam.push(new THREE.Vector3(PW / 2, 0, z));
  for (let x = PW / 2; x > -PW / 2; x -= 0.75) seam.push(new THREE.Vector3(x, 0, -PD / 2));
  for (let z = -PD / 2; z < PD / 2; z += 0.75) seam.push(new THREE.Vector3(-PW / 2, 0, z));
  rest.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam, true, 'catmullrom', 0.1), 160, 0.1, 8, true), mat.gold));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 10), mat.gold);
    tassel.position.set((x * PW) / 2, -0.3, (z * PD) / 2);
    tassel.rotation.z = Math.PI;
    rest.add(tassel);
  }
  const b = book(title, envMap, mat.gold);
  b.position.y = BOOK_REST + 0.65; // resting on the pressed-down patch
  b.rotation.y = 0.08;
  rest.add(b);
  g.add(rest);

  // Real glass: it transmits what's behind it and picks up reflections.
  // Thin-walled (thickness 0) and perfectly smooth on purpose: any thickness
  // bends the view through each pane (the top looked sunk below the walls),
  // and any roughness blurs what's inside (the book title).
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshPhysicalMaterial({
      color: '#f3fffb', // the faintest green tint
      metalness: 0,
      roughness: 0,
      transmission: 1,
      thickness: 0,
      ior: 1.5,
      envMap,
      envMapIntensity: 1.4,
    }),
  );
  glass.position.y = plinthH + H / 2;
  g.add(glass);

  // Gold frame along the glass edges.
  const e = 0.06; // bar thickness
  const edges = [
    ...[-1, 1].flatMap((sy) => [-1, 1].map((sz) => [W, e, e, 0, sy * H / 2, sz * D / 2])),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [e, H, e, sx * W / 2, 0, sz * D / 2])),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sy) => [e, e, D, sx * W / 2, sy * H / 2, 0])),
  ];
  for (const [w, h, d, x, y, z] of edges) {
    // Long side gets +e so neighbouring bars meet cleanly at the corners.
    const len = (v) => (v > e ? v + e : e);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len(w), len(h), len(d)), mat.gold);
    bar.position.set(x, plinthH + H / 2 + y, z);
    g.add(bar);
  }

  const curtains = createCurtains(mat, { W, D, bottom: plinthH + 0.05, top: plinthH + H + 1.2 });
  g.add(curtains.group);
  return { group: g, curtains };
}

export function createTable({ content, envMap }) {
  const mat = richMaterials(envMap);
  const scene = new THREE.Group();

  // Very dark grey stone platform with gold trim; its top sits at y = 0.
  const platform = new THREE.Mesh(new RoundedBoxGeometry(PLATFORM, 2, PLATFORM, 3, 0.6), stoneMaterial(envMap));
  platform.position.y = -1;
  scene.add(platform);
  const trim = new THREE.Mesh(new RoundedBoxGeometry(PLATFORM + 0.5, 0.5, PLATFORM + 0.5, 2, 0.25), mat.gold);
  trim.position.y = -0.35;
  scene.add(trim);

  // The table, centred on the platform.
  const table = new THREE.Group();
  scene.add(table);

  // Top: five boards glued up side by side, grain running along the length.
  // (Box faces are +x, -x, +y, -y, +z, -z; the edges show plain long grain.)
  const boards = woodTextures(5);
  const grain = woodTextures(1);
  const topWood = woodMaterial(boards, envMap);
  const edgeWood = woodMaterial(grain, envMap, { across: 0.1 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(TOP_W, TOP_T, TOP_D, 3, 0.25), [
    edgeWood,
    edgeWood,
    topWood,
    topWood,
    edgeWood,
    edgeWood,
  ]);
  top.position.y = LEG_H + TOP_T / 2;
  table.add(top);
  const band = new THREE.Mesh(new RoundedBoxGeometry(TOP_W + 0.25, 0.45, TOP_D + 0.25, 2, 0.2), mat.gold);
  band.position.y = LEG_H + TOP_T / 2;
  table.add(band);

  const lx = TOP_W / 2 - 1.6 - LEG / 2;
  const lz = TOP_D / 2 - 1.6 - LEG / 2;
  const legGeo = new RoundedBoxGeometry(LEG, LEG_H, LEG, 2, 0.15);
  const footGeo = new RoundedBoxGeometry(LEG + 0.35, 1.3, LEG + 0.35, 2, 0.2);
  for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
    // Grain runs up the leg; each leg is cut from a different part of the board.
    const leg = new THREE.Mesh(legGeo, woodMaterial(grain, envMap, { across: 0.12, along: 'v', shift: rand(-0.4, 0.4) }));
    leg.position.set(x, LEG_H / 2, z);
    const foot = new THREE.Mesh(footGeo, mat.gold);
    foot.position.set(x, 0.65, z);
    table.add(leg, foot);
  }

  // Aprons, each with its own crystal text. Order: front, right, back, left.
  const texts = content.apronTexts ?? [];
  const sides = [
    { span: 2 * lx - LEG, dist: lz + LEG / 2 - 0.3 - APRON_T / 2, rot: 0 },
    { span: 2 * lz - LEG, dist: lx + LEG / 2 - 0.3 - APRON_T / 2, rot: Math.PI / 2 },
    { span: 2 * lx - LEG, dist: lz + LEG / 2 - 0.3 - APRON_T / 2, rot: Math.PI },
    { span: 2 * lz - LEG, dist: lx + LEG / 2 - 0.3 - APRON_T / 2, rot: -Math.PI / 2 },
  ];
  const apronSparkles = [];
  sides.forEach((s, i) => {
    // Local +Z faces outward; rotating about Y swings it to each side.
    const apron = new THREE.Group();
    apron.rotation.y = s.rot;
    apron.position.set(Math.sin(s.rot) * s.dist, LEG_H - APRON_H / 2, Math.cos(s.rot) * s.dist);
    const apronWood = woodMaterial(grain, envMap, { across: 0.26, shift: rand(-0.35, 0.35) });
    apron.add(new THREE.Mesh(new RoundedBoxGeometry(s.span, APRON_H, APRON_T, 2, 0.15), apronWood));

    const text = texts[i];
    if (text) {
      const box = { w: s.span - 1.4, h: APRON_H - 0.9 };
      const { pts, gemSize } = crystalPoints(text, box.w, box.h);
      const positions = pts.map((p) => new THREE.Vector3(p.x, p.y, APRON_T / 2 + 0.06));
      apron.add(gemField(positions, gemSize, mat.crystal));
      const sparkles = createSparkles(positions, 5, 3.5);
      apron.add(sparkles.points);
      apronSparkles.push(sparkles);
    }
    table.add(apron);
  });

  // Glass display case with a book, in the middle of the tabletop.
  const showcase = displayCase(mat, envMap, content.bookTitle ?? 'Untitled');
  showcase.group.position.y = LEG_H + TOP_T;
  table.add(showcase.group);

  // Puddle light: a projector in the middle of the underside of the top
  // shines straight down, so the glowing text lands under the table. It's
  // part of the same group, so it turns with the table and platform.
  scene.updateMatrixWorld(true);
  const lightPos = table.localToWorld(new THREE.Vector3(0, LEG_H - 0.05, 0));
  const spot = new THREE.Vector3(lightPos.x, 0.03, lightPos.z);

  const projector = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 20), mat.gold);
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({ color: '#e2d0ff', toneMapped: false }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.y = -0.26;
  projector.add(housing, lens);
  projector.position.copy(lightPos).add(new THREE.Vector3(0, -0.25, 0));
  scene.add(projector);

  // Lined up with the front apron, and small enough to sit between the legs.
  const lightText = content.lightText ?? 'Stay Juicy';
  const puddle = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15 * (384 / 1024)),
    new THREE.MeshBasicMaterial({
      map: puddleTexture(lightText),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  puddle.rotation.x = -Math.PI / 2; // lie flat, text reading toward the viewer
  puddle.position.copy(spot);
  puddle.renderOrder = 2;
  scene.add(puddle);

  // Faint visible beam straight down to the light pool.
  const len = lightPos.y - spot.y;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 7, len, 40, 1, true), beamMaterial());
  beam.position.set(spot.x, spot.y + len / 2, spot.z);
  beam.renderOrder = 2;
  scene.add(beam);

  // And a real violet spotlight so the platform and legs pick up the glow.
  const light = new THREE.SpotLight(LIGHT_COLOR, 500, 40, 0.55, 0.7, 2);
  light.position.copy(lightPos);
  light.target.position.copy(spot);
  scene.add(light, light.target);

  // Tip toward the viewer so the platform (and the light) can be seen, then centre.
  const tilt = new THREE.Group();
  tilt.rotation.x = 0.38;
  tilt.add(scene);
  const bounds = new THREE.Box3().setFromObject(tilt);
  tilt.position.sub(bounds.getCenter(new THREE.Vector3()));
  scene.rotation.y = START_ANGLE; // after centering, so the spin axis stays centred
  const group = new THREE.Group();
  group.add(tilt);

  // Paper note hovering beside the table. It sits outside the turntable and
  // the tilt, so it stays upright and readable while the table spins.
  const note = content.note ? createNote(content.note, new THREE.Vector3(14, 15, 9)) : null;
  if (note) group.add(note.group);

  return {
    group,
    radius: 24, // platform diagonal reaches ~46 wide mid-spin
    juice: '#ff8fd1',
    labelled: false,
    // Taps on the curtains (or their roof) open/close them, and taps on the
    // note twirl it, instead of the usual wobble reaction.
    onTap(hit) {
      if (hit.object.userData.note) {
        note.twirl();
        return true;
      }
      if (!hit.object.userData.toggleCurtains) return false;
      showcase.curtains.toggle();
      return true;
    },
    update(time, dt) {
      scene.rotation.y = START_ANGLE + time * SPIN_SPEED;
      for (const s of apronSparkles) s.update(time);
      showcase.curtains.update(dt);
      note?.update(time, dt);
    },
  };
}
