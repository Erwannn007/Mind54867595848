// Lucioles la nuit, poussières dorées le jour : un nuage de points qui entoure le joueur.

import * as THREE from 'three';
import { shared } from './materials.js';

const COUNT = 140;
const BOX = 44;

export class Motes {
  constructor(scene) {
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOX;
      pos[i * 3 + 1] = Math.random();
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOX;
      seed[i] = Math.random();
    }
    this.base = pos.slice();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = {
      uTime: shared.uTime,
      uNight: shared.uNight,
      uPx: shared.uPx,
      uDay: { value: new THREE.Color(1, 0.9, 0.6) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uNight, uPx;
        varying float vA;
        varying float vSeed;
        void main() {
          vec3 p = position;
          float t = uTime * (0.25 + aSeed * 0.3) + aSeed * 40.0;
          p += vec3(sin(t * 1.3) * 1.2, sin(t * 0.9) * 0.6, cos(t * 1.1) * 1.2);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float size = mix(0.05, 0.16, uNight);
          gl_PointSize = clamp(size * uPx / -mv.z, 1.0, 8.0);
          gl_Position = projectionMatrix * mv;
          float pulse = 0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 30.0);
          vA = mix(0.35, pulse, uNight) * smoothstep(40.0, 10.0, -mv.z);
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        uniform vec3 uDay;
        varying float vA;
        varying float vSeed;
        void main() {
          vec3 night = mix(vec3(0.85, 1.0, 0.55), vec3(0.6, 0.95, 1.0), step(0.8, vSeed));
          vec3 c = mix(uDay, night, uNight);
          gl_FragColor = vec4(c, vA * mix(0.14, 1.0, uNight));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }

  // Replie les points dans une boîte centrée sur le joueur, posés au-dessus du sol.
  update(center, surfaceHeight) {
    const pos = this.points.geometry.getAttribute('position');
    const a = pos.array, b = this.base;
    for (let i = 0; i < COUNT; i++) {
      const bx = b[i * 3], bz = b[i * 3 + 2];
      const x = center.x + wrap(bx - center.x);
      const z = center.z + wrap(bz - center.z);
      if (x !== a[i * 3] || z !== a[i * 3 + 2]) {
        a[i * 3] = x;
        a[i * 3 + 2] = z;
        a[i * 3 + 1] = Math.max(surfaceHeight(x, z), 0) + 0.6 + b[i * 3 + 1] * 2.8;
      }
    }
    pos.needsUpdate = true;
  }
}

function wrap(v) {
  return ((((v + BOX / 2) % BOX) + BOX) % BOX) - BOX / 2;
}
