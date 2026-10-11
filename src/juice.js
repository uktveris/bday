import * as THREE from 'three';

// A small pooled particle system for juice splashes when a fruit is tapped.
// Positions are updated on the CPU; with a few hundred particles that's cheap.

const vertex = /* glsl */ `
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
    vColor = aColor;
    vAlpha = aAlpha;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // Little highlight so droplets read as glossy.
    float hl = smoothstep(0.22, 0.0, length(c - vec2(-0.14, -0.14)));
    vec3 col = mix(vColor, vec3(1.0), hl * 0.7);
    gl_FragColor = vec4(col, vAlpha * smoothstep(0.5, 0.38, d));
  }
`;

export function createJuice(max = 240) {
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const alphas = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max); // remaining seconds; <= 0 means free
  const maxLife = new Float32Array(max);
  const baseSize = new Float32Array(max);

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage);
  const colorAttr = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aAlpha', alphaAttr);
  geo.setAttribute('aColor', colorAttr);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: 1 } },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;

  let cursor = 0;
  let active = 0;
  const color = new THREE.Color();
  const white = new THREE.Color('#ffffff');

  function burst(origin, direction, hex, count = 26) {
    color.set(hex);
    for (let n = 0; n < count; n++) {
      const i = cursor;
      cursor = (cursor + 1) % max;
      const sparkle = Math.random() < 0.2;
      origin.toArray(positions, i * 3);
      // Spray in a cone around the surface normal.
      const spread = 0.9;
      const dx = direction.x + (Math.random() - 0.5) * spread * 2;
      const dy = direction.y + (Math.random() - 0.5) * spread * 2;
      const dz = direction.z + (Math.random() - 0.5) * spread * 2;
      const len = Math.hypot(dx, dy, dz) || 1;
      const speed = 6 + Math.random() * 14;
      vel[i * 3] = (dx / len) * speed;
      vel[i * 3 + 1] = (dy / len) * speed;
      vel[i * 3 + 2] = (dz / len) * speed;
      (sparkle ? white : color).toArray(colors, i * 3);
      baseSize[i] = sparkle ? 0.35 + Math.random() * 0.3 : 0.6 + Math.random() * 0.9;
      maxLife[i] = life[i] = 0.7 + Math.random() * 0.6;
    }
    colorAttr.needsUpdate = true;
    active = max;
  }

  function update(dt) {
    if (active === 0) return;
    let alive = 0;
    const drag = Math.exp(-dt * 3.2);
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) {
        alphas[i] = 0;
        continue;
      }
      life[i] -= dt;
      alive++;
      vel[i * 3] *= drag;
      vel[i * 3 + 1] = vel[i * 3 + 1] * drag - dt * 6; // a little "gravity" for a juicy arc
      vel[i * 3 + 2] *= drag;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = Math.max(0, life[i] / maxLife[i]);
      alphas[i] = Math.min(1, t * 2.5);
      sizes[i] = baseSize[i] * (0.4 + 0.6 * t);
    }
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    if (alive === 0) active = 0;
  }

  return {
    points,
    burst,
    update,
    setPixelRatio(pr) {
      mat.uniforms.uPixelRatio.value = pr;
    },
  };
}
