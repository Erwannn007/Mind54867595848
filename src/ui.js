// Interface discrète : boutons ronds, joystick, panneaux nacrés, noms de lieux.

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.stick = $('stick');
    this.knob = $('knob');
    this.toastEl = $('place');
    this.toastQueue = [];
    this.toastBusy = false;
    this.idleTimer = 0;
    this.handlers = {};
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }

  emit(name, ...args) {
    if (this.handlers[name]) this.handlers[name](...args);
  }

  init(state) {
    const stop = (el) => el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.querySelectorAll('.panel, #topbar').forEach(stop);

    $('btn-build').onclick = () => this.toggle('build-panel');
    $('btn-menu').onclick = () => this.toggle('menu');
    document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => this.closeAll()));

    document.querySelectorAll('[data-build]').forEach((b) => (b.onclick = () => this.emit('build', b.dataset.build)));
    $('btn-remove').onclick = () => this.emit('remove');

    this.segment('speed', state.daySpeed, (v) => this.emit('speed', parseFloat(v)));
    this.segment('pixel', state.pixel, (v) => this.emit('pixel', parseFloat(v)));
    this.segment('view', state.view, (v) => this.emit('view', parseInt(v, 10)));
    for (const k of ['music', 'amb', 'sfx']) this.segment(k, state.vol[k], (v) => this.emit('volume', k, parseFloat(v)));
    // petit son doux pour les boutons qui n'ont pas le leur
    document.querySelectorAll('.panel button:not([data-build]):not(#btn-remove):not([data-close])').forEach((b) =>
      b.addEventListener('click', () => this.emit('click')));
    document.querySelectorAll('[data-time]').forEach((b) => (b.onclick = () => this.emit('time', parseFloat(b.dataset.time))));

    $('seed').value = state.seed;
    $('btn-seed').onclick = () => this.emit('seed', $('seed').value.trim());
    $('btn-newworld').onclick = () => this.emit('seed', null);
  }

  segment(name, current, cb) {
    const btns = document.querySelectorAll(`[data-${name}]`);
    const sel = (v) => btns.forEach((b) => b.classList.toggle('on', parseFloat(b.dataset[name]) === parseFloat(v)));
    sel(current);
    btns.forEach((b) => (b.onclick = () => {
      sel(b.dataset[name]);
      cb(b.dataset[name]);
    }));
  }

  toggle(id) {
    const el = $(id);
    const open = el.hidden;
    this.closeAll();
    el.hidden = !open;
    if (open) this.emit('open', id);
    if (open && this.padFocusOnOpen) this.setPadFocus(this.padItems()[0]);
  }

  closeAll() {
    if (this.anyOpen()) this.emit('close');
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = true));
    this.setPadFocus(null);
  }

  // ——— navigation à la manette dans les panneaux ———
  padItems() {
    const panel = [...document.querySelectorAll('.panel')].find((p) => !p.hidden);
    return panel ? [...panel.querySelectorAll('button')] : [];
  }

  setPadFocus(el) {
    document.querySelectorAll('.pad-focus').forEach((b) => b.classList.remove('pad-focus'));
    this.padFocus = el;
    if (el) {
      el.classList.add('pad-focus');
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // déplacement spatial : le bouton le plus proche dans la direction demandée
  padNav(dir) {
    const items = this.padItems();
    if (!items.length) return;
    const cur = items.includes(this.padFocus) ? this.padFocus : null;
    if (!cur) return this.setPadFocus(items[0]);
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const b of items) {
      if (b === cur) continue;
      const r = b.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (main < 4) continue;
      const score = main + side * 2.5;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    if (best) this.setPadFocus(best);
  }

  padOk() {
    if (this.padFocus && this.padItems().includes(this.padFocus)) this.padFocus.click();
    else this.padNav('down');
  }

  anyOpen() {
    return [...document.querySelectorAll('.panel')].some((p) => !p.hidden);
  }

  setInfo({ time, seed, discovered }) {
    $('clock').textContent = time;
    if (seed !== undefined) $('seed').value = seed;
    if (discovered) {
      $('disc-count').textContent = discovered.length
        ? `${discovered.length} lieu${discovered.length > 1 ? 'x' : ''} découvert${discovered.length > 1 ? 's' : ''}`
        : 'Aucun lieu découvert pour l’instant';
      $('disc-list').innerHTML = discovered.slice(-12).reverse().map((n) => `<li>${n}</li>`).join('');
    }
  }


  // ——— joystick ———
  stickRadius() {
    return 52;
  }

  showStick(x, y) {
    this.stick.style.transform = `translate(${x - 60}px, ${y - 60}px)`;
    this.stick.classList.add('on');
  }

  moveKnob(dx, dy) {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  hideStick() {
    this.stick.classList.remove('on');
    this.knob.style.transform = 'translate(0, 0)';
  }

  // ——— apparition des noms de lieux ———
  toast(title, sub = '') {
    if (this.toastQueue.some((t) => t.title === title)) return;
    this.toastQueue.push({ title, sub });
    if (!this.toastBusy) this.nextToast();
  }

  nextToast() {
    const t = this.toastQueue.shift();
    if (!t) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    this.toastEl.querySelector('.name').textContent = t.title;
    this.toastEl.querySelector('.sub').textContent = t.sub;
    this.toastEl.classList.add('on');
    setTimeout(() => {
      this.toastEl.classList.remove('on');
      setTimeout(() => this.nextToast(), 1400);
    }, 3800);
  }

  // l'interface s'efface quand on ne la touche pas
  activity() {
    document.body.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => document.body.classList.add('idle'), 5000);
  }

  // le monde est prêt : on invite à entrer (le premier toucher réveille le son)
  ready() {
    $('loading').classList.add('ready');
  }

  enter() {
    $('loading').classList.add('gone');
    setTimeout(() => $('loading').remove(), 1600);
  }
}
