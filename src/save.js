// Sauvegarde locale (localStorage), sans compte ni serveur.

const KEY = 'everlune.save.v1';

export const DEFAULTS = {
  seed: null,
  x: null, z: null, yaw: 0, pitch: -0.08,
  time: 0.3,
  camMode: 'first',
  pixel: 0.75,
  view: 3,
  daySpeed: 1,
  builds: [],
  discovered: [],
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) { /* stockage indisponible : on repart de zéro */ }
  return { ...DEFAULTS };
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (_) { /* rien */ }
}
