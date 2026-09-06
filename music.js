// ============================================================
// Personal Music Player — local files only, never uploaded anywhere
// ============================================================
export class MusicPlayer {
  constructor(game) {
    this.game = game;
    this.audio = new Audio();
    this.audio.volume = game.settings.musicVol;
    this.queue = []; // { name, url, file }
    this.currentIndex = -1;

    this._wireFilePicker();
    this._wireControls();
    this._wireAudioEvents();
  }

  setVolume(v) {
    this.audio.volume = v;
    document.getElementById('player-volume').value = Math.round(v * 100);
  }

  _wireFilePicker() {
    const btn = document.getElementById('btn-pick-music');
    const input = document.getElementById('music-file-input');
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        const url = URL.createObjectURL(file); // local blob URL, never leaves the device
        this.queue.push({ name: file.name, url, file });
      }
      this._renderQueue();
      if (this.currentIndex === -1 && this.queue.length > 0) {
        this._loadTrack(0);
      }
      this.game.toast(`${files.length} track(s) added`);
    });
  }

  _renderQueue() {
    const list = document.getElementById('music-queue');
    list.innerHTML = '';
    this.queue.forEach((track, i) => {
      const el = document.createElement('div');
      el.className = 'queue-item' + (i === this.currentIndex ? ' playing' : '');
      el.innerHTML = `<span>${track.name}</span><span>${i === this.currentIndex && !this.audio.paused ? '▶' : ''}</span>`;
      el.addEventListener('click', () => this._loadTrack(i, true));
      list.appendChild(el);
    });
  }

  _loadTrack(index, autoplay = false) {
    if (index < 0 || index >= this.queue.length) return;
    this.currentIndex = index;
    const track = this.queue[index];
    this.audio.src = track.url;
    document.getElementById('player-track-name').textContent = track.name;
    document.getElementById('mini-player-title').textContent = track.name;
    document.getElementById('mini-player').classList.remove('hidden');
    if (autoplay) this.play();
    this._renderQueue();
  }

  play() {
    if (this.currentIndex === -1) return;
    this.audio.play().catch(() => {});
    document.getElementById('btn-playpause').textContent = '⏸';
    this._renderQueue();
  }
  pause() {
    this.audio.pause();
    document.getElementById('btn-playpause').textContent = '▶';
    this._renderQueue();
  }
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    document.getElementById('btn-playpause').textContent = '▶';
    this._renderQueue();
  }
  next() {
    if (this.queue.length === 0) return;
    const nextIndex = (this.currentIndex + 1) % this.queue.length;
    this._loadTrack(nextIndex, true);
  }
  prev() {
    if (this.queue.length === 0) return;
    const prevIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    this._loadTrack(prevIndex, true);
  }
  rewind10() {
    this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
  }

  _wireControls() {
    document.getElementById('btn-playpause').addEventListener('click', () => {
      if (this.audio.paused) this.play(); else this.pause();
    });
    document.getElementById('btn-stop').addEventListener('click', () => this.stop());
    document.getElementById('btn-next').addEventListener('click', () => this.next());
    document.getElementById('btn-prev').addEventListener('click', () => this.prev());
    document.getElementById('btn-rewind').addEventListener('click', () => this.rewind10());

    const seek = document.getElementById('player-seek');
    seek.addEventListener('input', () => {
      if (this.audio.duration) this.audio.currentTime = (seek.value / 100) * this.audio.duration;
    });

    const vol = document.getElementById('player-volume');
    vol.addEventListener('input', () => {
      this.audio.volume = vol.value / 100;
      this.game.settings.musicVol = vol.value / 100;
    });
  }

  _wireAudioEvents() {
    this.audio.addEventListener('timeupdate', () => {
      const cur = this.audio.currentTime, dur = this.audio.duration || 0;
      document.getElementById('player-current-time').textContent = this._fmt(cur);
      document.getElementById('player-duration').textContent = this._fmt(dur);
      if (dur > 0) document.getElementById('player-seek').value = (cur / dur) * 100;
    });
    this.audio.addEventListener('ended', () => this.next());
    // Playback is never paused by game-state changes (jumping/swinging/fighting/phone) —
    // no code anywhere calls pause() except explicit user action here.
  }

  _fmt(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getSaveState() {
    return { volume: this.audio.volume, trackNames: this.queue.map(t => t.name) };
  }
}
