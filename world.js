// World: ocean, islands, coins, chests, collision, minimap.
window.PG = window.PG || {};
(function () {
  const W = 3000, H = 3000;
  const CX = 1500, CY = 1500, CLEAR_R = 300;
  const CELL = 20;            // island grid snap
  const TILE = 64;            // water tile size
  const OUTLINE = '#1b1b1b';
  const COIN_TARGET = 60, CHEST_COUNT = 5;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function hash(i, j) {
    let h = (i * 374761393 + j * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // ---------- Islands ----------
  function makeIsland(x, y, r) {
    // Bumpy outline radius per angle, always within [0.9r, r]
    const k1 = rand(0, 6.28), k2 = rand(0, 6.28);
    const shapeR = (a) => r * (0.95 + 0.03 * Math.sin(a * 3 + k1) + 0.02 * Math.sin(a * 5 + k2));
    const n = Math.ceil((r + 40) / CELL);
    const shallow = [], sand = [], grass = [];
    for (let j = -n; j <= n; j++) {
      for (let i = -n; i <= n; i++) {
        const px = i * CELL, py = j * CELL;
        const d = Math.hypot(px, py), a = Math.atan2(py, px), sr = shapeR(a);
        if (d < sr + 30) shallow.push([i, j]);
        if (d < sr) sand.push([i, j]);
        if (d < sr - 34) grass.push([i, j]);
      }
    }
    const palms = [];
    const nPalms = r > 140 ? 3 : r > 100 ? 2 : 1;
    const pool = grass.length ? grass : sand;
    for (let p = 0; p < nPalms && pool.length; p++) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      palms.push({ x: c[0] * CELL, y: c[1] * CELL, s: rand(0.85, 1.15) });
    }
    return { x, y, r, shapeR, shallow, sand, grass, palms, edgeSand: edges(sand), edgeGrass: edges(grass), cache: null };
  }

  // Boundary edges of a cell set (for a single outline stroke)
  function edges(cells) {
    const set = new Set(cells.map((c) => c[0] + ',' + c[1]));
    const has = (i, j) => set.has(i + ',' + j);
    const out = [];
    const h = CELL / 2;
    for (const [i, j] of cells) {
      const x0 = i * CELL - h, y0 = j * CELL - h, x1 = x0 + CELL, y1 = y0 + CELL;
      if (!has(i, j - 1)) out.push([x0, y0, x1, y0]);
      if (!has(i, j + 1)) out.push([x0, y1, x1, y1]);
      if (!has(i - 1, j)) out.push([x0, y0, x0, y1]);
      if (!has(i + 1, j)) out.push([x1, y0, x1, y1]);
    }
    return out;
  }

  function placeIslands() {
    const list = [];
    let tries = 0;
    while (list.length < 14 && tries++ < 3000) {
      const r = rand(70, 180);
      const x = rand(r + 120, W - r - 120), y = rand(r + 120, H - r - 120);
      if (Math.hypot(x - CX, y - CY) < CLEAR_R + r + 60) continue;
      let ok = true;
      for (const o of list) {
        if (Math.hypot(x - o.x, y - o.y) < r + o.r + 140) { ok = false; break; }
      }
      if (ok) list.push(makeIsland(x, y, r));
    }
    return list;
  }

  // ---------- Collision ----------
  function collide(world, x, y, r) {
    let best = null;
    const consider = (nx, ny, depth) => { if (depth > 0 && (!best || depth > best.depth)) best = { nx, ny, depth }; };
    consider(1, 0, r - x);
    consider(-1, 0, x + r - world.w);
    consider(0, 1, r - y);
    consider(0, -1, y + r - world.h);
    for (const isl of world.islands) {
      const dx = x - isl.x, dy = y - isl.y;
      const rr = isl.r + r;
      if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
      const d = Math.hypot(dx, dy);
      if (d < rr) {
        if (d < 0.0001) consider(1, 0, rr);
        else consider(dx / d, dy / d, rr - d);
      }
    }
    return best;
  }

  // ---------- Coins & chests ----------
  function spawnCoin(world, avoid) {
    for (let t = 0; t < 40; t++) {
      const x = rand(80, world.w - 80), y = rand(80, world.h - 80);
      if (collide(world, x, y, 40)) continue;
      if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < 250) continue;
      return { x, y, taken: false, ph: Math.random() * 6.28 };
    }
    return null;
  }

  function spawnChests(world) {
    const chests = [];
    const used = new Set();
    let tries = 0;
    while (chests.length < CHEST_COUNT && tries++ < 500) {
      const idx = Math.floor(Math.random() * world.islands.length);
      if (used.has(idx) && used.size < world.islands.length) continue;
      const isl = world.islands[idx];
      const a = Math.random() * Math.PI * 2;
      // Water point a ship could reach next to this beach
      const wx = isl.x + Math.cos(a) * (isl.r + 40), wy = isl.y + Math.sin(a) * (isl.r + 40);
      if (collide(world, wx, wy, 30)) continue;
      const d = isl.shapeR(a) - 14;
      chests.push({ x: isl.x + Math.cos(a) * d, y: isl.y + Math.sin(a) * d, taken: false });
      used.add(idx);
    }
    return chests;
  }

  function create() {
    const world = { w: W, h: H, islands: placeIslands(), coins: [], chests: [], coinTimer: 0 };
    for (let i = 0; i < COIN_TARGET; i++) { const c = spawnCoin(world); if (c) world.coins.push(c); }
    world.chests = spawnChests(world);
    return world;
  }

  function update(world, dt, game) {
    const p = game && game.player;
    if (p) {
      for (const c of world.coins) {
        if (c.taken) continue;
        const dx = c.x - p.x, dy = c.y - p.y;
        if (dx * dx + dy * dy < 40 * 40) {
          c.taken = true; game.gold += 1; game.score += 10; game.emit('coin');
        }
      }
      for (const ch of world.chests) {
        if (ch.taken) continue;
        const dx = ch.x - p.x, dy = ch.y - p.y;
        if (dx * dx + dy * dy < 60 * 60) {
          ch.taken = true; game.gold += 25; game.score += 250; game.emit('treasure');
          game.floaters.push({ x: ch.x, y: ch.y - 20, text: '+25 GOLD', color: '#ffd23f', life: 1.6 });
        }
      }
    }
    // Drop taken coins, respawn gradually up to target
    if (world.coins.some((c) => c.taken)) world.coins = world.coins.filter((c) => !c.taken);
    world.coinTimer -= dt;
    if (world.coins.length < COIN_TARGET && world.coinTimer <= 0) {
      world.coinTimer = 0.6;
      const c = spawnCoin(world, p);
      if (c) world.coins.push(c);
    }
    if (world.chests.length === 0 || world.chests.every((c) => c.taken)) world.chests = spawnChests(world);
  }

  // ---------- Drawing ----------
  const WATER = ['#1f6fb8', '#2378c4', '#2a83cf', '#3290da'];
  function drawWater(ctx, game) {
    const cam = game.cam, t = game.t, vw = game.viewW, vh = game.viewH;
    const i0 = Math.floor(cam.x / TILE), j0 = Math.floor(cam.y / TILE);
    const i1 = Math.floor((cam.x + vw) / TILE), j1 = Math.floor((cam.y + vh) / TILE);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const sx = Math.floor(i * TILE - cam.x), sy = Math.floor(j * TILE - cam.y);
        if (i < 0 || j < 0 || i * TILE >= W || j * TILE >= H) {
          ctx.fillStyle = '#123f6b'; ctx.fillRect(sx, sy, TILE + 1, TILE + 1); continue;
        }
        const h = hash(i, j);
        const v = Math.sin(i * 0.55 + t * 1.3) + Math.sin(j * 0.7 - t * 0.9 + i * 0.2) + h * 1.2;
        const s = Math.max(0, Math.min(3, Math.floor((v + 2) * 0.8)));
        ctx.fillStyle = WATER[s];
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
        // blocky wave caps on a few tiles
        if (h > 0.82) {
          const off = Math.sin(t * 2 + h * 20) * 6;
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(sx + 14 + off, sy + 26, 22, 6);
          ctx.fillRect(sx + 22 + off, sy + 20, 10, 6);
        }
      }
    }
    // subtle grid seams
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = i0; i <= i1 + 1; i++) ctx.fillRect(Math.floor(i * TILE - cam.x), 0, 2, vh);
    for (let j = j0; j <= j1 + 1; j++) ctx.fillRect(0, Math.floor(j * TILE - cam.y), vw, 2);
  }

  function fillCells(ctx, cells, ox, oy) {
    const h = CELL / 2;
    for (const [i, j] of cells) ctx.fillRect(ox + i * CELL - h, oy + j * CELL - h, CELL, CELL);
  }
  function strokeEdges(ctx, list, ox, oy) {
    ctx.beginPath();
    for (const e of list) { ctx.moveTo(ox + e[0], oy + e[1]); ctx.lineTo(ox + e[2], oy + e[3]); }
    ctx.stroke();
  }
  function box(ctx, x, y, w, h, color) {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
  }

  function drawPalm(ctx, x, y, s) {
    const tw = 10 * s, th = 12 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x - 14 * s, y + 2, 34 * s, 10 * s); // shadow
    for (let k = 0; k < 4; k++) box(ctx, x - tw / 2 + k * 2 * s, y - th * (k + 1), tw, th, k % 2 ? '#8a5a2b' : '#9c6a35');
    const tx = x + 6 * s, ty = y - th * 4 - 4 * s;
    const L = 26 * s, T = 11 * s;
    box(ctx, tx - L, ty - T / 2, L, T, '#2f9e3f');
    box(ctx, tx, ty - T / 2, L, T, '#2f9e3f');
    box(ctx, tx - T / 2, ty - L * 0.8, T, L * 0.8, '#3cb94c');
    box(ctx, tx - L * 0.7, ty + T / 2 - 1, L * 0.6, T * 0.8, '#26863a');
    box(ctx, tx + L * 0.1, ty + T / 2 - 1, L * 0.6, T * 0.8, '#26863a');
    box(ctx, tx - 7 * s, ty - 7 * s, 14 * s, 14 * s, '#46c957');
    box(ctx, tx - 6 * s, ty + 6 * s, 6 * s, 6 * s, '#6b4a1f'); // coconut
  }

  function renderIsland(ctx, isl, ox, oy) {
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'miter';
    ctx.fillStyle = 'rgba(120,220,235,0.45)';
    fillCells(ctx, isl.shallow, ox, oy);
    // cliff / side face
    ctx.fillStyle = '#b8894a'; fillCells(ctx, isl.sand, ox, oy + 8); strokeEdges(ctx, isl.edgeSand, ox, oy + 8);
    // sand top
    ctx.fillStyle = '#f2d37b'; fillCells(ctx, isl.sand, ox, oy); strokeEdges(ctx, isl.edgeSand, ox, oy);
    // grass block: side then raised top
    if (isl.grass.length) {
      ctx.fillStyle = '#3a8f34'; fillCells(ctx, isl.grass, ox, oy); strokeEdges(ctx, isl.edgeGrass, ox, oy);
      ctx.fillStyle = '#5cc94a'; fillCells(ctx, isl.grass, ox, oy - 7); strokeEdges(ctx, isl.edgeGrass, ox, oy - 7);
    }
    for (const p of isl.palms) drawPalm(ctx, ox + p.x, oy + p.y - 7, p.s);
  }

  function islandCache(isl) {
    if (isl.cache !== null) return isl.cache;
    isl.cache = false;
    if (typeof document !== 'undefined' && document.createElement) {
      const pad = isl.r + 50, size = Math.ceil(pad * 2 + 80);
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const cx = c.getContext('2d');
      if (cx) { renderIsland(cx, isl, pad, pad + 70); isl.cache = { c, ox: pad, oy: pad + 70 }; }
    }
    return isl.cache;
  }

  function drawCoin(ctx, x, y, t, ph) {
    const w = Math.max(3, 16 * Math.abs(Math.cos(t * 4 + ph)));
    const by = y + Math.sin(t * 3 + ph) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 8, y + 10, 16, 5);
    box(ctx, x - w / 2, by - 9, w, 18, '#ffd23f');
    if (w > 8) { ctx.fillStyle = '#fff3a8'; ctx.fillRect(x - w / 2 + 3, by - 6, Math.max(2, w / 4), 6); }
  }

  function drawChest(ctx, x, y, t) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 18, y + 8, 38, 8);
    box(ctx, x - 17, y - 6, 34, 18, '#8b5a2b');          // body
    box(ctx, x - 17, y - 16, 34, 11, '#a86d34');         // lid
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(x - 17, y - 7, 34, 3);                  // trim band
    ctx.fillRect(x - 12, y - 16, 4, 28); ctx.fillRect(x + 8, y - 16, 4, 28);
    box(ctx, x - 4, y - 9, 8, 8, '#ffd23f');             // lock
    const g = (Math.sin(t * 4 + x) + 1) / 2;             // sparkle
    if (g > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,' + ((g - 0.6) * 2.5).toFixed(2) + ')';
      ctx.fillRect(x + 12, y - 26, 4, 12); ctx.fillRect(x + 8, y - 22, 12, 4);
    }
  }

  function drawIslands(ctx, game) {
    const w = game.world, cam = game.cam, vw = game.viewW, vh = game.viewH, t = game.t;
    ctx.save();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'miter';
    for (const isl of w.islands) {
      const m = isl.r + 120;
      if (isl.x + m < cam.x || isl.x - m > cam.x + vw || isl.y + m < cam.y || isl.y - m > cam.y + vh) continue;
      const sx = Math.round(isl.x - cam.x), sy = Math.round(isl.y - cam.y);
      const c = islandCache(isl);
      if (c) ctx.drawImage(c.c, sx - c.ox, sy - c.oy);
      else { renderIsland(ctx, isl, sx, sy); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; }
    }
    for (const ch of w.chests) {
      if (ch.taken) continue;
      const x = ch.x - cam.x, y = ch.y - cam.y;
      if (x < -40 || y < -40 || x > vw + 40 || y > vh + 40) continue;
      drawChest(ctx, Math.round(x), Math.round(y), t);
    }
    for (const co of w.coins) {
      if (co.taken) continue;
      const x = co.x - cam.x, y = co.y - cam.y;
      if (x < -20 || y < -20 || x > vw + 20 || y > vh + 20) continue;
      drawCoin(ctx, x, y, t, co.ph || 0);
    }
    ctx.restore();
  }

  function drawMinimap(ctx, game, x, y, size) {
    const w = game.world; if (!w) return;
    const s = size / w.w;
    ctx.save();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 4, y + 4, size, size);
    ctx.fillStyle = '#2a6fb5'; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#e8c86a';
    for (const isl of w.islands) {
      const d = Math.max(3, isl.r * 2 * s);
      ctx.fillRect(Math.round(x + isl.x * s - d / 2), Math.round(y + isl.y * s - d / 2), Math.round(d), Math.round(d));
    }
    ctx.fillStyle = '#ffd23f';
    for (const ch of w.chests) if (!ch.taken) ctx.fillRect(x + ch.x * s - 3, y + ch.y * s - 3, 6, 6);
    ctx.fillStyle = '#ff3b30';
    for (const e of game.enemies || []) ctx.fillRect(x + e.x * s - 3, y + e.y * s - 3, 6, 6);
    // viewport
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + game.cam.x * s, y + game.cam.y * s, game.viewW * s, game.viewH * s);
    ctx.restore();
    const p = game.player;
    if (p) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.fillRect(x + p.x * s - 4, y + p.y * s - 4, 8, 8);
      ctx.strokeRect(x + p.x * s - 4, y + p.y * s - 4, 8, 8);
    }
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.strokeRect(x, y, size, size);
    ctx.restore();
  }

  PG.World = { create, update, collide, drawWater, drawIslands, drawMinimap };
})();
