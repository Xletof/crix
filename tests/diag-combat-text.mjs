// What is the combat text actually covering?
//
// Print-only, like the other diag-* scripts: no thresholds, no pass/fail. It
// exists because the question "can I still see the fight" is not answerable
// from source. Damage numbers are created by `fx.damageNumber` at depth 30,
// telegraphs draw at 12-14 and actors Y-SORT (depth = y, ~150-1656), so the
// static draw order alone says text is over every telegraph and under every
// body. Whether that MATTERS depends on how many labels are alive at once and
// where they land, which is a runtime measurement.
//
// Sampled from inside the page on `postupdate` — `page.evaluate` polling costs
// 200-400ms a round trip and would miss most of a 750ms label (tests/README).
//
// Usage:  node tests/diag-combat-text.mjs [--label baseline] [--shots]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? (process.argv[i + 1] ?? d) : d;
};
const LABEL = arg('--label', 'run');
const SHOTS = process.argv.includes('--shots');
// Re-shooting the frozen frames is a 40s job; re-running the six timed
// scenarios to get to them is a 6-minute one.
const ONLY_FROZEN = process.argv.includes('--only-frozen');
const OUT = `docs/evidence/combat-text/${LABEL}`;
if (SHOTS) mkdirSync(OUT, { recursive: true });

const PAGE_URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error(`pageerror: ${e.message}`));

await page.goto(PAGE_URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// ── The census ────────────────────────────────────────────────────────────
//
// Installed once and left running. Every sample is one frame's answer to four
// questions, accumulated in the page so nothing crosses the bridge per-frame:
//
//   live      how many combat-text objects exist right now
//   onBody    how many of them overlap an actor's drawn box (player, enemy,
//             boss) — the "can I see who I am hitting" number
//   onZone    how many overlap a LIVE telegraph, tested with the telegraph's
//             own `contains()` so the answer matches the hit test exactly
//   created   total allocations, for the churn/GC question
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const S = window.__textCensus = {
    frames: 0, live: [], onBody: [], onZone: [], created: 0, hudLive: [],
    peakLive: 0, peakOnBody: 0, peakOnZone: 0, worst: null,
  };

  // Count allocations at the source rather than inferring them from the
  // display list: a label that lives 750ms is invisible to a frame census the
  // moment it is destroyed, and churn is the allocation question.
  const orig = gs.fx.damageNumber.bind(gs.fx);
  gs.fx.damageNumber = (...a) => { S.created++; return orig(...a); };

  // VISIBLE, not merely present. Combat text is pooled: a retired label stays
  // in the display list forever with its old string still set, so a census that
  // only checks `type === 'Text'` counts the whole pool from the moment it is
  // warm and reports MORE clutter after a change that removed some. That is a
  // broken instrument reading a fixed game, which is the failure mode this
  // repo's notes warn about — the check is on what is drawn.
  const isCombatText = (o) => o.type === 'Text' && o !== gs._doorLabel
    && !o.parentContainer && o.visible && o.alpha > 0.02;

  const boxOf = (o) => {
    const w = o.displayWidth ?? o.width ?? 0;
    const h = o.displayHeight ?? o.height ?? 0;
    return { l: o.x - w / 2, r: o.x + w / 2, t: o.y - h / 2, b: o.y + h / 2 };
  };
  const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

  gs.events.on('postupdate', () => {
    S.frames++;
    const texts = gs.children.list.filter(isCombatText);
    // HUD text is a separate scene and a separate lane (banner, combo, medal,
    // score popups). Counted apart so the two are never confused.
    S.hudLive.push(hud?.children?.list?.filter((o) => o.type === 'Text' && o.alpha > 0.02).length ?? 0);

    const actors = [];
    if (gs.player?.active) actors.push(gs.player);
    for (const e of gs.enemies.getChildren()) if (e.active && e.alive) actors.push(e);
    if (gs.boss?.active && gs.boss.alive) actors.push(gs.boss);

    const zones = (gs._telegraphs || []).filter((t) => t && !t.dead && !t.safe);

    let onBody = 0, onZone = 0;
    for (const o of texts) {
      const bx = boxOf(o);
      if (actors.some((a) => overlaps(bx, boxOf(a)))) onBody++;
      // Four corners plus the centre against the zone's OWN hit test, so a
      // label clipping the edge of a lane counts.
      const pts = [[o.x, o.y], [bx.l, bx.t], [bx.r, bx.t], [bx.l, bx.b], [bx.r, bx.b]];
      if (zones.some((z) => pts.some((p) => { try { return z.contains(p[0], p[1]); } catch { return false; } })))
        onZone++;
    }
    S.live.push(texts.length);
    S.onBody.push(onBody);
    S.onZone.push(onZone);
    if (texts.length > S.peakLive) {
      S.peakLive = texts.length;
      S.worst = { live: texts.length, onBody, onZone, zones: zones.length, actors: actors.length };
    }
    S.peakOnBody = Math.max(S.peakOnBody, onBody);
    S.peakOnZone = Math.max(S.peakOnZone, onZone);
  });
});

// ── Drive real combat ─────────────────────────────────────────────────────
//
// Not a scripted damage() loop: the thing under measurement is what the SCREEN
// does when the player fights, and a synthetic damage call skips the melee arc,
// the super and the kill/combo cascade that produce most of the text.
const scenario = async (name, setup, ms) => {
  await page.evaluate(setup);
  await page.evaluate(() => {
    const S = window.__textCensus;
    S.mark = { frames: S.frames, created: S.created, live: S.live.length };
  });
  await page.waitForTimeout(ms);
  const r = await page.evaluate(() => {
    const S = window.__textCensus;
    const from = S.mark.live;
    const slice = (a) => a.slice(from);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const max = (a) => (a.length ? Math.max(...a) : 0);
    return {
      frames: S.frames - S.mark.frames,
      created: S.created - S.mark.created,
      liveAvg: avg(slice(S.live)), liveMax: max(slice(S.live)),
      bodyAvg: avg(slice(S.onBody)), bodyMax: max(slice(S.onBody)),
      zoneAvg: avg(slice(S.onZone)), zoneMax: max(slice(S.onZone)),
      hudMax: max(slice(S.hudLive)),
    };
  });
  const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(0)}%` : '—');
  console.log(
    `${name.padEnd(22)} live avg ${r.liveAvg.toFixed(1)} max ${String(r.liveMax).padStart(2)}` +
    ` | on body ${r.bodyAvg.toFixed(1)} max ${String(r.bodyMax).padStart(2)} (${pct(r.bodyAvg, r.liveAvg)})` +
    ` | on zone ${r.zoneAvg.toFixed(1)} max ${String(r.zoneMax).padStart(2)} (${pct(r.zoneAvg, r.liveAvg)})` +
    ` | hud max ${r.hudMax} | created ${r.created} (${(r.created / Math.max(1, r.frames / 60)).toFixed(1)}/s)`,
  );
  if (SHOTS) await page.screenshot({ path: `${OUT}/${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` });
  return r;
};

// Shared: hold the player alive and put N enemies in arm's reach, then let the
// real systems run. `autoFight` drives primary fire and melee from inside the
// page so input latency is not part of the measurement.
const combatSetup = (n, opts = {}) => `(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999;
  gs.arenaActive = true;
  const P = gs.player;
  P.hp = P.hpMax;
  ${opts.super ? 'P.superCharge = 99;' : ''}
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  for (let i = 0; i < ${n}; i++) {
    const a = (i / ${n}) * Math.PI * 2;
    const d = ${opts.dist ?? 120};
    gs.spawnEnemyAt('${opts.kind ?? 'grunt'}', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, {});
  }
  clearInterval(window.__auto);
  window.__auto = setInterval(() => {
    const g = window.game.scene.getScene('Game');
    if (!g?.player?.alive) return;
    g.lives = 9999; g.player.hp = g.player.hpMax;
    const e = g.enemies.getChildren().find((x) => x.alive);
    if (!e) return;
    const ang = Math.atan2(e.y - g.player.y, e.x - g.player.x);
    g.player.aim = ang; g.player.aiming = true;
    ${opts.melee ? 'g.player.meleeCharge = 99; g.player.tryMeleeCombo(ang);' : 'g.player.ammo = g.player.ammoMax; g.player.tryFire(ang);'}
    ${opts.super ? 'g.player.superCharge = 99; g.player.tryFireSuper(ang);' : ''}
  }, ${opts.everyMs ?? 130});
})()`;

console.log(`\n── combat text census (${LABEL}) ──────────────────────────────────`);
console.log('live = concurrent labels · on body = overlapping an actor · on zone = over a live danger telegraph\n');

if (!ONLY_FROZEN) {
await scenario('wave-ordinary', combatSetup(3, { dist: 190 }), 6000);
await scenario('crowded', combatSetup(9, { dist: 150 }), 6000);
await scenario('melee-crowd', combatSetup(8, { dist: 90, melee: true, everyMs: 220 }), 6000);
await scenario('super-burst', combatSetup(9, { dist: 160, super: true }), 6000);

// A nemesis: the only situation where a lethal telegraph and a hit burst are
// reliably on screen together, which is the whole "text over a zone" question.
await scenario('nemesis-duel', `(() => {
  const gs = window.game.scene.getScene('Game');
  clearInterval(window.__auto);
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.lives = 9999;
  gs._debugDuel?.({ base: 'shooter', traits: null, move: null, sector: 8 });
  window.__auto = setInterval(() => {
    const g = window.game.scene.getScene('Game');
    if (!g?.player?.alive) return;
    g.lives = 9999; g.player.hp = g.player.hpMax;
    const e = g.enemies.getChildren().find((x) => x.alive);
    if (!e) return;
    const ang = Math.atan2(e.y - g.player.y, e.x - g.player.x);
    g.player.aim = ang; g.player.aiming = true;
    g.player.ammo = g.player.ammoMax; g.player.tryFire(ang);
  }, 120);
})()`, 12000);

// Max clutter: everything at once — a crowd, melee, the super, and a boss.
await scenario('max-clutter', `(() => {
  const gs = window.game.scene.getScene('Game');
  clearInterval(window.__auto);
  gs.lives = 9999;
  window.__auto = setInterval(() => {
    const g = window.game.scene.getScene('Game');
    if (!g?.player?.alive) return;
    g.lives = 9999; g.player.hp = g.player.hpMax;
    if (g.enemies.getChildren().filter((x) => x.alive).length < 10) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        g.spawnEnemyAt('grunt', g.player.x + Math.cos(a) * 140, g.player.y + Math.sin(a) * 140, {});
      }
    }
    const e = g.enemies.getChildren().find((x) => x.alive);
    if (!e) return;
    const ang = Math.atan2(e.y - g.player.y, e.x - g.player.x);
    g.player.aim = ang; g.player.aiming = true;
    g.player.superCharge = 99; g.player.meleeCharge = 99; g.player.ammo = g.player.ammoMax;
    g.player.tryMeleeCombo(ang);
    g.player.tryFire(ang);
    g.player.tryFireSuper(ang);
  }, 100);
})()`, 10000);
}

// ── Frozen frames for the eye ─────────────────────────────────────────────
//
// The scenarios above are sampled while running, which is right for counting
// and wrong for looking: a 420ms label at ~10fps headless is three frames, and
// an action screenshot catches whatever happened to be mid-tween. These stop
// the world first.
//
// `scene.pause()`, not `tweens.timeScale = 0` — freezing the tween manager and
// pausing physics does NOT stop `scene.update`, so telegraphs keep ticking and
// destroy themselves before the shutter (CLAUDE.md).
const frozen = async (name, setup, settleMs = 700) => {
  await page.evaluate(setup);
  await page.waitForTimeout(settleMs);
  await page.evaluate(() => window.game.scene.getScene('Game').scene.pause());
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/frozen-${name}.png` });
  await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  console.log(`frozen-${name}`);
};

if (SHOTS) {
  // Broken Wings, casts 1-2 and the finisher. The finisher is the single
  // biggest thing the player does at close range, so it is the hardest test of
  // "can I still see my own body".
  const meleeAt = (stage) => `(async () => {
    const g = window.game.scene.getScene('Game');
    clearInterval(window.__auto);
    g.lives = 9999; g.player.hp = g.player.hpMax;
    g.enemies.getChildren().slice().forEach((e) => g._destroyEnemyFully(e));
    // Pin the actors. The camera follows the player and a melee lunge moves
    // them, so an unpositioned capture framed a patch of empty deck with the
    // cast happening off the edge of it. The subject has to be put in frame
    // deliberately; hoping it wanders into one is how you photograph a floor.
    g.player.setPosition(800, 800);
    g.cameras.main.centerOn(800, 800);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.spawnEnemyAt('grunt', 800 + Math.cos(a) * 95, 800 + Math.sin(a) * 95, {});
    }
    await new Promise((r) => setTimeout(r, 250));
    for (let k = 0; k < ${stage}; k++) {
      g.player.meleeCharge = 99;
      g.player.tryMeleeCombo(g.player.aim);
      await new Promise((r) => setTimeout(r, 260));
    }
  })()`;
  await frozen('brokenwings-cast1', meleeAt(1), 420);
  await frozen('brokenwings-cast2', meleeAt(2), 420);
  await frozen('brokenwings-finisher', meleeAt(3), 150);

  // Vader, mid-move, being hit. The one case where a lethal telegraph, a boss
  // body and a burst of damage text are all guaranteed on screen together.
  await frozen('vader-telegraph', `(async () => {
    const g = window.game.scene.getScene('Game');
    clearInterval(window.__auto);
    const { ROOMS } = await import('/src/data/rooms.js');
    g.sector = 15;
    g.loadRoom(ROOMS.find((r) => r.boss));
    await new Promise((r) => setTimeout(r, 2200));
    g.lives = 9999;
    g.enemies.getChildren().slice().forEach((e) => g._destroyEnemyFully(e));
    // WITH COORDINATES. spawnBoss(bx, by, opts) — calling it bare put no boss
    // in the room, _castBossMove then had nothing to cast on and returned
    // null, and the capture came back a clean empty floor that looked like a
    // pass. A refused call reads exactly like a successful one from outside;
    // the throw below is the difference (docs/POST-MORTEM-vader-moves.md).
    // DARKNESS dims the whole room to near-black, which is a legitimate
    // modifier and a useless photograph. Clear it for the capture only.
    window.game.scene.getScene('HUD')?.setDarkness?.(false);
    if (!g.boss?.alive) g.spawnBoss(760, 620);
    await new Promise((r) => setTimeout(r, 2000));
    if (!g.boss?.alive) throw new Error('vader capture: no boss in the room');
    // In frame WITH him, and close enough that his zone reaches the player —
    // the point of the frame is text, body and lethal telegraph together.
    g.player.setPosition(760, 940);
    g.cameras.main.centerOn(760, 780);
    g.player.hp = g.player.hpMax;
    // Cast a move so a zone is on the floor, then land real hits on him while
    // it winds up. Both halves have to be true for the frame to be worth a look.
    // RETRY UNTIL IT TAKES. _castBossMove returns null while Vader's own state
    // machine owns him mid-attack, which is most of the time — one shot at it
    // fails far more often than it lands. Retrying is right here; asserting the
    // cast actually happened is what keeps a refusal from photographing as a
    // quiet empty floor.
    let cast = null;
    for (let i = 0; i < 40 && !cast; i++) {
      cast = g._castBossMove(g.boss, 'saberthrow');
      if (!cast) await new Promise((r) => setTimeout(r, 120));
    }
    if (!cast) throw new Error('vader capture: move refused 40x, nothing to photograph');
    for (let i = 0; i < 7; i++) {
      if (g.boss?.alive) g.boss.damage(520);
      await new Promise((r) => setTimeout(r, 45));
    }
  })()`, 420);
}

const totals = await page.evaluate(() => {
  const S = window.__textCensus;
  clearInterval(window.__auto);
  return { frames: S.frames, created: S.created, peakLive: S.peakLive, peakOnBody: S.peakOnBody, peakOnZone: S.peakOnZone, worst: S.worst };
});
console.log(`\ntotals  frames ${totals.frames} · labels created ${totals.created} · peak live ${totals.peakLive} · peak on body ${totals.peakOnBody} · peak on zone ${totals.peakOnZone}`);
console.log(`worst frame: ${JSON.stringify(totals.worst)}`);
if (SHOTS) console.log(`shots -> ${OUT}/`);

await browser.close();
