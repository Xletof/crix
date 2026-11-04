// SMOKE: VISUAL IDENTITY V2 (`?visualPilot=v2`) — PRESENTATION ONLY, PROVEN.
// Standalone; needs `npm run dev` on :5173 and, for section 6, the PREVIOUS
// build (`d05ac13`, or any build before the pilot) on :5174 (`--old=URL`).
//
// The pilot is an opt-in look-development candidate. This asserts nothing
// about whether it looks better (the handset's job), only that it is what it
// claims to be:
//   0  THE FLAG: absent / any other value = off; `v2` = on; it moves none of
//      the gameplay switches, in either baseline
//   1  TEXTURES: flag on, every texture the flag-off game paints is byte-
//      identical EXCEPT `player` (the V2 protagonist, same 24-frame contract);
//      the only added keys are the pilot's `vp-*`. So every roster V1 sheet
//      (the white Rifleman `ro-rif-*` included), every weapon, every FX and
//      every other room's art is untouched
//   2  BODIES: the player's circle (at rest and under the breathing / recoil
//      scales), a swarmling's circle and render scale, and every static body
//      in the Hangar (cover, props) are identical flag on / off; the pilot
//      really ran (V2 sheet, prefix, no tint; V2 cover keys in the Hangar)
//   3  THE BACKDROP RNG CONTRACT: painting the Hangar with the pilot takes the
//      same `Math.random` draws and leaves the stream at the same next value;
//      the other three rooms paint byte-identical backdrops and wear the
//      original cover keys under the flag
//   4  SAME FIGHT: seeded replays — every tick's player / camera / enemy /
//      bullet state and draw count — are identical flag on vs off: SWARM TIDE
//      and BOMBER RUN in the Hangar, production and legacy baselines,
//      headless and rendered
//   5  FROZEN FILES: no change against `d05ac13` in entities, config, data,
//      `pixelArt.js`, `rosterPaint.js`, the camera or the AI seams; the
//      Enemy.js guard holds
//   6  AGAINST THE PREVIOUS BUILD (`--old`): the no-flags game and the legacy
//      baseline are that build's, tick for tick and texture for texture
// `--selftest` injects, under the flag only, an extra draw and a 1px larger body
// on every swarmling spawn and a 1px larger player circle: the body checks in
// section 2 and every replay in section 4 must FAIL.
//
// usage: node tests/smoke-visual-pilot.mjs [--old=URL] [--selftest] [--ticks=N]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { CHROME, bootPage, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const SELF = process.argv.includes('--selftest');
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const TICKS = +opt('ticks', '1500');
const BASE_REV = 'd05ac13';
const PILOT = 'visualPilot=v2';
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_BOMB = 'encdbg=bomberRun&room=hangar&sector=4';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// ── in-page instruments (identical in every page) ─────────────────────────
async function instrument(p) {
  await p.evaluate(async ({ self }) => {
    const gs = window.__gs;
    const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    window.__rooms = (await window.__mod(/data\/rooms\.js/)).ROOMS;
    // --selftest: what a careless pilot would do, injected only when the flag is on
    if (self && window.__dbg.isVisualPilotV2()) {
      const orig = gs.spawnEnemyAt.bind(gs);
      gs.spawnEnemyAt = (type, x, y, spec) => {
        if (type === 'swarmling') Math.random();
        const e = orig(type, x, y, spec);
        if (type === 'swarmling') e.body.setCircle(14, e.width / 2 - 14, e.height / 2 - 14);
        return e;
      };
      const P = gs.player; P.body.setCircle(23, P.width / 2 - 23, P.height / 2 - 23);
    }
    window.__texHash = (key) => {
      const src = window.game.textures.get(key).getSourceImage();
      if (!src || !src.width) return 'n/a';
      const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const c2 = cv.getContext('2d'); c2.drawImage(src, 0, 0);
      const d = c2.getImageData(0, 0, cv.width, cv.height).data;
      let h1 = 0x811c9dc5, h2 = 0x1000193;
      for (let i = 0; i < d.length; i++) { h1 = Math.imul(h1 ^ d[i], 16777619) >>> 0; h2 = Math.imul(h2 + d[i] * (i % 251 + 1), 2654435761) >>> 0; }
      return `${cv.width}x${cv.height}:${h1.toString(16)}${h2.toString(16)}`;
    };
    window.__allTex = () => {
      const out = {};
      for (const k of Object.keys(window.game.textures.list).sort()) {
        if (k.startsWith('__') || /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(k) || k.startsWith('backdrop-') || k.startsWith('hashbg-')) continue;
        out[k] = window.__texHash(k);
      }
      return out;
    };
    window.__bodyOf = (o) => { const b = o.body; return [b.radius ?? 0, b.width, b.height, b.halfWidth, b.halfHeight, +(b.center.x - o.x).toFixed(4), +(b.center.y - o.y).toFixed(4)].join(','); };
    window.__statics = () => gs.walls.getChildren().map((w) => {
      const b = w.body; return `${w.texture.key}|${b.position.x},${b.position.y},${b.width},${b.height}`;
    });
    // A seeded replay of the real encounter. Every tick folds the state that
    // gameplay is made of into one hash: player, camera, every enemy, every
    // bullet, and the Math.random draw count.
    window.__trace = ({ seed, ticks, seg, fire, superAt, headless }) => {
      const P = gs.player, K = gs.keys, cam = gs.cameras.main;
      window.__headless = headless;
      window.__seed(seed); window.__draws = 0;
      const seen = new WeakSet(), hashes = [];
      let spawned = 0, swarm = 0, swarmV2 = 0, swarmBad = 0;
      const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const cur = seg.find(([a, b]) => i >= a && i < b)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (fire && i >= 60 && i % fire === 0) P.keyboardFire();
        if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
        window.__adv(1);
        let s = `${i}|${f(P.x)},${f(P.y)},${P.hp},${f(P.body.center.x)},${f(P.body.center.y)}|${f(cam.scrollX)},${f(cam.scrollY)}|`;
        for (const e of gs.enemies.getChildren()) {
          if (!e.active) continue;
          if (!seen.has(e)) {
            seen.add(e); spawned++;
            if (e.enemyType === 'swarmling') {
              swarm++;
              if (e.texture.key === 'vp-swarm') swarmV2++;
              if (e._baseScale !== 0.7) swarmBad++;
            }
          }
          s += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${f(e.body.center.x)},${f(e.body.center.y)};`;
        }
        for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets]) {
          for (const b of g?.getChildren?.() || []) if (b.active) s += `b${f(b.x)},${f(b.y)};`;
        }
        s += `|d${window.__draws}`;
        hashes.push(fnv(s));
      }
      const K2 = gs.keys; K2.A.isDown = K2.D.isDown = K2.W.isDown = K2.S.isDown = false;
      return { hashes, spawned, swarm, swarmV2, swarmBad, draws: window.__draws };
    };
  }, { self: SELF });
}

async function boot(flags, { base = NOW, q = 'room=hangar', seed = 4242 } = {}) {
  const p = await bootPage(browser, { base, flags, baseline: null, q, seed });
  await instrument(p);
  return p;
}
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };

// ── 0. THE FLAG ───────────────────────────────────────────────────────────
console.log('\n== 0. the flag');
{
  const cases = [['', null, 'production'], [PILOT, 'v2', 'production'], ['visualPilot=1', null, 'production'],
    ['visualPilot=v1', null, 'production'], [`baseline=legacy&${PILOT}`, 'v2', 'legacy']];
  const sw = {};
  for (const [flags, want, base] of cases) {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const d = window.__dbg;
      return { vp: d.getVisualPilot(), base: d.getGameplayBaseline(),
        sw: [d.isRosterV1(), d.isMoveV22(), d.isGaitV2(), d.getBulwarkStuck(), d.getMarksmanStuck(), d.isMarksmanAngle(), d.isBulwarkAngle()].join(',') };
    });
    check(`?${flags || '(no flags)'} -> visualPilot ${want} on the ${base} baseline`, r.vp === want && r.base === base, `got ${r.vp} / ${r.base}`);
    (sw[base] ||= new Set()).add(r.sw);
    await p.close();
  }
  check('the flag moves none of the seven gameplay switches (per baseline)', Object.values(sw).every((s) => s.size === 1), JSON.stringify(Object.fromEntries(Object.entries(sw).map(([k, v]) => [k, [...v]]))));
}

// ── 1 + 2 + 3. TEXTURES, BODIES, THE BACKDROP CONTRACT ────────────────────
console.log('\n== 1. textures   2. bodies   3. the backdrop RNG contract');
const off = await boot('');
const on = await boot(PILOT);
const snapshot = (p) => p.evaluate(() => {
  const gs = window.__gs, P = gs.player;
  const out = { tex: window.__allTex(), statics: window.__statics() };
  const bodies = [];
  for (const sc of [[1, 1], [1, 1.015], [1.2, 1.2], [0.88, 0.88]]) { P.setScale(sc[0], sc[1]); P.body.updateBounds(); bodies.push(window.__bodyOf(P)); }
  P.setScale(1); P.body.updateBounds();
  out.player = bodies;
  out.playerFrame = [P.frame.width, P.frame.height, P.anims.currentAnim?.key];
  const e = gs.spawnEnemyAt('swarmling', 640, 700, {});
  e.body.updateBounds();
  out.swarm = { body: window.__bodyOf(e), scale: [e.scaleX, e.scaleY, e._baseScale], key: e.texture.key, prefix: e._animPrefix, tinted: e.isTinted, tint: e.tintTopLeft, hp: e.hp, radius: e.cfg.radius, speed: e.cfg.speed };
  gs._destroyEnemyFully(e);
  return out;
});
const sOff = await snapshot(off), sOn = await snapshot(on);
{
  const keysOff = Object.keys(sOff.tex), keysOn = Object.keys(sOn.tex);
  const changed = keysOff.filter((k) => sOff.tex[k] !== sOn.tex[k]);
  const added = keysOn.filter((k) => !(k in sOff.tex));
  const missing = keysOff.filter((k) => !(k in sOn.tex));
  check('flag on: the only changed flag-off texture is `player`', changed.length === 1 && changed[0] === 'player', `changed: ${changed.join(' ') || 'none'}`);
  check('flag on: the only added textures are the pilot\'s `vp-*`', added.length > 0 && added.every((k) => k.startsWith('vp-')), `added: ${added.join(' ')}`);
  check('flag on: no texture is missing', missing.length === 0, missing.join(' '));
  const roster = keysOff.filter((k) => /^ro-|^grunt$|^shooter$|^wpn-|^bullet|^nem-|^champ-|^boss$/.test(k));
  check(`every roster / weapon / projectile / boss texture byte-identical (${roster.length}, incl. the white Rifleman ro-rif-*)`, roster.length > 20 && roster.every((k) => sOff.tex[k] === sOn.tex[k]) && roster.some((k) => k.startsWith('ro-rif-')));
  check('player sheet keeps the 24-frame contract (frame count via anim key, frame 96 wide)', sOn.playerFrame[0] === 96 && sOn.playerFrame[2] === sOff.playerFrame[2], `${sOff.playerFrame} vs ${sOn.playerFrame}`);
  check('player body circle identical at scales 1, breathing 1.015, recoil 1.2 / 0.88', JSON.stringify(sOff.player) === JSON.stringify(sOn.player), `${sOff.player[0]} vs ${sOn.player[0]}`);
  check('swarmling body circle identical (radius x 0.7, centred)', sOff.swarm.body === sOn.swarm.body, `${sOff.swarm.body} vs ${sOn.swarm.body}`);
  check('swarmling render scale, hp, radius and speed identical', JSON.stringify([sOff.swarm.scale, sOff.swarm.hp, sOff.swarm.radius, sOff.swarm.speed]) === JSON.stringify([sOn.swarm.scale, sOn.swarm.hp, sOn.swarm.radius, sOn.swarm.speed]));
  check('the pilot ran: swarmling wears `vp-swarm`, its own prefix, no tint', sOn.swarm.key === 'vp-swarm' && sOn.swarm.prefix === 'vp-swarm' && !sOn.swarm.tinted, `${sOn.swarm.key}/${sOn.swarm.prefix}/${sOn.swarm.tinted}`);
  check('flag off: swarmling is the legacy grunt sheet, tinted acid green', sOff.swarm.key === 'grunt' && sOff.swarm.prefix === 'grunt' && sOff.swarm.tint === 0x70e838);
  const geo = (l) => l.map((s) => s.split('|')[1]).sort().join(';');
  check(`every static body in the Hangar identical (${sOff.statics.length} cover + props + walls)`, geo(sOff.statics) === geo(sOn.statics) && sOff.statics.length === sOn.statics.length);
  const vpCover = sOn.statics.filter((s) => s.startsWith('vp-')).length;
  check('the pilot ran: Hangar cover / drums stand on `vp-*` art (8 cover + 3 drums)', vpCover === 11, `${vpCover} vp-* statics; off: ${sOff.statics.filter((s) => s.startsWith('vp-')).length}`);
}
const paintRoom = (p, id) => p.evaluate((id) => {
  const gs = window.__gs, spec = window.__rooms.find((r) => r.id === id);
  const key = `backdrop-${id}`;
  gs.loadRoom(window.__rooms.find((r) => r.id === (id === 'hangar' ? 'corridor' : 'hangar')));   // release the key
  if (window.game.textures.exists(key)) window.game.textures.remove(key);
  window.__seed(0x51eed); window.__draws = 0;
  gs.loadRoom(spec);
  const draws = window.__draws, next = Math.random();
  const cover = gs.walls.getChildren().map((w) => w.texture.key).sort().join(',');
  return { draws, next, bg: window.__texHash(key), cover };
}, id);
{
  const a = await paintRoom(off, 'hangar'), b = await paintRoom(on, 'hangar');
  check('Hangar load: same Math.random draws and the same next value, flag on / off', a.draws === b.draws && a.next === b.next, `draws ${a.draws}/${b.draws}, next ${a.next}/${b.next}`);
  check('the pilot ran: the Hangar backdrop differs under the flag', a.bg !== b.bg);
  for (const id of ['corridor', 'detention', 'vader']) {
    const x = await paintRoom(off, id), y = await paintRoom(on, id);
    check(`${id}: backdrop byte-identical, same draws, same cover keys under the flag`, x.bg === y.bg && x.draws === y.draws && x.next === y.next && x.cover === y.cover, `${x.bg === y.bg} ${x.draws}/${y.draws} ${x.cover === y.cover}`);
  }
}
await off.close(); await on.close();

// ── 4. SAME FIGHT ─────────────────────────────────────────────────────────
console.log('\n== 4. same fight, flag on vs off');
const SEG = FIGHT_SEG, SUPER = [700, 1400];
async function replay(flags, q, { headless = true, ticks = TICKS, seed = 9071, base = NOW } = {}) {
  const p = await boot(flags, { base, q });
  const r = await p.evaluate((o) => window.__trace(o), { seed, ticks, seg: SEG, fire: 7, superAt: SUPER, headless });
  await p.close();
  return r;
}
const traces = {};
for (const [label, q, baseFlags] of [['SWARM TIDE, production', Q_SWARM, ''], ['SWARM TIDE, legacy baseline', Q_SWARM, 'baseline=legacy'],
  ['BOMBER RUN, production', Q_BOMB, '']]) {
  const a = await replay(baseFlags, q), b = await replay([baseFlags, PILOT].filter(Boolean).join('&'), q);
  traces[label] = a;
  const d = firstDiff(a.hashes, b.hashes);
  check(`${label}: ${TICKS} headless ticks identical (state + draws)`, d < 0, d < 0 ? `${a.draws} draws, ${a.spawned} spawned` : `first divergent tick ${d}`);
  if (q === Q_SWARM) {
    check(`${label}: swarmlings really fought (${a.swarm}) and every one wore V2 under the flag at 0.7`, a.swarm > 0 && b.swarm === a.swarm && b.swarmV2 === b.swarm && a.swarmV2 === 0 && b.swarmBad === 0, `off ${a.swarmV2}/${a.swarm}, on ${b.swarmV2}/${b.swarm}`);
  }
}
{
  const n = Math.min(TICKS, 600);
  const a = await replay('', Q_SWARM, { headless: false, ticks: n }), b = await replay(PILOT, Q_SWARM, { headless: false, ticks: n });
  const d = firstDiff(a.hashes, b.hashes);
  check(`SWARM TIDE, production: ${n} RENDERED ticks identical`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
}

// ── 5. FROZEN FILES ───────────────────────────────────────────────────────
console.log('\n== 5. frozen files');
{
  const paths = ['src/entities', 'src/config.js', 'src/data', 'src/systems/pixelArt.js', 'src/systems/rosterPaint.js',
    'src/systems/CameraDirector.js', 'src/systems/EnvLight.js', 'src/systems/bulwarkStuck.js', 'src/systems/bulwarkAngle.js',
    'src/systems/marksmanStuck.js', 'src/systems/marksmanAngle.js', 'src/systems/firingSpot.js', 'src/systems/NavGrid.js', 'src/main.js'];
  let diff = '';
  try { diff = execSync(`git diff --stat ${BASE_REV} -- ${paths.join(' ')}`, { encoding: 'utf8' }).trim(); } catch (e) { diff = `git failed: ${e.message}`; }
  check(`no change against ${BASE_REV} in entities, config, data, pixelArt, rosterPaint, camera, light, AI seams, nav`, diff === '', diff);
  const g = enemyJsGuard(process.cwd() + '/');
  check('Enemy.js guard (outside the Bomber, the Bomber-only veto)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

// ── 6. AGAINST THE PREVIOUS BUILD ─────────────────────────────────────────
if (OLD && !SELF) {
  console.log(`\n== 6. against the previous build (${OLD})`);
  const pOld = await bootPage(browser, { base: OLD, flags: '', baseline: null, q: 'room=hangar', seed: 4242 });
  await instrument(pOld);
  const pNew = await boot('');
  const tOld = await pOld.evaluate(() => window.__allTex()), tNew = await pNew.evaluate(() => window.__allTex());
  const diffKeys = [...new Set([...Object.keys(tOld), ...Object.keys(tNew)])].filter((k) => tOld[k] !== tNew[k]);
  check('no flags: every texture byte-identical to the previous build', diffKeys.length === 0, diffKeys.join(' '));
  const bOld = await paintRoom(pOld, 'hangar'), bNew = await paintRoom(pNew, 'hangar');
  check('no flags: the Hangar backdrop, its draws and next value match the previous build', bOld.bg === bNew.bg && bOld.draws === bNew.draws && bOld.next === bNew.next);
  await pOld.close(); await pNew.close();
  for (const [label, q, flags] of [['SWARM TIDE, no flags', Q_SWARM, ''], ['SWARM TIDE, legacy baseline', Q_SWARM, 'baseline=legacy'], ['BOMBER RUN, no flags', Q_BOMB, '']]) {
    const a = await replay(flags, q, { base: OLD }), b = traces[label.replace('no flags', 'production')] || await replay(flags, q);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: ${TICKS} ticks identical to the previous build`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  }
} else if (!SELF) console.log('\n== 6. skipped (no --old=URL)');

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed${SELF ? '  (SELFTEST: sections 2 and 4 are expected to FAIL)' : ''}`);
if (SELF) {
  const must = ['player body circle identical', 'swarmling body', 'headless ticks identical', 'RENDERED ticks identical'];
  const ok = must.every((m) => fails.some((f) => f.name.includes(m)));
  console.log(ok ? 'SELFTEST OK: the parity checks caught the injected changes' : 'SELFTEST FAILED: a parity check did not catch an injected change');
  process.exit(ok ? 0 : 1);
}
process.exit(fails.length ? 1 : 0);
