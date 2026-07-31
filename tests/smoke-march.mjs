// The Imperial March plays as a full 8-bar phrase, not a 6-beat fragment.
//
// The bug this protects against: the march used to be ONE 6-beat bar on
// repeat — the opening phrase only, restarting before it resolved. The fix is
// a 32-beat A+B phrase, so the falsifiable claims are about the SEQUENCE, not
// about loudness:
//
//   1. the phrase is 32 beats long before it repeats (was 6)
//   2. it uses the march's full pitch set (was 3 notes: A, F, C)
//   3. every note lands on the grid the drums are written against
//
// Measured by spying on ctx.createOscillator rather than by listening. Each
// march note builds exactly one TRIANGLE oscillator (its sub octave); the pad
// is sawtooth and the kick is sine, so triangles are a clean 1:1 record of the
// melody as scheduled. Sampling the audio instead would have to separate the
// bass line from a continuous pad drone sitting in the same octave — see
// tests/README.md on measurements that are really measuring something else.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BEAT = 0.46;
const EXPECT_BEATS = 32;      // 8 bars of 4/4
const EXPECT_NOTES = 42;      // notes in the phrase, rests excluded

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
await page.mouse.click(360, 640);      // unlock audio
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

// Two full phrases plus a bar of overlap. One phrase is enough for the note
// sequence; the second is what makes a voice leak visible, since a list that is
// correctly bounded at two bars and one that grows forever look identical over
// a single pass.
const RECORD_S = EXPECT_BEATS * BEAT * 2 + 3;

const result = await page.evaluate(async (RECORD_MS) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // The exact module instance the app loaded — a bare import gets a second
  // Vite-served copy whose module-scope audio nodes are all null.
  const url = performance.getEntriesByType('resource')
    .map((r) => r.name).find((n) => /systems\/FX\.js/.test(n));
  if (!url) return { error: 'FX.js not found in resource timing' };
  const FX = await import(url);
  const dbg = FX.__fxDebug();
  if (!dbg.ctx) return { error: 'no AudioContext — gesture did not unlock audio' };
  const ctx = dbg.ctx;

  // Freeze the arena for the length of the recording. Two things go wrong in a
  // live one, and both of them corrupt the measurement rather than failing it:
  //
  //   - the parked player dies, GameOverScene calls stopMusic(), and the
  //     recording ends early against a phrase that was never finished;
  //   - every blaster shot and explosion builds its own oscillators on this
  //     same context, and the triangles among them land in the note record.
  //
  // The music loop is a setTimeout on the audio clock, so it keeps running
  // while the scene is paused — which is exactly what makes this safe.
  window.game.scene.pause('Game');
  window.game.scene.pause('HUD');

  // Restart the bed from a known point so the recording begins at bar 1.
  FX.stopMusic();
  FX.setMusicIntensity(0);
  await sleep(300);

  const notes = [];
  const realCreateOsc = ctx.createOscillator.bind(ctx);
  let t0 = null;
  ctx.createOscillator = () => {
    const o = realCreateOsc();
    const realStart = o.start.bind(o);
    o.start = (when) => {
      if (o.type === 'triangle') {
        if (t0 === null) t0 = when;
        notes.push({ at: when - t0, f: Math.round(o.frequency.value * 100) / 100 });
      }
      return realStart(when);
    };
    return o;
  };

  FX.startMusic();
  // Sample the held-voice count throughout rather than reading it once at the
  // end. A single read lands wherever it lands — it measured 0 on one run and
  // 60 on the next, and a 0 would have passed a "no leak" assertion for the
  // wrong reason.
  const voiceSamples = [];
  const step = 300;
  // Wall clock, not the loop counter: each pass costs its sleep PLUS the
  // sampling work, so `iterations * step` under-reports the real recording
  // window by a third and made an exactly-correct phrase look like it was
  // scheduling 35% too many notes.
  const tStart = performance.now();
  while (performance.now() - tStart < RECORD_MS) {
    await sleep(step);
    voiceSamples.push(FX.__fxDebug().musicBarVoices);
  }
  const elapsedS = (performance.now() - tStart) / 1000;
  const stoppedEarly = !FX.__fxDebug().musicStarted;
  FX.stopMusic();
  ctx.createOscillator = realCreateOsc;
  window.game.scene.resume('Game');
  window.game.scene.resume('HUD');

  return {
    notes,
    stoppedEarly,
    elapsedS,
    voiceMax: Math.max(...voiceSamples),
    voiceMin: Math.min(...voiceSamples),
    // Late-vs-early mean: a bounded list is flat across the recording, a
    // leaking one is monotonically higher in its second half.
    voiceEarly: voiceSamples.slice(0, 10).reduce((a, b) => a + b, 0) / 10,
    voiceLate: voiceSamples.slice(-10).reduce((a, b) => a + b, 0) / 10,
    ringingAfterStop: FX.__fxDebug().musicBarVoices,
  };
}, RECORD_S * 1000);

await browser.close();

const fail = [];
if (result.error) {
  console.error(`FAIL  ${result.error}`);
  process.exit(1);
}

const notes = result.notes;
const expectNotes = result.elapsedS / (EXPECT_BEATS * BEAT) * EXPECT_NOTES;
console.log(`recorded ${notes.length} melody notes over ${result.elapsedS.toFixed(1)}s `
  + `(expect ~${expectNotes.toFixed(0)})`);
// The bed must still be running at the end. Something stopping it mid-recording
// (the player dying, a scene shutdown) makes every check below measure a
// truncated phrase and pass for the wrong reason.
if (result.stoppedEarly) fail.push('music stopped before the recording ended');
if (notes.length < expectNotes * 0.9) {
  fail.push(`only ${notes.length} notes recorded, expected ~${expectNotes.toFixed(0)} — cut short`);
}
// Upper bound catches the failure the other way round: a second loop running
// against one context, or a phrase restarting early, both show up as notes
// arriving faster than the phrase can produce them.
if (notes.length > expectNotes * 1.15) {
  fail.push(`${notes.length} notes recorded, expected ~${expectNotes.toFixed(0)} — scheduling too fast`);
}

// ── 1. Phrase length ───────────────────────────────────────────────────────
// Find where the sequence repeats: the first note whose (pitch, beat-in-phrase)
// re-runs the opening. Measured in beats off the recorded onsets, so it fails
// on the old build at 6 and passes here at 32.
const beatsOf = (s) => Math.round((s / BEAT) * 100) / 100;
const first = notes[0];
const repeatIdx = notes.findIndex((n, i) => i > 0 && n.f === first.f
  && Math.abs(beatsOf(n.at) - Math.round(beatsOf(n.at))) < 0.05
  && notes[i + 1] && notes[i + 1].f === notes[1].f
  && notes[i + 2] && notes[i + 2].f === notes[2].f
  && notes[i + 3] && notes[i + 3].f === notes[3].f);
const phraseBeats = repeatIdx > 0 ? Math.round(beatsOf(notes[repeatIdx].at)) : null;
console.log(`phrase repeats after ${phraseBeats} beats (expect ${EXPECT_BEATS})`);
if (phraseBeats !== EXPECT_BEATS) {
  fail.push(`phrase is ${phraseBeats} beats, expected ${EXPECT_BEATS}`);
}
if (repeatIdx !== EXPECT_NOTES) {
  fail.push(`phrase has ${repeatIdx} notes, expected ${EXPECT_NOTES}`);
}

// ── 2. Pitch set ───────────────────────────────────────────────────────────
// The old fragment used three pitches. The full march walks a chromatic line
// through the B section, so anything under ~12 means the B section is missing.
const phrase = notes.slice(0, repeatIdx > 0 ? repeatIdx : notes.length);
const pitches = [...new Set(phrase.map((n) => n.f))].sort((a, b) => a - b);
console.log(`distinct pitches: ${pitches.length} — ${pitches.join(', ')}`);
if (pitches.length < 12) {
  fail.push(`only ${pitches.length} distinct pitches — the B section is not playing`);
}
// The tonic and the two notes of the hook must all be there.
for (const [name, f] of [['A2', 110], ['F2', 87.31], ['C3', 130.81], ['A3', 220], ['E3', 164.81]]) {
  if (!pitches.includes(f)) fail.push(`missing ${name} (${f}Hz)`);
}

// ── 3. Grid ────────────────────────────────────────────────────────────────
// Every onset must be a multiple of a sixteenth, or the melody has drifted out
// of phase with a drum kit written against a fixed 4-beat bar.
const offGrid = phrase.filter((n) => {
  const sixteenths = beatsOf(n.at) * 4;
  return Math.abs(sixteenths - Math.round(sixteenths)) > 0.02;
});
console.log(`off-grid onsets: ${offGrid.length}`);
if (offGrid.length) {
  fail.push(`${offGrid.length} notes off the sixteenth grid, first at beat ${beatsOf(offGrid[0].at)}`);
}

// ── 4. Bookkeeping ─────────────────────────────────────────────────────────
// Voices are held for at most two bars. The busiest pair (bars 6-7, seven notes
// each at four oscillators a note, plus the kit) comes to just under 120, so a
// correctly bounded list peaks around there and stays flat; an unbounded one
// climbs for the whole run.
console.log(`bar voices: min ${result.voiceMin}, max ${result.voiceMax}, `
  + `early mean ${result.voiceEarly.toFixed(1)} → late mean ${result.voiceLate.toFixed(1)}`);
console.log(`after stop: ${result.ringingAfterStop}`);
if (result.voiceMax === 0) fail.push('no voices ever held — the bar list is not being populated');
if (result.voiceMax > 140) fail.push(`${result.voiceMax} bar voices held — more than two bars`);
if (result.voiceLate > result.voiceEarly * 1.6 + 20) {
  fail.push(`bar voices grew ${result.voiceEarly.toFixed(1)} → ${result.voiceLate.toFixed(1)} — leak`);
}
if (result.ringingAfterStop !== 0) fail.push(`stopMusic left ${result.ringingAfterStop} voices`);

const barWarnings = warnings.filter((w) => w.includes('[music]'));
if (barWarnings.length) fail.push(`bar-length warnings: ${barWarnings.join(' | ')}`);
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

if (fail.length) {
  console.error('\nFAIL');
  fail.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('\nPASS  full 8-bar Imperial March phrase');
