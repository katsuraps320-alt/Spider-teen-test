// ============================================================
// Input Manager — virtual joystick, camera swipe, action buttons
// ============================================================
export class InputManager {
  constructor(game) {
    this.game = game;
    this.move = { x: 0, y: 0 }; // -1..1
    this.lookDelta = { x: 0, y: 0 }; // per-frame swipe delta (consumed by camera)
    this.actions = { jump: false, attack: false, vortex: false, boost: false, release: false };
    this.actionPressed = { jump: false, attack: false, vortex: false, boost: false, release: false }; // edge-triggered
    this.boostHeld = false;

    this._joyActive = false;
    this._joyTouchId = null;
    this._joyOrigin = { x: 0, y: 0 };

    this._camActive = false;
    this._camTouchId = null;
    this._camLast = { x: 0, y: 0 };

    this._setupJoystick();
    this._setupCamera();
    this._setupButtons();
    this._setupEmoteMenu();
    this._setupKeyboardFallback(); // for desktop testing
  }

  update(dt) {
    // reset edge-triggered flags each frame after Player consumes them via consume()
  }

  consume(action) {
    if (this.actionPressed[action]) { this.actionPressed[action] = false; return true; }
    return false;
  }

  // ---------------- joystick ----------------
  _setupJoystick() {
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    const maxR = 45;

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this._joyActive = true;
      this._joyTouchId = e.changedTouches ? t.identifier : 'mouse';
      const rect = base.getBoundingClientRect();
      this._joyOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateKnob(t);
      e.preventDefault();
    };
    const move = (e) => {
      if (!this._joyActive) return;
      let t = null;
      if (e.changedTouches) {
        for (const touch of e.changedTouches) if (touch.identifier === this._joyTouchId) t = touch;
      } else t = e;
      if (!t) return;
      updateKnob(t);
      e.preventDefault();
    };
    const end = (e) => {
      if (!this._joyActive) return;
      if (e.changedTouches) {
        let found = false;
        for (const touch of e.changedTouches) if (touch.identifier === this._joyTouchId) found = true;
        if (!found) return;
      }
      this._joyActive = false;
      this.move.x = 0; this.move.y = 0;
      knob.style.transform = `translate(0px,0px)`;
    };
    const updateKnob = (t) => {
      let dx = t.clientX - this._joyOrigin.x;
      let dy = t.clientY - this._joyOrigin.y;
      const dist = Math.min(maxR, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * dist, ky = Math.sin(ang) * dist;
      knob.style.transform = `translate(${kx}px,${ky}px)`;
      this.move.x = kx / maxR;
      this.move.y = -ky / maxR; // invert so up = positive
    };

    zone.addEventListener('touchstart', start, { passive: false });
    zone.addEventListener('touchmove', move, { passive: false });
    zone.addEventListener('touchend', end, { passive: false });
    zone.addEventListener('touchcancel', end, { passive: false });
    // mouse fallback for desktop testing
    zone.addEventListener('mousedown', start);
    window.addEventListener('mousemove', (e) => { if (this._joyActive) move(e); });
    window.addEventListener('mouseup', end);
  }

  // ---------------- camera swipe ----------------
  _setupCamera() {
    const zone = document.getElementById('camera-zone');
    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this._camActive = true;
      this._camTouchId = e.changedTouches ? t.identifier : 'mouse';
      this._camLast = { x: t.clientX, y: t.clientY };
    };
    const move = (e) => {
      if (!this._camActive) return;
      let t = null;
      if (e.changedTouches) {
        for (const touch of e.changedTouches) if (touch.identifier === this._camTouchId) t = touch;
      } else t = e;
      if (!t) return;
      const dx = t.clientX - this._camLast.x;
      const dy = t.clientY - this._camLast.y;
      this.lookDelta.x += dx;
      this.lookDelta.y += dy;
      this._camLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    };
    const end = (e) => { this._camActive = false; };

    zone.addEventListener('touchstart', start, { passive: false });
    zone.addEventListener('touchmove', move, { passive: false });
    zone.addEventListener('touchend', end, { passive: false });
    zone.addEventListener('touchcancel', end, { passive: false });
    zone.addEventListener('mousedown', start);
    window.addEventListener('mousemove', (e) => { if (this._camActive) move(e); });
    window.addEventListener('mouseup', end);
  }

  consumeLookDelta() {
    const d = { x: this.lookDelta.x, y: this.lookDelta.y };
    this.lookDelta.x = 0; this.lookDelta.y = 0;
    return d;
  }

  // ---------------- action buttons ----------------
  _setupButtons() {
    const map = {
      'btn-jump': 'jump',
      'btn-attack': 'attack',
      'btn-vortex': 'vortex',
      'btn-boost': 'boost',
      'btn-release': 'release'
    };
    for (const [id, action] of Object.entries(map)) {
      const el = document.getElementById(id);
      const down = (e) => {
        e.preventDefault();
        this.actions[action] = true;
        this.actionPressed[action] = true;
        if (action === 'boost') this.boostHeld = true;
      };
      const up = (e) => {
        e.preventDefault();
        this.actions[action] = false;
        if (action === 'boost') this.boostHeld = false;
      };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
    }
  }

  // ---------------- emote menu ----------------
  _setupEmoteMenu() {
    const btn = document.getElementById('btn-emote');
    const menu = document.getElementById('emote-menu');
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); menu.classList.toggle('hidden'); }, { passive: false });
    btn.addEventListener('mousedown', () => menu.classList.toggle('hidden'));
    menu.querySelectorAll('.emote-option').forEach(opt => {
      opt.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.game.player.playEmote(opt.dataset.emote);
        menu.classList.add('hidden');
      }, { passive: false });
      opt.addEventListener('mousedown', () => {
        this.game.player.playEmote(opt.dataset.emote);
        menu.classList.add('hidden');
      });
    });
  }

  // ---------------- keyboard fallback (desktop testing) ----------------
  _setupKeyboardFallback() {
    const keys = {};
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Space') { this.actions.jump = true; this.actionPressed.jump = true; }
      if (e.code === 'KeyF') { this.actions.attack = true; this.actionPressed.attack = true; }
      if (e.code === 'KeyE') { this.actions.vortex = true; this.actionPressed.vortex = true; }
      if (e.code === 'ShiftLeft') { this.actions.boost = true; this.boostHeld = true; }
      if (e.code === 'KeyR') { this.actions.release = true; this.actionPressed.release = true; }
      this._applyKeyMove(keys);
    });
    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
      if (e.code === 'Space') this.actions.jump = false;
      if (e.code === 'KeyF') this.actions.attack = false;
      if (e.code === 'KeyE') this.actions.vortex = false;
      if (e.code === 'ShiftLeft') { this.actions.boost = false; this.boostHeld = false; }
      if (e.code === 'KeyR') this.actions.release = false;
      this._applyKeyMove(keys);
    });
  }
  _applyKeyMove(keys) {
    let x = 0, y = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) x += 1;
    if (keys['KeyW'] || keys['ArrowUp']) y += 1;
    if (keys['KeyS'] || keys['ArrowDown']) y -= 1;
    this.move.x = x; this.move.y = y;
  }
}
