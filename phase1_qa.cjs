/**
 * Phase 1 — Vertical Slice QA Test
 * Verifies all vertical slice requirements including:
 * 1. Snappy movement speeds & limits.
 * 2. Dash charge count (2) & recharge cooldown (4s).
 * 3. Primary fire Space key binding & ammo reload cycle.
 * 4. Accuracy-based super combo multiplier (hit streak builds mult, miss resets).
 * 5. Handcrafted vertical slice hangar room layout.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  console.log("=== Phase 1: Vertical Slice QA ===");
  
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
  
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.log('PAGE ERROR:', err.toString().substring(0, 150));
  });
  page.on('console', msg => {
    console.log('[BROWSER]', msg.text());
  });

  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 3000));
  
  // Click start screen
  await page.mouse.click(360, 640);
  await new Promise(r => setTimeout(r, 600));
  
  await page.evaluate(() => {
    const t = window.game?.scene?.getScene('Title');
    if (t?.sys?.isActive()) t.scene.start('Game');
  });
  
  await new Promise(r => setTimeout(r, 2000));

  const getPlayer = async () => page.evaluate(() => {
    const gs = window.game?.scene?.getScene('Game');
    const p = gs?.player;
    if (!p) return null;
    return {
      x: Math.round(p.x),
      y: Math.round(p.y),
      vx: Math.round(p.body.velocity.x),
      vy: Math.round(p.body.velocity.y),
      ammo: p.ammo,
      superCharge: p.superCharge,
      dashCharges: p.dashCharges,
      accuracyMult: p.accuracyMult,
      hitStreak: p.hitStreak,
    };
  });

  const getEnemies = async () => page.evaluate(() => {
    const gs = window.game?.scene?.getScene('Game');
    const enemies = gs?.enemies?.getChildren()?.filter(e => e.alive) || [];
    return enemies.map(e => ({
      type: e.constructor.name,
      x: Math.round(e.x),
      y: Math.round(e.y),
      state: e.state,
    }));
  });

  const getRoom = async () => page.evaluate(() => {
    const gs = window.game?.scene?.getScene('Game');
    return {
      id: gs?.roomSpec?.id,
      name: gs?.roomSpec?.name,
      bounds: gs?.roomSpec?.bounds,
      terminalsCount: gs?.terminals?.length,
      terminalPos: gs?.terminals?.[0] ? { x: Math.round(gs.terminals[0].x), y: Math.round(gs.terminals[0].y) } : null,
    };
  });

  const PASS = '✅';
  const FAIL = '❌';
  let passed = 0, failed = 0;
  const test = (label, cond, detail = '') => {
    const icon = cond ? PASS : FAIL;
    console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
    cond ? passed++ : failed++;
  };

  // ── 1. Handcrafted Hangar Room verification ────────────────────────────────
  console.log('\nChecking Handcrafted Hangar Layout...');
  const r = await getRoom();
  test('Hangar id matches', r.id === 'hangar', `id=${r.id}`);
  test('Hangar width x height matches spec', r.bounds?.w === 1600 && r.bounds?.h === 1400, `w=${r.bounds?.w} h=${r.bounds?.h}`);
  test('Central Terminal exists at expected coordinate (800, 700)', r.terminalsCount === 1 && r.terminalPos?.x === 800 && r.terminalPos?.y === 700, `terminals=${r.terminalsCount} pos=${JSON.stringify(r.terminalPos)}`);

  const enemies = await getEnemies();
  test('Scout, Trooper, Heavy roles spawned', enemies.length === 3, `count=${enemies.length}`);
  const scout = enemies.find(e => e.y < 350);
  test('Scout spawned at upper patrol lane', !!scout, scout ? `scoutPos=(${scout.x}, ${scout.y})` : 'not found');

  // ── 2. Snappy movement test ────────────────────────────────────────────────
  console.log('\nTesting Snappy Movement...');
  let p = await getPlayer();
  const startX = p.x;
  
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 200));
  p = await getPlayer();
  test('Player moves right', p.x > startX, `x=${p.x} vx=${p.vx}`);
  test('Player max speed is 380', Math.abs(p.vx) === 380, `vx=${p.vx}`);
  
  await page.keyboard.up('ArrowRight');
  await new Promise(r => setTimeout(r, 100));
  p = await getPlayer();
  test('Player decelerates to 0', p.vx === 0, `vx=${p.vx}`);

  // ── 3. Dash cooldown and charges test ──────────────────────────────────────
  console.log('\nTesting Dash Cooldown & Charges...');
  p = await getPlayer();
  test('Player has 2 max dash charges', p.dashCharges === 2, `charges=${p.dashCharges}`);
  
  // Trigger dash
  await page.keyboard.down('ShiftLeft');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.up('ShiftLeft');
  await new Promise(r => setTimeout(r, 250)); // wait for 180ms dash duration to end
  
  p = await getPlayer();
  test('Dash consumes 1 charge', p.dashCharges === 1, `charges=${p.dashCharges}`);
  
  // Trigger second dash
  await page.keyboard.down('ShiftLeft');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.up('ShiftLeft');
  await new Promise(r => setTimeout(r, 250)); // wait for dash to end
  
  p = await getPlayer();
  test('Second dash consumes last charge', p.dashCharges === 0, `charges=${p.dashCharges}`);

  // Wait 4.2 seconds for dash reload
  console.log('Waiting for dash charge reload (4.0s)...');
  await new Promise(r => setTimeout(r, 4200));
  p = await getPlayer();
  test('Dash charge reloaded', p.dashCharges >= 1, `charges=${p.dashCharges}`);

  // ── 4. Primary fire & ammo test ──────────────────────────────────────────
  console.log('\nTesting Primary Fire & Space Binding...');
  p = await getPlayer();
  const startAmmo = p.ammo;
  test('Max ammo is 3', startAmmo === 3, `ammo=${startAmmo}`);
  
  // Shoot once with SPACE key
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.up('Space');
  await new Promise(r => setTimeout(r, 100));
  
  p = await getPlayer();
  test('Pistol fire decrements ammo', p.ammo === 2, `ammo=${p.ammo}`);

  // Wait 1.0s for reload
  await new Promise(r => setTimeout(r, 1000));
  p = await getPlayer();
  test('Ammo reloaded back to max', p.ammo === 3, `ammo=${p.ammo}`);

  // ── 5. Accuracy combo multiplier test ──────────────────────────────────────
  console.log('\nTesting Accuracy Combo Multiplier...');
  // Force positioning player right next to the stationary shooter enemy at (1050, 700)
  // Clear any existing bullets and reset stats to isolate combo testing.
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.playerBullets.clear(true, true);
    gs.player.hitStreak = 0;
    gs.player.accuracyMult = 1.0;
    gs.player.x = 980;
    gs.player.y = 700;
    gs.player.body.updateFromGameObject();
    // make sure enemies don't kill player and don't die during test
    gs.player.hp = 99999;
    gs.enemies.getChildren().forEach(e => {
      if (e.alive) {
        e.hp = 99999;
        e.state = 'alert';
        e.alertTimer = 999999;
      }
    });
  });
  
  // Shoot 3 consecutive times targeting the enemy
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('Space');
    await new Promise(r => setTimeout(r, 50));
    await page.keyboard.up('Space');
    await new Promise(r => setTimeout(r, 250)); // wait a bit more for hit
    const state = await page.evaluate(() => {
      const p = window.game.scene.getScene('Game')?.player;
      return p ? {
        ammo: p.ammo,
        streak: p.hitStreak,
        mult: p.accuracyMult,
        cooldown: p.fireCooldown,
        x: Math.round(p.x),
        y: Math.round(p.y),
        stagger: p._hurtStaggerMs
      } : null;
    });
    console.log(`Shot ${i + 1} -> ammo: ${state.ammo}, streak: ${state.streak}, mult: ${state.mult}, cooldown: ${Math.round(state.cooldown)}, stagger: ${Math.round(state.stagger)}, x: ${state.x}`);
  }
  
  p = await getPlayer();
  test('Consecutive hit builds combo streak', p.hitStreak >= 3, `streak=${p.hitStreak}`);
  test('Combo multiplier increases (> 1.0)', p.accuracyMult > 1.0, `multiplier=x${p.accuracyMult}`);

  const multBeforeMiss = p.accuracyMult;
  
  // Move player far away so next shots miss
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.player.x = 200;
    gs.player.y = 200;
    gs.player.body.updateFromGameObject();
  });
  
  // Shoot once in empty space (miss)
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.up('Space');
  await new Promise(r => setTimeout(r, 600)); // wait for bullet to expire out of range
  
  p = await getPlayer();
  test('Shot miss resets combo streak to 0', p.hitStreak === 0, `streak=${p.hitStreak}`);
  test('Shot miss resets combo multiplier back to 1.0', p.accuracyMult === 1.0, `multiplier=x${p.accuracyMult}`);

  // Summary
  console.log('');
  console.log(`=== Results: ${passed}/${passed+failed} passed ===`);
  if (failed > 0) {
    console.log(`FAILURES: ${failed} test(s) failed`);
  } else {
    console.log('All vertical slice tests passed successfully!');
  }
  if (pageErrors.length > 0) {
    console.log(`Runtime errors detected: ${pageErrors.length}`);
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
