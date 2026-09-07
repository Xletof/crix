// DIAG — DOES THE CAMERA UNDERSTAND WHERE THE FIGHT IS? (Camera Phase 2C)
//
//   node tests/diag-camera-aim.mjs
//
// CRIX's ordinary loop is not "hold an aim stick on one target". The player
// taps fire and the shot auto-aims at whatever is closest, so the resolved
// bearing can jump between consecutive shots — and the camera must read the
// SECTOR the fight is in without chasing target selection. That is a claim
// about a signal, so this measures the signal (recent combat vector,
// confidence, the lead it produces) as well as what lands on screen.
//
// FED THROUGH `noteShot`, WITH REAL DIRECTIONS AND REAL TIMING. That is the
// exact entry point the two committed-fire handlers call, and by then the input
// device no longer exists — which is the point. The cadence is the game's own:
// a 120ms pistol cooldown, three rounds, then a 520ms reload, so sustained fire
// is a shot roughly every 170-200ms.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
});
await page.waitForTimeout(1400);

const quiet = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999; gs.player.hp = gs.player.hpMax = 1e9;
  gs.arenaActive = false;
  for (const e of gs.enemies.getChildren().slice()) e.destroy();
  gs.tweens.killTweensOf(gs.time); gs.tweens.killTweensOf(gs.physics.world);
  gs.time.timeScale = 1; gs.physics.world.timeScale = 1;
  if (gs._cameraPunchTween) { gs._cameraPunchTween.stop(); gs._cameraPunchTween = null; }
  gs.cameras.main.setZoom(1);
});

const run = (script) => page.evaluate(async (src) => {
  const gs = window.game.scene.getScene('Game');
  const { PLAYER } = await import('/src/config.js');
  const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
  const CAM = d.cfg;                       // the LIVE tuning object
  const H = 16;
  const step = (ms) => { for (let i = 0; i < Math.round(ms / H); i++) d.update(H); };
  const at = (x, y) => { p.setPosition(x, y); p.setVelocity(0, 0); };
  const move = (dx, dy) => { p._moveTargetX = dx * PLAYER.speed; p._moveTargetY = dy * PLAYER.speed; };
  const reset = (x, y) => {
    at(x, y); move(0, 0);
    p.superAiming = false; p.meleeAiming = false; p.resetMeleeCombo();
    d.reset(x, y); d._fvX = 0; d._fvY = 0; d._fvW = 0; d._aimX = 0; d._aimY = 0;
    step(400);
  };
  const E = 0, W = Math.PI, N = -Math.PI / 2, S = Math.PI / 2;
  // A tap, then the game's own gap to the next one.
  const shoot = (ang, gapMs = 180) => { d.noteShot(ang); step(gapMs); };
  const conf = () => Math.hypot(d._aimX, d._aimY);
  const sx = () => (p.x - c.scrollX) * c.zoom + c.x;
  const sy = () => (p.y - c.scrollY) * c.zoom + c.y;
  const aheadE = () => 720 - sx();
  const fn = new Function('gs','PLAYER','c','d','p','CAM','step','at','move','reset','shoot','conf','sx','sy','aheadE','E','W','N','S',
    `return (async () => { ${src} })()`);
  return fn(gs, PLAYER, c, d, p, CAM, step, at, move, reset, shoot, conf, sx, sy, aheadE, E, W, N, S);
}, script);

const R = (n, d = 0) => Number(n).toFixed(d);
console.log('confidence = |combat vector| (0..1).  aheadE = viewport px east of the player.');
console.log('Neutral standing: confidence 0, aheadE 360.\n');

// A — one isolated shot must barely register.
await quiet();
let r = await run(`reset(800,700); const before=conf(); shoot(E,0); step(200);
  return { before, after: conf(), x: sx(), aheadE: aheadE() };`);
console.log(`A  isolated shot        confidence ${R(r.before,2)} -> ${R(r.after,2)}   aheadE ${R(r.aheadE)}  (neutral 360)`);

// B — repeated taps in one sector.
await quiet();
r = await run(`reset(800,700);
  const trail=[]; for (let i=0;i<6;i++){ shoot(E); trail.push(+conf().toFixed(2)); }
  return { trail, conf: conf(), aheadE: aheadE(), x: sx() };`);
console.log(`B  six taps east        confidence by shot ${r.trail.join(' ')}   aheadE ${R(r.aheadE)}`);

// C — THE REAL CASE: dodging west while firing east.
await quiet();
r = await run(`reset(800,700); move(-1,0); step(900);
  const moveOnly = { x: sx(), aheadE: aheadE() };
  for (let i=0;i<6;i++) shoot(E);
  return { moveOnly, x: sx(), aheadE: aheadE(), conf: conf(), lead: d._leadX };`);
console.log(`C  move W + fire E      aheadE ${R(r.moveOnly.aheadE)} -> ${R(r.aheadE)}   confidence ${R(r.conf,2)}  movementLead ${R(r.lead)}`);

// D — reinforcing: same direction. Must not stack into an immoderate lead.
await quiet();
r = await run(`reset(560,700); move(1,0); step(900);
  const moveOnly = { aheadE: aheadE() };
  for (let i=0;i<6;i++) shoot(E);
  return { moveOnly, aheadE: aheadE(), conf: conf() };`);
console.log(`D  move E + fire E      aheadE ${R(r.moveOnly.aheadE)} -> ${R(r.aheadE)}   confidence ${R(r.conf,2)}  (ability preview reaches 560)`);

// E — alternating targets must cancel, not ping-pong.
await quiet();
r = await run(`reset(800,700);
  const xs=[]; for (let i=0;i<8;i++){ shoot(i%2?W:E); xs.push(Math.round(sx())); }
  const span = Math.max(...xs)-Math.min(...xs);
  return { conf: conf(), xs, span, aheadE: aheadE() };`);
console.log(`E  alternating E/W      confidence ${R(r.conf,2)}   player screen x swing across 8 shots: ${R(r.span)}px  ${r.xs.join(' ')}`);

// F — sector migration.
await quiet();
r = await run(`reset(800,700);
  for (let i=0;i<5;i++) shoot(E);
  const east = { conf: conf(), vx: d._aimX };
  const marks=[];
  for (let i=0;i<6;i++){ shoot(W); marks.push(+d._aimX.toFixed(2)); }
  return { east, marks, west: d._aimX, conf: conf() };`);
console.log(`F  E x5 then W x6       combat vector x by west shot: ${r.marks.join(' ')}   (east was ${R(r.east.vx,2)})`);

// G — enemies all round: shots scattered over many bearings.
await quiet();
r = await run(`reset(800,700);
  const B=[0,1.1,2.3,3.4,4.6,5.7,0.6,2.9];
  for (const b of B) shoot(b);
  return { conf: conf(), x: sx() };`);
console.log(`G  surrounded (8 bearings) confidence ${R(r.conf,2)}   player screen x ${R(r.x)}  (neutral 360)`);

// H — release after firing stops.
await quiet();
r = await run(`reset(800,700);
  for (let i=0;i<6;i++) shoot(E);
  const peak = conf(); const marks=[];
  for (const ms of [500,500,500,500]) { step(ms); marks.push(+conf().toFixed(2)); }
  return { peak, marks, x: sx() };`);
console.log(`H  stop firing          confidence ${R(r.peak,2)} -> ${r.marks.join(' -> ')} at +0.5/1.0/1.5/2.0s   settled x ${R(r.x)}`);

// I — ability priority, and no stale snap when it ends.
await quiet();
r = await run(`reset(800,700);
  for (let i=0;i<6;i++) shoot(E);
  const combat = { x: sx(), conf: conf() };
  p.superCharge = 99; p.setSuperAimInput({ x: Math.cos(W), y: Math.sin(W), force: 1 });
  step(400);
  const ability = { x: sx(), w: d._abW, conf: conf() };
  p.superAiming = false;
  const xs=[]; for (let i=0;i<12;i++){ step(60); xs.push(Math.round(sx())); }
  let maxJump = 0;
  for (let i=1;i<xs.length;i++) maxJump = Math.max(maxJump, Math.abs(xs[i]-xs[i-1]));
  step(1200);
  return { combat, ability, maxJump, settled: sx(), conf: conf() };`);
console.log(`I  fire E then aim W     combat x ${R(r.combat.x)} -> ability x ${R(r.ability.x)} (abW ${R(r.ability.w,2)})`);
console.log(`   after ability ends    biggest single 60ms jump ${R(r.maxJump)}px, settles at ${R(r.settled)}  confidence ${R(r.conf,2)}`);

// J — south safety while firing south.
console.log('\n══ §11-J SOUTH SAFETY — repeated fire south/SE/SW at the wall ══');
for (const id of ['detention', 'corridor', 'hangar', 'vader']) {
  await page.evaluate(async (rid) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    gs.loadRoom(ROOMS.find((r) => r.id === rid));
  }, id);
  await page.waitForTimeout(900);
  await quiet();
  const j = await run(`
    const { w, h } = gs.roomSpec.bounds;
    const px = w/2, py = h - PLAYER.radius;
    reset(px, py); move(1, 0);
    const before = sy();
    for (let i=0;i<10;i++){ d.noteShot([S, S+0.6, S-0.6][i%3]); at(px,py); step(180); }
    at(px, py); for (let i=0;i<40;i++){ at(px,py); d.update(16); }
    return { before, after: sy(), conf: conf() };`);
  const bad = j.after >= 926;
  console.log(`  ${id.padEnd(10)} player screen y ${R(j.before)} -> ${R(j.after)}   confidence ${R(j.conf,2)}${bad ? '   ⚠ BELOW CONTROL EDGE 926' : '   (control edge 926)'}`);
}

await browser.close();
