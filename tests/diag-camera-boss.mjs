// PHASE 3A — EXTERNAL THREAT INTEREST. The measuring rig.
//
// It answers one question, in thirteen situations: does bounded Vader
// awareness improve how often he is readable WITHOUT taking the frame off the
// player? So every station prints the same four numbers — where the player
// sits on screen, where VADER sits on screen, the strength the boss layer
// asked for, and the pixels it actually contributed — and the interesting
// column is the DELTA between the frozen player camera and the same station
// with the layer live, which is why every station is measured twice.
//
// A/B IS BUILT IN. `bossLeadMax = 0` reproduces the frozen Phase 2C camera
// exactly (the need is still computed, nothing is spent), so each station runs
// OFF then ON through the game's own live tuning object. A check that cannot
// be shown to differ from the build it replaces is decoration — the whole
// point of this file is to show the difference in pixels rather than in prose.
//
// WHY VADER IS PINNED. His AI writes velocity every frame and the camera is
// what is under test, not his footwork: a station whose boss wandered 200px
// mid-measurement is a number about the wrong thing. The LAST station is the
// opposite and is the one the post-mortem rule demands — a live fight with
// nothing silenced, sampled for jitter.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const errors = [];

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 31 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const out = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { PLAYER } = await import('/src/config.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  gs.lives = 9999; gs.player.hp = gs.player.hpMax = 1e9;
  const c = gs.cameras.main, d = gs.cameraDirector, p = gs.player;
  const C = d.cfg;                      // the LIVE tuning object, never a re-import
  const rows = [];

  const clean = () => {
    for (const e of gs.enemies.getChildren().slice()) e.destroy();
    if (gs.boss) { try { gs.boss.shadow?.destroy(); gs.boss.hpBar?.destroy(); gs.boss.destroy(); } catch (_) {} gs.boss = null; }
    if (gs._cameraPunchTween) { gs._cameraPunchTween.stop(); gs._cameraPunchTween = null; }
    c.setZoom(1);
  };
  const boss = (bx, by) => {
    clean();
    gs.spawnBoss(bx, by, { encounter: 1 });
    const b = gs.boss;
    b.hp = b.hpMax = 1e9;
    return b;
  };
  const stage = (px, py) => {
    p.alive = true; p.setActive(true).setVisible(true).setAlpha(1);
    p.setPosition(px, py); p.setVelocity(0, 0);
    p._moveTargetX = 0; p._moveTargetY = 0;
    p.superAiming = false; p.meleeAiming = false; p.resetMeleeCombo();
    p._suppressedMs = 0; p.isDashing = false;
    p.superCharge = 99; p.meleeCharge = 99;
    d.reset(px, py);
    d._fvX = 0; d._fvY = 0; d._fvW = 0; d._aimX = 0; d._aimY = 0;
    d._bsX = 0; d._bsY = 0; d._bsW = 0;
  };
  const sx = (o) => (o.x - c.scrollX) * c.zoom + c.x;
  const sy = (o) => (o.y - c.scrollY) * c.zoom + c.y;

  // Run one situation twice: layer OFF (the frozen player camera, reproduced
  // by spending zero) then ON. `body` gets a per-frame hook so a station can
  // pin Vader, hold the stick, or feed shots at the game's real cadence.
  const station = (name, px, py, b, frames, body) => {
    const rec = { name, bossAt: b ? { x: Math.round(b.x), y: Math.round(b.y) } : null };
    for (const on of [false, true]) {
      const saved = C.bossLeadMax;
      if (!on) C.bossLeadMax = 0;
      stage(px, py);
      for (let i = 0; i < frames; i++) { body?.(i); d.update(16); }
      rec[on ? 'on' : 'off'] = {
        px: +sx(p).toFixed(0), py: +sy(p).toFixed(0),
        bx: b ? +sx(b).toFixed(0) : null, by: b ? +sy(b).toFixed(0) : null,
        w: +d._bsW.toFixed(2), lx: +d._bsX.toFixed(0), ly: +d._bsY.toFixed(0),
        lead: +d._leadX.toFixed(0), abW: +d._abW.toFixed(2),
      };
      C.bossLeadMax = saved;
    }
    rec.shiftX = rec.on.px - rec.off.px;
    rec.bossShiftX = b ? rec.on.bx - rec.off.bx : null;
    rec.bossShiftY = b ? rec.on.by - rec.off.by : null;
    rows.push(rec);
    return rec;
  };

  const pin = (b, bx, by) => () => { b.setPosition(bx, by); b.body?.setVelocity(0, 0); };
  const hold = (b, bx, by, mx, my) => (i) => {
    b.setPosition(bx, by); b.body?.setVelocity(0, 0);
    p.setPosition(800, 700); p.setVelocity(0, 0);
    p._moveTargetX = mx * PLAYER.speed; p._moveTargetY = my * PLAYER.speed;
  };

  // A — VADER COMFORTABLY VISIBLE. 160px east of a standing player, inside the
  // comfort inset. The layer must be silent: this is the "if he is already
  // visible, leave the camera alone" claim, and it is the one that separates a
  // guardrail from a tether. (3A staged this at 220px; 3A.1 moved the boundary
  // deliberately earlier so relationship weight starts before he is nearly
  // lost, which puts 220 just outside it — the station moved rather than the
  // claim being weakened.)
  {
    const b = boss(960, 700);
    station('A comfortably visible', 800, 700, b, 140, pin(b, 960, 700));
  }

  // B / C — VADER AT THE EDGE, PLAYER TRAVELLING THE OTHER WAY. The central
  // conflict: movement says show the escape, the relationship says keep him
  // readable. Both directions, because an asymmetric answer here is a bug.
  {
    const b = boss(1300, 700);
    station('B east edge, moving west', 800, 700, b, 160, hold(b, 1300, 700, -1, 0));
  }
  {
    const b = boss(300, 700);
    station('C west edge, moving east', 800, 700, b, 160, hold(b, 300, 700, 1, 0));
  }

  // D2 — THE STRAFE REVERSAL, WHICH IS THE PHASE 3A HANDSET FAILURE. Vader
  // holds one side while the player strafes left and right the way a real
  // fight is played. What matters is not the average but the WORST frame: does
  // ordinary locomotion reversal repeatedly throw him out of the picture?
  {
    const b = boss(1100, 700);
    stage(800, 700);
    let worst = -1e9, off = 0, n = 0, minLead = 1e9, maxLead = -1e9;
    for (let i = 0; i < 420; i++) {
      b.setPosition(1100, 700); b.body?.setVelocity(0, 0);
      p.setPosition(800, 700); p.setVelocity(0, 0);
      // ~1.3s per full left-right cycle, which is about how fast a player
      // actually strafes.
      p._moveTargetX = (Math.floor(i / 40) % 2 ? 1 : -1) * PLAYER.speed;
      p._moveTargetY = 0;
      d.update(16);
      if (i > 60) {
        const bx = sx(b);
        worst = Math.max(worst, bx);
        if (bx > 720 || bx < 0) off++;
        n++;
        const L = Math.hypot(d._bsX, d._bsY);
        minLead = Math.min(minLead, L); maxLead = Math.max(maxLead, L);
      }
    }
    p._moveTargetX = 0;
    rows.push({
      name: 'D2 strafe reversal, Vader 300px east',
      worstVaderScreenX: +worst.toFixed(0),
      framesVaderOffscreen: `${off}/${n}`,
      bossLeadRange: `${minLead.toFixed(0)}..${maxLead.toFixed(0)}px`,
    });
  }

  // I2 — SLIGHTLY OFFSCREEN, STANDING. He is 60px past the frame edge with no
  // player intent at all; the question is purely how much of him the layer
  // buys back.
  {
    const b = boss(1220, 700);
    stage(800, 700);
    for (let i = 0; i < 220; i++) { b.setPosition(1220, 700); b.body?.setVelocity(0, 0); d.update(16); }
    rows.push({
      name: 'I2 slightly offscreen (420px east), standing',
      vaderScreenX: +sx(b).toFixed(0),
      recovered: `${Math.hypot(d._bsX, d._bsY).toFixed(0)}px`,
      onScreen: sx(b) < 720,
    });
  }

  // D — RETREAT WHILE FIRING AT HIM. Combat intent and boss interest agree, so
  // this should need almost no help: the interesting number is how little the
  // boss layer adds once ordinary fire is already pointing at him.
  {
    const b = boss(1300, 700);
    station('D retreat west, firing east', 800, 700, b, 200, (i) => {
      b.setPosition(1300, 700); b.body?.setVelocity(0, 0);
      p.setPosition(800, 700); p.setVelocity(0, 0);
      p._moveTargetX = -PLAYER.speed; p._moveTargetY = 0;
      // FROM THE FRAME INDEX, NEVER A CLOSURE COUNTER. `station` runs the
      // body twice and a counter carried across both halves fires zero shots
      // in the second one — which reads exactly like the boss layer changing
      // the answer, and cost this rig a round. ~180ms, the real cadence.
      if (i % 11 === 0) d.noteShot(0);
    });
  }

  // E — FIRING AT A MINION ON THE OPPOSITE SIDE. Ordinary combat points west,
  // Vader is east. No tug-of-war: the boss term is bounded and must not erase
  // the combat sector the player is actually shooting into.
  {
    const b = boss(1300, 700);
    station('E firing west, Vader east', 800, 700, b, 200, (i) => {
      b.setPosition(1300, 700); b.body?.setVelocity(0, 0);
      p.setPosition(800, 700); p.setVelocity(0, 0);
      if (i % 11 === 0) d.noteShot(Math.PI);
    });
  }

  // F / G — EXPLICIT COMMITMENT AWAY FROM HIM. The player chose to look the
  // other way; the camera may not overrule that. Both ability paths, because
  // they reach the layer through different fields — and SAMPLED WHILE THE
  // COMMITMENT IS LIVE, not after it. A melee hold is 420ms; a station that
  // only reads the end state photographs a camera that has already let go and
  // proves nothing about who won.
  {
    const b = boss(1300, 700);
    station('F super aimed west, Vader east', 800, 700, b, 170, (i) => {
      b.setPosition(1300, 700); b.body?.setVelocity(0, 0);
      p.setPosition(800, 700);
      if (i === 20) p.setSuperAimInput({ x: -1, y: 0, force: 1 });
    });
  }
  {
    const b = boss(1300, 700);
    stage(800, 700);
    const during = [];
    for (let i = 0; i < 130; i++) {
      b.setPosition(1300, 700); b.body?.setVelocity(0, 0);
      p.setPosition(800, 700);
      if (p._meleeAnimT > 0) p._meleeAnimT = Math.max(0, p._meleeAnimT - 16);
      if (i === 20) { p.setMeleeAimInput({ x: -1, y: 0, force: 1 }); p.meleeAiming = true; }
      if (i === 60) p.releaseMeleeAim({ x: -1, y: 0, force: 1 });
      d.update(16);
      if (i > 60) during.push({ abW: d._abW, bs: Math.hypot(d._bsX, d._bsY), w: d._bsW });
    }
    const live = during.filter((r) => r.abW > 0.9);
    rows.push({
      name: 'G melee committed west, Vader east',
      samplesUnderCommit: live.length,
      maxBossNeedUnderCommit: +Math.max(0, ...live.map((r) => r.w)).toFixed(2),
      maxBossLeadUnderCommit: +Math.max(0, ...live.map((r) => r.bs)).toFixed(0),
      bossLeadAfterRelease: +Math.hypot(d._bsX, d._bsY).toFixed(0),
    });
  }

  // H — WELL OFFSCREEN. Bounded awareness, and the bound is what is measured:
  // the contribution may not exceed `bossLeadMax` however far out he is.
  {
    const b = boss(1560, 700);
    station('H offscreen east', 800, 700, b, 200, pin(b, 1560, 700));
  }

  // I — REACQUISITION. He crosses back inside the comfort rect. The number
  // that matters is the largest single-step frame move: a snap here is the
  // failure mode this layer's slow filter exists to prevent.
  {
    const b = boss(1400, 700);
    stage(800, 700);
    let bx = 1400, jump = 0, prev = null;
    for (let i = 0; i < 260; i++) {
      if (i > 60) bx = Math.max(950, bx - 6);          // he walks back in
      b.setPosition(bx, 700); b.body?.setVelocity(0, 0);
      p.setPosition(800, 700); p.setVelocity(0, 0);
      d.update(16);
      const now = c.scrollX;
      if (prev !== null && i > 62) jump = Math.max(jump, Math.abs(now - prev));
      prev = now;
    }
    rows.push({ name: 'I reacquisition', maxStepPx: +jump.toFixed(1), endW: +d._bsW.toFixed(2) });
  }

  // J — VANISH, AS THREE INTERVALS. He winds up VISIBLY on his real spot, then
  // departs, then commits somewhere else. The move publishes the boundary as
  // `handle.bodyAuthoritative` on its own clock (`departMs`), so the camera
  // holds ordinary bounded interest through the visible wind-up, drops it the
  // moment he goes, ignores the alpha `Boss.preUpdate` restores while he is
  // still absent, and takes him back when he commits.
  {
    const b = boss(1400, 700);
    stage(800, 700);
    for (let i = 0; i < 120; i++) { b.setPosition(1400, 700); d.update(16); }
    const beforeW = d._bsW, beforeLead = Math.hypot(d._bsX, d._bsY);
    for (let i = 0; i < 12 && !b._activeMove; i++) { b._activeMove?.cancel?.(); b.state = 'idle'; gs._castBossMove(b, 'vanishslash'); }
    const cast = !!b._activeMove;
    const S = [];
    for (let i = 0; i < 140; i++) {
      d.update(16);
      const m = b._activeMove;
      if (m?.move?.id === 'vanishslash') S.push({
        phase: m.phase, auth: m.bodyAuthoritative, alpha: +b.alpha.toFixed(2),
        framable: d._bossFramable(b), w: +d._bsW.toFixed(2),
        lead: +Math.hypot(d._bsX, d._bsY).toFixed(0),
      });
      await new Promise((r) => setTimeout(r, 0));
    }
    const early = S.filter((x) => x.phase === 'anticipate' && x.auth !== false);
    const gone = S.filter((x) => x.phase === 'anticipate' && x.auth === false);
    const after = S.filter((x) => x.phase !== 'anticipate');
    const restored = gone.filter((x) => x.alpha >= 0.99);
    const f = (a2) => `${a2.filter((x) => x.framable).length}/${a2.length}`;
    rows.push({
      name: 'J vanish — three intervals',
      cast, beforeW: +beforeW.toFixed(2), beforeLead: +beforeLead.toFixed(0),
      earlyWindup: `framable ${f(early)}, maxLead ${Math.max(0, ...early.map((x) => x.lead))}px, maxNeed ${Math.max(0, ...early.map((x) => x.w))}`,
      departed: `framable ${f(gone)}, maxNeed ${Math.max(0, ...gone.map((x) => x.w))}`,
      restoredAlphaWhileAbsent: `framable ${f(restored)}`,
      committed: `framable ${f(after)}, first ${after[0]?.framable}`,
      leadPath: S.map((x) => x.lead).join(' '),
    });
    b._activeMove?.cancel?.();
  }

  // K — AFTERIMAGES. Six clones of Vader, all of them east. Only `scene.boss`
  // is ever consulted, so the layer must not move by a pixel — asserted with
  // the real Vader DEAD, which is the case where a clone-reading version would
  // be at its loudest.
  {
    clean();
    const b = boss(1300, 700);
    stage(800, 700);
    for (let i = 0; i < 120; i++) { b.setPosition(1300, 700); d.update(16); }
    const withBoss = { w: +d._bsW.toFixed(2), x: +d._bsX.toFixed(0), scroll: +c.scrollX.toFixed(0) };
    gs._spawnAfterimages(b, 6);
    b.alive = false; b.setActive(false).setVisible(false);
    for (let i = 0; i < 200; i++) d.update(16);
    const clones = gs.enemies.getChildren().filter((e) => e.active && e._afterimage).length;
    rows.push({
      name: 'K afterimages only',
      clones, withBoss,
      afterW: +d._bsW.toFixed(2), afterX: +d._bsX.toFixed(0), afterScroll: +c.scrollX.toFixed(0),
    });
  }

  // P — THE PASSIVE GAZE (3A.2). The handset finding was that quiet locomotion
  // still read as free traversal even though the guardrail was doing its job.
  // These are the quiet stations: what the frame carries toward Vader when
  // almost nothing else is happening, and how fast it gives that up.
  {
    const cases = [];
    for (const sep of [100, 200, 300, 420]) {
      const b = boss(800 + sep, 700);
      stage(800, 700);
      for (let i = 0; i < 300; i++) { b.setPosition(800 + sep, 700); b.body?.setVelocity(0, 0); p.setPosition(800, 700); p.setVelocity(0, 0); d.update(16); }
      cases.push(`sep ${sep}: gaze ${(d._bgX ?? 0).toFixed(0)}px + guard ${d._bsX.toFixed(0)}px = ${((d._bgX ?? 0) + d._bsX).toFixed(0)}px`);
    }
    rows.push({ name: 'P1 idle, what the frame carries toward Vader', cases: cases.join(' | ') });
  }
  {
    // Walking, no shooting — the case the human described. Both directions,
    // plus a strafe, and what matters is that movement still moves the frame.
    const b = boss(1100, 700);
    const walk = (dir, n = 260) => {
      stage(800, 700);
      for (let i = 0; i < n; i++) {
        b.setPosition(1100, 700); b.body?.setVelocity(0, 0);
        p.setPosition(800, 700); p.setVelocity(0, 0);
        p._moveTargetX = dir * PLAYER.speed; p._moveTargetY = 0;
        d.update(16);
      }
      const r = { playerX: +sx(p).toFixed(0), vaderX: +sx(b).toFixed(0), gaze: +(d._bgX ?? 0).toFixed(0), guard: +d._bsX.toFixed(0) };
      p._moveTargetX = 0;
      return r;
    };
    const rest = walk(0), west = walk(-1), east = walk(1);
    rows.push({
      name: 'P2 walking with Vader 300px east, nothing else happening',
      resting: JSON.stringify(rest), walkingWest: JSON.stringify(west), walkingEast: JSON.stringify(east),
      movementStillMovesFrame: `${(west.playerX - rest.playerX).toFixed(0)}px west, ${(east.playerX - rest.playerX).toFixed(0)}px east`,
    });
  }

  // N — OSCILLATION, ANSWERED WHERE IT CAN BE ANSWERED. A live fight shows more
  // scroll direction changes with the layer on than off, and that is NOT
  // oscillation — it is the frame tracking a boss who is walking around, which
  // the weaker 3A layer was too quiet to do. The question a reversal count in a
  // live fight cannot answer is whether the guardrail rings on its own, so this
  // pins BOTH bodies and samples after settling: a converging layer must show
  // zero reversals and zero spread. (The structural guarantee is that the need
  // is measured against the player-intent focus, so the correction is never an
  // input to its own strength; this is that claim, measured.)
  for (const [label, bx] of [['300px east', 1100], ['500px east', 1300]]) {
    const b = boss(bx, 700);
    stage(800, 700);
    let prev = null, rev = 0, last = 0, lPrev = null, lRev = 0, lLast = 0;
    const tail = [];
    for (let i = 0; i < 500; i++) {
      b.setPosition(bx, 700); b.body?.setVelocity(0, 0);
      p.setPosition(800, 700); p.setVelocity(0, 0);
      d.update(16);
      if (i > 150) {
        if (prev !== null) { const v = c.scrollX - prev; if (Math.abs(v) > 0.05) { const sg = Math.sign(v); if (last && sg !== last) rev++; last = sg; } }
        if (lPrev !== null) { const v = d._bsX - lPrev; if (Math.abs(v) > 0.05) { const sg = Math.sign(v); if (lLast && sg !== lLast) lRev++; lLast = sg; } }
        tail.push(d._bsX);
      }
      prev = c.scrollX; lPrev = d._bsX;
    }
    rows.push({
      name: `N static inputs, Vader ${label} — does the guardrail ring?`,
      scrollReversalsAfterSettle: rev,
      bossLeadReversalsAfterSettle: lRev,
      leadSpreadPx: +(Math.max(...tail) - Math.min(...tail)).toFixed(2),
      settledLead: +d._bsX.toFixed(1),
    });
  }

  // L — THE SOUTH GUARANTEE, AT THE ONE BEARING THAT COULD SPEND IT, IN OPEN
  // FLOOR. A Vader NORTH of the player pulls the focus north, which draws the
  // player DOWN the screen toward the controls — the trade `leadY: 0` refused
  // for the movement lead and `_clampSafeArea` now guards on the final target.
  //
  // NOT AT THE SOUTH WALL: there the framing clamp pins the player anyway and
  // the station passes with the guard deleted, which is the decoration trap
  // CLAUDE.md names. In the room's southern OPEN FLOOR nothing else is
  // deciding, and the resting composition (screen y 610) and the guard's limit
  // are far enough apart to tell apart. Measured at the configured lead and
  // again at a deliberately absurd one.
  {
    const py = 1050, px = 800, by = py - 620;
    const b = boss(px, by);
    stage(px, py);
    const run = (n) => { for (let i = 0; i < n; i++) {
      b.setPosition(px, by); b.body?.setVelocity(0, 0);
      p.setPosition(px, py); p.setVelocity(0, 0);
      d.update(16);
    } };
    run(220);
    const at = +sy(p).toFixed(0), atLead = +d._bsY.toFixed(0);
    // RAISE THE GAIN, NOT JUST THE CAP: the law saturates, so the correction
    // can never exceed `bossPreserve x deficit` however large the budget is.
    const savedY = C.bossLeadY, savedMax = C.bossLeadMax, savedP = C.bossPreserve;
    C.bossLeadY = 900; C.bossLeadMax = 900; C.bossPreserve = 6;
    run(300);
    const extreme = +sy(p).toFixed(0), extremeLead = +d._bsY.toFixed(0);
    C.bossLeadY = savedY; C.bossLeadMax = savedMax; C.bossPreserve = savedP;
    const { getControls } = await import('/src/systems/controlLayout.js');
    rows.push({
      name: 'L open floor south, Vader 620px NORTH',
      playerScreenY: at, bossLeadY: atLead,
      playerScreenYExtremeLead: extreme, bossLeadYExtreme: extremeLead,
      controlTop: Math.min(...getControls().map((g2) => g2.y - g2.radius)),
    });
  }

  // M — A LIVE FIGHT, NOTHING SILENCED. The post-mortem rule: a measurement
  // taken with the other system switched off cannot see the two fighting. His
  // AI, his moves, his mechanics and a wave of minions all run; what is
  // sampled is the camera's own smoothness.
  // Sampled OFF then ON like everything else: in a live fight the scene's own
  // POST_UPDATE is also driving the camera, so the absolute step size here is a
  // harness number and only the DIFFERENCE between the two halves means
  // anything.
  {
    const live = {};
    for (const on of [false, true]) {
      clean();
      const b = boss(1200, 600);
      b.hp = b.hpMax = 1e9;
      stage(800, 800);
      gs.bossSpawnMinions?.();
      const saved = C.bossLeadMax;
      if (!on) C.bossLeadMax = 0;
      let prev = null, jump = 0, rev = 0, lastDir = 0, maxW = 0, shot = 0;
      for (let i = 0; i < 420; i++) {
        p._moveTargetX = Math.cos(i / 40) * PLAYER.speed;
        p._moveTargetY = Math.sin(i / 55) * PLAYER.speed * 0.6;
        if (i - shot >= 11) { shot = i; d.noteShot(Math.atan2(b.y - p.y, b.x - p.x)); }
        maxW = Math.max(maxW, d._bsW);
        if (prev !== null) {
          const v = c.scrollX - prev;
          if (Math.abs(v) > 0.5) { const sg = Math.sign(v); if (lastDir && sg !== lastDir) rev++; lastDir = sg; }
          jump = Math.max(jump, Math.abs(v));
        }
        prev = c.scrollX;
        await new Promise((r) => setTimeout(r, 0));
      }
      C.bossLeadMax = saved;
      live[on ? 'layerOn' : 'layerOff'] = { maxStepPx: +jump.toFixed(1), scrollReversals: rev, maxBossW: +maxW.toFixed(2) };
    }
    rows.push({ name: 'M live fight, nothing silenced', ...live });
    clean();
  }

  return { rows, cfg: { bossLeadX: C.bossLeadX, bossLeadY: C.bossLeadY, bossLeadMax: C.bossLeadMax } };
});

console.log('\nCAMERA PHASE 3A.1 — Vader relationship guardrail');
console.log('tuning:', JSON.stringify(out.cfg));
for (const r of out.rows) {
  if (r.off) {
    console.log(`\n${r.name}   Vader at ${JSON.stringify(r.bossAt)}`);
    console.log(`  OFF  player(${r.off.px},${r.off.py})  vader(${r.off.bx},${r.off.by})  need ${r.off.w}  lead(${r.off.lx},${r.off.ly})  move ${r.off.lead}  ab ${r.off.abW}`);
    console.log(`  ON   player(${r.on.px},${r.on.py})  vader(${r.on.bx},${r.on.by})  need ${r.on.w}  lead(${r.on.lx},${r.on.ly})  move ${r.on.lead}  ab ${r.on.abW}`);
    console.log(`  ->   player moved ${r.shiftX}px, Vader moved ${r.bossShiftX}px / ${r.bossShiftY}px toward frame`);
  } else {
    console.log(`\n${r.name}`);
    for (const [k, v] of Object.entries(r)) if (k !== 'name') console.log(`  ${k}: ${JSON.stringify(v)}`);
  }
}
if (errors.length) console.log('\npage errors:', errors.join(' | '));
await browser.close();
