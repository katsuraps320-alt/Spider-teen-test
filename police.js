// ============================================================
// Police System — original wanted-level response, not copied from any game
// ============================================================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const SCANNER_LINES = [
  "Dispatch: unit responding to Central District.",
  "All units, be advised — Vortex signature detected.",
  "Copy, proceeding to last known position.",
  "Requesting backup, subject is airborne.",
  "Scanner: situation contained, stand down.",
  "Dispatch: increase patrol near Veyron Park."
];

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.units = [];
    this.messages = [];
    this._decayTimer = 0;
    this._msgTimer = 0;
  }

  init() {
    this.messages = [];
    this._pushMessage('Scanner online. Monitoring Veyron City frequencies.');
  }

  onIncident() {
    this._pushMessage(`Crime detected — dispatching units. Wanted level: ${this.game.state.wanted}`);
    if (this.game.state.wanted > 0) this._spawnUnit();
  }

  _spawnUnit() {
    if (this.units.length >= 3) return;
    const player = this.game.player;
    const ang = Math.random() * Math.PI * 2;
    const x = player.pos.x + Math.cos(ang) * 20;
    const z = player.pos.z + Math.sin(ang) * 20;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x141c2a, emissive: 0x3e6fe6, emissiveIntensity: 0.6 })
    );
    mesh.position.set(x, 0.6, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.units.push({ mesh, state: 'chase' });
    this._pushMessage('Unit dispatched to intercept.');
  }

  _pushMessage(text) {
    const time = new Date();
    this.messages.unshift({ text, time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (this.messages.length > 20) this.messages.pop();
    this.game.phone.renderPoliceList(this.messages);
  }

  update(dt) {
    const player = this.game.player;
    const wanted = this.game.state.wanted;

    if (wanted > 0) {
      this._decayTimer -= dt;
      // wanted decreases when player has evaded units for a while (no units nearby)
      const nearUnit = this.units.some(u => u.mesh.position.distanceTo(player.pos) < 25);
      if (!nearUnit && this._decayTimer <= 0) {
        this.game.state.wanted = Math.max(0, wanted - 1);
        this._decayTimer = 12;
        if (this.game.state.wanted === 0) {
          this._pushMessage('Units stand down. Suspect evaded.');
          this.units.forEach(u => this.scene.remove(u.mesh));
          this.units = [];
        }
      }
    }

    for (const unit of this.units) {
      const dist = unit.mesh.position.distanceTo(player.pos);
      if (dist > 2.5) {
        const dir = new THREE.Vector3().subVectors(player.pos, unit.mesh.position).normalize();
        unit.mesh.position.addScaledVector(dir, 5 * dt);
        unit.mesh.lookAt(player.pos.x, unit.mesh.position.y, player.pos.z);
      } else {
        // combat: minor chip damage while cornered
        unit.cooldown = (unit.cooldown || 0) - dt;
        if (unit.cooldown <= 0) {
          player.takeDamage(4);
          unit.cooldown = 1.5;
        }
      }
    }

    this._msgTimer -= dt;
    if (this._msgTimer <= 0 && wanted > 0) {
      this._pushMessage(SCANNER_LINES[Math.floor(Math.random() * SCANNER_LINES.length)]);
      this._msgTimer = 10 + Math.random() * 10;
    }

    document.getElementById('status-wanted').textContent = wanted > 0 ? `${wanted} star${wanted > 1 ? 's' : ''}` : 'None';
  }
}
