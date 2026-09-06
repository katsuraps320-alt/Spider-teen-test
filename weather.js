// ============================================================
// Weather System — clear, rain, heavy rain, fog with canvas particles
// ============================================================
export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('weather-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.drops = [];
    this._changeTimer = 20 + Math.random() * 30;
    this._initDrops(0);
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _initDrops(count) {
    this.drops = [];
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        len: 10 + Math.random() * 12,
        speed: 8 + Math.random() * 8
      });
    }
  }

  _setWeather(type) {
    this.game.state.weather = type;
    const counts = { clear: 0, rain: 120, 'heavy rain': 280, fog: 0 };
    this._initDrops(counts[type] || 0);
    document.getElementById('status-weather').textContent = type.charAt(0).toUpperCase() + type.slice(1);
    this.game.toast(`Weather: ${type}`);
  }

  update(dt) {
    this._changeTimer -= dt;
    if (this._changeTimer <= 0) {
      const options = ['clear', 'clear', 'rain', 'heavy rain', 'fog'];
      const next = options[Math.floor(Math.random() * options.length)];
      if (next !== this.game.state.weather) this._setWeather(next);
      this._changeTimer = 45 + Math.random() * 40;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.game.state.weather === 'rain' || this.game.state.weather === 'heavy rain') {
      ctx.strokeStyle = 'rgba(180,210,230,0.35)';
      ctx.lineWidth = 1;
      for (const d of this.drops) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2, d.y + d.len);
        ctx.stroke();
        d.y += d.speed;
        d.x -= 1.5;
        if (d.y > this.canvas.height) { d.y = -20; d.x = Math.random() * this.canvas.width; }
      }
    }

    if (this.game.state.weather === 'fog') {
      ctx.fillStyle = 'rgba(200,210,220,0.06)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
