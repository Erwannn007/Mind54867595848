// Le promeneur, vu à la première personne : déplacements doux, suivi du relief, pas.

import * as THREE from 'three';
import { WATER_LEVEL } from './world.js';

const EYE = 1.62;
const WALK = 4.2;
const RUN = 7.8;
const RADIUS = 0.35;

export class Player {
  constructor(scene, camera, chunks) {
    this.camera = camera;
    this.chunks = chunks;
    this.x = 0; this.z = 0; this.y = 0;
    this.vx = 0; this.vz = 0;
    this.yaw = 0; this.pitch = -0.08;
    this.tYaw = 0; this.tPitch = -0.08;
    this.swimming = false;
    this.speed = 0;
    this.stepAcc = 0;
    this.onStep = null; // (vitesse) => void

    // la lanterne que l'on porte, allumée à la nuit tombée
    this.light = new THREE.PointLight(0xffc98a, 0, 16, 1.4);
    scene.add(this.light);
  }

  place(x, z) {
    this.x = x; this.z = z;
    this.y = this.ground(x, z);
    this.vx = this.vz = 0;
  }

  ground(x, z) {
    const h = this.chunks.surfaceHeight(x, z);
    this.swimming = h < WATER_LEVEL - 0.95;
    return this.swimming ? WATER_LEVEL - 1.2 : h;
  }

  update(dt, input, night) {
    // ——— regard ———
    const look = input.takeLook();
    const sens = 0.0052;
    this.tYaw -= look.dx * sens + input.keyTurn() * dt * 1.8;
    this.tPitch -= look.dy * sens;
    this.tPitch = Math.min(1.35, Math.max(-1.35, this.tPitch));
    const k = 1 - Math.exp(-dt * 20);
    this.yaw += (this.tYaw - this.yaw) * k;
    this.pitch += (this.tPitch - this.pitch) * k;

    // ——— déplacement ———
    const mv = input.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let speed = mv.run && mag > 0 ? RUN : WALK * mag + Math.max(0, (mag - 0.85) / 0.15) * (RUN - WALK) * 0.6;
    if (this.swimming) speed *= 0.6;
    let dx = rx * mv.x + fx * mv.y, dz = rz * mv.x + fz * mv.y;
    const dl = Math.hypot(dx, dz);
    if (dl > 0) { dx /= dl; dz /= dl; }

    // freinage en montée raide
    if (dl > 0) {
      const ahead = this.chunks.surfaceHeight(this.x + dx * 0.8, this.z + dz * 0.8);
      const rise = (ahead - this.chunks.surfaceHeight(this.x, this.z)) / 0.8;
      if (rise > 0.6) speed *= Math.max(0.15, 1 - (rise - 0.6) * 1.1);
    }

    const a = 1 - Math.exp(-dt * (dl > 0 ? 7 : 9));
    this.vx += (dx * speed - this.vx) * a;
    this.vz += (dz * speed - this.vz) * a;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // collisions douces avec troncs, maisons, rochers
    for (const c of this.chunks.collidersNear(this.x, this.z)) {
      const ox = this.x - c.x, oz = this.z - c.z;
      const d = Math.hypot(ox, oz), min = c.r + RADIUS;
      if (d < min && d > 1e-4) {
        this.x = c.x + (ox / d) * min;
        this.z = c.z + (oz / d) * min;
      }
    }

    const g = this.ground(this.x, this.z);
    this.y += (g - this.y) * (1 - Math.exp(-dt * (g > this.y ? 14 : 9)));

    // ——— pas : la foulée s'allonge avec la vitesse ———
    const sp = Math.hypot(this.vx, this.vz);
    this.speed = sp;
    if (sp > 0.6) {
      this.stepAcc += sp * dt;
      const stride = this.swimming ? 1.6 : 0.95 + sp * 0.12;
      if (this.stepAcc > stride) {
        this.stepAcc -= stride;
        if (this.onStep) this.onStep(sp);
      }
    } else {
      this.stepAcc = 0.7; // le premier pas tombe vite quand on repart
    }

    // ——— lanterne ———
    this.light.position.set(this.x - Math.sin(this.yaw) * 0.6, this.y + 1.2, this.z - Math.cos(this.yaw) * 0.6);
    this.light.intensity = Math.max(0, night - 0.15) * 9;

    this.camera.position.set(this.x, this.y + EYE, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
