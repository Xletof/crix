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
    // Pin the tempo for the density counts: a tier that also runs faster would
    // schedule more events per second for two different reasons at once, and
    // the count could not tell them apart. Tempo has its own claim below.
    FX.__fxPinTempo(0.46);
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

  // How many DISTINCT bars a tier's kit plays across one phrase. Two patterns
  // on repeat and five rotating ones are indistinguishable from a hit COUNT,
  // so this records where in the bar each hit lands and compares the shapes.
  const variety = async (tier, ms) => {
    FX.stopMusic();
    await sleep(250);
    FX.__fxPinTempo(0.46);
    FX.setMusicState({ tier, heat: 1 });
    const realBuf = ctx.createBufferSource.bind(ctx);
    const realOsc = ctx.createOscillator.bind(ctx);
    const raw = [];
    // The KICK has to be in the signature. It is an oscillator, not a buffer
    // source, and three of the five combat variations differ only in their
    // kick — counting noise voices alone made them indistinguishable and
    // reported five patterns as three.
    // Tagged by voice KIND, not merged. A kick and a hi-hat on the same
    // sixteenth are different patterns, but an untagged set collapses them —
    // which hid three of the five variations, because their kick pushes land
    // on steps a hat already occupies.
    ctx.createBufferSource = () => {
      const sp = realBuf();
      const rs = sp.start.bind(sp);
      sp.start = (w) => { raw.push(['n', w]); return rs(w); };
      return sp;
    };
    ctx.createOscillator = () => {
      const o = realOsc();
      const rs = o.start.bind(o);
      o.start = (w) => { if (o.type === 'sine') raw.push(['k', w]); return rs(w); };
      return o;
    };
    FX.startMusic();
    const tStart = performance.now();
    while (performance.now() - tStart < ms) await sleep(200);
    FX.stopMusic();
    ctx.createBufferSource = realBuf;
    ctx.createOscillator = realOsc;
    const t0 = Math.min(...raw.map((r) => r[1]));
    const onsets = raw.map(([kind, w]) => [kind, w - t0]);
    // Bucket onsets into bars, then into sixteenths within the bar.
    const barDur = 4 * 0.46;
    const bars = new Map();
    for (const [kind, at] of onsets) {
      const bar = Math.floor(at / barDur + 1e-6);
      const step = Math.round(((at / barDur) - bar) * 16);
      if (!bars.has(bar)) bars.set(bar, new Set());
      bars.get(bar).add(kind + step);
    }
    // Drop the first and last buckets. The recording starts and stops
    // mid-bar, so those two are partial and each looks like a pattern of its
    // own — which inflated a two-variation kit to a reported FOUR distinct
    // bars, enough to sail past a threshold meant to catch exactly that.
    const keys = [...bars.keys()].sort((a, b) => a - b).slice(1, -1);
    const sigs = keys.map((k) => [...bars.get(k)].sort().join(','));
    return { bars: sigs.length, distinct: new Set(sigs).size };
  };

  // ~4 bars each (a bar is 4 × 0.46s ≈ 1.84s).
  const combat = await record('combat', 7500);
  const calm = await record('calm', 7500);
  const hot = await record('hot', 7500);
  const heavy = await record('heavy', 7500);
  // A shade over two phrases, so every variation in an 8-entry order appears.
  const combatVariety = await variety('combat', 22000);

  // Melodic phrase length per tier, from the note SEQUENCE rather than from a
  // count: find where the opening run of pitches recurs. Same technique as
  // smoke-march.mjs, which is what proved the full march loops at 32 beats.
  const phraseBeats = async (tier, ms) => {
    FX.stopMusic();
    await sleep(250);
    FX.__fxPinTempo(0.46);
    FX.setMusicState({ tier, heat: 1 });
    const realOsc = ctx.createOscillator.bind(ctx);
    const notes = [];
    let t0 = null;
    ctx.createOscillator = () => {
      const o = realOsc();
      const rs = o.start.bind(o);
      o.start = (w) => {
        // Skip sting voices: they are triangles too, but not part of the tune.
        if (o.type === 'triangle' && o._fxRole !== 'sting') {
          if (t0 === null) t0 = w;
          notes.push({ at: w - t0, f: Math.round(o.frequency.value * 100) / 100 });
        }
        return rs(w);
      };
      return o;
    };
    FX.startMusic();
    const tStart = performance.now();
    while (performance.now() - tStart < ms) await sleep(200);
    FX.stopMusic();
    ctx.createOscillator = realOsc;
    const at = notes.findIndex((n, i) => i > 0
      && n.f === notes[0].f
      && notes[i + 1] && notes[i + 1].f === notes[1].f
      && notes[i + 2] && notes[i + 2].f === notes[2].f
      && notes[i + 3] && notes[i + 3].f === notes[3].f);
    return at > 0 ? Math.round(notes[at].at / 0.46) : null;
  };
  const combatPhrase = await phraseBeats('combat', 20000);
  const minibossPhrase = await phraseBeats('miniboss', 20000);

  // ── Level and band content of the kit itself ─────────────────────────────
  // Tapped at percBus, not musicGain: measuring the kit under the melody and
  // the pad would mostly measure the melody and the pad.
  //
  // The claim is the gain budget's whole purpose. Stacking layers at fixed
  // gain into a -10dB/12:1 compressor makes the busy tier QUIETER; it has to
  // hold its level while its CHARACTER moves up the spectrum.
  // RMS comes from a ScriptProcessor, not from polling an analyser. Polling
  // getFloatTimeDomainData on a timer grabs the most recent ~46ms of audio
  // whenever the timer happens to fire, so with impulsive material it
  // double-counts some kicks and misses others entirely: the first version of
  // this measured the SAME unchanged kit at 0.0255 and then 0.0326 on
  // consecutive runs. A ScriptProcessor sees every sample exactly once.
  const measure = async (tier, ms) => {
    FX.stopMusic();
    await sleep(250);
    FX.__fxPinTempo(0.46);
    FX.setMusicState({ tier, heat: 1 });
    const perc = FX.__fxDebug().percBus;
    const mute = ctx.createGain(); mute.gain.value = 0;
    mute.connect(ctx.destination);
    const chain = [];

    // One sample-exact energy tap. `filter` optionally band-limits it first.
    // The band ratio used to come from polling getFloatFrequencyData on a
    // timer, and swung between 0.09 and 0.23 on identical builds — the same
    // sampling flaw the RMS measurement had, just less obvious because the
    // number looked plausible either way. Filtering into its own ScriptProcessor
    // measures the band the way the RMS measures the whole.
    const tap = (filter) => {
      const sp = ctx.createScriptProcessor(4096, 1, 1);
      const acc = { sumSq: 0, n: 0, on: false };
      sp.onaudioprocess = (e) => {
        if (!acc.on) return;
        const d = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) { acc.sumSq += d[i] * d[i]; acc.n++; }
      };
      if (filter) { perc.connect(filter); filter.connect(sp); }
      else perc.connect(sp);
      sp.connect(mute);
      chain.push({ sp, filter, acc });
      return acc;
    };
    // 400Hz is the line that matters on this project: below it a handset
    // speaker delivers almost nothing (HANDOVER §7). So the question for an
    // escalation tier is not "is it louder" but "did it gain energy WHERE THE
    // PHONE CAN PLAY IT" — the same measurement smoke-hum.mjs makes.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 400;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const full = tap(null);
    const low = tap(lp);
    const phone = tap(hp);

    FX.startMusic();
    await sleep(1000);          // let the first bar land: measure steady state
    chain.forEach((c) => { c.acc.on = true; });
    const t0 = performance.now();
    while (performance.now() - t0 < ms) await sleep(50);
    chain.forEach((c) => { c.acc.on = false; });
    FX.stopMusic();
    chain.forEach((c) => {
      if (c.filter) { perc.disconnect(c.filter); c.filter.disconnect(); } else perc.disconnect(c.sp);
      c.sp.disconnect();
    });
    mute.disconnect();
    const rms = (a) => (a.n ? Math.sqrt(a.sumSq / a.n) : 0);
    return {
      rms: rms(full),
      phoneRms: rms(phone),
      subRms: rms(low),
      seconds: full.n / ctx.sampleRate,
    };
  };
  // Each tier measured twice, so the test can see its own repeatability rather
  // than trusting a single reading of a fluctuating signal.
  const lvlCombat = await measure('combat', 9200);   // 5 bars
  const lvlCombat2 = await measure('combat', 9200);
  const lvlHot = await measure('hot', 9200);

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

  // Phase vs heat. A breather is NOT a finished room: the bed keeps playing
  // through it and only quiets when the room is done. Both halves matter — the
  // second is what stops "stop going calm on wave clear" turning into "the calm
  // tier is never reached at all".
  DIR.resetDirector();
  DIR.setMusicPhase('wave');
  for (let i = 0; i < 12; i++) DIR.tickDirector(250, chaos);
  const tierInWave = FX.getMusicState().tier;
  DIR.setMusicPhase('breather');
  DIR.tickDirector(250, chaos);
  const tierOnBreather = FX.getMusicState().tier;
  const heatOnBreather = DIR.__directorDebug().heat;
  // And the room actually finishing still does quiet it, at whatever heat.
  DIR.setMusicPhase('upgrade');
  DIR.tickDirector(250, chaos);
  const tierOnUpgrade = FX.getMusicState().tier;

  // ── Tempo ramps, bounded and monotone ────────────────────────────────────
  // Released from the pin: this is the one claim that is ABOUT the tempo.
  FX.__fxPinTempo(null);
  FX.stopMusic();
  await sleep(250);
  FX.setMusicState({ tier: 'combat', heat: 0 });
  FX.startMusic();
  await sleep(2500);                       // settle at the base tempo
  const beatFrom = FX.__fxDebug().musicBeat;
  FX.setMusicState({ tier: 'hot', heat: 1 });
  const beats = [];
  const tStart = performance.now();
  while (performance.now() - tStart < 14000) {
    await sleep(200);
    const b = FX.__fxDebug().musicBeat;
    if (b !== beats[beats.length - 1]) beats.push(b);
  }
  FX.stopMusic();
  FX.__fxPinTempo(0.46);

  // Boss ladder. Phase outranks heat entirely, and each Vader phase should
  // thicken the half-time kit rather than fall back to a combat tier.
  DIR.resetDirector();
  DIR.setMusicPhase('wave');
  for (let i = 0; i < 12; i++) DIR.tickDirector(250, chaos);   // heat pinned at 1
  const bossTiers = [];
  DIR.setMusicPhase('boss');
  bossTiers.push(FX.getMusicState().tier);
  for (const p of [2, 3]) { DIR.setBossPhase(p); bossTiers.push(FX.getMusicState().tier); }
  // A mini-boss is heavy too, even mid-wave with the room full.
  DIR.resetDirector();
  DIR.setMusicPhase('wave');
  for (let i = 0; i < 12; i++) DIR.tickDirector(250, chaos);
  DIR.setMusicPhase('miniboss');
  const miniTier = FX.getMusicState().tier;
  DIR.tickDirector(250, chaos);
  const miniTierAfterTick = FX.getMusicState().tier;

  DIR.resetDirector();
  FX.setMusicState({ tier: 'combat', heat: 0 });
  window.game.scene.resume('Game');
  window.game.scene.resume('HUD');

  return { combat, calm, hot, heavy, combatVariety, combatPhrase, minibossPhrase, lvlCombat, lvlCombat2, lvlHot, rise, bossTiers,
           beatFrom, beats,
           miniTier, miniTierAfterTick, tierOnUpgrade, fall, heatFresh, heatStale,
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

// ── 2. The hot tier is busier, and does not get quieter for it ─────────────
const { hot, lvlCombat, lvlHot } = result;
console.log(`hot:    ${hot.melody} melody notes, ${hot.kit} noise hits, ${hot.kicks} kicks over ${hot.elapsed.toFixed(1)}s`);
const hotRate = hot.kit / hot.elapsed;
const combatRate = combat.kit / combat.elapsed;
console.log(`kit density: combat ${combatRate.toFixed(1)}/s -> hot ${hotRate.toFixed(1)}/s`);
if (!(hotRate > combatRate * 1.3)) {
  fail.push(`hot schedules ${hotRate.toFixed(1)} kit hits/s vs combat's ${combatRate.toFixed(1)} — no escalation`);
}
// The melody must keep playing; escalation is the KIT thickening, not the tune
// being replaced.
if (hot.melody < combat.melody * 0.8) {
  fail.push(`hot played ${hot.melody} notes vs combat's ${combat.melody} — the melody thinned out`);
}
// Repeatability first: if the same tier measures differently twice, nothing
// below it means anything.
const drift = Math.abs(result.lvlCombat2.rms - lvlCombat.rms) / lvlCombat.rms;
console.log(`kit RMS: combat ${lvlCombat.rms.toFixed(4)} / ${result.lvlCombat2.rms.toFixed(4)} `
  + `(${(drift * 100).toFixed(1)}% drift over ${lvlCombat.seconds.toFixed(1)}s) -> hot ${lvlHot.rms.toFixed(4)}`);
if (drift > 0.08) {
  fail.push(`the same tier measured ${(drift * 100).toFixed(1)}% apart twice — the measurement is unstable, `
    + 'so the comparison below cannot be trusted');
}
const phoneGain = lvlHot.phoneRms / lvlCombat.phoneRms;
console.log(`phone band (>400Hz): combat ${lvlCombat.phoneRms.toFixed(4)} -> hot ${lvlHot.phoneRms.toFixed(4)} `
  + `(${phoneGain.toFixed(2)}x)`);
console.log(`sub band (<400Hz):   combat ${lvlCombat.subRms.toFixed(4)} -> hot ${lvlHot.subRms.toFixed(4)}`);
if (!(lvlHot.rms >= lvlCombat.rms * 0.9)) {
  fail.push(`hot kit measures ${lvlHot.rms.toFixed(4)} RMS vs combat's ${lvlCombat.rms.toFixed(4)} — `
    + 'stacking layers made it QUIETER, which is the compressor eating the extra density');
}
// Holding the overall level is only half the claim. The escalation has to be
// audible on the device this game is played on, and below 400Hz a handset
// delivers almost nothing — so the added density must show up ABOVE that line,
// or the hot tier is escalation the player cannot hear.
if (!(phoneGain > 1.15)) {
  fail.push(`the phone-audible band only moved ${phoneGain.toFixed(2)}x from combat to hot — `
    + 'the extra density is not landing where a handset can reproduce it');
}

// ── 3. Ordinary combat is not two bars on repeat ───────────────────────────
const cv = result.combatVariety;
console.log(`combat kit: ${cv.distinct} distinct bar patterns across ${cv.bars} bars`);
if (cv.distinct < 4) {
  fail.push(`combat plays only ${cv.distinct} distinct bar patterns — it is repeating itself`);
}

// ── 4. The mini-boss plays its own theme ───────────────────────────────────
// Not the wave music with heavier drums: a different, shorter phrase.
console.log(`phrase length: combat ${result.combatPhrase} beats, mini-boss ${result.minibossPhrase} beats`);
if (result.combatPhrase !== 32) {
  fail.push(`combat phrase measured ${result.combatPhrase} beats, expected 32`);
}
if (result.minibossPhrase !== 16) {
  fail.push(`mini-boss phrase measured ${result.minibossPhrase} beats, expected 16 — `
    + 'it is not playing the B-section loop');
}

// ── 5. Half-time is heavier, not busier ────────────────────────────────────
// The claim that separates a boss from "the same music, louder": the kit drops
// to half speed while the tune carries on completely unchanged.
const { heavy } = result;
console.log(`heavy:  ${heavy.melody} melody notes, ${heavy.kit} noise hits, ${heavy.kicks} kicks over ${heavy.elapsed.toFixed(1)}s`);
const melodyRate = (r) => r.melody / r.elapsed;
const kitRate = (r) => r.kit / r.elapsed;
const melodyDelta = Math.abs(melodyRate(heavy) - melodyRate(combat)) / melodyRate(combat);
console.log(`melody rate: combat ${melodyRate(combat).toFixed(2)}/s vs heavy ${melodyRate(heavy).toFixed(2)}/s `
  + `(${(melodyDelta * 100).toFixed(0)}% apart)`);
console.log(`kit rate:    combat ${kitRate(combat).toFixed(2)}/s vs heavy ${kitRate(heavy).toFixed(2)}/s`);
if (melodyDelta > 0.15) {
  fail.push(`the melody changed rate by ${(melodyDelta * 100).toFixed(0)}% in half-time — `
    + 'the tune is supposed to be untouched, only the kit halves');
}
if (!(kitRate(heavy) < kitRate(combat) * 0.75)) {
  fail.push(`half-time kit runs at ${kitRate(heavy).toFixed(2)}/s vs combat's ${kitRate(combat).toFixed(2)}/s — `
    + 'the drums did not actually halve');
}
if (heavy.kicks >= combat.kicks) {
  fail.push(`half-time scheduled ${heavy.kicks} kicks vs combat's ${combat.kicks} — expected roughly half`);
}

// ── 6. Heat rises faster than it falls ─────────────────────────────────────
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

// ── 7. A stale kill streak stops counting ──────────────────────────────────
console.log(`heat with a fresh streak ${result.heatFresh.toFixed(3)} vs stale ${result.heatStale.toFixed(3)}`);
if (!(result.heatFresh > result.heatStale + 0.05)) {
  fail.push('a stale kill streak still contributes — lastKillAge is not being honoured');
}

// ── 8. Phase overrides heat ────────────────────────────────────────────────
console.log(`tier in wave '${result.tierInWave}' → breather '${result.tierOnBreather}' `
  + `→ room clear '${result.tierOnUpgrade}' (heat still ${result.heatOnBreather.toFixed(2)})`);
// Maximum pressure must reach the top combat tier, not sit in the middle one.
if (result.tierInWave !== 'hot') fail.push(`expected 'hot' under maximum pressure, got '${result.tierInWave}'`);
// A wave clear must NOT quiet the bed. Three waves a room, so a calm here is
// the march dropping out three times a room.
if (result.tierOnBreather === 'calm') {
  fail.push('the breather went calm — the bed drops out on every wave clear, not just on a finished room');
}
// ...but a finished room still must, or the calm tier is dead code.
if (result.tierOnUpgrade !== 'calm') {
  fail.push(`room clear gave '${result.tierOnUpgrade}' — the calm tier is no longer reachable`);
}
if (!(result.heatOnBreather > 0.3)) {
  fail.push('heat collapsed on the breather — it should keep decaying so the next wave can swell from where it is');
}

// ── 9. Tempo ramps toward the tier's target, gliding rather than jumping ───
const { beatFrom, beats } = result;
console.log(`tempo: ${beatFrom.toFixed(4)} -> ${beats.map((b) => b.toFixed(4)).join(' ')}`);
const last = beats[beats.length - 1];
if (!(beatFrom > 0.455 && beatFrom < 0.465)) {
  fail.push(`combat settled at beat ${beatFrom.toFixed(4)}, expected ~0.46`);
}
if (!(last < beatFrom - 0.01)) {
  fail.push(`tempo only moved ${beatFrom.toFixed(4)} -> ${last.toFixed(4)} — the hot tier did not speed up`);
}
if (last < 0.4195) fail.push(`tempo overshot its 0.42 target, reaching ${last.toFixed(4)}`);
// Bounded per bar: the whole point is a creep, not a tape-speed effect.
const steps = beats.map((b, i) => Math.abs(b - (i ? beats[i - 1] : beatFrom)) / (i ? beats[i - 1] : beatFrom));
const worst = Math.max(...steps);
console.log(`largest single-bar tempo step: ${(worst * 100).toFixed(2)}% (cap 2%)`);
if (worst > 0.025) fail.push(`tempo jumped ${(worst * 100).toFixed(1)}% in one bar — the ramp is not bounded`);

// ── 10. The boss ladder ─────────────────────────────────────────────────────
console.log(`boss phases 1-3: ${result.bossTiers.join(' -> ')}`);
console.log(`mini-boss mid-wave at full heat: ${result.miniTier} (still ${result.miniTierAfterTick} after a tick)`);
if (result.bossTiers.join(',') !== 'heavy,heavy2,heavy3') {
  fail.push(`boss phases gave ${result.bossTiers.join(' -> ')}, expected heavy -> heavy2 -> heavy3`);
}
// The whole point of the mini-boss feel is that it survives a full room: if
// heat could pull it back to `hot`, the capstone would sound like any wave.
if (result.miniTier !== 'miniboss' || result.miniTierAfterTick !== 'miniboss') {
  fail.push(`mini-boss tier was ${result.miniTier}/${result.miniTierAfterTick} — heat is overriding it`);
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
