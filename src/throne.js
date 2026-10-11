import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createSparkles, crystalPoints, gemField, materials } from './bling.js';

// A pink, puffy, over-the-top velour throne with gold trim, a jaunty crown,
// a heart pillow and the title spelled out in crystals on the backrest.

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
