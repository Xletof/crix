// The music bed responds to the situation: tiers change what plays, and the
// director turns game state into heat.
//
// Everything here is measured by spying on node construction rather than by
// listening, because the claims are about WHAT IS SCHEDULED:
//
//   - a TRIANGLE oscillator is built once per melody note (marchVoice's sub
//     octave). The pad is sawtooth and the kick is sine, so triangles are a
//     clean 1:1 count of the tune.
//   - an AudioBufferSource is built once per noise-based percussion hit
//     (snare, hat), so buffer sources count the kit.
//
// Measuring the audio instead would mean separating a bass line from a
// continuous pad drone sitting in the same octave — see tests/README.md on
// measurements that are really measuring something else.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const warnings = [];
page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });

await page.goto('http://localhost:5173/');
await page.waitForTimeout(4000);
await page.mouse.click(360, 640);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const t = window.game?.scene?.getScene('Title');
  if (t?.sys?.isActive()) t.scene.start('Game');
});
await page.waitForFunction(() => {
  const gs = window.game?.scene?.getScene('Game');
  return !!(gs?.player && gs?.enemies);
}, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (re) => performance.getEntriesByType('resource')
    .map((r) => r.name).find((n) => re.test(n));

  const fxUrl = find(/systems\/FX\.js/);
  const dirUrl = find(/systems\/musicDirector\.js/);
  if (!fxUrl) return { error: 'FX.js not found in resource timing' };
  if (!dirUrl) return { error: 'musicDirector.js not found in resource timing' };
  const FX = await import(fxUrl);
  const DIR = await import(dirUrl);
  const ctx = FX.__fxDebug().ctx;
  if (!ctx) return { error: 'no AudioContext — gesture did not unlock audio' };

  // Freeze the arena: a live one kills the parked player (GameOverScene calls
  // stopMusic, truncating the recording) and fires SFX oscillators onto this
  // same context, which would land in the counts below as if they were music.
  window.game.scene.pause('Game');
  window.game.scene.pause('HUD');

  // Record melody notes and kit hits for one tier over a fixed wall-clock
  // window, and report the window that ACTUALLY elapsed — `passes * interval`
  // under-reports it by a third once the sampling work is counted.
  const record = async (tier, ms) => {
    FX.stopMusic();
    await sleep(250);
    FX.setMusicState({ tier, heat: tier === 'calm' ? 0 : 1 });
    const realOsc = ctx.createOscillator.bind(ctx);
    const realBuf = ctx.createBufferSource.bind(ctx);
    let melody = 0;
    let kit = 0;
    let kicks = 0;
    ctx.createOscillator = () => {
      const o = realOsc();
      const rs = o.start.bind(o);
      o.start = (w) => {
        if (o.type === 'triangle') melody++;
        if (o.type === 'sine') kicks++;   // the kick is the only sine in the bed
        return rs(w);
      };
      return o;
    };
    ctx.createBufferSource = () => {
      const s = realBuf();
      const rs = s.start.bind(s);
      s.start = (w) => { kit++; return rs(w); };
      return s;
    };
    const t0 = performance.now();
    FX.startMusic();
    while (performance.now() - t0 < ms) await sleep(200);
    const elapsed = (performance.now() - t0) / 1000;
    FX.stopMusic();
    ctx.createOscillator = realOsc;
    ctx.createBufferSource = realBuf;
    return { melody, kit, kicks, elapsed };
  };

  // ~4 bars each (a bar is 4 × 0.46s ≈ 1.84s).
  const combat = await record('combat', 7500);
  const calm = await record('calm', 7500);

  // ── Director: synthetic situations, no arena needed ──────────────────────
  const quiet = { combo: 0, lastKillAge: 99999, alive: 0, maxAlive: 12,
                  waveIdx: 0, waveCount: 3, hpFrac: 1 };
  const chaos = { combo: 6, lastKillAge: 100, alive: 12, maxAlive: 12,
                  waveIdx: 2, waveCount: 3, hpFrac: 0.2 };

  DIR.resetDirector();
  DIR.setMusicPhase('wave');
  // Rise: feed chaos in 250ms samples and watch heat climb.
  const rise = [];
  for (let i = 0; i < 12; i++) { DIR.tickDirector(250, chaos); rise.push(DIR.__directorDebug().heat); }
  // Fall: feed quiet from the top and watch it decay.
  const fall = [];
  for (let i = 0; i < 12; i++) { DIR.tickDirector(250, quiet); fall.push(DIR.__directorDebug().heat); }

  // A streak that has gone stale must stop contributing. Same combo count,
  // only the age of the last kill differs.
  DIR.resetDirector();
  DIR.setMusicPhase('wave');
  const freshSnap = { ...quiet, combo: 6, lastKillAge: 100 };
  const staleSnap = { ...quiet, combo: 6, lastKillAge: 99999 };
  for (let i = 0; i < 8; i++) DIR.tickDirector(250, freshSnap);
  const heatFresh = DIR.__directorDebug().heat;
  DIR.resetDirector();
  DIR.setMusicPhase('wave');
  for (let i = 0; i < 8; i++) DIR.tickDirector(250, staleSnap);
  const heatStale = DIR.__directorDebug().heat;

  // Phase must be able to veto heat: hot as hell, but on a breather.
  DIR.resetDirector();
  DIR.setMusicPhase('wave');
  for (let i = 0; i < 12; i++) DIR.tickDirector(250, chaos);
  const tierInWave = FX.getMusicState().tier;
  DIR.setMusicPhase('breather');
  DIR.tickDirector(250, chaos);
  const tierOnBreather = FX.getMusicState().tier;
  const heatOnBreather = DIR.__directorDebug().heat;

  DIR.resetDirector();
  FX.setMusicState({ tier: 'combat', heat: 0 });
  window.game.scene.resume('Game');
  window.game.scene.resume('HUD');

  return { combat, calm, rise, fall, heatFresh, heatStale,
           tierInWave, tierOnBreather, heatOnBreather };
});

await browser.close();

const fail = [];
if (result.error) {
  console.error(`FAIL  ${result.error}`);
  process.exit(1);
}

// ── 1. Calm drops the melody, but keeps a pulse ────────────────────────────
const { combat, calm } = result;
console.log(`combat: ${combat.melody} melody notes, ${combat.kit} noise hits, ${combat.kicks} kicks over ${combat.elapsed.toFixed(1)}s`);
console.log(`calm:   ${calm.melody} melody notes, ${calm.kit} noise hits, ${calm.kicks} kicks over ${calm.elapsed.toFixed(1)}s`);
if (combat.melody < 20) fail.push(`combat played only ${combat.melody} notes — the march is not running`);
if (calm.melody > combat.melody * 0.1) {
  fail.push(`calm played ${calm.melody} notes vs combat's ${combat.melody} — the melody is not being dropped`);
}
// Calm must be THINNER, not silent. The snare and hat rows go empty, so the
// noise-voice count drops to nothing — but the heartbeat kick has to survive,
// or "calm" is just the music breaking. The kick is a sine oscillator, which
// is why it needs counting separately from the noise voices.
if (calm.kit >= combat.kit) {
  fail.push(`calm scheduled ${calm.kit} noise hits vs combat's ${combat.kit} — the kit did not thin out`);
}
if (calm.kicks < 4) {
  fail.push(`calm scheduled only ${calm.kicks} kicks — the heartbeat is gone, so calm is silence, not rest`);
}

// ── 2. Heat rises faster than it falls ─────────────────────────────────────
const { rise, fall } = result;
console.log(`heat rise: ${rise.map((h) => h.toFixed(2)).join(' ')}`);
console.log(`heat fall: ${fall.map((h) => h.toFixed(2)).join(' ')}`);
// Largest single-sample move in each direction. Taking a fixed index instead
// reads zero once heat saturates at 1.0 — which it does by the third sample
// under maximum pressure, and did on the first run of this test.
const stepsOf = (arr, from) => arr.map((h, i) => (i ? h - arr[i - 1] : h - from));
const risePerStep = Math.max(...stepsOf(rise, 0));
const fallPerStep = Math.max(...stepsOf(fall, rise[rise.length - 1]).map((d) => -d));
console.log(`per-sample rise ${risePerStep.toFixed(3)} vs fall ${fallPerStep.toFixed(3)}`);
if (!(rise[rise.length - 1] > 0.5)) fail.push(`heat only reached ${rise[rise.length - 1].toFixed(2)} under maximum pressure`);
if (!(fall[fall.length - 1] < rise[rise.length - 1])) fail.push('heat did not decay when the pressure stopped');
if (!(risePerStep > fallPerStep * 1.5)) {
  fail.push(`heat rises at ${risePerStep.toFixed(3)}/sample and falls at ${fallPerStep.toFixed(3)} — attack is not faster than release`);
}

// ── 3. A stale kill streak stops counting ──────────────────────────────────
console.log(`heat with a fresh streak ${result.heatFresh.toFixed(3)} vs stale ${result.heatStale.toFixed(3)}`);
if (!(result.heatFresh > result.heatStale + 0.05)) {
  fail.push('a stale kill streak still contributes — lastKillAge is not being honoured');
}

// ── 4. Phase overrides heat ────────────────────────────────────────────────
console.log(`tier in wave '${result.tierInWave}' → on breather '${result.tierOnBreather}' (heat still ${result.heatOnBreather.toFixed(2)})`);
if (result.tierInWave !== 'combat') fail.push(`expected 'combat' during a hot wave, got '${result.tierInWave}'`);
if (result.tierOnBreather !== 'calm') {
  fail.push(`breather tier is '${result.tierOnBreather}' — heat is outvoting the lifecycle phase`);
}
if (!(result.heatOnBreather > 0.3)) {
  fail.push('heat collapsed on the breather — it should keep decaying so the next wave can swell from where it is');
}

const musicWarnings = warnings.filter((w) => w.includes('[music]'));
if (musicWarnings.length) fail.push(`config warnings: ${musicWarnings.join(' | ')}`);
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

if (fail.length) {
  console.error('\nFAIL');
  fail.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('\nPASS  tiers change the bed and the director tracks the situation');
