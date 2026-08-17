// The semantic-recognition sheet: every live Vader attack, photographed on the
// beats that carry its meaning, LABELLED and UNLABELLED.
//
// ── The question this exists to answer ────────────────────────────────────
//
// Not "did the effect fire" — `smoke-boss-moves` and `smoke-readability`
// already gate that, and they gate it at the registry so a new move cannot
// skip. This asks the one thing no assertion can: with the attack-name banner
// hidden, can a human tell which attack is happening from his motion, the
// telegraph and the FX alone? A move that only reads because FORCE PULL is
// printed across the top of the screen has communicated nothing.
//
// Run it twice, and the second run is the real review:
//
//   node tests/shot-vader-language.mjs                 -> out/vlang/labelled/
//   node tests/shot-vader-language.mjs --nonames       -> out/vlang/unlabelled/
//   node tests/shot-vader-language.mjs --only charge   -> one move
//
// ── Why it covers SEVEN moves and shot-boss-moves covers four ─────────────
//
// `shot-boss-moves.mjs` photographs the four scripted rotation moves, because
// that is what `_castBossMove` can be handed. But three of his attacks — SABER
// COMBO, CHARGE and OVERHEAD SLAM — are the ones a player meets most, and two
// of them live in his STATE MACHINE where there is no cast function to call.
// They were therefore the least-photographed and least-reviewed attacks in the
// fight, which is a large part of why CHARGE and SABER THROW ended up drawing
// nearly the same lane. The state-machine pair are driven here through the real
// path: `pickAttack` is pinned and his cooldown released, so his own AI enters
// the state exactly as it does in play. Nothing is simulated.
//
// ── Five ways this harness could lie, and the guard for each ──────────────
//
// Every one of these has actually happened in this repo (tests/README.md, and
// the "photograph the subject on purpose" note in particular — four consecutive
// attempts at a Vader still came back with no Vader in them). So each is a hard
// failure here rather than a warning:
//
//   1. NO BOSS. `spawnBoss()` called without coordinates produced no boss, the
//      move was refused, and an empty deck photographed as a clean pass.
//   2. A REFUSED CAST reads exactly like a failed one. `_castBossMove` returns
//      null while another attack owns him.
//   3. THE WRONG MOVE. His rotation can start something during the camera
//      settle; the shutter then opens on an attack nobody asked for.
//   4. FRAMING. The camera follows the PLAYER, so an explicitly staged subject
//      is silently re-centred on the next frame. Checked against the camera's
//      own worldView at the instant of the shutter.
//   5. OFF-BEAT. `scene.update` keeps running when tweens and physics are
//      frozen, so a zone frozen mid-windup sails on and destroys itself before
//      the shutter. Freezing happens on a `postupdate` frame, and with
//      `scene.pause()` — which stops update and keeps rendering.
//
// Writes to tests/out/vlang/ (gitignored).

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const NONAMES = argv.includes('--nonames');
const ONLY = (() => {
  const i = argv.indexOf('--only');
  return i >= 0 ? argv[i + 1] : null;
})();

const PAGE_URL = `http://localhost:5173/?nodlg=1&nofreeze=1${NONAMES ? '&nonames=1' : ''}`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = new URL(`./out/vlang/${NONAMES ? 'unlabelled' : 'labelled'}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

// ── The moves, and how each one is started ────────────────────────────────
//
// `kind: 'script'` goes through `_castBossMove`, the same entry the rotation
// clock and the two reactive events use. `kind: 'state'` pins `pickAttack` and
// releases his cooldown, so his own AI walks into the state on its own frame.
//
// `marks` are where the shutter opens, expressed as a phase plus a fraction
// through it, never as a wall-clock delay — the headless loop runs at ~20 FPS
// and a fixed sleep lands in the wrong beat. Four each, and the four are the
// same four claims for every move: it is starting, it is about to commit, it is
// committing, it is over and he is open.
const MOVES = [
  { id: 'sabercombo',   kind: 'script', label: 'SABER COMBO' },
  { id: 'saberthrow',   kind: 'script', label: 'SABER THROW' },
  { id: 'forcepull',    kind: 'script', label: 'FORCE PULL' },
  { id: 'forcepush',    kind: 'script', label: 'FORCE PUSH' },
  { id: 'vanishslash',  kind: 'script', label: 'VANISH' },
  { id: 'charge',       kind: 'state',  label: 'CHARGE',        state: 'charge_windup' },
  { id: 'overheadslam', kind: 'state',  label: 'OVERHEAD SLAM', state: 'slam_windup' },
];

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => fail(`page error: ${e}`));

await page.goto(PAGE_URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.sector = 15;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 360, gs.player.y, { encounter: 3 });
    await new Promise((r) => setTimeout(r, 900));
  }
  // LIGHTS OUT is on the encounter-3 ladder and turns every frame into a black
  // rectangle. Zeroing the clock does not lower a blackout already raised.
  gs.events.emit('set-darkness', false);
  gs.boss._blackoutEvery = 0;
  // God mode for the PHOTOS only: without it the move connects, the full-screen
  // hurt vignette goes up, and every still is a flat red rectangle with the
  // game invisible underneath.
  const dbg = await import('/src/systems/debug.js');
  dbg.setGodMode(true);
});

// GUARD 1 — no boss, no photographs. An empty deck used to pass as clean.
const bossOk = await page.evaluate(() => {
  const b = window.game.scene.getScene('Game').boss;
  return !!(b && b.alive && b.active);
});
if (!bossOk) fail('Vader did not spawn — every capture below would be an empty deck');

/** Reset the world to a clean two-actor stage with the camera already settled. */
const stage = async (gapPx = 250) => {
  await page.evaluate((gap) => {
    const gs = window.game.scene.getScene('Game');
    if (gs.scene.isPaused()) gs.scene.resume();
    gs.tweens.timeScale = 1;
    gs.physics.world.resume();
    const b = gs.boss;
    const w = gs.physics.world.bounds;
    // A still of the move, not of a firefight.
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs.enemyBullets?.getChildren().forEach((x) => x.kill?.());
    gs.bullets?.getChildren().forEach((x) => x.kill?.());
    // Put his state machine back to idle BEFORE clearing zones: silencing the
    // cooldown does not cancel a windup already entered, and one left running
    // through the settle puts a second lane on the floor of the next photo —
    // the exact failure being photographed, manufactured by the rig.
    b._activeMove?.cancel?.();
    b._activeMove = null;
    b._performing = false;
    b.state = 'idle';
    b._moveAnim = null;
    gs.clearTelegraphs();
    b._afterimageEvery = 0; b._reflectEvery = 0; b._disarmEvery = 0;
    b.cooldown = 1e9;              // his own attack clock, silenced for the PHOTO only
    b._comboT = 1e9;
    gs.lives = 9999;
    b.setPosition(w.width / 2 + gap / 2, w.height / 2 - 40);
    b.body?.setVelocity(0, 0);
    b.setAlpha(1);
    gs.player.alive = true;
    gs.player.hp = gs.player.hpMax;
    gs.player.setPosition(w.width / 2 - gap / 2, w.height / 2 + 40);
    gs.player.body?.setVelocity(0, 0);
  }, gapPx);

  // ── THE RIG OWNS THE CAMERA, EXPLICITLY ───────────────────────────────
  //
  // The camera follows the PLAYER, and three of these attacks move the player:
  // FORCE PUSH throws them 900px/s, FORCE PULL drags them in, VANISH puts him
  // behind them. Measured on the run that first caught this, FORCE PUSH ended
  // with the player at x=528 and the view's right edge at 924 — with Vader at
  // 928. He was genuinely four pixels off the frame, and every recovery still
  // of that move would have been a photograph of the floor he had just left.
  //
  // Waiting longer cannot fix that, because the follow re-asserts on the next
  // frame whatever the rig set. So the rig takes the camera and keeps it, on a
  // postupdate hook anchored near Vader — he is the subject. Nothing about the
  // viewport, the resolution or the scale changes, so these are still ordinary
  // portrait frames; only the anchor is his body rather than the player's.
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const cam = gs.cameras.main;
    if (window.__vlCam) return;
    cam.stopFollow();
    window.__vlCam = () => {
      const b = gs.boss, p = gs.player;
      if (!b?.active) return;
      // Anchored 30% of the way toward the player, so both are usually in shot
      // and Vader can never be the one that leaves.
      cam.centerOn(b.x + (p.x - b.x) * 0.3, b.y + (p.y - b.y) * 0.3);
    };
    gs.events.on('postupdate', window.__vlCam);
  });

  // ── SETTLE UNTIL IT IS ACTUALLY SETTLED ───────────────────────────────
  //
  // Even with the camera owned, his IDLE branch walks him toward standoff at
  // 165px/s while the rig is waiting — up to 148px of drift across a 900ms
  // sleep, which is enough to change what a staged distance means. Held with
  // the game's OWN ownership gate rather than fought, and verified rather than
  // assumed. VANISH failed this guard once inside a full run and passed 4/4
  // standalone immediately after, which is the signature of an instrument.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForTimeout(attempt === 0 ? 900 : 450);
    const framed = await page.evaluate((gap) => {
      const gs = window.game.scene.getScene('Game');
      const b = gs.boss;
      const w = gs.physics.world.bounds;
      b.setPosition(w.width / 2 + gap / 2, w.height / 2 - 40);
      b.body?.setVelocity(0, 0);
      gs.player.setPosition(w.width / 2 - gap / 2, w.height / 2 + 40);
      gs.player.body?.setVelocity(0, 0);
      // The game's own gate, so his AI yields instead of being fought.
      b._performing = true;
      const v = gs.cameras.main.worldView;
      const m = 60;    // he must be comfortably inside, not clipping an edge
      return {
        ok: b.x > v.x + m && b.x < v.right - m && b.y > v.y + m && b.y < v.bottom - m,
        where: `boss(${b.x | 0},${b.y | 0}) view(${v.x | 0},${v.y | 0}..${v.right | 0},${v.bottom | 0})`
          + ` zoom ${gs.cameras.main.zoom.toFixed(3)}`,
      };
    }, gapPx);
    if (framed.ok) break;
    if (attempt === 3) fail(`camera never settled on the staged pair — ${framed.where}`);
  }

  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.boss.state = 'idle';
    gs.boss._performing = false;     // released the instant before the cast
    gs.boss.cooldown = 1e9;
    gs.boss._comboT = 1e9;
    gs.clearTelegraphs();
  });
};

/**
 * Start a move and freeze on the frame a named mark is reached.
 *
 * Returns the guard report from inside the page, so every failure mode is
 * decided against the runtime rather than against a delay that elapsed.
 */
const shootAt = async (move, mark, name) => {
  await stage();
  const report = await page.evaluate(([m, mk]) => {
    const gs = window.game.scene.getScene('Game');
    const b = gs.boss;
    window.__vl = { frozen: false, err: null, seen: null, framed: null };

    b._activeMove = null;
    b._performing = false;
    b.state = 'idle';

    // ── Start it, the way the game starts it ────────────────────────────
    if (m.kind === 'script') {
      const h = gs._castBossMove(b, m.id);
      // GUARD 2 — a refused cast returns null and reads exactly like a move
      // that ran and did nothing. Every probe downstream would read zero.
      if (!h) return { ok: false, why: `cast refused for ${m.id}` };
      // GUARD 3 — the wrong move is worse than no move: it photographs
      // beautifully and is evidence about something nobody asked about.
      if (h.move?.id !== m.id) return { ok: false, why: `asked ${m.id}, got ${h.move?.id}` };
    } else {
      // The state-machine pair. Pin his own selection and release the clock;
      // his AI enters the state on its own frame, through the real path.
      b.pickAttack = () => m.state;
      b.cooldown = 0;
    }

    const order = ['anticipate', 'act', 'impact', 'recover', 'done'];
    const onFrame = () => {
      if (window.__vl.frozen) return;
      let ready = false;

      if (m.kind === 'script') {
        const h = b._activeMove;
        if (!h) { window.__vl.err = `move ended before mark "${mk.name}"`; return; }
        window.__vl.seen = h.move?.id || null;
        if (mk.zone != null) {
          // A fraction through the WIND-UP, read off the zone's own clock —
          // the only honest way to say "just before he commits", since the
          // headless frame rate makes any wall-clock fraction a lottery.
          const tel = gs._telegraphs.find((z) => !z.dead && z.owner === b);
          // `committed` counts as satisfying a late mark, and that is not a
          // convenience — it is the fix for a real false failure. A 420ms
          // wind-up sampled at ~50ms a frame yields ONE frame above 0.9, and
          // whether it exists at all depends on the machine: the probe caught
          // 0.75 then 0.95, the suite run caught 0.75 then 1.17 and reported
          // "never reached the mark" on a build that was fine. A threshold that
          // depends on the frame rate is measuring the frame rate — the third
          // instrument in this repo to learn that. The commit frame IS
          // "immediately before commitment", so accepting it removes the race
          // in both directions instead of moving the number.
          ready = !!tel && (tel.elapsed / tel.windupMs >= mk.zone || tel.committed);
        } else {
          ready = order.indexOf(h.phase) >= order.indexOf(mk.phase);
        }
      } else {
        window.__vl.seen = b.state;
        if (mk.zone != null) {
          const tel = gs._telegraphs.find((z) => !z.dead && z.owner === b);
          // `committed` counts as satisfying a late mark, and that is not a
          // convenience — it is the fix for a real false failure. A 420ms
          // wind-up sampled at ~50ms a frame yields ONE frame above 0.9, and
          // whether it exists at all depends on the machine: the probe caught
          // 0.75 then 0.95, the suite run caught 0.75 then 1.17 and reported
          // "never reached the mark" on a build that was fine. A threshold that
          // depends on the frame rate is measuring the frame rate — the third
          // instrument in this repo to learn that. The commit frame IS
          // "immediately before commitment", so accepting it removes the race
          // in both directions instead of moving the number.
          ready = !!tel && (tel.elapsed / tel.windupMs >= mk.zone || tel.committed);
        } else {
          ready = mk.states.includes(b.state);
        }
      }
      if (!ready) return;
      // ── DO NOT PHOTOGRAPH THE COMMIT FLASH AND CALL IT THE RELEASE ─────
      //
      // The first full sheet caught SABER THROW and CHARGE at the identical
      // frame — the telegraph's own commit bloom, which is generic across every
      // lane zone in the game and fires exactly as `act` begins. Two moves that
      // look the same in the evidence because the evidence was sampled on the
      // one frame they share is a false negative about the moves, and it would
      // have been read as a false positive about the harness. Hold a few frames
      // so the release beat is the MOVE doing its thing.
      if (mk.after && (window.__vl.held = (window.__vl.held || 0) + 1) <= mk.after) return;

      window.__vl.frozen = true;
      // GUARD 4 — the camera follows the player and will silently re-centre.
      // Recorded at the instant of the shutter, not before it.
      const v = gs.cameras.main.worldView;
      window.__vl.framed = b.x > v.x && b.x < v.right && b.y > v.y && b.y < v.bottom;
      window.__vl.where = `boss(${b.x | 0},${b.y | 0}) player(${gs.player.x | 0},${gs.player.y | 0})`
        + ` view(${v.x | 0},${v.y | 0}..${v.right | 0},${v.bottom | 0}) zoom ${gs.cameras.main.zoom.toFixed(3)}`;
      gs.tweens.timeScale = 0;
      gs.physics.world.pause();
      gs.events.off('postupdate', onFrame);
      // GUARD 5 — pause(), not tweens.timeScale=0. Freezing tweens and physics
      // does NOT stop scene.update, so telegraphs tick on and destroy
      // themselves in the ~300ms before the shutter lands.
      gs.scene.pause();
    };
    gs.events.on('postupdate', onFrame);
    return { ok: true };
  }, [move, mark]);

  if (!report.ok) fail(`${move.id} @ ${mark.name}: ${report.why}`);

  await page.waitForFunction(() => window.__vl?.frozen === true, null, { timeout: 20000 })
    .catch(async () => {
      const err = await page.evaluate(() => window.__vl?.err);
      fail(`${move.id} @ ${mark.name}: never reached the mark${err ? ` (${err})` : ''}`);
    });

  const framed = await page.evaluate(() => window.__vl.framed);
  if (!framed) {
    const where = await page.evaluate(() => window.__vl.where);
    fail(`${move.id} @ ${mark.name}: Vader was outside the camera at the shutter — ${where}`);
  }

  await page.screenshot({ path: `${OUT}${name}.png` });

  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.scene.resume();
    gs.tweens.timeScale = 1;
    gs.physics.world.resume();
    gs.boss._activeMove?.cancel?.();
    gs.boss._activeMove = null;
    gs.boss._performing = false;
    gs.boss.state = 'idle';
    // Un-pin the state-machine override so the next move is not hijacked.
    delete gs.boss.pickAttack;
  });
  await page.waitForTimeout(250);
};

/**
 * One CONTINUOUS performance, sampled without freezing anything.
 *
 * The frozen stills above are crisp and deterministic and each one is a
 * separate cast, so a strip of them is four photographs of four performances.
 * The central claim of this gate is about MOTION — which way a thing is
 * travelling — and motion cannot be assembled out of unrelated frames. This
 * runs the move once, at real speed, and shoots straight through it.
 */
const sequence = async (move) => {
  await stage();
  const started = await page.evaluate((m) => {
    const gs = window.game.scene.getScene('Game');
    const b = gs.boss;
    b._activeMove = null; b._performing = false; b.state = 'idle';
    if (m.kind === 'script') {
      const h = gs._castBossMove(b, m.id);
      if (!h) return { ok: false, why: `cast refused for ${m.id}` };
      if (h.move?.id !== m.id) return { ok: false, why: `asked ${m.id}, got ${h.move?.id}` };
    } else {
      b.pickAttack = () => m.state;
      b.cooldown = 0;
    }
    return { ok: true };
  }, move);
  if (!started.ok) fail(`${move.id} sequence: ${started.why}`);

  for (let i = 0; i < 8; i++) {
    await page.screenshot({ path: `${OUT}seq-${move.id}-${String(i).padStart(2, '0')}.png` });
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.boss._activeMove?.cancel?.();
    gs.boss._activeMove = null;
    gs.boss._performing = false;
    gs.boss.state = 'idle';
    delete gs.boss.pickAttack;
  });
  await page.waitForTimeout(250);
};

// The four claims, asked identically of every move.
const marksFor = (m) => ([
  { name: '1-early',  zone: 0.25 },
  { name: '2-late',   zone: 0.72 },
  { name: '3-release', after: 3, ...(m.kind === 'script'
    ? { phase: 'act' }
    : { states: ['charging', 'slam', 'idle'] }) },
  { name: '4-after',  ...(m.kind === 'script'
    ? { phase: 'recover' }
    : { states: ['idle'] }) },
]);

const list = ONLY ? MOVES.filter((m) => m.id === ONLY) : MOVES;
if (!list.length) fail(`no such move "${ONLY}"`);

for (const m of list) {
  for (const mk of marksFor(m)) {
    await shootAt(m, mk, `${m.id}-${mk.name}`);
  }
  await sequence(m);
  console.log(`  ${m.id}  4 marks + 8-frame sequence`);
}

await browser.close();
console.log(`\n${NONAMES ? 'UNLABELLED' : 'labelled'} sheet written to ${OUT}`);
