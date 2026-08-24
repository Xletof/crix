// DIAGNOSTIC — how often does the room actually lose power?
//
// The handset verdict on the previous build was that Vader 6 SPAMS LIGHTS OUT.
// This runs a real encounter-6 fight on the production scheduler — nothing
// silenced, both producers free-running — and records every darkness the
// player would have seen.
//
// It hooks `set-darkness`, not the new state owner, ON PURPOSE: that event is
// the last thing both builds have in common, so the same rig measures the
// build this replaces and the numbers are comparable rather than asserted.
//
//   node tests/diag-lights-cadence.mjs [seconds]
//
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const SECONDS = Number(process.argv[2] || 75);
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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 424242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(900, 500); await new Promise((r) => setTimeout(r, 700)); }

  // THE MEASURING BOT NEVER DIES, and never wins either: a death or a kill
  // would cut the sample short and the cadence numbers would describe a
  // shorter fight than the one the human plays. Nothing else is touched — both
  // darkness clocks, every move and every other mechanic run for real.
  gs.lives = 9999;
  window.__t0 = performance.now();
  window.__tape = [];
  gs.events.on('set-darkness', (on, mode) => {
    if (mode !== 'blackout') return;   // ignore the persistent room modifier
    window.__tape.push({ t: Math.round(performance.now() - window.__t0), on: !!on });
  });
});

// Keep the bot alive and moving without ever firing — a dead or victorious bot
// stops the clocks this rig exists to watch.
const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    if (!gs?.player) return;
    gs.player.hp = gs.player.hpMax;
    if (!gs.player.alive) { gs.player.alive = true; gs.player.setActive(true).setVisible(true); }
    if (gs.boss) gs.boss.hp = gs.boss.hpMax;
    const a = performance.now() * 0.0011;
    gs.player.setPosition(800 + Math.cos(a) * 380, 800 + Math.sin(a * 1.3) * 380);
  });
  await page.waitForTimeout(700);
}

const out = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { tape: window.__tape, log: gs._lightsLog ?? null,
           elapsed: Math.round(performance.now() - window.__t0) };
});

// ── Fold the raw on/off tape into events ────────────────────────────────
const events = []; let open = null;
for (const e of out.tape) {
  if (e.on && !open) open = e.t;
  else if (!e.on && open != null) { events.push({ start: open, end: e.t, ms: e.t - open }); open = null; }
  else if (e.on && open != null) events.push({ start: open, end: e.t, ms: 0, note: 'RE-RAISED WHILE ALREADY ON' });
}
if (open != null) events.push({ start: open, end: null, ms: null, note: 'still dark at sample end' });

const gaps = [];
for (let i = 1; i < events.length; i++) if (events[i - 1].end != null) gaps.push(events[i].start - events[i - 1].end);

const R = {
  sampleMs: out.elapsed,
  rawTransitions: out.tape.length,
  activations: events.length,
  events,
  gapsBetweenEventsMs: gaps,
  minGapMs: gaps.length ? Math.min(...gaps) : null,
  perMinute: +(events.length / (out.elapsed / 60000)).toFixed(2),
  requestLog: out.log,
};
if (out.log) {
  R.verdicts = out.log.reduce((a, e) => { a[e.verdict] = (a[e.verdict] || 0) + 1; return a; }, {});
  R.bySource = out.log.filter((e) => e.source)
    .reduce((a, e) => { a[e.source] = (a[e.source] || 0) + 1; return a; }, {});
}
console.log(JSON.stringify(R, null, 2));
writeFileSync('docs/evidence/dark-arena/cadence.json', JSON.stringify(R, null, 2));
await browser.close();
