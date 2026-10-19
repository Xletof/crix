// SMOKE: THE SHARED STUCK-DETECTION AUDIT'S INSTRUMENT (Phase 3A). Standalone,
// like the roster smokes — not in run-all. It asserts nothing about how the
// game SHOULD move; it asserts that `tests/diag-stuck-audit.mjs` is watching
// the real game and can tell apart what the audit reports:
//
//   0  production is untouched (src/ identical to the closure baseline EXCEPT
//      the opt-in Phase 3B Bulwark and Phase 3C Marksman candidates — their
//      own modules, the flags in debug.js / BootScene.js and their two-line
//      installs in GameScene.js — and the narrowed Enemy.js guard still holds)
//   1  the instrument perturbs nothing (instrumented A == an uninstrumented page)
//   2  the headless metrics path == the rendered path, and staged runs are
//      independent of what ran before them
//   3  a FALSE first check (clear lane): the base reads 0px, the body really
//      moved, the sidestep is taken — and the veto counterfactual removes it
//   4  a TRUE obstruction: recovery is armed against real contact, and with
//      recovery switched off (control) the body never gets round
//   5  movement v2.2: the approach still takes the first-check sidestep, and
//      its own settles/plants arm sidesteps that the approach later takes
//   6  role-specific execution: the Marksman arms in its band without moving;
//      the Bulwark's hold -> resume sidestep survives the veto, not `prog`
//   7  the approved Demolisher correction and its nemesis exclusion
//   8  RNG: the veto keeps the draw, shared initialization drops one
//
// usage: node tests/smoke-stuck-audit.mjs   (needs `npm run dev` on :5173)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { CHROME, bootPage, installAudit, stagedRun, firstCheck } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

// ── 0. production untouched ─────────────────────────────────────────────
// NARROWED for Phase 3B (`?bulwarkStuck=prog|early`) and Phase 3C
// (`?marksmanStuck=prog`), both opt-in: src/ may differ from 04cd882 in
// exactly five files, and GameScene.js only by each candidate's import and
// its flag-gated install. Every entity file — Enemy.js above all — still has
// to be byte-identical; with no flag nothing is installed, which
// `smoke-bulwark-stuck` §1 and `smoke-marksman-stuck` §1 prove against the
// frozen builds trace for trace.
const OPT_IN = ['src/scenes/BootScene.js', 'src/scenes/GameScene.js', 'src/systems/bulwarkStuck.js', 'src/systems/debug.js', 'src/systems/marksmanStuck.js'];
const srcFiles = execSync('git diff --name-only 04cd882 -- src/ && git ls-files --others --exclude-standard -- src/', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean).sort();
const extra = srcFiles.filter((f) => !OPT_IN.includes(f));
check('src/ == the Phase 2D closure baseline 04cd882, apart from the five Phase 3B / 3C opt-in files', extra.length === 0, extra.join(', ') || srcFiles.join(', ') || 'no diff');
const gsLines = execSync('git diff -U0 04cd882 -- src/scenes/GameScene.js', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
const GS_OK = new Set([
  '-  isShowColliders, isMoveV2, isMoveV21, isMoveV22, isGaitV2,',
  '+  isShowColliders, isMoveV2, isMoveV21, isMoveV22, isGaitV2, getBulwarkStuck, getMarksmanStuck,',
  "+import { installBulwarkStuck } from '../systems/bulwarkStuck.js';",
  "+import { installMarksmanStuck } from '../systems/marksmanStuck.js';",
  '+    const bulwarkStuck = getBulwarkStuck();',
  "+    if (bulwarkStuck && type === 'shielded' && !spec.legacyArt) installBulwarkStuck(enemy, bulwarkStuck, x, y);",
  '+    const marksmanStuck = getMarksmanStuck();',
  "+    if (marksmanStuck && type === 'sniper' && !spec.legacyArt) installMarksmanStuck(enemy, marksmanStuck, x, y);",
]);
const gsBad = gsLines.filter((l) => !GS_OK.has(l) && !/^\+    \/\/ /.test(l));
check('GameScene.js differs from 04cd882 only by the two candidates\' imports and their flag-gated installs', gsBad.length === 0 && gsLines.length === 14,
  gsBad.join(' | ') || `${gsLines.length} lines`);
const entDiff = execSync('git diff --stat 04cd882 -- src/entities/ src/config.js src/data/', { cwd: ROOT, encoding: 'utf8' }).trim();
check('src/entities/, config.js and data/ are byte-identical to 04cd882', entDiff === '', entDiff || 'no diff');
const gd = enemyJsGuard(ROOT);
check('Enemy.js narrowed guard: every class outside EnemyBomber == 3ce5680, the veto is the only seam', gd.outside && gd.bomberOnlyVeto && gd.vetoCode, gd.detail);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const lane = (actor, extra = {}) => ({ seed: 1001, ticks: 330, actors: [{ x: 800, y: 250, at: 0, ...actor }], player: { path: 'stand', x: 800, y: 1150 }, ...extra });
const away = (actor, seed = 1001) => ({ seed, ticks: 720, actors: [{ x: 800, y: 200, at: 0, ...actor }], player: { path: 'away', x: 800, y: 650 } });
const audited = async (variant, flags = '', headless = true) => {
  const p = await bootPage(browser, { flags });
  await installAudit(p, variant);
  await p.evaluate((h) => { window.__headless = h; }, headless);
  return p;
};

// ── 1. the instrument perturbs nothing ──────────────────────────────────
// the same staged lane on a page with NO wrappers installed
const bare = async (headless) => {
  const p = await bootPage(browser, {});
  const r = await p.evaluate((h) => {
    window.__headless = h;
    const gs = window.__gs, P = gs.player;
    gs.arenaActive = false; gs._roomModifier = null;
    if (gs.arenaCfg) gs.arenaCfg = { ...gs.arenaCfg, speedMult: undefined };
    gs.enemyHpMult = 1; gs.enemySpeedMult = 1;
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    for (const g of gs.hostileBullets) for (const x of g.getChildren()) if (x.active) x.kill();
    for (const x of gs.playerBullets?.getChildren?.() || []) if (x.active) x.kill?.();
    gs.clearHazards?.(); gs.clearTelegraphs?.();
    for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
    for (const w of gs.walls?.getChildren?.() || []) if (w.body) w.body.enable = false;
    gs.losRects = []; gs.navGrid.build(gs.roomSpec.bounds.w, gs.roomSpec.bounds.h, []);
    gs._moteTimer = 0;
    gs.cameras.main.resetFX(); gs.tweens.killAll(); gs.time.removeAllEvents();
    window.__seed(1001); window.__draws = 0;
    P.setPosition(800, 1150); P.body.reset(800, 1150); P.hp = P.hpMax;
    const e = gs.spawnEnemyAt('grunt', 800, 250, {});
    const xs = [];
    for (let i = 0; i < 330; i++) { window.__adv(1); xs.push(Math.round(e.x * 10) + ',' + Math.round(e.y * 10)); }
    return { xs, draws: window.__draws, side: xs[70] };
  }, true);
  await p.close();
  return r;
};
{
  const b = await bare(true);
  const pA = await audited('A');
  const res = await stagedRun(pA, { ...lane({ type: 'grunt' }), trace: true });
  await pA.close();
  const r = res.recs[0];
  const sameEnd = `${Math.round(r.endX * 10)},${Math.round(r.endY * 10)}` === b.xs.at(-1);
  check('1  instrumented frozen game == uninstrumented page (Rifleman, 330 ticks)', sameEnd && res.draws === b.draws,
    `end ${r.endX},${r.endY} vs ${b.xs.at(-1)} ·  draws ${res.draws} vs ${b.draws}`);
}

// ── 2. headless == rendered; staged runs are independent ────────────────
{
  const sc = { ...lane({ type: 'shooter' }), ticks: 150, trace: true };
  const pH = await audited('A', '', true), pR = await audited('A', '', false);
  const h = await stagedRun(pH, sc), r = await stagedRun(pR, sc);
  const div = h.trace.findIndex((x, i) => x[0] !== r.trace[i][0] || x[1] !== r.trace[i][1]);
  check('2a headless metrics path == rendered game, tick for tick (Gunner, 150 ticks)', div === -1, `first divergence ${div}`);
  await pR.close();
  const g1 = await stagedRun(pH, { ...lane({ type: 'grunt' }), trace: true });
  await stagedRun(pH, lane({ type: 'shielded' }));
  await stagedRun(pH, { ...lane({ type: 'sniper', nem: true }), ticks: 200 });   // left a camera shake running before the reset learned to clear it
  const g2 = await stagedRun(pH, { ...lane({ type: 'grunt' }), trace: true });
  const d2 = g1.trace.findIndex((x, i) => x[0] !== g2.trace[i][0] || x[1] !== g2.trace[i][1]);
  check('2b a staged run is independent of the runs before it (Bulwark + nemesis Marksman in between)', d2 === -1 && g1.draws === g2.draws, `first divergence ${d2}, draws ${g1.draws}/${g2.draws}`);
  await pH.close();
}

// ── 3. the FALSE first check ────────────────────────────────────────────
const pA = await audited('A'), pV = await audited('veto'), pI = await audited('init'), pP = await audited('prog'), pO = await audited('off');
{
  const res = await stagedRun(pA, lane({ type: 'grunt' }));
  const f = firstCheck(res.recs[0]);
  check('3a the first check runs at 600ms (the 36th tick of a 60Hz step)', f && f.age === 35, `age ${f?.age} ticks = ${f ? Math.round((f.age + 1) * 1000 / 60) : '-'}ms`);
  check('3b ...reads 0px (reference undefined) while the body really moved', f && f.baseMoved === 0 && f.trueMoved >= 100, `base ${f?.baseMoved}px, true ${f?.trueMoved}px`);
  check('3c ...arms the sidestep and classifies it FALSE (F1)', f && f.armed && f.cls === 'F1', `armed ${f?.armed} cls ${f?.cls}`);
  check('3d ...and the body TAKES it: 36 ticks of perpendicular travel', f && f.cons >= 34 && f.consPx >= 150, `${f?.cons} ticks, ${f?.consPx}px`);
  check('3a2 the staged lane is clear for LINE OF SIGHT too, not only for physics (losRects rebuilt)', res.recs[0].losFrac === 1, `LOS on ${res.recs[0].losFrac} of ticks`);
  const second = res.recs[0].checks[1];
  check('3e the base re-anchored on the check: the next window is measured from that point', second && second.refX === f.x && second.refY === f.y, `ref ${second?.refX},${second?.refY} vs ${f?.x},${f?.y}`);
  const v = firstCheck((await stagedRun(pV, lane({ type: 'grunt' }))).recs[0]);
  check('3f the veto counterfactual stands the same check down: no sidestep taken', v && v.armed && v.stood && v.cons === 0, `stood ${v?.stood} cons ${v?.cons}`);
  for (const t of ['shooter', 'shielded', 'sniper', 'swarmling']) {
    const ff = firstCheck((await stagedRun(pA, lane({ type: t }))).recs[0]);
    check(`3g ${t}: the same false first check, taken`, ff && ff.cls === 'F1' && ff.cons > 0, `${ff?.cls} ${ff?.cons} ticks ${ff?.consPx}px`);
  }
}

// ── 4. a TRUE obstruction ───────────────────────────────────────────────
{
  const cover = { wall: [800, 700, 90, 90], ticks: 600 };   // touched after the first check
  const rV = (await stagedRun(pV, lane({ type: 'grunt' }, cover))).recs[0];
  const blk = rV.checks.find((c) => c.armed && !c.first);
  check('4a against real cover the stuck check arms on CONTACT (BLOCK), and the sidestep is taken', blk && blk.cls === 'BLOCK' && blk.contact > 0 && blk.cons > 0, `${blk?.cls} contact ${blk?.contact} cons ${blk?.cons}`);
  check('4b ...and the body gets round to the player', rV.engage != null, `engage ${rV.engage}`);
  const rO = (await stagedRun(pO, lane({ type: 'grunt' }, cover))).recs[0];
  check('4c CONTROL with recovery switched off: the same body never gets round (recovery is necessary)', rO.engage == null && rO.contactTicks > 400, `engage ${rO.engage} pinned ${rO.contactTicks} ticks`);
  const near = { wall: [800, 390, 90, 90], ticks: 600 };   // touched INSIDE the first window
  const fA = firstCheck((await stagedRun(pA, lane({ type: 'grunt' }, near))).recs[0]);
  const rVn = (await stagedRun(pV, lane({ type: 'grunt' }, near))).recs[0];
  const blkN = rVn.checks.find((c) => c.armed && !c.first);
  check('4d cover met inside the first window: the false first arm lands while PINNED; under the veto recovery waits for the next check',
    fA?.contactNow && fA.cons > 0 && blkN && blkN.age >= 70, `A first pinned ${fA?.contactNow}; veto first real arm at tick ${blkN?.age}`);
}

// ── 5. movement v2.2 ────────────────────────────────────────────────────
{
  const p22 = await audited('A', 'move=v22'), p22v = await audited('veto', 'move=v22'), p22p = await audited('prog', 'move=v22');
  const res = await stagedRun(p22, lane({ type: 'shooter' }));
  const f = firstCheck(res.recs[0]);
  check('5a v2.2 Gunner: the body runs the legs locomotion', res.recs[0].mode === 'v22', res.recs[0].mode);
  check('5b ...and its approach (`_moveToward`) still takes the false first-check sidestep', f && f.cls === 'F1' && f.cons > 0, `${f?.cls} ${f?.cons} ticks`);
  // seed 32677: a settle/plant arms, and the next approach takes it (the veto keeps F1 out of the count)
  const aw = (await stagedRun(p22v, away({ type: 'grunt' }, 32677))).recs[0];
  const hold = aw.checks.filter((c) => c.armed && c.cls === 'HOLD' && c.cons > 0);
  check('5c v2.2 Rifleman: a settle/plant arms a HOLD sidestep that the next approach takes', hold.length > 0, `${hold.length} taken, ${aw.sideTicks} ticks`);
  const awp = (await stagedRun(p22p, away({ type: 'grunt' }, 32677))).recs[0];
  check('5d ...which the progress-aware counterfactual stands down', awp.sideTicks === 0, `${awp.sideTicks} sidestep ticks`);
  await p22.close(); await p22v.close(); await p22p.close();
}

// ── 6. role-specific execution ──────────────────────────────────────────
{
  const m = (await stagedRun(pA, away({ type: 'sniper' }))).recs[0];
  const f = firstCheck(m);
  check('6a Marksman spawned inside its band: first check armed with no movement at all (H1), not taken', f && f.cls === 'H1' && f.trueMoved < 12 && f.cons === 0, `${f?.cls} moved ${f?.trueMoved} cons ${f?.cons}`);
  check('6b ...its later hold arms ARE taken when the player backs off (hold -> resume)', m.checks.some((c) => c.cls === 'HOLD' && c.cons > 0), `${m.checks.filter((c) => c.cls === 'HOLD' && c.cons > 0).length}`);
  const bV = (await stagedRun(pV, away({ type: 'shielded' }))).recs[0];
  const bP = (await stagedRun(pP, away({ type: 'shielded' }))).recs[0];
  check('6c Bulwark hold -> resume: the sidestep survives the Demolisher-style veto', bV.checks.some((c) => c.cls === 'HOLD' && c.cons > 0) && bV.sideTicks > 0, `${bV.sideTicks} ticks`);
  check('6d ...and is gone under the progress-aware counterfactual', bP.sideTicks === 0, `${bP.sideTicks} ticks`);
  const sw = firstCheck((await stagedRun(pA, lane({ type: 'swarmling' }))).recs[0]);
  check('6e Swarmling: a rushing pack member takes the full first-check sidestep', sw && sw.cons >= 34, `${sw?.cons} ticks ${sw?.consPx}px`);
}

// ── 7. the approved Demolisher correction, and its nemesis exclusion ────
{
  const d = firstCheck((await stagedRun(pA, lane({ type: 'bomber' }))).recs[0]);
  check('7a ordinary Demolisher: the base still arms its first check, and `_vetoFalseStuck` stands it down before it is taken', d && d.armed && d.cons === 0, `armed ${d?.armed} cons ${d?.cons}`);
  const n = firstCheck((await stagedRun(pA, lane({ type: 'bomber', nem: true }))).recs[0]);
  check('7b nemesis Demolisher: excluded from the approved veto — the false first check is taken', n && n.cls === 'F1' && n.cons > 0, `${n?.cls} ${n?.cons} ticks`);
  for (const t of ['grunt', 'shooter', 'shielded', 'sniper']) {
    const nn = firstCheck((await stagedRun(pA, { ...lane({ type: t, nem: true }), ticks: 200 })).recs[0]);
    check(`7c nemesis ${t}: reaches the shared path and takes the false first check`, nn && nn.cls === 'F1' && nn.cons > 0, `${nn?.cls} ${nn?.cons}`);
  }
}

// ── 8. RNG ──────────────────────────────────────────────────────────────
{
  const sc = { ...lane({ type: 'grunt' }), trace: true };
  const a = await stagedRun(pA, sc), v = await stagedRun(pV, sc), i = await stagedRun(pI, sc);
  const t = firstCheck(a.recs[0]).tick;   // trace[t] is the state after the step the check ran in
  check('8a veto: the random stream is identical to the frozen game through the first check (the draw is kept)', v.trace[t][1] === a.trace[t][1] && v.trace[t - 1][1] === a.trace[t - 1][1], `${v.trace[t][1]} vs ${a.trace[t][1]}`);
  check('8b shared initialization: one draw fewer at the first check — every later random number shifts', i.trace[t - 1][1] === a.trace[t - 1][1] && i.trace[t][1] === a.trace[t][1] - 1, `${i.trace[t][1]} vs ${a.trace[t][1]}`);
  check('8c veto and init move the body identically (they differ only in the random stream)', v.recs[0].engage === i.recs[0].engage, `${v.recs[0].engage} / ${i.recs[0].engage}`);
}
for (const p of [pA, pV, pI, pP, pO]) await p.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
