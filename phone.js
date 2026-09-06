// ============================================================
// Phone UI — HOME / CRIME / MAP / POLICE / MUSIC / NEWS
// ============================================================
const NEWS_HEADLINES = [
  "Vortex sightings spike near Central District towers",
  "City council debates late-night patrol budget",
  "Local shop owners praise drop in petty theft",
  "Weather service warns of fog rolling into Veyron tonight",
  "Anonymous hero seen swinging through downtown skyline",
  "Traffic congestion worsens near Veyron Park entrance"
];

export class PhoneUI {
  constructor(game) {
    this.game = game;
    this.open = false;
    this._wireTabs();
    this._wireClock();
    this.notifications = [];
    this._newsTimer = 0;
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    document.getElementById('phone-overlay').classList.toggle('hidden', !this.open);
    if (this.open) this.refreshAll();
  }

  _wireTabs() {
    document.querySelectorAll('.phone-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.phone-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.phone-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'map') this._drawMap();
      });
    });
  }

  _wireClock() {
    setInterval(() => {
      if (!this.open) return;
      const t = this.game.state.timeOfDay;
      const h = Math.floor(t) % 24;
      const m = Math.floor((t % 1) * 60);
      document.getElementById('phone-time').textContent =
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }, 1000);
  }

  refreshAll() {
    this._refreshHome();
    this.renderCrimeList(this.game.crimes.active, this.game.player.pos);
    this._drawMap();
    this._refreshNews();
  }

  _refreshHome() {
    document.getElementById('status-district').textContent =
      this.game.city.getDistrictName(this.game.player.pos.x, this.game.player.pos.z);
    document.getElementById('status-wanted').textContent =
      this.game.state.wanted > 0 ? `${this.game.state.wanted} stars` : 'None';

    const list = document.getElementById('notif-list');
    list.innerHTML = '';
    const notifs = [
      `Level ${this.game.state.level} · ${this.game.state.xp}/${this.game.state.xpToNext} XP`,
      `Reputation: ${this.game.state.reputation}`,
      `Active crimes nearby: ${this.game.crimes.active.length}`
    ];
    for (const n of notifs) {
      const el = document.createElement('div');
      el.className = 'notif-item';
      el.textContent = n;
      list.appendChild(el);
    }
  }

  renderCrimeList(crimes, playerPos) {
    const list = document.getElementById('crime-list');
    list.innerHTML = '';
    if (crimes.length === 0) {
      list.innerHTML = '<div class="notif-item">No active crimes. City is quiet.</div>';
      return;
    }
    for (const c of crimes) {
      const dist = Math.round(Math.hypot(c.x - playerPos.x, c.z - playerPos.z));
      const el = document.createElement('div');
      el.className = 'crime-item';
      const sevClass = c.severity === 'High' ? 'sev-high' : c.severity === 'Medium' ? 'sev-medium' : 'sev-low';
      el.innerHTML = `
        <div class="crime-head">🚨 ${c.type.toUpperCase()}</div>
        <div class="crime-meta">
          <span>${c.district}</span>
          <span>${dist} m</span>
          <span class="${sevClass}">${c.severity}</span>
        </div>
        <button class="track-btn" data-id="${c.id}">TRACK</button>
      `;
      list.appendChild(el);
    }
    list.querySelectorAll('.track-btn').forEach(btn => {
      btn.addEventListener('click', () => this.game.crimes.track(parseInt(btn.dataset.id)));
    });
  }

  renderPoliceList(messages) {
    const list = document.getElementById('police-list');
    list.innerHTML = '';
    for (const m of messages) {
      const el = document.createElement('div');
      el.className = 'police-item';
      el.textContent = `[${m.time}] ${m.text}`;
      list.appendChild(el);
    }
  }

  _drawMap() {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientWidth;
    this.game.city.drawMinimap(
      ctx,
      this.game.player.pos,
      this.game.player.heading,
      this.game.crimes.active,
      this.game.missions.getMarkers()
    );
  }

  _refreshNews() {
    const list = document.getElementById('news-list');
    if (list.children.length > 0) return; // populate once, occasionally add
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.className = 'news-item';
      const headline = NEWS_HEADLINES[Math.floor(Math.random() * NEWS_HEADLINES.length)];
      el.innerHTML = `<div class="news-head">${headline}</div><div class="news-time">Veyron News Network</div>`;
      list.appendChild(el);
    }
  }
}
