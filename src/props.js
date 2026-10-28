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
  cbox: proto(new THREE.BoxGeometry(1, 1, 1)),
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

const STYLES = [
  { // colombages : enduit crème, poutres sombres
    wall: [hex(0xf0e4cf), hex(0xf3e6d6), hex(0xead6c4)], roofs: [hex(0xd88d80), hex(0xc98378), hex(0xe0a77c)],
    door: [hex(0x8fb09a), hex(0x8492bd)], shutter: [hex(0x93b6a2), hex(0x9aa6d0), hex(0xd99aa8)], roofThick: 0.16,
  },
  { // planches de bois chaud, toit d'ardoise
    wall: [hex(0xc69a74), hex(0xb98e6a), hex(0xcfa37c)], roofs: [hex(0x8492bd), hex(0x7f8fb0), hex(0x93b083)],
    door: [hex(0xd99aa8), hex(0xe6c47a)], shutter: [hex(0xf0e4cf), hex(0xe9b9c4)], roofThick: 0.16,
  },
  { // chaumière de pierre claire, toit de chaume
    wall: [hex(0xcfc9cf), hex(0xd8d0cc), hex(0xc4c0c8)], roofs: [hex(0xe1c27e), hex(0xd9b874), hex(0xa58fc4)],
    door: [hex(0x8a6a58), hex(0x8fb09a)], shutter: [hex(0xa58fc4), hex(0x93b6a2)], roofThick: 0.32,
  },
];

const FLOWERS = [hex(0xf2b9c9), hex(0xfce39a), hex(0xc6b3ee), hex(0xffffff), hex(0xe9a0b0), hex(0xf6c79a)];

// Contexte de construction : repère local de la maison, collisions et halos en coordonnées monde.
function frame(B, out, x, y, z, rot) {
  const parent = M(x, y, z, rot);
  const c = Math.cos(rot), s = Math.sin(rot);
  const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  return {
    parent, W,
    L: (lx, ly, lz, sx, sy, sz, ry = 0, rx = 0, rz = 0) => M(lx, ly, lz, ry, sx, sy, sz, rx, rz, parent),
    seg(ax, az, bx, bz, y0, y1, th, color, opts = {}, collide = true) {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
      if (len < 0.01) return;
      B.add(P.box, M((ax + bx) / 2, y0, (az + bz) / 2, Math.atan2(-dz, dx), len, y1 - y0, th, 0, 0, parent), color, opts);
      if (collide) {
        const [wax, waz] = W(ax, az), [wbx, wbz] = W(bx, bz);
        out.colliders.push({ seg: true, ax: wax, az: waz, bx: wbx, bz: wbz, r: th / 2 });
      }
    },
    circle(lx, lz, r) {
      const [wx, wz] = W(lx, lz);
      out.colliders.push({ x: wx, z: wz, r });
    },
    halo(lx, ly, lz, size, color, flicker) {
      const [wx, wz] = W(lx, lz);
      out.halos.push({ x: wx, y: y + ly, z: wz, size, color, flicker });
    },
    smoke(lx, ly, lz) {
      const [wx, wz] = W(lx, lz);
      out.smoke.push({ x: wx, y: y + ly, z: wz });
    },
  };
}

// Fenêtre posée dans un mur ; (nx, nz) = direction vers l'extérieur.
function windowAt(B, F, cx, cz, nx, nz, t, st, opts = {}) {
  const r = B.rand;
  const sub = M(cx, 0, cz, Math.atan2(nx, nz), 1, 1, 1, 0, 0, F.parent);
  const Lw = (px, py, pz, sx, sy, sz) => M(px, py, pz, 0, sx, sy, sz, 0, 0, sub);
  B.add(P.box, Lw(0, 0.72, 0, 1.0, 0.94, t + 0.04), COLORS.timber);
  B.add(P.box, Lw(0, 0.8, 0, 0.78, 0.76, t + 0.1), COLORS.window, { glow: 1.1, jitter: 0 });
  B.add(P.box, Lw(0, 0.8, 0, 0.06, 0.76, t + 0.13), COLORS.timber, { jitter: 0 });
  B.add(P.box, Lw(0, 1.15, 0, 0.78, 0.06, t + 0.13), COLORS.timber, { jitter: 0 });
  if (opts.shutters !== false) {
    const sc = pick(r, st.shutter);
    for (const sgn of [-1, 1]) B.add(P.box, Lw(sgn * 0.66, 0.74, t / 2 + 0.05, 0.36, 0.9, 0.05), sc, { jitter: 0.04 });
  }
  if (opts.flowers) {
    B.add(P.box, Lw(0, 0.5, t / 2 + 0.17, 1.0, 0.2, 0.3), COLORS.wood);
    for (let i = 0; i < 4; i++) {
      B.add(P.crowns[i % 3], Lw(-0.36 + i * 0.24, 0.76, t / 2 + 0.17, 0.15, 0.13, 0.15), pick(r, FLOWERS), { sway: 0.15, swayBase: -10, swayH: 1, glow: 0.05 });
      B.add(P.crowns[0], Lw(-0.36 + i * 0.24, 0.68, t / 2 + 0.17, 0.13, 0.1, 0.13), COLORS.greens[i % 4]);
    }
  }
}

/**
 * Maison dans laquelle on peut entrer.
 * ho : { x, z, rot, w, d, style, seed } — la façade (+z local) porte la porte.
 * out : { halos, colliders, smoke }
 */
export function house(B, out, ho, y) {
  const r = B.rand;
  const { w, d } = ho;
  const st = STYLES[ho.style % STYLES.length];
  const F = frame(B, out, ho.x, y, ho.z, ho.rot);
  const L = F.L;
  const t = 0.22, wallH = 2.75, rh = d * 0.42;
  const wall = pick(r, st.wall), roofC = pick(r, st.roofs);
  const doorX = w * 0.18, dw = 0.55, doorH = 2.05;
  const hw = w / 2, hd = d / 2;

  // ——— murs (avec l'ouverture de la porte) ———
  const wopts = { jitter: 0.025, ao: 0.12 };
  F.seg(-hw, -hd, hw, -hd, 0, wallH, t, wall, wopts);
  F.seg(-hw, -hd, -hw, hd, 0, wallH, t, wall, wopts);
  F.seg(hw, -hd, hw, hd, 0, wallH, t, wall, wopts);
  F.seg(-hw, hd, doorX - dw, hd, 0, wallH, t, wall, wopts);
  F.seg(doorX + dw, hd, hw, hd, 0, wallH, t, wall, wopts);
  F.seg(doorX - dw, hd, doorX + dw, hd, doorH, wallH, t, wall, wopts, false);
  // soubassement de pierre (à l'extérieur seulement)
  for (const [ax, az, bx, bz, ox, oz] of [[-hw, -hd, hw, -hd, 0, -1], [-hw, -hd, -hw, hd, -1, 0], [hw, -hd, hw, hd, 1, 0], [-hw, hd, doorX - dw, hd, 0, 1], [doorX + dw, hd, hw, hd, 0, 1]]) {
    F.seg(ax + ox * 0.08, az + oz * 0.08, bx + ox * 0.08, bz + oz * 0.08, -0.4, 0.42, 0.1, COLORS.stone, { jitter: 0.08 }, false);
  }
  // poteaux d'angle et colombages
  for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    B.add(P.box, L(px, -0.3, pz, t + 0.1, wallH + 0.3, t + 0.1), ho.style === 2 ? COLORS.stone : COLORS.timber, { jitter: 0.04 });
  }
  if (ho.style === 0) {
    F.seg(-hw, -hd - 0.12, hw, -hd - 0.12, 1.55, 1.68, 0.04, COLORS.timber, {}, false);
    F.seg(-hw - 0.12, -hd, -hw - 0.12, hd, 1.55, 1.68, 0.04, COLORS.timber, {}, false);
    F.seg(hw + 0.12, -hd, hw + 0.12, hd, 1.55, 1.68, 0.04, COLORS.timber, {}, false);
    F.seg(-hw, hd + 0.12, doorX - dw, hd + 0.12, 1.55, 1.68, 0.04, COLORS.timber, {}, false);
  }
  F.seg(-hw - 0.05, -hd - 0.05, hw + 0.05, -hd - 0.05, wallH - 0.05, wallH + 0.12, t + 0.12, COLORS.timber, {}, false);
  F.seg(-hw - 0.05, hd + 0.05, hw + 0.05, hd + 0.05, wallH - 0.05, wallH + 0.12, t + 0.12, COLORS.timber, {}, false);

  // ——— porte ouverte, encadrement, marche, auvent ———
  B.add(P.box, L(doorX - dw - 0.05, 0, hd, 0.12, doorH + 0.08, t + 0.08), COLORS.timber);
  B.add(P.box, L(doorX + dw + 0.05, 0, hd, 0.12, doorH + 0.08, t + 0.08), COLORS.timber);
  B.add(P.box, L(doorX, doorH, hd, dw * 2 + 0.22, 0.14, t + 0.1), COLORS.timber);
  const open = 1.35;
  const hx = doorX - dw, hz = hd + t / 2;
  B.add(P.box, L(hx + Math.cos(open) * 0.53, 0.02, hz + Math.sin(open) * 0.53, 1.04, doorH - 0.06, 0.07, Math.atan2(-Math.sin(open), Math.cos(open))), pick(r, st.door), { jitter: 0.04 });
  B.add(P.box, L(doorX, -0.3, hd + 0.55, 1.4, 0.36, 0.7), COLORS.stone, { jitter: 0.06 });
  B.add(P.roof, L(doorX, doorH + 0.25, hd + 0.35, dw * 2 + 0.8, 0.45, 0.9), roofC, { jitter: 0.04 });
  // lanterne murale près de la porte
  B.add(P.box, L(doorX + dw + 0.45, 1.9, hd + t / 2 + 0.2, 0.06, 0.06, 0.4), COLORS.timber);
  B.add(P.box, L(doorX + dw + 0.45, 1.55, hd + t / 2 + 0.38, 0.24, 0.3, 0.24), COLORS.lantern, { glow: 1.4, jitter: 0 });
  F.halo(doorX + dw + 0.45, 1.7, hd + t / 2 + 0.38, 2.2, [1.0, 0.72, 0.38], 0.35);

  // ——— fenêtres ———
  windowAt(B, F, -hw * 0.5, hd, 0, 1, t, st, { flowers: true });
  windowAt(B, F, -hw, -hd * 0.25, -1, 0, t, st, { flowers: r() < 0.6 });
  windowAt(B, F, hw, hd * 0.35, 1, 0, t, st, { flowers: r() < 0.4 });
  windowAt(B, F, -hw * 0.35, -hd, 0, -1, t, st, { shutters: r() < 0.5 });

  // ——— plancher et plafond ———
  const nPl = 6;
  for (let i = 0; i < nPl; i++) {
    const pz = -hd + t / 2 + ((i + 0.5) / nPl) * (d - t);
    B.add(P.box, L(0, -0.06, pz, w - t, 0.1, (d - t) / nPl - 0.015), COLORS.wood, { jitter: 0.06 });
  }
  B.add(P.box, L(0, wallH, 0, w + 0.1, 0.12, d + 0.1), hex(0xd8bc98), { jitter: 0.03 });
  for (const bz of [-d * 0.25, d * 0.25]) B.add(P.box, L(0, wallH - 0.2, bz, w - t, 0.2, 0.2), COLORS.timber);

  // ——— toit : pignons, deux pans épais, faîtage ———
  B.add(P.roof, L(0, wallH + 0.1, 0, w - 0.02, rh, d - 0.02), wall, { jitter: 0.02 });
  const oh = 0.5, th = st.roofThick, slope = rh / hd;
  for (const sgn of [-1, 1]) {
    const ry0 = wallH + rh + 0.12, ez = sgn * (hd + oh), ey = wallH + 0.12 - oh * slope;
    const len = Math.hypot(ez, ry0 - ey) + 0.12;
    B.add(P.cbox, L(0, (ry0 + ey) / 2 + th / 2, ez / 2, w + 0.8, th, len, 0, sgn * Math.atan(slope)), roofC, { jitter: ho.style === 2 ? 0.1 : 0.05, ao: 0.1 });
  }
  B.add(P.cbox, L(0, wallH + rh + 0.12 + th, 0, w + 0.9, 0.14, 0.3), ho.style === 2 ? hex(0xb89a5e) : COLORS.timber);

  // ——— cheminée et âtre ———
  const fx = hw - t / 2, fz = -d * 0.18;
  const chimneyTop = wallH + rh + 0.7;
  B.add(P.box, L(hw - 0.45, wallH - 0.2, fz, 0.7, chimneyTop - wallH + 0.2, 0.7), COLORS.stone, { jitter: 0.08 });
  B.add(P.box, L(hw - 0.45, chimneyTop, fz, 0.85, 0.12, 0.85), hex(0x9e98a6));
  F.smoke(hw - 0.45, chimneyTop + 0.3, fz);
  B.add(P.box, L(fx - 0.35, 0, fz, 0.7, 1.15, 1.5), COLORS.stone, { jitter: 0.08, ao: 0.2 });
  B.add(P.box, L(fx - 0.71, 0.08, fz, 0.04, 0.62, 0.8), hex(0x3a3040), { jitter: 0 });
  B.add(P.box, L(fx - 0.4, 1.15, fz, 0.85, 0.1, 1.7), COLORS.timber);
  B.add(P.box, L(fx - 0.25, 1.25, fz, 0.5, wallH - 1.25, 1.0), COLORS.stone, { jitter: 0.06 });
  B.add(P.cone, L(fx - 0.5, 0.1, fz, 0.22, 0.45, 0.22), hex(0xffb36b), { glow: 1.8, jitter: 0, sway: 0.25, swayBase: y, swayH: 0.6 });
  B.add(P.box, L(fx - 0.5, 0.08, fz, 0.1, 0.1, 0.55, 0.3), COLORS.timber);
  F.halo(fx - 0.6, 0.45, fz, 2.4, [1.0, 0.6, 0.3], 1);
  F.circle(fx - 0.4, fz, 0.8);
  // un petit bouquet sur le manteau
  B.add(P.cyl6, L(fx - 0.4, 1.2, fz + 0.5, 0.16, 0.22, 0.16), hex(0x8492bd));
  B.add(P.crowns[1], L(fx - 0.4, 1.5, fz + 0.5, 0.17, 0.15, 0.17), pick(r, FLOWERS), { glow: 0.05 });

  // ——— lit ———
  const bx = -hw + t / 2 + 0.6, bz = -hd + t / 2 + 1.08;
  B.add(P.box, L(bx, 0, bz, 1.05, 0.42, 2.05), COLORS.wood);
  B.add(P.box, L(bx, 0.42, bz, 0.95, 0.18, 1.95), hex(0xf4ecdf), { jitter: 0.02 });
  B.add(P.box, L(bx, 0.5, bz + 0.35, 1.0, 0.14, 1.25), pick(r, [hex(0xd99aa8), hex(0x9aa6d0), hex(0x93b6a2), hex(0xc6b3ee)]), { jitter: 0.04 });
  B.add(P.box, L(bx, 0.6, bz - 0.72, 0.7, 0.15, 0.38), hex(0xffffff), { jitter: 0.02 });
  B.add(P.box, L(bx, 0, bz - 1.02, 1.05, 1.0, 0.1), COLORS.timber);
  B.add(P.box, L(bx + 0.95, 0, bz - 0.7, 0.5, 0.55, 0.5), COLORS.wood);
  B.add(P.cyl6, L(bx + 0.95, 0.55, bz - 0.7, 0.12, 0.16, 0.12), hex(0xf4ecdf));
  B.add(P.box, L(bx + 0.95, 0.71, bz - 0.7, 0.05, 0.07, 0.05), hex(0xffe0a0), { glow: 2, jitter: 0 });
  F.halo(bx + 0.95, 0.8, bz - 0.7, 0.8, [1.0, 0.8, 0.5], 0.5);
  F.circle(bx, bz - 0.5, 0.65);
  F.circle(bx, bz + 0.5, 0.65);

  // ——— tapis, table, tabourets ———
  B.add(P.box, L(-w * 0.08, 0.0, d * 0.12, 2.0, 0.03, 1.5), pick(r, [hex(0xd99aa8), hex(0xb9a3e3), hex(0xe6bd6a)]), { jitter: 0.03 });
  const tx = -w * 0.12, tz = d * 0.1;
  B.add(P.box, L(tx, 0.72, tz, 1.25, 0.08, 0.8), COLORS.wood, { jitter: 0.03 });
  for (const [lx, lz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) B.add(P.box, L(tx + lx, 0, tz + lz, 0.08, 0.72, 0.08), COLORS.timber);
  for (const sgn of [-1, 1]) B.add(P.cyl6, L(tx + sgn * 0.95, 0, tz, 0.42, 0.46, 0.42), COLORS.wood);
  B.add(P.crowns[0], L(tx + 0.25, 0.83, tz, 0.22, 0.08, 0.22), hex(0xe6d2b4));
  B.add(P.crowns[2], L(tx + 0.25, 0.88, tz, 0.12, 0.08, 0.1), hex(0xd9a76a));
  B.add(P.cyl6, L(tx - 0.3, 0.8, tz - 0.1, 0.08, 0.18, 0.08), hex(0xf4ecdf));
  B.add(P.box, L(tx - 0.3, 0.98, tz - 0.1, 0.03, 0.05, 0.03), hex(0xffe0a0), { glow: 2, jitter: 0 });
  F.halo(tx - 0.3, 1.05, tz - 0.1, 0.9, [1.0, 0.8, 0.5], 0.5);
  F.circle(tx, tz, 0.75);

  // ——— étagère, bocaux, livres ———
  const sx = w * 0.05, sz = -hd + t / 2 + 0.17;
  B.add(P.box, L(sx, 1.45, sz, 1.4, 0.06, 0.3), COLORS.timber);
  B.add(P.box, L(sx, 0.95, sz, 1.4, 0.06, 0.3), COLORS.timber);
  for (let i = 0; i < 4; i++) {
    B.add(P.cyl6, L(sx - 0.5 + i * 0.32, 1.51, sz, 0.16, 0.2 + r() * 0.1, 0.16), pick(r, [hex(0x9fc3ea), hex(0xe9a8c0), hex(0xe6c47a), hex(0x93b6a2)]));
    B.add(P.box, L(sx - 0.55 + i * 0.12, 1.01, sz, 0.09, 0.26 + r() * 0.08, 0.22), pick(r, [hex(0xa05a5a), hex(0x5a7aa0), hex(0x6f9a72), hex(0xc69a4a)]), { jitter: 0 });
  }
  // plante près de la porte, lanterne suspendue
  B.add(P.cyl6, L(doorX + dw + 0.45, 0, hd - t / 2 - 0.35, 0.4, 0.35, 0.4), hex(0xc98a6a));
  B.add(P.crowns[1], L(doorX + dw + 0.45, 0.6, hd - t / 2 - 0.35, 0.32, 0.38, 0.32), COLORS.greens[1], { sway: 0.05, swayBase: y, swayH: 1 });
  B.add(P.box, L(0, wallH - 0.62, 0, 0.03, 0.42, 0.03), COLORS.timber);
  B.add(P.box, L(0, wallH - 0.9, 0, 0.26, 0.3, 0.26), COLORS.lantern, { glow: 1.5, jitter: 0 });
  F.halo(0, wallH - 0.75, 0, 2.2, [1.0, 0.75, 0.42], 0.25);

  // ——— dehors : tas de bois contre un mur ———
  if (r() < 0.7) {
    for (let i = 0; i < 6; i++) {
      const row = i < 3 ? 0 : 1;
      B.add(P.cyl6, L(-hw - 0.4, 0.15 + row * 0.27, -hd * 0.6 + (i % 3) * 0.3 + row * 0.15, 0.28, 1.2, 0.28, 0, Math.PI / 2), COLORS.wood);
    }
  }
}

// ——— mobilier de village ———

export function lampPost(B, halos, x, y, z, rot = 0) {
  B.add(P.box, M(x, y - 0.2, z, rot, 0.16, 3.1, 0.16), COLORS.timber);
  B.add(P.box, M(x, y + 2.75, z, rot, 0.7, 0.08, 0.08), COLORS.timber);
  const lx = x + Math.cos(rot) * 0.3, lz = z - Math.sin(rot) * 0.3;
  B.add(P.box, M(lx, y + 2.2, lz, rot, 0.3, 0.38, 0.3), COLORS.lantern, { glow: 1.5, jitter: 0 });
  B.add(P.roof, M(lx, y + 2.58, lz, rot, 0.45, 0.2, 0.45), COLORS.timber);
  halos.push({ x: lx, y: y + 2.4, z: lz, size: 3, color: [1.0, 0.72, 0.38], flicker: 0.3 });
}

export function fence(B, colliders, world, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len / 1.3));
  const rot = Math.atan2(-(bz - az), bx - ax);
  for (let i = 0; i <= n; i++) {
    const px = ax + ((bx - ax) * i) / n, pz = az + ((bz - az) * i) / n;
    B.add(P.box, M(px, world.heightAt(px, pz) - 0.2, pz, rot, 0.12, 1.15, 0.12), COLORS.wood);
  }
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = world.heightAt(mx, mz);
  for (const hy of [0.45, 0.8]) B.add(P.box, M(mx, my + hy, mz, rot, len, 0.07, 0.05), COLORS.wood, { jitter: 0.05 });
  colliders.push({ seg: true, ax, az, bx, bz, r: 0.08 });
}

function bench(B, x, y, z, rot) {
  const L = (lx, ly, lz, sx, sy, sz) => M(lx, ly, lz, 0, sx, sy, sz, 0, 0, M(x, y, z, rot));
  B.add(P.box, L(0, 0.45, 0, 1.8, 0.1, 0.5), COLORS.wood);
  B.add(P.box, L(0, 0.7, -0.22, 1.8, 0.45, 0.08), COLORS.wood);
  for (const s of [-0.75, 0.75]) B.add(P.box, L(s, -0.1, 0, 0.1, 0.55, 0.45), COLORS.timber);
}

function barrel(B, x, y, z) {
  B.add(P.cyl, M(x, y, z, 0, 0.7, 0.95, 0.7), hex(0xa47c5d), { jitter: 0.04 });
  B.add(P.cyl, M(x, y + 0.25, z, 0, 0.74, 0.06, 0.74), hex(0x6a5a52));
  B.add(P.cyl, M(x, y + 0.7, z, 0, 0.74, 0.06, 0.74), hex(0x6a5a52));
}

function crate(B, x, y, z, rot, fruit) {
  B.add(P.box, M(x, y, z, rot, 0.7, 0.5, 0.6), hex(0xc9a27e), { jitter: 0.05 });
  if (fruit) for (let i = 0; i < 4; i++) B.add(P.crowns[i % 3], M(x - 0.18 + (i % 2) * 0.36, y + 0.55, z - 0.12 + (i >> 1) * 0.24, 0, 0.14, 0.12, 0.14), fruit);
}

function vegetableGarden(B, colliders, world, cx, cz, rot) {
  const r = B.rand;
  const c = Math.cos(rot), s = Math.sin(rot);
  const W = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  const crops = [[hex(0x8fbf86), 0.25], [hex(0xe89f72), 0.3], [hex(0xa4c98a), 0.2], [hex(0xc6b3ee), 0.18]];
  for (let row = 0; row < 3; row++) {
    const [col, size] = pick(r, crops);
    for (let i = 0; i < 5; i++) {
      const [x, z] = W(-1.6 + i * 0.8, -1 + row * 1);
      const y = world.heightAt(x, z);
      B.add(P.box, M(x, y - 0.1, z, rot, 0.75, 0.16, 0.5), hex(0x8a6a58), { jitter: 0.05 });
      B.add(P.crowns[i % 3], M(x, y + 0.2, z, r() * 6, size, size * 0.8, size), col, { sway: 0.1, swayBase: y, swayH: 0.6 });
    }
  }
  const corners = [W(-2.3, -1.7), W(2.3, -1.7), W(2.3, 1.7), W(-2.3, 1.7)];
  for (let i = 0; i < 3; i++) fence(B, colliders, world, corners[i][0], corners[i][1], corners[i + 1][0], corners[i + 1][1]);
  const [scx, scz] = W(2.8, 1.2);
  scarecrow(B, scx, world.heightAt(scx, scz), scz, rot);
}

function scarecrow(B, x, y, z, rot) {
  B.add(P.box, M(x, y - 0.2, z, rot, 0.1, 2.0, 0.1), COLORS.wood);
  B.add(P.box, M(x, y + 1.25, z, rot, 1.3, 0.08, 0.08), COLORS.wood);
  B.add(P.box, M(x, y + 0.8, z, rot, 0.5, 0.6, 0.3), hex(0x93b6a2), { sway: 0.05, swayBase: y, swayH: 2 });
  B.add(P.crownSoft, M(x, y + 1.6, z, rot, 0.2, 0.22, 0.2), hex(0xe6d2b4));
  B.add(P.cone, M(x, y + 1.72, z, rot, 0.32, 0.32, 0.32), hex(0xd9b874));
}

function marketStall(B, colliders, x, y, z, rot) {
  const r = B.rand;
  const L = (lx, ly, lz, sx, sy, sz, rx = 0) => M(lx, ly, lz, 0, sx, sy, sz, rx, 0, M(x, y, z, rot));
  for (const [px, pz] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]]) B.add(P.box, L(px, -0.2, pz, 0.1, 2.5, 0.1), COLORS.wood);
  const cloth = pick(r, [hex(0xd99aa8), hex(0x9aa6d0), hex(0xe6c47a), hex(0x93b6a2)]);
  for (let i = 0; i < 4; i++) {
    B.add(P.cbox, L(-0.9 + i * 0.6, 2.35, 0.1, 0.6, 0.05, 1.7, 0.25), i % 2 ? cloth : hex(0xf6efe6), { jitter: 0.02, sway: 0.08, swayBase: y, swayH: 2.4 });
  }
  B.add(P.box, L(0, 0, 0.45, 2.3, 0.85, 0.45), COLORS.wood, { jitter: 0.05 });
  const fruits = [hex(0xe86a6a), hex(0xfce39a), hex(0xe89f72), hex(0xb9d36a), hex(0xc6b3ee)];
  for (let i = 0; i < 6; i++) B.add(P.crowns[i % 3], L(-0.9 + i * 0.36, 0.95, 0.45, 0.15, 0.12, 0.15), pick(r, fruits));
  crate(B, x + 1.6 * Math.cos(rot), y, z - 1.6 * Math.sin(rot), rot, pick(r, fruits));
  colliders.push({ x, z, r: 1.3 });
}

function laundry(B, world, ax, az, bx, bz) {
  const r = B.rand;
  const ya = world.heightAt(ax, az), yb = world.heightAt(bx, bz);
  B.add(P.box, M(ax, ya - 0.2, az, 0, 0.1, 2.2, 0.1), COLORS.wood);
  B.add(P.box, M(bx, yb - 0.2, bz, 0, 0.1, 2.2, 0.1), COLORS.wood);
  const len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(-(bz - az), bx - ax);
  const my = (ya + yb) / 2 + 1.9;
  B.add(P.box, M((ax + bx) / 2, my, (az + bz) / 2, rot, len, 0.02, 0.02), hex(0xf6efe6));
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.7) / (n + 0.4);
    const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
    const col = pick(r, [hex(0xf6efe6), hex(0xd99aa8), hex(0x9fc3ea), hex(0xfce39a), hex(0xc6b3ee)]);
    const h = 0.55 + r() * 0.35;
    B.add(P.box, M(px, my - h, pz, rot, 0.55, h, 0.03), col, { sway: 0.5, swayBase: my - 3, swayH: 0.5, jitter: 0.03 });
  }
}

function haystack(B, colliders, x, y, z) {
  B.add(P.crownSoft, M(x, y + 0.6, z, B.rand() * 6, 1.3, 1.0, 1.3), hex(0xe1c27e), { jitter: 0.06, ao: 0.3 });
  B.add(P.crownSoft, M(x + 1.4, y + 0.4, z + 0.4, B.rand() * 6, 0.8, 0.65, 0.8), hex(0xd9b874), { jitter: 0.06, ao: 0.3 });
  colliders.push({ x, z, r: 1.3 });
}

function cart(B, x, y, z, rot) {
  const L = (lx, ly, lz, sx, sy, sz, ry = 0, rx = 0, rz = 0) => M(lx, ly, lz, ry, sx, sy, sz, rx, rz, M(x, y, z, rot));
  B.add(P.box, L(0, 0.55, 0, 1.4, 0.4, 2.0), COLORS.wood, { jitter: 0.05 });
  for (const sx of [-0.78, 0.78]) for (const sz of [-0.6, 0.6]) B.add(P.cyl, L(sx, 0.38, sz, 0.75, 0.1, 0.75, 0, 0, Math.PI / 2), COLORS.timber);
  B.add(P.box, L(0, 0.6, 1.5, 0.08, 0.08, 1.3), COLORS.timber);
  B.add(P.crownSoft, L(0, 1.0, 0, 0.6, 0.35, 0.85), hex(0xe1c27e));
}

function signpost(B, x, y, z, rot) {
  B.add(P.box, M(x, y - 0.2, z, rot, 0.12, 2.2, 0.12), COLORS.timber);
  B.add(P.box, M(x + Math.cos(rot) * 0.3, y + 1.6, z - Math.sin(rot) * 0.3, rot, 0.9, 0.22, 0.06), COLORS.wood);
  B.add(P.box, M(x - Math.cos(rot) * 0.25, y + 1.25, z + Math.sin(rot) * 0.25, rot + 0.3, 0.8, 0.2, 0.06), COLORS.wood);
}

function flowerBed(B, world, x, z, rad) {
  const r = B.rand;
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = world.heightAt(px, pz);
    B.add(P.crowns[i % 3], M(px, py + 0.35, pz, 0, 0.18, 0.15, 0.18), pick(r, FLOWERS), { sway: 0.15, swayBase: py, swayH: 0.5, glow: 0.05 });
    B.add(P.crowns[0], M(px, py + 0.15, pz, 0, 0.2, 0.18, 0.2), COLORS.greens[i % 4], { sway: 0.1, swayBase: py, swayH: 0.5 });
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const px = x + Math.cos(a) * (rad + 0.3), pz = z + Math.sin(a) * (rad + 0.3);
    B.add(P.rock[i % 2], M(px, world.heightAt(px, pz), pz, a, 0.22, 0.16, 0.22), COLORS.rock[0]);
  }
}

export function well(B, halos, colliders, x, y, z) {
  B.add(P.cyl, M(x, y - 0.3, z, 0, 2, 1.1, 2), COLORS.stone, { ao: 0.3 });
  B.add(P.cyl, M(x, y + 0.75, z, 0, 1.5, 0.08, 1.5), hex(0x6f9fb0), { jitter: 0 });
  B.add(P.box, M(x - 0.9, y, z, 0, 0.16, 2.2, 0.16), COLORS.timber);
  B.add(P.box, M(x + 0.9, y, z, 0, 0.16, 2.2, 0.16), COLORS.timber);
  B.add(P.box, M(x, y + 1.6, z, 0, 1.9, 0.1, 0.1), COLORS.timber);
  B.add(P.cyl6, M(x + 0.1, y + 1.1, z, 0, 0.3, 0.35, 0.3), COLORS.wood);
  B.add(P.roof, M(x, y + 2.1, z, Math.PI / 2, 1.6, 0.9, 2.4), COLORS.roofs[0]);
  colliders.push({ x, z, r: 1.2 });
}

export function village(B, out, world, poi) {
  const r = B.rand;
  const { halos, colliders } = out;
  const at = (a, d) => [poi.x + Math.cos(a) * d, poi.z + Math.sin(a) * d];
  const hAt = (x, z) => world.heightAt(x, z);
  const atY = (a, d) => { const [x, z] = at(a, d); return [x, hAt(x, z), z]; };

  well(B, halos, colliders, poi.x, poi.h, poi.z);
  for (const ho of poi.houses) house(B, out, ho, hAt(ho.x, ho.z));

  const n = poi.houses.length;
  // bancs et parterres autour du puits
  for (let i = 0; i < 2; i++) {
    const a = poi.houses[0].angle + Math.PI / n + Math.PI * (i + 0.5);
    const [bx, bz] = at(a, 4.3);
    bench(B, bx, hAt(bx, bz), bz, Math.atan2(poi.x - bx, poi.z - bz));
    colliders.push({ x: bx, z: bz, r: 0.6 });
  }
  // lampadaires le long des chemins
  poi.paths.forEach(([ax, az, bx, bz], i) => {
    const t = i === poi.paths.length - 1 ? 0.7 : 0.45;
    const nx = -(bz - az), nz = bx - ax, nl = Math.hypot(nx, nz) || 1;
    const px = ax + (bx - ax) * t + (nx / nl) * 1.6, pz = az + (bz - az) * t + (nz / nl) * 1.6;
    lampPost(B, halos, px, hAt(px, pz), pz, Math.atan2(-(az - pz), ax - px) + Math.PI);
    colliders.push({ x: px, z: pz, r: 0.2 });
  });

  // entre les maisons : jardins, étals, linge, foin, arbre…
  const gaps = poi.houses.map((ho, i) => {
    const next = poi.houses[(i + 1) % n];
    let da = next.angle - ho.angle;
    while (da < 0) da += Math.PI * 2;
    return ho.angle + da / 2;
  });
  const kinds = ['garden', 'stall', 'laundry', 'hay', 'tree', 'flowers'];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  gaps.forEach((a, i) => {
    const exit = Math.abs(Math.atan2(Math.sin(a - poi.exitAngle), Math.cos(a - poi.exitAngle))) < 0.35;
    const [gx, gz] = at(a, exit ? 18 : 14.5);
    const gy = hAt(gx, gz);
    const face = Math.atan2(poi.x - gx, poi.z - gz);
    if (exit) {
      const [sx, sz] = at(poi.exitAngle + 0.12, 23);
      signpost(B, sx, hAt(sx, sz), sz, poi.exitAngle);
      return;
    }
    switch (kinds[i % kinds.length]) {
      case 'garden': vegetableGarden(B, colliders, world, gx, gz, face); break;
      case 'stall': marketStall(B, colliders, ...atY(a, 10), face); break;
      case 'laundry': { const [ax, az] = at(a - 0.18, 15), [bx, bz] = at(a + 0.18, 15); laundry(B, world, ax, az, bx, bz); break; }
      case 'hay': haystack(B, colliders, gx, gy, gz); cart(B, ...atY(a + 0.2, 11), face + 0.6); break;
      case 'tree': roundTree(B, gx, gy, gz, COLORS.blossom, { scale: 1.35 }); colliders.push({ x: gx, z: gz, r: 0.6 }); bench(B, ...atY(a, 11.5), face + Math.PI); break;
      default: flowerBed(B, world, gx, gz, 1.8);
    }
    if (r() < 0.6) {
      const [bx, bz] = at(a + 0.25, 9.5);
      barrel(B, bx, hAt(bx, bz), bz);
      colliders.push({ x: bx, z: bz, r: 0.4 });
    }
  });
}

export function cabin(B, out, world, poi) {
  const ho = poi.houses[0];
  house(B, out, ho, poi.h);
  const { halos } = out;
  const dx = Math.sin(ho.rot), dz = Math.cos(ho.rot);
  const rot = ho.rot;
  // ponton vers l'eau, depuis la porte
  const deckY = WATER_LEVEL + 0.55;
  const ox = Math.cos(rot) * ho.w * 0.18, oz = -Math.sin(rot) * ho.w * 0.18;
  for (let i = 0; i < 14; i++) {
    const t = ho.d / 2 + 1.2 + i * 0.95;
    const px = poi.x + ox + dx * t, pz = poi.z + oz + dz * t;
    const gy = world.heightAt(px, pz);
    const y = Math.max(deckY, gy + 0.08);
    B.add(P.box, M(px, y, pz, rot, 1.8, 0.12, 0.97), COLORS.wood, { jitter: 0.08 });
    if (i % 3 === 1) {
      for (const sgn of [-1, 1]) {
        const sx = Math.cos(rot) * 0.9 * sgn, sz = -Math.sin(rot) * 0.9 * sgn;
        B.add(P.box, M(px + sx, Math.min(gy, y) - 0.5, pz + sz, 0, 0.16, y - Math.min(gy, y) + 0.8, 0.16), COLORS.timber);
      }
    }
  }
  const t = ho.d / 2 + 1.2 + 13.5;
  const ex = poi.x + ox + dx * t, ez = poi.z + oz + dz * t;
  lantern(B, halos, ex + Math.cos(rot) * 0.8, Math.max(deckY, world.heightAt(ex, ez)) + 0.1, ez - Math.sin(rot) * 0.8, rot);
  const bt = ho.d / 2 + 9;
  boat(B, poi.x + ox + dx * bt - Math.cos(rot) * 1.8, WATER_LEVEL, poi.z + oz + dz * bt + Math.sin(rot) * 1.8, rot + 0.3);
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
