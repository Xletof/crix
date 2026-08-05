// The nemesis system: named, composed mini-bosses instead of a coin flip.
//
// The design claim is "varied without hand-authoring a hundred encounters", so
// variety is what this measures — not that one roll looks plausible, but that
// the generator's OUTPUT SPACE is actually large and that the escalation is
// real. A generator that returns the same thing 90% of the time passes every
// single-roll assertion you can write.
//
// The traits are also load-bearing on balance, not decoration: VOLATILE exists
// to punish melee-spam and REGENERATOR to punish chip damage, so both are
// checked for their EFFECT in a live arena, not just for being in the list.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => fail(`page error: ${e}`));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless' }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { rollNemesis, TRAITS, traitCountFor, traitById } = await import('/src/data/nemesis.js');
  const out = { traitCount: TRAITS.length };

  // ── Output space ───────────────────────────────────────────────────────
  const names = new Set(), loadouts = new Set(), bases = new Set(), seenTraits = new Set();
  let dupeTraitInOneRoll = 0;
  for (let i = 0; i < 600; i++) {
    const n = rollNemesis(20);
    names.add(n.name);
    loadouts.add(`${n.base}:${n.traits.slice().sort().join(',')}`);
    bases.add(n.base);
    n.traits.forEach((t) => seenTraits.add(t));
    if (new Set(n.traits).size !== n.traits.length) dupeTraitInOneRoll++;
  }
  out.variety = {
    names: names.size,
    loadouts: loadouts.size,
    bases: bases.size,
    traitsSeen: seenTraits.size,
    dupeTraitInOneRoll,
  };

  // ── Escalation ─────────────────────────────────────────────────────────
  out.counts = [1, 6, 12, 30, 99].map((s) => ({ sector: s, n: traitCountFor(s) }));
  out.rolledCounts = [1, 30].map((s) => ({
    sector: s,
    n: rollNemesis(s).traits.length,
  }));
  out.hpBySector = [1, 10, 30].map((s) => ({
    sector: s,
    // Force an identical loadout so only the sector term moves.
    hp: rollNemesis(s, { base: 'grunt', traits: ['armored'] }).hpMult,
  }));

  // ── Traits do what they say ────────────────────────────────────────────
  const forced = (ids) => rollNemesis(1, { base: 'grunt', traits: ids });
  out.effects = {
    armoredHp: forced(['armored']).hpMult,
    swiftSpeed: forced(['swift']).speedMult,
    swiftFragile: forced(['swift']).hpMult,
    colossalScale: forced(['colossal']).scale,
    regen: forced(['regenerator']).regenPerSec,
    summon: forced(['summoner']).summonMs,
    volatile: forced(['volatile']).volatile,
    // Composition: two traits must apply BOTH, not the last one only.
    combined: forced(['armored', 'swift']),
    plainHp: forced([]).hpMult,
  };

  // ── A live nemesis mini-boss ───────────────────────────────────────────
  gs.loadRoom(ROOMS[0]);
  await new Promise((res) => setTimeout(res, 1400));
  gs.sector = 20;
  const mb = gs._spawnMiniBoss();
  await new Promise((res) => setTimeout(res, 600));
  out.live = {
    named: !!mb?._nemesis?.name,
    name: mb?._nemesis?.name || null,
    traits: mb?._nemesis?.traits || [],
    isMiniBoss: !!mb?._miniBoss,
    hp: mb?.hp ?? 0,
    baseType: mb?.enemyType,
  };

  // REGENERATOR must actually heal. Driven through the real tick.
  const heal = gs.enemies.getChildren().find((e) => e.alive && e._regenPerSec > 0)
    || (() => { mb._regenPerSec = 0.05; return mb; })();
  heal.hp = Math.round(heal.hpMax * 0.5);
  const hpBefore = heal.hp;
  for (let i = 0; i < 14; i++) { gs._tickNemesis(200); await new Promise((r2) => setTimeout(r2, 40)); }
  out.regenWorks = { before: hpBefore, after: Math.round(heal.hp), max: heal.hpMax };

  // VOLATILE must detonate on death and hurt the player standing on it — that
  // is the whole point of the trait, and a version that merely plays a puff
  // would pass a "does it explode" check while changing nothing about play.
  gs.player.hp = gs.player.hpMax;
  gs.player.shieldHp = 0;
  gs.player.lastHurtAt = -99999;
  const vic = gs.enemies.getChildren().find((e) => e.alive && e !== heal) || heal;
  vic._volatile = { radius: 200, damage: 300 };
  gs.player.setPosition(vic.x + 30, vic.y);
  const hpBeforeBlast = gs.player.hp;
  vic.damage(999999);
  await new Promise((res) => setTimeout(res, 500));
  out.volatileHurts = { before: hpBeforeBlast, after: Math.round(gs.player.hp) };

  return out;
});

await browser.close();

// ── Output space ─────────────────────────────────────────────────────────
const v = r.variety;
check(v.names > 200, 'names do not repeat in practice',
  `${v.names} distinct names in 600 rolls`);
check(v.loadouts > 60, 'the loadout space is genuinely large',
  `${v.loadouts} distinct base+trait combinations in 600 rolls`);
check(v.bases >= 4, 'more than one base archetype is used', `${v.bases} bases seen`);
check(v.traitsSeen === r.traitCount, 'every trait can actually be rolled',
  `${v.traitsSeen} of ${r.traitCount} seen`);
check(v.dupeTraitInOneRoll === 0, 'a nemesis never rolls the same trait twice',
  `${v.dupeTraitInOneRoll} rolls doubled a trait (doubling its numbers while showing one tag)`);

// ── Escalation ───────────────────────────────────────────────────────────
const at = (s) => r.counts.find((c) => c.sector === s).n;
check(at(1) === 1 && at(12) > at(1), 'deeper sectors stack more traits',
  `sector 1: ${at(1)}, sector 12: ${at(12)}`);
check(at(99) <= 3, 'but the stack is capped so the loadout stays readable',
  `sector 99: ${at(99)}`);
check(r.rolledCounts[1].n > r.rolledCounts[0].n, 'and a real roll reflects that',
  `${r.rolledCounts[0].n} at sector 1 vs ${r.rolledCounts[1].n} at sector 30`);
check(r.hpBySector[2].hp > r.hpBySector[0].hp,
  'the same loadout is tougher deeper in the climb',
  r.hpBySector.map((h) => `s${h.sector}:${h.hp.toFixed(2)}`).join(' '));

// ── Traits ───────────────────────────────────────────────────────────────
const e = r.effects;
check(e.armoredHp > e.plainHp, 'ARMORED adds health', `${e.armoredHp} vs ${e.plainHp}`);
check(e.swiftSpeed > 1 && e.swiftFragile < e.armoredHp, 'SWIFT trades health for speed',
  `speed ${e.swiftSpeed}, hp ${e.swiftFragile}`);
check(e.colossalScale > 1, 'COLOSSAL is bigger', `${e.colossalScale}`);
check(e.regen > 0, 'REGENERATOR carries a heal rate', `${e.regen}/s`);
check(e.summon > 0, 'SUMMONER carries a summon interval', `${e.summon}ms`);
check(!!e.volatile && e.volatile.damage > 0, 'VOLATILE carries a real blast',
  JSON.stringify(e.volatile));
check(e.combined.traits.length === 2 && e.combined.speedMult !== 1 && e.combined.hpMult !== e.armoredHp,
  'two traits compose — both apply, not just the last',
  `hp ${e.combined.hpMult}, speed ${e.combined.speedMult}`);

// ── Live ─────────────────────────────────────────────────────────────────
check(r.live.named && r.live.isMiniBoss, 'the mini-boss spawns as a named nemesis',
  `${r.live.name} [${r.live.traits.join(', ')}] on a ${r.live.baseType}`);
check(r.live.traits.length >= 1, 'carrying at least one trait', `${r.live.traits.length}`);
check(r.regenWorks.after > r.regenWorks.before, 'REGENERATOR heals in play',
  `${r.regenWorks.before} -> ${r.regenWorks.after} of ${r.regenWorks.max}`);
check(r.volatileHurts.after < r.volatileHurts.before,
  'VOLATILE damages the player who killed it up close',
  `player ${r.volatileHurts.before} -> ${r.volatileHurts.after} — this is what makes melee-spam a choice`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — nemeses are named, composed, escalating and mechanically real`);
