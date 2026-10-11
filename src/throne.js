import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// A pink, puffy, over-the-top velour throne with gold trim, a jaunty crown,
// a heart pillow and the title spelled out in crystals on the backrest.

const rand = (a, b) => a + Math.random() * (b - a);

const CRYSTAL_FONT = "italic 900 {size}px Georgia, 'Times New Roman', serif";

function materials(envMap) {
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
function crystalPoints(text, boxW, boxH) {
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

function gemField(points, size, material, tint = 0.25) {
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
function createSparkles(anchors, count = 12) {
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
      for (let i = 0; i < count; i++) {
        const t = time * speed[i] + phase[i];
        const n = Math.floor(t);
        if (n !== cycle[i]) {
          cycle[i] = n;
          anchors[(Math.random() * anchors.length) | 0].toArray(positions, i * 3);
        }
        const f = t - n;
        // Short bright pop, then rest.
        sizes[i] = f < 0.35 ? Math.sin((f / 0.35) * Math.PI) * 7 : 0;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

/* ----------------------------------- Parts ----------------------------------- */

function legGeometry() {
  const pts = [
    [0.01, 0], [1.3, 0.05], [1.5, 0.6], [1.0, 1.4], [0.6, 2.4], [0.75, 3.6],
    [1.15, 4.4], [0.7, 5.3], [0.9, 6.2], [1.4, 6.6], [1.4, 7.0], [0.01, 7.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 20);
}

function archShape(w, straight) {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, straight);
  s.absarc(0, straight, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return s;
}

function heartShape(k) {
  const s = new THREE.Shape();
  s.moveTo(0, -1.0 * k);
  s.bezierCurveTo(1.2 * k, -0.2 * k, 1.3 * k, 0.9 * k, 0.55 * k, 1.0 * k);
  s.bezierCurveTo(0.2 * k, 1.05 * k, 0, 0.8 * k, 0, 0.6 * k);
  s.bezierCurveTo(0, 0.8 * k, -0.2 * k, 1.05 * k, -0.55 * k, 1.0 * k);
  s.bezierCurveTo(-1.3 * k, 0.9 * k, -1.2 * k, -0.2 * k, 0, -1.0 * k);
  return s;
}

function crown(mat, gemMat) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.0, 1.8, 32, 1, true), mat);
  band.material = mat.clone();
  band.material.side = THREE.DoubleSide;
  g.add(band);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.3, 8, 32), mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.9;
  g.add(rim);
  const spikeGeo = new THREE.ConeGeometry(0.75, 2.4, 10);
  const ballGeo = new THREE.SphereGeometry(0.42, 12, 8);
  const pink = gemMat.clone();
  pink.color = new THREE.Color('#ff7ac0');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, mat);
    spike.position.set(Math.cos(a) * 3.15, 2.0, Math.sin(a) * 3.15);
    g.add(spike);
    const ball = new THREE.Mesh(ballGeo, pink);
    ball.position.set(Math.cos(a) * 3.15, 3.35, Math.sin(a) * 3.15);
    g.add(ball);
  }
  return g;
}

/* ----------------------------------- Throne ---------------------------------- */

export function createThrone({ content, envMap }) {
  const mat = materials(envMap);
  const throne = new THREE.Group();

  // Seat: velour base + puffy cushion
  const base = new THREE.Mesh(new RoundedBoxGeometry(22, 4, 17, 4, 1.4), mat.velourDeep);
  base.position.y = -2;
  throne.add(base);
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(21, 3.4, 16.4, 6, 1.6), mat.velour);
  cushion.position.y = 1.4;
  throne.add(cushion);

  // Gold piping round the base
  const piping = new THREE.Mesh(new RoundedBoxGeometry(22.6, 0.6, 17.6, 2, 0.3), mat.gold);
  piping.position.y = -0.2;
  throne.add(piping);

  // Tufting crystals on the cushion top
  const cushionTufts = [];
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      cushionTufts.push(new THREE.Vector3(ix * 3.8 + (iz % 2 ? 1.9 : 0), 3.1, iz * 4.6 + 1.5));
    }
  }
  throne.add(gemField(cushionTufts, 0.42, mat.crystal, 0));

  // Legs
  const legGeo = legGeometry();
  for (const [x, z] of [[-9, -6.5], [9, -6.5], [-9, 6.5], [9, 6.5]]) {
    const leg = new THREE.Mesh(legGeo, mat.gold);
    leg.position.set(x, -11, z);
    throne.add(leg);
  }

  // Armrests: fat velour bolsters on gold posts, with tassels
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(2.3, 12, 8, 20), mat.velour);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(side * 11.6, 5.6, 0.5);
    throne.add(arm);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 8, 24), mat.gold);
    cap.position.set(side * 11.6, 5.6, 8.9);
    throne.add(cap);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 4, 12), mat.gold);
    post.position.set(side * 11.6, 2.2, 6.2);
    throne.add(post);

    const tassel = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2, 6), mat.gold);
    cord.position.y = -1;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat.gold);
    knot.position.y = -2.1;
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2, 12, 1, true), mat.gold);
    skirt.position.y = -3.2;
    tassel.add(cord, knot, skirt);
    tassel.position.set(side * 11.6, 3.6, 9.8);
    throne.add(tassel);
  }

  // Backrest: a puffy arched pillow with gold piping
  const back = new THREE.Group();
  const shape = archShape(20, 13);
  const depth = 2;
  const bevel = 1.8;
  const backGeo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 1.6,
    bevelSegments: 8,
    curveSegments: 48,
  });
  back.add(new THREE.Mesh(backGeo, mat.velour));

  const outline = shape.getSpacedPoints(160).slice(0, -1).map((p) => {
    const d = new THREE.Vector2(p.x, p.y - 8).normalize().multiplyScalar(1.7);
    return new THREE.Vector3(p.x + d.x, Math.max(-0.6, p.y + d.y), depth / 2);
  });
  back.add(
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 240, 0.7, 10, true), mat.gold),
  );

  // Crystal lettering on the front of the backrest
  const frontZ = depth + bevel;
  const textBox = { w: 16, h: 11, cx: 0, cy: 13 };
  const { pts, gemSize } = crystalPoints(content.title, textBox.w, textBox.h);
  const letterPositions = pts.map((p) => new THREE.Vector3(p.x + textBox.cx, p.y + textBox.cy, frontZ + 0.15));
  back.add(gemField(letterPositions, gemSize, mat.crystal));

  // Tufting crystals around the lettering
  const tufts = [];
  for (let row = 0, y = 3; y < 23.5; row++, y += 3.4) {
    for (let x = -8 + (row % 2) * 2; x <= 8; x += 4) {
      const inArch = y < 13 || Math.hypot(x, y - 13) < 8.4;
      const inText = Math.abs(x - textBox.cx) < textBox.w / 2 + 0.5 && Math.abs(y - textBox.cy) < textBox.h / 2 + 0.5;
      if (inArch && !inText) tufts.push(new THREE.Vector3(x, y, frontZ + 0.1));
    }
  }
  back.add(gemField(tufts, 0.45, mat.crystal, 0));

  const sparkles = createSparkles([...letterPositions, ...tufts], 14);
  back.add(sparkles.points);

  // Jaunty crown on top
  const crownGroup = crown(mat.gold, mat.crystal);
  crownGroup.position.set(1.2, 26.2, depth / 2);
  crownGroup.rotation.set(0.15, 0, -0.22);
  back.add(crownGroup);

  back.position.set(0, 0.6, -8.4);
  back.rotation.x = -0.08;
  throne.add(back);

  // A heart pillow tossed on the seat
  const heart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(2.6), {
      depth: 0.8,
      bevelEnabled: true,
      bevelThickness: 1.1,
      bevelSize: 0.9,
      bevelSegments: 6,
      curveSegments: 24,
    }),
    mat.velourHeart,
  );
  heart.position.set(7.4, 5.2, 1.8);
  heart.rotation.set(-0.35, -0.3, -0.35);
  throne.add(heart);

  // Lean toward the viewer a touch so the seat reads, then centre the whole thing.
  throne.rotation.x = 0.12;
  const box = new THREE.Box3().setFromObject(throne);
  const center = box.getCenter(new THREE.Vector3());
  throne.position.sub(center);
  const group = new THREE.Group();
  group.add(throne);

  return {
    group,
    radius: 22, // ~28 wide x 44 tall
    juice: '#ff8fd1',
    labelled: false,
    update(time) {
      sparkles.update(time);
    },
  };
}
