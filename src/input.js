// Commandes : joystick virtuel à gauche, glisser à droite pour regarder ; clavier + souris sur ordinateur.

export class Input {
  constructor(el, ui) {
    this.el = el;
    this.move = { x: 0, y: 0 };   // joystick (y > 0 = avancer)
    this.look = { dx: 0, dy: 0 }; // accumulé depuis la dernière lecture
    this.keys = new Set();
    this.stick = null;            // { id, ox, oy }
    this.lookers = new Map();     // id -> {x, y}
    this.ui = ui;
    this.onActivity = () => {};
    this.pad = null; // Gamepads, branché par main.js
    this.touchVert = 0; // boutons ▲ ▼ du vol
    this.onFlyToggle = () => {};

    el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyF' && !e.repeat) this.onFlyToggle();
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      this.onActivity();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.resetStick();
      this.lookers.clear();
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(e) {
    e.preventDefault();
    this.onActivity();
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (isTouch && e.clientX < window.innerWidth * 0.45 && !this.stick) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      this.ui.showStick(e.clientX, e.clientY);
    } else {
      this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
  }

  moveEv(e) {
    if (this.stick && e.pointerId === this.stick.id) {
      const R = this.ui.stickRadius();
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        // la base suit doucement le doigt quand il dépasse
        const k = (len - R) / len;
        this.stick.ox += dx * k; this.stick.oy += dy * k;
        dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
        this.ui.showStick(this.stick.ox, this.stick.oy);
      }
      this.move.x = dx / R;
      this.move.y = -dy / R;
      this.ui.moveKnob(dx, dy);
      return;
    }
    const l = this.lookers.get(e.pointerId);
    if (l) {
      this.look.dx += e.clientX - l.x;
      this.look.dy += e.clientY - l.y;
      l.x = e.clientX; l.y = e.clientY;
    }
  }

  up(e) {
    if (this.stick && e.pointerId === this.stick.id) this.resetStick();
    this.lookers.delete(e.pointerId);
  }

  resetStick() {
    this.stick = null;
    this.move.x = this.move.y = 0;
    this.ui.hideStick();
  }

  // Vecteur de déplacement combiné (joystick + clavier), longueur ≤ 1.
  moveVector() {
    let x = this.move.x, y = this.move.y;
    if (this.pad) { x += this.pad.move.x; y += this.pad.move.y; }
    const k = this.keys;
    if (k.has('KeyW') || k.has('KeyZ') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('KeyQ')) x -= 1;
    if (k.has('KeyD')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || (this.pad && this.pad.run);
    return { x, y, run };
  }

  // monter / descendre en vol (-1..1)
  vertical() {
    const k = this.keys;
    let v = this.touchVert + (this.pad ? this.pad.vert : 0);
    if (k.has('Space') || k.has('KeyE')) v += 1;
    if (k.has('KeyC') || k.has('ControlLeft') || k.has('KeyX')) v -= 1;
    return Math.max(-1, Math.min(1, v));
  }

  keyTurn() {
    const k = this.keys;
    return (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
  }

  takeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    if (this.pad) {
      // la manette donne des radians ; on les ramène à l'échelle « pixels glissés »
      l.dx += this.pad.look.x / 0.0052;
      l.dy += this.pad.look.y / 0.0052;
    }
    this.look.dx = this.look.dy = 0;
    return l;
  }
}
