/**
 * PHASE 0 — Baseline QA Test
 * Tests the current game state before any changes.
 * Runs in headless browser with mobile portrait emulation.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  console.log('=== PHASE 0: BASELINE QA ===');
  console.log('Timestamp:', new Date().toISOString());
  
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
  
  // Mobile portrait emulation (iPhone 14 Pro-like)
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  
  const consoleMessages = [];
  const consoleErrors = [];
  const pageErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'error') consoleErrors.push(text);
  });
  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.log('PAGE ERROR:', err.toString().substring(0, 200));
  });
  
  // ── Load game ──────────────────────────────────────────────────────────
  console.log('\n--- Loading game ---');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('Console messages on load:', consoleMessages.length);
  console.log('Console errors on load:', consoleErrors.length);
  consoleErrors.forEach(e => console.log('  ERROR:', e.substring(0, 150)));
  console.log('Page errors on load:', pageErrors.length);
  pageErrors.forEach(e => console.log('  PAGE ERROR:', e.substring(0, 150)));
  
  // ── Navigate to game ──────────────────────────────────────────────────
  console.log('\n--- Starting game ---');
  // Click to start (title screen)
  await page.mouse.click(196, 426);
  await new Promise(r => setTimeout(r, 1500));
  
  // Try to start game scene
  const startResult = await page.evaluate(() => {
    if (!window.game) return 'no game object';
    const scenes = window.game.scene.getScenes(true);
    const sceneNames = scenes.map(s => s.sys.config.key);
    
    // Try to start Game if on Title
    const title = window.game.scene.getScene('Title');
    if (title && title.sys.isActive()) {
      title.scene.start('Game');
      return 'started Game from Title';
    }
    
    // Maybe intro is playing
    const intro = window.game.scene.getScene('Intro');
    if (intro && intro.sys.isActive()) {
      intro.scene.start('Game');
      return 'started Game from Intro';
    }
    
    const game = window.game.scene.getScene('Game');
    if (game && game.sys.isActive()) return 'Game already active';
    
    return 'active scenes: ' + sceneNames.join(', ');
  });
  console.log('Start result:', startResult);
  await new Promise(r => setTimeout(r, 3000));
  
  // ── Collect game state ────────────────────────────────────────────────
  console.log('\n--- Game State ---');
  const gameState = await page.evaluate(() => {
    const gs = window.game?.scene?.getScene('Game');
    if (!gs) return null;
    const p = gs.player;
    if (!p) return { error: 'no player' };
    
    const enemies = gs.enemies?.getChildren()?.filter(e => e.alive) || [];
    
    return {
      playerAlive: p.alive,
      playerPos: { x: Math.round(p.x), y: Math.round(p.y) },
      playerHP: p.hp,
      playerMaxHP: p.maxHp,
      playerSpeed: p.body?.maxSpeed,
      playerIsDashing: p.isDashing,
      playerDashCharges: p.dashCharges,
      playerAmmo: p.ammo,
      playerAmmoMax: p.ammoMax,
      enemyCount: enemies.length,
      enemyTypes: enemies.map(e => e.constructor.name),
      enemyStates: enemies.map(e => e.state),
      roomSpec: gs.roomSpec ? { bounds: gs.roomSpec.bounds } : null,
      cameraZoom: gs.cameras?.main?.zoom,
      fxExists: !!gs.fx,
      hudScene: !!window.game.scene.getScene('HUD'),
    };
  });
  console.log('Game state:', JSON.stringify(gameState, null, 2));
  
  // ── Test movement ─────────────────────────────────────────────────────
  console.log('\n--- Testing Movement ---');
  
  // Move right
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 300));
  const posAfterRight = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return p ? { x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y) } : null;
  });
  await page.keyboard.up('ArrowRight');
  console.log('After moving right:', JSON.stringify(posAfterRight));
  
  // Move down
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 300));
  const posAfterDown = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return p ? { x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y) } : null;
  });
  await page.keyboard.up('ArrowDown');
  console.log('After moving down:', JSON.stringify(posAfterDown));
  
  // Stop and check deceleration
  await new Promise(r => setTimeout(r, 200));
  const posAfterStop = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return p ? { x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y) } : null;
  });
  console.log('After stopping:', JSON.stringify(posAfterStop));
  
  // ── Test dash ─────────────────────────────────────────────────────────
  console.log('\n--- Testing Dash ---');
  
  // Dash while moving
  const preDashPos = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return { x: Math.round(p.x), y: Math.round(p.y), isDashing: p.isDashing, charges: p.dashCharges };
  });
  console.log('Pre-dash:', JSON.stringify(preDashPos));
  
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.down('ShiftLeft');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.up('ShiftLeft');
  await new Promise(r => setTimeout(r, 100));
  
  const duringDash = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return { x: Math.round(p.x), y: Math.round(p.y), isDashing: p.isDashing, charges: p.dashCharges, angle: p.dashAngle };
  });
  console.log('During/after dash:', JSON.stringify(duringDash));
  
  await page.keyboard.up('ArrowRight');
  await new Promise(r => setTimeout(r, 400));
  
  const afterDashRecovery = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return { x: Math.round(p.x), y: Math.round(p.y), isDashing: p.isDashing, charges: p.dashCharges, vx: Math.round(p.body.velocity.x) };
  });
  console.log('After dash recovery:', JSON.stringify(afterDashRecovery));
  
  // Dash from standstill
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.down('ShiftLeft');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.up('ShiftLeft');
  await new Promise(r => setTimeout(r, 300));
  
  const afterStandstillDash = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return { isDashing: p.isDashing, charges: p.dashCharges };
  });
  console.log('After standstill dash:', JSON.stringify(afterStandstillDash));
  
  // Rapid repeated dash
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down('ShiftLeft');
    await new Promise(r => setTimeout(r, 30));
    await page.keyboard.up('ShiftLeft');
    await new Promise(r => setTimeout(r, 50));
  }
  await new Promise(r => setTimeout(r, 300));
  
  const afterRapidDash = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return { isDashing: p.isDashing, charges: p.dashCharges, alive: p.alive, x: Math.round(p.x), y: Math.round(p.y) };
  });
  console.log('After rapid dash x5:', JSON.stringify(afterRapidDash));
  
  // Hold shift
  await page.keyboard.down('ShiftLeft');
  await new Promise(r => setTimeout(r, 1000));
  await page.keyboard.up('ShiftLeft');
  await new Promise(r => setTimeout(r, 300));
  
  const afterHoldShift = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game')?.player;
    return { isDashing: p.isDashing, charges: p.dashCharges, alive: p.alive };
  });
  console.log('After holding shift 1s:', JSON.stringify(afterHoldShift));
  
  // ── Test shooting ─────────────────────────────────────────────────────
  console.log('\n--- Testing Shooting ---');
  
  const preShoot = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    return { 
      ammo: gs.player.ammo, 
      ammoMax: gs.player.ammoMax,
      superCharge: gs.player.superCharge,
      bulletCount: gs.playerBullets?.getChildren()?.length
    };
  });
  console.log('Pre-shoot state:', JSON.stringify(preShoot));
  
  // Fire with space
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 50));
  await page.keyboard.up('Space');
  await new Promise(r => setTimeout(r, 200));
  
  const afterShoot = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    return { 
      ammo: gs.player.ammo, 
      bulletCount: gs.playerBullets?.getChildren()?.filter(b => b.active)?.length
    };
  });
  console.log('After shooting:', JSON.stringify(afterShoot));
  
  // Fire until empty
  for (let i = 0; i < 10; i++) {
    await page.keyboard.down('Space');
    await new Promise(r => setTimeout(r, 50));
    await page.keyboard.up('Space');
    await new Promise(r => setTimeout(r, 180));
  }
  
  const afterEmptyMag = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    return { ammo: gs.player.ammo, reloading: gs.player._reloading };
  });
  console.log('After emptying magazine:', JSON.stringify(afterEmptyMag));
  
  // Wait for reload
  await new Promise(r => setTimeout(r, 3000));
  const afterReload = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    return { ammo: gs.player.ammo };
  });
  console.log('After reload wait:', JSON.stringify(afterReload));
  
  // ── Test enemy behavior ───────────────────────────────────────────────
  console.log('\n--- Testing Enemy Behavior ---');
  
  const enemyDetails = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const enemies = gs.enemies?.getChildren()?.filter(e => e.alive) || [];
    return enemies.map(e => ({
      type: e.constructor.name,
      state: e.state,
      hp: e.hp,
      x: Math.round(e.x),
      y: Math.round(e.y),
      aim: +e._aim?.toFixed(2),
      hasPatrolPath: e.patrolPath?.length > 0,
      canSeePlayer: e.canSee ? e.canSee(gs.player) : 'no canSee method',
    }));
  });
  console.log('Enemy details:', JSON.stringify(enemyDetails, null, 2));
  
  // ── Test takedown ─────────────────────────────────────────────────────
  console.log('\n--- Testing Takedown ---');
  
  const takedownState = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    return {
      takedownTarget: gs._takedownTarget ? 'exists' : 'null',
      takedownGfx: !!gs.takedownGfx,
    };
  });
  console.log('Takedown state:', JSON.stringify(takedownState));
  
  // ── Test mobile controls ──────────────────────────────────────────────
  console.log('\n--- Testing Mobile Controls ---');
  
  const mobileControls = await page.evaluate(() => {
    const hud = window.game?.scene?.getScene('HUD');
    if (!hud) return { error: 'no HUD scene' };
    return {
      hasLeftJoystick: !!hud.leftJoy,
      hasRightJoystick: !!hud.rightJoy,
      hasDashButton: !!hud.dashButton,
      hasSuperButton: !!hud.superButton,
      hasPauseButton: !!hud.pauseBtn,
      leftJoyPos: hud.leftJoy ? { x: Math.round(hud.leftJoy.base.x), y: Math.round(hud.leftJoy.base.y) } : null,
      rightJoyPos: hud.rightJoy ? { x: Math.round(hud.rightJoy.base.x), y: Math.round(hud.rightJoy.base.y) } : null,
    };
  });
  console.log('Mobile controls:', JSON.stringify(mobileControls, null, 2));
  
  // ── Test visual state ─────────────────────────────────────────────────
  console.log('\n--- Visual/Rendering State ---');
  
  const visualState = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const p = gs?.player;
    return {
      playerVisible: p?.visible,
      playerAlpha: p?.alpha,
      playerScaleX: p?.scaleX?.toFixed(2),
      playerScaleY: p?.scaleY?.toFixed(2),
      playerRotation: p?.rotation?.toFixed(3),
      weaponVisible: p?.weaponSprite?.visible,
      weaponAlpha: p?.weaponSprite?.alpha?.toFixed(2),
      cameraZoom: gs?.cameras?.main?.zoom?.toFixed(2),
      cameraFollow: gs?.cameras?.main?._follow ? 'following' : 'not following',
      debugAI: gs?.debugAI,
      visionGraphicsVisible: gs?.visionGraphics?.visible,
    };
  });
  console.log('Visual state:', JSON.stringify(visualState, null, 2));
  
  // ── Wait and check console after gameplay ─────────────────────────────
  console.log('\n--- Console After Gameplay ---');
  
  // Play for a few more seconds with various actions
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.down('ArrowUp');
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 100));
  await page.keyboard.up('Space');
  await new Promise(r => setTimeout(r, 1000));
  
  const finalErrors = pageErrors.length;
  const finalConsoleErrors = consoleErrors.length;
  
  console.log('\n=== FINAL REPORT ===');
  console.log('Total console messages:', consoleMessages.length);
  console.log('Total console errors:', finalConsoleErrors);
  if (finalConsoleErrors > 0) {
    console.log('Console errors:');
    consoleErrors.forEach(e => console.log('  -', e.substring(0, 200)));
  }
  console.log('Total page errors (uncaught):', finalErrors);
  if (finalErrors > 0) {
    console.log('Page errors:');
    pageErrors.forEach(e => console.log('  -', e.substring(0, 200)));
  }
  
  // Check final player state for corruption
  const finalState = await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const p = gs?.player;
    if (!p) return { error: 'no player' };
    return {
      alive: p.alive,
      isDashing: p.isDashing,
      x: p.x, y: p.y,
      xIsNaN: isNaN(p.x), yIsNaN: isNaN(p.y),
      vxIsNaN: isNaN(p.body?.velocity?.x),
      vyIsNaN: isNaN(p.body?.velocity?.y),
      dashCharges: p.dashCharges,
      dashChargesNaN: isNaN(p.dashCharges),
      ammo: p.ammo,
    };
  });
  console.log('Final player state:', JSON.stringify(finalState));
  
  const hasNaN = finalState.xIsNaN || finalState.yIsNaN || finalState.vxIsNaN || finalState.vyIsNaN || finalState.dashChargesNaN;
  console.log('\nNaN corruption detected:', hasNaN);
  console.log('Player stuck in dash:', finalState.isDashing);
  console.log('Runtime errors:', finalErrors > 0);
  
  await browser.close();
  console.log('\n=== BASELINE QA COMPLETE ===');
})();
