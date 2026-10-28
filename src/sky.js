// Ciel onirique : dégradés, soleil, lune, étoiles pixelisées, nuages stylisés et cycle jour/nuit.

import * as THREE from 'three';

// Images-clés du cycle (t : 0 = minuit, 0.25 = lever, 0.5 = midi, 0.75 = coucher).
const KEYS = [
  { t: 0.00, top: 0x0f1a3f, hor: 0x2c3a6e, light: 0x9fb2ea, li: 0.42, hemiS: 0x6a7cc4, hemiG: 0x323658, hi: 1.0, cloud: 0x3a4478, water: 0x23386a, night: 1 },
  { t: 0.20, top: 0x1d2459, hor: 0x5d5a92, light: 0xa9a6e0, li: 0.38, hemiS: 0x6a6cb0, hemiG: 0x33304f, hi: 0.95, cloud: 0x5a5a8e, water: 0x2e3f74, night: 0.92 },
  { t: 0.255, top: 0x6a86c8, hor: 0xf5b49c, light: 0xffc29a, li: 0.75, hemiS: 0xc2b4dc, hemiG: 0x6a5a6a, hi: 0.95, cloud: 0xf6c6c0, water: 0x6f8fb8, night: 0.35 },
  { t: 0.32, top: 0x7cb0e8, hor: 0xd2e8f2, light: 0xfff0d4, li: 1.15, hemiS: 0xcfe4f4, hemiG: 0x7f8a6e, hi: 1.05, cloud: 0xffffff, water: 0x6fb0c8, night: 0 },
  { t: 0.50, top: 0x75abe8, hor: 0xd8edf6, light: 0xfff6e6, li: 1.25, hemiS: 0xd6eaf6, hemiG: 0x84906e, hi: 1.1, cloud: 0xffffff, water: 0x6ab4cc, night: 0 },
  { t: 0.67, top: 0x82abdf, hor: 0xf2ddb4, light: 0xffd9a2, li: 1.1, hemiS: 0xe0dcd4, hemiG: 0x8a8068, hi: 1.05, cloud: 0xfff2dc, water: 0x76aec2, night: 0 },
  { t: 0.745, top: 0x6a6fb8, hor: 0xf59c8a, light: 0xffa384, li: 0.8, hemiS: 0xeabcd0, hemiG: 0x8e7488, hi: 1.08, cloud: 0xf7a8a0, water: 0x7a7aae, night: 0.2 },
  { t: 0.79, top: 0x34367a, hor: 0x9c6ca8, light: 0xc0a0e0, li: 0.5, hemiS: 0x9a88c8, hemiG: 0x4a4266, hi: 1.0, cloud: 0x8a6aa0, water: 0x3f4580, night: 0.65 },
  { t: 0.86, top: 0x121c45, hor: 0x33407a, light: 0x9fb2ea, li: 0.42, hemiS: 0x6a7cc4, hemiG: 0x323658, hi: 1.0, cloud: 0x3d477c, water: 0x24396c, night: 1 },
];

const _a = new THREE.Color(), _b = new THREE.Color();

function sample(t) {
  let i = 0;
  while (i < KEYS.length - 1 && KEYS[i + 1].t <= t) i++;
  const k0 = KEYS[i];
  const k1 = KEYS[(i + 1) % KEYS.length];
  const t1 = i + 1 < KEYS.length ? k1.t : 1;
  let f = (t - k0.t) / (t1 - k0.t);
  f = f * f * (3 - 2 * f);
  const col = (key, out) => out.copy(_a.setHex(k0[key])).lerp(_b.setHex(k1[key]), f);
  const num = (key) => k0[key] + (k1[key] - k0[key]) * f;
  return { col, num };
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunCol: { value: new THREE.Color() },
      uCloud: { value: new THREE.Color() },
      uNight: { value: 0 },
      uTime: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(900, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHor, uSunCol, uCloud, uSunDir, uMoonDir;
        uniform float uNight, uTime;
        varying vec3 vDir;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float hash2(vec2 p) { return fract(sin(dot(p, vec2(41.31, 289.13))) * 23421.631); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          float g = smoothstep(-0.05, 0.55, y);
          vec3 col = mix(uHor, uTop, pow(g, 0.8));
          // halo chaud près du soleil, surtout au lever / coucher
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunCol * (pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.35) * (1.0 - uNight * 0.8);
          // étoiles : un pixel net, scintillement doux
          if (uNight > 0.01 && y > 0.0) {
            vec3 cell = floor(d * 160.0);
            float h = hash(cell);
            if (h > 0.9935) {
              float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 3.0) + h * 80.0);
              vec3 sc = mix(vec3(1.0, 0.95, 0.88), vec3(0.8, 0.86, 1.0), fract(h * 37.0));
              col += sc * tw * uNight * smoothstep(0.0, 0.25, y) * 0.9;
            }
          }
          // soleil (disque pixelisé)
          if (dot(d, uSunDir) > 0.9988) col = mix(col, vec3(1.0, 0.97, 0.88), 0.92);
          // lune et son halo nacré
          float md = dot(d, uMoonDir);
          col += vec3(0.75, 0.8, 1.0) * pow(max(md, 0.0), 40.0) * 0.25 * uNight;
          if (md > 0.9991) {
            vec3 off = normalize(uMoonDir + vec3(0.02, 0.012, 0.0));
            float shade = dot(d, off) > 0.9993 ? 0.82 : 1.0;
            col = mix(col, vec3(0.96, 0.95, 1.0) * shade, 0.3 + 0.65 * uNight);
          }
          // nuages stylisés en bandes douces
          if (y > 0.02) {
            vec2 uv = d.xz / (y + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.0025);
            uv = floor(uv * 24.0) / 24.0;
            float n = vnoise(uv) * 0.55 + vnoise(uv * 2.1 + 3.7) * 0.3 + vnoise(uv * 4.3 - 1.3) * 0.15;
            float c = smoothstep(0.56, 0.72, n);
            c = floor(c * 3.0 + 0.5) / 3.0;
            float lit = 0.75 + 0.25 * smoothstep(0.6, 0.85, n);
            vec3 cc = uCloud * lit + uSunCol * pow(sd, 4.0) * 0.25;
            col = mix(col, cc, c * smoothstep(0.02, 0.25, y) * 0.85);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 1);
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = new THREE.Fog(0xffffff, 70, 205);

    this.state = { night: 0, water: new THREE.Color(), hor: new THREE.Color(), sunDir: new THREE.Vector3(), lightCol: new THREE.Color() };
  }

  // t : heure normalisée [0,1)
  update(t, time, center) {
    const { col, num } = sample(t);
    const u = this.uniforms;
    col('top', u.uTop.value);
    col('hor', u.uHor.value);
    col('cloud', u.uCloud.value);
    col('light', u.uSunCol.value);
    const night = num('night');
    u.uNight.value = night;
    u.uTime.value = time;

    const a = (t - 0.25) * Math.PI * 2;
    u.uSunDir.value.set(Math.cos(a) * 0.82, Math.sin(a), 0.42).normalize();
    u.uMoonDir.value.copy(u.uSunDir.value).multiplyScalar(-1);
    u.uMoonDir.value.y = Math.abs(u.uMoonDir.value.y) * 0.85 + 0.12; // lune toujours visible la nuit
    u.uMoonDir.value.normalize();

    const sunUp = u.uSunDir.value.y > -0.04;
    const dir = sunUp ? u.uSunDir.value : u.uMoonDir.value;
    this.sun.position.copy(center).addScaledVector(dir, 120);
    this.sun.target.position.copy(center);
    this.sun.color.copy(u.uSunCol.value);
    this.sun.intensity = num('li') * (sunUp ? Math.min(1, (u.uSunDir.value.y + 0.04) * 6 + 0.3) : 1) * 1.6;

    col('hemiS', this.hemi.color);
    col('hemiG', this.hemi.groundColor);
    this.hemi.intensity = num('hi') * 1.25;

    this.scene.fog.color.copy(u.uHor.value);
    this.scene.fog.near = 60 + night * 10;
    this.mesh.position.copy(center);

    const s = this.state;
    s.night = night;
    col('water', s.water);
    s.hor.copy(u.uHor.value);
    s.sunDir.copy(dir);
    s.lightCol.copy(u.uSunCol.value);
    return s;
  }
}

export function timeLabel(t) {
  const mins = Math.floor(t * 24 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  return String(h).padStart(2, '0') + 'h' + String(m).padStart(2, '0');
}
