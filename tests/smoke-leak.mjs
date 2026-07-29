// Cluster -> primary state leak, probed deterministically.
//
// A previous version of this test just span the game and hoped to hit the race.
// It passed on the BROKEN build too, so it proved nothing. This one drives the
// two mechanisms directly instead:
//
//   PROBE 1 (texture/hitbox): grab a real cluster fragment's pooled object, kill
//   it, then ask the PRIMARY group for bullets until it hands that same object
//   back. Assert what comes out is a clean pistol bolt.
//
//   PROBE 2 (deferred callback): with that object now re-fired as a primary
//   bolt, wait past the fragment's descent window and assert nothing wrote
//   homing/velocity onto it afterwards.
//
// On the pre-change build both must FAIL. That is the point of the run.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/');
await page.waitForTimeout(4000);
await page.mouse.click(360, 640);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const t = window.game?.scene?.getScene('Title');
  if (t?.sys?.isActive()) t.scene.start('Game');
});
await page.waitForFunction(() => {
  const gs = window.game?.scene?.getScene('Game');
  return !!(gs?.player && gs?.enemies);
}, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  const keepAlive = () => { p.hp = p.hpMax; };

  keepAlive();
  gs.playerBullets.getChildren().forEach((b) => { if (b.active) b.kill(); });

  // Throw a cluster and let it burst.
  p.equipSecondary('cluster');
  p.fireCooldown = 0;
  p.tryFire(0);
  p._equipNothing();

  // Grab a live airborne fragment — a real one, spawned by the real code path.
  // POLL for it rather than waiting a fixed time: the descent window differs
  // between the two builds (450ms vs 620ms), so any fixed sleep would miss it
  // on one of them and silently turn the whole run into a no-op.
  const findFrag = () => {
    for (const grp of [gs.playerFragBullets, gs.playerBullets].filter(Boolean)) {
      for (const b of grp.getChildren()) {
        if (b.active && b.body && b.body.enable === false) return { b, grp };
      }
    }
    return null;
  };
  let found = null;
  for (let i = 0; i < 120 && !found; i++) {
    keepAlive();
    found = findFrag();
    if (!found) await sleep(25);
  }
  if (!found) return { error: 'no airborne fragment found — burst timing is off' };
  const frag = found.b;
  const fragGroupIsPrimary = found.grp === gs.playerBullets;
  const fragTex = frag.texture?.key;

  // Kill it mid-descent: object goes back to its pool with its descent callback
  // still pending.
  frag.kill();

  // PROBE 1 — ask the PRIMARY group for bullets until it returns that object.
  let handedBack = false;
  let reissued = null;
  for (let i = 0; i < 220 && !handedBack; i++) {
    const b = gs.playerBullets.fire(
      p.x, p.y, Math.random() * Math.PI * 2,
      900, 120, 400, { owner: 'player' },
    );
    if (b === frag) { handedBack = true; reissued = b; }
  }

  const probe1 = handedBack ? {
    tex: reissued.texture?.key,
    radius: reissued.body?.radius ?? null,
    homingAtFire: reissued.homing ? 'SET' : null,
  } : null;

  // PROBE 2 — let the fragment's descent callback come due, POLLING as it does.
  // A single read afterwards is useless: the re-issued bolt only lives ~440ms
  // (400px range at 900px/s) and kill() nulls homing, so by the time the sleep
  // is over the evidence has cleaned itself up. Sample the whole window and
  // keep the worst thing seen. Re-fire whenever it expires so the object stays
  // live across the callback.
  let homingSeen = null;
  let scaleSeen = null;
  for (let i = 0; i < 60; i++) {
    keepAlive();
    if (handedBack) {
      if (frag.homing && !homingSeen) homingSeen = JSON.stringify(frag.homing);
      if (!frag.active) {
        gs.playerBullets.fire(p.x, p.y, Math.random() * Math.PI * 2,
                              900, 120, 400, { owner: 'player' });
      }
      if (frag.active && frag.scaleX !== 1 && !scaleSeen) scaleSeen = frag.scaleX;
    }
    await sleep(25);
  }
  const probe2 = handedBack ? {
    homingDuringDescentWindow: homingSeen,
    scaleDuringWindow: scaleSeen,
    texAfterDescent: frag.texture?.key,
  } : null;

  // PROBE 3 — the texture self-heal in BulletGroup.fire, on its own.
  // Once the pools are separated, probes 1/2 become structurally unreachable,
  // so this belt-and-braces fix would otherwise go untested. Contaminate a
  // pooled object by hand (exactly what the old _clusterFragment did to it) and
  // check the group scrubs it on the way back out.
  gs.playerBullets.getChildren().forEach((b) => { if (b.active) b.kill(); });
  const victim = gs.playerBullets.getChildren().find((b) => !b.active);
  let probe3 = null;
  if (victim) {
    victim.setTexture('frag-missile');
    let out = null;
    for (let i = 0; i < 220 && out !== victim; i++) {
      out = gs.playerBullets.fire(p.x, p.y, 0, 900, 120, 400, { owner: 'player' });
    }
    probe3 = out === victim
      ? { tex: victim.texture?.key, radius: victim.body?.radius ?? null }
      : { skipped: 'pool never returned the contaminated object' };
  }

  return {
    probe3,
    fragGroupIsPrimary,          // true on the broken build: shared pool
    fragTex,
    hasFragGroup: !!gs.playerFragBullets,
    handedBack,                  // true on the broken build: pool crosses weapons
    probe1,
    probe2,
  };
});

console.log(JSON.stringify(result, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (result.error) fails.push(result.error);
else {
  if (result.fragGroupIsPrimary) fails.push('cluster fragments are spawning into the PRIMARY bullet pool');
  if (result.handedBack) fails.push('the primary group handed back a bullet object that was a cluster fragment');
  if (result.probe1) {
    if (result.probe1.tex !== 'bullet') fails.push(`re-issued primary bolt kept the fragment texture: ${result.probe1.tex}`);
    if (result.probe1.radius !== 30) fails.push(`re-issued primary bolt has the fragment hitbox radius: ${result.probe1.radius}`);
  }
  if (result.probe3 && !result.probe3.skipped) {
    if (result.probe3.tex !== 'bullet') fails.push(`BulletGroup.fire did not scrub a contaminated texture: ${result.probe3.tex}`);
    if (result.probe3.radius !== 30) fails.push(`BulletGroup.fire left a wrong hitbox radius: ${result.probe3.radius}`);
  }
  if (result.probe2?.homingDuringDescentWindow) {
    fails.push(`the fragment's descent callback wrote homing onto a re-issued primary bolt: ${result.probe2.homingDuringDescentWindow}`);
  }
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: primary fire is isolated from the cluster');
await browser.close();
process.exit(fails.length ? 1 : 0);
