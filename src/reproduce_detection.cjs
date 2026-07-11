const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  console.log("=== Enemy Detection QA ===");
  let executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(executablePath)) {
    executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  }
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.toString());
    console.log('PAGE ERROR:', err.toString());
  });

  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 4000));
  await page.mouse.click(360, 640);
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const t = window.game?.scene?.getScene('Title');
    if (t?.sys?.isActive()) t.scene.start('Game');
  });
  await new Promise(r => setTimeout(r, 2500));

  const getGrunt = async () => page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    // prefer a live grunt
    const g = gs.enemies.getChildren().find(e => e.constructor.name === 'EnemyGrunt' && e.alive)
           || gs.enemies.getChildren().find(e => e.constructor.name === 'EnemyGrunt');
    if (!g) return null;
    const p = gs.player;
    return {
      state: g.state,
      alive: g.alive,
      x: Math.round(g.x),
      y: Math.round(g.y),
      aim: +g._aim.toFixed(2),
      canSee: g.alive ? g.canSee(p) : false,
      lastKnownX: Math.round(g.lastKnownX || 0),
      lastKnownY: Math.round(g.lastKnownY || 0),
    };
  });

  // Reset ALL alive grunts to patrol, then position the designated one.
  const place = async (gx, gy, px, py, gAim = Math.PI) => {
    await page.evaluate((a) => {
      const gs = window.game.scene.getScene('Game');
      const p = gs.player;
      p.x = a.px; p.y = a.py;
      p.revealTimer = 0; p.hiddenInBush = false;
      p.body.setVelocity(0, 0); p.body.updateFromGameObject();
      // Reset ALL alive grunts to patrol far away so they don't interfere
      const all = gs.enemies.getChildren().filter(e => e.constructor.name === 'EnemyGrunt' && e.alive);
      all.forEach((g, i) => {
        g.state = 'patrol'; g._aim = a.gAim;
        g.body.setVelocity(0, 0);
        if (i === 0) {
          g.x = a.gx; g.y = a.gy;
        } else {
          // Park other grunts far away
          g.x = 2000 + i * 100; g.y = 2000;
        }
        g.body.updateFromGameObject();
      });
    }, { gx, gy, px, py, gAim });
  };

  const PASS = '✅';
  const FAIL = '❌';
  const check = (label, cond, detail = '') => {
    const icon = cond ? PASS : FAIL;
    console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
    return cond;
  };

  let passed = 0, failed = 0;
  const test = (label, cond, detail = '') => {
    const ok = check(label, cond, detail);
    ok ? passed++ : failed++;
  };

  // ── 1. Detect player inside FOV cone ──────────────────────────────────────
  await place(400, 400, 200, 400, Math.PI); // facing left, player to the left
  await new Promise(r => setTimeout(r, 250));
  let g = await getGrunt();
  test('T1: FOV detection (player in cone)', g.state === 'alert', `state=${g.state} canSee=${g.canSee}`);

  // ── 2. Behind enemy, facing away — patrol should NOT see player ───────────
  // Reset first with player far away, then move to behind
  await place(400, 400, 1200, 400, Math.PI); // facing left, player far right (behind)
  await new Promise(r => setTimeout(r, 50));
  // Re-read state (should still be patrol because enemy was just reset)
  g = await getGrunt();
  test('T2: Player behind enemy — not seen while patrolling', g.state === 'patrol', `state=${g.state} canSee=${g.canSee}`);

  // ── 3. LOS blocked by wall ────────────────────────────────────────────────
  await place(400, 400, 1200, 400, Math.PI);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    if (gs._testWall) gs._testWall.destroy();
    gs._testWall = gs.walls.create(300, 400, 'wall');
    gs._testWall.body.setSize(64, 64);
    gs._testWall.refreshBody();
    
    // Position player behind the wall
    gs.player.x = 200; gs.player.y = 400;
    gs.player.body.updateFromGameObject();
  });
  await new Promise(r => setTimeout(r, 250));
  g = await getGrunt();
  test('T3: LOS blocked by wall — no detection', g.state === 'patrol', `state=${g.state} canSee=${g.canSee}`);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    if (gs._testWall) { gs._testWall.destroy(); gs._testWall = null; }
  });

  // ── 4. Gunshot alerting nearby enemy ─────────────────────────────────────
  await place(400, 400, 1200, 400, Math.PI);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.alertEnemiesNear(500, 400, 200); // within 200px of enemy at (400,400)
  });
  await new Promise(r => setTimeout(r, 150));
  g = await getGrunt();
  test('T4: Sound alert (shot within radius)', g.state === 'alert', `state=${g.state}`);

  // ── 5. Gunshot out of range — no alert ────────────────────────────────────
  await place(400, 400, 1200, 400, Math.PI);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.alertEnemiesNear(900, 400, 100); // 500px away, radius only 100 — shouldn't reach
  });
  await new Promise(r => setTimeout(r, 150));
  g = await getGrunt();
  test('T5: Sound out of range — no alert', g.state === 'patrol', `state=${g.state}`);

  // ── 6. Enemy searches last known position after player hides ──────────────
  // Step 1: trigger alert
  await place(400, 400, 200, 400, Math.PI);
  await new Promise(r => setTimeout(r, 300)); // wait for detection
  g = await getGrunt();
  const detectedPlayer = g.state === 'alert' || g.state === 'chase' || g.state === 'cover_move' || g.state === 'advance';
  
  // Step 2: player teleports out of sight (no LOS) 
  if (detectedPlayer) {
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs.player.x = 3200; gs.player.y = 3200;
      gs.player.body.updateFromGameObject();
    });
    // Wait for alert → chase/combat transition (enemy must first finish alert anim ~400ms)
    let chaseReached = false;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 100));
      g = await getGrunt();
      if (g.state === 'chase' || g.state === 'cover_move' || g.state === 'advance') { chaseReached = true; break; }
    }
    test('T6: Grunt chases to last known position', chaseReached, `state=${g.state}`);
    
    // Wait until grunt reaches last known position (or timeout)
    let searchReached = false;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 200));
      g = await getGrunt();
      if (g.state === 'search') { searchReached = true; break; }
    }
    test('T7: Grunt transitions to SEARCH at last known pos', searchReached, `final state=${g.state}`);
  } else {
    test('T6: Grunt chases to last known position', false, `couldn't detect (state=${g.state})`);
    test('T7: Grunt transitions to SEARCH at last known pos', false, 'pre-condition failed');
  }

  // ── 7. Enemy re-detects player in search mode ─────────────────────────────
  if (g.state === 'search') {
    await page.evaluate((gpos) => {
      const gs = window.game.scene.getScene('Game');
      gs.player.x = gpos.x - 80; gs.player.y = gpos.y;
      gs.player.body.updateFromGameObject();
    }, g);
    await new Promise(r => setTimeout(r, 200));
    g = await getGrunt();
    test('T8: Re-detection in search state', g.state === 'chase' || g.state === 'alert' || g.state === 'cover_move' || g.state === 'reposition' || g.state === 'advance' || g.state === 'suppress', `state=${g.state}`);
  } else {
    test('T8: Re-detection in search state', false, 'pre-condition failed — no search state reached');
  }

  // ── 8. Stealth takedown notifies nearby enemy ─────────────────────────────
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const grunts = gs.enemies.getChildren().filter(e => e.constructor.name === 'EnemyGrunt');
    if (grunts.length >= 2) {
      grunts[0].x = 300; grunts[0].y = 400; grunts[0].state = 'patrol';
      grunts[0].body.updateFromGameObject();
      grunts[1].x = 350; grunts[1].y = 400; grunts[1].state = 'patrol'; // within 80px
      grunts[1].body.updateFromGameObject();
      grunts[0].stealthKill();
    }
  });
  await new Promise(r => setTimeout(r, 200));
  const secondGruntState = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const grunts = gs.enemies.getChildren().filter(e => e.constructor.name === 'EnemyGrunt' && e.alive);
    return grunts[0]?.state;
  });
  test('T9: Stealth kill notifies nearby enemy (80px)', secondGruntState === 'alert', `state=${secondGruntState}`);

  // ── 9. Bush stealth — enemy can't see player in bush ─────────────────────
  await place(400, 400, 200, 400, Math.PI);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    // Mock isInsideBush to return true for player to prevent frame reset
    gs._origIsInsideBush = gs.bushSystem.isInsideBush;
    gs.bushSystem.isInsideBush = (x, y, r) => {
      if (Math.round(x) === 200 && Math.round(y) === 400) return true;
      return gs._origIsInsideBush.call(gs.bushSystem, x, y, r);
    };
    gs.player.hiddenInBush = true;
    gs.player.revealTimer = 0;
  });
  await new Promise(r => setTimeout(r, 250));
  g = await getGrunt();
  test('T10: Bush stealth hides player (far)', g.state === 'patrol', `state=${g.state} canSee=${g.canSee}`);

  // ── 10. Bush firing reveals player ───────────────────────────────────────
  await place(400, 400, 250, 400, Math.PI);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    // Mock isInsideBush to return true for player to prevent frame reset
    gs.bushSystem.isInsideBush = (x, y, r) => {
      if (Math.round(x) === 250 && Math.round(y) === 400) return true;
      if (gs._origIsInsideBush) return gs._origIsInsideBush.call(gs.bushSystem, x, y, r);
      return false;
    };
    gs.player.hiddenInBush = true;
    gs.player.revealTimer = 200; // actively firing in bush
  });
  await new Promise(r => setTimeout(r, 250));
  g = await getGrunt();
  test('T11: Firing in bush reveals player', g.state === 'alert' || g.canSee === true, `state=${g.state} canSee=${g.canSee}`);

  // Cleanup mock after tests
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    if (gs._origIsInsideBush) {
      gs.bushSystem.isInsideBush = gs._origIsInsideBush;
      delete gs._origIsInsideBush;
    }
    if (gs._testWall) { gs._testWall.destroy(); delete gs._testWall; }
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log(`=== Results: ${passed}/${passed+failed} passed ===`);
  if (failed > 0) {
    console.log(`FAILURES: ${failed} test(s) need attention`);
  } else {
    console.log('All detection tests passed!');
  }
  if (errors.length > 0) {
    console.log(`\nRuntime errors: ${errors.length}`);
    errors.forEach(e => console.log(' -', e));
  }

  await browser.close();
})();
