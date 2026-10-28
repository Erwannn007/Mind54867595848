// Formes procédurales du monde : arbres, rochers, maisons, ruines, îles…
// Chaque fonction ajoute ses triangles à un Builder et déclare collisions / halos.

import * as THREE from 'three';
import { Builder, proto, hex } from './builder.js';
import { WATER_LEVEL } from './world.js';

// Prisme de toit : largeur W (x), profondeur D (z), hauteur H, faîtage le long de x.
function roofGeometry() {
  const W = 0.5, D = 0.5, H = 1;
  const v = [
    // pans
    -W, 0, D, W, 0, D, W, H, 0,
    -W, 0, D, W, H, 0, -W, H, 0,
    W, 0, -D, -W, 0, -D, -W, H, 0,
    W, 0, -D, -W, H, 0, W, H, 0,
    // pignons
    W, 0, D, W, 0, -D, W, H, 0,
    -W, 0, -D, -W, 0, D, -W, H, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

const base = (g) => g.translate(0, 0.5, 0); // pied à y = 0, hauteur 1

export const P = {
  trunk: proto(base(new THREE.CylinderGeometry(0.17, 0.27, 1, 5))),
  crowns: [1, 2, 3].map((s) => proto(new THREE.IcosahedronGeometry(1, 0), { jitter: 0.16, seed: s })),
  crownSoft: proto(new THREE.IcosahedronGeometry(1, 1), { jitter: 0.08, seed: 9 }),
  cone: proto(base(new THREE.ConeGeometry(1, 1, 7))),
  rock: [4, 5].map((s) => proto(new THREE.DodecahedronGeometry(1, 0), { jitter: 0.2, seed: s })),
  box: proto(base(new THREE.BoxGeometry(1, 1, 1))),
  cyl: proto(base(new THREE.CylinderGeometry(0.5, 0.5, 1, 8))),
  cyl6: proto(base(new THREE.CylinderGeometry(0.5, 0.5, 1, 6))),
  roof: proto(roofGeometry()),
  islandRock: proto(new THREE.ConeGeometry(1, 1, 9, 2).rotateX(Math.PI).translate(0, -0.5, 0), { jitter: 0.12, seed: 21 }),
  islandTop: proto(base(new THREE.CylinderGeometry(1, 0.94, 1, 9)), { jitter: 0.04, seed: 22 }),
};

const M = Builder.matrix;

export const COLORS = {
  bark: hex(0x8d6f5c), barkPale: hex(0xd9cfe2),
  greens: [hex(0x8fbf86), hex(0x7db793), hex(0x6f9f78), hex(0xa4c98a), hex(0x93c4a2)],
  golds: [hex(0xe6bd6a), hex(0xe89f72), hex(0xd8c47e), hex(0xb9c573)],
  blossom: [hex(0xf2b9c9), hex(0xf6cad6), hex(0xe9a8c0)],
  dream: [hex(0xb9a3e3), hex(0xe3b2dc), hex(0x9fc3ea), hex(0xcdb6f0)],
  pine: [hex(0x6c998e), hex(0x7aa79a), hex(0x5f8a86)],
  rock: [hex(0xa9a3b5), hex(0x9e9cab), hex(0xb4abb5)],
  moss: hex(0x8fb47e),
  wall: [hex(0xf0e4cf), hex(0xe9d8bd), hex(0xc69a74)],
  timber: hex(0x7d5b48),
  roofs: [hex(0xd88d80), hex(0x8492bd), hex(0x93b083), hex(0xa58fc4), hex(0xe0a77c)],
  stone: hex(0xb7b2bc),
  window: hex(0xffd88f),
  lantern: hex(0xffd391),
  pearl: hex(0xe9e4f3),
  wood: hex(0xa47c5d),
};

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// ——— Végétation ———

export function roundTree(B, x, y, z, palette, opts = {}) {
  const r = B.rand;
  const h = (2.3 + r() * 1.7) * (opts.scale || 1);
  const rad = (1.5 + r() * 0.8) * (opts.scale || 1);
  const rot = r() * Math.PI * 2;
  B.add(P.trunk, M(x, y - 0.2, z, rot, 1 + rad * 0.12, h + 0.6, 1 + rad * 0.12), opts.bark || COLORS.bark, { jitter: 0.04, ao: 0.25 });
  const col = pick(r, palette);
  const crown = pick(r, P.crowns);
  const top = y + h + rad * 0.5;
  const sw = { sway: 0.55, swayBase: y + h * 0.5, swayH: h + rad, glow: opts.glow || 0, jitter: 0.07, ao: 0.35 };
  B.add(crown, M(x, top, z, rot, rad, rad * 0.86, rad), col, sw);
  if (r() < 0.65) {
    const a = r() * Math.PI * 2, d = rad * 0.55;
    const s = rad * (0.55 + r() * 0.2);
    B.add(pick(r, P.crowns), M(x + Math.cos(a) * d, top - rad * 0.25, z + Math.sin(a) * d, rot + 1, s, s * 0.85, s), pick(r, palette), sw);
  }
  if (r() < 0.4) {
    const s = rad * 0.5;
    B.add(crown, M(x, top + rad * 0.6, z, rot + 2, s, s * 0.9, s), col, sw);
  }
  return h;
}

export function pineTree(B, x, y, z, opts = {}) {
  const r = B.rand;
  const s = (0.85 + r() * 0.5) * (opts.scale || 1);
  const rot = r() * Math.PI * 2;
  B.add(P.trunk, M(x, y - 0.2, z, rot, 1.1 * s, 1.6 * s, 1.1 * s), COLORS.bark, { ao: 0.25 });
  const col = pick(r, COLORS.pine);
  const tiers = [[1.9, 2.4, 1.0], [1.5, 2.1, 2.3], [1.05, 1.9, 3.5], [0.6, 1.4, 4.7]];
  tiers.forEach(([rad, hh, yy], i) => {
    const c = i === 3 && opts.frost ? COLORS.pearl : col;
    B.add(P.cone, M(x, y + yy * s, z, rot + i, rad * s, hh * s, rad * s), c, {
      sway: 0.35, swayBase: y + s, swayH: 5 * s, jitter: 0.06, ao: 0.3,
    });
  });
}

export function bush(B, x, y, z, palette, opts = {}) {
  const r = B.rand;
  const s = 0.6 + r() * 0.6;
  const col = pick(r, palette);
  const o = { sway: 0.15, swayBase: y, swayH: 1.5, glow: opts.glow || 0, jitter: 0.08, ao: 0.4 };
  B.add(pick(r, P.crowns), M(x, y + s * 0.45, z, r() * 6, s * 1.2, s * 0.8, s * 1.2), col, o);
  if (r() < 0.5) B.add(pick(r, P.crowns), M(x + s * 0.8, y + s * 0.3, z + s * 0.3, r() * 6, s * 0.8, s * 0.6, s * 0.8), col, o);
}

export function rock(B, x, y, z, size, mossy = false) {
  const r = B.rand;
  const rot = r() * Math.PI * 2;
  B.add(pick(r, P.rock), M(x, y + size * 0.25, z, rot, size * (1 + r() * 0.4), size * (0.55 + r() * 0.3), size), pick(r, COLORS.rock), { jitter: 0.08, ao: 0.3 });
  if (mossy) B.add(P.crowns[0], M(x, y + size * 0.68, z, rot, size * 0.5, size * 0.14, size * 0.45), COLORS.moss, { jitter: 0.06 });
}

// ——— Lumières ———

export function lantern(B, halos, x, y, z, rot = 0) {
  B.add(P.box, M(x, y, z, rot, 0.14, 1.7, 0.14), COLORS.timber);
  B.add(P.box, M(x, y + 1.62, z, rot, 0.34, 0.36, 0.34), COLORS.lantern, { glow: 1.4, jitter: 0 });
  B.add(P.roof, M(x, y + 1.98, z, rot, 0.5, 0.25, 0.5), COLORS.timber);
  halos.push({ x, y: y + 1.8, z, size: 2.6, color: [1.0, 0.72, 0.38], flicker: 0.4 });
}

export function campfire(B, halos, x, y, z) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    B.add(P.rock[0], M(x + Math.cos(a) * 0.75, y + 0.08, z + Math.sin(a) * 0.75, a, 0.22, 0.16, 0.22), COLORS.rock[1]);
  }
  for (let i = 0; i < 3; i++) B.add(P.box, M(x, y + 0.1, z, i * 1.05, 0.14, 0.14, 1.0, 0, 0.2), COLORS.timber);
  B.add(P.cone, M(x, y + 0.15, z, 0, 0.35, 0.7, 0.35), hex(0xffb36b), { glow: 1.8, jitter: 0, sway: 0.4, swayBase: y, swayH: 0.8 });
  B.add(P.cone, M(x, y + 0.15, z, 0.5, 0.2, 0.5, 0.2), hex(0xffe0a0), { glow: 2.0, jitter: 0 });
  halos.push({ x, y: y + 0.7, z, size: 4.2, color: [1.0, 0.6, 0.3], flicker: 1 });
}

// ——— Architecture ———

export function house(B, halos, colliders, x, y, z, rot, opts = {}) {
  const r = B.rand;
  const w = opts.w || 3.6 + r() * 1.2, d = opts.d || 3.2 + r() * 0.8, wallH = 2.3 + r() * 0.4;
  const lift = opts.lift || 0;
  const parent = M(x, y + lift, z, rot);
  const wall = pick(r, COLORS.wall);
  const roofC = pick(r, COLORS.roofs);
  const L = (lx, ly, lz, sx, sy, sz, ry = 0, rx = 0, rz = 0) => M(lx, ly, lz, ry, sx, sy, sz, rx, rz, parent);

  if (lift > 0) {
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      B.add(P.box, M(px * w * 0.42, -lift - 2, pz * d * 0.42, 0, 0.22, lift + 2, 0.22, 0, 0, parent), COLORS.timber);
    }
    B.add(P.box, L(0, -0.15, 0, w + 0.6, 0.15, d + 0.8), COLORS.wood);
  } else {
    B.add(P.box, L(0, -0.6, 0, w + 0.3, 0.9, d + 0.3), COLORS.stone, { ao: 0.3 });
  }
  B.add(P.box, L(0, 0.2, 0, w, wallH - 0.2, d), wall, { jitter: 0.03, ao: 0.15 });
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.add(P.box, L(px * w * 0.5, 0.2, pz * d * 0.5, 0.2, wallH - 0.2, 0.2), COLORS.timber);
  }
  B.add(P.box, L(0, wallH - 0.1, 0, w + 0.15, 0.18, d + 0.15), COLORS.timber);
  B.add(P.roof, L(0, wallH, 0, w + 0.8, 1.5 + r() * 0.5, d + 0.9), roofC, { jitter: 0.06 });
  // porte et fenêtres (lumineuses la nuit)
  B.add(P.box, L(0, 0.2, d * 0.5 + 0.03, 0.85, 1.55, 0.08), COLORS.timber);
  B.add(P.box, L(-w * 0.3, 1.1, d * 0.5 + 0.03, 0.6, 0.55, 0.06), COLORS.window, { glow: 1.2, jitter: 0 });
  B.add(P.box, L(w * 0.3, 1.1, d * 0.5 + 0.03, 0.6, 0.55, 0.06), COLORS.window, { glow: 1.2, jitter: 0 });
  B.add(P.box, L(w * 0.5 + 0.03, 1.1, 0, 0.06, 0.55, 0.6), COLORS.window, { glow: 1.2, jitter: 0 });
  B.add(P.box, L(-w * 0.5 - 0.03, 1.1, 0, 0.06, 0.55, 0.6), COLORS.window, { glow: 1.2, jitter: 0 });
  // cheminée
  if (r() < 0.7) B.add(P.box, L(w * 0.25, wallH + 0.3, -d * 0.2, 0.45, 1.5, 0.45), COLORS.stone);
  // lanterne près de la porte
  if (opts.lantern !== false) {
    const lx = w * 0.5 + 0.4, lz = d * 0.5 + 0.5;
    const c = Math.cos(rot), s = Math.sin(rot);
    lantern(B, halos, x + lx * c + lz * s, y + lift, z - lx * s + lz * c, rot);
  }
  colliders.push({ x, z, r: Math.max(w, d) * 0.62 });
}

export function well(B, halos, colliders, x, y, z) {
  B.add(P.cyl, M(x, y - 0.3, z, 0, 2, 1.1, 2), COLORS.stone, { ao: 0.3 });
  B.add(P.cyl, M(x, y + 0.75, z, 0, 1.5, 0.08, 1.5), hex(0x6f9fb0), { jitter: 0 });
  B.add(P.box, M(x - 0.9, y, z, 0, 0.16, 2.2, 0.16), COLORS.timber);
  B.add(P.box, M(x + 0.9, y, z, 0, 0.16, 2.2, 0.16), COLORS.timber);
  B.add(P.roof, M(x, y + 2.1, z, Math.PI / 2, 1.6, 0.9, 2.4), COLORS.roofs[0]);
  colliders.push({ x, z, r: 1.2 });
}

export function village(B, halos, colliders, world, poi) {
  const r = B.rand;
  const n = 3 + Math.floor(r() * 3);
  const a0 = r() * Math.PI * 2;
  well(B, halos, colliders, poi.x, poi.h, poi.z);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4;
    const d = 10 + r() * 4;
    const hx = poi.x + Math.cos(a) * d, hz = poi.z + Math.sin(a) * d;
    // la façade (+z local) regarde la place
    const rot = Math.atan2(poi.x - hx, poi.z - hz);
    house(B, halos, colliders, hx, world.heightAt(hx, hz), hz, rot);
  }
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i + 0.5) * (Math.PI * 2 / n);
    const lx = poi.x + Math.cos(a) * 6.5, lz = poi.z + Math.sin(a) * 6.5;
    lantern(B, halos, lx, world.heightAt(lx, lz), lz, a);
  }
}

export function cabin(B, halos, colliders, world, poi) {
  const dx = Math.cos(poi.dir), dz = Math.sin(poi.dir);
  const rot = Math.atan2(dx, dz);
  house(B, halos, colliders, poi.x, poi.h, poi.z, rot, { w: 3.2, d: 3, lift: 0.7, lantern: false });
  // ponton vers l'eau
  const deckY = WATER_LEVEL + 0.55;
  for (let i = 0; i < 12; i++) {
    const t = 2.4 + i * 0.9;
    const px = poi.x + dx * t, pz = poi.z + dz * t;
    const gy = world.heightAt(px, pz);
    const y = Math.max(deckY, gy + 0.1);
    B.add(P.box, M(px, y, pz, rot, 1.8, 0.12, 0.96), COLORS.wood, { jitter: 0.08 });
    if (i % 3 === 1) {
      for (const sgn of [-1, 1]) {
        const ox = Math.cos(rot) * 0.9 * sgn, oz = -Math.sin(rot) * 0.9 * sgn;
        B.add(P.box, M(px + ox, Math.min(gy, y) - 0.5, pz + oz, 0, 0.16, y - Math.min(gy, y) + 0.8, 0.16), COLORS.timber);
      }
    }
  }
  const ex = poi.x + dx * 12.6, ez = poi.z + dz * 12.6;
  lantern(B, halos, ex, Math.max(deckY, world.heightAt(ex, ez)) + 0.1, ez, rot);
  const bx = poi.x + dx * 9 - Math.cos(rot) * 1.6, bz = poi.z + dz * 9 + Math.sin(rot) * 1.6;
  boat(B, bx, WATER_LEVEL, bz, rot + 0.3);
}

export function boat(B, x, y, z, rot) {
  B.add(P.roof, M(x, y + 0.45, z, rot + Math.PI / 2, 2.6, 0.6, 1.1, Math.PI), COLORS.wood, { jitter: 0.06 });
  B.add(P.box, M(x, y + 0.38, z, rot, 0.9, 0.05, 2.2), hex(0xc9a27e));
}

export function ruins(B, halos, colliders, world, poi) {
  const r = B.rand;
  const n = 7 + Math.floor(r() * 4);
  const R = 6 + r() * 2;
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
    const tx = poi.x + Math.cos(a) * d, tz = poi.z + Math.sin(a) * d;
    B.add(P.box, M(tx, world.heightAt(tx, tz) - 0.12, tz, r() * 0.4, 1.5, 0.3, 1.5, 0, (r() - 0.5) * 0.1), COLORS.stone, { jitter: 0.1 });
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = poi.x + Math.cos(a) * R, pz = poi.z + Math.sin(a) * R;
    const gy = world.heightAt(px, pz);
    const roll = r();
    if (roll < 0.25) {
      // colonne tombée, mangée par la mousse
      B.add(P.cyl, M(px, gy + 0.45, pz, r() * 6, 0.9, 3.2, 0.9, Math.PI / 2), COLORS.stone, { jitter: 0.08 });
      B.add(P.crowns[1], M(px, gy + 0.85, pz, r() * 6, 0.9, 0.3, 0.9), COLORS.moss);
    } else {
      const h = roll > 0.75 ? 3.8 + r() * 1.2 : 0.8 + r() * 2.4;
      B.add(P.cyl, M(px, gy - 0.3, pz, r() * 6, 0.9, h + 0.3, 0.9), COLORS.stone, { jitter: 0.08, ao: 0.3 });
      B.add(P.box, M(px, gy - 0.3, pz, 0, 1.25, 0.6, 1.25), COLORS.stone);
      if (r() < 0.6) B.add(P.crowns[2], M(px, gy + h, pz, r() * 6, 0.65, 0.3, 0.65), COLORS.moss, { sway: 0.1, swayBase: gy, swayH: h });
      colliders.push({ x: px, z: pz, r: 0.7 });
    }
  }
  // arche
  const a = r() * Math.PI * 2;
  const ax = poi.x + Math.cos(a) * 2, az = poi.z + Math.sin(a) * 2;
  const rot = a + Math.PI / 2;
  const ox = Math.cos(rot) * 1.6, oz = -Math.sin(rot) * 1.6;
  for (const sgn of [-1, 1]) {
    const px = ax + ox * sgn, pz = az + oz * sgn;
    B.add(P.box, M(px, world.heightAt(px, pz) - 0.3, pz, rot, 0.7, 4.3, 0.7), COLORS.stone, { ao: 0.3 });
    colliders.push({ x: px, z: pz, r: 0.6 });
  }
  const ay = world.heightAt(ax, az);
  B.add(P.box, M(ax, ay + 3.9, az, rot, 4.2, 0.6, 0.8), COLORS.stone);
  B.add(P.crowns[0], M(ax, ay + 4.5, az, rot, 1.4, 0.3, 0.6), COLORS.moss, { sway: 0.15, swayBase: ay, swayH: 4 });
}

export function stoneCircle(B, halos, colliders, world, poi) {
  const r = B.rand;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = poi.x + Math.cos(a) * 6, pz = poi.z + Math.sin(a) * 6;
    const gy = world.heightAt(px, pz);
    B.add(P.rock[i % 2], M(px, gy + 1.3, pz, a, 0.55, 1.8 + r() * 0.6, 0.4), COLORS.pearl, { glow: 0.35, jitter: 0.05 });
    colliders.push({ x: px, z: pz, r: 0.6 });
  }
  B.add(P.rock[0], M(poi.x, poi.h + 0.2, poi.z, 0, 1.3, 0.35, 1.3), COLORS.pearl, { glow: 0.5 });
  halos.push({ x: poi.x, y: poi.h + 1.4, z: poi.z, size: 5, color: [0.6, 0.8, 1.0], flicker: 0.15 });
}

export function floatingIsland(B, halos, poi) {
  const r = B.rand;
  const R = 6 + r() * 5;
  const { x, z } = poi;
  const y = poi.h;
  B.add(P.islandRock, M(x, y, z, r() * 6, R * 0.95, R * 1.7, R * 0.95), COLORS.rock[0], { jitter: 0.06, ao: 0.45 });
  B.add(P.islandTop, M(x, y - 0.3, z, r() * 6, R, 1.0, R), hex(0xa7cf95), { jitter: 0.05 });
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = r() * R * 0.5;
    roundTree(B, x + Math.cos(a) * d, y + 0.6, z + Math.sin(a) * d, r() < 0.5 ? COLORS.blossom : COLORS.dream, { glow: 0.15 });
  }
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2, d = R * (1.3 + r());
    const s = 0.6 + r() * 1.4;
    B.add(P.islandRock, M(x + Math.cos(a) * d, y - 2 + (r() - 0.5) * 6, z + Math.sin(a) * d, r() * 6, s, s * 1.6, s), COLORS.rock[1]);
  }
  halos.push({ x, y: y - R * 0.6, z, size: R * 1.4, color: [0.7, 0.75, 1.0], flicker: 0 });
}
