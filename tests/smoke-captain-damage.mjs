// DAMAGE-FEEDBACK TRUTH — PHASE B.2.2, AND IT IS A BUG GATE BEFORE IT IS A
// FEATURE GATE.
//
// THE DEFECT IT EXISTS AGAINST: a human watching a handset saw `0 0 0` printed
// over a Shock Captain whose durability was visibly draining. The cause was
// structural rather than cosmetic — `Enemy.damage` emits its hit event with the
// number it was asked to take off the BODY, and while the reactive armour holds
// that number is zero, so the renderer printed a truthful-looking lie. Measured
// on the shipped build: a 120-damage round removed 102 points of durability and
// rendered `0`; a Super removed 2285 and rendered 485.
//
// THE LAW: IF REAL DURABILITY DECREASED, FEEDBACK MAY NOT SAY ZERO, and the
// figure shown maps to what was actually removed.
//
// It drives the REAL `damage()` path — the same call `GameScene`'s bullet
// collision makes — and captures at `fx.damageNumber`, which is the only place
// that knows what the player was actually shown. Asserting a helper in
// isolation would pass on a build where nothing calls it.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function run(query, fn) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 3311 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE LADDER: EVERY SHAPE OF HIT, THROUGH THE REAL PATH ───────────────
const led = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const printed = [];
  const real = gs.fx.damageNumber.bind(gs.fx);
  gs.fx.damageNumber = (x, y, amount, color, tier) => {
    printed.push({ amount, color: color ?? null });
    return real(x, y, amount, color, tier);
  };

  const rows = [];
  const hit = async (label, raw, c) => {
    const b = { armour: c.armour, hp: c.hp, broken: c.armourBroken };
    printed.length = 0;
    c.damage(raw, { x: 40, y: 0 });
    await wait(50);
    const removed = Math.max(0, b.armour - c.armour) + Math.max(0, b.hp - c.hp);
    // The CRIT label is a word, not a figure: filter to the numeric labels,
    // which are the only ones making a claim about damage.
    const nums = printed.filter((p) => typeof p.amount === 'number'
      || /^\d+$/.test(String(p.amount)));
    rows.push({
      label, raw,
      removed: Math.round(removed),
      armourRemoved: Math.round(Math.max(0, b.armour - c.armour)),
      bodyRemoved: Math.round(Math.max(0, b.hp - c.hp)),
      broke: !b.broken && c.armourBroken,
      shown: nums.map((p) => Number(p.amount)),
      colors: nums.map((p) => p.color),
      labelCount: nums.length,
    });
  };

  // IMMORTAL ONLY WHERE IMMORTALITY IS HARMLESS. Stubbing `die` keeps one
  // actor alive down the whole ladder — but on the LETHAL case that same stub
  // puts hp back up above where it started, so the rig measures "0 removed"
  // and calls a correct build a liar. The killing blow gets a real actor and a
  // real death.
  const mk = (dx, dy, immortal = true) => {
    const c = gs.spawnChampion(gs.player.x + dx, gs.player.y + dy, 'captain');
    if (immortal) c.die = () => { c.hp = Math.max(c.hp, 500); };
    return c;
  };
  // A FRESH ACTOR PER CASE. The ladder has to be able to ask about an intact
  // layer more than once, and walking one Captain down it would let an earlier
  // case decide a later one.
  let c = mk(380, 0);
  await hit('chip / armour only', 40, c);
  await hit('round / armour only', 120, c);
  c.armour = 90;
  await hit('exact break', 200, c);
  await hit('body only', 260, c);
  await hit('body only / big', 620, c);
  const c2 = mk(300, 160);
  await hit('SPILL — super over-commit', 3000, c2);
  await hit('body after spill', 300, c2);
  // A KILLING BLOW. The number shown may never exceed what the pool actually
  // held: `amount` is a request, and a request is not a removal.
  const c3 = mk(-320, 120, false);
  c3.armourBroken = true; c3.armour = 0; c3.hp = 210;
  await hit('lethal', 4000, c3);
  return { rows, lethalHp: c3.hp, lethalAlive: c3.alive };
}));

const lies = led.rows.filter((r) => r.removed > 0 && r.shown.some((v) => v === 0));
check(lies.length === 0,
  'no displayed zero on any hit that actually removed durability',
  lies.map((l) => `${l.label}: removed ${l.removed}, shown ${l.shown}`).join(' | '));

const mismatched = led.rows.filter((r) => !r.shown.some((v) => Math.abs(v - r.removed) <= 2));
check(mismatched.length === 0,
  'the displayed figure is the durability actually removed (armour + body)',
  mismatched.map((r) => `${r.label}: removed ${r.removed}, shown ${r.shown}`).join(' | '));

const armourOnly = led.rows.filter((r) => r.armourRemoved > 0 && r.bodyRemoved === 0);
check(armourOnly.length >= 2 && armourOnly.every((r) => r.colors.some((c) => c && c !== '#ffffff')),
  'an armour-only hit is coloured in the defensive language, not the body one',
  armourOnly.map((r) => `${r.label}: ${r.colors}`).join(' | '));

const bodyOnly = led.rows.filter((r) => r.bodyRemoved > 0 && r.armourRemoved === 0);
check(bodyOnly.length >= 2 && bodyOnly.every((r) => !r.colors.includes('#7fd4ff')),
  'a body hit does NOT wear the armour colour',
  bodyOnly.map((r) => `${r.label}: ${r.colors}`).join(' | '));

const spill = led.rows.find((r) => r.label.startsWith('SPILL'));
check(!!spill && spill.broke && spill.labelCount === 1,
  'a spill hit is ONE number, not two overlapping ones',
  spill ? `${spill.labelCount} numeric labels, shown ${spill.shown}` : 'no spill row');
check(!!spill && spill.armourRemoved > 0 && spill.bodyRemoved > 0,
  'the spill case really did break the layer AND wound the body',
  spill ? `armour ${spill.armourRemoved}, body ${spill.bodyRemoved}` : 'no spill row');

const lethal = led.rows.find((r) => r.label === 'lethal');
check(!!lethal && lethal.shown.every((v) => v <= lethal.removed + 2),
  'a killing blow shows what the pool HELD, never what was asked for',
  lethal ? `removed ${lethal.removed}, shown ${lethal.shown}` : 'no lethal row');

// ── 2. THE HOOK IS OPT-IN: ORDINARY ENEMIES ARE UNTOUCHED ──────────────────
const stock = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs._startWave(0);
  await wait(2400);
  const printed = [];
  const real = gs.fx.damageNumber.bind(gs.fx);
  gs.fx.damageNumber = (x, y, amount, color, tier) => {
    printed.push({ amount, color: color ?? null });
    return real(x, y, amount, color, tier);
  };
  const e = gs.enemies.getChildren().find((x) => x.alive && !x.isChampion);
  if (!e) return { none: true };
  e.hp = e.hpMax = 9999;
  const before = e.hp;
  e.damage(137, null);
  await wait(50);
  const nums = printed.filter((p) => /^\d+$/.test(String(p.amount)));
  return {
    hasHook: typeof e._damageFeedback === 'function',
    removed: Math.round(before - e.hp),
    shown: nums.map((p) => Number(p.amount)),
    colors: nums.map((p) => p.color),
  };
}));
check(!stock.none && stock.hasHook === false,
  'an ordinary enemy implements no feedback hook — the layer is opt-in by absence',
  `hasHook=${stock.hasHook}`);
check(!stock.none && stock.shown.includes(stock.removed),
  'an ordinary enemy still shows exactly the damage it took',
  `removed ${stock.removed}, shown ${stock.shown}`);

await browser.close();
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the number the player reads is the durability actually removed`);
