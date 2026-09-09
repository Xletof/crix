// The Phase A encounter test harness — instrumentation, not content.
//
// This file's real subject is the NEGATIVE half: with `?encdbg` absent the game
// must be byte-for-byte the game that shipped. Every check below therefore
// exists in a pair — the thing is absent without the flag, present with it —
// because "the overlay appears" passes just as happily on a build that shows it
// to everyone, and that is the one failure that would reach a player.
//
// It asserts nothing about encounter CONTENT. `smoke-encounters` owns the
// table; this owns the switch.

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

/** Boot a run at `query` and hand the page to `fn`. */
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

const probe = () => {
  const g = window.game;
  const gs = g.scene.getScene('Game');
  const hud = g.scene.getScene('HUD');
  return {
    encBtns: hud?._encBtns?.length ?? 0,
    hasText: !!hud?.encText,
    labelText: hud?.encText?.text ?? null,
    hasOverEnc: typeof hud?._overEncBtn === 'function',
    // With no strip, the exclusion must answer false for every point on screen.
    excludesSomewhere: (() => {
      if (typeof hud?._overEncBtn !== 'function') return false;
      for (let x = 0; x <= 720; x += 20) for (let y = 0; y <= 400; y += 10)
        if (hud._overEncBtn(x, y)) return true;
      return false;
    })(),
    // Any exclusion point must be in the RIGHT half — the move stick has no
    // shouldClaim hook, so a left-half button would be unblockable.
    excludedLeftHalf: (() => {
      if (typeof hud?._overEncBtn !== 'function') return false;
      for (let x = 0; x < 360; x += 5) for (let y = 0; y <= 1280; y += 5)
        if (hud._overEncBtn(x, y)) return true;
      return false;
    })(),
    room: gs.roomSpec?.id,
    sector: gs.sector,
    encounter: gs._encounter?.id ?? null,
    hasReplay: typeof gs._debugReplayWave === 'function',
    hasState: typeof gs._encDebugState === 'function',
  };
};

// ── 1. NO FLAG: nothing exists ─────────────────────────────────────────────
const off = await run('?nodlg=1', async (page) => page.evaluate(probe));
check(off.encBtns === 0, 'no flag: the overlay builds NO buttons', `${off.encBtns}`);
check(!off.hasText, 'no flag: no diagnostic label object exists', '');
check(!off.excludesSomewhere, 'no flag: the fire stick loses no screen area to it', '');
check(off.encounter !== null, 'no flag: an ordinary wave still resolves an authored encounter', `${off.encounter}`);
check(off.room === 'hangar' && off.sector === 1, 'no flag: the run starts where production starts',
  `${off.room} s${off.sector}`);

// ── 2. FLAG ON: the diagnostic exists, and stays in the right half ─────────
const on = await run('?nodlg=1&encdbg=1', async (page) => page.evaluate(probe));
check(on.encBtns === 3, 'encdbg=1: three handset buttons exist', `${on.encBtns}`);
check(on.hasText, 'encdbg=1: the diagnostic label exists', '');
check(on.excludesSomewhere, 'encdbg=1: the fire stick is taught to skip them', '');
check(!on.excludedLeftHalf, 'THE BUTTONS ARE ALL IN THE RIGHT HALF — the move stick has no exclusion hook', '');
check(on.hasReplay && on.hasState, 'the scene exposes the replay and state entry points', '');
check(/SEL/.test(on.labelText || '') && /NOW/.test(on.labelText || ''),
  'the label names the selected and the running archetype', on.labelText);

// ── 3. Forcing, room and sector from one URL ───────────────────────────────
const forced = await run('?nodlg=1&encdbg=crossfire&room=detention&sector=8', async (page) => {
  const r = await page.evaluate(probe);
  const extra = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    return { st: gs._encDebugState(), waveIdx: gs._waveIdx };
  });
  return { ...r, ...extra };
});
check(forced.room === 'detention', '?room= starts in the named arena', `${forced.room}`);
check(forced.sector === 8, '?sector= starts at the named sector', `${forced.sector}`);
check(forced.st.band === 'mid', 'and that sector resolves to the right band', forced.st.band);
check(forced.encounter === 'crossfire', '?encdbg=<id> forces that archetype through the real resolver',
  `${forced.encounter}`);

// ── 4. A bad id falls back to AUTO rather than forcing nothing ─────────────
const bogus = await run('?nodlg=1&encdbg=notarealarchetype', async (page) => {
  const r = await page.evaluate(probe);
  const sel = await page.evaluate(async () => {
    const { getEncForce } = await import('/src/systems/debug.js');
    return getEncForce();
  });
  return { ...r, sel };
});
check(bogus.sel === null, 'an unknown archetype id falls back to AUTO', `${bogus.sel}`);
check(bogus.encounter !== null, 'and the authored plan still resolves the wave', `${bogus.encounter}`);
check(bogus.encBtns === 3, 'the overlay is still raised by the flag itself', `${bogus.encBtns}`);

// ── 5. Every archetype is selectable, and forcing uses the real runtime ────
const cycle = await run('?nodlg=1&encdbg=1', async (page) => page.evaluate(async () => {
  const { ENCOUNTERS } = await import('/src/data/encounters.js');
  const { setEncForce } = await import('/src/systems/debug.js');
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const out = { selectable: [], leadOk: [], replayed: [] };
  for (const id of Object.keys(ENCOUNTERS)) {
    setEncForce(id);
    const why = gs._debugReplayWave();
    out.replayed.push({ id, why });
    out.selectable.push({ id, got: gs._encounter?.id ?? null });
    // The forced wave must go through the REAL queue builder, so its opening
    // must be the archetype's own authored lead.
    const lead = ENCOUNTERS[id].lead || [];
    const q = gs._spawnQueue || [];
    out.leadOk.push({ id, ok: lead.every((t, i) => q[i] === t) || ENCOUNTERS[id].fill === null });
  }
  setEncForce(null);
  const autoWhy = gs._debugReplayWave();
  out.auto = { why: autoWhy, got: gs._encounter?.id ?? null };
  // The cycle helper must walk AUTO plus every archetype and come home.
  const n = hud._encIds.length;
  const seen = new Set();
  for (let i = 0; i < n; i++) { hud._encCycle(1); seen.add(hud._encIds[hud._encSel]); }
  out.cycleCount = n;
  out.cycleCoversAll = Object.keys(ENCOUNTERS).every((id) => seen.has(id)) && seen.has(null);
  return out;
}));
const badSel = cycle.selectable.filter((x) => x.id !== x.got);
check(badSel.length === 0, 'every archetype can be forced and is what actually runs',
  badSel.map((x) => `${x.id}->${x.got}`).join('; '));
const badLead = cycle.leadOk.filter((x) => !x.ok);
check(badLead.length === 0, 'a forced wave is built by the REAL queue builder, lead and all',
  badLead.map((x) => x.id).join('; '));
const badReplay = cycle.replayed.filter((x) => x.why);
check(badReplay.length === 0, 'REPLAY succeeds in an ordinary arena', badReplay.map((x) => `${x.id}:${x.why}`).join('; '));
check(cycle.auto.why === null && cycle.auto.got !== null,
  'AUTO hands the wave back to the authored plan', JSON.stringify(cycle.auto));
check(cycle.cycleCount === 7, 'the selector walks AUTO plus all six archetypes', `${cycle.cycleCount}`);
check(cycle.cycleCoversAll, 'and every entry is reachable by cycling', '');

// ── 6. THE SAFETY: the boss room and the duel wave stay out ───────────────
const guarded = await run('?nodlg=1&encdbg=crossfire', async (page) => page.evaluate(async () => {
  const { ROOMS } = await import('/src/data/rooms.js');
  const { encounterFor } = await import('/src/data/encounters.js');
  const gs = window.game.scene.getScene('Game');

  // Boss room: forced hard, and it must still refuse.
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 900));
  const boss = {
    room: gs.roomSpec?.id,
    encounter: gs._encounter?.id ?? null,
    queue: gs._spawnQueue,
    gates: gs._gatePlan,
    replay: gs._debugReplayWave(),
    resolver: encounterFor(gs.roomSpec?.id, 0, gs.sector || 1),
  };

  // Duel wave: detention's last wave is the only miniBoss entry in the game.
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  await new Promise((r) => setTimeout(r, 900));
  const waves = gs._roomArenaCfg.waves;
  const duelIdx = waves.findIndex((w) => w.miniBoss);
  gs._startWave(duelIdx);
  await new Promise((r) => setTimeout(r, 500));
  const duel = {
    idx: duelIdx,
    encounter: gs._encounter?.id ?? null,
    queue: gs._spawnQueue,
    replay: gs._debugReplayWave(),
    miniBossAlive: gs._livingEnemyCount() >= 0,
  };
  return { boss, duel };
}));
check(guarded.boss.resolver === null, 'the resolver still returns null for the boss room under the flag', '');
check(guarded.boss.encounter === null && guarded.boss.queue === null && guarded.boss.gates === null,
  'A FORCED ARCHETYPE CANNOT CONVERT THE BOSS ROOM INTO AN ORDINARY ENCOUNTER',
  JSON.stringify(guarded.boss));
check(guarded.boss.replay === 'boss room', 'and REPLAY refuses there, with a reason', `${guarded.boss.replay}`);
check(guarded.duel.idx >= 0, 'detention still carries the duel wave', `${guarded.duel.idx}`);
check(guarded.duel.encounter === null && guarded.duel.queue === null,
  'A FORCED ARCHETYPE CANNOT COMPOSE THE NEMESIS DUEL WAVE', JSON.stringify(guarded.duel));
check(guarded.duel.replay === 'duel wave', 'and REPLAY refuses there too', `${guarded.duel.replay}`);

// ── 7. With the flag off, forcing is inert even if the id is set ──────────
const inert = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const { setEncForce, getEncForce, isEncDebug } = await import('/src/systems/debug.js');
  const gs = window.game.scene.getScene('Game');
  setEncForce('crossfire');                 // as if a previous debug run had set it
  gs._startWave(gs._waveIdx ?? 0);
  const out = { dbg: isEncDebug(), force: getEncForce(), got: gs._encounter?.id ?? null,
    replay: gs._debugReplayWave() };
  setEncForce(null);
  return out;
}));
check(inert.dbg === false, 'no flag: the debug switch is off', '');
check(inert.got !== 'crossfire', 'NO FLAG: A SET FORCE IS IGNORED — the authored plan still decides',
  `got ${inert.got}`);
check(inert.replay === 'debug off', 'no flag: REPLAY refuses outright', `${inert.replay}`);

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the harness is debug-only, real-runtime, and cannot reach the boss room or the duel`);
