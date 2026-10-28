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

// Filets de vent qui filent autour de soi quand on vole vite.
const STREAKS = 70;
const SBOX = 50;

export class Streaks {
  constructor(scene) {
    this.base = new Float32Array(STREAKS * 3);
    for (let i = 0; i < STREAKS * 3; i++) this.base[i] = (Math.random() - 0.5) * SBOX;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
    this.mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.lines = new THREE.LineSegments(g, this.mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
    scene.add(this.lines);
  }

  update(cam, vx, vy, vz, night) {
    const sp = Math.hypot(vx, vy, vz);
    const vis = Math.min(1, Math.max(0, (sp - 12) / 20));
    this.mat.opacity = vis * (0.35 - night * 0.15);
    this.lines.visible = vis > 0.01;
    if (!this.lines.visible) return;
    const a = this.lines.geometry.getAttribute('position').array;
    const k = 0.045; // longueur du trait selon la vitesse
    for (let i = 0; i < STREAKS; i++) {
      const x = cam.x + swrap(this.base[i * 3] - cam.x);
      const y = cam.y + swrap(this.base[i * 3 + 1] - cam.y);
      const z = cam.z + swrap(this.base[i * 3 + 2] - cam.z);
      a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z;
      a[i * 6 + 3] = x - vx * k; a[i * 6 + 4] = y - vy * k; a[i * 6 + 5] = z - vz * k;
    }
    this.lines.geometry.getAttribute('position').needsUpdate = true;
  }
}

function swrap(v) {
  return ((((v + SBOX / 2) % SBOX) + SBOX) % SBOX) - SBOX / 2;
}

// Une petite volée d'oiseaux qui tourne paresseusement dans le ciel, le jour.
const BIRDS = 9;

export class Birds {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BIRDS * 6 * 3), 3));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x5c5470, side: THREE.DoubleSide, fog: true }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.anchor = new THREE.Vector3();
    this.init = false;
    this.offsets = Array.from({ length: BIRDS }, (_, i) => ({
      side: i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2),
      phase: Math.random() * 6,
      bob: Math.random() * 6,
    }));
  }

  update(t, center, groundY, night) {
    this.mesh.visible = night < 0.55;
    if (!this.mesh.visible) return;
    const target = new THREE.Vector3(center.x, Math.max(groundY, 0) + 38, center.z);
    if (!this.init || this.anchor.distanceTo(target) > 400) {
      this.anchor.copy(target);
      this.init = true;
    }
    this.anchor.lerp(target, 0.002);
    const R = 55, w = 0.07;
    const ang = t * w;
    const cx = this.anchor.x + Math.cos(ang) * R, cz = this.anchor.z + Math.sin(ang) * R;
    const hx = -Math.sin(ang), hz = Math.cos(ang); // direction du vol
    const px = -hz, pz = hx; // côté
    const a = this.mesh.geometry.getAttribute('position').array;
    let o = 0;
    for (const b of this.offsets) {
      const back = Math.abs(b.side) * 2.2;
      const bx = cx + px * b.side * 1.8 - hx * back;
      const bz = cz + pz * b.side * 1.8 - hz * back;
      const by = this.anchor.y + Math.sin(t * 0.6 + b.bob) * 0.8;
      const flap = Math.sin(t * 9 + b.phase) * 0.45;
      const span = 0.75;
      // deux ailes : (bec, bout d'aile, queue)
      for (const s of [-1, 1]) {
        a[o++] = bx + hx * 0.35; a[o++] = by; a[o++] = bz + hz * 0.35;
        a[o++] = bx + px * span * s - hx * 0.15; a[o++] = by + flap; a[o++] = bz + pz * span * s - hz * 0.15;
        a[o++] = bx - hx * 0.3; a[o++] = by; a[o++] = bz - hz * 0.3;
      }
    }
    this.mesh.geometry.getAttribute('position').needsUpdate = true;
  }
}
