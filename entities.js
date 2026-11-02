// Entities: player ship, enemy ships, cannonballs, particles, floaters.
window.PG = window.PG || {};
(function () {
  const TAU = Math.PI * 2;
  const OUTLINE = '#1b1b1b';
  const RELOAD = 1.2;
  const BALL_SPEED = 430;

  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function collide(world, x, y, r) {
    return (PG.World && PG.World.collide) ? PG.World.collide(world, x, y, r) : null;
  }

  // ---------- particles / floaters helpers ----------
  function puff(game, x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = (opts.dir != null ? opts.dir + rand(-opts.spread, opts.spread) : Math.random() * TAU);
      const s = rand(opts.minSpeed || 10, opts.maxSpeed || 60);
      const life = rand(opts.minLife || 0.4, opts.maxLife || 0.9);
      const colors = opts.colors;
      game.particles.push({
        x: x + rand(-2, 2), y: y + rand(-2, 2),
        vx: Math.cos(a) * s + (opts.vx || 0), vy: Math.sin(a) * s + (opts.vy || 0),
        life, maxLife: life,
        color: colors[(Math.random() * colors.length) | 0],
        size: rand(opts.minSize || 3, opts.maxSize || 7),
        grow: opts.grow || 0,
      });
    }
  }
  function splash(game, x, y, big) {
    puff(game, x, y, big ? 10 : 6, {
      colors: ['#ffffff', '#cfefff', '#8fd3ff'], minSpeed: 20, maxSpeed: big ? 90 : 60,
      minLife: 0.3, maxLife: 0.6, minSize: 3, maxSize: 6,
    });
  }
  function floater(game, x, y, text, color) {
    game.floaters.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
  }

  // ---------- firing ----------
  // side: -1 = left (port), +1 = right (starboard)
  function broadside(game, ship, side, count, owner, dmg, spreadJitter) {
    const fa = ship.angle + side * Math.PI / 2;
    const cx = Math.cos(ship.angle), cy = Math.sin(ship.angle);
    const fx = Math.cos(fa), fy = Math.sin(fa);
    const len = ship.len || 60;
    const svx = cx * ship.speed, svy = cy * ship.speed;
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * len * 0.55;
      const bx = ship.x + cx * off + fx * (ship.wid || 30) * 0.55;
      const by = ship.y + cy * off + fy * (ship.wid || 30) * 0.55;
      const a = fa + rand(-spreadJitter, spreadJitter);
      const sp = BALL_SPEED * rand(0.95, 1.05);
      game.balls.push({
        x: bx, y: by,
        vx: Math.cos(a) * sp + svx * 0.6, vy: Math.sin(a) * sp + svy * 0.6,
        life: 1.05, owner, dmg,
      });
      // muzzle flash + smoke
      puff(game, bx, by, 3, {
        dir: fa, spread: 0.4, colors: ['#ffd23f', '#ff8c1a'], minSpeed: 40, maxSpeed: 110,
        minLife: 0.1, maxLife: 0.2, minSize: 3, maxSize: 6, vx: svx, vy: svy,
      });
      puff(game, bx, by, 5, {
        dir: fa, spread: 0.6, colors: ['#e8e8e8', '#cfcfcf', '#a9a9a9'], minSpeed: 15, maxSpeed: 70,
        minLife: 0.5, maxLife: 1.0, minSize: 5, maxSize: 9, grow: 8, vx: svx * 0.5, vy: svy * 0.5,
      });
    }
    // recoil: tiny push opposite to fire direction
    ship.kx = (ship.kx || 0) - fx * 25;
    ship.ky = (ship.ky || 0) - fy * 25;
    game.emit('fire', { owner });
  }

  // ---------- movement ----------
  function moveShip(game, ship, dt) {
    const prevX = ship.x, prevY = ship.y;
    ship.x += (Math.cos(ship.angle) * ship.speed + (ship.kx || 0)) * dt;
    ship.y += (Math.sin(ship.angle) * ship.speed + (ship.ky || 0)) * dt;
    const k = Math.exp(-4 * dt);
    ship.kx = (ship.kx || 0) * k; ship.ky = (ship.ky || 0) * k;
    let hitAny = false;
    for (let it = 0; it < 3; it++) {
      const c = collide(game.world, ship.x, ship.y, ship.r);
      if (!c) break;
      hitAny = true;
      ship.x += c.nx * c.depth; ship.y += c.ny * c.depth;
    }
    if (hitAny) {
      ship.speed *= 0.3;
      ship.kx *= 0.3; ship.ky *= 0.3;
    }
    if (!isFinite(ship.x) || !isFinite(ship.y)) { ship.x = prevX; ship.y = prevY; }
    // wake
    ship.wakeT = (ship.wakeT || 0) - dt;
    if (!ship.wake) ship.wake = [];
    if (ship.wakeT <= 0 && Math.abs(ship.speed) > 25) {
      ship.wakeT = 0.06;
      const bx = ship.x - Math.cos(ship.angle) * (ship.len || 60) * 0.5;
      const by = ship.y - Math.sin(ship.angle) * (ship.len || 60) * 0.5;
      ship.wake.push({ x: bx, y: by, life: 1.0, s: Math.min(1, Math.abs(ship.speed) / 200) });
    }
    for (let i = ship.wake.length - 1; i >= 0; i--) {
      if ((ship.wake[i].life -= dt) <= 0) ship.wake.splice(i, 1);
    }
    if (ship.flash > 0) ship.flash -= dt;
  }

  // ---------- player ----------
  function createPlayer(x, y) {
    return {
      x, y, angle: -Math.PI / 2, speed: 0, hp: 100, maxHp: 100,
      reloadL: 0, reloadR: 0, r: 28, invuln: 0,
      len: 68, wid: 32, kx: 0, ky: 0, wake: [], flash: 0,
    };
  }

  function updatePlayer(game, input, dt) {
    const p = game.player;
    if (!p) return;
    input = input || {};
    const MAX = 220, REV = 80;
    if (input.up) p.speed += 170 * dt;
    else if (input.down) p.speed -= 140 * dt;
    else p.speed *= Math.exp(-0.9 * dt); // drag when coasting
    p.speed *= Math.exp(-0.15 * dt);       // light constant drag
    if (p.speed > MAX) p.speed = MAX;
    if (p.speed < -REV) p.speed = -REV;

    const turnRate = 0.7 + 1.5 * Math.min(1, Math.abs(p.speed) / MAX);
    const dir = p.speed < -5 ? -1 : 1;
    if (input.left) p.angle -= turnRate * dt * dir;
    if (input.right) p.angle += turnRate * dt * dir;
    p.angle = wrapAngle(p.angle);

    moveShip(game, p, dt);

    p.reloadL = Math.max(0, p.reloadL - dt);
    p.reloadR = Math.max(0, p.reloadR - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    if (input.fireLeft && p.reloadL <= 0) {
      broadside(game, p, -1, 3, 'player', 20, 0.05);
      p.reloadL = RELOAD;
    }
    if (input.fireRight && p.reloadR <= 0) {
      broadside(game, p, 1, 3, 'player', 20, 0.05);
      p.reloadR = RELOAD;
    }
  }

  // ---------- enemies ----------
  function createEnemy(x, y, wave) {
    wave = Math.max(1, wave || 1);
    const frigateChance = wave >= 3 ? Math.min(0.6, 0.3 + 0.05 * (wave - 3)) : 0;
    const frigate = Math.random() < frigateChance;
    const hp = frigate ? 90 + 15 * (wave - 1) : 40 + 8 * (wave - 1);
    return {
      x, y, angle: Math.random() * TAU, speed: 0, hp, maxHp: hp,
      r: frigate ? 34 : 26,
      reload: rand(2.0, 3.5), // grace period before first volley
      kind: frigate ? 'frigate' : 'sloop',
      bounty: frigate ? 25 : 10,
      len: frigate ? 86 : 62, wid: frigate ? 40 : 30,
      wave, kx: 0, ky: 0, wake: [], flash: 0,
      orbit: Math.random() < 0.5 ? -1 : 1,
    };
  }

  function updateEnemies(game, dt) {
    const p = game.player;
    const list = game.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const w = e.wave || game.wave || 1;
      const frig = e.kind === 'frigate';
      const maxSpeed = frig ? 115 + 3 * w : Math.min(185, 140 + 5 * w);
      const turnRate = frig ? 1.0 : 1.5;

      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const bearing = Math.atan2(dy, dx);
      let desired, targetSpeed = maxSpeed;

      if (d > 380) {
        desired = bearing;
      } else {
        // get side-on: pick the perpendicular nearest our heading, nudge in/out to hold ~250px
        const p1 = bearing + Math.PI / 2, p2 = bearing - Math.PI / 2;
        const perp = Math.abs(wrapAngle(p1 - e.angle)) < Math.abs(wrapAngle(p2 - e.angle)) ? p1 : p2;
        const sideSign = wrapAngle(perp - bearing) > 0 ? 1 : -1;
        const err = (d - 250) / 150; // + means too far
        desired = perp - sideSign * Math.max(-0.6, Math.min(0.6, err * 0.6));
        targetSpeed = maxSpeed * 0.7;
      }

      // island avoidance: probe ahead
      const look = 70 + Math.abs(e.speed) * 0.5;
      const px = e.x + Math.cos(e.angle) * look, py = e.y + Math.sin(e.angle) * look;
      const c = collide(game.world, px, py, e.r);
      if (c) {
        const cross = Math.cos(e.angle) * c.ny - Math.sin(e.angle) * c.nx;
        desired = e.angle + (cross >= 0 ? 1 : -1) * Math.PI / 2;
        targetSpeed = maxSpeed * 0.5;
      }

      const diff = wrapAngle(desired - e.angle);
      const tr = turnRate * (0.5 + 0.5 * Math.min(1, Math.abs(e.speed) / maxSpeed));
      e.angle = wrapAngle(e.angle + Math.max(-tr * dt, Math.min(tr * dt, diff)));
      e.speed += Math.sign(targetSpeed - e.speed) * Math.min(Math.abs(targetSpeed - e.speed), 120 * dt);

      moveShip(game, e, dt);

      // separation from other enemies and player
      for (let j = i + 1; j < list.length; j++) {
        const o = list[j];
        const sx = o.x - e.x, sy = o.y - e.y, sd = Math.hypot(sx, sy) || 1, min = o.r + e.r;
        if (sd < min) {
          const push = (min - sd) / 2, nx = sx / sd, ny = sy / sd;
          e.x -= nx * push; e.y -= ny * push; o.x += nx * push; o.y += ny * push;
        }
      }
      {
        const min = p.r + e.r;
        if (d < min) {
          const push = (min - d) / 2, nx = dx / d, ny = dy / d;
          e.x -= nx * push; e.y -= ny * push; p.x += nx * push; p.y += ny * push;
          e.speed *= 0.7; p.speed *= 0.8;
        }
      }

      // fire broadside when player is roughly perpendicular and in range
      e.reload -= dt;
      if (e.reload <= 0 && d < 430 && p.hp > 0) {
        // lead the target partially
        const tFlight = d / BALL_SPEED;
        const lx = p.x + Math.cos(p.angle) * p.speed * tFlight * 0.5 - e.x;
        const ly = p.y + Math.sin(p.angle) * p.speed * tFlight * 0.5 - e.y;
        const rel = wrapAngle(Math.atan2(ly, lx) - e.angle);
        const tol = 0.3;
        let side = 0;
        if (Math.abs(rel - Math.PI / 2) < tol) side = 1;
        else if (Math.abs(rel + Math.PI / 2) < tol) side = -1;
        if (side) {
          const n = frig ? 3 : 2;
          const dmg = (frig ? 9 : 6) + Math.min(6, Math.floor((w - 1) * 0.75));
          const jitter = Math.max(0.05, 0.16 - 0.01 * w);
          broadside(game, e, side, n, 'enemy', dmg, jitter);
          const base = frig ? 3.6 : 3.4;
          e.reload = Math.max(1.5, base - 0.18 * (w - 1)) * rand(0.9, 1.15);
        }
      }
    }
  }

  // ---------- balls / effects ----------
  function sinkEnemy(game, e, idx) {
    game.enemies.splice(idx, 1);
    game.gold += e.bounty;
    game.score += e.bounty * 10;
    puff(game, e.x, e.y, 18, {
      colors: ['#ffd23f', '#ff8c1a', '#ff4d1a'], minSpeed: 40, maxSpeed: 180,
      minLife: 0.3, maxLife: 0.7, minSize: 4, maxSize: 9,
    });
    puff(game, e.x, e.y, 14, {
      colors: ['#8b5a2b', '#6b4220', '#c08a4b'], minSpeed: 30, maxSpeed: 140,
      minLife: 0.8, maxLife: 1.5, minSize: 4, maxSize: 8,
    });
    puff(game, e.x, e.y, 14, {
      colors: ['#555555', '#777777', '#999999'], minSpeed: 10, maxSpeed: 60,
      minLife: 1.0, maxLife: 1.8, minSize: 8, maxSize: 14, grow: 10,
    });
    splash(game, e.x, e.y, true);
    floater(game, e.x, e.y - 30, '+' + e.bounty + ' GOLD', '#ffd23f');
    game.emit('sink', { kind: e.kind });
  }

  function updateBalls(game, dt) {
    const balls = game.balls, p = game.player;
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) { splash(game, b.x, b.y, false); balls.splice(i, 1); continue; }
      if (collide(game.world, b.x, b.y, 4)) {
        splash(game, b.x, b.y, false);
        puff(game, b.x, b.y, 4, { colors: ['#e8d29a', '#c9b27a'], minSpeed: 20, maxSpeed: 60, minLife: 0.2, maxLife: 0.4 });
        balls.splice(i, 1); continue;
      }
      let hit = false;
      if (b.owner === 'player') {
        for (let j = game.enemies.length - 1; j >= 0; j--) {
          const e = game.enemies[j];
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
            e.hp -= b.dmg;
            e.flash = 0.12;
            const bl = Math.hypot(b.vx, b.vy) || 1;
            e.kx += b.vx / bl * 40; e.ky += b.vy / bl * 40;
            puff(game, b.x, b.y, 6, { colors: ['#8b5a2b', '#c08a4b', '#ffd23f'], minSpeed: 30, maxSpeed: 120, minLife: 0.3, maxLife: 0.6 });
            game.emit('hit');
            if (e.hp <= 0) sinkEnemy(game, e, j);
            hit = true;
            break;
          }
        }
      } else if (p && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 5) {
        hit = true;
        if (p.invuln <= 0) {
          p.hp = Math.max(0, p.hp - b.dmg);
          p.invuln = 0.4;
          p.flash = 0.15;
          const bl = Math.hypot(b.vx, b.vy) || 1;
          p.kx += b.vx / bl * 45; p.ky += b.vy / bl * 45;
          puff(game, b.x, b.y, 7, { colors: ['#8b5a2b', '#c08a4b', '#ff8c1a'], minSpeed: 30, maxSpeed: 120, minLife: 0.3, maxLife: 0.6 });
          floater(game, p.x, p.y - 34, '-' + b.dmg, '#ff5a5a');
          game.emit('hurt');
        } else {
          splash(game, b.x, b.y, false);
        }
      }
      if (hit) balls.splice(i, 1);
    }

    // particles
    const ps = game.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.life -= dt;
      if (q.life <= 0) { ps.splice(i, 1); continue; }
      const k = Math.exp(-2.5 * dt);
      q.vx *= k; q.vy *= k;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.grow) q.size += q.grow * dt;
    }
    // floaters
    const fs = game.floaters;
    for (let i = fs.length - 1; i >= 0; i--) {
      const f = fs[i];
      if (f.life == null) f.life = 1.4;
      if (f.maxLife == null) f.maxLife = Math.max(f.life, 0.01);
      f.life -= dt;
      f.y -= 32 * dt;
      if (f.life <= 0) fs.splice(i, 1);
    }
  }

  // ---------- drawing ----------
  function box(ctx, x, y, w, h, fill, lw) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (lw !== 0) {
      ctx.lineWidth = lw || 3;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeRect(x, y, w, h);
    }
  }

  function drawWake(ctx, ship, cam) {
    if (!ship.wake) return;
    for (const w of ship.wake) {
      const a = w.life * 0.45 * (0.4 + 0.6 * w.s);
      const s = 6 + (1 - w.life) * 16;
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.fillRect(w.x - cam.x - s / 2, w.y - cam.y - s / 2, s, s);
    }
  }

  function drawShip(ctx, ship, cam, opts) {
    const L = ship.len || 60, W = ship.wid || 30;
    const sx = ship.x - cam.x, sy = ship.y - cam.y;
    // shadow on water
    ctx.save();
    ctx.translate(sx + 5, sy + 6);
    ctx.rotate(ship.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-L / 2, -W / 2, L, W);
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ship.angle);
    const bob = Math.sin((ship.x + ship.y) * 0.01 + (opts.t || 0) * 3) * 0.04;
    ctx.rotate(bob);

    const hull = opts.hull || '#8b5a2b', hullDark = '#6b4220', deck = '#c99a5b';
    // bow (stepped blocks)
    box(ctx, L / 2 - 14, -W / 2 + 5, 12, W - 10, hull);
    box(ctx, L / 2 - 4, -W / 4, 8, W / 2, hull);
    // main hull
    box(ctx, -L / 2, -W / 2, L - 12, W, hull);
    // side face (darker rails)
    ctx.fillStyle = hullDark;
    ctx.fillRect(-L / 2 + 2, W / 2 - 6, L - 16, 4);
    ctx.fillRect(-L / 2 + 2, -W / 2 + 2, L - 16, 4);
    // deck
    box(ctx, -L / 2 + 6, -W / 2 + 6, L - 22, W - 12, deck, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    for (let px = -L / 2 + 14; px < L / 2 - 16; px += 8) {
      ctx.beginPath(); ctx.moveTo(px, -W / 2 + 7); ctx.lineTo(px, W / 2 - 7); ctx.stroke();
    }
    // cannons poking out of both sides
    const nC = opts.cannons || 3;
    for (let i = 0; i < nC; i++) {
      const cx = -L * 0.25 + (nC === 1 ? 0 : i * (L * 0.5) / (nC - 1)) - 3;
      box(ctx, cx, -W / 2 - 5, 7, 6, '#333333', 2);
      box(ctx, cx, W / 2 - 1, 7, 6, '#333333', 2);
    }
    // stern cabin
    box(ctx, -L / 2 + 2, -W / 2 + 7, 14, W - 14, hullDark, 2);
    box(ctx, -L / 2 + 4, -W / 2 + 9, 10, 4, '#a8743d', 0);
    // mast
    box(ctx, -5, -5, 10, 10, '#4a2f17', 2);
    // sail: wide block across the ship
    const sw = 12, sh = W + 16;
    box(ctx, -2, -sh / 2, sw, sh, opts.sail);
    ctx.fillStyle = opts.sailLight;
    ctx.fillRect(-2 + 2, -sh / 2 + 2, 4, sh - 4);
    if (opts.skull) {
      box(ctx, -1, -7, 10, 14, '#f4f4f4', 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(3, -5, 3, 3);
      ctx.fillRect(3, 2, 3, 3);
    }
    // flag at stern
    box(ctx, -L / 2 - 8, -4, 8, 8, opts.flag, 2);

    if (ship.flash > 0) {
      ctx.globalAlpha = Math.min(1, ship.flash / 0.12) * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-L / 2, -W / 2, L, W);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawHpBar(ctx, e, cam) {
    const w = 46, h = 7;
    const x = e.x - cam.x - w / 2, y = e.y - cam.y - e.r - 22;
    const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#5a1a1a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f > 0.5 ? '#5fd35f' : f > 0.25 ? '#ffc43d' : '#ff4d4d';
    ctx.fillRect(x, y, w * f, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, w * f, 2);
  }

  function drawAll(ctx, game) {
    const cam = game.cam, vw = game.viewW || 1e9, vh = game.viewH || 1e9;
    const onScreen = (x, y, m) => x - cam.x > -m && y - cam.y > -m && x - cam.x < vw + m && y - cam.y < vh + m;
    const p = game.player;

    // wakes
    for (const e of game.enemies) drawWake(ctx, e, cam);
    if (p) drawWake(ctx, p, cam);

    // enemies
    for (const e of game.enemies) {
      if (!onScreen(e.x, e.y, 120)) continue;
      drawShip(ctx, e, cam, {
        t: game.t, sail: '#222222', sailLight: '#3c3c3c', skull: true, flag: '#111111',
        cannons: e.kind === 'frigate' ? 4 : 2, hull: e.kind === 'frigate' ? '#7a4a24' : '#8b5a2b',
      });
    }
    // player (blink while invulnerable)
    if (p && p.hp > 0 && !(p.invuln > 0 && Math.floor(game.t * 20) % 2 === 0)) {
      drawShip(ctx, p, cam, {
        t: game.t, sail: '#2f7bff', sailLight: '#7fb0ff', skull: false, flag: '#ffd23f', cannons: 3,
      });
    } else if (p && p.hp <= 0) {
      ctx.globalAlpha = 0.5;
      drawShip(ctx, p, cam, { t: game.t, sail: '#2f7bff', sailLight: '#7fb0ff', flag: '#ffd23f', cannons: 3 });
      ctx.globalAlpha = 1;
    }
    for (const e of game.enemies) if (onScreen(e.x, e.y, 120)) drawHpBar(ctx, e, cam);

    // balls
    for (const b of game.balls) {
      if (!onScreen(b.x, b.y, 20)) continue;
      const x = b.x - cam.x, y = b.y - cam.y;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 3, y + 1, 8, 8);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE;
      ctx.strokeRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(x - 3, y - 3, 3, 3);
    }

    // particles
    for (const q of game.particles) {
      if (!onScreen(q.x, q.y, 30)) continue;
      const a = Math.max(0, Math.min(1, q.life / (q.maxLife || 1)));
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color || '#ffffff';
      const s = q.size || 4;
      ctx.fillRect(q.x - cam.x - s / 2, q.y - cam.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // floaters
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.lineJoin = 'round';
    for (const f of game.floaters) {
      const life = f.life == null ? 1 : f.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, life / 0.5));
      const x = f.x - cam.x, y = f.y - cam.y;
      ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE;
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color || '#ffffff';
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  PG.Entities = { createPlayer, updatePlayer, createEnemy, updateEnemies, updateBalls, drawAll };
})();
