# Blocky Buccaneers — module contract

Plain browser JS, no build step, no modules, no external libraries. Must work by opening
`index.html` directly (file://). Every file attaches to the global `window.PG` namespace:
start each file with `window.PG = window.PG || {};`.

Load order (index.html): `world.js`, `entities.js`, `ui.js`, `main.js`.
`main.js` (orchestrator) owns the loop, state machine, camera, spawning and scoring.

## Visual style
Blocky "Roblox-like" look: chunky rectangles, flat bright colours, thick dark outlines
(`#1b1b1b`, lineWidth 3), simple boxy shading (lighter top face / darker side face).
No images — draw everything with canvas 2D primitives. Fonts: `"Trebuchet MS", sans-serif`, bold.

## Coordinates
World units = pixels. World is `world.w` x `world.h` (3000 x 3000). Camera `cam = {x, y}` is
the world point at the top-left of the screen. Screen pos = world pos - cam.
Angles in radians, 0 = facing +x (right), increasing clockwise (canvas convention).

## Shared game object (created by main.js)
```js
game = {
  state: 'menu' | 'play' | 'over',
  t: 0,               // seconds since page load
  world,              // from PG.World.create()
  player,             // from PG.Entities.createPlayer()
  enemies: [],        // from PG.Entities.createEnemy()
  balls: [],          // cannonballs {x,y,vx,vy,life,owner:'player'|'enemy',dmg}
  particles: [],      // {x,y,vx,vy,life,maxLife,color,size}
  floaters: [],       // floating text {x,y,text,color,life}
  gold: 0, score: 0, wave: 1, best: 0,
  cam: {x, y}, viewW, viewH,
  emit(name, data)    // event hook: main forwards to PG.Audio.play(name) — call it for sounds
}
```
Events to emit (names are fixed): `'fire'`, `'hit'`, `'sink'`, `'coin'`, `'treasure'`, `'hurt'`,
`'wave'`, `'gameover'`, `'click'`.

## world.js — `PG.World`
- `create()` → `world = { w:3000, h:3000, islands:[{x,y,r,...}], coins:[{x,y,taken:false}], chests:[{x,y,taken:false}] }`
  ~14 islands (r 70–180) with palm trees, kept away from map centre (1500,1500, radius 300);
  ~60 coins in open water; 5 treasure chests placed on island beaches (reachable edge).
- `update(world, dt, game)` → respawn coins over time so there are always ~60; when all chests are
  taken, place 5 new ones. Handle pickups: player within 40px of coin → `taken`, `game.gold += 1`,
  `game.score += 10`, emit `'coin'`; chest within 60px → `game.gold += 25`, `game.score += 250`,
  emit `'treasure'`, push a floater `"+25 GOLD"`.
- `collide(world, x, y, r)` → `null` or `{nx, ny, depth}` (push-out normal) against islands and map edges.
- `drawWater(ctx, game)` → fill whole screen with animated blocky ocean (tile grid, waves), using `game.cam`, `game.t`.
- `drawIslands(ctx, game)` → islands (sand ring + grass + blocky palm trees), coins (spinning gold
  blocks), chests (brown box with gold trim). Cull off-screen items.
- `drawMinimap(ctx, game, x, y, size)` → small map box: islands, player (white), enemies (red), chests (yellow).

## entities.js — `PG.Entities`
- `createPlayer(x, y)` → `{x, y, angle, speed, hp:100, maxHp:100, reloadL:0, reloadR:0, r:28, invuln:0}`
- `updatePlayer(game, input, dt)` — input = `{up, down, left, right, fireLeft, fireRight}` booleans.
  Up/down accelerate (max ~220 px/s, reverse slower), left/right turn (turn rate scales with speed, still
  some turning at 0). Drag. Use `PG.World.collide` to push out and kill speed on impact.
  `fireLeft` (Q) / `fireRight` (E) shoot a broadside of 3 balls perpendicular to heading, 1.2s reload each side.
- `createEnemy(x, y, wave)` → `{x, y, angle, speed, hp, maxHp, r:26, reload, kind:'sloop'|'frigate', bounty}`
  (frigates appear from wave 3, more hp, bigger). HP scales with wave.
- `updateEnemies(game, dt)` — simple AI: steer toward player, try to get side-on at ~250px range and fire
  broadsides when the player is roughly perpendicular; avoid islands via `collide`.
- `updateBalls(game, dt)` — move balls, expire, hit islands (splash particles), hit ships: player balls damage
  enemies, enemy balls damage player (respect `player.invuln`). On enemy hp<=0: remove it, `game.gold += bounty`,
  `game.score += bounty*10`, explosion particles, emit `'sink'`, floater. Player hit → emit `'hurt'`.
  Update `game.particles` and `game.floaters` lifetimes too.
- `drawAll(ctx, game)` — draw wake trails, ships (blocky hull, deck, mast, sail with skull for enemies /
  colour for player, small hp bar over enemies), balls, particles, floaters.
  Player ship must clearly differ from enemies (player: blue sail; enemies: black sail with white skull block).

## ui.js — `PG.UI`, `PG.Audio`, `PG.Input`
- `PG.Input` → `{ state:{up,down,left,right,fireLeft,fireRight}, init(canvas), consumeClick() }`.
  Keys: WASD + arrows, Q/E fire, Space fires both sides. Also on-screen touch controls for mobile
  (left-side virtual joystick → up/left/right; two buttons bottom-right FIRE L / FIRE R) — only drawn when touch
  is detected. `consumeClick()` returns true once after a click/tap/Enter (used for menu/game-over).
- `PG.UI.drawHUD(ctx, game)` → top-left: HP bar (blocky), gold counter with coin icon, score, wave number,
  reload indicators for both sides (player.reloadL/R vs 1.2). Calls `PG.World.drawMinimap` top-right (150px).
  Draws touch controls if touch active.
- `PG.UI.drawMenu(ctx, game)` → title "BLOCKY BUCCANEERS", animated bobbing blocky ship, controls list,
  "Click / Tap / Enter to set sail", best score.
- `PG.UI.drawGameOver(ctx, game)` → "YOUR SHIP SANK!", score, gold, wave, best, "Click to sail again".
- `PG.UI.drawBanner(ctx, game, text, alpha)` → big centred text for wave announcements.
- `PG.Audio` → `{ init(), play(name), muted }` WebAudio synthesized blips (no files) for every event name above.
  `init()` must be called on first user gesture (main does that on click). `M` key toggles mute.
