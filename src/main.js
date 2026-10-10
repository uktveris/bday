import * as THREE from 'three';
import { FRUITS } from './content.js';
import { createFruit } from './fruits.js';
import { createPlanets, createSky, createStarfield } from './space.js';

const BASE_FOV = 45;
const MAX_FOV_KICK = 22;

// Where each fruit floats in space, in journey order.
const LAYOUT = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(140, 40, -600),
  new THREE.Vector3(-120, -30, -1200),
  new THREE.Vector3(60, 60, -1800),
];

const PLANETS = [
  { position: new THREE.Vector3(-380, 120, -260), radius: 60, colors: ['#9c5b3a', '#c98b5a', '#e7c49a', '#b57446'], ring: '#e9d2a8', tilt: 0.3 },
  { position: new THREE.Vector3(-170, -210, -470), radius: 28, colors: ['#5a5a66', '#8b8b96', '#6d6a72'] },
  { position: new THREE.Vector3(430, -170, -920), radius: 90, colors: ['#1f3a7a', '#3f6fc0', '#8fb6ea', '#2a4f99'] },
  { position: new THREE.Vector3(-460, 210, -1520), radius: 45, colors: ['#4a2a6e', '#8a5ab8', '#c9a3e8'], ring: '#c9a3e8', tilt: -0.4 },
  { position: new THREE.Vector3(330, -160, -2450), radius: 150, colors: ['#7a3b2a', '#c0703f', '#e8b07a', '#a35232'], tilt: 0.15 },
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
const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 6000);

const sunDir = new THREE.Vector3(-1, 0.8, 0.9).normalize();
const sun = new THREE.DirectionalLight('#fff3e0', 2.8);
sun.position.copy(sunDir);
const rim = new THREE.DirectionalLight('#7c95ff', 1.4);
rim.position.set(1, 0.4, -1);
scene.add(sun, rim, new THREE.HemisphereLight('#9fb4ff', '#1b1030', 0.55));

const sky = createSky(sunDir);
scene.add(sky);

const planets = createPlanets(PLANETS);
scene.add(planets.group);

const stations = FRUITS.map((content, i) => {
  const fruit = createFruit(content.kind);
  fruit.group.position.copy(LAYOUT[i]);
  scene.add(fruit.group);
  return { ...content, ...fruit, position: LAYOUT[i] };
});

const stars = createStarfield({
  count: isSmallScreen ? 3500 : 6500,
  bounds: new THREE.Box3(new THREE.Vector3(-650, -450, -2700), new THREE.Vector3(650, 450, 700)),
  // Keep the space between the camera and each fruit clear.
  avoid: stations.map((s) => ({ center: s.position.clone().add(new THREE.Vector3(0, 0, 50)), radius: 110 })),
});
stars.setPixelRatio(renderer.getPixelRatio());
scene.add(stars.group);

/* --------------------------------- Framing --------------------------------- */

// Camera spot for a fruit. On landscape screens the fruit sits left of centre
// (card on the right); on portrait it sits in the upper half (card below).
function viewFor(station) {
  const aspect = camera.aspect;
  const r = station.radius;
  const tan = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2));
  let d;
  let sx = 0;
  let sy = 0;
  if (aspect >= 1) {
    // fruit spans ~50% of the height, at most 36% of the width
    d = Math.max(r / (0.5 * tan), r / (0.36 * aspect * tan));
    sx = 0.2 * 2 * d * tan * aspect;
  } else {
    // fruit spans ~68% of the width, at most 40% of the height
    d = Math.max(r / (0.68 * aspect * tan), r / (0.4 * tan));
    sy = -0.22 * 2 * d * tan;
  }
  const offset = new THREE.Vector3(sx, sy, 0);
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

  // Swing out past the current fruit, curve through open space,
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

// From the last fruit, punch forward into hyperspace, flash, and fly back in.
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

/* ---------------------------------- Loop ----------------------------------- */

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  stars.setPixelRatio(renderer.getPixelRatio());
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

  stars.update(time, velocity, reducedMotion ? 0 : Math.min(1, speedNorm * 1.4));
  sky.position.copy(camera.position);
  planets.update(dt);
  for (const s of stations) {
    s.group.rotation.y += dt * s.spin;
    s.group.position.y = s.position.y + Math.sin(time * 0.8 + s.position.x) * 0.4;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

introFlight();
requestAnimationFrame(tick);
