// Assemble de nombreuses petites formes en une seule géométrie (un draw call par chunk).

import * as THREE from 'three';
import { SPRITE_COUNT } from './textures.js';

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// Couleur hexadécimale -> [r,g,b] sRGB 0..1
export function hex(h) {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

// Prototype : positions non indexées + bornes en Y.
export function proto(geometry, { jitter = 0, seed = 1 } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = Float32Array.from(g.getAttribute('position').array);
  if (jitter > 0) {
    // déformation cohérente : un même sommet partagé bouge pareil
    for (let i = 0; i < pos.length; i += 3) {
      const kx = Math.round(pos[i] * 1000), ky = Math.round(pos[i + 1] * 1000), kz = Math.round(pos[i + 2] * 1000);
      let h = Math.imul(kx ^ seed, 73856093) ^ Math.imul(ky, 19349663) ^ Math.imul(kz, 83492791);
      const r = (n) => {
        h = Math.imul(h ^ (h >>> 15), 2246822507 + n);
        h ^= h >>> 13;
        return ((h >>> 0) / 4294967296 - 0.5) * 2;
      };
      pos[i] += r(1) * jitter;
      pos[i + 1] += r(2) * jitter;
      pos[i + 2] += r(3) * jitter;
    }
  }
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    minY = Math.min(minY, pos[i]);
    maxY = Math.max(maxY, pos[i]);
  }
  geometry.dispose();
  return { pos, minY, maxY };
}

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export class Builder {
  constructor(rand) {
    this.rand = rand;
    this.pos = [];
    this.col = [];
    this.uv = [];
    this.sway = [];
    this.glow = [];
    this.nrm = null; // seulement pour les sprites
  }

  get count() {
    return this.pos.length / 3;
  }

  // Matrice locale TRS (rotation en radians, ordre YXZ).
  static matrix(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0, parent = null) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    const m = new THREE.Matrix4().compose(_p, _q, _s);
    if (parent) m.premultiply(parent);
    return m;
  }

  /**
   * Ajoute un prototype transformé.
   * opts : sway (amplitude), swayBase/swayH (hauteur monde du pied / de la hauteur qui balance),
   *        glow, jitter (variation de teinte par face), ao (assombrit le bas de l'objet).
   */
  add(p, matrix, rgb, opts = {}) {
    const { sway = 0, swayBase = 0, swayH = 1, glow = 0, jitter = 0.05, ao = 0 } = opts;
    const lr = srgbToLinear(rgb[0]), lg = srgbToLinear(rgb[1]), lb = srgbToLinear(rgb[2]);
    const src = p.pos;
    const span = p.maxY - p.minY || 1;
    const e = matrix.elements;
    const P = this.pos, C = this.col, U = this.uv, S = this.sway, G = this.glow;
    for (let i = 0; i < src.length; i += 9) {
      const f = 1 + (this.rand() - 0.5) * 2 * jitter;
      const base = P.length;
      for (let k = 0; k < 9; k += 3) {
        const x = src[i + k], y = src[i + k + 1], z = src[i + k + 2];
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        P.push(wx, wy, wz);
        const shade = ao > 0 ? 1 - ao * (1 - (y - p.minY) / span) : 1;
        C.push(lr * f * shade, lg * f * shade, lb * f * shade);
        S.push(sway > 0 ? sway * Math.min(Math.max((wy - swayBase) / swayH, 0), 1) : 0);
        G.push(glow);
      }
      // UV par face : projection selon l'axe dominant de la normale.
      const ax = P[base + 3] - P[base], ay = P[base + 4] - P[base + 1], az = P[base + 5] - P[base + 2];
      const bx = P[base + 6] - P[base], by = P[base + 7] - P[base + 1], bz = P[base + 8] - P[base + 2];
      const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
      for (let k = 0; k < 9; k += 3) {
        const x = P[base + k], y = P[base + k + 1], z = P[base + k + 2];
        if (ny >= nx && ny >= nz) U.push(x, z);
        else if (nx >= nz) U.push(z, y);
        else U.push(x, y);
      }
    }
  }

  // Deux quads croisés portant un sprite pixel art de l'atlas.
  addSprite(x, y, z, w, h, tile, rgb, { rot = 0, sway = 0.6, glow = 0 } = {}) {
    if (!this.nrm) this.nrm = [];
    const lr = srgbToLinear(rgb[0]), lg = srgbToLinear(rgb[1]), lb = srgbToLinear(rgb[2]);
    const inset = 0.5 / (16 * SPRITE_COUNT);
    const u0 = tile / SPRITE_COUNT + inset, u1 = (tile + 1) / SPRITE_COUNT - inset;
    const hw = w / 2;
    for (let q = 0; q < 2; q++) {
      const a = rot + q * Math.PI / 2;
      const dx = Math.cos(a) * hw, dz = Math.sin(a) * hw;
      // sommets : bas-gauche, bas-droit, haut-droit, haut-gauche
      const vx = [x - dx, x + dx, x + dx, x - dx];
      const vy = [y, y, y + h, y + h];
      const vz = [z - dz, z + dz, z + dz, z - dz];
      const vu = [u0, u1, u1, u0];
      const vv = [0, 0, 1, 1];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        this.pos.push(vx[k], vy[k], vz[k]);
        this.col.push(lr, lg, lb);
        this.uv.push(vu[k], vv[k]);
        this.sway.push(k >= 2 ? sway : 0);
        this.glow.push(glow);
        this.nrm.push(0, 1, 0);
      }
    }
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    if (this.nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    else g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
