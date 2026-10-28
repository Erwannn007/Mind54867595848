// Le promeneur : déplacements doux, suivi du relief, caméra 1re / 3e personne.

import * as THREE from 'three';
import { Builder, hex } from './builder.js';
import { P } from './props.js';
import { WATER_LEVEL } from './world.js';
import { mulberry32 } from './noise.js';

const EYE = 1.62;
const WALK = 4.2;
const RUN = 7.8;
const RADIUS = 0.35;
const M = Builder.matrix;

export class Player {
  constructor(scene, camera, chunks, materials) {
    this.camera = camera;
    this.chunks = chunks;
    this.x = 0; this.z = 0; this.y = 0;
    this.vx = 0; this.vz = 0;
    this.yaw = 0; this.pitch = -0.08;
    this.tYaw = 0; this.tPitch = -0.08;
    this.mode = 'first';
    this.walkPhase = 0;
    this.swimming = false;
    this.camPos = new THREE.Vector3();
    this.camInit = false;

    this.avatar = this.makeAvatar(materials.veg);
    scene.add(this.avatar);
    this.light = new THREE.PointLight(0xffc98a, 0, 16, 1.4);
    scene.add(this.light);
  }

  makeAvatar(material) {
    const B = new Builder(mulberry32(3));
    B.add(P.cone, M(0, 0, 0, 0, 0.42, 1.15, 0.42), hex(0x7fb5a6), { jitter: 0.04, ao: 0.3 });
    B.add(P.cyl6, M(0, 0.98, 0, 0, 0.42, 0.14, 0.42), hex(0xe9a0b0), { jitter: 0.05 });
    B.add(P.crownSoft, M(0, 1.3, 0, 0, 0.24, 0.24, 0.24), hex(0xf3e2cf), { jitter: 0.02 });
    B.add(P.cone, M(0, 1.42, 0, 0, 0.32, 0.6, 0.32, -0.12, 0.1), hex(0xa895d0), { jitter: 0.04 });
    // petite lanterne tenue à la main
    B.add(P.box, M(0.36, 0.55, -0.12, 0, 0.16, 0.2, 0.16), hex(0xffd391), { glow: 1.3, jitter: 0 });
    B.add(P.box, M(0.36, 0.75, -0.12, 0, 0.03, 0.22, 0.03), hex(0x7d5b48));
    const mesh = new THREE.Mesh(B.toGeometry(), material);
    const g = new THREE.Group();
    g.add(mesh);
    g.body = mesh;
    return g;
  }

  place(x, z) {
    this.x = x; this.z = z;
    this.y = this.ground(x, z);
    this.vx = this.vz = 0;
    this.camInit = false;
  }

  ground(x, z) {
    const h = this.chunks.surfaceHeight(x, z);
    this.swimming = h < WATER_LEVEL - 0.95;
    return this.swimming ? WATER_LEVEL - 1.2 : h;
  }

  setMode(mode) {
    this.mode = mode;
    this.camInit = false;
  }

  update(dt, input, night) {
    // ——— regard ———
    const look = input.takeLook();
    const sens = 0.0052 * (this.mode === 'third' ? 1.1 : 1);
    this.tYaw -= look.dx * sens + input.keyTurn() * dt * 1.8;
    this.tPitch -= look.dy * sens;
    const minP = this.mode === 'third' ? -1.1 : -1.35;
    const maxP = this.mode === 'third' ? 0.35 : 1.35;
    this.tPitch = Math.min(maxP, Math.max(minP, this.tPitch));
    const k = 1 - Math.exp(-dt * 20);
    this.yaw += (this.tYaw - this.yaw) * k;
    this.pitch += (this.tPitch - this.pitch) * k;

    // ——— déplacement ———
    const mv = input.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let speed = mv.run ? RUN : WALK * mag + Math.max(0, (mag - 0.85) / 0.15) * (RUN - WALK) * 0.6;
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

    const tvx = dx * speed, tvz = dz * speed;
    const accel = dl > 0 ? 7 : 9;
    const a = 1 - Math.exp(-dt * accel);
    this.vx += (tvx - this.vx) * a;
    this.vz += (tvz - this.vz) * a;
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
    const up = g > this.y ? 14 : 9;
    this.y += (g - this.y) * (1 - Math.exp(-dt * up));

    const sp = Math.hypot(this.vx, this.vz);
    this.walkPhase += sp * dt * 1.9;

    // ——— avatar ———
    const av = this.avatar;
    av.visible = this.mode === 'third';
    av.position.set(this.x, this.y + Math.abs(Math.sin(this.walkPhase)) * 0.06 * Math.min(sp / WALK, 1), this.z);
    if (sp > 0.3) {
      const target = Math.atan2(-this.vx, -this.vz);
      let diff = target - av.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      av.rotation.y += diff * (1 - Math.exp(-dt * 10));
    }
    av.body.rotation.x = -Math.min(sp / RUN, 1) * 0.12;

    // ——— lanterne ———
    const lx = this.x - Math.sin(av.rotation.y) * 0.3, lz = this.z - Math.cos(av.rotation.y) * 0.3;
    this.light.position.set(lx, this.y + 1.3, lz);
    this.light.intensity = Math.max(0, night - 0.15) * 9;

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.camera;
    if (this.mode === 'first') {
      cam.position.set(this.x, this.y + EYE, this.z);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    const tx = this.x, ty = this.y + 1.45, tz = this.z;
    const dist = 5.2;
    const cp = Math.cos(this.pitch);
    const lx = -Math.sin(this.yaw) * cp, ly = Math.sin(this.pitch), lz = -Math.cos(this.yaw) * cp;
    let px = tx - lx * dist, py = ty - ly * dist + 0.6, pz = tz - lz * dist;
    const gy = this.chunks.surfaceHeight(px, pz);
    py = Math.max(py, Math.max(gy, WATER_LEVEL) + 0.5);
    if (!this.camInit) {
      this.camPos.set(px, py, pz);
      this.camInit = true;
    } else {
      const k = 1 - Math.exp(-dt * 10);
      this.camPos.x += (px - this.camPos.x) * k;
      this.camPos.y += (py - this.camPos.y) * k;
      this.camPos.z += (pz - this.camPos.z) * k;
    }
    cam.position.copy(this.camPos);
    cam.lookAt(tx, ty + 0.2, tz);
  }
}
