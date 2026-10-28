// Génération procédurale pure (sans Three.js) : relief, biomes, points d'intérêt.
// Tout est déterministe à partir de la seed.

import { createSimplex, fbm, hash2, clamp, lerp, smoothstep } from './noise.js';
import { placeName } from './names.js';

export const CHUNK_SIZE = 64;
export const WATER_LEVEL = 0;

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    const s = this.seed;
    this.nCont = createSimplex(s + 1);
    this.nHills = createSimplex(s + 2);
    this.nMountMask = createSimplex(s + 3);
    this.nRidge = createSimplex(s + 4);
    this.nDetail = createSimplex(s + 5);
    this.nRiver = createSimplex(s + 6);
    this.nWarp = createSimplex(s + 7);
    this.nTemp = createSimplex(s + 8);
    this.nMoist = createSimplex(s + 9);
    this.nDream = createSimplex(s + 10);
    this.nPatch = createSimplex(s + 11);
    this.poiCache = new Map();
    this._b = {
      forest: 0, flowers: 0, cold: 0, warm: 0, dream: 0,
      mountain: 0, river: 0, beach: 0, height: 0,
    };
  }

  // Relief brut, sans aplanissement des villages.
  rawHeight(x, z) {
    const cont = fbm(this.nCont, x / 1100, z / 1100, 3);
    let h = cont * 20 + 7;

    const hills = fbm(this.nHills, x / 170, z / 170, 4);
    const mMask = smoothstep(0.12, 0.55, fbm(this.nMountMask, x / 1300, z / 1300, 2));
    h += hills * (9 - 4 * mMask);

    if (mMask > 0) {
      const r = 1 - Math.abs(fbm(this.nRidge, x / 440, z / 440, 4));
      h += r * r * 72 * mMask;
    }
    h += this.nDetail(x / 28, z / 28) * 0.6;

    // Rivières sinueuses : lignes de niveau d'un bruit déformé.
    const wx = x + this.nWarp(x / 400, z / 400) * 90;
    const wz = z + this.nWarp(z / 400 + 31, x / 400 - 17) * 90;
    const rv = Math.abs(fbm(this.nRiver, wx / 750, wz / 750, 2));
    const carve = 1 - mMask * 0.85;
    if (h > -1 && carve > 0) {
      const valley = 1 - smoothstep(0.0, 0.11, rv);
      const bed = 1 - smoothstep(0.004, 0.02, rv);
      h = lerp(h, Math.min(h, 2.5 + h * 0.15), valley * 0.75 * carve);
      h = lerp(h, -2.2, bed * carve);
    }
    return h;
  }

  heightAt(x, z) {
    let h = this.rawHeight(x, z);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const poi = this.getPoi(cx, cz);
    if (poi && poi.flatR) {
      const d = Math.hypot(x - poi.x, z - poi.z);
      if (d < poi.flatR + 10) {
        const w = 1 - smoothstep(poi.flatR, poi.flatR + 10, d);
        h = lerp(h, poi.h, w);
      }
    }
    return h;
  }

  riverness(x, z) {
    const wx = x + this.nWarp(x / 400, z / 400) * 90;
    const wz = z + this.nWarp(z / 400 + 31, x / 400 - 17) * 90;
    const rv = Math.abs(fbm(this.nRiver, wx / 750, wz / 750, 2));
    return 1 - smoothstep(0.0, 0.03, rv);
  }

  // Poids de biomes lissés (objet réutilisé : copier si besoin de le garder).
  biome(x, z, h) {
    const b = this._b;
    const temp = fbm(this.nTemp, x / 1400, z / 1400, 2);
    const moist = fbm(this.nMoist, x / 1000, z / 1000, 2);
    const dreamN = fbm(this.nDream, x / 1700, z / 1700, 2);
    b.height = h;
    b.forest = smoothstep(-0.02, 0.2, moist);
    b.flowers = smoothstep(-0.06, -0.24, moist) * (1 - smoothstep(-0.25, -0.4, temp));
    b.cold = smoothstep(-0.16, -0.34, temp);
    b.warm = smoothstep(0.18, 0.36, temp);
    b.dream = smoothstep(0.3, 0.42, dreamN);
    b.mountain = smoothstep(22, 45, h);
    b.beach = smoothstep(2.4, 1.0, h) * (h > -0.6 ? 1 : 0);
    b.river = 0;
    return b;
  }

  biomeName(x, z) {
    const h = this.heightAt(x, z);
    if (h < -0.8) return this.riverness(x, z) > 0.5 ? 'La Rivière' : 'Les Eaux calmes';
    const b = this.biome(x, z, h);
    if (b.mountain > 0.6) return h > 58 ? 'Les Cimes de nacre' : 'Les Montagnes douces';
    if (b.beach > 0.6) return 'Le Rivage';
    if (b.dream > 0.6) return 'La Prairie de Lune';
    if (b.cold > 0.6) return b.forest > 0.5 ? 'Le Bois des pins bleus' : 'La Lande givrée';
    if (b.forest > 0.6) return b.warm > 0.5 ? 'La Forêt dorée' : 'La Forêt murmurante';
    if (b.flowers > 0.6) return 'Les Champs fleuris';
    return b.warm > 0.5 ? 'Les Prés dorés' : 'La Prairie de sauge';
  }

  // Couleur du sol (linéaire 0..1, sRGB) écrite dans out[0..2].
  groundColor(x, z, h, slope, out) {
    // getPoi avant biome() : _makePoi réutilise l'objet de biome partagé.
    const poi = this.getPoi(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
    const b = this.biome(x, z, h);
    const patch = this.nPatch(x / 22, z / 22) * 0.5 + this.nPatch(x / 7, z / 7) * 0.25;

    let r = 0.66, g = 0.79, bl = 0.56;                // sauge
    r = lerp(r, 0.78, b.warm); g = lerp(g, 0.80, b.warm); bl = lerp(bl, 0.52, b.warm);
    r = lerp(r, 0.47, b.forest * 0.85); g = lerp(g, 0.65, b.forest * 0.85); bl = lerp(bl, 0.48, b.forest * 0.85);
    r = lerp(r, 0.70, b.flowers); g = lerp(g, 0.84, b.flowers); bl = lerp(bl, 0.60, b.flowers);
    r = lerp(r, 0.58, b.cold); g = lerp(g, 0.73, b.cold); bl = lerp(bl, 0.68, b.cold);
    r = lerp(r, 0.70, b.dream); g = lerp(g, 0.66, b.dream); bl = lerp(bl, 0.86, b.dream);

    const v = 1 + patch * 0.09;
    r *= v; g *= v; bl *= v;

    // Roche aux pentes et en altitude, nacre sur les cimes.
    const rock = clamp(smoothstep(0.55, 0.95, slope) + b.mountain * smoothstep(0.3, 0.6, slope), 0, 1);
    r = lerp(r, 0.66, rock); g = lerp(g, 0.63, rock); bl = lerp(bl, 0.70, rock);
    const snow = smoothstep(56, 68, h + patch * 6) * (1 - smoothstep(0.9, 1.3, slope));
    r = lerp(r, 0.95, snow); g = lerp(g, 0.94, snow); bl = lerp(bl, 0.98, snow);

    // Sable des rives et fonds aquatiques.
    const sand = b.beach * (1 - rock);
    r = lerp(r, 0.92, sand); g = lerp(g, 0.86, sand); bl = lerp(bl, 0.70, sand);
    if (h < -0.4) {
      const deep = smoothstep(-0.4, -6, h);
      r = lerp(0.80, 0.36, deep); g = lerp(0.80, 0.60, deep); bl = lerp(0.64, 0.64, deep);
    }

    // Place de village en terre battue.
    if (poi && poi.plaza) {
      const d = Math.hypot(x - poi.x, z - poi.z);
      const p = 1 - smoothstep(poi.plaza - 2, poi.plaza + 1, d + patch * 3);
      r = lerp(r, 0.80, p); g = lerp(g, 0.72, p); bl = lerp(bl, 0.58, p);
    }

    out[0] = r; out[1] = g; out[2] = bl;
    return b;
  }

  // Point d'intérêt d'un chunk (au plus un), mis en cache.
  getPoi(cx, cz) {
    const key = cx + ',' + cz;
    if (this.poiCache.has(key)) return this.poiCache.get(key);
    const poi = this._makePoi(cx, cz);
    if (this.poiCache.size > 4000) this.poiCache.clear();
    this.poiCache.set(key, poi);
    return poi;
  }

  _makePoi(cx, cz) {
    const s = this.seed;
    const r = hash2(cx, cz, s + 101);
    if (r > 0.17) return null;
    const x = (cx + 0.5) * CHUNK_SIZE + (hash2(cx, cz, s + 102) - 0.5) * 8;
    const z = (cz + 0.5) * CHUNK_SIZE + (hash2(cx, cz, s + 103) - 0.5) * 8;
    const h = this.rawHeight(x, z);
    const b = this.biome(x, z, h);
    const dream = b.dream, mountain = b.mountain;
    const name = placeName(hash2(cx, cz, s + 104));

    let minH = Infinity, maxH = -Infinity, lowDir = 0, lowH = Infinity;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (const rad of [9, 18]) {
        const hh = this.rawHeight(x + Math.cos(a) * rad, z + Math.sin(a) * rad);
        minH = Math.min(minH, hh); maxH = Math.max(maxH, hh);
        if (rad === 18 && hh < lowH) { lowH = hh; lowDir = a; }
      }
    }
    const flatEnough = maxH - minH < 7;
    const seedN = Math.floor(hash2(cx, cz, s + 105) * 1e9);

    if (r < 0.055 && h > 2.5 && h < 26 && flatEnough && minH > 0.8 && mountain < 0.3) {
      return { type: 'village', x, z, h, flatR: 18, plaza: 6, name: 'Village de ' + name, seed: seedN };
    }
    if (r < 0.085 && dream > 0.5 && h > 1.5 && flatEnough) {
      return { type: 'stones', x, z, h, flatR: 9, name: 'Le Cercle de ' + name, seed: seedN };
    }
    if (r < 0.105 && h > 1.0 && h < 3.8 && lowH < -0.8) {
      return { type: 'cabin', x, z, h, flatR: 5, dir: lowDir, name: 'La Cabane de ' + name, seed: seedN };
    }
    if (r < 0.135 && h > 1.5 && maxH - minH < 12) {
      return { type: 'ruins', x, z, h, name: 'Les Ruines de ' + name, seed: seedN };
    }
    if (r < 0.15 + dream * 0.02 || (dream > 0.5 && r < 0.17)) {
      const top = Math.max(h, 0) + 38 + hash2(cx, cz, s + 106) * 22;
      return { type: 'island', x, z, h: top, name: "L'Île suspendue de " + name, seed: seedN };
    }
    return null;
  }

  // Cherche un point de départ agréable : prairie, au sec, pas trop pentu.
  findSpawn(startX = 0, startZ = 0) {
    for (let ring = 0; ring < 60; ring++) {
      const steps = Math.max(1, ring * 8);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = startX + Math.cos(a) * ring * 24;
        const z = startZ + Math.sin(a) * ring * 24;
        const h = this.heightAt(x, z);
        if (h < 3 || h > 16) continue;
        const slope = Math.abs(this.heightAt(x + 2, z) - h) + Math.abs(this.heightAt(x, z + 2) - h);
        if (slope > 1.2) continue;
        const b = this.biome(x, z, h);
        if (b.forest > 0.7 || b.mountain > 0.2) continue;
        return { x, z };
      }
    }
    return { x: startX, z: startZ };
  }
}
