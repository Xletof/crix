// Riven melee mix vs kill feedback.
//
// The claim under test: the melee now sits clearly ABOVE the kill sounds, and a
// finisher slam is no longer covered by its own kill-streak chime.
//
// Metric choice matters here. "Is the melee loud" is not falsifiable on its own,
// so everything is measured as a RATIO of the slam against the chime, at the
// master bus, in the band a phone speaker actually reproduces. That ratio is
// directly comparable between the old and new builds.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

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
  const gs = window.game.scene.getScene('Game');

  // Import the EXACT module instance the app loaded. A bare './FX.js' import
  // can get a different Vite-served copy, whose module-scope audio nodes are
  // all null, and every measurement silently reads zero.
  const url = performance.getEntriesByType('resource')
    .map((r) => r.name).find((n) => /systems\/FX\.js/.test(n));
  if (!url) return { error: 'FX.js not found in resource timing' };
  const FX = await import(url);
  const dbg = FX.__fxDebug();
  if (!dbg.ctx) return { error: 'no AudioContext — gesture did not unlock audio' };

  const ctx = dbg.ctx;
  // Silence the music bed: in a live arena it would otherwise dominate every
  // measurement of the SFX we care about.
  FX.setMusicVolume(0);

  // ── Chime timing FIRST, while the game loop is still running. This one needs
  // a live scene clock (gs.time.now / delayedCall); stopping the loop for the
  // level measurements below freezes it and the chime never fires at all.
  const chimeTimes = [];
  const origChime = FX.SFX.comboChime.bind(FX.SFX);
  FX.SFX.comboChime = (...a) => { chimeTimes.push(performance.now()); return origChime(...a); };

  // Baseline: an ordinary streak kill, no slam. Should be immediate.
  gs._slamChimeHoldUntil = 0;
  gs._lastKillTime = gs.time.now; gs._comboCount = 1;
  const tPlain = performance.now();
  gs._tickKillCombo();
  await sleep(900);
  const plainDelay = chimeTimes.length ? chimeTimes[0] - tPlain : null;

  // Now the same kill inside a finisher-slam window.
  chimeTimes.length = 0;
  gs._slamChimeHoldUntil = gs.time.now + 700;
  gs._lastKillTime = gs.time.now; gs._comboCount = 1;
  const tSlam = performance.now();
  gs._tickKillCombo();
  await sleep(3500);   // generous: a 350ms delayedCall measures 2-3x at ~20fps
  const slamChimeDelay = chimeTimes.length ? chimeTimes[0] - tSlam : null;
  const slamChimeMuffled = chimeTimes.length ? true : false;
  FX.SFX.comboChime = origChime;

  // Free the main thread so setTimeout-based envelope sampling is accurate —
  // at ~20fps the game loop otherwise dominates the scheduler and every
  // measurement lands late.
  window.game.loop.stop();
  await sleep(200);

  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  an.smoothingTimeConstant = 0;
  dbg.masterGain.connect(an);
  const bins = new Float32Array(an.frequencyBinCount);
  const hz = ctx.sampleRate / an.fftSize;

  // Peak energy in a band over a window — peak, not average, because these are
  // transients and an average is dominated by however long we happened to look.
  const peakBand = async (lo, hi, ms) => {
    let peak = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      an.getFloatFrequencyData(bins);
      let sum = 0, n = 0;
      for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < bins.length; i++) {
        sum += Math.pow(10, bins[i] / 10); n++;
      }
      const v = n ? sum / n : 0;
      if (v > peak) peak = v;
      await sleep(8);
    }
    return 10 * Math.log10(peak + 1e-12);
  };

  await sleep(300);
  const floor = await peakBand(150, 500, 120);

  // Slam alone, measured where a phone speaker lives (150-500Hz).
  FX.SFX.meleeSlam();
  const slamDb = await peakBand(150, 500, 420);
  await sleep(700);

  // Chime alone, measured in its own band (the arpeggio sits at 523Hz and up).
  FX.SFX.comboChime(3);
  const chimeDb = await peakBand(500, 1800, 420);
  await sleep(900);

  // Duck behaviour: does a slam actually pull the general bus down?
  const before = dbg.sfxBus ? dbg.sfxBus.gain.value : null;
  if (FX.duckSfx) FX.duckSfx(0.6, 600);
  await sleep(120);
  const during = dbg.sfxBus ? dbg.sfxBus.gain.value : null;
  await sleep(900);
  const after = dbg.sfxBus ? dbg.sfxBus.gain.value : null;

  return {
    plainChimeDelayMs: plainDelay === null ? null : Math.round(plainDelay),
    slamChimeDelayMs: slamChimeDelay === null ? null : Math.round(slamChimeDelay),
    slamChimeFired: slamChimeMuffled,
    hasSplitBuses: !!(dbg.sfxBus && dbg.meleeBus),
    meleeBusGain: dbg.meleeBusGain ?? null,
    sfxBusGain: dbg.sfxBusGain ?? null,
    floorDb: +floor.toFixed(2),
    slamDb: +slamDb.toFixed(2),
    chimeDb: +chimeDb.toFixed(2),
    slamOverChimeDb: +(slamDb - chimeDb).toFixed(2),
    duck: { before, during, after },
  };
});

console.log(JSON.stringify(result, null, 2));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
