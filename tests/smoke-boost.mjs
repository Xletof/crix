// Booster envelope: does the thrust BURN for the dive, or blip and stop?
//
// Sampled at fixed time offsets, not fractional frames — a fractional sample
// point silently lands past the end of a short sound and then reports silence
// as "quiet", which is how an earlier version of this measurement in this
// session managed to pass on a build that had the defect.
//
// The dive is 620ms. A sustained burn must still be well above the noise floor
// at ~500ms; the previous 200ms blip must not be.
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
  const FX = await import(url);
  const dbg = FX.__fxDebug();
  if (!dbg.ctx) return { error: 'no AudioContext' };

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

  const bandNow = (lo, hi) => {
    an.getFloatFrequencyData(bins);
    let sum = 0, n = 0;
    for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < bins.length; i++) {
      sum += Math.pow(10, bins[i] / 10); n++;
    }
    return 10 * Math.log10((n ? sum / n : 0) + 1e-12);
  };

  await sleep(400);
  const floor = +bandNow(700, 3000).toFixed(2);

  // Fire once and walk the envelope at FIXED offsets from the call.
  const marks = [80, 200, 350, 500, 600];
  const env = [];
  const t0 = performance.now();
  FX.SFX.fragBoost(620);
  for (const m of marks) {
    while (performance.now() - t0 < m) await sleep(4);
    env.push({ ms: m, db: +bandNow(700, 3000).toFixed(2) });
  }
  await sleep(900);
  const after = +bandNow(700, 3000).toFixed(2);

  return { floorDb: floor, env, afterDb: after };
});

console.log(JSON.stringify(r, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (r.error) fails.push(r.error);
else {
  const at = (ms) => r.env.find((e) => e.ms === ms)?.db ?? -999;
  const overFloor = (ms) => at(ms) - r.floorDb;
  if (overFloor(80) < 6) fails.push(`boost never got going: ${at(80)}dB vs floor ${r.floorDb}dB`);
  // The load-bearing one — this is what "continuous until they explode" means.
  if (overFloor(500) < 6) {
    fails.push(`boost is not sustained: at 500ms it is ${at(500)}dB, only ${overFloor(500).toFixed(1)}dB over the floor`);
  }
  if (at(500) < at(80) - 12) {
    fails.push(`boost decayed too far by 500ms: ${at(80)} -> ${at(500)}dB`);
  }
  if (r.afterDb - r.floorDb > 6) fails.push('boost never stopped — still ringing 900ms after the dive should have ended');
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: the burn sustains through the dive and stops after');
await browser.close();
process.exit(fails.length ? 1 : 0);
