// Orchestrator: loop, state machine, camera, waves, scoring.
window.PG = window.PG || {};
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let best = 0;
  try { best = +localStorage.getItem('pg_best') || 0; } catch (e) {}

  const game = {
    state: 'menu', t: 0, world: null, player: null,
    enemies: [], balls: [], particles: [], floaters: [],
    gold: 0, score: 0, wave: 1, best,
    cam: { x: 0, y: 0 }, viewW: 0, viewH: 0,
    banner: null, // {text, life}
    emit(name, data) { if (PG.Audio) PG.Audio.play(name, data); },
  };
  PG.game = game; // handy for debugging

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.viewW = innerWidth; game.viewH = innerHeight;
  }
  addEventListener('resize', resize);
  resize();

  function newGame() {
    game.world = PG.World.create();
    game.player = PG.Entities.createPlayer(game.world.w / 2, game.world.h / 2);
    game.enemies = []; game.balls = []; game.particles = []; game.floaters = [];
    game.gold = 0; game.score = 0; game.wave = 0;
    nextWave();
    game.state = 'play';
  }

  function nextWave() {
    game.wave++;
    const count = 1 + game.wave; // wave 1 = 2 ships
    for (let i = 0; i < count; i++) spawnEnemy();
    game.banner = { text: 'WAVE ' + game.wave, life: 2.5 };
    game.emit('wave');
    if (game.wave > 1) { // reward survivors with a small repair
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 25);
    }
  }

  function spawnEnemy() {
    const w = game.world, p = game.player;
    for (let tries = 0; tries < 50; tries++) {
      const a = Math.random() * Math.PI * 2, d = 700 + Math.random() * 500;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x < 100 || y < 100 || x > w.w - 100 || y > w.h - 100) continue;
      if (PG.World.collide(w, x, y, 60)) continue;
      game.enemies.push(PG.Entities.createEnemy(x, y, game.wave));
      return;
    }
  }

  function update(dt) {
    const input = PG.Input.state;
    if (game.state !== 'play') {
      if (PG.Input.consumeClick()) { PG.Audio.init(); game.emit('click'); newGame(); }
      return;
    }
    PG.Entities.updatePlayer(game, input, dt);
    PG.Entities.updateEnemies(game, dt);
    PG.Entities.updateBalls(game, dt);
    PG.World.update(game.world, dt, game);

    if (game.enemies.length === 0) nextWave();
    if (game.banner && (game.banner.life -= dt) <= 0) game.banner = null;

    if (game.player.hp <= 0) {
      game.state = 'over';
      game.best = Math.max(game.best, game.score);
      try { localStorage.setItem('pg_best', game.best); } catch (e) {}
      game.emit('gameover');
      PG.Input.consumeClick(); // drop stale clicks
    }

    // Camera follows player, clamped to world
    const p = game.player;
    const tx = p.x - game.viewW / 2, ty = p.y - game.viewH / 2;
    game.cam.x += (tx - game.cam.x) * Math.min(1, dt * 5);
    game.cam.y += (ty - game.cam.y) * Math.min(1, dt * 5);
    game.cam.x = Math.max(0, Math.min(game.world.w - game.viewW, game.cam.x));
    game.cam.y = Math.max(0, Math.min(game.world.h - game.viewH, game.cam.y));
  }

  function draw() {
    ctx.clearRect(0, 0, game.viewW, game.viewH);
    if (!game.world) { // menu before first game: show a world behind the title
      game.world = PG.World.create();
      game.cam.x = game.world.w / 2 - game.viewW / 2;
      game.cam.y = game.world.h / 2 - game.viewH / 2;
    }
    if (game.state === 'menu') { game.cam.x += 0.3; game.cam.y += 0.15; }
    PG.World.drawWater(ctx, game);
    PG.World.drawIslands(ctx, game);
    if (game.player) PG.Entities.drawAll(ctx, game);

    if (game.state === 'play') {
      PG.UI.drawHUD(ctx, game);
      if (game.banner) PG.UI.drawBanner(ctx, game, game.banner.text, Math.min(1, game.banner.life));
    } else if (game.state === 'menu') {
      PG.UI.drawMenu(ctx, game);
    } else {
      PG.UI.drawGameOver(ctx, game);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.t += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  PG.Input.init(canvas);
  requestAnimationFrame(frame);
})();
