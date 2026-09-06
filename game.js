// ============================================================
// SPIDER TEENERIX — Core Game Engine
// Original IP. Hero: Kairo Teenerix / "Teenerix". City: Veyron City.
// Power: Vortex Threads.
// ============================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { City } from './city.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { CombatSystem } from './combat.js';
import { CrimeSystem } from './crimes.js';
import { PhoneUI } from './phone.js';
import { MusicPlayer } from './music.js';
import { SaveSystem } from './save.js';
import { WeatherSystem } from './weather.js';
import { NpcSystem } from './npc.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';

export const GAME = {}; // global registry so modules can reach each other without circular imports

class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.canvas = document.getElementById('game-canvas');
    this.settings = {
      graphics: 'medium',
      musicVol: 0.7,
      sfxVol: 0.8,
      camSens: 0.5,
      ctrlSens: 0.5,
      showFps: false,
      vibration: true
    };

    this.state = {
      level: 1, xp: 0, xpToNext: 100,
      health: 100, maxHealth: 100,
      vortexEnergy: 100, maxVortexEnergy: 100,
      money: 250, reputation: 0,
      wanted: 0, // 0-5 stars
      completedMissions: [],
      unlockedAbilities: ['attach', 'swing', 'wallrun'],
      timeOfDay: 8.0, // hours, 24h clock
      weather: 'clear',
      district: 'Central District'
    };

    this.fpsAccum = 0; this.fpsFrames = 0; this.fpsLast = 0;

    this._initRenderer();
    this._initScene();

    GAME.THREE = THREE;
    GAME.scene = this.scene;
    GAME.camera = this.camera;
    GAME.renderer = this.renderer;
    GAME.state = this.state;
    GAME.settings = this.settings;
    GAME.game = this;

    this.city = new City(this);
    GAME.city = this.city;

    this.input = new InputManager(this);
    GAME.input = this.input;

    this.player = new Player(this);
    GAME.player = this.player;

    this.combat = new CombatSystem(this);
    GAME.combat = this.combat;

    this.npc = new NpcSystem(this);
    GAME.npc = this.npc;

    this.crimes = new CrimeSystem(this);
    GAME.crimes = this.crimes;

    this.police = new PoliceSystem(this);
    GAME.police = this.police;

    this.missions = new MissionSystem(this);
    GAME.missions = this.missions;

    this.weather = new WeatherSystem(this);
    GAME.weather = this.weather;

    this.music = new MusicPlayer(this);
    GAME.music = this.music;

    this.phone = new PhoneUI(this);
    GAME.phone = this.phone;

    this.save = new SaveSystem(this);
    GAME.save = this.save;

    this._wireMenus();
    this._wireHudButtons();
    window.addEventListener('resize', () => this._onResize());

    this.running = false;
    this._loop = this._loop.bind(this);

    this._bootSequence();
  }

  // ---------------- boot / menus ----------------
  async _bootSequence() {
    const fill = document.getElementById('loading-bar-fill');
    const tips = [
      'Tip: Swipe the right side of the screen to look around.',
      'Tip: Jump then tap VORTEX near a building to attach a thread.',
      'Tip: Hold BOOST while swinging to build extra speed.',
      'Tip: Open your phone to track nearby crimes.',
      'Tip: Load your own music from the phone\'s MUSIC tab.'
    ];
    document.getElementById('loading-tip').textContent = tips[Math.floor(Math.random() * tips.length)];
    for (let p = 0; p <= 100; p += 4) {
      fill.style.width = p + '%';
      await new Promise(r => setTimeout(r, 18));
    }
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
  }

  _wireMenus() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
      this.save.newGame();
      this._startGame();
    });
    document.getElementById('btn-continue').addEventListener('click', () => {
      const loaded = this.save.load();
      this._startGame();
      if (loaded) this.toast('Save loaded');
      else this.toast('No save found — starting new game');
    });
    document.getElementById('btn-settings-open').addEventListener('click', () => {
      this.openSettings();
    });
    document.getElementById('btn-settings-save').addEventListener('click', () => {
      this._applySettingsFromUI();
      document.getElementById('settings-overlay').classList.add('hidden');
      this.save.save();
    });
    document.getElementById('btn-settings-newgame').addEventListener('click', () => {
      if (confirm('Reset all progress and start a new game?')) {
        this.save.newGame();
        document.getElementById('settings-overlay').classList.add('hidden');
        if (!this.running) this._startGame();
        this.toast('New game started');
      }
    });
  }

  openSettings() {
    document.getElementById('settings-overlay').classList.remove('hidden');
    document.getElementById('set-graphics').value = this.settings.graphics;
    document.getElementById('set-music-vol').value = Math.round(this.settings.musicVol * 100);
    document.getElementById('set-sfx-vol').value = Math.round(this.settings.sfxVol * 100);
    document.getElementById('set-cam-sens').value = Math.round(this.settings.camSens * 100);
    document.getElementById('set-ctrl-sens').value = Math.round(this.settings.ctrlSens * 100);
    document.getElementById('set-show-fps').checked = this.settings.showFps;
    document.getElementById('set-vibration').checked = this.settings.vibration;
  }

  _applySettingsFromUI() {
    this.settings.graphics = document.getElementById('set-graphics').value;
    this.settings.musicVol = document.getElementById('set-music-vol').value / 100;
    this.settings.sfxVol = document.getElementById('set-sfx-vol').value / 100;
    this.settings.camSens = document.getElementById('set-cam-sens').value / 100;
    this.settings.ctrlSens = document.getElementById('set-ctrl-sens').value / 100;
    this.settings.showFps = document.getElementById('set-show-fps').checked;
    this.settings.vibration = document.getElementById('set-vibration').checked;
    document.getElementById('fps-counter').classList.toggle('hidden', !this.settings.showFps);
    this.music.setVolume(this.settings.musicVol);
    this._applyGraphicsQuality();
  }

  _applyGraphicsQuality() {
    const q = this.settings.graphics;
    const pr = q === 'low' ? Math.min(1, window.devicePixelRatio) : q === 'medium' ? Math.min(1.5, window.devicePixelRatio) : window.devicePixelRatio;
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.city.setDrawDistance(q === 'low' ? 90 : q === 'medium' ? 140 : 220);
  }

  _startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this._applyGraphicsQuality();
    this.player.spawn(this.state.spawnPos || { x: 0, y: 2, z: 0 });
    this.missions.init();
    this.crimes.init();
    this.police.init();
    this.npc.init();
    this.phone.refreshAll();
    if (!this.running) {
      this.running = true;
      this._loop();
    }
    this.toast('Welcome back to Veyron City');
    setInterval(() => this.save.save(), 30000); // autosave
  }

  _wireHudButtons() {
    document.getElementById('btn-phone').addEventListener('click', () => this.phone.toggle());
    document.getElementById('btn-phone-close').addEventListener('click', () => this.phone.toggle(false));
  }

  toast(msg) {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3000);
    if (navigator.vibrate && this.settings.vibration) { try { navigator.vibrate(15); } catch (e) {} }
  }

  addXp(amount) {
    this.state.xp += amount;
    while (this.state.xp >= this.state.xpToNext) {
      this.state.xp -= this.state.xpToNext;
      this.state.level++;
      this.state.xpToNext = Math.round(this.state.xpToNext * 1.35);
      this.state.maxHealth += 10;
      this.state.health = this.state.maxHealth;
      this.state.maxVortexEnergy += 5;
      this.toast(`LEVEL UP — now level ${this.state.level}`);
    }
    this._refreshHudTop();
  }

  addMoney(amount) { this.state.money += amount; this._refreshHudTop(); }
  addReputation(amount) { this.state.reputation += amount; }

  _refreshHudTop() {
    document.getElementById('hud-level-num').textContent = this.state.level;
    document.getElementById('hud-xp-fill').style.width = (100 * this.state.xp / this.state.xpToNext) + '%';
    document.getElementById('hud-money-num').textContent = this.state.money;
    document.getElementById('hud-hp-fill').style.width = Math.max(0, 100 * this.state.health / this.state.maxHealth) + '%';
    document.getElementById('hud-vtx-fill').style.width = Math.max(0, 100 * this.state.vortexEnergy / this.state.maxVortexEnergy) + '%';
    const starsEl = document.getElementById('wanted-stars');
    if (this.state.wanted > 0) {
      starsEl.classList.remove('hidden');
      starsEl.textContent = '★'.repeat(this.state.wanted);
    } else {
      starsEl.classList.add('hidden');
    }
  }

  // ---------------- renderer / scene ----------------
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0d12, 0.012);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 6, 12);

    this.hemiLight = new THREE.HemisphereLight(0x8fb8ff, 0x1a1410, 0.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff2d8, 1.1);
    this.sunLight.position.set(40, 60, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.sunLight.shadow.camera.far = 200;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------------- day/night ----------------
  _updateDayNight(dt) {
    this.state.timeOfDay += dt * 0.03; // full cycle ~ 20 minutes real time
    if (this.state.timeOfDay >= 24) this.state.timeOfDay -= 24;
    const t = this.state.timeOfDay;

    // sun angle
    const angle = (t / 24) * Math.PI * 2 - Math.PI / 2;
    const radius = 80;
    this.sunLight.position.set(Math.cos(angle) * radius, Math.max(5, Math.sin(angle) * radius), 30);
    this.sunLight.target.position.set(0, 0, 0);

    let skyTop, skyBottom, sunIntensity, hemiIntensity, fogColor, fogDensity, label;
    if (t >= 5 && t < 7) { // dawn
      const k = (t - 5) / 2;
      skyTop = lerpColor(0x0a0d18, 0x6a86b8, k); skyBottom = lerpColor(0x1a1420, 0xe8a878, k);
      sunIntensity = lerp(0.15, 0.9, k); hemiIntensity = lerp(0.25, 0.8, k); label = 'Dawn';
    } else if (t >= 7 && t < 17) { // day
      skyTop = 0x4a86d8; skyBottom = 0x9fc4e8; sunIntensity = 1.15; hemiIntensity = 0.9; label = 'Day';
    } else if (t >= 17 && t < 19.5) { // evening
      const k = (t - 17) / 2.5;
      skyTop = lerpColor(0x4a86d8, 0x1a1428, k); skyBottom = lerpColor(0x9fc4e8, 0xe8703e, k);
      sunIntensity = lerp(1.1, 0.2, k); hemiIntensity = lerp(0.9, 0.35, k); label = 'Evening';
    } else { // night
      skyTop = 0x05070d; skyBottom = 0x0d1120; sunIntensity = 0.08; hemiIntensity = 0.22; label = 'Night';
    }
    fogColor = skyBottom;
    fogDensity = (label === 'Night') ? 0.018 : 0.010;

    this.sunLight.intensity = sunIntensity;
    this.hemiLight.intensity = hemiIntensity;
    this.scene.fog.color.setHex(fogColor);
    this.scene.fog.density = fogDensity * (this.state.weather === 'fog' ? 3.2 : this.state.weather.includes('rain') ? 1.4 : 1);
    this.renderer.setClearColor(skyBottom);
    this.city.setWindowLitFraction(label === 'Night' || label === 'Evening' ? 0.65 : 0.05);

    this._dayLabel = label;
    document.getElementById('status-time').textContent = label;
  }

  // ---------------- main loop ----------------
  _loop() {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());

    this._updateDayNight(dt);
    this.weather.update(dt);
    this.input.update(dt);
    this.player.update(dt);
    this.npc.update(dt);
    this.combat.update(dt);
    this.crimes.update(dt);
    this.police.update(dt);
    this.missions.update(dt);
    this.city.update(dt);

    this._refreshHudTop();
    this.renderer.render(this.scene, this.camera);

    if (this.settings.showFps) {
      this.fpsFrames++; this.fpsAccum += dt;
      if (this.fpsAccum >= 0.5) {
        document.getElementById('fps-counter').textContent = 'FPS: ' + Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsFrames = 0; this.fpsAccum = 0;
      }
    }
  }
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
