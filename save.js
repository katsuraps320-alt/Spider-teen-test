// ============================================================
// Save System — browser localStorage
// ============================================================
const SAVE_KEY = 'spider_teenerix_save_v1';

export class SaveSystem {
  constructor(game) {
    this.game = game;
  }

  save() {
    const g = this.game;
    const data = {
      version: 1,
      savedAt: Date.now(),
      state: {
        level: g.state.level, xp: g.state.xp, xpToNext: g.state.xpToNext,
        health: g.state.health, maxHealth: g.state.maxHealth,
        vortexEnergy: g.state.vortexEnergy, maxVortexEnergy: g.state.maxVortexEnergy,
        money: g.state.money, reputation: g.state.reputation, wanted: 0, // don't persist wanted across sessions
        completedMissions: g.state.completedMissions,
        unlockedAbilities: g.state.unlockedAbilities,
        timeOfDay: g.state.timeOfDay,
        spawnPos: { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z }
      },
      settings: g.settings,
      music: g.music ? { volume: g.music.audio.volume } : null
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  }

  load() {
    let raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      Object.assign(this.game.state, data.state);
      Object.assign(this.game.settings, data.settings || {});
      if (data.music && this.game.music) this.game.music.setVolume(data.music.volume);
      this.game._applyGraphicsQuality?.();
      return true;
    } catch (e) {
      console.warn('Load failed', e);
      return false;
    }
  }

  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    const g = this.game;
    Object.assign(g.state, {
      level: 1, xp: 0, xpToNext: 100,
      health: 100, maxHealth: 100,
      vortexEnergy: 100, maxVortexEnergy: 100,
      money: 250, reputation: 0, wanted: 0,
      completedMissions: [],
      unlockedAbilities: ['attach', 'swing', 'wallrun'],
      timeOfDay: 8.0,
      spawnPos: { x: 0, y: 2, z: 0 }
    });
  }
}
