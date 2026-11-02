// UI, input and audio for Blocky Buccaneers.
window.PG = window.PG || {};
(function () {
  const FONT = '"Trebuchet MS", sans-serif';
  const OUT = '#1b1b1b';

  // ---------------------------------------------------------------- helpers
  function viewSize() {
    const g = PG.game;
    if (g && g.viewW) return { w: g.viewW, h: g.viewH };
    return { w: window.innerWidth || 800, h: window.innerHeight || 600 };
  }

  // Shared touch-control layout (used by both input hit-testing and drawing).
  function touchLayout(w, h) {
    const r = Math.max(30, Math.min(46, w * 0.09));
    const pad = 18;
    const fireR = { x: w - pad - r, y: h - pad - r, r: r, label: 'FIRE R' };
    const fireL = { x: fireR.x - r * 2 - 16, y: h - pad - r - r * 0.9, r: r, label: 'FIRE L' };
    return { fireL: fireL, fireR: fireR };
  }

  function block(ctx, x, y, w, h, fill, opts) {
    opts = opts || {};
    ctx.fillStyle = opts.shadow || 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (opts.top) { // lighter top face
      ctx.fillStyle = opts.top;
      ctx.fillRect(x, y, w, Math.max(3, h * 0.22));
    }
    ctx.lineWidth = opts.lw || 3;
    ctx.strokeStyle = OUT;
    ctx.strokeRect(x, y, w, h);
  }

  function text(ctx, str, x, y, size, color, align, base) {
    ctx.font = 'bold ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = base || 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = OUT;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(str, x, y);
  }

  function fitSize(ctx, str, size, maxW) {
    ctx.font = 'bold ' + size + 'px ' + FONT;
    const w = ctx.measureText(str).width;
    return w > maxW ? Math.max(10, Math.floor(size * maxW / w)) : size;
  }

  function coinIcon(ctx, x, y, s, t) {
    const sq = Math.abs(Math.cos(t * 3)) * 0.7 + 0.3;
    const w = s * sq;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(x - w / 2, y - s / 2, w, s);
    ctx.fillStyle = '#fff3a0';
    ctx.fillRect(x - w / 2, y - s / 2, w, s * 0.25);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUT;
    ctx.strokeRect(x - w / 2, y - s / 2, w, s);
  }

  function dimScreen(ctx, w, h, a) {
    ctx.fillStyle = 'rgba(5,20,35,' + a + ')';
    ctx.fillRect(0, 0, w, h);
  }

  // ---------------------------------------------------------------- Input
  const Input = {
    state: { up: false, down: false, left: false, right: false, fireLeft: false, fireRight: false },
    touchActive: false,
    joy: null,        // {id, bx, by, x, y}
    fireTouches: {},  // touch id -> 'L' | 'R'
    _click: false,
    _keys: {},

    init(canvas) {
      const self = this;
      const keyMap = {
        KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
        KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
        KeyQ: 'fireLeft', KeyE: 'fireRight',
      };
      function codeOf(e) {
        if (e.code) return e.code;
        const k = (e.key || '').toLowerCase();
        const alt = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', q: 'KeyQ', e: 'KeyE', m: 'KeyM', ' ': 'Space', enter: 'Enter' };
        return alt[k] || e.key;
      }
      window.addEventListener('keydown', function (e) {
        const c = codeOf(e);
        if (c === 'Space' || c.indexOf('Arrow') === 0) e.preventDefault();
        if (c === 'KeyM' && !e.repeat) { PG.Audio.init(); PG.Audio.muted = !PG.Audio.muted; return; }
        if ((c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { self._click = true; PG.Audio.init(); }
        self._keys[c] = true;
        self._recompute();
      });
      window.addEventListener('keyup', function (e) {
        self._keys[codeOf(e)] = false;
        self._recompute();
      });
      window.addEventListener('blur', function () { self._keys = {}; self._recompute(); });
      this._keyMap = keyMap;

      const target = canvas || window;
      target.addEventListener('mousedown', function (e) {
        if (Date.now() - (self._lastTouch || 0) < 800) return; // ignore emulated mouse
        self._click = true; PG.Audio.init();
      });

      function pos(t) {
        const r = canvas && canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      }
      function hitButton(p) {
        const v = viewSize(), L = touchLayout(v.w, v.h);
        const inC = function (b) { const dx = p.x - b.x, dy = p.y - b.y; return dx * dx + dy * dy <= (b.r * 1.25) * (b.r * 1.25); };
        if (inC(L.fireL)) return 'L';
        if (inC(L.fireR)) return 'R';
        return null;
      }
      target.addEventListener('touchstart', function (e) {
        e.preventDefault();
        self.touchActive = true;
        self._lastTouch = Date.now();
        self._click = true;
        PG.Audio.init();
        const v = viewSize();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i], p = pos(t);
          const b = hitButton(p);
          if (b) self.fireTouches[t.identifier] = b;
          else if (p.x < v.w / 2 && !self.joy) self.joy = { id: t.identifier, bx: p.x, by: p.y, x: p.x, y: p.y };
        }
        self._recompute();
      }, { passive: false });
      target.addEventListener('touchmove', function (e) {
        e.preventDefault();
        self._lastTouch = Date.now();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (self.joy && t.identifier === self.joy.id) {
            const p = pos(t);
            self.joy.x = p.x; self.joy.y = p.y;
          }
        }
        self._recompute();
      }, { passive: false });
      function end(e) {
        e.preventDefault();
        self._lastTouch = Date.now();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const id = e.changedTouches[i].identifier;
          if (self.joy && self.joy.id === id) self.joy = null;
          delete self.fireTouches[id];
        }
        self._recompute();
      }
      target.addEventListener('touchend', end, { passive: false });
      target.addEventListener('touchcancel', end, { passive: false });
    },

    _recompute() {
      const s = this.state, k = this._keys || {}, m = this._keyMap || {};
      s.up = s.down = s.left = s.right = s.fireLeft = s.fireRight = false;
      for (const code in k) if (k[code] && m[code]) s[m[code]] = true;
      if (k.Space) { s.fireLeft = true; s.fireRight = true; }
      if (this.joy) {
        const dx = this.joy.x - this.joy.bx, dy = this.joy.y - this.joy.by, dz = 14;
        if (dy < -dz) s.up = true;
        if (dy > dz) s.down = true;
        if (dx < -dz) s.left = true;
        if (dx > dz) s.right = true;
      }
      for (const id in this.fireTouches) {
        if (this.fireTouches[id] === 'L') s.fireLeft = true;
        else s.fireRight = true;
      }
    },

    consumeClick() {
      const c = this._click;
      this._click = false;
      // Short grace period after sinking so frantic FIRE taps don't skip the game-over screen.
      if (c && PG.game && PG.game.state === 'over' && overSince != null && PG.game.t - overSince < 0.8) return false;
      return c;
    },
  };

  // ---------------------------------------------------------------- Audio
  const Audio = {
    muted: false,
    ctx: null,
    _master: null,
    _noise: null,

    init() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this._master = this.ctx.createGain();
          this._master.gain.value = 0.5;
          this._master.connect(this.ctx.destination);
          const len = Math.floor(this.ctx.sampleRate * 1.0);
          const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          this._noise = buf;
        }
        if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
      } catch (e) { this.ctx = null; }
    },

    _tone(type, f0, f1, start, dur, vol) {
      const c = this.ctx, t = c.currentTime + start;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this._master);
      o.start(t); o.stop(t + dur + 0.05);
    },

    _noiseBurst(start, dur, vol, filt, freq) {
      const c = this.ctx, t = c.currentTime + start;
      const src = c.createBufferSource();
      src.buffer = this._noise;
      const f = c.createBiquadFilter();
      f.type = filt || 'lowpass';
      f.frequency.setValueAtTime(freq || 1200, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, (freq || 1200) * 0.15), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this._master);
      src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
    },

    play(name) {
      if (this.muted || !this.ctx || !this._master) return;
      try {
        switch (name) {
          case 'fire':
            this._noiseBurst(0, 0.45, 0.7, 'lowpass', 1800);
            this._tone('sine', 120, 40, 0, 0.4, 0.6);
            break;
          case 'coin':
            this._tone('square', 988, 988, 0, 0.08, 0.15);
            this._tone('square', 1319, 1319, 0.07, 0.18, 0.15);
            break;
          case 'treasure':
            [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone('triangle', f, f, i * 0.08, 0.25, 0.25));
            this._tone('square', 1568, 1568, 0.42, 0.35, 0.1);
            break;
          case 'hit':
            this._noiseBurst(0, 0.18, 0.5, 'bandpass', 900);
            this._tone('square', 220, 90, 0, 0.15, 0.2);
            break;
          case 'hurt':
            this._tone('sawtooth', 160, 60, 0, 0.28, 0.3);
            this._noiseBurst(0, 0.22, 0.45, 'lowpass', 700);
            break;
          case 'sink':
            this._tone('square', 440, 70, 0, 0.9, 0.18);
            this._tone('triangle', 330, 50, 0.1, 1.0, 0.2);
            this._noiseBurst(0, 0.9, 0.35, 'lowpass', 1500);
            break;
          case 'wave':
            this._tone('sawtooth', 220, 220, 0, 0.35, 0.14);
            this._tone('sawtooth', 220, 330, 0.35, 0.6, 0.14);
            this._tone('sawtooth', 110, 165, 0, 0.95, 0.1);
            break;
          case 'gameover':
            [392, 370, 349, 262].forEach((f, i) => this._tone('triangle', f, i === 3 ? 196 : f, i * 0.32, i === 3 ? 0.9 : 0.3, 0.28));
            break;
          case 'click':
            this._tone('square', 660, 880, 0, 0.06, 0.12);
            break;
          default:
            this._tone('square', 440, 440, 0, 0.05, 0.08);
        }
      } catch (e) { /* never let audio break the game */ }
    },
  };

  // ---------------------------------------------------------------- UI
  let overSince = null;

  function drawBar(ctx, x, y, w, h, frac, color, light) {
    block(ctx, x, y, w, h, '#3a1e1e');
    const fw = Math.max(0, Math.min(1, frac)) * (w - 6);
    if (fw > 0) {
      ctx.fillStyle = color;
      ctx.fillRect(x + 3, y + 3, fw, h - 6);
      ctx.fillStyle = light;
      ctx.fillRect(x + 3, y + 3, fw, Math.max(2, (h - 6) * 0.35));
    }
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.strokeRect(x, y, w, h);
  }

  function drawTouch(ctx, game) {
    const w = game.viewW, h = game.viewH, L = touchLayout(w, h), I = Input;
    // Joystick
    const j = I.joy;
    const bx = j ? j.bx : Math.max(80, w * 0.16), by = j ? j.by : h - 100;
    const R = 52;
    ctx.globalAlpha = j ? 0.75 : 0.4;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx - R, by - R, R * 2, R * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.strokeRect(bx - R, by - R, R * 2, R * 2);
    let kx = bx, ky = by;
    if (j) {
      const dx = j.x - j.bx, dy = j.y - j.by, d = Math.hypot(dx, dy) || 1, m = Math.min(d, R);
      kx = bx + dx / d * m; ky = by + dy / d * m;
    }
    block(ctx, kx - 22, ky - 22, 44, 44, '#4fa3ff', { top: '#8cc6ff' });
    ctx.globalAlpha = 1;
    // Fire buttons
    [['L', L.fireL, '#ff5a3c', '#ff9a80', Input.state.fireLeft], ['R', L.fireR, '#ff8c1a', '#ffc070', Input.state.fireRight]].forEach(function (b) {
      const c = b[1], pressed = b[4];
      ctx.globalAlpha = pressed ? 0.95 : 0.7;
      ctx.beginPath(); ctx.arc(c.x + 4, c.y + 4, c.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(c.x, c.y + (pressed ? 3 : 0), c.r, 0, Math.PI * 2);
      ctx.fillStyle = pressed ? b[3] : b[2]; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.globalAlpha = 1;
      text(ctx, c.label, c.x, c.y + (pressed ? 3 : 0), Math.round(c.r * 0.38), '#fff', 'center');
    });
  }

  const UI = {
    drawHUD(ctx, game) {
      const p = game.player; if (!p) return;
      const w = game.viewW, h = game.viewH, t = game.t;
      overSince = null;
      const small = w < 520;
      const mm = small ? Math.min(110, Math.floor(w * 0.28)) : 150;
      const pad = 10;
      const panelW = Math.min(240, w - mm - pad * 3);
      const fs = small ? 14 : 17;
      const rowH = small ? 20 : 24;

      // Panel
      const panelH = 26 + rowH * 3 + 30;
      block(ctx, pad, pad, panelW, panelH, '#2e7dd1', { top: '#4f9bea' });

      // HP
      const hpFrac = p.hp / p.maxHp;
      const hpCol = hpFrac > 0.5 ? '#3fd64a' : hpFrac > 0.25 ? '#ffc61a' : '#ff3b3b';
      drawBar(ctx, pad + 8, pad + 8, panelW - 16, 20, hpFrac, hpCol, 'rgba(255,255,255,0.45)');
      text(ctx, 'HP ' + Math.max(0, Math.ceil(p.hp)), pad + 8 + (panelW - 16) / 2, pad + 18, 13, '#fff', 'center');

      // Gold / score / wave
      let y = pad + 26 + 4 + rowH / 2;
      coinIcon(ctx, pad + 18, y, 14, t);
      text(ctx, String(game.gold), pad + 32, y, fs, '#ffd23f');
      y += rowH;
      text(ctx, 'SCORE ' + game.score, pad + 10, y, fs, '#fff');
      y += rowH;
      text(ctx, 'WAVE ' + game.wave, pad + 10, y, fs, '#9ef0ff');

      // Reload indicators
      y += rowH / 2 + 6;
      const half = (panelW - 16 - 6) / 2;
      const rl = 1 - Math.min(1, Math.max(0, (p.reloadL || 0) / 1.2));
      const rr = 1 - Math.min(1, Math.max(0, (p.reloadR || 0) / 1.2));
      drawBar(ctx, pad + 8, y, half, 16, rl, rl >= 1 ? '#ff8c1a' : '#9a9a9a', 'rgba(255,255,255,0.4)');
      drawBar(ctx, pad + 8 + half + 6, y, half, 16, rr, rr >= 1 ? '#ff8c1a' : '#9a9a9a', 'rgba(255,255,255,0.4)');
      text(ctx, rl >= 1 ? 'L READY' : 'L', pad + 8 + half / 2, y + 8, 11, '#fff', 'center');
      text(ctx, rr >= 1 ? 'R READY' : 'R', pad + 8 + half * 1.5 + 6, y + 8, 11, '#fff', 'center');

      // Minimap
      const mx = w - mm - pad, my = pad;
      if (PG.World && PG.World.drawMinimap) {
        try { PG.World.drawMinimap(ctx, game, mx, my, mm); } catch (e) {}
      }

      // Mute indicator (under minimap)
      const mY = my + mm + 8;
      block(ctx, w - pad - 64, mY, 64, 24, Audio.muted ? '#c43c3c' : '#3a9b4a', { top: Audio.muted ? '#e06464' : '#5cc46c', lw: 2.5 });
      text(ctx, Audio.muted ? 'MUTED' : 'SOUND', w - pad - 32, mY + 12, 11, '#fff', 'center');
      if (!Input.touchActive && !small) text(ctx, 'M', w - pad - 74, mY + 12, 11, '#ddd', 'right');

      if (Input.touchActive) drawTouch(ctx, game);
    },

    drawMenu(ctx, game) {
      const w = game.viewW, h = game.viewH, t = game.t;
      overSince = null;
      dimScreen(ctx, w, h, 0.35);
      const cx = w / 2;
      const small = w < 520;

      // Title
      const ts = fitSize(ctx, 'BLOCKY BUCCANEERS', small ? 34 : 60, w - 32);
      const ty = Math.max(50, h * 0.14);
      text(ctx, 'BLOCKY', cx, ty - ts * 0.55 + Math.sin(t * 2) * 3, ts * 1.1, '#ffd23f', 'center');
      text(ctx, 'BUCCANEERS', cx, ty + ts * 0.6 + Math.sin(t * 2 + 1) * 3, ts * 1.1, '#ff5a3c', 'center');

      // Bobbing ship
      const sy = ty + ts * 1.6 + 50 + Math.sin(t * 2.2) * 6;
      drawMenuShip(ctx, cx, sy, small ? 0.8 : 1, Math.sin(t * 1.7) * 0.06);

      // Controls panel
      const pw = Math.min(380, w - 32);
      const lines = Input.touchActive
        ? ['LEFT STICK  -  steer & sail', 'FIRE L / FIRE R  -  broadsides', 'Collect gold & treasure!']
        : ['W A S D / ARROWS  -  sail', 'Q / E  -  fire left / right', 'SPACE  -  fire both sides', 'M  -  mute sound'];
      const lh = small ? 22 : 26;
      const ph = 20 + lines.length * lh;
      const py = sy + 60;
      block(ctx, cx - pw / 2, py, pw, ph, '#2e7dd1', { top: '#4f9bea' });
      lines.forEach(function (l, i) {
        const s = fitSize(ctx, l, small ? 15 : 18, pw - 24);
        text(ctx, l, cx, py + 10 + lh / 2 + i * lh, s, '#fff', 'center');
      });

      // Prompt button
      const prompt = 'Click / Tap / Enter to set sail';
      const bs = fitSize(ctx, prompt, small ? 17 : 22, pw - 30);
      const by = py + ph + 22;
      const pulse = 1 + Math.sin(t * 5) * 0.04;
      const bw = pw * pulse, bh = bs + 24;
      block(ctx, cx - bw / 2, by, bw, bh, '#3fd64a', { top: '#7cf084' });
      text(ctx, prompt, cx, by + bh / 2, bs, '#fff', 'center');

      if (game.best > 0) text(ctx, 'BEST: ' + game.best, cx, by + bh + 24, small ? 16 : 20, '#ffd23f', 'center');
      drawMuteCorner(ctx, w, h);
    },

    drawGameOver(ctx, game) {
      const w = game.viewW, h = game.viewH, t = game.t;
      if (overSince == null) overSince = t;
      const k = Math.min(1, (t - overSince) / 0.4);
      dimScreen(ctx, w, h, 0.55 * k);
      const cx = w / 2, small = w < 520;
      const title = 'YOUR SHIP SANK!';
      const ts = fitSize(ctx, title, small ? 36 : 58, w - 32);
      const ty = Math.max(60, h * 0.2) - (1 - k) * 40;
      text(ctx, title, cx, ty + Math.sin(t * 2) * 3, ts, '#ff3b3b', 'center');

      const pw = Math.min(340, w - 32);
      const rows = [
        ['SCORE', game.score, '#fff'],
        ['GOLD', game.gold, '#ffd23f'],
        ['WAVE', game.wave, '#9ef0ff'],
        ['BEST', game.best, '#ff8c1a'],
      ];
      const lh = small ? 30 : 36, fs = small ? 18 : 22;
      const ph = 20 + rows.length * lh;
      const py = ty + ts * 0.8 + 20;
      block(ctx, cx - pw / 2, py, pw, ph, '#6b4226', { top: '#8d5a36' });
      rows.forEach(function (r, i) {
        const yy = py + 10 + lh / 2 + i * lh;
        text(ctx, r[0], cx - pw / 2 + 20, yy, fs, '#fff', 'left');
        text(ctx, String(r[1]), cx + pw / 2 - 20, yy, fs, r[2], 'right');
      });
      if (game.score > 0 && game.score >= game.best) {
        text(ctx, 'NEW BEST!', cx, py + ph + 22 + Math.sin(t * 6) * 2, small ? 18 : 22, '#ffd23f', 'center');
      }

      const prompt = 'Click to sail again';
      const bs = small ? 18 : 22;
      const bw = pw * (1 + Math.sin(t * 5) * 0.04), bh = bs + 24;
      const by = py + ph + 46;
      ctx.globalAlpha = (t - overSince) > 0.8 ? 1 : 0.5;
      block(ctx, cx - bw / 2, by, bw, bh, '#3fd64a', { top: '#7cf084' });
      text(ctx, prompt, cx, by + bh / 2, bs, '#fff', 'center');
      ctx.globalAlpha = 1;
      drawMuteCorner(ctx, w, h);
    },

    drawBanner(ctx, game, str, alpha) {
      const w = game.viewW, h = game.viewH;
      const a = Math.max(0, Math.min(1, alpha == null ? 1 : alpha));
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      const s = fitSize(ctx, str, w < 520 ? 44 : 72, w - 48);
      const y = h * 0.32;
      const scale = 1 + (1 - a) * 0.3;
      ctx.translate(w / 2, y); ctx.scale(scale, scale);
      ctx.font = 'bold ' + s + 'px ' + FONT;
      const tw = ctx.measureText(str).width;
      block(ctx, -tw / 2 - 24, -s * 0.7, tw + 48, s * 1.4, '#ff8c1a', { top: '#ffb459' });
      text(ctx, str, 0, 2, s, '#fff', 'center');
      ctx.restore();
    },
  };

  function drawMuteCorner(ctx, w, h) {
    if (!Audio.muted) return;
    block(ctx, w - 80, h - 36, 70, 24, '#c43c3c', { top: '#e06464', lw: 2.5 });
    text(ctx, 'MUTED', w - 45, h - 24, 11, '#fff', 'center');
  }

  function drawMenuShip(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    // mast
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-4, -78, 8, 70); ctx.strokeRect(-4, -78, 8, 70);
    // sail
    ctx.fillStyle = '#4fa3ff'; ctx.fillRect(-34, -72, 68, 44); ctx.strokeRect(-34, -72, 68, 44);
    ctx.fillStyle = '#8cc6ff'; ctx.fillRect(-34, -72, 68, 10);
    ctx.strokeRect(-34, -72, 68, 44);
    // flag
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(4, -92, 22, 12); ctx.strokeRect(4, -92, 22, 12);
    // hull
    ctx.fillStyle = '#8d5a36'; ctx.fillRect(-70, -12, 140, 28); ctx.strokeRect(-70, -12, 140, 28);
    ctx.fillStyle = '#b07848'; ctx.fillRect(-70, -12, 140, 7);
    ctx.fillStyle = '#6b4226'; ctx.fillRect(-58, 16, 116, 12); ctx.strokeRect(-58, 16, 116, 12);
    ctx.strokeRect(-70, -12, 140, 28);
    // portholes
    ctx.fillStyle = '#1b1b1b';
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * 24 - 5, 0, 10, 8);
    ctx.restore();
    // water strip
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 28 - 10, y + 26 * s, 20, 5);
  }

  PG.Input = Input;
  PG.UI = UI;
  PG.Audio = Audio;
})();
