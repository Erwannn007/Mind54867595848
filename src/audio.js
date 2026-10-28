// Tout le son d'Éverlune est synthétisé en direct (Web Audio API) : aucun fichier,
// fonctionne hors-ligne, et réagit au monde (surface, heure, altitude, eau, vent…).
//
//  ambiance : vent, bruissement des feuilles, rivière, clapotis, oiseaux, grillons,
//             chouette, grenouilles, carillons de village, feu de camp, scintillements de rêve
//  effets   : pas (herbe, sable, pierre, neige, terre, eau), interface, découvertes, construction
//  musique  : générative, douce, en fa majeur / ré mineur pentatonique selon l'heure,
//             avec de longs silences entre les morceaux

const PENTA = [0, 2, 4, 7, 9]; // fa sol la do ré
const ROOT = 53; // fa3 en MIDI
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Progressions (notes MIDI). Jour : fa majeur ; nuit : ré mineur (mêmes notes, autre couleur).
const DAY_CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [50, 57, 60, 65], // Dm7
  [46, 53, 57, 62], // Bbmaj7 (sans 7e)
  [48, 55, 60, 62], // Csus2
];
const NIGHT_CHORDS = [
  [50, 57, 60, 64], // Dm9
  [46, 53, 57, 62], // Bbmaj7
  [43, 50, 53, 58], // Gm7
  [45, 52, 55, 60], // Am7
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { music: 1, amb: 1, sfx: 1 };
    this.env = {
      night: 0, tod: 0.3, wind: 1, altitude: 5, forest: 0, dream: 0, snow: 0,
      river: 0, lake: 0, swimming: false, fire: 0, village: 0, speed: 0,
    };
    this.timers = {};
    this.music = { playing: false, nextStart: 0, nextBeat: 0, beat: 0, bars: 0, chord: 0, melodyNote: 2, night: false };
  }

  // À appeler dans un geste de l'utilisateur (toucher, clic, touche).
  unlock() {
    try {
      // iOS 17+ : joue même quand l'iPhone est en mode silencieux
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (_) { /* rien */ }
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  setVolume(kind, v) {
    this.vol[kind] = v;
    if (!this.ctx) return;
    const base = { music: 0.6, amb: 0.9, sfx: 0.8 }[kind];
    this.bus[kind].gain.setTargetAtTime(v * base, this.ctx.currentTime, 0.3);
  }

  // ——— graphe audio ———
  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 1.7;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);

    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.6);
    this.reverb.connect(this.master);

    this.bus = {};
    const sends = { music: 0.6, amb: 0.22, sfx: 0.18 };
    for (const k of ['music', 'amb', 'sfx']) {
      const g = c.createGain();
      g.connect(this.master);
      const s = c.createGain();
      s.gain.value = sends[k];
      g.connect(s).connect(this.reverb);
      this.bus[k] = g;
      this.setVolume(k, this.vol[k]);
    }

    this.white = this.noise('white', 4);
    this.pink = this.noise('pink', 5);
    this.brown = this.noise('brown', 6);
    this.buildAmbience();
    this.music.nextStart = c.currentTime + 5;
  }

  impulse(seconds, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noise(kind, seconds) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const d = new Float32Array(len);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // boucle sans clic : le début est fondu avec la fin, qui est ensuite retirée
    const f = Math.min(4000, len >> 3);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[i] = d[i] * k + d[len - f + i] * (1 - k);
    }
    const buf = c.createBuffer(1, len - f, c.sampleRate);
    buf.getChannelData(0).set(d.subarray(0, len - f));
    return buf;
  }

  // Source de bruit en boucle → chaîne de filtres → gain (renvoie les nœuds à piloter).
  loop(buf, filters, bus) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    let node = src;
    const fl = filters.map(([type, freq, q]) => {
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      node.connect(f);
      node = f;
      return f;
    });
    const g = c.createGain();
    g.gain.value = 0;
    node.connect(g).connect(bus);
    src.start(0, Math.random() * buf.duration);
    return { gain: g, filters: fl };
  }

  buildAmbience() {
    const A = this.bus.amb;
    this.amb = {
      wind: this.loop(this.brown, [['bandpass', 420, 0.5]], A),
      whistle: this.loop(this.pink, [['bandpass', 950, 7]], A),
      leaves: this.loop(this.pink, [['highpass', 1900, 0.5], ['lowpass', 7500, 0.5]], A),
      river: this.loop(this.white, [['lowpass', 1500, 0.4], ['bandpass', 650, 0.45]], A),
      babble: this.loop(this.pink, [['bandpass', 1200, 2.2]], A),
      lake: this.loop(this.brown, [['lowpass', 520, 0.6]], A),
      fire: this.loop(this.brown, [['lowpass', 320, 0.7]], A),
      dream: this.loop(this.pink, [['bandpass', 5200, 9]], A),
    };
  }

  // ——— mise à jour (chaque image) ———
  update(dt, env) {
    if (!this.ready) return;
    Object.assign(this.env, env);
    const e = this.env;
    const c = this.ctx;
    const t = c.currentTime;
    const T = 0.6; // constante de lissage (s)
    const set = (param, v, tc = T) => param.setTargetAtTime(v, t, tc);

    // vent : plus fort en altitude, porté par les rafales du monde
    const high = clamp01((e.altitude - 18) / 45);
    const gust = 0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.071 + 1.3);
    const windAmt = (0.05 + 0.1 * e.wind * gust + 0.22 * high) * (e.swimming ? 0.4 : 1);
    set(this.amb.wind.gain.gain, windAmt * 0.9);
    set(this.amb.wind.filters[0].frequency, 280 + 380 * gust + 300 * high, 1.2);
    set(this.amb.whistle.gain.gain, 0.012 * high * gust * e.wind);
    set(this.amb.whistle.filters[0].frequency, 800 + 500 * gust, 1.5);
    set(this.amb.leaves.gain.gain, 0.05 * e.forest * (0.35 + e.wind * gust) * (1 - high));

    // eau qui coule / clapote
    set(this.amb.river.gain.gain, 0.16 * e.river);
    set(this.amb.babble.gain.gain, 0.05 * e.river);
    if (Math.random() < dt * 8) set(this.amb.babble.filters[0].frequency, rnd(700, 2100), 0.05);
    const swell = 0.55 + 0.45 * Math.sin(t * 0.55) * Math.sin(t * 0.19 + 2);
    set(this.amb.lake.gain.gain, (0.2 * e.lake + (e.swimming ? 0.25 : 0)) * swell, 0.4);

    set(this.amb.fire.gain.gain, 0.22 * e.fire);
    set(this.amb.dream.gain.gain, 0.008 * e.dream * (0.4 + e.night));

    // évènements ponctuels
    const day = 1 - e.night;
    const dawnChorus = 1 + 2 * Math.max(0, 1 - Math.abs(e.tod - 0.29) / 0.06);
    this.every('bird', dt, 0.45 * day * dawnChorus * (0.3 + e.forest) * (1 - high * 0.8) * (e.swimming ? 0.3 : 1), () => this.bird());
    this.every('cricket', dt, 2.4 * e.night * (1 - high) * (1 - e.snow), () => this.cricket());
    this.every('owl', dt, 0.03 * e.night * (0.3 + e.forest), () => this.owl());
    this.every('frog', dt, 0.5 * e.night * Math.max(e.lake, e.river * 0.5), () => this.frog());
    this.every('chime', dt, 0.5 * e.village * (0.4 + e.wind * gust), () => this.chime());
    this.every('crackle', dt, 9 * e.fire, () => this.crackle());
    this.every('bubble', dt, 3 * e.river + (e.swimming ? 1.5 : 0), () => this.bubble());
    this.every('sparkle', dt, 0.35 * e.dream, () => this.sparkle());

    this.updateMusic();
  }

  // Processus de Poisson : en moyenne `rate` évènements par seconde.
  every(name, dt, rate, fn) {
    if (rate <= 0) return;
    if (Math.random() < rate * dt) fn();
  }

  // ——— briques de synthèse ———
  pan(p, dest) {
    const c = this.ctx;
    if (!c.createStereoPanner) return dest;
    const n = c.createStereoPanner();
    n.pan.value = p;
    n.connect(dest);
    return n;
  }

  envelope(param, t, attack, decay, peak) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(t, { freq, type = 'sine', attack = 0.005, decay = 0.3, gain = 0.1, dest, glide = null, glideTime = 0.1, detune = 0 }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + glideTime);
    o.detune.value = detune;
    const g = c.createGain();
    this.envelope(g.gain, t, attack, decay, gain);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
    return o;
  }

  burst(t, { filter = 'bandpass', freq = 2000, q = 1, attack = 0.004, decay = 0.08, gain = 0.2, dest, sweep = null, buf = null, lowpass = null }) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buf || this.white;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + attack + decay);
    f.Q.value = q;
    let node = s.connect(f);
    if (lowpass) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      node = node.connect(lp);
    }
    const g = c.createGain();
    this.envelope(g.gain, t, attack, decay, gain);
    node.connect(g).connect(dest);
    s.start(t, Math.random() * (s.buffer.duration - 1));
    s.stop(t + attack + decay + 0.05);
  }

  // ——— pas ———
  footstep(surface, speed) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    const v = (0.6 + Math.min(speed / 7.8, 1) * 0.5) * rnd(0.85, 1.1);
    const d = this.pan(rnd(-0.12, 0.12), this.bus.sfx);
    switch (surface) {
      case 'water':
        this.burst(t, { filter: 'lowpass', freq: rnd(2800, 3800), sweep: 380, q: 0.7, attack: 0.01, decay: 0.32, gain: 0.32 * v, dest: d });
        for (let i = 0; i < 3; i++) {
          const f = rnd(500, 1100);
          this.tone(t + 0.05 + i * rnd(0.03, 0.07), { freq: f, glide: f * 1.6, glideTime: 0.05, decay: 0.05, gain: 0.03 * v, dest: d });
        }
        break;
      case 'sand':
        this.burst(t, { filter: 'lowpass', freq: rnd(900, 1300), q: 0.5, attack: 0.02, decay: 0.16, gain: 0.3 * v, dest: d });
        this.burst(t + 0.04, { filter: 'bandpass', freq: 3000, q: 0.8, attack: 0.01, decay: 0.08, gain: 0.06 * v, dest: d });
        break;
      case 'stone':
        this.burst(t, { filter: 'bandpass', freq: rnd(1700, 2500), q: 2.2, attack: 0.002, decay: 0.05, gain: 0.32 * v, dest: d });
        this.tone(t, { freq: rnd(100, 130), glide: 60, glideTime: 0.06, decay: 0.07, gain: 0.18 * v, dest: d });
        this.burst(t + 0.05, { filter: 'bandpass', freq: 3200, q: 3, attack: 0.002, decay: 0.03, gain: 0.08 * v, dest: d });
        break;
      case 'snow':
        for (let i = 0; i < 7; i++) {
          this.burst(t + i * rnd(0.012, 0.024), { filter: 'bandpass', freq: rnd(2200, 3600), q: 1.2, attack: 0.002, decay: 0.02, gain: 0.16 * v, dest: d });
        }
        this.burst(t, { filter: 'lowpass', freq: 700, q: 0.5, attack: 0.01, decay: 0.12, gain: 0.12 * v, dest: d });
        break;
      case 'dirt':
        this.burst(t, { filter: 'bandpass', freq: rnd(900, 1300), q: 0.9, attack: 0.005, decay: 0.09, gain: 0.3 * v, dest: d });
        this.tone(t, { freq: 80, glide: 50, glideTime: 0.06, decay: 0.07, gain: 0.16 * v, dest: d });
        break;
      default: // herbe
        this.burst(t, { filter: 'bandpass', freq: rnd(1900, 2900), q: 0.7, attack: 0.008, decay: 0.11, gain: 0.26 * v, dest: d, lowpass: 6000 });
        this.burst(t + rnd(0.03, 0.05), { filter: 'highpass', freq: 3500, q: 0.5, attack: 0.005, decay: 0.07, gain: 0.08 * v, dest: d });
        this.tone(t, { freq: 75, glide: 48, glideTime: 0.06, decay: 0.06, gain: 0.1 * v, dest: d });
    }
  }

  // ——— faune et ambiance ———
  bird() {
    const t = this.ctx.currentTime + 0.02;
    const d = this.pan(rnd(-0.9, 0.9), this.bus.amb);
    const g = rnd(0.012, 0.03);
    const kind = Math.floor(Math.random() * 4);
    if (kind === 0) { // gazouillis descendant
      const n = 3 + Math.floor(Math.random() * 4), base = rnd(3200, 4500);
      for (let i = 0; i < n; i++) this.tone(t + i * rnd(0.08, 0.11), { freq: base * rnd(0.95, 1.05), glide: base * 0.62, glideTime: 0.06, attack: 0.004, decay: 0.07, gain: g, dest: d });
    } else if (kind === 1) { // « tui-tui » sifflé
      const base = rnd(1800, 2400);
      for (let i = 0; i < 2; i++) {
        this.tone(t + i * 0.32, { freq: base, glide: base * 1.35, glideTime: 0.16, attack: 0.02, decay: 0.2, gain: g * 1.2, dest: d });
      }
    } else if (kind === 2) { // trille rapide
      const base = rnd(3600, 4600), n = 8 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) this.tone(t + i * 0.035, { freq: base, glide: base * 0.85, glideTime: 0.025, attack: 0.003, decay: 0.025, gain: g * 0.8, dest: d });
    } else { // petite phrase de merle
      let f = rnd(1500, 2200);
      for (let i = 0; i < 4; i++) {
        const nf = f * pick([0.84, 1.12, 1.26, 0.94]);
        this.tone(t + i * rnd(0.12, 0.18), { freq: f, glide: nf, glideTime: 0.1, attack: 0.01, decay: 0.12, gain: g * 1.1, dest: d });
        f = nf;
      }
    }
  }

  cricket() {
    const t = this.ctx.currentTime + 0.02;
    const d = this.pan(rnd(-1, 1), this.bus.amb);
    const f = rnd(4200, 4900), g = rnd(0.004, 0.012);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(t + i * 0.045, { freq: f, attack: 0.004, decay: 0.022, gain: g, dest: d });
  }

  owl() {
    const t = this.ctx.currentTime + 0.05;
    const d = this.pan(rnd(-0.8, 0.8), this.bus.amb);
    const f = rnd(340, 400);
    const pattern = Math.random() < 0.5 ? [0, 0.55] : [0, 0.4, 0.75, 1.5];
    pattern.forEach((o, i) => this.tone(t + o, { freq: f * (i === pattern.length - 1 ? 0.92 : 1), glide: f * 0.88, glideTime: 0.3, attack: 0.06, decay: 0.32, gain: 0.05, dest: d }));
  }

  frog() {
    const t = this.ctx.currentTime + 0.02;
    const c = this.ctx;
    const d = this.pan(rnd(-0.9, 0.9), this.bus.amb);
    const n = 2 + Math.floor(Math.random() * 2);
    const f = rnd(110, 170);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.22;
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, tt);
      o.frequency.linearRampToValueAtTime(f * 0.85, tt + 0.15);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 3.5;
      bp.Q.value = 4;
      const g = c.createGain();
      this.envelope(g.gain, tt, 0.02, 0.14, 0.05);
      o.connect(bp).connect(g).connect(d);
      o.start(tt);
      o.stop(tt + 0.2);
    }
  }

  bell(t, freq, gain, dest, decay = 3) {
    this.tone(t, { freq, attack: 0.003, decay, gain, dest });
    this.tone(t, { freq: freq * 2.76, attack: 0.002, decay: decay * 0.45, gain: gain * 0.35, dest });
    this.tone(t, { freq: freq * 5.4, attack: 0.001, decay: decay * 0.18, gain: gain * 0.15, dest });
  }

  chime() {
    const t = this.ctx.currentTime + 0.02;
    const d = this.pan(rnd(-0.6, 0.6), this.bus.amb);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.bell(t + i * rnd(0.15, 0.4), mtof(ROOT + 24 + pick(PENTA) + pick([0, 12])), 0.02, d);
  }

  crackle() {
    const t = this.ctx.currentTime + 0.01;
    const d = this.pan(rnd(-0.3, 0.3), this.bus.amb);
    this.burst(t, { filter: 'highpass', freq: rnd(1500, 4000), q: 0.7, attack: 0.001, decay: rnd(0.005, 0.03), gain: rnd(0.05, 0.2) * this.env.fire, dest: d });
  }

  bubble() {
    const t = this.ctx.currentTime + 0.01;
    const d = this.pan(rnd(-0.7, 0.7), this.bus.amb);
    const f = rnd(350, 1000);
    this.tone(t, { freq: f, glide: f * rnd(1.5, 2.2), glideTime: 0.04, attack: 0.003, decay: 0.05, gain: 0.012, dest: d });
  }

  sparkle() {
    const t = this.ctx.currentTime + 0.01;
    const d = this.pan(rnd(-1, 1), this.bus.amb);
    for (let i = 0; i < 3; i++) this.tone(t + i * 0.09, { freq: mtof(ROOT + 36 + pick(PENTA)), attack: 0.01, decay: 1.4, gain: 0.006, dest: d });
  }

  // ——— interface ———
  ui(kind) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.005;
    const d = this.bus.sfx;
    const note = (deg, oct = 2) => mtof(ROOT + oct * 12 + PENTA[((deg % 5) + 5) % 5] + Math.floor(deg / 5) * 12);
    switch (kind) {
      case 'click':
        this.tone(t, { freq: note(Math.floor(rnd(0, 5)), 3), attack: 0.002, decay: 0.09, gain: 0.03, dest: d });
        break;
      case 'open':
        this.burst(t, { filter: 'bandpass', freq: 400, sweep: 1800, q: 1.5, attack: 0.08, decay: 0.2, gain: 0.04, dest: d });
        this.bell(t + 0.05, note(0, 3), 0.02, d, 1.2);
        this.bell(t + 0.15, note(2, 3), 0.018, d, 1.2);
        break;
      case 'close':
        this.burst(t, { filter: 'bandpass', freq: 1600, sweep: 400, q: 1.5, attack: 0.04, decay: 0.2, gain: 0.035, dest: d });
        this.bell(t + 0.04, note(2, 3), 0.015, d, 0.9);
        break;
      case 'discover':
        [0, 2, 4, 5, 7].forEach((deg, i) => this.bell(t + i * 0.14, note(deg, 2), 0.035, d, 2.6));
        break;
      case 'build':
        this.tone(t, { freq: 190, glide: 110, glideTime: 0.08, attack: 0.002, decay: 0.12, gain: 0.2, dest: d });
        this.burst(t, { filter: 'bandpass', freq: 650, q: 3, attack: 0.002, decay: 0.08, gain: 0.15, dest: d });
        this.tone(t + 0.16, { freq: 170, glide: 100, glideTime: 0.08, attack: 0.002, decay: 0.1, gain: 0.14, dest: d });
        this.burst(t + 0.16, { filter: 'bandpass', freq: 600, q: 3, attack: 0.002, decay: 0.07, gain: 0.1, dest: d });
        this.bell(t + 0.3, note(4, 3), 0.02, d, 1.5);
        break;
      case 'remove':
        this.burst(t, { filter: 'bandpass', freq: 2200, sweep: 300, q: 1.2, attack: 0.02, decay: 0.3, gain: 0.06, dest: d });
        this.bell(t + 0.05, note(0, 2), 0.02, d, 1.2);
        break;
      case 'pad':
        this.bell(t, note(0, 3), 0.025, d, 1.2);
        this.bell(t + 0.12, note(4, 3), 0.025, d, 1.6);
        break;
    }
  }

  // ——— musique générative ———
  updateMusic() {
    const c = this.ctx, m = this.music, t = c.currentTime;
    if (!m.playing) {
      if (t >= m.nextStart) {
        m.playing = true;
        m.night = this.env.night > 0.5;
        m.tempo = m.night ? 44 : rnd(52, 58);
        m.bars = 16 + Math.floor(Math.random() * 12);
        m.beat = 0;
        m.chord = 0;
        m.melodyNote = 2 + Math.floor(Math.random() * 3);
        m.nextBeat = t + 0.1;
        m.prog = m.night ? NIGHT_CHORDS : DAY_CHORDS;
        if (Math.random() < 0.5) m.prog = [m.prog[0], m.prog[2], m.prog[1], m.prog[3]];
      }
      return;
    }
    const spb = 60 / m.tempo;
    while (m.nextBeat < t + 0.6) {
      this.musicBeat(m.nextBeat, spb);
      m.nextBeat += spb;
      m.beat++;
      if (m.beat >= m.bars * 4) {
        m.playing = false;
        m.nextStart = m.nextBeat + 8 + rnd(40, 95); // un long silence, puis un autre morceau
        break;
      }
    }
  }

  musicBeat(t, spb) {
    const m = this.music;
    const d = this.bus.music;
    const bar = Math.floor(m.beat / 4), beatInBar = m.beat % 4;
    const fadeOut = m.beat >= (m.bars - 2) * 4;
    const intro = bar < 2;

    // nappe : un accord toutes les 2 mesures
    if (beatInBar === 0 && bar % 2 === 0) {
      const chord = m.prog[(bar / 2) % m.prog.length];
      this.pad(t, chord, spb * 8, d);
      this.tone(t, { freq: mtof(chord[0] - 12), attack: 1.2, decay: spb * 7, gain: 0.05, dest: d });
    }
    if (intro) return;

    // mélodie : promenade sur la gamme pentatonique, avec des respirations
    const density = (m.night ? 0.32 : 0.45) * (fadeOut ? 0.4 : 1);
    const offbeat = Math.random() < 0.18;
    if (Math.random() < density) {
      m.melodyNote += pick([-2, -1, -1, 1, 1, 2, 0]);
      m.melodyNote = Math.max(0, Math.min(9, m.melodyNote));
      const midi = ROOT + 12 + (m.night ? 0 : 12) + PENTA[m.melodyNote % 5] + Math.floor(m.melodyNote / 5) * 12;
      this.pluck(t + (offbeat ? spb / 2 : 0), mtof(midi), m.night ? 0.05 : 0.06, d, m.night);
      if (Math.random() < 0.15) this.pluck(t + spb * 0.5, mtof(midi + pick([3, 5, 7])), 0.035, d, m.night);
    }
  }

  pluck(t, freq, gain, dest, soft) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(soft ? 1800 : 3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 1.8);
    lp.connect(dest);
    const decay = soft ? 3.2 : 2.4;
    this.tone(t, { freq, type: 'triangle', attack: 0.004, decay, gain, dest: lp });
    this.tone(t, { freq: freq * 2, attack: 0.003, decay: decay * 0.35, gain: gain * 0.3, dest: lp });
    if (soft) this.tone(t, { freq: freq * 4, attack: 0.002, decay: 0.8, gain: gain * 0.08, dest: lp });
  }

  pad(t, chord, dur, dest) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.3;
    const g = c.createGain();
    const attack = Math.min(3, dur * 0.35), rel = Math.min(3.5, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.022, t + attack);
    g.gain.setValueAtTime(0.022, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    lp.connect(g).connect(dest);
    for (const n of chord) {
      for (const det of [-7, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        o.detune.value = det + rnd(-2, 2);
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + rel + 0.1);
      }
    }
  }
}
