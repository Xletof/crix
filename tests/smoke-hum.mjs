// Saber hum on a PHONE speaker.
//
// The complaint was that the hum is nearly inaudible on mobile. That is not a
// volume problem and cannot be fixed with gain: a handset speaker has almost no
// output below ~400Hz, so energy sitting at 110/220/330Hz never leaves the
// device. So this measures the two bands separately —
//
//   sub  (80-380Hz)  : real on headphones, effectively thrown away on a phone
//   body (400-1600Hz): what a handset can actually reproduce
//
// and the claim being tested is that the PHONE-AUDIBLE band came up, not merely
// that the whole thing did. A/B this against the pre-change build with
// `git stash` before trusting it.
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
  an.fftSize = 4096;
  an.smoothingTimeConstant = 0;
  // Tapped at the MELEE bus, so the bus trim is included — that is the signal
  // that actually reaches the speaker.
  (dbg.meleeBus || dbg.sfxBus).connect(an);
  const bins = new Float32Array(an.frequencyBinCount);
  const hz = ctx.sampleRate / an.fftSize;

  const band = (lo, hi) => {
    an.getFloatFrequencyData(bins);
    let sum = 0, n = 0;
    for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < bins.length; i++) {
      sum += Math.pow(10, bins[i] / 10); n++;
    }
    return 10 * Math.log10((n ? sum / n : 0) + 1e-12);
  };

  await sleep(300);
  const floorSub = +band(80, 380).toFixed(2);
  const floorBody = +band(400, 1600).toFixed(2);

  // The hum is sustained, so it can be sampled at leisure once it is up.
  FX.SFX.meleeHumStart();
  await sleep(400);
  const sub = +band(80, 380).toFixed(2);
  const body = +band(400, 1600).toFixed(2);
  FX.SFX.meleeHumStop();
  await sleep(400);
  const after = +band(400, 1600).toFixed(2);

  return {
    floorSub, floorBody, sub, body, afterBody: after,
    bodyOverFloor: +(body - floorBody).toFixed(2),
    // How much of the hum lives where a phone can actually play it.
    bodyMinusSub: +(body - sub).toFixed(2),
    meleeBusGain: dbg.meleeBusGain,
  };
});

console.log(JSON.stringify(r, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (r.error) fails.push(r.error);
else {
  if (r.bodyOverFloor < 12) {
    fails.push(`phone-audible band is only ${r.bodyOverFloor}dB over the noise floor — still inaudible on a handset`);
  }
  // The shape claim: the hum must not be a sub-bass-only sound any more.
  if (r.bodyMinusSub < -12) {
    fails.push(`hum is still bottom-heavy: body band sits ${(-r.bodyMinusSub).toFixed(1)}dB BELOW the sub band, which is the band a phone cannot play`);
  }
  if (r.afterBody - r.floorBody > 6) fails.push('hum did not stop — oscillators left running after meleeHumStop');
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: hum carries in the phone-audible band and stops cleanly');
await browser.close();
process.exit(fails.length ? 1 : 0);
