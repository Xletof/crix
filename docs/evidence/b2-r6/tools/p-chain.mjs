// What the R5 Super bus chain (comp3 -> pre 0.5 -> tanh clip) removes from Heavy Cannon / Reactor Detonation:
// renders each with the shipped chain and with the chain bypassed (superBus -> dest, same gain) in an
// OfflineAudioContext; also measures the Chrome DynamicsCompressor's makeup gain and latency (comp3 settings).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '/home/user/crix/tests/diag-stuck-audit.mjs';
import fs from 'fs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5173/?nodlg=1');
await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const src = await (await fetch('/src/systems/b2Audio.js')).text();
  const abs = (s) => s.replace(/from\s+["'](\/[^"']+)["']/g, (m, p) => `from "${location.origin}${p}"`);
  const variants = {
    chain: abs(src),
    bypass: abs(src.replace('superBus.connect(comp3); comp3.connect(pre); pre.connect(clip); clip.connect(d.sfxGain);', 'superBus.connect(d.sfxGain);')),
  };
  if (variants.bypass === variants.chain) return { err: 'patch failed' };
  const mods = {};
  for (const [k, v] of Object.entries(variants)) mods[k] = await import(URL.createObjectURL(new Blob([v], { type: 'text/javascript' })));
  const SR = 44100;
  const render = async (mod, kind) => {
    const secs = 2.0, ctx = new OfflineAudioContext(1, SR * secs, SR), dest = ctx.createGain(); dest.connect(ctx.destination);
    let T = 0; const a = mod.createB2Audio(kind, { ctx, dest, now: () => T });
    const W = 0.3, R = W + 70 / 1000;
    for (let tick = 0; tick < 60 * secs; tick++) {
      T = tick / 60;
      if (tick === Math.round(W * 60)) a.windup();
      if (tick === Math.round(R * 60)) a.release();
      a.update(1000 / 60, { heat: 0, firing: false, suppressed: false, dead: false, sup: false });
    }
    const b = await ctx.startRendering(); return Array.from(b.getChannelData(0));
  };
  const o = {};
  for (const kind of ['B2HC', 'B2RD']) for (const k of ['chain', 'bypass']) o[`${kind}-${k}`] = await render(mods[k], kind);
  // the compressor alone (comp3 settings): makeup gain on a -40 dBFS 1 kHz sine; latency on an impulse
  const comp = async (sig) => {
    const ctx = new OfflineAudioContext(1, SR, SR), b = ctx.createBuffer(1, SR, SR); b.getChannelData(0).set(sig);
    const s = ctx.createBufferSource(); s.buffer = b; const c = ctx.createDynamicsCompressor();
    c.threshold.value = -14; c.knee.value = 4; c.ratio.value = 6; c.attack.value = 0.008; c.release.value = 0.12;
    s.connect(c); c.connect(ctx.destination); s.start(0); return Array.from((await ctx.startRendering()).getChannelData(0));
  };
  const sine = new Float32Array(SR).map((_, i) => 0.01 * Math.sin(2 * Math.PI * 1000 * i / SR));
  const imp = new Float32Array(SR); imp[1000] = 0.001;
  const so = await comp(sine), io = await comp(imp);
  const rmsIn = 0.01 / Math.SQRT2, tail = so.slice(SR / 2); const rmsOut = Math.sqrt(tail.reduce((s, v) => s + v * v, 0) / tail.length);
  let ip = 0, ii = 0; io.forEach((v, i) => { if (Math.abs(v) > ip) { ip = Math.abs(v); ii = i; } });
  o.compMakeupDb = 20 * Math.log10(rmsOut / rmsIn); o.compLatencyMs = (ii - 1000) / SR * 1000;
  return o;
});
if (res.err) { console.log(res.err); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const wav = (arr) => { const pcm = Buffer.alloc(arr.length * 4); arr.forEach((v, i) => pcm.writeFloatLE(v, i * 4)); const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(176400, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
for (const [k, v] of Object.entries(res)) if (Array.isArray(v)) fs.writeFileSync(`${out}/${k}.wav`, wav(v));
console.log('comp3 makeup (dB, -40 dBFS sine):', res.compMakeupDb.toFixed(2), ' latency (ms):', res.compLatencyMs.toFixed(2));
await browser.close();
