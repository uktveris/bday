import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createSparkles, crystalPoints, gemField, materials } from './bling.js';

// A simple square coffee table (four legs, an apron plank between each pair),
// done up Juicy-style: pink lacquer, gold trim, crystal lettering on every
// apron, standing on a square dark platform. A violet puddle light under the
// top projects a glowing message onto the platform, like a car-door logo light.

const PLATFORM = 38; // square platform side
const TOP_W = 23;
const TOP_D = 21;
const TOP_T = 1.6;
const LEG = 2;
const LEG_H = 17;
const APRON_H = 4;
const APRON_T = 0.8;
const LIGHT_COLOR = '#9b5cff'; // puddle light (violet)

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

export function createTable({ content, envMap }) {
  const mat = materials(envMap);
  const scene = new THREE.Group();

  // Very dark grey platform with gold trim; its top sits at y = 0.
  const platform = new THREE.Mesh(new RoundedBoxGeometry(PLATFORM, 2, PLATFORM, 3, 0.6), mat.platform);
  platform.position.y = -1;
  scene.add(platform);
  const trim = new THREE.Mesh(new RoundedBoxGeometry(PLATFORM + 0.5, 0.5, PLATFORM + 0.5, 2, 0.25), mat.gold);
  trim.position.y = -0.35;
  scene.add(trim);

  // The table, turned so a corner and two aprons face the viewer.
  const table = new THREE.Group();
  table.position.z = -4;
  table.rotation.y = -0.7;
  scene.add(table);

  const top = new THREE.Mesh(new RoundedBoxGeometry(TOP_W, TOP_T, TOP_D, 3, 0.4), mat.lacquer);
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
    const leg = new THREE.Mesh(legGeo, mat.lacquer);
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
    apron.add(new THREE.Mesh(new RoundedBoxGeometry(s.span, APRON_H, APRON_T, 2, 0.15), mat.lacquer));

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

  // Puddle light: a projector in the middle of the underside of the top
  // shines straight down, so the glowing text lands under the table.
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

  // Kept square to the viewer (not the table) so it reads straight on; at
  // this size it still fits inside the table's footprint.
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
  const group = new THREE.Group();
  group.add(tilt);

  return {
    group,
    radius: 23,
    juice: '#ff8fd1',
    labelled: false,
    update(time) {
      for (const s of apronSparkles) s.update(time);
    },
  };
}
