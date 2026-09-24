// SHOCK CAPTAIN — VISUAL CLOSEOUT. STRUCTURAL, AND OPINIONLESS ABOUT TASTE.
//
// Three presentation goals, and this file proves only what is OBJECTIVELY
// TRUE about them. Whether the step reads as iron and whether the field reads
// as premium is the handset's call and nothing here asserts it.
//
// What it CAN prove, and what fails on the build this replaces:
//
//   1. THE STEP NO LONGER SPEAKS IN EXPANDING ROUND SHAPES. The "water drop /
//      splash" verdict had one cause: three soft round shapes at the boots —
//      two filled circles growing in the preload, a 100px ellipse opening to
//      150 in the thrust, and two nested ellipses opening 26 -> 60 in the
//      catch. This greps the three methods, on the same rule that deleted the
//      camera's `teleports` flag and the rifle's `_predict`: a shape that is
//      supposed to be GONE is checked for by absence, not described in a
//      comment. It fails on f710abb.
//   2. THE DEVICE HAS A REAL MIDDLE. Three authored frames, all distinct, and
//      the ladder is climbed during arming and stepped back DOWN at shutdown.
//      "A texture is set" passed on the two-frame build; "frame 1 is ever the
//      one on screen" does not.
//   3. THE INTENT SIGN IS A PROMISE WITH A LIFETIME. Up on commitment, gone on
//      the frame the device becomes a real object, never up otherwise, and it
//      tracks the body rather than the spot he was standing on.
//
// AND THE BOUNDARY IS STILL THE RADIUS. This pass put a moving element ON the
// perimeter, so the one thing it could have broken is re-checked here rather
// than left to the adjacent suite.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

// ── 1. SOURCE LAW ──────────────────────────────────────────────────────────
// Read the module the browser reads, so this cannot pass against a stale file.
const raw = await (await fetch(BASE + 'src/entities/ShockCaptain.js')).text();
// STRIP THE PROSE BEFORE GREPPING THE CODE. This file documents the shapes it
// removed and the negative reference it must not copy, by name — so a check
// reading the raw text finds the very literals it is asserting are gone and
// fails on a correct build. The comments are the record; the code is the claim.
const decomment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const src = decomment(raw);
const method = (name) => {
  const i = src.indexOf(`  ${name}(`);
  if (i < 0) return '';
  // Walk to the matching brace of the method body.
  let d = 0, started = false;
  for (let k = i; k < src.length; k++) {
    if (src[k] === '{') { d++; started = true; }
    else if (src[k] === '}') { d--; if (started && d === 0) return src.slice(i, k + 1); }
  }
  return src.slice(i);
};
const STEP_METHODS = ['_stepPreload', '_stepThrust', '_stepCatchFx', '_stepEcho', '_suitFlash', '_jet', '_stepRing'];
const stepFx = STEP_METHODS.map(method);
const M = Object.fromEntries(STEP_METHODS.map((n, i) => [n, stepFx[i]]));
check(stepFx.every((m) => m.length > 20), 'the seven step effect methods were found to read',
  STEP_METHODS.map((n, i) => `${n}:${stepFx[i].length}`).join(' '));
check(stepFx.every((m) => !m.includes('fillCircle')),
  'no step effect fills a circle at the boots — the droplet is gone, not dimmed');
check(stepFx.every((m) => !m.includes('strokeEllipse') && !m.includes('.arc(')),
  'no ellipse or arc primitive anywhere in the step — the ring is his own, drawn as points');
check(!stepFx.some((m) => m.includes('burstDir')) && !stepFx.some((m) => m.includes('_bolt(')),
  'no radial particle fan and no jittered `_bolt` squiggle anywhere in the step');
// ── v5: THE RING IS THE ONE PLACE A STROKE MAY LIVE ─────────────────────
// v3 was hairlines and read as scribble; v4 banned every line. v5 gives the
// move to the Captain's own ground ring, which is a stroked shape by nature —
// so strokes are allowed in `_stepRing` ALONE, never thinner than the stock
// ring's own 2.5, and nowhere else in the step.
const nonRing = stepFx.filter((_, i) => STEP_METHODS[i] !== '_stepRing');
check(nonRing.every((m) => !m.includes('lineBetween') && !m.includes('lineStyle(')),
  'no step effect outside the ring overlay draws a line');
{
  const widths = [...M._stepRing.matchAll(/stroke\(pts,\s*([0-9.]+)/g)].map((x) => +x[1]);
  check(widths.length >= 3 && widths.every((w) => w >= 2.5) && !M._stepRing.includes('lineBetween'),
    'the ring overlay strokes nothing thinner than the stock ring, and draws no loose lines',
    JSON.stringify(widths));
}
check(!src.includes('_stepStreak('), 'the v3 dashed body streaks are still gone');
const fillers = STEP_METHODS.filter((n) => /fillPoints|fillPath|fillTriangle/.test(M[n]));
check(JSON.stringify(fillers.sort()) === JSON.stringify(['_jet', '_stepRing']),
  'polygon fills live only in the thrust kite and the ring overlay', fillers.join(','));
// ── ONE HERO: the catch carries the only suit flash ─────────────────────
check((src.match(/this\._suitFlash\(/g) || []).length === 1 && M._stepRing.includes('_suitFlash(')
  && !M._stepThrust.includes('_suitFlash(') && !M._stepCatchFx.includes('_suitFlash('),
  'there is exactly ONE suit flash in the move, and it belongs to the ring reform at the catch');
check(/_jet\([^)]*\bang\b/.test(M._stepCatchFx) && !/_jet\([^)]*\bback\b/.test(M._stepCatchFx),
  'the catch counter-thrusts FORWARD along the travel — nothing is put on the floor');
check(/_jet\([^)]*\bback\b/.test(M._stepThrust),
  'the push-off thrusts BACK down the travel');
check(!/for \(let i = 0; i < 4;/.test(M._stepCatchFx) && !M._stepCatchFx.includes('Math.PI / 4 +'),
  'the four converging diagonal brackets are still gone');
check((src.match(/this\._stepEcho\(\)/g) || []).length === 1 && M._stepEcho.includes('setCrop')
  && (M._stepEcho.match(/\{ y0:/g) || []).length === 2,
  'ONE partial echo per step, two bands of his frame with the torso missing');
check(stepFx.every((m) => !m.includes('this.def.color')) && src.includes('static get STEP_FX'),
  'the step is painted from its own cobalt palette, never the near-cyan `def.color`');
check(!src.includes('stampGhost') && !src.includes('tryDash'),
  'nothing of the player dash implementation is used');
// THE PLAYER DASH IS THE NEGATIVE REFERENCE. It stamps seventeen 0x60ecff
// ghosts that grow 1.2x; anything of the Captain's wearing that colour is one
// tuning decision away from reading as the same move.
check(!src.includes('0x60ecff') && !src.includes('0x80f0ff') && !src.includes('0x8fd8ff'),
  'the echo is not painted in the player dash\'s cyan');
const haz = await (await fetch(BASE + 'src/systems/Hazard.js')).text();
const pkt = haz.slice(haz.indexOf('TRAVELLING PACKETS'), haz.indexOf('THE CONNECTIONS. Re-rolled'));
check(pkt.length > 200 && pkt.includes('this.radius') && !/\bradius\s*[*+-]\s*\d/.test(pkt),
  'the travelling packets ride `this.radius` itself — the one moving thing on the edge cannot misreport it',
  `${pkt.length} chars`);

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
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 2. THE GLYPH SET ───────────────────────────────────────────────────────
const glyphs = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const hashOf = (key) => {
    const src2 = gs.textures.get(key).getSourceImage();
    const cv = document.createElement('canvas');
    cv.width = src2.width; cv.height = src2.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(src2, 0, 0);
    const d = ctx.getImageData(0, 0, src2.width, src2.height).data;
    let h = 0, ink = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 40) { ink++; h = (h * 31 + d[i] + d[i + 1]) >>> 0; } }
    return { h, ink, w: src2.width, hgt: src2.height };
  };
  const keys = ['glyph-break', 'glyph-rage', 'glyph-impact', 'glyph-alert', 'glyph-throw'];
  const missing = keys.filter((k) => !gs.textures.exists(k));
  const pixels = (key) => {
    const src2 = gs.textures.get(key).getSourceImage();
    const cv = document.createElement('canvas');
    cv.width = src2.width; cv.height = src2.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(src2, 0, 0);
    return ctx.getImageData(0, 0, src2.width, src2.height).data;
  };
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  // EVERY OPAQUE GLYPH PIXEL IS ONE OF THE THREE DECLARED PUNCTUATION COLOURS.
  const allowed = new Set(['#18264a', '#8faeff', '#e8f4ff']);
  const stray = {};
  for (const k of keys) {
    if (!gs.textures.exists(k)) continue;
    const d = pixels(k);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const h = hex(d[i], d[i + 1], d[i + 2]);
      if (!allowed.has(h)) stray[k] = (stray[k] || 0) + 1;
    }
  }
  // AND THE PUNCTUATION VALUES GO NOWHERE ELSE ON HIM. The family is blue
  // now and so is his hardware, so a hue-family detector would be blind — it
  // is checked by EXACT VALUE: none of the three punctuation colours may
  // appear on his three body sheets, his rifle or the grenade device.
  const leak = {};
  for (const k of ['champ-captain', 'champ-captain-broken', 'champ-captain-critical',
    'wpn-captain', 'hz-arcnade']) {
    if (!gs.textures.exists(k)) { leak[k] = 'missing'; continue; }
    const d = pixels(k);
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && allowed.has(hex(d[i], d[i + 1], d[i + 2]))) n++;
    if (n) leak[k] = n;
  }
  const glyphViolet = true;
  return { missing, marks: missing.length ? [] : keys.map(hashOf), stray, leak, glyphViolet };
}));
check(glyphs.missing.length === 0, 'the intent sign is a painted texture like the four reactions',
  glyphs.missing.join(','));
check(new Set(glyphs.marks.map((m) => m.h)).size === glyphs.marks.length,
  'and it is its own FORM — five glyphs, five distinct sets of pixels');
check(glyphs.marks.length === 5 && glyphs.marks[4].ink > 40,
  'it carries enough ink to read at 1x rather than being a few stray pixels',
  glyphs.marks.length === 5 ? `${glyphs.marks[4].ink} lit px` : 'n/a');
// ── THE PUNCTUATION REGISTER ──────────────────────────────────────────────
check(Object.keys(glyphs.stray).length === 0,
  'every opaque pixel of all five glyphs is one of the three declared ICE punctuation colours',
  JSON.stringify(glyphs.stray));
check(Object.keys(glyphs.leak).length === 0,
  'no punctuation colour anywhere on his body sheets, his rifle or the grenade device — the register stays above the head',
  JSON.stringify(glyphs.leak));
{
  const PUNCT = ['#18264a', '#8faeff', '#e8f4ff', '0x18264a', '0x8faeff', '0xe8f4ff'];
  const hazSrc = decomment(await (await fetch(BASE + 'src/systems/Hazard.js')).text());
  const hit = PUNCT.filter((h) => src.toLowerCase().includes(h) || hazSrc.toLowerCase().includes(h));
  check(hit.length === 0,
    'and no Captain or Arc Grenade FX source names a punctuation colour — step, field, core and armour stay cobalt',
    hit.join(','));
}

// ── 3. THE DEVICE LADDER AND THE INTENT SIGN, IN ONE STAGED THROW ──────────
//
// STAGE THE ENGAGEMENT AND POLL FOR THE CONDITION. A flat wait against the
// real AI measured a 1231px median separation against a 680px `maxRange` here
// once already: exactly one frame in a nine-second window satisfied `_canThrow`
// and a working grenade was reported absent. He is held inside the band and
// the rig waits for the state, not for a clock.
const throwRun = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion)
    .forEach((e) => gs._destroyEnemyFully?.(e) ?? e.destroy());
  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 430, gs.player.y, 'captain');
  const p = gs.player;
  c._nadeCd = 0;

  const S = [];
  let teleTried = false, teleOffset = null;
  const hook = () => {
    // Held inside the throw band every frame: the subject of this measurement
    // is the sign's lifecycle, not his pathing.
    if (!teleTried) { c.x = p.x + 430; c.y = p.y; }
    const g = c._intentFx;
    // ONE forced displacement while the sign is up, to prove it TRACKS rather
    // than having been placed. Done once and recorded, so nothing else in the
    // run is measuring a position the rig wrote.
    // WAIT FOR THE SIGN TO HAVE BEEN PLACED. It is created at (0, 0) and its
    // own `_tick` is what puts it over the head, so a displacement measured on
    // the frame it is constructed compares a real offset against the origin —
    // which is the rig being wrong about a build that is right.
    if (g && !teleTried && Math.abs(g.x - c.x) < 200 && g.x !== 0) {
      teleTried = true;
      c.x += 70;
      teleOffset = { before: g.x - (c.x - 70), capX: c.x };
    } else if (g && teleTried && teleOffset && teleOffset.after == null) {
      teleOffset.after = g.x - c.x;
    }
    S.push({
      cap: c._cap,
      sign: !!c._intentFx,
      nade: !!(c._nade && !c._nade.dead),
      q: c._punctQueue.length,
      frame: c._nade && !c._nade.dead ? String(c._nade.body?.frame?.name ?? '') : null,
      ph: c._nade && !c._nade.dead ? c._nade.phase : null,
      integ: c._nade && !c._nade.dead ? Math.round(c._nade._integrity * 100) / 100 : null,
    });
  };
  gs.events.on('postupdate', hook);
  // Poll for the grenade to become a real object, then let its whole life run.
  for (let i = 0; i < 400 && !S.some((s) => s.nade); i++) await wait(50);
  await wait(4200);
  gs.events.off('postupdate', hook);

  const live = c._nade;
  // The self-owning guard: force him out of WINDUP and the promise goes with
  // it, without anybody having written a clear-on-this-path line.
  c._nadeCd = 0; c._intentSign('glyph-throw');
  const raised = !!c._intentFx;
  c._cap = 'recover';
  c._reactFx.slice().forEach((o) => o._tick?.());
  const afterExit = !!c._intentFx;
  // And on death.
  c._intentSign('glyph-throw'); c._cap = 'windup';
  const raised2 = !!c._intentFx;
  c.alive = false;
  c._reactFx.slice().forEach((o) => o._tick?.());
  const afterDeath = !!c._intentFx;

  return {
    n: S.length,
    signOnlyInWindup: S.every((s) => !s.sign || s.cap === 'windup'),
    signSeen: S.some((s) => s.sign),
    windupSeen: S.filter((s) => s.cap === 'windup').length,
    signInEveryLateWindup: S.filter((s) => s.cap === 'windup').every((s) => s.sign),
    signAfterNade: S.filter((s) => s.nade).some((s) => s.sign),
    queueUntouched: S.filter((s) => s.sign).every((s) => s.q === 0),
    teleOffset,
    frames: [...new Set(S.filter((s) => s.frame != null).map((s) => `${s.ph}:${s.frame}`))],
    armedInArm: S.some((s) => s.ph === 'arm' && s.frame === '2'),
    chargingInArm: S.some((s) => s.ph === 'arm' && s.frame === '1'),
    inertInArm: S.some((s) => s.ph === 'arm' && s.frame === '0'),
    armedInField: S.some((s) => s.ph === 'field' && s.frame === '2'),
    raised, afterExit, raised2, afterDeath,
    // `frameTotal` counts Phaser's own __BASE frame, so ask the frames by name.
    deviceFrames: ['0', '1', '2', '3'].filter((k) => gs.textures.get('hz-arcnade').has(k)).join(''),
  };
}));

check(throwRun.signSeen, 'the intent sign is raised on a real, AI-driven grenade commitment',
  `${throwRun.windupSeen} windup frames over ${throwRun.n} samples`);
check(throwRun.signOnlyInWindup, 'and it exists in NO other state — it is not a status icon');
check(throwRun.signInEveryLateWindup, 'it is up for the whole commitment, not a flash inside it');
check(!throwRun.signAfterNade,
  'it is gone the moment the device is a real object in the world — the promise is kept, not described');
check(throwRun.queueUntouched,
  'it never entered the punctuation queue, which would have delayed it past its own moment');
check(!!throwRun.teleOffset && throwRun.teleOffset.after != null
  && Math.abs(throwRun.teleOffset.after - throwRun.teleOffset.before) < 2,
  'it TRACKS the head — move the body 70px and the sign holds the same offset',
  JSON.stringify(throwRun.teleOffset));
check(throwRun.raised && !throwRun.afterExit,
  'an interrupted wind-up takes the promise down with it, by the sign asking its own question');
check(throwRun.raised2 && !throwRun.afterDeath, 'and a dead Captain makes no promises');

check(throwRun.deviceFrames === '012', 'the device is three authored frames, not two',
  `frames ${throwRun.deviceFrames}`);
// OBSERVED, ONLY WHAT A LIVE SAMPLE CAN SEE. Since the blip sequence the
// CHARGING frame exists only inside BLIP 1's ~47ms window, and a full suite run
// on this container drops under 6fps — so a per-frame sampler steps clean over
// it and a correct build reports as a two-frame device. That frame is proved
// by the ADDRESSED blip ladder below; here the live throw only has to show the
// device going from inert to armed on a real AI grenade.
check(throwRun.frames.includes('flight:0') && throwRun.armedInArm,
  'a real thrown device flies inert and arms — land, blip and pause are sub-frame and proved on its own clock below',
  throwRun.frames.join(' '));
check(throwRun.armedInField, 'the live field is powered by an ARMED device');

// ── 3b. THE RING THE STEP BORROWS, AND HANDS BACK ──────────────────────────
// `threatRing` is an identity halo nothing reads. The step hides it and draws
// a deformed copy; the checks here are that it does so ONLY while the step
// runs, that nothing is left behind, and that no gameplay number moved.
const ringRun = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully?.(e) ?? e.destroy());
  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y - 60, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, 900); };
  c._nadeCd = 1e9;
  await wait(600);
  const ringCmds0 = c.threatRing.commandBuffer.length;
  const body0 = { r: c.body.radius, w: c.body.width, speed: c.def.speed };
  const fx0 = c._reactFx.length;
  const S = [];
  const hook = () => S.push({
    beat: c._stepRingFx?._beat ?? null, overlay: !!c._stepRingFx,
    ringA: c.threatRing.alpha, cap: c._cap,
  });
  gs.events.on('postupdate', hook);
  c._stepCd = 0; c._cap = 'hold'; c._stateMs = 0;
  c._beginStep(gs.player, 'close', { x: c.x - 200, y: c.y, reach: 200 });
  for (let i = 0; i < 120 && (c._cap === 'step' || c._stepRingFx); i++) await wait(50);
  await wait(250);
  gs.events.off('postupdate', hook);
  return {
    beats: [...new Set(S.map((x) => x.beat).filter(Boolean))],
    hiddenOnlyWithOverlay: S.every((x) => x.ringA > 0 || x.overlay),
    hiddenDuring: S.some((x) => x.overlay && x.ringA === 0),
    after: { overlay: !!c._stepRingFx, ringA: c.threatRing.alpha, fx: c._reactFx.length, fx0 },
    ringCmdsSame: c.threatRing.commandBuffer.length === ringCmds0,
    bodySame: c.body.radius === body0.r && c.body.width === body0.w && c.def.speed === body0.speed,
  };
}));
check(ringRun.beats.includes('travel') && (ringRun.beats.includes('hero') || ringRun.beats.includes('cool')),
  'a real step drives the ring through its beats — sheared in travel, reformed at the catch',
  JSON.stringify(ringRun.beats));
check(ringRun.hiddenDuring && ringRun.hiddenOnlyWithOverlay,
  'the stock ring is hidden ONLY while the step overlay stands in for it');
check(!ringRun.after.overlay && ringRun.after.ringA === 1 && ringRun.after.fx <= ringRun.after.fx0,
  'after the settle the overlay is gone, the stock ring is back at full and no step FX is left',
  JSON.stringify(ringRun.after));
check(ringRun.ringCmdsSame && ringRun.bodySame,
  'the stock ring\'s own geometry, his body and his speed are untouched by the step');

// ── 4. THE BOUNDARY IS STILL THE RADIUS ────────────────────────────────────
const edge = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { CHAMPION } = await import('/src/config.js');
  const g = CHAMPION.captain.grenade;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const n = gs.spawnArcGrenade({ ...g, x: gs.player.x, y: gs.player.y - 400,
    tx: gs.player.x, ty: gs.player.y - 400, owner: null });
  for (let i = 0; i < 300 && n.phase !== 'field'; i++) await wait(40);
  const R = n.radius;
  // A PROBE AT EXACTLY 1.0 MEASURES FLOATING-POINT ERROR on the diagonals, so
  // the edge itself is tested only on the four axis-aligned bearings where the
  // arithmetic is exact; the eight-bearing sweep straddles it instead.
  const B = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * Math.PI) / 4);
  const at = (f, a) => n.contains(n.x + Math.cos(a) * R * f, n.y + Math.sin(a) * R * f);
  // ── THE SHUTDOWN LADDER, ON THE OBJECT'S OWN CLOCK ──────────────────────
  // NEVER MEASURE A 520ms WINDOW BY HOPING A FRAME LANDS IN IT. Inside a full
  // suite run this container has dropped under 6fps, at which the whole warn
  // beat is two frames and a correct build reports as a fading one. `_integrity`
  // is a pure function of `age`, so the beat is addressable: put the object at
  // the instant and step it once.
  const at2 = (frac) => {
    n.age = n.flightMs + n.armMs + n.fieldMs - n.warnMs * frac;
    n.update(16);
    return String(n.body?.frame?.name ?? 'gone');
  };
  const ladder = { armed: at2(1.4), charging: at2(0.30), inert: at2(0.05) };

  // ── LAND, BLIP, PAUSE, BLIP, ARMED — addressed on the object's own clock ──
  // A second grenade, put at each instant of its arming window and stepped
  // once. `contains()` is asked at the centre at every one of them: none of
  // the activation may make the device dangerous a millisecond early.
  const m = gs.spawnArcGrenade({ ...g, x: gs.player.x + 300, y: gs.player.y - 420,
    tx: gs.player.x + 300, ty: gs.player.y - 420, owner: null });
  const armAt = (uu) => {
    m.age = m.flightMs + m.armMs * uu;
    m.update(1);
    return { f: String(m.body?.frame?.name), hot: m.contains(m.x, m.y) };
  };
  const blips = {
    land: armAt(0.04), blip1: armAt(0.12), pause: armAt(0.24),
    blip2: armAt(0.35), armed: armAt(0.9),
  };
  // ── THE CORE IS ALIVE BETWEEN TICKS ──────────────────────────────────────
  // At instants chosen AWAY from every packet-sync tick, the source layer must
  // still carry draw commands. On the previous build it was empty there — the
  // tick was the only thing the device ever drew.
  const liveAt = [0.21, 0.37, 0.52, 0.66].map((f) => {
    m.age = m.flightMs + m.armMs + m.fieldMs * f;
    // Packets at node positions 2, 4.67 and 7.33: one sits on an EVEN node
    // that is not north (where the tick law draws nothing) and the other two
    // are a third of a node away. An earlier choice of 0.5/8 left one packet
    // inside the old tick window, so the check passed on the dead build too.
    m._pktT = 2 / 8;
    m.update(1);
    return (m.coreGfx?.commandBuffer?.length ?? 0) > 0;
  });
  // ── THE SOURCE ANSWERS THE HIT, AND THE HIT IS UNCHANGED ─────────────────
  const pl = gs.player;
  const hp0 = pl.hp;
  const godWas = pl._god;
  pl.setPosition(m.x, m.y); pl.alive = true;
  m.age = m.flightMs + m.armMs + 400; m._cool = 0; m._hitT = 0;
  m.update(1);
  const hitReact = { hitT: m._hitT, removed: hp0 - pl.hp, cool: m._cool };
  // ── THE POWER-DOWN IS AFTER THE DANGER, IN ITS OWN PHASE ─────────────────
  pl.setPosition(m.x, m.y);
  m.age = m.flightMs + m.armMs + m.fieldMs + 20; m._cool = 0;
  const hpS = pl.hp;
  m.update(1);
  const spent = {
    phase: m.phase, live: m.live, contains: m.contains(m.x, m.y),
    hurt: hpS - pl.hp, drawn: (m.coreGfx?.commandBuffer?.length ?? 0) > 0 || m.body?.frame?.name === '1',
    ringDrawn: (m.edgeGfx?.commandBuffer?.length ?? 0) > 0,
    dead: m.dead,
  };
  m.age = m.flightMs + m.armMs + m.fieldMs + m.spentMs - 30; m.update(1);
  const lateAlive = !m.dead;
  m.age = m.flightMs + m.armMs + m.fieldMs + m.spentMs + 5; m.update(1);
  const endsDead = m.dead;
  pl.setPosition(gs.player.x, gs.player.y + 500);

  // THE ORPHAN SWEEP. The source-life FX draw into the grenade's own Graphics
  // and create nothing of their own, so the display list must come back to
  // exactly where it was when the object goes.
  // A fresh one for the count: the one above has already destroyed itself.
  const q = gs.spawnArcGrenade({ ...g, x: gs.player.x - 300, y: gs.player.y - 420,
    tx: gs.player.x - 300, ty: gs.player.y - 420, owner: null });
  const before = gs.children.list.length;
  q.destroy();
  const after = gs.children.list.length;
  const counted = { before, after, removed: before - after };
  return {
    R, cfg: g.radius, ladder, blips, counted, liveAt, hitReact, spent, lateAlive, endsDead,
    dmg: g.damage, tick: g.tickMs,
    frozen: {
      hp: CHAMPION.captain.hp, armour: CHAMPION.captain.armour,
      armourTake: CHAMPION.captain.armourTake, armourSpill: CHAMPION.captain.armourSpill,
      step: (({ distance, plantMs, travelMs, catchMs, cooldownMs }) =>
        ({ distance, plantMs, travelMs, catchMs, cooldownMs }))(CHAMPION.captain.step),
      nade: (({ radius, flightMs, armMs, fieldMs, warnMs, damage, tickMs, dragMult, cooldownMs }) =>
        ({ radius, flightMs, armMs, fieldMs, warnMs, damage, tickMs, dragMult, cooldownMs }))(g),
    },
    inAll: B.every((a) => at(0.999, a)),
    outAll: B.every((a) => !at(1.002, a)),
    axisEdge: [0, Math.PI / 2, Math.PI, -Math.PI / 2].every((a) => at(1, a)),
    live: n.phase === 'field',
  };
}));
check(edge.live, 'the staged field reached its live phase');
check(edge.R === edge.cfg, 'the gameplay radius is the authored one — this pass moved no number',
  `${edge.R} vs ${edge.cfg}`);
check(edge.inAll && edge.outAll && edge.axisEdge,
  'a fraction inside is dangerous, the edge is dangerous, a fraction outside is safe — unchanged');
check(edge.ladder.armed === '2' && edge.ladder.charging === '1' && edge.ladder.inert === '0',
  'shutdown steps back DOWN the device\'s own ladder — armed, charging, inert — rather than fading out',
  JSON.stringify(edge.ladder));
const B = edge.blips;
check(B.land.f === '0' && B.blip1.f === '1' && B.pause.f === '0' && B.blip2.f === '2' && B.armed.f === '2',
  'the device speaks twice: inert on landing, BLIP to charging, SILENT again, BLIP to armed, and holds',
  JSON.stringify(B));
check(Object.values(B).every((x) => x.hot === false),
  'and not one instant of the activation makes the centre dangerous — `contains` still waits for the field');
check(edge.counted.removed === 6,
  'the source life creates no objects per frame — a destroyed grenade takes exactly its five Graphics and its device',
  JSON.stringify(edge.counted));
check(edge.liveAt.every(Boolean),
  'the source core is drawing at every sampled instant of the live field — alive between ticks, not only on them',
  JSON.stringify(edge.liveAt));
check(edge.hitReact.hitT > 0 && edge.hitReact.removed === edge.dmg && edge.hitReact.cool === edge.tick,
  'a damage tick makes the source react — and the tick itself is exactly the authored damage on the authored cadence',
  JSON.stringify(edge.hitReact));
check(edge.spent.phase === 'spent' && !edge.spent.live && !edge.spent.contains && edge.spent.hurt === 0,
  'after `fieldMs` the device is SPENT: not live, `contains` false, and a player standing on it takes nothing',
  JSON.stringify(edge.spent));
check(edge.spent.drawn && !edge.spent.ringDrawn,
  'the power-down is drawn on the device alone — no ring survives the danger',
  JSON.stringify(edge.spent));
check(edge.lateAlive && edge.endsDead,
  'it powers down for `spentMs` and is then gone — a visible shutdown, then a clean removal',
  `late ${edge.lateAlive}, end ${edge.endsDead}`);
// ── EVERY FROZEN NUMBER, AS A LITERAL ─────────────────────────────────────
const F = edge.frozen;
check(F.hp === 3400 && F.armour === 1900 && F.armourTake === 0.85 && F.armourSpill === 0.55,
  'durability is 3400 + 1900 = 5300 with armourTake 0.85 and armourSpill 0.55 — untouched', JSON.stringify(F));
check(JSON.stringify(F.step) === JSON.stringify({ distance: 200, plantMs: 90, travelMs: 215, catchMs: 120, cooldownMs: 2800 }),
  'the step is 200px / 90 / 215 / 120 / 2800 — untouched', JSON.stringify(F.step));
check(JSON.stringify(F.nade) === JSON.stringify({ radius: 132, flightMs: 620, armMs: 520, fieldMs: 1900,
  warnMs: 520, damage: 46, tickMs: 420, dragMult: 0.62, cooldownMs: 9000 }),
  'the Arc Grenade\'s radius, timings, damage, tick, drag and cooldown are untouched', JSON.stringify(F.nade));

await browser.close();
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — hard geometry, a device with a middle, and a promise that dies when it is kept`);
