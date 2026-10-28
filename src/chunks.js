// Chargement / déchargement progressif des zones autour du joueur.

import * as THREE from 'three';
import { CHUNK_SIZE, WATER_LEVEL } from './world.js';
import { hash2, mulberry32 } from './noise.js';
import { Builder, hex } from './builder.js';
import { SPRITE } from './textures.js';
import * as props from './props.js';

const SEG = 20;
const STEP = CHUNK_SIZE / SEG;

const POI_CLEAR = { village: 24, ruins: 11, cabin: 9, stones: 9, island: 0 };

export class ChunkManager {
  constructor(world, scene, materials, { radius = 3, detailRadius = 2 } = {}) {
    this.world = world;
    this.scene = scene;
    this.mat = materials;
    this.radius = radius;
    this.detailRadius = detailRadius;
    this.chunks = new Map();
    this.extraColliders = [];
    this._col = [0, 0, 0];
  }

  key(cx, cz) {
    return cx + ',' + cz;
  }

  // Hauteur de la surface telle qu'elle est dessinée (triangles du maillage).
  surfaceHeight(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const ch = this.chunks.get(this.key(cx, cz));
    const lx = (x - cx * CHUNK_SIZE) / STEP, lz = (z - cz * CHUNK_SIZE) / STEP;
    let ix = Math.min(Math.floor(lx), SEG - 1), iz = Math.min(Math.floor(lz), SEG - 1);
    const fx = lx - ix, fz = lz - iz;
    let h00, h10, h01, h11;
    if (ch) {
      const H = ch.heights, W = SEG + 1;
      h00 = H[iz * W + ix]; h10 = H[iz * W + ix + 1];
      h01 = H[(iz + 1) * W + ix]; h11 = H[(iz + 1) * W + ix + 1];
    } else {
      const x0 = cx * CHUNK_SIZE + ix * STEP, z0 = cz * CHUNK_SIZE + iz * STEP;
      const w = this.world;
      h00 = w.heightAt(x0, z0); h10 = w.heightAt(x0 + STEP, z0);
      h01 = w.heightAt(x0, z0 + STEP); h11 = w.heightAt(x0 + STEP, z0 + STEP);
    }
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  // Met à jour l'ensemble des chunks ; construit au plus ce que le budget (ms) permet.
  update(px, pz, budgetMs = 6, force = false) {
    const pcx = Math.floor(px / CHUNK_SIZE), pcz = Math.floor(pz / CHUNK_SIZE);
    const fx = px / CHUNK_SIZE - 0.5, fz = pz / CHUNK_SIZE - 0.5;
    const R = this.radius;
    const wanted = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        const d = Math.hypot(cx - fx, cz - fz);
        if (d <= R + 0.5) wanted.push({ cx, cz, d });
      }
    }
    wanted.sort((a, b) => a.d - b.d);

    const t0 = performance.now();
    for (const w of wanted) {
      if (!force && performance.now() - t0 > budgetMs) break;
      let ch = this.chunks.get(this.key(w.cx, w.cz));
      if (!ch) {
        ch = this.buildChunk(w.cx, w.cz);
        this.chunks.set(this.key(w.cx, w.cz), ch);
      }
      if (!ch.detail && w.d <= this.detailRadius + 0.5) this.buildDetail(ch);
    }

    for (const [k, ch] of this.chunks) {
      const d = Math.hypot(ch.cx - fx, ch.cz - fz);
      if (d > R + 1.6) {
        this.disposeChunk(ch);
        this.chunks.delete(k);
      } else if (ch.detail && d > this.detailRadius + 1.3) {
        this.scene.remove(ch.detail);
        ch.detail.geometry.dispose();
        ch.detail = null;
      }
    }
  }

  // Colliders proches (chunks voisins compris).
  collidersNear(x, z) {
    const out = this.extraColliders.slice();
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ch = this.chunks.get(this.key(cx + dx, cz + dz));
        if (ch) for (const c of ch.colliders) out.push(c);
      }
    }
    return out;
  }

  buildChunk(cx, cz) {
    const world = this.world;
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    const ch = { cx, cz, colliders: [], halos: [], detail: null, poi: world.getPoi(cx, cz) };

    // ——— Terrain ———
    const W = SEG + 1;
    const E = SEG + 3; // grille élargie d'une case pour les pentes
    const ext = new Float32Array(E * E);
    for (let j = 0; j < E; j++) {
      for (let i = 0; i < E; i++) {
        ext[j * E + i] = world.heightAt(x0 + (i - 1) * STEP, z0 + (j - 1) * STEP);
      }
    }
    const heights = new Float32Array(W * W);
    const pos = new Float32Array(W * W * 3);
    const col = new Float32Array(W * W * 3);
    const uv = new Float32Array(W * W * 2);
    const c = this._col;
    for (let j = 0; j < W; j++) {
      for (let i = 0; i < W; i++) {
        const e = (j + 1) * E + (i + 1);
        const h = ext[e];
        const k = j * W + i;
        heights[k] = h;
        const sx = (ext[e + 1] - ext[e - 1]) / (2 * STEP);
        const sz = (ext[e + E] - ext[e - E]) / (2 * STEP);
        const slope = Math.sqrt(sx * sx + sz * sz);
        const wx = x0 + i * STEP, wz = z0 + j * STEP;
        world.groundColor(wx, wz, h, slope, c);
        pos[k * 3] = i * STEP; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * STEP;
        col[k * 3] = srgb(c[0]); col[k * 3 + 1] = srgb(c[1]); col[k * 3 + 2] = srgb(c[2]);
        uv[k * 2] = i * STEP * 0.5; uv[k * 2 + 1] = j * STEP * 0.5;
      }
    }
    const idx = [];
    for (let j = 0; j < SEG; j++) {
      for (let i = 0; i < SEG; i++) {
        const a = j * W + i, b = a + 1, d = a + W, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    ch.terrain = new THREE.Mesh(g, this.mat.terrain);
    ch.terrain.position.set(x0, 0, z0);
    ch.terrain.matrixAutoUpdate = false;
    ch.terrain.updateMatrix();
    this.scene.add(ch.terrain);
    ch.heights = heights;
    this.chunks.set(this.key(cx, cz), ch); // surfaceHeight utilisable dès maintenant

    // ——— Végétation et constructions ———
    const rand = mulberry32(Math.floor(hash2(cx, cz, world.seed + 500) * 4294967296));
    const B = new Builder(rand);
    this.placeVegetation(ch, B, x0, z0);
    this.placePoi(ch, B);
    if (B.count > 0) {
      const vg = B.toGeometry();
      vg.translate(-x0, 0, -z0);
      ch.veg = new THREE.Mesh(vg, this.mat.veg);
      ch.veg.position.set(x0, 0, z0);
      ch.veg.matrixAutoUpdate = false;
      ch.veg.updateMatrix();
      this.scene.add(ch.veg);
    }
    if (ch.halos.length) {
      ch.haloPoints = makeHalos(ch.halos, this.mat.halo);
      this.scene.add(ch.haloPoints);
    }
    return ch;
  }

  clearOfPoi(ch, x, z) {
    const poi = ch.poi;
    if (!poi) return true;
    const r = POI_CLEAR[poi.type] || 0;
    return Math.hypot(x - poi.x, z - poi.z) > r;
  }

  placeVegetation(ch, B, x0, z0) {
    const world = this.world;
    const r = B.rand;
    const cell = 5.5;
    const n = Math.floor(CHUNK_SIZE / cell);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + 0.15 + r() * 0.7) * cell;
        const z = z0 + (j + 0.15 + r() * 0.7) * cell;
        const roll = r();
        const h = this.surfaceHeight(x, z);
        if (h < 0.7) continue;
        if (!this.clearOfPoi(ch, x, z)) continue;
        const slope = Math.abs(this.surfaceHeight(x + 1.5, z) - h) + Math.abs(this.surfaceHeight(x, z + 1.5) - h);
        const b = world.biome(x, z, h);
        const treeLine = 1 - smooth(38, 55, h);
        const pTree = (0.035 + b.forest * 0.6 + b.dream * 0.08) * treeLine * (1 - b.beach) * (slope > 2.2 ? 0.2 : 1);
        const pBush = (0.05 + b.forest * 0.12 + b.flowers * 0.06) * treeLine * (1 - b.beach * 0.7);
        const pRock = 0.03 + b.mountain * 0.25 + (slope > 1.5 ? 0.1 : 0);

        if (roll < pTree) {
          if (b.dream > 0.5) {
            props.roundTree(B, x, h, z, props.COLORS.dream, { bark: props.COLORS.barkPale, glow: 0.18 });
            if (r() < 0.5) ch.halos.push({ x, y: h + 3.5, z, size: 1.2, color: [0.75, 0.7, 1.0], flicker: 0.2 });
          } else if (b.cold > 0.5 || (b.forest > 0.4 && b.cold > 0.15 && r() < 0.5) || h > 34) {
            props.pineTree(B, x, h, z, { frost: h > 42 || b.cold > 0.85 });
          } else {
            let pal = props.COLORS.greens;
            if (b.warm > 0.5 && r() < b.warm) pal = props.COLORS.golds;
            else if (r() < 0.07 + b.flowers * 0.15) pal = props.COLORS.blossom;
            props.roundTree(B, x, h, z, pal, { scale: 0.85 + b.forest * 0.35 });
          }
          ch.colliders.push({ x, z, r: 0.5 });
        } else if (roll < pTree + pBush) {
          const pal = b.dream > 0.5 ? props.COLORS.dream : b.warm > 0.6 ? props.COLORS.golds : props.COLORS.greens;
          props.bush(B, x, h, z, pal);
        } else if (roll < pTree + pBush + pRock) {
          const size = 0.4 + r() * r() * 2.4 + b.mountain;
          props.rock(B, x, h, z, size, b.forest > 0.4 || r() < 0.3);
          if (size > 1.1) ch.colliders.push({ x, z, r: size * 0.9 });
        }
      }
    }
  }

  placePoi(ch, B) {
    const poi = ch.poi;
    if (!poi) return;
    const w = this.world;
    if (poi.type === 'village') props.village(B, ch.halos, ch.colliders, w, poi);
    else if (poi.type === 'ruins') props.ruins(B, ch.halos, ch.colliders, w, poi);
    else if (poi.type === 'cabin') props.cabin(B, ch.halos, ch.colliders, w, poi);
    else if (poi.type === 'stones') props.stoneCircle(B, ch.halos, ch.colliders, w, poi);
    else if (poi.type === 'island') props.floatingIsland(B, ch.halos, poi);
  }

  // Herbes et fleurs en sprites pixel art, seulement près du joueur.
  buildDetail(ch) {
    const world = this.world;
    const x0 = ch.cx * CHUNK_SIZE, z0 = ch.cz * CHUNK_SIZE;
    const r = mulberry32(Math.floor(hash2(ch.cx, ch.cz, world.seed + 900) * 4294967296));
    const B = new Builder(r);
    const cell = 1.45;
    const n = Math.floor(CHUNK_SIZE / cell);
    const c = this._col;
    const poi = ch.poi;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + r()) * cell;
        const z = z0 + (j + r()) * cell;
        const roll = r();
        if (roll > 0.62) continue;
        const h = this.surfaceHeight(x, z);
        if (h < 0.35) continue;
        const b = world.biome(x, z, h);
        if (b.mountain > 0.8 && roll > 0.1) continue;
        if (poi && poi.plaza && Math.hypot(x - poi.x, z - poi.z) < poi.plaza + 1) continue;

        let garden = 0;
        if (poi && poi.type === 'village') {
          const d = Math.hypot(x - poi.x, z - poi.z);
          garden = d > 8 && d < 20 ? 0.25 : 0;
        }
        const pFlower = 0.015 + b.flowers * 0.32 + b.dream * 0.2 + garden + b.warm * 0.02;
        const pGrass = (0.36 + b.forest * 0.12) * (1 - b.beach * 0.85) * (1 - b.mountain * 0.6);
        const rot = r() * Math.PI;

        if (roll < pFlower) {
          let tile;
          const patch = world.nPatch(x / 45, z / 45);
          if (b.dream > 0.5) tile = r() < 0.55 ? SPRITE.MOONFLOWER : SPRITE.LAVENDER;
          else if (patch > 0.35) tile = SPRITE.LAVENDER;
          else if (patch > 0.05) tile = SPRITE.PINK;
          else if (patch > -0.3) tile = SPRITE.DAISY;
          else tile = SPRITE.YELLOW;
          if (r() < 0.15) tile = [SPRITE.PINK, SPRITE.DAISY, SPRITE.YELLOW][Math.floor(r() * 3)];
          const s = 0.55 + r() * 0.3;
          const glow = tile === SPRITE.MOONFLOWER ? 1 : b.dream > 0.3 ? 0.25 : 0;
          B.addSprite(x, h - 0.04, z, s, s, tile, WHITE, { rot, sway: 0.5, glow });
        } else if (roll < pFlower + 0.02 * b.forest + 0.02 * b.dream) {
          B.addSprite(x, h - 0.04, z, 0.5, 0.5, SPRITE.MUSHROOM, WHITE, { rot, sway: 0, glow: b.dream > 0.4 ? 0.8 : 0 });
        } else if (roll < pFlower + pGrass) {
          world.groundColor(x, z, h, 0, c);
          const tint = [Math.min(c[0] * 1.08, 1), Math.min(c[1] * 1.1, 1), Math.min(c[2] * 1.05, 1)];
          const tall = r() < 0.3 + b.forest * 0.3;
          const s = tall ? 0.8 + r() * 0.4 : 0.55 + r() * 0.3;
          B.addSprite(x, h - 0.06, z, s * 1.1, s, tall ? SPRITE.TALL_GRASS : SPRITE.GRASS, tint, { rot, sway: 0.9 });
        }
      }
    }
    if (B.count === 0) {
      ch.detail = new THREE.Object3D();
      ch.detail.geometry = { dispose() {} };
      return;
    }
    const g = B.toGeometry();
    g.translate(-x0, 0, -z0);
    ch.detail = new THREE.Mesh(g, this.mat.detail);
    ch.detail.position.set(x0, 0, z0);
    ch.detail.matrixAutoUpdate = false;
    ch.detail.updateMatrix();
    this.scene.add(ch.detail);
  }

  disposeChunk(ch) {
    for (const k of ['terrain', 'veg', 'detail', 'haloPoints']) {
      const o = ch[k];
      if (!o) continue;
      this.scene.remove(o);
      if (o.geometry) o.geometry.dispose();
    }
  }

  disposeAll() {
    for (const ch of this.chunks.values()) this.disposeChunk(ch);
    this.chunks.clear();
  }

  // POI le plus proche (pour les découvertes).
  nearestPoi(x, z, maxD) {
    let best = null, bd = maxD;
    for (const ch of this.chunks.values()) {
      const p = ch.poi;
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}

const WHITE = [1, 1, 1];
const srgb = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const smooth = (a, b, v) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function makeHalos(list, material) {
  const n = list.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const size = new Float32Array(n), fl = new Float32Array(n);
  list.forEach((h, i) => {
    pos[i * 3] = h.x; pos[i * 3 + 1] = h.y; pos[i * 3 + 2] = h.z;
    col[i * 3] = h.color[0]; col[i * 3 + 1] = h.color[1]; col[i * 3 + 2] = h.color[2];
    size[i] = h.size; fl[i] = h.flicker;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aFlicker', new THREE.BufferAttribute(fl, 1));
  g.computeBoundingSphere();
  const pts = new THREE.Points(g, material);
  pts.frustumCulled = false;
  pts.renderOrder = 2;
  return pts;
}

export { WATER_LEVEL };
