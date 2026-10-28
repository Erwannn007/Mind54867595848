// Manettes (AYN Thor, DualSense PS5, Xbox…) via la Gamepad API, disposition « standard ».
//
//  Stick gauche : marcher (à fond ou R2 / L3 = courir)   Stick droit : regarder
//  Triangle / Y : vue 1re ↔ 3e personne                    Options / Start : menu
//  Carré / X ou Share / Select : construire
//  Dans un panneau : croix directionnelle ou stick gauche pour choisir,
//                    Croix / A pour valider, Rond / B pour fermer.

const BTN = { A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, L2: 6, R2: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.16;
const LOOK_SPEED = 2.6; // rad/s à fond

function dz(v) {
  const a = Math.abs(v);
  if (a < DEAD) return 0;
  return Math.sign(v) * ((a - DEAD) / (1 - DEAD));
}

export class Gamepads {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.run = false;
    this.look = { x: 0, y: 0 }; // radians à appliquer cette image
    this.prev = [];
    this.navHold = 0;
    this.navDir = null;
    this.connected = false;
    this.on = {}; // actions : camera, menu, build, nav(dir), ok, back, connect(name), activity
    window.addEventListener('gamepadconnected', (e) => this.emit('connect', e.gamepad.id));
    window.addEventListener('gamepaddisconnected', () => this.emit('disconnect'));
  }

  emit(name, ...a) {
    if (this.on[name]) this.on[name](...a);
  }

  active() {
    if (!navigator.getGamepads) return null;
    for (const g of navigator.getGamepads()) if (g && g.connected) return g;
    return null;
  }

  update(dt, panelOpen) {
    const g = this.active();
    this.move.x = this.move.y = this.look.x = this.look.y = 0;
    this.run = false;
    if (!g) return;

    const pressed = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
    const now = g.buttons.map((_, i) => pressed(i));
    const prev = this.prev;
    const down = (i) => now[i] && !prev[i];
    this.prev = now;

    const lx = dz(g.axes[0] || 0), ly = dz(g.axes[1] || 0);
    const rx = dz(g.axes[2] || 0), ry = dz(g.axes[3] || 0);
    if (lx || ly || rx || ry || now.some(Boolean)) this.emit('activity');

    if (down(BTN.START)) this.emit('menu');
    if (down(BTN.SELECT) || (!panelOpen && down(BTN.X))) this.emit('build');

    if (panelOpen) {
      if (down(BTN.A)) this.emit('ok');
      if (down(BTN.B)) this.emit('back');
      // navigation avec répétition quand on maintient
      let dir = null;
      if (now[BTN.UP] || ly < -0.6) dir = 'up';
      else if (now[BTN.DOWN] || ly > 0.6) dir = 'down';
      else if (now[BTN.LEFT] || lx < -0.6) dir = 'left';
      else if (now[BTN.RIGHT] || lx > 0.6) dir = 'right';
      if (dir !== this.navDir) {
        this.navDir = dir;
        this.navHold = 0;
        if (dir) this.emit('nav', dir);
      } else if (dir) {
        this.navHold += dt;
        if (this.navHold > 0.42) {
          this.navHold -= 0.12;
          this.emit('nav', dir);
        }
      }
      return;
    }
    this.navDir = null;

    if (down(BTN.Y)) this.emit('camera');

    let mx = lx, my = -ly;
    if (now[BTN.UP]) my += 1;
    if (now[BTN.DOWN]) my -= 1;
    if (now[BTN.LEFT]) mx -= 1;
    if (now[BTN.RIGHT]) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx;
    this.move.y = my;
    this.run = now[BTN.R2] || now[BTN.L3];

    // courbe douce : précis au centre, rapide à fond
    this.look.x = rx * Math.abs(rx) * LOOK_SPEED * dt;
    this.look.y = ry * Math.abs(ry) * LOOK_SPEED * 0.75 * dt;
  }
}
