import * as THREE from 'three';

// Faint dust specks that only show while the camera is moving fast, so the
// void still gives a sense of speed. The specks live in a box that wraps
// around the camera (in the shader), so the field is endless and cheap.

const vertex = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uVel;
  uniform float uStretch;
  uniform float uOpacity;
  uniform float uBox;
  attribute float aEnd;
  varying float vAlpha;
  void main() {
    vec3 rel = mod(position - uCam + uBox * 0.5, uBox) - uBox * 0.5;
    // Tail trails along the camera velocity: a motion-blurred speck.
    vec3 p = uCam + rel + uVel * uStretch * aEnd;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float fadeEdge = smoothstep(uBox * 0.5, uBox * 0.3, length(rel));
    float fadeNear = smoothstep(3.0, 18.0, -mv.z);
    vAlpha = uOpacity * (1.0 - aEnd) * fadeEdge * fadeNear;
  }
`;

const fragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vec3(0.85, 0.87, 0.92), vAlpha);
  }
`;

export function createDust({ count = 600, box = 420 } = {}) {
  const positions = new Float32Array(count * 6);
  const ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * box;
    const y = Math.random() * box;
    const z = Math.random() * box;
    positions.set([x, y, z, x, y, z], i * 6);
    ends[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uVel: { value: new THREE.Vector3() },
      uStretch: { value: 0.07 },
      uOpacity: { value: 0 },
      uBox: { value: box },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;

  return {
    object: lines,
    update(cameraPos, velocity, intensity) {
      mat.uniforms.uCam.value.copy(cameraPos);
      mat.uniforms.uVel.value.copy(velocity);
      mat.uniforms.uOpacity.value = intensity;
      lines.visible = intensity > 0.005;
    },
  };
}
