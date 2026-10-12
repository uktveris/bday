import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createSparkles, crystalPoints, gemField, paddedSurface, richMaterials, studs } from './bling.js';
import { createNote } from './note.js';

// A pink velvet throne: deep-buttoned upholstery in a carved, gilded frame,
// with a jaunty crown, a heart pillow and the title spelled out in crystals
// on the backrest.

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* -------------------------------- Upholstery --------------------------------- */

// Deep-buttoned (diamond-tufted) padding as a height function. Buttons sit on
// a staggered lattice: `a` apart along x, rows `b` apart along y, starting at
// y0. Between them the cloth puffs up; along the diamond edges it creases.
function tufting({ a, b, y0, depth }) {
  const cell = (x, y) => [x / a + (y - y0) / (2 * b), x / a - (y - y0) / (2 * b)];
  return {
    height(x, y) {
      const [u1, u2] = cell(x, y);
      const puff = Math.pow(Math.abs(Math.sin(Math.PI * u1) * Math.sin(Math.PI * u2)), 0.4);
      const n1 = Math.round(u1);
      const n2 = Math.round(u2);
      const dn = Math.hypot(x - (a * (n1 + n2)) / 2, y - (y0 + b * (n1 - n2)));
      // Creases sit 60% of the way down; buttons pull all the way in.
      return depth * (0.6 * puff + 0.4 * (1 - Math.exp(-((dn / 0.9) ** 2))));
    },
    // Button positions inside a rectangle.
    buttons(minX, maxX, minY, maxY) {
      const out = [];
      for (let j = Math.ceil((minY - y0) / b); y0 + j * b <= maxY; j++) {
        const off = (((j % 2) + 2) % 2) * (a / 2);
        for (let k = Math.ceil((minX - off) / a); off + k * a <= maxX; k++) out.push([off + k * a, y0 + j * b]);
      }
      return out;
    },
  };
}

// Quarter-round roll-off toward the edge of a cushion, 0 at the edge.
const roll = (d, width) => {
  const t = 1 - Math.min(1, Math.max(0, d / width));
  return Math.sqrt(1 - t * t);
};

/* ----------------------------------- Parts ----------------------------------- */

function turnedGeometry(profile, segments = 24) {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

const LEG_PROFILE = [
  [0.01, 0], [1.25, 0.05], [1.45, 0.55], [1.0, 1.3], [0.6, 2.3], [0.72, 3.5],
  [1.15, 4.3], [0.7, 5.1], [0.85, 5.6], [1.35, 5.9], [1.35, 6.2], [1.0, 6.3], [1.0, 7.05], [0.01, 7.05],
];
const POST_PROFILE = [
  [0.01, 0], [0.85, 0], [0.85, 0.4], [0.5, 0.7], [0.42, 1.6], [0.75, 2.7], [0.5, 3.6], [0.42, 4.4],
  [0.8, 4.9], [0.8, 5.3], [0.01, 5.3],
];

// Arch with a flat bottom at y = y0: straight sides up to `straight`, then a
// semicircle of radius r.
function archPath(path, r, straight, y0) {
  path.moveTo(-r, y0);
  path.lineTo(r, y0);
  path.lineTo(r, straight);
  path.absarc(0, straight, r, 0, Math.PI, false);
  path.lineTo(-r, y0);
  return path;
}

// Points along the two sides and the arc (not the bottom), `spacing` apart.
function archOutline(r, straight, yStart, spacing) {
  const pts = [];
  for (let y = yStart; y < straight; y += spacing) pts.push([-r, y]);
  const n = Math.round((Math.PI * r) / spacing);
  for (let i = 0; i <= n; i++) {
    const t = Math.PI - (i / n) * Math.PI;
    pts.push([Math.cos(t) * r, straight + Math.sin(t) * r]);
  }
  for (let y = straight - spacing; y >= yStart; y -= spacing) pts.push([r, y]);
  return pts;
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

// Carved scallop shell: a fan of lobes over a boss, as on gilded furniture.
function shell(mat, scale = 1) {
  const g = new THREE.Group();
  const lobe = new THREE.SphereGeometry(1, 12, 10);
  for (let i = -3; i <= 3; i++) {
    const a = (i * 22 * Math.PI) / 180;
    const m = new THREE.Mesh(lobe, mat);
    m.scale.set(0.42, 1.15, 0.4);
    m.position.set(Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0);
    m.rotation.z = -a;
    g.add(m);
  }
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), mat);
  boss.position.z = 0.35;
  g.add(boss);
  g.scale.setScalar(scale);
  return g;
}

function crown(mat) {
  const g = new THREE.Group();
  const bandMat = mat.gold.clone();
  bandMat.side = THREE.DoubleSide;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.0, 1.8, 32, 1, true), bandMat));
  for (const [y, r] of [[-0.9, 3.05], [0.9, 3.32]]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.26, 8, 40), mat.gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    g.add(rim);
  }
  // Velvet cap inside, like a real crown.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(2.9, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat.velourHeart);
  cap.scale.y = 0.75;
  cap.position.y = 0.7;
  g.add(cap);

  const spikeGeo = new THREE.ConeGeometry(0.75, 2.4, 10);
  const ballGeo = new THREE.SphereGeometry(0.42, 12, 8);
  const pink = mat.crystal.clone();
  pink.color = new THREE.Color('#ff7ac0');
  const jewels = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, mat.gold);
    spike.position.set(Math.cos(a) * 3.15, 2.0, Math.sin(a) * 3.15);
    g.add(spike);
    const ball = new THREE.Mesh(ballGeo, pink);
    ball.position.set(Math.cos(a) * 3.15, 3.35, Math.sin(a) * 3.15);
    g.add(ball);
    for (const da of [0, Math.PI / 6]) {
      jewels.push(new THREE.Vector3(Math.cos(a + da) * 3.2, 0, Math.sin(a + da) * 3.2));
    }
  }
  g.add(gemField(jewels, 0.32, mat.crystal, 0.6));
  return g;
}

/* ----------------------------------- Throne ---------------------------------- */

export function createThrone({ content, envMap }) {
  const mat = richMaterials(envMap);
  const throne = new THREE.Group();

  /* Seat: gilded rail on turned legs, with a deep-buttoned cushion on top. */

  const RAIL_W = 24;
  const RAIL_D = 18.4;
  const rail = new THREE.Mesh(new RoundedBoxGeometry(RAIL_W, 2.6, RAIL_D, 3, 0.5), mat.gold);
  rail.position.y = -1.5;
  throne.add(rail);

  const railBeads = [];
  for (let x = -RAIL_W / 2 + 0.6; x <= RAIL_W / 2 - 0.6; x += 0.75) {
    railBeads.push(new THREE.Vector3(x, -2.55, RAIL_D / 2), new THREE.Vector3(x, -2.55, -RAIL_D / 2));
  }
  for (let z = -RAIL_D / 2 + 0.6; z <= RAIL_D / 2 - 0.6; z += 0.75) {
    railBeads.push(new THREE.Vector3(RAIL_W / 2, -2.55, z), new THREE.Vector3(-RAIL_W / 2, -2.55, z));
  }
  throne.add(studs(railBeads, 0.3, mat.gold));

  const cartouche = shell(mat.gold, 0.8);
  cartouche.position.set(0, -1.9, RAIL_D / 2 + 0.1);
  throne.add(cartouche);

  const legGeo = turnedGeometry(LEG_PROFILE);
  for (const [x, z] of [[-10, -7.4], [10, -7.4], [-10, 7.4], [10, 7.4]]) {
    const leg = new THREE.Mesh(legGeo, mat.gold);
    leg.position.set(x, -2.8 - 7.05, z);
    throne.add(leg);
  }

  const SEAT_W = 21.6;
  const SEAT_D = 16.6;
  const cushionBody = new THREE.Mesh(new RoundedBoxGeometry(SEAT_W, 1.6, SEAT_D, 4, 0.7), mat.velour);
  cushionBody.position.y = 0.6;
  throne.add(cushionBody);

  // Tufted top, built in the XY plane and then laid flat.
  const seatTuft = tufting({ a: 4.2, b: 3.6, y0: 0, depth: 0.9 });
  const seatHeight = (x, y) => {
    const d = Math.min(SEAT_W / 2 - Math.abs(x), SEAT_D / 2 - Math.abs(y));
    return roll(d, 1.4) * (1.3 + seatTuft.height(x, y));
  };
  const seatTop = new THREE.Mesh(
    paddedSurface(84, 66, (u, v) => [(u - 0.5) * SEAT_W, (v - 0.5) * SEAT_D], seatHeight),
    mat.velour,
  );
  seatTop.rotation.x = -Math.PI / 2; // (x, y, height) -> (x, height, -y)
  seatTop.position.y = 0.7;
  throne.add(seatTop);

  const seatButtons = seatTuft
    .buttons(-SEAT_W / 2 + 2, SEAT_W / 2 - 2, -SEAT_D / 2 + 2, SEAT_D / 2 - 2)
    .map(([x, y]) => new THREE.Vector3(x, 0.7 + seatHeight(x, y) + 0.1, -y));
  throne.add(gemField(seatButtons, 0.36, mat.crystal, 0));

  // Fabric piping where the cushion meets the rail.
  const piping = new THREE.Mesh(new RoundedBoxGeometry(SEAT_W + 0.5, 0.45, SEAT_D + 0.5, 2, 0.22), mat.velourDeep);
  piping.position.y = -0.1;
  throne.add(piping);

  /* Arms: gilded rails with scrolled ends on turned posts, padded on top. */

  const postGeo = turnedGeometry(POST_PROFILE, 16);
  for (const side of [-1, 1]) {
    const x = side * 11.3;
    const armRail = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.1, 15, 2, 0.35), mat.gold);
    armRail.position.set(x, 5.65, -0.6);
    throne.add(armRail);

    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.3, 24), mat.gold);
    scroll.rotation.z = Math.PI / 2;
    scroll.position.set(x, 5.35, 7.2);
    throne.add(scroll);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat.gold);
      eye.position.set(x + s * 1.2, 5.35, 7.2);
      throne.add(eye);
    }

    const post = new THREE.Mesh(postGeo, mat.gold);
    post.position.set(x, -0.2, 5.6);
    throne.add(post);

    const pad = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 8.5, 8, 20), mat.velour);
    pad.rotation.x = Math.PI / 2;
    pad.scale.z = 0.62; // local z is "up" after the rotation: a flattened pad
    pad.position.set(x, 6.55, -1.2);
    throne.add(pad);
    const padNails = [];
    for (let z = -5.6; z <= 3.3; z += 0.62) {
      padNails.push(new THREE.Vector3(x + 0.97, 6.3, z), new THREE.Vector3(x - 0.97, 6.3, z));
    }
    throne.add(studs(padNails, 0.17, mat.gold));

    const tassel = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), mat.gold);
    cord.position.y = -0.8;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat.gold);
    knot.position.y = -1.7;
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.9, 14, 1, true), mat.gold);
    skirt.position.y = -2.7;
    tassel.add(cord, knot, skirt);
    tassel.position.set(x, 4.4, 8.1);
    throne.add(tassel);
  }

  /* Backrest: deep-buttoned arch pillow in a moulded, beaded gilt frame. */

  const back = new THREE.Group();
  const R = 10; // pillow half-width / arch radius
  const S = 13; // height of the straight sides
  const BOARD = 1.2; // backing board thickness
  const PAD = 1.4; // padding thickness under the tufting
  const TUFT = 1.3; // tufting depth
  const textBox = { w: 15, h: 9.5, cx: 0, cy: 12.8 };

  const backTuft = tufting({ a: 4, b: 3.4, y0: 3, depth: TUFT });
  // 1 where the cloth is tufted, 0 on the smooth panel behind the lettering.
  const tufted = (x, y) =>
    Math.max(
      smooth(textBox.w / 2, textBox.w / 2 + 1.2, Math.abs(x - textBox.cx)),
      smooth(textBox.h / 2, textBox.h / 2 + 1.2, Math.abs(y - textBox.cy)),
    );
  const backHeight = (x, y) => {
    const edge = y <= S ? R - Math.abs(x) : R - Math.hypot(x, y - S);
    const t = tufted(x, y);
    return BOARD + roll(Math.min(edge, y + 1), 2) * (PAD + t * backTuft.height(x, y) + (1 - t) * TUFT * 0.75);
  };
  // Grid squeezed to the arch: full width up the sides, narrowing over the top.
  const archPlace = (u, v) => {
    const y = v * (S + R);
    const half = y <= S ? R : Math.sqrt(Math.max(0, R * R - (y - S) ** 2));
    return [(u - 0.5) * 2 * half, y];
  };
  back.add(new THREE.Mesh(paddedSurface(100, 116, archPlace, backHeight), mat.velour));

  // Upholstered backing board (what you see from behind).
  const board = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archPath(new THREE.Shape(), R, S, 0), { depth: BOARD, bevelEnabled: false, curveSegments: 48 }),
    mat.velourDeep,
  );
  back.add(board);

  // Frame: an arch ring with a moulded (bevelled) section.
  const FRAME = 2.2;
  const ring = archPath(new THREE.Shape(), R + FRAME, S, -1.5);
  ring.holes.push(archPath(new THREE.Path(), R, S, 0));
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ring, {
      depth: 1.6,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.4,
      bevelSegments: 4,
      curveSegments: 48,
    }),
    mat.gold,
  );
  back.add(frame);
  const frameFront = 1.6 + 0.5;

  // Pearl beading along the frame, and nailheads along the edge of the cloth.
  back.add(
    studs(archOutline(R + FRAME * 0.5, S, 0.4, 0.72).map(([x, y]) => new THREE.Vector3(x, y, frameFront + 0.05)), 0.3, mat.gold),
  );
  back.add(
    studs(archOutline(R - 0.85, S, 2.6, 0.6).map(([x, y]) => new THREE.Vector3(x, y, backHeight(x, y) + 0.04)), 0.19, mat.gold),
  );

  // Crystal lettering on the smooth panel.
  const panelZ = BOARD + PAD + TUFT * 0.75;
  const { pts, gemSize } = crystalPoints(content.title, textBox.w, textBox.h);
  const letterPositions = pts.map((p) => new THREE.Vector3(p.x + textBox.cx, p.y + textBox.cy, panelZ + 0.15));
  back.add(gemField(letterPositions, gemSize, mat.crystal));

  // Crystal buttons pulled into the tufting dimples.
  const backButtons = backTuft
    .buttons(-R, R, 3, S + R)
    .filter(([x, y]) => (y <= S ? R - Math.abs(x) : R - Math.hypot(x, y - S)) > 1.6 && tufted(x, y) > 0.9)
    .map(([x, y]) => new THREE.Vector3(x, y, backHeight(x, y) + 0.12));
  back.add(gemField(backButtons, 0.4, mat.crystal, 0));

  const sparkles = createSparkles([...letterPositions, ...backButtons], 14);
  back.add(sparkles.points);

  // Carved crest: a shell between two scrolls, with the crown perched on top.
  const crestY = S + R + FRAME + 0.1;
  const crest = shell(mat.gold);
  crest.position.set(0, crestY, 0.9);
  back.add(crest);
  for (const side of [-1, 1]) {
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.28, 8, 24, 5), mat.gold);
    scroll.position.set(side * 2.7, crestY + 0.2, 0.9);
    scroll.rotation.z = 0.6;
    scroll.scale.x = side; // mirror the left-hand one
    back.add(scroll);
  }
  const crownGroup = crown(mat);
  crownGroup.position.set(1.0, crestY + 2.6, 0.9);
  crownGroup.rotation.set(0.15, 0, -0.22);
  back.add(crownGroup);

  back.position.set(0, 0.6, -8.4);
  back.rotation.x = -0.08;
  throne.add(back);

  /* A heart pillow tossed on the seat. */

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
  heart.position.set(7.0, 5.0, 1.8);
  heart.rotation.set(-0.35, -0.3, -0.35);
  throne.add(heart);

  // Lean toward the viewer a touch so the seat reads, then centre the whole thing.
  throne.rotation.x = 0.12;
  const box = new THREE.Box3().setFromObject(throne);
  const center = box.getCenter(new THREE.Vector3());
  throne.position.sub(center);
  const group = new THREE.Group();
  group.add(throne);

  // Paper note hovering up and to the right, in front of the backrest.
  const note = content.note ? createNote(content.note, new THREE.Vector3(16.5, 14, 6)) : null;
  if (note) group.add(note.group);

  return {
    group,
    radius: 23, // ~26 wide x 45 tall
    juice: '#ff8fd1',
    labelled: false,
    // Tapping the note twirls it instead of wobbling the throne.
    onTap(hit) {
      if (!hit.object.userData.note) return false;
      note.twirl();
      return true;
    },
    update(time, dt) {
      sparkles.update(time);
      note?.update(time, dt);
    },
  };
}
