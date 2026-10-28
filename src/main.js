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
  if (player) {
    scene.remove(player.avatar);
    scene.remove(player.light);
  }
  if (builds) builds.load([]);
  save.seed = seedStr;
  world = new World(seedFromString(seedStr));
  chunks = new ChunkManager(world, scene, materials, { radius: save.view, detailRadius: Math.min(2, save.view - 1) });
  player = new Player(scene, camera, chunks, materials);
  player.setMode(save.camMode);
  ui.setCamIcon(save.camMode);
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
  save.camMode = player.mode;
  save.builds = builds.items;
  writeSave(save);
}
setInterval(persist, 5000);
document.addEventListener('visibilitychange', () => document.hidden && persist());
window.addEventListener('pagehide', persist);

// ——— interface ———
ui.init(save);
ui.on('camera', () => {
  const m = player.mode === 'first' ? 'third' : 'first';
  player.setMode(m);
  save.camMode = m;
  ui.setCamIcon(m);
  camera.fov = m === 'first' ? 70 : 62;
  resize();
});
ui.on('build', (type) => {
  const d = player.mode === 'first' ? 2.8 : 3.2;
  const x = player.x - Math.sin(player.yaw) * d, z = player.z - Math.cos(player.yaw) * d;
  builds.place(type, x, z, player.yaw);
  persist();
});
ui.on('remove', () => {
  const d = 2.5;
  builds.removeNear(player.x - Math.sin(player.yaw) * d, player.z - Math.cos(player.yaw) * d);
  persist();
});
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
  camera: () => document.getElementById('btn-cam').click(),
  menu: () => { ui.padFocusOnOpen = true; ui.toggle('menu'); },
  build: () => { ui.padFocusOnOpen = true; ui.toggle('build-panel'); },
  nav: (dir) => ui.padNav(dir),
  ok: () => ui.padOk(),
  back: () => ui.closeAll(),
  connect: (id) => ui.toast('Manette connectée', /dualsense|054c|playstation/i.test(id) ? 'DualSense' : ''),
  disconnect: () => ui.toast('Manette déconnectée'),
};
['btn-build', 'btn-menu'].forEach((id) => document.getElementById(id).addEventListener('click', () => (ui.padFocusOnOpen = false)));

ui.on('open', () => ui.setInfo({ time: timeLabel(tod), discovered: save.discovered }));

// ——— découvertes ———
let lastBiome = '';
let biomeCandidate = '', biomeSince = 0;
function discoveries(now) {
  const poi = chunks.nearestPoi(player.x, player.z, 30);
  if (poi && !save.discovered.includes(poi.name)) {
    save.discovered.push(poi.name);
    ui.toast(poi.name, 'découvert');
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
let discTimer = 0;
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

  if (!ready) {
    ready = true;
    ui.ready();
    setTimeout(() => ui.toast(world.biomeName(player.x, player.z), 'Éverlune'), 1200);
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
window.everlune = { get world() { return world; }, get player() { return player; }, get chunks() { return chunks; }, renderer, scene, save,
  setTime: (t) => (tod = t) };
