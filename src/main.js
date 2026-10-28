// Éverlune — point d'entrée : assemble le monde, la boucle de jeu et la sauvegarde.

import * as THREE from 'three';
import { World } from './world.js';
import { seedFromString } from './noise.js';
import { createMaterials, shared } from './materials.js';
import { ChunkManager } from './chunks.js';
import { Sky, timeLabel } from './sky.js';
import { Water } from './water.js';
import { Motes } from './particles.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Builds } from './build.js';
import { loadSave, writeSave } from './save.js';
import { Gamepads } from './gamepad.js';
import { AudioEngine } from './audio.js';
import { CHUNK_SIZE } from './world.js';

const DAY_SECONDS = 24 * 60; // une journée complète = 24 minutes à vitesse normale

const save = loadSave();
if (!save.seed) save.seed = randomSeed();

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x9fc4e8);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1200);
const materials = createMaterials();
const sky = new Sky(scene);
const water = new Water(scene);
const motes = new Motes(scene);
const ui = new UI();
const input = new Input(canvas, ui);
input.onActivity = () => ui.activity();
const pads = new Gamepads();
input.pad = pads;
const audio = new AudioEngine();
for (const k of ['music', 'amb', 'sfx']) audio.vol[k] = save.vol[k];

let world, chunks, player, builds;
let tod = save.time;
let elapsed = 0;
let ready = false;

function randomSeed() {
  const words = ['lune', 'brume', 'aube', 'sauge', 'rosee', 'nacre', 'lys', 'songe', 'etoile', 'murmure'];
  return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function startWorld(seedStr, keepPosition) {
  if (chunks) chunks.disposeAll();
  if (player) scene.remove(player.light);
  if (builds) builds.load([]);
  save.seed = seedStr;
  world = new World(seedFromString(seedStr));
  chunks = new ChunkManager(world, scene, materials, { radius: save.view, detailRadius: Math.min(2, save.view - 1) });
  player = new Player(scene, camera, chunks);
  player.onStep = (speed) => audio.footstep(surfaceAt(player.x, player.z), speed);
  builds = new Builds(scene, materials, chunks);

  let x = save.x, z = save.z;
  if (!keepPosition || x === null || z === null) {
    const s = world.findSpawn(0, 0);
    x = s.x; z = s.z;
    save.builds = [];
    save.discovered = [];
    save.yaw = 0;
  }
  // les zones proches d'abord, avant d'afficher quoi que ce soit
  chunks.radius = 1;
  chunks.update(x, z, 0, true);
  chunks.radius = save.view;
  player.place(x, z);
  player.yaw = player.tYaw = save.yaw;
  player.pitch = player.tPitch = save.pitch;
  builds.load(save.builds);
  ui.setInfo({ time: timeLabel(tod), seed: seedStr, discovered: save.discovered });
  lastBiome = '';
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(save.pixel, window.devicePixelRatio || 1));
  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const bufH = renderer.domElement.height;
  shared.uPx.value = bufH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

function persist() {
  if (!player) return;
  save.x = player.x; save.z = player.z;
  save.yaw = player.tYaw; save.pitch = player.tPitch;
  save.time = tod;
  save.builds = builds.items;
  writeSave(save);
}
setInterval(persist, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    persist();
    audio.suspend();
  } else if (entered) audio.unlock();
});
window.addEventListener('pagehide', persist);

// ——— interface ———
ui.init(save);
ui.on('build', (type) => {
  const d = 2.8;
  const x = player.x - Math.sin(player.yaw) * d, z = player.z - Math.cos(player.yaw) * d;
  builds.place(type, x, z, player.yaw);
  audio.ui('build');
  persist();
});
ui.on('remove', () => {
  const d = 2.5;
  if (builds.removeNear(player.x - Math.sin(player.yaw) * d, player.z - Math.cos(player.yaw) * d)) audio.ui('remove');
  persist();
});
ui.on('volume', (kind, v) => {
  save.vol = { ...save.vol, [kind]: v };
  audio.setVolume(kind, v);
  persist();
});
ui.on('close', () => audio.ui('close'));
ui.on('click', () => audio.ui('click'));
ui.on('speed', (v) => (save.daySpeed = v));
ui.on('pixel', (v) => {
  save.pixel = v;
  resize();
});
ui.on('view', (v) => {
  save.view = v;
  chunks.radius = v;
  chunks.detailRadius = Math.min(2, v - 1);
  sky.scene.fog.far = 140 + v * 22;
});
ui.on('time', (t) => (tod = t));
ui.on('seed', (s) => {
  const seed = s || randomSeed();
  startWorld(seed, false);
  ui.closeAll();
  persist();
  ui.toast('Un nouveau monde', seed);
});
// ——— manette ———
pads.on = {
  activity: () => ui.activity(),
  menu: () => { ui.padFocusOnOpen = true; ui.toggle('menu'); },
  build: () => { ui.padFocusOnOpen = true; ui.toggle('build-panel'); },
  nav: (dir) => ui.padNav(dir),
  ok: () => ui.padOk(),
  back: () => ui.closeAll(),
  connect: (id) => {
    ui.toast('Manette connectée', /dualsense|054c|playstation/i.test(id) ? 'DualSense' : '');
    audio.ui('pad');
  },
  any: () => enter(),
  disconnect: () => ui.toast('Manette déconnectée'),
};
['btn-build', 'btn-menu'].forEach((id) => document.getElementById(id).addEventListener('click', () => (ui.padFocusOnOpen = false)));

ui.on('open', () => {
  ui.setInfo({ time: timeLabel(tod), discovered: save.discovered });
  audio.ui('open');
});

// ——— son : démarre au premier geste (exigence des navigateurs, surtout iOS) ———
let entered = false;
function enter() {
  audio.unlock();
  if (!entered && ready) {
    entered = true;
    ui.enter();
    setTimeout(() => ui.toast(world.biomeName(player.x, player.z), 'Éverlune'), 1400);
  }
}
for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) {
  window.addEventListener(ev, () => {
    if (!entered) enter();
    else if (!audio.ready) audio.unlock();
  }, { capture: true });
}

// surface sous les pieds, pour le son des pas
function surfaceAt(x, z) {
  const h = chunks.surfaceHeight(x, z);
  if (player.swimming || h < -0.25) return 'water';
  const slope = Math.abs(chunks.surfaceHeight(x + 1, z) - h) + Math.abs(chunks.surfaceHeight(x, z + 1) - h);
  const poi = world.getPoi(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
  const b = world.biome(x, z, h);
  if (h > 56) return 'snow';
  if (b.mountain > 0.55 || slope > 0.9) return 'stone';
  if (poi && poi.type === 'ruins' && Math.hypot(x - poi.x, z - poi.z) < 9) return 'stone';
  if (poi && poi.plaza && Math.hypot(x - poi.x, z - poi.z) < poi.plaza + 1) return 'dirt';
  if (b.beach > 0.5) return 'sand';
  if (b.cold > 0.85 && h > 40) return 'snow';
  return 'grass';
}

// ce que l'oreille perçoit autour du joueur (recalculé quelques fois par seconde)
const RING = [];
for (const r of [5, 12, 22]) for (let i = 0; i < 8; i++) RING.push([Math.cos((i / 8) * Math.PI * 2) * r, Math.sin((i / 8) * Math.PI * 2) * r, r]);
const soundEnv = {};
function listen() {
  const x = player.x, z = player.z;
  let water = 0, total = 0, flow = 0;
  for (const [dx, dz, r] of RING) {
    const w = 1 / r;
    total += w;
    if (chunks.surfaceHeight(x + dx, z + dz) < -0.3) {
      water += w;
      flow = Math.max(flow, world.riverness(x + dx, z + dz));
    }
  }
  const wet = Math.min(1, (water / total) * 1.6);
  const b = world.biome(x, z, player.y);
  let fire = 0;
  for (const it of builds.items) {
    if (it.type === 'campfire') fire = Math.max(fire, 1 - Math.hypot(it.x - x, it.z - z) / 14);
  }
  const poi = chunks.nearestPoi(x, z, 45);
  soundEnv.night = shared.uNight.value;
  soundEnv.tod = tod;
  soundEnv.wind = shared.uWind.value;
  soundEnv.altitude = player.y;
  soundEnv.forest = Math.min(1, b.forest * 1.2);
  soundEnv.dream = b.dream;
  soundEnv.snow = player.y > 50 ? 1 : 0;
  soundEnv.river = wet * flow;
  soundEnv.lake = wet * (1 - flow);
  soundEnv.swimming = player.swimming;
  soundEnv.fire = Math.max(0, fire);
  soundEnv.village = poi && poi.type === 'village' ? Math.max(0, 1 - Math.hypot(poi.x - x, poi.z - z) / 45) : 0;
}

// ——— découvertes ———
let lastBiome = '';
let biomeCandidate = '', biomeSince = 0;
function discoveries(now) {
  const poi = chunks.nearestPoi(player.x, player.z, 30);
  if (poi && !save.discovered.includes(poi.name)) {
    save.discovered.push(poi.name);
    ui.toast(poi.name, 'découvert');
    audio.ui('discover');
    persist();
    return;
  }
  const b = world.biomeName(player.x, player.z);
  if (b !== biomeCandidate) {
    biomeCandidate = b;
    biomeSince = now;
  } else if (b !== lastBiome && now - biomeSince > 2.5) {
    lastBiome = b;
    ui.toast(b);
  }
}

// ——— boucle ———
startWorld(save.seed, true);
resize();
sky.scene.fog.far = 140 + save.view * 22;
ui.activity();

const clock = new THREE.Clock();
let discTimer = 0, listenTimer = 1;
let fpsAcc = 0, fpsN = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  tod = (tod + (dt * save.daySpeed) / DAY_SECONDS) % 1;

  const center = new THREE.Vector3(player.x, player.y, player.z);
  const skyState = sky.update(tod, elapsed, center);
  shared.uTime.value = elapsed;
  shared.uNight.value = skyState.night;
  shared.uWind.value = 0.75 + 0.35 * Math.sin(elapsed * 0.11) + 0.15 * Math.sin(elapsed * 0.37);

  pads.update(dt, ui.anyOpen());
  player.update(dt, input, skyState.night);
  sky.mesh.position.copy(camera.position);
  water.update(center, elapsed, skyState);
  motes.update(center, (x, z) => chunks.surfaceHeight(x, z));
  chunks.update(player.x, player.z, ready ? 5 : 30);

  renderer.render(scene, camera);

  listenTimer += dt;
  if (listenTimer > 0.25) {
    listenTimer = 0;
    listen();
  }
  audio.update(dt, soundEnv);

  if (!ready) {
    ready = true;
    ui.ready();
    lastBiome = biomeCandidate = world.biomeName(player.x, player.z);
  }

  discTimer += dt;
  if (discTimer > 0.5) {
    discTimer = 0;
    discoveries(elapsed);
    document.getElementById('clock').textContent = timeLabel(tod);
  }

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) {
    window.__fps = Math.round(fpsN / fpsAcc);
    fpsAcc = 0; fpsN = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('gesturestart', (e) => e.preventDefault());

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// accès console pour le débogage
window.everlune = { audio, get world() { return world; }, get player() { return player; }, get chunks() { return chunks; }, renderer, scene, save,
  setTime: (t) => (tod = t) };
