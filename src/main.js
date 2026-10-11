import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FRUITS } from './content.js';
import { createDust } from './dust.js';
import { createFruit } from './fruits.js';
import { createJuice } from './juice.js';
import { addLabel } from './label.js';

const BASE_FOV = 45;
const MAX_FOV_KICK = 22;

// Where each fruit floats in the void, in journey order.
const LAYOUT = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(140, 40, -600),
  new THREE.Vector3(-120, -30, -1200),
  new THREE.Vector3(60, 60, -1800),
];

const isSmallScreen = matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------- Setup ---------------------------------- */

const canvas = document.querySelector('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: window.devicePixelRatio < 2,
    powerPreference: 'high-performance',
  });
} catch (err) {
  document.querySelector('#fallback').hidden = false;
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#000000');
const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 3000);

const sun = new THREE.DirectionalLight('#fff3e0', 2.8);
sun.position.set(-1, 0.8, 0.9);
const rim = new THREE.DirectionalLight('#7c95ff', 1.4);
rim.position.set(1, 0.4, -1);
scene.add(sun, rim, new THREE.HemisphereLight('#9fb4ff', '#1b1030', 0.55));

// Reflections for the throne's gold and crystals (the fruits don't use it).
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const stations = FRUITS.map((content, i) => {
  const fruit = createFruit(content.kind, { content, envMap });
  // Label is projected while the fruit is still at the origin, facing +Z.
  if (fruit.labelled !== false) addLabel(fruit, content);
  fruit.group.position.copy(LAYOUT[i]);
  scene.add(fruit.group);
  return { ...content, ...fruit, position: LAYOUT[i], react: createReaction() };
});

const juice = createJuice(isSmallScreen ? 160 : 260);
juice.setPixelRatio(renderer.getPixelRatio());
scene.add(juice.points);

const dust = createDust({ count: isSmallScreen ? 350 : 600 });
scene.add(dust.object);

/* --------------------------------- Framing --------------------------------- */

// Camera spot for a fruit: centred horizontally, nudged up a little to leave
// room for the button bar at the bottom. The fruit fills most of the screen
// so the text printed on it stays readable on phones.
function viewFor(station) {
  const aspect = camera.aspect;
  const r = station.radius;
  const tan = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2));
  let d;
  let sy;
  if (aspect >= 1) {
    // fruit spans ~64% of the height, at most 60% of the width
    d = Math.max(r / (0.64 * tan), r / (0.6 * aspect * tan));
    sy = -0.05 * 2 * d * tan;
  } else {
    // fruit spans ~86% of the width, at most 58% of the height
    d = Math.max(r / (0.86 * aspect * tan), r / (0.58 * tan));
    sy = -0.07 * 2 * d * tan;
  }
  const offset = new THREE.Vector3(0, sy, 0);
  const target = station.position.clone().add(offset);
  return { pos: target.clone().add(new THREE.Vector3(0, 0, d)), target, d };
}

const tmpMat = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
function lookQuat(from, to) {
  return new THREE.Quaternion().setFromRotationMatrix(tmpMat.lookAt(from, to, UP));
}

/* --------------------------------- Flights --------------------------------- */

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

let flight = null;
let current = 0;
let arrivedAt = 0;
const clock = new THREE.Clock();

function startFlight({ points, duration, ease = easeInOutCubic, endQuat = null, onDone }) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const length = curve.getLength();
  flight = {
    curve,
    duration: reducedMotion ? Math.min(duration, 1.6) : duration,
    start: clock.elapsedTime,
    ease,
    fromQuat: camera.quaternion.clone(),
    endQuat,
    // All the cubic easings peak at 3x the average speed.
    peakSpeed: (length / duration) * 3,
    onDone,
  };
}

const tangent = new THREE.Vector3();
const lookAhead = new THREE.Vector3();
const tangentQuat = new THREE.Quaternion();
const prevPos = new THREE.Vector3();
const velocity = new THREE.Vector3();
const rawVelocity = new THREE.Vector3();
let speedNorm = 0;

function updateFlight(time, dt) {
  const f = flight;
  const k = Math.min(1, (time - f.start) / f.duration);
  const u = f.ease(k);

  prevPos.copy(camera.position);
  camera.position.copy(f.curve.getPointAt(u));

  f.curve.getTangentAt(Math.min(u, 0.999), tangent);
  lookAhead.copy(camera.position).add(tangent);
  tangentQuat.setFromRotationMatrix(tmpMat.lookAt(camera.position, lookAhead, UP));

  // Turn from the old view toward the flight direction, then settle onto the new fruit.
  const q = f.fromQuat.clone().slerp(tangentQuat, THREE.MathUtils.smoothstep(k, 0, 0.22));
  if (f.endQuat) q.slerp(f.endQuat, THREE.MathUtils.smoothstep(k, 0.68, 1));
  camera.quaternion.copy(q);

  if (dt > 0) {
    rawVelocity.subVectors(camera.position, prevPos).divideScalar(dt);
    velocity.lerp(rawVelocity, 1 - Math.exp(-dt * 12));
  }
  speedNorm = Math.min(1, velocity.length() / f.peakSpeed);

  if (k >= 1) {
    flight = null;
    f.onDone?.();
  }
}

function flyToStation(index) {
  const from = camera.position.clone();
  const cur = stations[current];
  const next = stations[index];
  const view = viewFor(next);
  const r = cur.radius;
  const side = Math.sign(next.position.x - cur.position.x) || 1;

  // Swing out past the current fruit, curve through the void,
  // then line up in front of the next fruit.
  const p1 = cur.position.clone().add(new THREE.Vector3(side * r * 2.6, r, viewFor(cur).d * 0.6));
  const p2 = cur.position.clone().add(new THREE.Vector3(side * r * 3.2, r * 1.4, -r * 3));
  const mid = new THREE.Vector3().lerpVectors(p2, view.pos, 0.5).add(new THREE.Vector3(-side * 45, 35, 0));
  const approach = view.pos.clone().add(new THREE.Vector3(0, 0, Math.max(view.d * 2.2, 90)));

  startFlight({
    points: [from, p1, p2, mid, approach, view.pos],
    duration: 4.4,
    endQuat: lookQuat(view.pos, view.target),
    onDone: () => arrive(index),
  });
}

function introFlight() {
  const view = viewFor(stations[0]);
  const start = view.pos.clone().add(new THREE.Vector3(30, 40, 560));
  camera.position.copy(start);
  const mid = new THREE.Vector3().lerpVectors(start, view.pos, 0.5).add(new THREE.Vector3(-40, 15, 0));
  const approach = view.pos.clone().add(new THREE.Vector3(0, 0, view.d * 2));
  camera.quaternion.copy(lookQuat(start, mid));
  startFlight({
    points: [start, mid, approach, view.pos],
    duration: 3.6,
    ease: easeOutCubic,
    endQuat: lookQuat(view.pos, view.target),
    onDone: () => arrive(0),
  });
}

// From the last fruit, punch forward into the void, flash, and fly back in.
function hyperjump() {
  const from = camera.position.clone();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const lift = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const cur = stations[current];
  const points = [
    from,
    from.clone().add(lift.clone().multiplyScalar(cur.radius * 1.8)).addScaledVector(fwd, 30),
    from.clone().add(lift.clone().multiplyScalar(cur.radius * 2.4)).addScaledVector(fwd, 250),
    from.clone().add(lift.clone().multiplyScalar(cur.radius * 2.6)).addScaledVector(fwd, 700),
  ];
  startFlight({
    points,
    duration: 2,
    ease: easeInCubic,
    onDone: () => {
      flashOut();
      current = 0;
      introFlight();
    },
  });
  flashIn();
}

const flash = document.querySelector('#flash');
function flashIn() {
  flash.animate([{ opacity: 0 }, { opacity: 0, offset: 0.75 }, { opacity: 1 }], {
    duration: flight.duration * 1000,
    easing: 'ease-in',
    fill: 'forwards',
  });
}
function flashOut() {
  flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' });
}

/* ------------------------------------ UI ----------------------------------- */

const card = document.querySelector('#card');
const kicker = card.querySelector('.card__kicker');
const title = card.querySelector('.card__title');
const text = card.querySelector('.card__text');
const button = card.querySelector('.card__btn');
const progress = document.querySelector('#progress');

const dots = stations.map((s) => {
  const el = document.createElement('span');
  el.className = 'dot';
  el.style.setProperty('--dot-color', s.accent);
  el.title = s.name;
  progress.append(el);
  return el;
});

function showCard(index) {
  const s = stations[index];
  card.style.setProperty('--accent', s.accent);
  kicker.textContent = s.kicker;
  title.textContent = s.title;
  text.textContent = s.text;
  button.textContent = s.button;
  button.disabled = false;
  card.classList.remove('is-hidden');
  dots.forEach((d, i) => {
    d.classList.toggle('is-active', i === index);
    d.classList.toggle('is-visited', i < index);
  });
}

function hideCard() {
  button.disabled = true;
  card.classList.add('is-hidden');
}

function arrive(index) {
  current = index;
  arrivedAt = clock.elapsedTime;
  velocity.set(0, 0, 0);
  showCard(index);
  button.focus({ preventScroll: true });
}

button.addEventListener('click', () => {
  if (flight) return;
  hideCard();
  if (current === stations.length - 1) hyperjump();
  else flyToStation(current + 1);
});

/* ------------------------------- Tap reactions ------------------------------ */

// Every reaction is a damped spring that settles back to 0, layered on top of
// the idle sway/bob, so a poked fruit always returns to its normal idle loop.
function spring(x = 0) {
  return { x, v: 0, target: x };
}

function createReaction() {
  return { squash: spring(), tiltX: spring(), tiltZ: spring(), hop: spring(), spin: spring() };
}

function stepSpring(s, k, zeta, dt) {
  const c = 2 * zeta * Math.sqrt(k);
  s.v += (-k * (s.x - s.target) - c * s.v) * dt;
  s.x += s.v * dt;
}

function updateReaction(r, dt) {
  // Substep so stiff springs stay stable on slow frames.
  const steps = Math.ceil(dt / (1 / 120));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    stepSpring(r.squash, 240, 0.16, h);
    stepSpring(r.tiltX, 70, 0.22, h);
    stepSpring(r.tiltZ, 70, 0.22, h);
    stepSpring(r.hop, 45, 0.3, h);
    stepSpring(r.spin, 26, 0.55, h);
  }
  r.squash.x = THREE.MathUtils.clamp(r.squash.x, -0.32, 0.32);
  // Once a spin has settled on a whole turn, fold it back to 0.
  if (r.spin.target !== 0 && Math.abs(r.spin.x - r.spin.target) < 1e-3 && Math.abs(r.spin.v) < 1e-3) {
    r.spin.x = r.spin.target = 0;
    r.spin.v = 0;
  }
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hint = card.querySelector('.card__hint');

function pickFruit(clientX, clientY) {
  if (flight) return null;
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(stations[current].group, true)[0] ?? null;
}

function poke(station, hit) {
  const r = station.react;
  const weight = Math.max(0.6, 10 / station.radius); // bigger things react less
  const local = hit.point.clone().sub(station.group.position).divideScalar(station.radius);

  r.squash.v -= 4.5 * weight;
  r.hop.v += 9 * weight;
  // Push the tapped side away from the viewer.
  r.tiltX.v -= local.y * 4 * weight;
  r.tiltZ.v -= local.x * 2.5 * weight;
  // Off-centre taps also twirl the fruit a full turn (or more, if tapped again).
  if (Math.abs(local.x) > 0.3) r.spin.target += Math.sign(local.x) * Math.PI * 2;

  const dir = local.clone().normalize();
  dir.z = Math.max(dir.z, 0.4); // spray toward the camera
  juice.burst(hit.point, dir.normalize(), station.juice, isSmallScreen ? 20 : 30);

  navigator.vibrate?.(12);
  hint?.classList.add('is-hidden');
}

let pointerDown = null;
canvas.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
  const quick = performance.now() - pointerDown.t < 600;
  pointerDown = null;
  if (moved > 12 || !quick) return;
  const hit = pickFruit(e.clientX, e.clientY);
  if (hit) poke(stations[current], hit);
});
canvas.addEventListener('pointercancel', () => (pointerDown = null));

// Pointer cursor when hovering a fruit (mouse only, at most once per frame).
let hoverEvent = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') hoverEvent = e;
});

/* ---------------------------------- Loop ----------------------------------- */

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  juice.setPixelRatio(renderer.getPixelRatio());
}
window.addEventListener('resize', onResize);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (flight) {
    updateFlight(time, dt);
  } else {
    // Gentle idle drift in front of the current fruit.
    const view = viewFor(stations[current]);
    const amp = Math.min(1, (time - arrivedAt) / 2);
    camera.position.copy(view.pos).add(new THREE.Vector3(Math.sin(time * 0.5) * 0.5 * amp, Math.sin(time * 0.7) * 0.35 * amp, 0));
    camera.quaternion.copy(lookQuat(view.pos, view.target));
    speedNorm = Math.max(0, speedNorm - dt * 2);
  }

  const kick = reducedMotion ? 0 : MAX_FOV_KICK * Math.pow(speedNorm, 1.5);
  if (Math.abs(camera.fov - (BASE_FOV + kick)) > 0.01) {
    camera.fov = BASE_FOV + kick;
    camera.updateProjectionMatrix();
  }

  // Dust fades in with speed; invisible while parked at a fruit.
  dust.update(camera.position, velocity, reducedMotion ? 0 : Math.pow(speedNorm, 1.2) * 1.0);

  for (const [i, s] of stations.entries()) {
    const r = s.react;
    updateReaction(r, dt);
    // Sway rather than spin, so the printed text keeps facing the viewer.
    s.pivot.rotation.y = Math.sin(time * 0.45 + i * 1.7) * 0.28 + r.spin.x;
    s.group.rotation.set(r.tiltX.x, 0, r.tiltZ.x);
    s.group.scale.set(1 - r.squash.x * 0.5, 1 + r.squash.x, 1 - r.squash.x * 0.5);
    s.group.position.y = s.position.y + Math.sin(time * 0.8 + s.position.x) * 0.4 + r.hop.x;
    s.update?.(time, dt);
  }
  juice.update(dt);

  if (hoverEvent) {
    canvas.style.cursor = pickFruit(hoverEvent.clientX, hoverEvent.clientY) ? 'pointer' : '';
    hoverEvent = null;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

introFlight();
requestAnimationFrame(tick);
