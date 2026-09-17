// ── CAPTAIN COMBAT-ECONOMY TELEMETRY ────────────────────────────────────────
//
// THE QUESTION THIS EXISTS TO ANSWER, and it is a product question rather than
// a code one. Balance thinking had reached "the Captain survives two or three
// Supers" — a sentence that only means something if a Super is scarce. In real
// handset play it can be used roughly once a second, which makes it closer to
// high-power secondary fire than to an ultimate, and "survives three of them"
// may therefore describe three seconds. So: measure what the player ACTUALLY
// does, and measure whether the Captain gets to perform his kit before they
// finish him.
//
// IT IS OBSERVATION ONLY, AND THAT IS THE FIRST PROPERTY. It changes no damage,
// no hp, no armour, no cooldown, no AI, no spawn composition and no Super
// cadence. Nothing here is constructed, listened to or drawn without
// `?captel=1`, and `smoke-captel` asserts the tuning is byte-identical with the
// flag on and off — an instrument that perturbs the thing it measures is worse
// than no instrument.
//
// ── ATTRIBUTION IS CARRIED, NEVER INFERRED ─────────────────────────────────
// A damage source guessed from a magnitude is a guess that gets worse every
// time the numbers move. `GameScene` sets `_dmgSrc` synchronously around each
// player damage call — the same idiom `_superHitCtx` and `_suppressHitSfx`
// already use, and it is exact because `Enemy.damage` emits `enemy-hit`
// INLINE, so there is no timing window between the tag and the read.
//
// ── AND IT COUNTS REAL DURABILITY, NOT REQUESTED DAMAGE ────────────────────
// The B.2.2 damage-truth semantics are the whole point of using them here:
// `amount` is what was ASKED for, and on an actor with a layer in front of its
// body that number is zero while the armour holds and four figures too large on
// a killing blow. Every figure below is armour actually removed plus body
// actually removed, read from the pools either side of the hit.
import Phaser from 'phaser';

/** One Captain's fight, from spawn to death. */
function blankSession(cap, now) {
  return {
    id: cap._championId || 'captain',
    spawnAt: now,
    firstDamageAt: null,
    armourBreakAt: null,
    criticalAt: null,
    deathAt: null,
    // durability, as the actor actually holds it
    armourMax: cap.armourMax ?? 0,
    hpMax: cap.hpMax ?? 0,
    armourRemoved: 0,
    bodyRemoved: 0,
    // what the player did
    shots: { primary: 0, secondary: 0, superCasts: 0, superPellets: 0, melee: 0, cluster: 0 },
    hits: { primary: 0, secondary: 0, super: 0, melee: 0, other: 0 },
    dmg: { primary: 0, secondary: 0, super: 0, melee: 0, other: 0 },
    superAt: [],            // every cast's timestamp, for the cadence report
    superDmg: [],           // real durability removed, bucketed per cast
    // what the Captain did
    acts: { burstsBegun: 0, burstsDone: 0, rounds: 0, grenades: 0, fields: 0 },
    // ── S1: THE TACTICAL STEP ─────────────────────────────────────────────
    // The whole question S1 asks is whether MOVEMENT lowers the human focus
    // test's ~70% pellet connection without any special resistance, so the
    // steps have to be countable next to the pellet hit rate on the same card.
    steps: { done: 0, reasons: {}, dist: [], at: [], moved: [], bearing: [], closed: [] },
    // ── CORE FEEL PASS: DID THE COMMITMENT VARY, AND WHICH WAY DID HE WALK
    // THE FIRE? Two cheap rows (§32). The video is still the authority; this
    // only has to confirm the distribution is real and that the plan is drawn
    // once per burst rather than per round.
    bursts: { len: {}, pattern: {}, fired: 0, planned: 0, still: 0 },
    // how long he spent in each durability state
    tIntact: 0, tBroken: 0, tCritical: 0,
    _lastTick: now,
    live: true,
  };
}

const SRC = ['primary', 'secondary', 'super', 'melee', 'other'];

/**
 * Install the instrument. Called ONLY under `?captel=1`.
 *
 * Everything it owns is torn down by the scene's own shutdown, and every
 * listener is registered through `scene.events` so a restart cannot leave one
 * behind talking to a dead scene.
 */
export function attachCaptainTelemetry(scene) {
  let S = null;              // the live session, or null
  let last = null;           // the last COMPLETED session, kept for the panel
  const tel = { session: () => S, last: () => last };
  scene._captel = tel;

  const now = () => scene.time.now;

  // ── PLAYER ACTIONS ───────────────────────────────────────────────────────
  // EVERY SHOT THE PLAYER FIRES WHILE THE SUBJECT IS ALIVE, wherever it went.
  // That asymmetry with the DAMAGE counters below is deliberate and is the
  // distinction the brief turns on: "how many Supers does the player fire per
  // 30 seconds" is a question about the player's economy and must count the
  // ones that missed, while "how much durability did Super remove" is a
  // question about this Captain and must not count a pellet that hit someone
  // else. Read `hits / shots` as a hit rate against the subject, and expect it
  // to be low in a crowded wave for exactly that reason.
  // EVERY LISTENER IS REMEMBERED SO EVERY LISTENER CAN BE REMOVED. `create()`
  // runs again on a restart (`PauseScene._restart`), and `scene.events`
  // survives it — so an attach that only tidied its own `postupdate` hook would
  // leave a full second set of handlers behind, and every counter would double
  // from the second run onwards. That is the same shape as the `postupdate`
  // handler closed over a dead boss that `Boss.destroy` has to remove.
  const bound = [];
  const on = (ev, fn) => { bound.push([ev, fn]); scene.events.on(ev, fn); };
  on('player-fire', () => { if (S?.live) S.shots.primary++; });
  on('player-fire-rifle', () => { if (S?.live) S.shots.secondary++; });
  on('player-fire-cluster', () => { if (S?.live) S.shots.cluster++; });
  on('player-melee-cast', () => { if (S?.live) S.shots.melee++; });
  on('player-fire-super', () => {
    if (!S?.live) return;
    // THE CAST IS THE PRESS, AND THAT IS WHAT CADENCE MEANS. The pellets leave
    // after a wind-up and the player can die inside it, so the two are counted
    // separately and `player-super-blast` carries the pellets that really left
    // the muzzle rather than the authored `superPellets`.
    S.shots.superCasts++;
    S.superAt.push(now());
    S.superDmg.push(0);
  });
  on('player-super-blast', (pellets) => { if (S?.live) S.shots.superPellets += pellets; });

  // ── DAMAGE ON THE CAPTAIN ────────────────────────────────────────────────
  // `enemy-hit` carries the B.2.2 feedback claim as its third argument, which
  // is REAL durability removed (armour + body). Falling back to `amount` is
  // correct for any actor with no second layer and wrong for this one, so the
  // fallback is only ever reached by an enemy that is not the subject.
  on('enemy-hit', (enemy, amount, feedback) => {
    // THE SUBJECT, NOT ANY CHAMPION. `?champdbg=1` injects one Champion per
    // WAVE, so two Captains can stand on the floor at once and the session owns
    // exactly one of them. Testing `isChampion` alone credits the subject with
    // damage the player spent on somebody else — and that is not hypothetical:
    // a probe measured four grenades thrown and two attributed, because the
    // other two belonged to a second Captain the harness had spawned.
    if (!S?.live || enemy !== S.actor) return;
    const removed = feedback ? feedback.shown : amount;
    if (removed <= 0) return;
    const src = SRC.includes(scene._dmgSrc) ? scene._dmgSrc : 'other';
    S.dmg[src] += removed;
    S.hits[src === 'super' ? 'super' : src] += 1;
    // Bucket it under the most recent Super cast, so "damage per cast" is a
    // distribution rather than a total divided by a count.
    //
    // APPROXIMATE, AND ONLY THIS FIGURE IS. Pellets from an earlier cast can
    // land after a newer one is pressed, and at the cadence this instrument
    // exists to measure that will happen — so a fast pair of casts can shift
    // damage from the first onto the second. The TOTAL, the hit counts and the
    // intervals are all exact; read the per-cast average as an estimate and
    // the best-cast figure as a lower bound.
    if (src === 'super' && S.superDmg.length) S.superDmg[S.superDmg.length - 1] += removed;
    if (S.firstDamageAt === null) S.firstDamageAt = now();
  });

  // ── THE CAPTAIN'S OWN MILESTONES AND ACTIONS ─────────────────────────────
  on('champion-armour-broken', (c) => { if (S?.live && c === S.actor) S.armourBreakAt = now(); });
  on('champion-low-health', (c) => { if (S?.live && c === S.actor) S.criticalAt = now(); });
  on('champion-burst-begin', (c) => { if (S?.live && c === S.actor) S.acts.burstsBegun++; });
  on('champion-burst-complete', (c) => { if (S?.live && c === S.actor) S.acts.burstsDone++; });
  on('champion-round-fired', (c) => { if (S?.live && c === S.actor) S.acts.rounds++; });
  on('champion-arc-grenade', (c) => { if (S?.live && c === S.actor) S.acts.grenades++; });
  // The field carries its thrower, so a second Captain's electricity cannot be
  // credited to the subject. This was the bug the probe above found: fields had
  // no owner filter and counted 4 where the same Captain threw 2.
  on('arc-field-live', (n) => { if (S?.live && n?.owner === S.actor) S.acts.fields++; });
  // COMPLETED steps, with the reason and the REAL displacement. `_beginStep`
  // emits once the destination has passed its geometry check, so a step the
  // arena refused is correctly absent rather than counted as an intention.
  on('champion-step', (c, reason, reach) => {
    if (!S?.live || c !== S.actor) return;
    S.steps.done++;
    S.steps.reasons[reason] = (S.steps.reasons[reason] || 0) + 1;
    S.steps.dist.push(reach);
    S.steps.at.push(now());
  });
  // AND WHAT IT ACHIEVED. The planned reach is an intention; this is the real
  // displacement after the wall collider had its say, plus the two figures
  // that say whether the geometry actually changed — how much the Captain's
  // bearing from the player moved, and how the range closed or opened.
  on('champion-step-end', (c, d) => {
    if (!S?.live || c !== S.actor || !d) return;
    S.steps.moved.push(d.moved);
    S.steps.bearing.push(d.bearingChange);
    S.steps.closed.push(d.distAfter - d.distBefore);
  });
  // ONE PLAN PER COMMITMENT. `planned` counts the plans and `fired` the rounds
  // they produced; a build that re-solved per round would show them equal.
  on('champion-burst-plan', (c, d) => {
    if (!S?.live || c !== S.actor || !d) return;
    const b = S.bursts;
    b.planned++;
    b.fired += d.fired;
    b.len[d.rounds] = (b.len[d.rounds] || 0) + 1;
    if (d.pattern) b.pattern[d.pattern] = (b.pattern[d.pattern] || 0) + 1;
    if (d.still) b.still++;
  });

  // ── LIFECYCLE ────────────────────────────────────────────────────────────
  // ONE SESSION AT A TIME, and a new Captain retires the old one whatever
  // happened to it — a replay or a room change can remove an actor without a
  // death, and a session left live would then collect a second Captain's fight
  // on top of the first.
  on('champion-spawned', (c) => {
    if (S?.live) close(S, 'superseded');
    S = blankSession(c, now());
    S.actor = c;
    draw();
  });
  on('enemy-died', (e) => { if (S?.live && e === S.actor) close(S, 'killed'); });

  function close(sess, why) {
    tick();
    sess.live = false;
    sess.deathAt = now();
    sess.why = why;
    last = sess;
    S = null;
    draw();
  }

  /** Time spent in each durability state, accumulated on the real clock. */
  function tick() {
    if (!S?.live) return;
    const t = now();
    const dt = t - S._lastTick;
    S._lastTick = t;
    if (dt <= 0) return;
    const a = S.actor;
    if (a?.armourBroken) { if (a._lowHealthFired) S.tCritical += dt; else S.tBroken += dt; }
    else S.tIntact += dt;
  }

  // ── THE READOUT ──────────────────────────────────────────────────────────
  // A LIVE TICKER, NOT A DASHBOARD. While the fight is running the panel is one
  // line: a dashboard over a live fight is a different experiment. The full
  // card appears when the Captain is gone, which is the moment there is
  // anything to read, and it is laid out to be screenshotted.
  const cam = scene.cameras.main;
  const panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(9600);
  const bg = scene.add.graphics().setScrollFactor(0);
  const txt = scene.add.text(0, 0, '', {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    fontSize: '15px', color: '#dfe6ee', lineSpacing: 3,
  }).setScrollFactor(0);
  panel.add([bg, txt]);
  // ── WHERE IT SITS, AND WHY IT IS NOT TAPPABLE ─────────────────────────
  // Top RIGHT, because the move stick claims the whole left half with no
  // exclusion hook at all. BELOW the pause button, which lives at (676, 120)
  // in screen space and would otherwise be underneath the card.
  //
  // AND IT TAKES NO POINTER AREA. A tappable panel would need an exclusion
  // point on the fire stick, which is a change to a control the player is
  // using DURING the run being measured — an instrument that alters the
  // controls of its own experiment. It resets on the next Captain, on a replay
  // and on a reload, which is enough.
  //
  // THE TOP OF IT IS DERIVED, NOT PICKED. This instrument is used with
  // `?champdbg=1`, which raises the Phase A encounter overlay, whose PREV /
  // NEXT / REPLAY buttons are laid out in `HUD.js` at screen y 196/250/304 on a
  // 46px height — so the lowest of them ends at 327. The first build sat at
  // camera y 116, which is screen 200, and photographed with the card printed
  // straight through all three. The Game camera is INSET by the HUD's top bar,
  // so a screen coordinate is not a camera one and the two must be converted
  // rather than compared.
  const ENC_BTN_BOTTOM = 304 + 46 / 2;          // HUD.js, the REPLAY button
  const TOP = ENC_BTN_BOTTOM + 14 - cam.y;      // screen -> this camera's space
  panel.setPosition(cam.width - 306, TOP);

  const fmtS = (ms) => `${(ms / 1000).toFixed(1)}s`;
  const pct = (v, total) => (total > 0 ? `${Math.round(100 * v / total)}%` : '—');

  function stats(a) {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return { min: s[0], max: s[s.length - 1], med: s[s.length >> 1],
      mean: s.reduce((p, c) => p + c, 0) / s.length };
  }

  function report(sess) {
    const total = SRC.reduce((p, k) => p + sess.dmg[k], 0);
    const ttk = (sess.deathAt ?? now()) - sess.spawnAt;
    const gaps = [];
    for (let i = 1; i < sess.superAt.length; i++) gaps.push(sess.superAt[i] - sess.superAt[i - 1]);
    const g = stats(gaps);
    const sd = sess.superDmg.filter((_, i) => i < sess.shots.superCasts);
    const sdS = stats(sd);
    const per10 = ttk > 0 ? (sess.shots.superCasts / (ttk / 1000)) * 10 : 0;
    const L = [];
    L.push('CAPTAIN TELEMETRY');
    L.push(`TTK  ${fmtS(ttk)}${sess.why === 'superseded' ? '  (SUPERSEDED, not a kill)' : ''}`);
    L.push(`  first hit ${sess.firstDamageAt === null ? '—' : fmtS(sess.firstDamageAt - sess.spawnAt)}`
      + ` · break ${sess.armourBreakAt === null ? 'NEVER' : fmtS(sess.armourBreakAt - sess.spawnAt)}`
      + ` · crit ${sess.criticalAt === null ? 'NEVER' : fmtS(sess.criticalAt - sess.spawnAt)}`);
    L.push(`  intact ${fmtS(sess.tIntact)} · broken ${fmtS(sess.tBroken)} · crit ${fmtS(sess.tCritical)}`);
    // THE HEADLINE OF THIS WHOLE INSTRUMENT, AND IT IS SECOND ON THE CARD ON
    // PURPOSE. "Does he get to perform his kit before an aggressive player
    // removes him" is the question the pass exists to answer, and a row at the
    // bottom of a long card is a row that gets cropped out of a screenshot.
    L.push(`OUTPUT  ${sess.acts.burstsDone}/${sess.acts.burstsBegun} bursts · ${sess.acts.rounds} rounds`
      + ` · ${sess.acts.grenades} nade · ${sess.acts.fields} field`);
    const st = sess.steps;
    const stGaps = [];
    for (let i = 1; i < st.at.length; i++) stGaps.push(st.at[i] - st.at[i - 1]);
    const stG = stats(stGaps);
    const stD = stats(st.dist);
    const stM = stats(st.moved);
    const stB = stats(st.bearing);
    L.push(`STEPS   ${st.done}`
      + (st.done ? ` · ${Math.round(stD.mean)}px plan · ${stM ? `${Math.round(stM.mean)}px real` : '—'}`
        + ` · ${stG ? `${Math.round(stG.med)}ms apart` : 'once'}` : '')
      + (st.done ? `\n  ${Object.entries(st.reasons).map(([k, v]) => `${k} ${v}`).join(' · ')}` : '')
      + (stB ? `\n  bearing ${Math.round(stB.mean)}\u00b0 avg shift` : ''));
    const bu = sess.bursts;
    L.push(`BURSTS  ${bu.planned} plans · ${bu.fired} rounds`
      + (bu.planned ? ` · ${bu.still} on a still target` : '')
      + (bu.planned ? `\n  len ${Object.entries(bu.len).sort().map(([k, v]) => `${k}x${v}`).join(' ')}` : '')
      + (bu.planned ? `\n  ${Object.entries(bu.pattern).map(([k, v]) => `${k} ${v}`).join(' · ')}` : ''));
    L.push('');
    L.push(`SUPER  ${sess.shots.superCasts} casts · ${sess.shots.superPellets} pellets`);
    L.push(`  hits ${sess.hits.super} (${pct(sess.hits.super, sess.shots.superPellets)})`
      + ` · ${Math.round(sess.dmg.super)} dmg · ${pct(sess.dmg.super, total)} of all`);
    L.push(`  per cast ${sdS ? Math.round(sdS.mean) : 0} avg · ${sdS ? Math.round(sdS.max) : 0} best`);
    L.push(`  interval ${g ? `${Math.round(g.med)}ms med · ${Math.round(g.min)} min` : '—'}`);
    L.push(`  rate     ${per10.toFixed(1)} /10s · ${(per10 * 3).toFixed(1)} /30s`);
    L.push('');
    // hit/fired, and the two can differ wildly in a crowded wave: FIRED counts
    // every shot the player took while he was alive, HIT counts the ones that
    // landed on HIM. That asymmetry is the point — see the note on the player
    // action listeners.
    const row = (name, k, extra) => L.push(
      `${name.padEnd(10)}${String(Math.round(sess.dmg[k])).padStart(5)} `
      + `${pct(sess.dmg[k], total).padStart(4)}${extra}`);
    row('PRIMARY', 'primary', `  ${sess.hits.primary}/${sess.shots.primary} hit/fired`);
    row('MELEE', 'melee', `  ${sess.hits.melee}/${sess.shots.melee}`);
    row('SECONDARY', 'secondary', `  ${sess.hits.secondary}/${sess.shots.secondary + sess.shots.cluster}`);
    row('OTHER', 'other', '');
    L.push(`TOTAL     ${String(Math.round(total)).padStart(5)}  of `
      + `${Math.round(sess.armourMax + sess.hpMax)} durability`);
    return L.join('\n');
  }

  function draw() {
    if (S?.live) {
      const t = now() - S.spawnAt;
      const total = SRC.reduce((p, k) => p + S.dmg[k], 0);
      // HOW MANY CAPTAINS ARE ON THE FLOOR, because it changes how every hit
      // rate below should be read: `?champdbg=1` injects one per WAVE, the
      // session owns exactly one of them, and shots spent on the other one
      // count as fired and not as landed. Shown only when it is not 1.
      const n = scene.enemies?.getChildren?.()
        .filter((e) => e.alive && e.isChampion).length ?? 1;
      txt.setText(`CAP ${fmtS(t)} · SUP ${S.shots.superCasts} · ${Math.round(total)} dmg`
        + (n > 1 ? `
${n} CAPTAINS — tracking 1` : ''));
    } else if (last) {
      txt.setText(report(last));
    } else {
      txt.setText('CAPTAIN TELEMETRY\nwaiting for a Captain…');
    }
    const w = Math.max(210, txt.width + 20);
    const h = txt.height + 16;
    // The panel is anchored to its own width so the live one-liner and the
    // full card share a right edge and the card cannot walk off the screen.
    panel.setPosition(cam.width - w - 12, TOP);
    txt.setPosition(10, 8);
    bg.clear();
    bg.fillStyle(0x05070a, 0.82);
    bg.fillRoundedRect(0, 0, w, h, 8);
    bg.lineStyle(1.5, 0x4fc3ff, 0.55);
    bg.strokeRoundedRect(0, 0, w, h, 8);
  }

  // THE LIVE LINE IS THROTTLED AND THE CLOCK IS NOT. `tick()` runs every frame
  // because the state durations have to be exact; the text layout runs four
  // times a second because re-laying a string every frame is real work inside
  // the fight this is supposed to leave alone.
  let liveDrawAt = 0;
  const onTick = () => {
    tick();
    if (S?.live && now() >= liveDrawAt) { liveDrawAt = now() + 250; draw(); }
  };
  scene.events.on('postupdate', onTick);
  const teardown = () => {
    scene.events.off('postupdate', onTick);
    bound.forEach(([ev, fn]) => scene.events.off(ev, fn));
    bound.length = 0;
    panel.destroy(true);
    if (scene._captel === tel) scene._captel = null;
  };
  scene.events.once('shutdown', teardown);
  scene.events.once('destroy', teardown);
  draw();

  // Exposed for the structural tests and for a manual reset from the debug
  // card. `report` is the same text the panel shows, so a test cannot pass
  // against a formatter the human never sees.
  tel.report = () => (last ? report(last) : null);
  tel.reset = () => { S = null; last = null; draw(); };
  tel.redraw = draw;
  return tel;
}
