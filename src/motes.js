import * as THREE from 'three';

// Little white motes drifting slowly around the current stop, so the coloured
// void feels alive. One field is moved to whichever stop the camera parks at;
// it fades out as soon as a flight starts and back in after arrival, so it
// never shows while switching. All the motion happens in the vertex shader.

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform vec3 uCenter;
  uniform vec3 uSize;
  attribute vec3 aSeed;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vec3 p = position; // unit box, -0.5..0.5
    // Slow upward drift that wraps around, plus a lazy sideways sway.
    p.y = mod(p.y + 0.5 + uTime * 0.012 * (0.5 + aSeed.x), 1.0) - 0.5;
    p.x += sin(uTime * 0.3 * (0.5 + aSeed.y) + aSeed.z * 6.2831) * 0.02;
    p.z += cos(uTime * 0.25 * (0.5 + aSeed.x) + aSeed.y * 6.2831) * 0.02;

    vec4 mv = modelViewMatrix * vec4(uCenter + p * uSize, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uSizeScale * uPixelRatio * (300.0 / -mv.z), 9.0 * uPixelRatio);

    // Fade at the edges of the box (so wrapping is invisible) and twinkle.
    float edge = smoothstep(0.5, 0.36, max(abs(p.x), max(abs(p.y), abs(p.z))));
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed.z * 1.5) + aSeed.x * 6.2831);
    vAlpha = edge * twinkle;
  }
`;

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0), a * a * vAlpha * uOpacity);
  }
`;

export function createMotes(count = 350) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = Math.random() - 0.5;
    positions[i * 3 + 1] = Math.random() - 0.5;
    positions[i * 3 + 2] = Math.random() - 0.5;
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
    sizes[i] = Math.random() < 0.1 ? 1.0 + Math.random() * 0.6 : 0.4 + Math.random() * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uSizeScale: { value: 1 },
    uOpacity: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uSize: { value: new THREE.Vector3(1, 1, 1) },
  };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  points.visible = false;

  let opacity = 0;

  return {
    points,
    setPixelRatio(pr) {
      uniforms.uPixelRatio.value = pr;
    },
    // Surround a stop: wide and tall around it, mostly behind it, a little in
    // front, but never reaching the camera.
    placeAt(center, radius) {
      uniforms.uSize.value.set(radius * 5, radius * 4.5, radius * 4.5);
      uniforms.uCenter.value.copy(center).add(new THREE.Vector3(0, 0, -radius * 0.75));
      uniforms.uSizeScale.value = radius / 12; // same on-screen size at every stop
    },
    update(time, dt, show) {
      // Quick fade-out when leaving, gentle fade-in after arriving.
      const rate = show ? 0.9 : 6;
      opacity += ((show ? 1 : 0) - opacity) * (1 - Math.exp(-dt * rate));
      uniforms.uOpacity.value = opacity;
      uniforms.uTime.value = time;
      points.visible = opacity > 0.003;
    },
  };
}
