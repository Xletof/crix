// THE SHOCK CAPTAIN'S STATE LANGUAGE — PHASE B.2.1, STRUCTURAL ONLY.
//
// IT ASSERTS NOTHING ABOUT TASTE. Whether the grawlix fits CRIX, whether the
// armour break feels satisfying, whether the rifle reads heavier — those are
// handset questions, and `smoke-champion` already froze one such opinion into a
// passing check ("the Champion is the slowest thing on the floor") and
// protected it all the way to a rejection.
//
// What it protects is the truth this layer can lose invisibly:
//   - a transition fires ONCE, on a real downward crossing, never on a heal,
//     never after death, and resets for a fresh actor
//   - the major-hit reaction rides the stagger threshold that already exists
//     rather than a second definition of "big"
//   - chip fire triggers no reaction at all
//   - nothing the actor starts outlives it, and there are no timers to leak
//   - the baseline combat cadence is UNCHANGED by this pass
//   - the debug triggers cannot reach a normal run
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function run(query, fn) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 8642 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE VOCABULARY IS ART, NOT TEXT ─────────────────────────────────────
const art = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const T = window.game.textures;
  const keys = ['glyph-break', 'glyph-rage', 'glyph-impact', 'glyph-alert'];
  const sizes = {};
  for (const k of keys) {
    if (!T.exists(k)) { sizes[k] = null; continue; }
    const i = T.get(k).getSourceImage();
    sizes[k] = [i.width, i.height];
  }
  // The grawlix must READ on any ground the game can put behind it, which means
  // an outline. Sample the texture's own corners: an un-outlined glyph has
  // transparent or bright edges where a dark surround should be.
  const probe = (k) => {
    const src = T.get(k).getSourceImage();
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const x = cv.getContext('2d');
    x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, src.width, src.height).data;
    let dark = 0, lit = 0, clear = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) { clear++; continue; }
      if (d[i] + d[i + 1] + d[i + 2] < 150) dark++; else lit++;
    }
    return { dark, lit, clear };
  };
  return { sizes, outline: probe('glyph-rage'), missing: keys.filter((k) => !T.exists(k)) };
}));
check(art.missing.length === 0, 'the four punctuation glyphs are authored textures',
  art.missing.join(','));
check(Object.values(art.sizes).every((s) => s && s[0] <= 200 && s[1] <= 60),
  'and each is small — punctuation, not a banner', JSON.stringify(art.sizes));
check(art.outline.dark > art.outline.lit * 0.4,
  'they carry a dark surround, so they read on a lit deck and in a blackout alike',
  `dark ${art.outline.dark} vs lit ${art.outline.lit}`);

// ── 2. TRANSITIONS: ONCE, ON A REAL CROSSING ───────────────────────────────
const trans = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  const seen = { armour: 0, low: 0 };
  gs.events.on('champion-armour-broken', () => { seen.armour++; });
  gs.events.on('champion-low-health', () => { seen.low++; });
  const glyphs = [];
  const real = c._spawnGlyph.bind(c);
  c._spawnGlyph = (k, o) => { glyphs.push(k); return real(k, o); };

  // (a) CHIP FIRE MUST PRODUCE NO REACTION AT ALL — not a glyph, not a stagger.
  const chipFloor = c.def.staggerMinDamage - 1;
  for (let i = 0; i < 10; i++) { c.damage(chipFloor * 0.2, { x: 5, y: 0 }); await wait(60); }
  const afterChip = { glyphs: glyphs.length, armour: seen.armour, low: seen.low };

  // (b) A MAJOR HIT. It must ride the SAME threshold the stagger does — one
  //     under it does nothing, one over it reacts.
  c._staggerCd = 0; c._impactGlyphCd = 0;
  c.damage(chipFloor, { x: 5, y: 0 });
  await wait(140);
  const justUnder = glyphs.length;
  c._staggerCd = 0; c._impactGlyphCd = 0;
  c.damage(c.def.staggerMinDamage * 1.2, { x: 5, y: 0 });
  await wait(200);
  const justOver = glyphs.length;

  // (c) the armour, broken once, and re-hit afterwards.
  // SMALL ENOUGH TO SURVIVE. The first version broke the layer with 4000 and
  // then hit for 900, which killed him — and every later step then measured a
  // corpse, which correctly reacts to nothing. Overkill past the layer reaches
  // the body scaled by `armourSpill`, so a modest over-commit breaks it and
  // costs almost no health.
  c.armour = 80;
  c.damage(200, null);
  await wait(200);
  c.damage(300, null);
  await wait(200);
  const afterArmour = { armour: seen.armour, broken: c.armourBroken, alive: c.alive };

  // (d) THE LOW-HEALTH LINE. Hover at it, cross it, heal back over it, cross
  //     again: exactly one event, and none of the others may produce one.
  // THE COUNTER IS CUMULATIVE and step (c)'s over-commit already crossed the
  // line on its way through — the first version of this check read that as a
  // spurious fire. Measure DELTAS from a baseline taken here.
  const base0 = seen.low;
  c.hp = c.hpMax * c.def.lowHealthFrac + 200;
  c._lowHealthFired = false;
  c.damage(50, null);                       // above the line — nothing
  const hover = seen.low - base0;
  c.damage(300, null);                      // across it — one
  await wait(120);
  const crossed = seen.low - base0;
  c.hp = c.hpMax * 0.8;                     // healed back over
  const healed = seen.low - base0;
  c.damage(c.hpMax * 0.6, null);            // across it again — still one
  await wait(120);
  const recross = seen.low - base0;

  // (e) nothing fires after death.
  c.damage(999999, null);
  await wait(400);
  const dead = { alive: c.alive, low: seen.low, armour: seen.armour,
    fx: c._reactFx.length, queue: c._punctQueue.length };
  c.damage(5000, null);
  await wait(150);
  const afterDeath = { low: seen.low, armour: seen.armour, glyphs: glyphs.length };

  // (f) a FRESH actor starts clean — the threshold is per-actor state, not a
  //     module flag that would leak into the next spawn or a replay.
  const c2 = gs.spawnChampion(gs.player.x + 300, gs.player.y - 200, 'captain');
  const fresh = { low: c2._lowHealthFired, broken: c2.armourBroken,
    armour: c2.armour === c2.armourMax, fx: c2._reactFx.length, queue: c2._punctQueue.length };
  return { afterChip, justUnder, justOver, afterArmour, hover, crossed, healed, recross,
    dead, afterDeath, fresh, glyphs };
}));
check(trans.afterChip.glyphs === 0 && trans.afterChip.armour === 0 && trans.afterChip.low === 0,
  'CHIP FIRE PRODUCES NO REACTION — punctuation cannot become weather',
  JSON.stringify(trans.afterChip));
check(trans.justUnder === 0,
  'a hit one point under the stagger threshold is not a major hit', `${trans.justUnder}`);
check(trans.justOver === 1,
  'and the major-hit reaction rides THAT threshold, not a second definition of big',
  `${trans.justOver}`);
check(trans.afterArmour.armour === 1 && trans.afterArmour.broken === true
  && trans.afterArmour.alive === true,
  'the armour transition fires exactly once, however many hits follow',
  JSON.stringify(trans.afterArmour));
check(trans.hover === 0, 'a hit that leaves him above the low-health line does nothing');
check(trans.crossed === 1, 'crossing it DOWNWARD fires once', `${trans.crossed}`);
check(trans.healed === 1, 'healing back over it fires nothing', `${trans.healed}`);
check(trans.recross === 1, 'and crossing again does not re-fire', `${trans.recross}`);
check(trans.dead.alive === false && trans.afterDeath.low === trans.dead.low
  && trans.afterDeath.armour === trans.dead.armour
  && trans.afterDeath.glyphs === trans.glyphs.length,
  'NOTHING REACTS AFTER DEATH', JSON.stringify(trans.afterDeath));
check(trans.dead.fx === 0 && trans.dead.queue === 0,
  'and death takes every attached effect and every queued glyph with it',
  `${trans.dead.fx} fx / ${trans.dead.queue} queued`);
check(trans.fresh.low === false && trans.fresh.broken === false && trans.fresh.armour
  && trans.fresh.fx === 0 && trans.fresh.queue === 0,
  'a fresh actor starts clean — the thresholds are per-actor, not module state',
  JSON.stringify(trans.fresh));

// ── 3. SEQUENCING, AND NO TIMERS ───────────────────────────────────────────
const seq = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  const timersBefore = gs.time.getActiveEvents?.()?.length ?? gs.time._active?.length ?? -1;
  const at = [];
  const real = c._spawnGlyph.bind(c);
  c._spawnGlyph = (k) => { at.push([k, Math.round(c._clock)]); return real(k); };
  // ONE COMMITMENT THAT DOES BOTH. A Super over-committed into a full-armour
  // Captain breaks the layer AND crosses the health line in the same call; two
  // glyphs in the same frame is effect soup and neither reads.
  // BIG ENOUGH TO DO BOTH, SMALL ENOUGH TO SURVIVE. The first version used
  // +4000 and killed him outright — at which point he correctly announces
  // nothing, `_clearReactions` drops the queued glyph, and the probe reported
  // an empty list as a sequencing failure. Overkill past the layer arrives at
  // the body scaled by `armourSpill`, so the size is derived, not guessed.
  c.hp = c.hpMax * c.def.lowHealthFrac + 150;
  const spill = 400;                     // -> 400 * armourSpill to the body
  c.damage(c.armour / c.def.armourTake + spill, null);
  // POLL ON THE GAME'S OWN CLOCK, NOT ON WALL TIME. The spacing is 340ms of
  // `_clock`, and `_clock` only advances when the scene steps — this harness
  // runs at ~9fps under load, so a flat 1400ms wall-clock wait reported the
  // second glyph as missing while it was simply not due yet. That is the
  // frame-rate-meter trap in a new costume.
  for (let i = 0; i < 60 && c._punctQueue.length; i++) await wait(100);
  const timersAfter = gs.time.getActiveEvents?.()?.length ?? gs.time._active?.length ?? -1;
  const gap = at.length >= 2 ? at[1][1] - at[0][1] : -1;
  return { at, gap, spacing: c.def.punctSpacingMs, timersBefore, timersAfter, alive: c.alive,
    fxLeft: c._reactFx.length, queueLeft: c._punctQueue.length };
}));
check(seq.at.length === 2,
  'one over-committed hit produces BOTH transitions', JSON.stringify(seq.at));
check(seq.gap >= seq.spacing * 0.9,
  'and they are SEQUENCED, never in the same frame',
  `${seq.gap}ms apart vs ${seq.spacing}ms floor`);
check(seq.timersAfter <= seq.timersBefore,
  'THE REACTION LAYER SCHEDULES NO TIMERS — the queue is data, so there is '
  + 'nothing to cancel on death', `${seq.timersBefore} -> ${seq.timersAfter}`);
check(seq.queueLeft === 0, 'and the queue drains', `${seq.queueLeft}`);
check(seq.alive === true, 'the sequencing probe survived its own commitment', `${seq.alive}`);

// A KILLING BLOW ANNOUNCES NOTHING. Discovered by the probe above killing its
// own subject: a corpse must not print "I am hurt", and the queued glyph from
// the armour breaking on the same hit must go with it.
const lethal = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  let glyphs = 0;
  const real = c._spawnGlyph.bind(c);
  c._spawnGlyph = (k, o) => { glyphs++; return real(k, o); };
  c.damage(999999, null);
  await wait(600);
  return { glyphs, alive: c.alive, fx: c._reactFx.length, queue: c._punctQueue.length };
}));
check(lethal.alive === false && lethal.glyphs === 0,
  'A KILLING BLOW ANNOUNCES NOTHING — a corpse does not say it is hurt',
  `${lethal.glyphs} glyphs`);
check(lethal.fx === 0 && lethal.queue === 0,
  'and takes the glyph queued by the same hit with it',
  `${lethal.fx} fx / ${lethal.queue} queued`);

// ── 4. CLEANUP, IN EVERY DIRECTION ─────────────────────────────────────────
const clean = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  c.armour = 60;
  c.damage(3000, null);                 // break + glyph + discharge + embers
  c.hp = c.hpMax * 0.2;
  await wait(500);
  const live = c._reactFx.slice();
  const peak = live.length;
  const before = gs.children.list.length;
  // Mid-flight teardown: the room goes while a glyph is still rising and the
  // ember Graphics is being redrawn every frame.
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  await wait(2400);
  return {
    peak,
    survivors: live.filter((o) => o.scene && o.active).length,
    ownedLeft: c._reactFx.length,
    inList: live.filter((o) => gs.children.list.includes(o)).length,
    listDelta: gs.children.list.length - before,
  };
}));
check(clean.peak > 0, 'the reaction layer really did attach objects', `${clean.peak}`);
check(clean.survivors === 0 && clean.inList === 0,
  'AND A ROOM CHANGE LEAVES NONE OF THEM BEHIND — an ember redrawn every frame '
  + 'from a dead actor is the worst thing this layer could leak',
  `${clean.survivors} alive, ${clean.inList} still in the display list`);
check(clean.ownedLeft === 0, 'the actor lets go of them too', `${clean.ownedLeft}`);

// ── 5. THE BASELINE IS UNCHANGED ───────────────────────────────────────────
//
// THE COMBATANT FOUNDATION IS FROZEN. This pass is visual/character
// communication and is explicitly NOT a phase system: a low-health Captain must
// fight exactly like a fresh one.
const base = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const { CHAMPION } = await import('/src/config.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const d = CHAMPION.captain;
  const measure = async (hurt) => {
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    const c = gs.spawnChampion(gs.player.x + 360, gs.player.y, 'captain');
    if (hurt) {
      c.armour = 40; c.damage(3000, null);
      c.hp = c.hpMax * 0.18;
      c._lowHealthFired = true;
    }
    const shots = [];
    const real = gs.fireCaptainBolt.bind(gs);
    gs.fireCaptainBolt = (cap, mx, my, a) => {
      shots.push({ t: performance.now(), speedOk: true,
        atMuzzle: Math.hypot(mx - cap.weaponSprite.x, my - cap.weaponSprite.y) });
      return real(cap, mx, my, a);
    };
    await wait(9000);
    gs.fireCaptainBolt = real;
    const gaps = shots.slice(1).map((s, i) => s.t - shots[i].t);
    const inBurst = gaps.filter((g) => g < d.fireEveryMs * 0.6);
    return {
      n: shots.length,
      speed: c.cfg.speed, dmg: c.cfg.bulletDamage,
      muzzle: shots.map((s) => s.atMuzzle),
      medIn: inBurst.length ? inBurst.sort((a, b) => a - b)[inBurst.length >> 1] : -1,
      rounds: d.burstRounds,
    };
  };
  const fresh = await measure(false);
  const hurt = await measure(true);
  return { fresh, hurt, cfg: { rounds: d.burstRounds, gap: d.burstGapMs, every: d.fireEveryMs } };
}));
check(base.fresh.n > 0 && base.hurt.n > 0,
  'both a fresh and a badly damaged Captain actually fired',
  `${base.fresh.n} / ${base.hurt.n}`);
check(base.hurt.speed === base.fresh.speed && base.hurt.dmg === base.fresh.dmg,
  'A DAMAGED CAPTAIN IS NOT A PHASE — same speed, same damage',
  `${base.hurt.speed}/${base.hurt.dmg} vs ${base.fresh.speed}/${base.fresh.dmg}`);
check(base.hurt.medIn > 0 && Math.abs(base.hurt.medIn - base.fresh.medIn) < base.cfg.gap,
  'and the same burst cadence — this pass did not touch the rifle clock',
  `median in-burst gap ${Math.round(base.fresh.medIn)}ms fresh vs ${Math.round(base.hurt.medIn)}ms hurt`);
check([...base.fresh.muzzle, ...base.hurt.muzzle].every((m) => m > 40),
  'the round still leaves the real weapon muzzle in both states');

// ── 6. THE DEBUG TRIGGERS CANNOT REACH A NORMAL RUN ────────────────────────
const off = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs._startWave(0);
  await wait(2200);
  // The buttons live on DebugScene and operate on "the living Champion". With
  // no flag there is none, so every one of them is a no-op — which is the same
  // absence that keeps the actor out of production, not a second guard.
  const dbg = window.game.scene.getScene('Debug');
  const before = gs.enemies.getChildren().map((e) => e.hp);
  const champ = dbg?._champ ? dbg._champ() : 'no-scene';
  return {
    champions: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length,
    champ: champ === null ? 'null' : champ === 'no-scene' ? 'no-scene' : 'FOUND',
    hpUnchanged: before.length > 0,
  };
}));
check(off.champions === 0 && (off.champ === 'null' || off.champ === 'no-scene'),
  'without the flag there is no Champion, so every state trigger is a no-op',
  `${off.champions} champions, _champ() -> ${off.champ}`);

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — transitions fire once, the body carries the state, nothing leaks, the baseline is untouched`);
