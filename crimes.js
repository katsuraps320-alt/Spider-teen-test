// ============================================================
// Crime System — random crimes around Veyron City with scanner + tracking
// ============================================================
const CRIME_DEFS = [
  { type: 'Robbery', severity: 'Medium', xp: 30, money: 40 },
  { type: 'Assault', severity: 'Low', xp: 20, money: 20 },
  { type: 'Vehicle Theft', severity: 'Medium', xp: 25, money: 30 },
  { type: 'Gang Fight', severity: 'High', xp: 45, money: 50 },
  { type: 'Hostage Situation', severity: 'High', xp: 60, money: 70 },
  { type: 'Vortex Disturbance', severity: 'High', xp: 55, money: 60 }
];

export class CrimeSystem {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.trackedId = null;
    this._spawnTimer = 0;
    this._idCounter = 1;
  }

  init() {
    for (let i = 0; i < 3; i++) this._spawnCrime();
    this.refreshUI();
  }

  _spawnCrime() {
    const def = CRIME_DEFS[Math.floor(Math.random() * CRIME_DEFS.length)];
    const x = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    const crime = {
      id: this._idCounter++,
      ...def,
      x, z,
      district: this.game.city.getDistrictName(x, z),
      resolved: false
    };
    this.active.push(crime);
    this.game.toast(`🚨 ${crime.type} reported in ${crime.district}`);
    return crime;
  }

  track(id) {
    this.trackedId = id;
    const crime = this.active.find(c => c.id === id);
    if (crime) {
      this.game.toast(`Tracking ${crime.type} — head to ${crime.district}`);
      this.game.phone.toggle(false);
    }
  }

  update(dt) {
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0 && this.active.length < 5) {
      this._spawnCrime();
      this._spawnTimer = 25 + Math.random() * 25;
      this.refreshUI();
    }

    const player = this.game.player;
    for (const crime of this.active) {
      if (crime.resolved) continue;
      const dist = Math.hypot(player.pos.x - crime.x, player.pos.z - crime.z);
      if (dist < 6) {
        this._resolveCrime(crime);
      }
    }
    // periodically refresh distances shown in UI
    this._uiTimer = (this._uiTimer || 0) - dt;
    if (this._uiTimer <= 0) { this.refreshUI(); this._uiTimer = 1.5; }
  }

  _resolveCrime(crime) {
    crime.resolved = true;
    this.active = this.active.filter(c => c.id !== crime.id);
    this.game.addXp(crime.xp);
    this.game.addMoney(crime.money);
    this.game.addReputation(5);
    this.game.toast(`${crime.type} stopped! +${crime.xp} XP, +$${crime.money}`);
    if (crime.severity === 'High') {
      this.game.state.wanted = Math.min(5, this.game.state.wanted + 1);
      this.game.police.onIncident();
    }
    this.refreshUI();
  }

  refreshUI() {
    this.game.phone.renderCrimeList(this.active, this.game.player.pos);
  }
}
