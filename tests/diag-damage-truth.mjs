// DIAG — DOES THE FLOATING NUMBER TELL THE TRUTH ABOUT THE SHOCK CAPTAIN?
//
//   node tests/diag-damage-truth.mjs
//
// The handset saw `0 0 0` printed over a Captain whose durability bar was
// visibly draining. This traces ONE hit at a time all the way through the real
// `damage()` path — the same call `GameScene`'s bullet collision makes — and
// prints, for each shape of hit, what was actually removed against what was
// actually rendered.
//
// It is a DIAGNOSTIC, not an assertion suite: it prints a table and exits 0.
// `smoke-captain-damage` is the gate. This exists so the fix can be A/B'd
// against the build it replaces, which is the only thing that proves a check
// is testing the change.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1&room=hangar&sector=8');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(3000);

const out = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // CAPTURE WHAT IS ACTUALLY RENDERED, at the renderer. Asserting a helper in
  // isolation is exactly what §24 forbids: the question is what the player
  // reads, and only `fx.damageNumber` knows that.
  const printed = [];
  const realNum = gs.fx.damageNumber.bind(gs.fx);
  gs.fx.damageNumber = (x, y, amount, color, tier) => {
    printed.push({ amount, color: color ?? null, tier: tier ?? null });
    return realNum(x, y, amount, color, tier);
  };

  const rows = [];
  const hit = async (label, raw) => {
    let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
    if (!c) c = gs.spawnChampion(gs.player.x + 420, gs.player.y, 'captain');
    // A dead Captain cannot be measured; keep him up so the whole ladder runs
    // through one actor's real state rather than five fresh ones.
    c.die = () => { c.hp = Math.max(c.hp, 400); };
    const before = { armour: c.armour, hp: c.hp, broken: c.armourBroken };
    printed.length = 0;
    c.damage(raw, { x: 40, y: 0 });
    await wait(60);
    const after = { armour: c.armour, hp: c.hp, broken: c.armourBroken };
    const armourRemoved = Math.max(0, before.armour - after.armour);
    const bodyRemoved = Math.max(0, before.hp - after.hp);
    rows.push({
      label, raw,
      armourBefore: Math.round(before.armour), armourAfter: Math.round(after.armour),
      hpBefore: Math.round(before.hp), hpAfter: Math.round(after.hp),
      armourRemoved: Math.round(armourRemoved),
      bodyRemoved: Math.round(bodyRemoved),
      durabilityRemoved: Math.round(armourRemoved + bodyRemoved),
      broke: !before.broken && after.broken,
      printed: printed.map((p) => `${p.amount}${p.color ? '@' + p.color : ''}`),
    });
  };

  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 420, gs.player.y, 'captain');
  const d = c.def;

  // 1. CHIP against intact armour — the shape the handset saw as `0`.
  await hit('chip / armour only', 40);
  await hit('rifle round / armour only', 120);
  // 2. Walk the armour down to a sliver so the NEXT hit is the exact break.
  c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  c.armour = 90;
  await hit('exact break (small overkill)', 200);
  // 3. Body-only, armour already gone.
  await hit('body only', 260);
  await hit('body only / big', 620);
  // 4. A fresh Captain for the SPILL case: one hit that breaks AND wounds.
  const fresh = gs.spawnChampion(gs.player.x + 300, gs.player.y + 120, 'captain');
  fresh.die = () => { fresh.hp = Math.max(fresh.hp, 400); };
  gs.enemies.getChildren().filter((e) => e.alive && e.isChampion && e !== fresh)
    .forEach((e) => { e.alive = false; e.setActive(false).setVisible(false); });
  await hit('SPILL — super over-commit', 3000);
  await hit('body only after spill', 300);

  return { rows, def: { armour: d.armour, armourTake: d.armourTake, armourSpill: d.armourSpill, hp: d.hp } };
});

console.log('def:', JSON.stringify(out.def));
console.log('');
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('case', 30), pad('raw', 6), pad('armour', 14), pad('hp', 14),
  pad('removed', 9), 'printed');
for (const r of out.rows) {
  console.log(
    pad(r.label + (r.broke ? ' *BREAK*' : ''), 30),
    pad(r.raw, 6),
    pad(`${r.armourBefore}->${r.armourAfter}`, 14),
    pad(`${r.hpBefore}->${r.hpAfter}`, 14),
    pad(r.durabilityRemoved, 9),
    r.printed.join(' , ') || '(none)',
  );
}
const lies = out.rows.filter((r) => r.durabilityRemoved > 0
  && r.printed.some((p) => p.split('@')[0] === '0'));
console.log('');
console.log(`LIES (durability fell, a zero was printed): ${lies.length}`);
for (const l of lies) console.log(`  - ${l.label}: removed ${l.durabilityRemoved}, printed ${l.printed.join(',')}`);

await browser.close();
