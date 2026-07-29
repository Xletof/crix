// Cluster audio: the impact is THINNER, and the booster exists.
//
// "Thinner" has to be measured as a shape, not a level — turning the whole
// sound down would pass a naive loudness check while sounding identical in
// character. So the metric is the LOW band (150-500Hz, the "THONK") relative to
// the CRACK band (1-4kHz). That ratio must drop, and the crack must survive.
//
// Run under `git stash` to compare against the previous build.
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

const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const url = performance.getEntriesByType('resource').map((x) => x.name)
    .find((n) => /systems\/FX\.js/.test(n));
  if (!url) return { error: 'FX.js not in resource timing' };
  const FX = await import(url);
  const dbg = FX.__fxDebug();
  if (!dbg.ctx) return { error: 'no AudioContext' };

  // Free the main thread so setTimeout sampling is accurate at ~20fps.
  window.game.loop.stop();
  FX.setMusicVolume(0);
  await sleep(200);

  const ctx = dbg.ctx;
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  an.smoothingTimeConstant = 0;
  dbg.sfxBus.connect(an);
  const bins = new Float32Array(an.frequencyBinCount);
  const hz = ctx.sampleRate / an.fftSize;

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
      await sleep(6);
    }
    return 10 * Math.log10(peak + 1e-12);
  };

  // Measure one band per firing — the analyser can only be read live, so the
  // sound has to be replayed for each band rather than sampled twice.
  const measure = async (fn, lo, hi, ms = 320) => {
    await sleep(500);
    fn();
    return +(await peakBand(lo, hi, ms)).toFixed(2);
  };

  const impactLow   = await measure(() => FX.SFX.fragImpact(), 150, 500);
  const impactCrack = await measure(() => FX.SFX.fragImpact(), 1000, 4000);
  const hitCrack    = await measure(() => FX.SFX.hit(), 1000, 4000);
  const hasBoost    = typeof FX.SFX.fragBoost === 'function';
  const boostAir    = hasBoost ? await measure(() => FX.SFX.fragBoost(), 1000, 3500) : null;
  const boostLow    = hasBoost ? await measure(() => FX.SFX.fragBoost(), 150, 500) : null;

  return {
    hasBoost,
    impactLowDb: impactLow,
    impactCrackDb: impactCrack,
    thonkRatioDb: +(impactLow - impactCrack).toFixed(2),
    hitCrackDb: hitCrack,
    boostAirDb: boostAir,
    boostLowDb: boostLow,
  };
});

console.log(JSON.stringify(r, null, 2));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
