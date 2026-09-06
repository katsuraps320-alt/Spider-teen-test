// ============================================================
// Mission System
// ============================================================
const MISSION_DEFS = [
  {
    id: 'first_vortex',
    title: 'First Vortex',
    dialogue: "Kairo: \"Time to test the threads. Get up high and swing.\"",
    objective: 'Perform a Vortex Attach and Swing',
    marker: { x: 20, z: 20, y: 20 },
    reward: { xp: 50, money: 30 },
    check: (game) => game._flags?.hasSwung
  },
  {
    id: 'trouble_central',
    title: 'Trouble in Central',
    dialogue: "Dispatch: \"We've got a disturbance downtown — check it out.\"",
    objective: 'Stop 1 crime in Central District',
    marker: { x: 0, z: 0, y: 0 },
    reward: { xp: 60, money: 50 },
    check: (game) => game._flags?.crimesResolved >= 1
  },
  {
    id: 'drone_attack',
    title: 'Drone Attack',
    dialogue: "Kairo: \"Training drones gone haywire near the grounds.\"",
    objective: 'Defeat 3 Training Drones',
    marker: { x: 45, z: 45, y: 0 },
    reward: { xp: 70, money: 60 },
    check: (game) => game._flags?.dronesDefeated >= 3
  },
  {
    id: 'rooftop_chase',
    title: 'Rooftop Chase',
    dialogue: "Kairo: \"Someone's fleeing across the rooftops — catch up using the threads.\"",
    objective: 'Reach the Central District rooftops (swing required)',
    marker: { x: -30, z: -30, y: 25 },
    reward: { xp: 80, money: 70 },
    check: (game, mission) => {
      const p = game.player;
      return p.pos.y > 15 && Math.hypot(p.pos.x - mission.marker.x, p.pos.z - mission.marker.z) < 15;
    }
  },
  {
    id: 'crime_wave',
    title: 'Crime Wave',
    dialogue: "Dispatch: \"Multiple incidents across the city — we need Teenerix everywhere at once.\"",
    objective: 'Stop 3 crimes total',
    marker: { x: 0, z: 0, y: 0 },
    reward: { xp: 120, money: 100 },
    check: (game) => game._flags?.crimesResolved >= 3
  }
];

export class MissionSystem {
  constructor(game) {
    this.game = game;
    game._flags = { hasSwung: false, crimesResolved: 0, dronesDefeated: 0 };
    this.queue = [...MISSION_DEFS];
    this.current = null;
    this._hookFlagTracking();
  }

  init() {
    this._advance();
  }

  _hookFlagTracking() {
    const game = this.game;
    // patch a couple of systems minimally to raise flags (non-invasive counters)
    const origRelease = game.player._releaseSwing.bind(game.player);
    game.player._releaseSwing = (landed) => { game._flags.hasSwung = true; return origRelease(landed); };

    const origResolve = game.crimes._resolveCrime.bind(game.crimes);
    game.crimes._resolveCrime = (crime) => { game._flags.crimesResolved++; return origResolve(crime); };

    const origDefeat = game.combat._defeatEnemy.bind(game.combat);
    game.combat._defeatEnemy = (enemy) => {
      if (enemy.type === 'drone') game._flags.dronesDefeated++;
      return origDefeat(enemy);
    };
  }

  _advance() {
    if (this.current && !this.game.state.completedMissions.includes(this.current.id)) return;
    const next = this.queue.find(m => !this.game.state.completedMissions.includes(m.id));
    if (!next) {
      this.current = null;
      document.getElementById('mission-banner').classList.add('hidden');
      return;
    }
    this.current = next;
    this.game.toast(next.dialogue);
    this._renderBanner();
  }

  _renderBanner() {
    const banner = document.getElementById('mission-banner');
    if (!this.current) { banner.classList.add('hidden'); return; }
    banner.classList.remove('hidden');
    document.getElementById('mission-banner-title').textContent = this.current.title.toUpperCase();
    document.getElementById('mission-banner-obj').textContent = this.current.objective;
  }

  update(dt) {
    if (!this.current) return;
    if (this.current.check(this.game, this.current)) {
      this._completeMission(this.current);
    }
  }

  _completeMission(mission) {
    this.game.state.completedMissions.push(mission.id);
    this.game.addXp(mission.reward.xp);
    this.game.addMoney(mission.reward.money);
    this.game.toast(`MISSION COMPLETE: ${mission.title} (+${mission.reward.xp} XP, +$${mission.reward.money})`);
    this.current = null;
    setTimeout(() => this._advance(), 1500);
  }

  getMarkers() {
    if (!this.current) return [];
    return [{ x: this.current.marker.x, z: this.current.marker.z }];
  }
}
