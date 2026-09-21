// SHOCK CAPTAIN — THE DAMAGED MODEL AND THE ARC FIELD'S GEOMETRY. STRUCTURAL.
//
// §36 IS EXPLICIT ABOUT THE LIMIT: this file protects OBJECTIVE TRUTH and holds
// no opinion about whether the art is good. What it can prove is that the
// visual state is a FUNCTION OF THE AUTHORITATIVE GAMEPLAY STATE, that the
// damage geometry turns when the body turns, that nothing is left behind, and
// that the field's painted boundary is the hit test's own number.
//
// THE DISCRIMINATING CHECK IS THE ONE THAT FAILS ON THE BUILD THIS REPLACES.
// "A damage effect exists" was true before; what was NOT true is that moving
// the Captain's aim through four facings moves his damage anchor to four
// different places relative to his body.
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
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE MODEL IS THE STATE ──────────────────────────────────────────────
const model = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { CHAMPION } = await import('/src/config.js');
  const d = CHAMPION.captain;
  gs.arenaActive = false;
  gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion)
    .forEach((e) => gs._destroyEnemyFully?.(e) ?? e.destroy());
  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 340, gs.player.y, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, 600); };

  // THREE SHEETS MUST EXIST AND BE DISTINCT. A tint would pass "a texture is
  // set"; comparing the painted pixels is what refuses one.
  const hashOf = (key) => {
    const tex = gs.textures.get(key);
    const src = tex.getSourceImage();
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    const dd = cv.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    let h = 0;
    for (let i = 0; i < dd.length; i += 97) h = (h * 31 + dd[i]) >>> 0;
    return h;
  };
  const sheets = ['champ-captain', 'champ-captain-broken', 'champ-captain-critical'];
  const exist = sheets.every((k) => gs.textures.exists(k));
  const hashes = exist ? sheets.map(hashOf) : [];

  const seen = [];
  const snap = () => seen.push({
    broken: c.armourBroken, crit: c._lowHealthFired,
    tex: c.texture.key, pre: c._animPrefix,
    anim: c.anims.currentAnim?.key ?? null,
  });
  snap();
  // REAL TRANSITIONS ONLY. `_setBodyState` is never called by this test.
  c.armour = 40;
  c.damage(80, { x: 0, y: -300 });
  await wait(120);
  snap();
  c.hp = c.hpMax * d.lowHealthFrac + 80;
  c.damage(90, { x: 0, y: -300 });
  await wait(120);
  snap();

  // ── THE ANCHOR TURNS WITH THE BODY ──────────────────────────────────────
  // FOUR facings, and the anchor's offset FROM HIS OWN CENTRE must differ.
  // The rejected build derived it from `flipX` alone, so front and back were
  // the identical offset and this check reports them as one place.
  const anchors = {};
  for (const [name, deg] of [['front', 90], ['back', -90], ['east', 0], ['west', 180]]) {
    c._aim = deg * Math.PI / 180;
    const a = c._anchor('pauldron');
    anchors[name] = { dx: Math.round(a.x - c.x), dy: Math.round(a.y - c.y) };
  }
  const keys = Object.keys(anchors);
  const distinct = new Set(keys.map((k) => `${anchors[k].dx},${anchors[k].dy}`)).size;

  // Every anchor must sit ON the body, not out in the air beside it.
  const halfW = c.displayWidth / 2, halfH = c.displayHeight / 2;
  const onBody = keys.every((k) => Math.abs(anchors[k].dx) <= halfW
    && Math.abs(anchors[k].dy) <= halfH);

  // ── THE STATE CHANGE KEEPS THE CYCLE ────────────────────────────────────
  // A texture swap that snapped him back to frame 0 of an idle would have
  // thrown away the approved animation work.
  // MEASURE THE SWAP, NOT A ROUND TRIP. The first version of this check
  // captured the key, swapped DOWN to intact and back UP to critical, and then
  // compared the ends — which are equal by construction on a working build and
  // on a broken one alike. Start intact, establish a cycle, cross ONE
  // transition, and read what happened to the key.
  c._lowHealthFired = false; c.armourBroken = false;
  c._setBodyState();
  c._aim = Math.PI / 2;
  c._cap = 'advance';
  c._applyAnim();
  const beforeKey = c.anims.currentAnim?.key ?? '';
  const beforeIdx = c.anims.currentFrame?.index ?? 0;
  c.armourBroken = true;
  c._setBodyState();
  const afterKey = c.anims.currentAnim?.key ?? '';
  const afterIdx = c.anims.currentFrame?.index ?? 0;

  // ── NOTHING PERSISTENT IS LEFT OVER THE ACTOR ───────────────────────────
  // The old build carried a `_wound` Graphics for the whole fight. With the
  // damage in the sheet the only Graphics is the intermittent short, which
  // must be ABSENT between events.
  c._arcHold = 0;
  c._drawDamage();
  await wait(60);
  const arcBetween = !!(c._arcGfx && c._arcGfx.commandBuffer.length);
  c._arcHold = c.def.arc.holdMs;
  c._drawDamage();
  const arcDuring = !!(c._arcGfx && c._arcGfx.commandBuffer.length);

  const before = gs.children.list.length;
  delete c.die;
  c.hp = 1;
  c.damage(99999, null);
  await wait(300);
  const leftOnDeath = c._reactFx.length;

  return {
    exist, hashes, seen, anchors, distinct, onBody,
    beforeKey, afterKey, beforeIdx, afterIdx,
    arcBetween, arcDuring, leftOnDeath, before,
  };
}));

check(model.exist, 'three authored body sheets exist — intact, broken, critical');
check(new Set(model.hashes).size === 3,
  'and all three are DIFFERENT PAINTED SHEETS, not one texture tinted',
  JSON.stringify(model.hashes));
check(model.seen[0].tex === 'champ-captain'
  && model.seen[1].tex === 'champ-captain-broken'
  && model.seen[2].tex === 'champ-captain-critical',
  'the body state follows the authoritative armour and health transitions',
  model.seen.map((s) => `${s.broken ? 'B' : '-'}${s.crit ? 'C' : '-'}:${s.tex}`).join(' -> '));
check(model.distinct === 4,
  'THE DAMAGE TURNS WITH HIM — four facings give four different anchor offsets',
  JSON.stringify(model.anchors));
check(model.onBody, 'and every anchor sits on the body rather than beside it',
  JSON.stringify(model.anchors));
check(model.afterKey === 'captainbrk-walk-front' && model.beforeKey === 'captain-walk-front'
  && model.afterIdx === model.beforeIdx,
  'a state change swaps the sheet and KEEPS the pose — the cycle is not restarted',
  `${model.beforeKey}#${model.beforeIdx} -> ${model.afterKey}#${model.afterIdx}`);
check(model.arcBetween === false && model.arcDuring === true,
  'the electrical failure is an EVENT — nothing persistent is drawn over the actor',
  `between=${model.arcBetween} during=${model.arcDuring}`);
check(model.leftOnDeath === 0, 'and nothing it owned outlives it', `${model.leftOnDeath}`);

// ── 2. THE ARC FIELD'S BOUNDARY IS THE HIT TEST'S OWN NUMBER ───────────────
const field = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { CHAMPION } = await import('/src/config.js');
  const g0 = CHAMPION.captain.grenade;
  gs.arenaActive = false;
  const p = gs.player;
  const n = gs.spawnArcGrenade({ ...g0, x: p.x + 300, y: p.y, tx: p.x + 300, ty: p.y + 40 });
  const phases = [];
  const hook = () => {
    const ph = n.phase;
    if (phases[phases.length - 1]?.ph !== ph) {
      phases.push({ ph, body: !!n.body, frame: n.body?.frame?.name ?? null });
    }
  };
  gs.events.on('postupdate', hook);
  // Wait for the field, then probe the boundary on the frame it is live.
  const deadline = performance.now() + 9000;
  while (performance.now() < deadline && !n.live) await wait(60);
  const liveNow = n.live;
  const R = n.radius;
  // EIGHT BEARINGS, so a boundary that is right on one axis and wrong on a
  // diagonal cannot pass. NOTE THE 0.999: at exactly 1.0 the probe is measuring
  // its own floating-point error — `cos(π/4) * r` lands a fraction above `r`
  // and `contains` correctly says no. Reading that as a game bug is the
  // instrument being wrong about a build that is right, so the edge itself is
  // tested separately on the four axis-aligned bearings, where the arithmetic
  // is exact and `<= radius` is genuinely observable.
  const probe = (f) => {
    let inAll = true, outAll = true;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const hit = n.contains(n.x + Math.cos(a) * R * f, n.y + Math.sin(a) * R * f);
      if (!hit) inAll = false;
      if (hit) outAll = false;
    }
    return { inAll, outAll };
  };
  const deepIn = probe(0.2), nearIn = probe(0.999);
  const justOut = probe(1.002), farOut = probe(1.4);
  const atEdge = { inAll: [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .every(([ex, ey]) => n.contains(n.x + ex * R, n.y + ey * R)) };
  // The perimeter is drawn from `radius` itself — prove it by moving the
  // number and watching the drawn geometry follow, which a hardcoded ring
  // would not.
  const nodes = n.nodes;
  const nA = n._node(0);
  const nodeOnRadius = Math.abs(Math.hypot(nA.x - n.x, nA.y - n.y) - R) < 0.001;
  n.radius = R * 0.5;
  const nB = n._node(0);
  const nodeFollows = Math.abs(Math.hypot(nB.x - n.x, nB.y - n.y) - R * 0.5) < 0.001;
  n.radius = R;

  const bodyDepth = n.body?.depth ?? 0;
  const before = gs.children.list.length;
  n.destroy();
  await wait(80);
  const bodyGone = !n.body;
  const bodyWas = n.body === undefined ? 'undefined' : (n.body === null ? 'null' : 'LIVE');
  const after = gs.children.list.length;
  gs.events.off('postupdate', hook);
  return {
    liveNow, phases, nodes, nodeOnRadius, nodeFollows, bodyDepth, bodyWas, bodyGone,
    deepIn: deepIn.inAll, nearIn: nearIn.inAll, atEdge: atEdge.inAll,
    justOut: justOut.outAll, farOut: farOut.outAll,
    leaked: after - before + 5, cfgRadius: g0.radius, R,
  };
}));

check(field.liveNow, 'the field reached its live phase');
check(field.R === field.cfgRadius,
  'the gameplay radius is the authored one, untouched by this pass',
  `${field.R} vs ${field.cfgRadius}`);
check(field.deepIn && field.nearIn && field.atEdge,
  'inside, near-edge and EXACTLY ON the boundary are all dangerous, at eight bearings');
check(field.justOut && field.farOut,
  'and a fifth of a percent outside is already safe — no invisible dangerous annulus');
check(field.nodes >= 6 && field.nodeOnRadius,
  'the perimeter is built from deliberate nodes sitting EXACTLY on the real radius',
  `${field.nodes} nodes, onRadius=${field.nodeOnRadius}`);
check(field.nodeFollows,
  'and the drawn geometry is DERIVED from that radius — halve it and the nodes move',
  `${field.nodeFollows}`);
check(field.phases.some((p) => p.ph === 'flight' && p.body)
  && field.phases.some((p) => p.ph === 'field' && p.body),
  'ONE physical device owns the whole lifecycle — it flies, and it stays as the source',
  JSON.stringify(field.phases.map((p) => `${p.ph}:${p.body ? 'dev' : 'none'}`)));
check(field.bodyDepth > 2000,
  'the device is drawn above the actor band while it is the thing to watch',
  `${field.bodyDepth}`);
check(field.bodyGone, 'and the device is destroyed with the field — no orphan Image',
  `body is ${field.bodyWas}`);

await browser.close();
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the damage is the model, the boundary is the radius`);
