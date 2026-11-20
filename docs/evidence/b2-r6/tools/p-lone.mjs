// The Super alone through each kit's own Web Audio path (createB2Audio, no rifle, no charge bed): wind-up at 0.52 s,
// the blast 7 ticks later (117 ms, the game at 60 fps), then three pellet hits; 44.1 kHz stereo float WAVs in LONE/.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '/home/user/crix/tests/diag-stuck-audit.mjs';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:5173/?nodlg=1');
await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
const out = await page.evaluate(async () => {
  const names = performance.getEntriesByType('resource').map((x) => x.name);
  const mod = await import(names.find((n) => /systems\/b2Audio\.js/.test(n)));
  const SR = 44100, o = {};
  for (const kind of ['B2RT', 'B2HC', 'B2RD', 'B2S']) {
    const ctx = new OfflineAudioContext(2, SR * 3, SR), dest = ctx.createGain(); dest.connect(ctx.destination);
    let T = 0; const a = mod.createB2Audio(kind, { ctx, dest, now: () => T });
    for (let tick = 0; tick < 170; tick++) { T = tick / 60; if (tick === 30) a.windup(); if (tick === 37) a.release(); if (tick === 40) { a.superHit(); a.superHit(); } if (tick === 44) a.superHit(); if (tick === 48) a.superHit(); a.update(1000 / 60, { heat: 0, firing: false, suppressed: false, dead: false, sup: false }); }
    const b = await ctx.startRendering(); o[kind] = { L: Array.from(b.getChannelData(0)), R: Array.from(b.getChannelData(1)), voices: a.stats.peakVoices, sup: a.stats.super };
  }
  return o;
});
await browser.close();
fs.mkdirSync('LONE', { recursive: true });
for (const [k, v] of Object.entries(out)) {
  const n = v.L.length, pcm = Buffer.alloc(n * 8); for (let i = 0; i < n; i++) { pcm.writeFloatLE(v.L[i], i * 8); pcm.writeFloatLE(v.R[i], i * 8 + 4); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(352800, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(`LONE/${k}.wav`, Buffer.concat([h, pcm])); console.log(k, 'voices', v.voices, JSON.stringify(v.sup).slice(0, 160));
}
