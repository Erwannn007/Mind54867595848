// Le petit refuge du joueur : objets posés dans le monde, sauvegardés sur l'appareil.

import * as THREE from 'three';
import { Builder, hex } from './builder.js';
import { mulberry32 } from './noise.js';
import { makeHalos, makeSmoke } from './chunks.js';
import * as props from './props.js';
import { insideHouse } from './world.js';

const { P, COLORS } = props;
const M = Builder.matrix;

export const ITEMS = [
  { id: 'lantern', label: 'Lanterne' },
  { id: 'campfire', label: 'Feu de camp' },
  { id: 'bench', label: 'Banc' },
  { id: 'garden', label: 'Jardinière' },
  { id: 'tent', label: 'Tente' },
  { id: 'cabin', label: 'Cabane' },
];

// Cabane du joueur : même maison que dans les villages, la porte tournée vers lui.
export function cabinHouse(item) {
  return { x: item.x, z: item.z, rot: item.rot, w: 4.8, d: 4.3, style: (item.seed || 0) % 3 };
}

function buildItem(B, out, item) {
  const { halos, colliders } = out;
  const { type, x, y, z, rot } = item;
  const L = (lx, ly, lz, sx, sy, sz, ry = 0) => M(lx, ly, lz, ry, sx, sy, sz, 0, 0, M(x, y, z, rot));
  switch (type) {
    case 'lantern':
      props.lantern(B, halos, x, y, z, rot);
      colliders.push({ x, z, r: 0.25 });
      break;
    case 'campfire':
      props.campfire(B, halos, x, y, z);
      // deux bûches pour s'asseoir
      B.add(P.cyl6, L(-1.8, 0.05, 0, 0.5, 1.6, 0.5, 0), COLORS.wood);
      B.add(P.cyl6, L(1.8, 0.05, 0, 0.5, 1.6, 0.5, 0), COLORS.wood);
      colliders.push({ x, z, r: 0.9 });
      break;
    case 'bench':
      B.add(P.box, L(0, 0.45, 0, 1.8, 0.1, 0.5), COLORS.wood);
      B.add(P.box, L(0, 0.7, -0.22, 1.8, 0.45, 0.08), COLORS.wood);
      for (const s of [-0.75, 0.75]) B.add(P.box, L(s, -0.1, 0, 0.1, 0.55, 0.45), COLORS.timber);
      colliders.push({ x, z, r: 0.6 });
      break;
    case 'garden': {
      B.add(P.box, L(0, -0.1, 0, 1.8, 0.45, 0.9), COLORS.wood, { ao: 0.3 });
      B.add(P.box, L(0, 0.3, 0, 1.6, 0.06, 0.7), hex(0x7b5f4c));
      const cols = [hex(0xf2b9c9), hex(0xfce39a), hex(0xc6b3ee), hex(0xffffff), hex(0xe9a0b0)];
      for (let i = 0; i < 9; i++) {
        const lx = -0.65 + (i % 5) * 0.32 + (B.rand() - 0.5) * 0.1;
        const lz = i < 5 ? -0.15 : 0.18;
        B.add(P.crowns[i % 3], L(lx, 0.55 + B.rand() * 0.12, lz, 0.17, 0.15, 0.17), cols[i % cols.length], { sway: 0.2, swayBase: y, swayH: 0.8, glow: 0.1 });
        B.add(P.crowns[0], L(lx, 0.38, lz, 0.14, 0.12, 0.14), COLORS.greens[i % 4], { sway: 0.1, swayBase: y, swayH: 0.8 });
      }
      colliders.push({ x, z, r: 0.8 });
      break;
    }
    case 'tent':
      B.add(P.roof, L(0, -0.05, 0, 2.8, 1.9, 2.2, Math.PI / 2), hex(0xefdcc6), { jitter: 0.04 });
      B.add(P.roof, L(0, -0.04, 1.41, 0.04, 1.05, 0.9, Math.PI / 2), hex(0x5c4a5e), { jitter: 0 });
      B.add(P.box, L(0, 0, 1.45, 0.06, 2.1, 0.06), COLORS.timber);
      B.add(P.box, L(0, 0, -1.45, 0.06, 2.1, 0.06), COLORS.timber);
      colliders.push({ x, z, r: 1.3 });
      break;
    case 'cabin':
      props.house(B, out, cabinHouse(item), y);
      break;
  }
}

export class Builds {
  constructor(scene, materials, chunks) {
    this.scene = scene;
    this.mat = materials;
    this.chunks = chunks;
    this.items = [];
    this.meshes = [];
    this.haloPoints = null;
    this.smokePoints = null;
  }

  load(items) {
    this.items = (items || []).filter((i) => ITEMS.some((t) => t.id === i.type));
    this.rebuild();
  }

  place(type, x, z, rot) {
    const y = this.chunks.surfaceHeight(x, z);
    this.items.push({ type, x, y, z, rot, seed: Math.floor(Math.random() * 1e9) });
    this.rebuild();
  }

  // la cabane (posée par le joueur) où l'on se trouve, s'il y en a une
  houseAt(x, z, margin = 0) {
    for (const it of this.items) {
      if (it.type === 'cabin' && insideHouse(cabinHouse(it), x, z, margin)) return it;
    }
    return null;
  }

  removeNear(x, z, maxD = 4.5) {
    let best = -1, bd = maxD;
    this.items.forEach((it, i) => {
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return false;
    this.items.splice(best, 1);
    this.rebuild();
    return true;
  }

  rebuild() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.meshes = [];
    for (const k of ['haloPoints', 'smokePoints']) {
      if (!this[k]) continue;
      this.scene.remove(this[k]);
      this[k].geometry.dispose();
      this[k] = null;
    }
    const halos = [], colliders = [], smoke = [];
    for (const it of this.items) {
      const B = new Builder(mulberry32(it.seed || 1));
      buildItem(B, { halos, colliders, smoke }, it);
      const mesh = new THREE.Mesh(B.toGeometry(), this.mat.veg);
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    if (halos.length) {
      this.haloPoints = makeHalos(halos, this.mat.halo);
      this.scene.add(this.haloPoints);
    }
    if (smoke.length) {
      this.smokePoints = makeSmoke(smoke, this.mat.smoke);
      this.scene.add(this.smokePoints);
    }
    this.chunks.extraColliders = colliders;
  }
}
