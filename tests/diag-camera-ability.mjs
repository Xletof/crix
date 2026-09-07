// DIAG — DOES THE FRAME FOLLOW THE ABILITY? (Camera Phase 2B)
//
//   node tests/diag-camera-ability.mjs
//
// Phase 2B's claim is that explicit commitment outranks locomotion: if the
// Super's cone or the melee telegraph says the skill goes east, the camera
// frames east even while the player's feet carry them west. This measures
// exactly that — the world visible in the ABILITY's direction — plus the two
// continuity beats a preview cannot show on its own: whether the framing
// survives the moment the preview vanishes at cast, and whether it comes back
// to the approved Phase 2A movement composition afterwards.
//
// DRIVEN THROUGH THE REAL ENTRY POINTS. `setSuperAimInput` / `setMeleeAimInput`
// are what the touch widgets call, and `releaseSuperAim` / `releaseMeleeAim`
// are what fire the ability. Poking `superAim` directly would test a field, not
// a feature — and would miss that both release paths clear their own preview
// flag before the cast, which is the whole reason `commitAbility` exists.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VIEW_W = 720, TOP = 84, VIEW_H = 1196;

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 616 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
});
await page.waitForTimeout(1400);

// The room has to be quiet or this measures the harness, not the camera — the
// same helper the lateral rig uses, for the same reasons.
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

// Everything is driven and sampled INSIDE the page, stepping the director by
// hand. `page.evaluate` polling costs 200-400ms a round trip and an ability
// preview plus its committed hold is under a second end to end.
const run = (script) => page.evaluate(async (src) => {
  const gs = window.game.scene.getScene('Game');
  const { CAMERA, PLAYER } = await import('/src/config.js');
  const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
  const H = 16;
  // THE PLAYER'S OWN CLOCKS HAVE TO TICK TOO. Stepping only the director leaves
  // `_meleeAnimT` and the combo window frozen at their cast values, which made
  // one melee lead read as holding the frame for ever and leaked that state
  // into the next case. The camera reads those clocks, so a rig that stops them
  // is measuring a game state that cannot occur.
  const step = (n) => {
    for (let i = 0; i < n; i++) {
      if (p._meleeAnimT > 0) p._meleeAnimT = Math.max(0, p._meleeAnimT - H);
      if (p._comboWindowMs > 0) p._comboWindowMs = Math.max(0, p._comboWindowMs - H);
      if (p._meleeLungeMs > 0) p._meleeLungeMs = Math.max(0, p._meleeLungeMs - H);
      d.update(H);
    }
  };
  const at = (x, y) => { p.setPosition(x, y); p.setVelocity(0, 0); };
  const move = (dx, dy) => { p._moveTargetX = dx * PLAYER.speed; p._moveTargetY = dy * PLAYER.speed; };
  const vec = (ang) => ({ x: Math.cos(ang), y: Math.sin(ang), force: 1 });
  // Screen position of the player, and how much viewport lies in a bearing.
  const sx = () => (p.x - c.scrollX) * c.zoom + c.x;
  const sy = () => (p.y - c.scrollY) * c.zoom + c.y;
  const ahead = (ang) => {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    const X = sx(), Y = sy() - c.y;   // viewport-local
    // Distance from the player to the viewport edge along the bearing.
    let t = Infinity;
    if (cx > 1e-6) t = Math.min(t, (720 - X) / cx); else if (cx < -1e-6) t = Math.min(t, (0 - X) / cx);
    if (cy > 1e-6) t = Math.min(t, (1196 - Y) / cy); else if (cy < -1e-6) t = Math.min(t, (0 - Y) / cy);
    return t;
  };
  // The helpers are named parameters, not properties of a context object: the
  // scripts read like the game's own vocabulary, and a typo is a ReferenceError
  // at the call rather than a silent undefined inside a measurement.
  const fn = new Function(
    'gs', 'CAMERA', 'PLAYER', 'c', 'd', 'p', 'step', 'at', 'move', 'vec', 'sx', 'sy', 'ahead',
    `return (async () => { ${src} })()`,
  );
  return fn(gs, CAMERA, PLAYER, c, d, p, step, at, move, vec, sx, sy, ahead);
}, script);

const R = (n, d = 0) => Number(n).toFixed(d);
console.log('aheadIn(dir) = viewport px between the player and the frame edge along that bearing.');
console.log('Neutral standing: 360 east, 360 west, ~526 north, ~670 south.\n');

// ── SUPER ──────────────────────────────────────────────────────────────────
console.log('══ SUPER PREVIEW ══');
for (const [label, ang] of [['east', 0], ['west', Math.PI], ['north', -Math.PI / 2], ['south', Math.PI / 2]]) {
  await quiet();
  const r = await run(`
    const A = ${ang};
    at(800, 700); move(0, 0); p.superAiming = false; p.meleeAiming = false;
    d.reset(800, 700); step(60);
    const base = ahead(A), baseY = sy();
    p.superCharge = 99;
    p.setSuperAimInput(vec(A));
    step(60);
    const got = ahead(A);
    return { base, got, w: d._abW, screenY: sy(), baseY, armed: p.superAiming };
  `);
  console.log(`  aim ${label.padEnd(6)} aheadIn ${R(r.base).padStart(4)} -> ${R(r.got).padStart(4)}`
    + `   (+${R(r.got - r.base)})  abilityWeight ${R(r.w, 2)}  playerScreenY ${R(r.screenY)}${r.armed ? '' : '  ⚠ NOT ARMED'}`);
}

console.log('\n══ THE CONFLICT: moving one way, aiming the other ══');
for (const [label, mv, ang] of [['move W / aim E', -1, 0], ['move E / aim W', 1, Math.PI]]) {
  await quiet();
  const r = await run(`
    const A = ${ang}, MV = ${mv};
    at(800, 700); move(MV, 0); p.superAiming = false; p.meleeAiming = false;
    d.reset(800, 700); step(90);
    const moveOnly = ahead(A), moveLead = d._leadX;
    p.superCharge = 99; p.setSuperAimInput(vec(A));
    step(70);
    return { moveOnly, withAim: ahead(A), moveLead, w: d._abW };
  `);
  console.log(`  ${label.padEnd(15)} aheadIn(aim) ${R(r.moveOnly).padStart(4)} -> ${R(r.withAim).padStart(4)}`
    + `   movementLead ${R(r.moveLead).padStart(4)}  abilityWeight ${R(r.w, 2)}`);
}

console.log('\n══ CAST CONTINUITY — does the frame survive the preview vanishing? ══');
for (const [label, kind, ang] of [['super east', 'super', 0], ['melee east', 'melee', 0], ['melee west', 'melee', Math.PI]]) {
  await quiet();
  const r = await run(`
    const A = ${ang}, KIND = ${JSON.stringify(kind)};
    at(700, 700); move(0, 0); p.superAiming = false; p.meleeAiming = false;
    p.resetMeleeCombo(); p._suppressedMs = 0; p.isDashing = false;
    d.reset(700, 700); step(40);
    p.superCharge = 99; p.meleeCharge = 99; p.dashCharges = 2;
    if (KIND === 'super') p.setSuperAimInput(vec(A));
    else { p.beginMeleeAim ? p.beginMeleeAim() : 0; p.setMeleeAimInput(vec(A)); }
    step(60);
    const preview = { ahead: ahead(A), w: d._abW, armed: KIND === 'super' ? p.superAiming : p.meleeAiming };
    // FIRE. Both release paths clear their own preview flag before the cast.
    // A REFUSED CAST READS EXACTLY LIKE A FAILED ONE. tryMeleeCombo returns
    // false on suppression, a live dash, a hurt stagger or an unready meter,
    // and the camera row underneath would then be measuring a cancel while
    // claiming to measure a commit. Capture the state that decided it.
    // (No backticks in here: these scripts ARE template literals, and one
    //  inside a comment closes the string. Cost one run to find.)
    const gate = { ready: p.meleeReady, charge: p.meleeCharge, sup: p._suppressedMs,
                   dash: p.isDashing, stag: p._hurtStaggerMs, stage: p._comboStage };
    const fired = KIND === 'super'
      ? (p.releaseSuperAim(vec(A)), true)
      : p.releaseMeleeAim(vec(A));
    const justAfter = { ahead: ahead(A), w: d._abW, armed: KIND === 'super' ? p.superAiming : p.meleeAiming, commit: d._abCommitMs };
    step(10);
    const during = { ahead: ahead(A), w: d._abW };
    step(60);
    const late = { ahead: ahead(A), w: d._abW };
    // Long enough for every hold to expire.
    step(120);
    const settled = { ahead: ahead(A), w: d._abW, screenX: sx(), screenY: sy() };
    return { fired, gate, preview, justAfter, during, late, settled };
  `);
  console.log(`  ${label.padEnd(11)} fired=${r.fired}${r.fired ? '' : ' ' + JSON.stringify(r.gate)}  preview ahead ${R(r.preview.ahead).padStart(4)} w ${R(r.preview.w, 2)}`
    + ` | at cast ahead ${R(r.justAfter.ahead).padStart(4)} w ${R(r.justAfter.w, 2)} armed=${r.justAfter.armed} hold ${R(r.justAfter.commit)}ms`
    + ` | +160ms ${R(r.during.ahead).padStart(4)}/${R(r.during.w, 2)}`
    + ` | +1.1s ${R(r.late.ahead).padStart(4)}/${R(r.late.w, 2)}`
    + ` | settled ${R(r.settled.ahead).padStart(4)}/${R(r.settled.w, 2)} screen(${R(r.settled.screenX)},${R(r.settled.screenY)})`);
}

console.log('\n══ CANCEL — a dropped preview must clear the intent ══');
{
  await quiet();
  const r = await run(`
    at(800, 700); move(0, 0); p.superAiming = false; p.meleeAiming = false;
    d.reset(800, 700); step(40);
    p.superCharge = 99; p.setSuperAimInput(vec(0));
    step(60);
    const armed = { w: d._abW, ahead: ahead(0) };
    // Cancel: drop the aim WITHOUT firing, the way death or a suppressed
    // release does. No commitAbility call, so nothing may be retained.
    p.superAiming = false;
    step(60);
    const after = { w: d._abW, commit: d._abCommitMs, ahead: ahead(0) };
    step(120);
    const settled = { w: d._abW, ahead: ahead(0), screenX: sx() };
    return { armed, after, settled };
  `);
  console.log(`  armed w ${R(r.armed.w, 2)} ahead ${R(r.armed.ahead)}`
    + ` -> +1s w ${R(r.after.w, 2)} hold ${R(r.after.commit)}ms ahead ${R(r.after.ahead)}`
    + ` -> settled w ${R(r.settled.w, 2)} ahead ${R(r.settled.ahead)} screenX ${R(r.settled.screenX)}`);
}

console.log('\n══ §13 SOUTH SAFETY — ability aiming NORTH at the south wall ══');
console.log('  (north is the dangerous bearing: it pushes the player DOWN the screen.)');
for (const id of ['detention', 'corridor', 'hangar', 'vader']) {
  await page.evaluate(async (rid) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    gs.loadRoom(ROOMS.find((r) => r.id === rid));
  }, id);
  await page.waitForTimeout(900);
  await quiet();
  const r = await run(`
    const { w, h } = gs.roomSpec.bounds;
    const px = w / 2, py = h - PLAYER.radius;
    const out = [];
    for (const [name, A] of [['none', null], ['aim N', -Math.PI / 2], ['aim S', Math.PI / 2], ['aim E', 0]]) {
      at(px, py); move(0, 0); p.superAiming = false; p.meleeAiming = false;
      d.reset(px, py); step(30);
      if (A !== null) { p.superCharge = 99; p.setSuperAimInput(vec(A)); }
      for (let i = 0; i < 140; i++) { at(px, py); d.update(16); }
      out.push({ name, y: sy(), x: sx(), w: d._abW });
    }
    p.superAiming = false;
    return out;
  `);
  const ctrl = 926;
  const line = r.map((v) => `${v.name} y=${R(v.y)}${v.y >= ctrl ? '⚠' : ''}`).join('  ');
  console.log(`  ${id.padEnd(10)} ${line}   (control edge ${ctrl})`);
}

await browser.close();
