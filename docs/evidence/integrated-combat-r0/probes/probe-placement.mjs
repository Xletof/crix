// the smoke's own boot + 600ms wait, then: how many of the wave's events had already spawned?
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '../../../../tests/diag-stuck-audit.mjs';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
await page.goto('http://localhost:5173/?nodlg=1&encdbg=1&room=hangar&sector=8&wave=2');
await page.waitForTimeout(4500); await page.mouse.click(360, 640); await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });
const t0 = await page.evaluate(() => { const gs = window.game.scene.getScene('Game'); return { q: gs._spawnQueue.slice(), spawned: gs._waveSpawned, enemies: gs.enemies.getChildren().filter((e) => e.alive).map((e) => e.enemyType) }; });
await page.waitForTimeout(600);
const t1 = await page.evaluate(() => { const gs = window.game.scene.getScene('Game'); return { q: gs._spawnQueue.slice(), spawned: gs._waveSpawned, enemies: gs.enemies.getChildren().filter((e) => e.alive).map((e) => e.enemyType), fps: Math.round(window.game.loop.actualFps) }; });
console.log('at _wave:', JSON.stringify(t0)); console.log('600ms later (the smoke reads here):', JSON.stringify(t1));
await browser.close();
