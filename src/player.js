// Le promeneur, vu à la première personne : marche douce, chute planée, vol libre.

import * as THREE from 'three';
import { WATER_LEVEL } from './world.js';

const EYE = 1.62;
const WALK = 4.2;
const RUN = 7.8;
const RADIUS = 0.35;
const FLY = 16;       // vitesse de croisière en vol
const FLY_BOOST = 34; // vitesse avec l'élan (Maj, R2, stick à fond)
const CEILING = 260;

export class Player {
  constructor(scene, camera, chunks) {
    this.camera = camera;
    this.chunks = chunks;
    this.x = 0; this.z = 0; this.y = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = -0.08; this.roll = 0;
    this.tYaw = 0; this.tPitch = -0.08;
    this.swimming = false;
    this.flying = false;
    this.airborne = false;
    this.speed = 0;
    this.stepAcc = 0;
    this.agl = 0; // hauteur au-dessus du sol
    this.onStep = null; // (vitesse) => void
    this.onLand = null; // (vitesse de chute) => void

    // la lanterne que l'on porte, allumée à la nuit tombée
    this.light = new THREE.PointLight(0xffc98a, 0, 16, 1.4);
    scene.add(this.light);
  }

  place(x, z, y = null) {
    this.x = x; this.z = z;
    this.y = y ?? this.ground(x, z);
    this.vx = this.vy = this.vz = 0;
  }

  ground(x, z) {
    const h = this.chunks.surfaceHeight(x, z);
    this.swimming = h < WATER_LEVEL - 0.95;
    return this.swimming ? WATER_LEVEL - 1.2 : h;
  }

  setFlying(on) {
    if (on === this.flying) return;
    this.flying = on;
    if (on) this.vy = Math.max(this.vy, 7); // petit bond pour décoller
  }

  update(dt, input, night) {
    // ——— regard ———
    const look = input.takeLook();
    const sens = 0.0052;
    const prevYaw = this.yaw;
    this.tYaw -= look.dx * sens + input.keyTurn() * dt * 1.8;
    this.tPitch -= look.dy * sens;
    this.tPitch = Math.min(1.35, Math.max(-1.35, this.tPitch));
    const k = 1 - Math.exp(-dt * (this.flying ? 12 : 20));
    this.yaw += (this.tYaw - this.yaw) * k;
    this.pitch += (this.tPitch - this.pitch) * k;

    const mv = input.moveVector();
    if (this.flying) this.fly(dt, mv, input.vertical());
    else this.walk(dt, mv);

    // collisions (troncs, murs, rochers) seulement près du sol
    const g0 = this.chunks.surfaceHeight(this.x, this.z);
    this.agl = this.y - Math.max(g0, WATER_LEVEL);
    if (this.y - g0 < 5) this.collide();

    // ——— inclinaison de la caméra dans les virages en vol ———
    const yawRate = (this.yaw - prevYaw) / Math.max(dt, 1e-3);
    const horiz = Math.hypot(this.vx, this.vz);
    const targetRoll = this.flying ? Math.max(-0.32, Math.min(0.32, -yawRate * 0.09 * Math.min(horiz / FLY, 1.6) - mv.x * 0.1)) : 0;
    this.roll += (targetRoll - this.roll) * (1 - Math.exp(-dt * 3.5));

    // ——— lanterne ———
    this.light.position.set(this.x - Math.sin(this.yaw) * 0.6, this.y + 1.2, this.z - Math.cos(this.yaw) * 0.6);
    this.light.intensity = Math.max(0, night - 0.15) * 9;

    this.camera.position.set(this.x, this.y + EYE, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  walk(dt, mv) {
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let speed = mv.run && mag > 0 ? RUN : WALK * mag + Math.max(0, (mag - 0.85) / 0.15) * (RUN - WALK) * 0.6;
    if (this.swimming) speed *= 0.6;
    let dx = rx * mv.x + fx * mv.y, dz = rz * mv.x + fz * mv.y;
    const dl = Math.hypot(dx, dz);
    if (dl > 0) { dx /= dl; dz /= dl; }

    // freinage en montée raide
    if (dl > 0 && !this.airborne) {
      const ahead = this.chunks.surfaceHeight(this.x + dx * 0.8, this.z + dz * 0.8);
      const rise = (ahead - this.chunks.surfaceHeight(this.x, this.z)) / 0.8;
      if (rise > 0.6) speed *= Math.max(0.15, 1 - (rise - 0.6) * 1.1);
    }

    // en l'air on garde son élan et on plane doucement
    const a = 1 - Math.exp(-dt * (this.airborne ? 1.2 : dl > 0 ? 7 : 9));
    const air = this.airborne ? Math.max(Math.hypot(this.vx, this.vz), speed) : speed;
    this.vx += (dx * air - this.vx) * a;
    this.vz += (dz * air - this.vz) * a;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    const g = this.ground(this.x, this.z);
    if (this.y > g + 0.6 || this.vy > 0) {
      this.airborne = true;
      this.vy = Math.max(this.vy - 13 * dt, -11); // chute plume
      this.y += this.vy * dt;
      if (this.y <= g) {
        if (this.onLand) this.onLand(-this.vy);
        this.y = g;
        this.vy = 0;
        this.airborne = false;
      }
    } else {
      this.airborne = false;
      this.vy = 0;
      this.y += (g - this.y) * (1 - Math.exp(-dt * (g > this.y ? 14 : 9)));
    }

    // ——— pas : la foulée s'allonge avec la vitesse ———
    const sp = Math.hypot(this.vx, this.vz);
    this.speed = sp;
    if (sp > 0.6 && !this.airborne) {
      this.stepAcc += sp * dt;
      const stride = this.swimming ? 1.6 : 0.95 + sp * 0.12;
      if (this.stepAcc > stride) {
        this.stepAcc -= stride;
        if (this.onStep) this.onStep(sp);
      }
    } else {
      this.stepAcc = 0.7; // le premier pas tombe vite quand on repart
    }
  }

  fly(dt, mv, vertical) {
    const cp = Math.cos(this.pitch);
    const fx = -Math.sin(this.yaw) * cp, fy = Math.sin(this.pitch), fz = -Math.cos(this.yaw) * cp;
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const cruise = mv.run || mag > 0.97 ? FLY_BOOST : FLY;
    // on va là où l'on regarde
    const tx = (fx * mv.y + rx * mv.x * 0.7) * cruise;
    const ty = fy * mv.y * cruise + vertical * 9;
    const tz = (fz * mv.y + rz * mv.x * 0.7) * cruise;
    // grande inertie : on glisse, on ne s'arrête pas net
    const a = 1 - Math.exp(-dt * (mag > 0 || vertical ? 1.5 : 0.9));
    this.vx += (tx - this.vx) * a;
    this.vy += (ty - this.vy) * a;
    this.vz += (tz - this.vz) * a;
    // flottement léger à l'arrêt
    const hover = mag === 0 && !vertical ? Math.sin(performance.now() * 0.0012) * 0.25 : 0;
    this.x += this.vx * dt;
    this.y += (this.vy + hover) * dt;
    this.z += this.vz * dt;

    const g = Math.max(this.chunks.surfaceHeight(this.x, this.z), WATER_LEVEL - 0.6);
    if (this.y < g + 0.3) {
      this.y = g + 0.3;
      if (this.vy < 0) this.vy *= 0.3;
    }
    if (this.y > CEILING) {
      this.y = CEILING;
      this.vy = Math.min(this.vy, 0);
    }
    this.swimming = false;
    this.airborne = true;
    this.speed = Math.hypot(this.vx, this.vy, this.vz);
  }

  collide() {
    for (const c of this.chunks.collidersNear(this.x, this.z)) {
      let px = c.x, pz = c.z;
      if (c.seg) {
        const vx = c.bx - c.ax, vz = c.bz - c.az;
        const t = Math.max(0, Math.min(1, ((this.x - c.ax) * vx + (this.z - c.az) * vz) / (vx * vx + vz * vz || 1)));
        px = c.ax + vx * t;
        pz = c.az + vz * t;
      }
      const ox = this.x - px, oz = this.z - pz;
      const d = Math.hypot(ox, oz), min = c.r + RADIUS;
      if (d < min && d > 1e-4) {
        this.x = px + (ox / d) * min;
        this.z = pz + (oz / d) * min;
        // on glisse le long de l'obstacle au lieu de s'y coller
        const nx = ox / d, nz = oz / d, vn = this.vx * nx + this.vz * nz;
        if (vn < 0) { this.vx -= vn * nx; this.vz -= vn * nz; }
      }
    }
  }
}
