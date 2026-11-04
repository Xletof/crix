// SMOKE: VISUAL IDENTITY V2 (`?visualPilot=v2`) AND V2B (`?visualPilot=v2b`) —
// PRESENTATION ONLY, PROVEN, FOR BOTH CANDIDATES AGAINST R1.
// Standalone; needs `npm run dev` on :5173 and, for section 6, the PREVIOUS
// build — the V2 build `bcd22e3` — on :5174 (`--old=URL`).
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
//   6  AGAINST THE PREVIOUS BUILD (`--old`, the V2 build): the no-flags game,
//      the legacy baseline AND `?visualPilot=v2` are that build's, tick for
//      tick and texture for texture — V2 survives V2B exactly
//   7  a scene restart and a page reload keep the selected mode
// Sections 1-4 run every check for V2 and for V2B; V2B must also keep V2's
// protagonist and swarmling byte-identical, and LIGHTS OUT (every roomLayer
// material class and dark tint, every emissive part) must be R1's in both.
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
const BASE_REV = 'd05ac13';   // frozen-file guard: the last build before any pilot
const PILOT = 'visualPilot=v2';
const PILOT_B = 'visualPilot=v2b';
const MODES = { V2: PILOT, V2B: PILOT_B };
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
  const cases = [['', null, 'production'], [PILOT, 'v2', 'production'], [PILOT_B, 'v2b', 'production'],
    ['visualPilot=1', null, 'production'], ['visualPilot=v1', null, 'production'], ['visualPilot=V2B', null, 'production'],
    [`baseline=legacy&${PILOT}`, 'v2', 'legacy'], [`baseline=legacy&${PILOT_B}`, 'v2b', 'legacy']];
  const sw = {};
  for (const [flags, want, base] of cases) {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const d = window.__dbg;
      return { vp: d.getVisualPilot(), v2: d.isVisualPilotV2(), v2b: d.isVisualPilotV2B?.() ?? null, base: d.getGameplayBaseline(),
        sw: [d.isRosterV1(), d.isMoveV22(), d.isGaitV2(), d.getBulwarkStuck(), d.getMarksmanStuck(), d.isMarksmanAngle(), d.isBulwarkAngle()].join(',') };
    });
    const fam = r.v2 === (want != null) && r.v2b === (want === 'v2b');
    check(`?${flags || '(no flags)'} -> visualPilot ${want} on the ${base} baseline`, r.vp === want && r.base === base && fam, `got ${r.vp} / ${r.base} / V2 family ${r.v2} / V2B ${r.v2b}`);
    (sw[base] ||= new Set()).add(r.sw);
    await p.close();
  }
  check('the flag moves none of the seven gameplay switches (per baseline)', Object.values(sw).every((s) => s.size === 1), JSON.stringify(Object.fromEntries(Object.entries(sw).map(([k, v]) => [k, [...v]]))));
}

// ── 1 + 2 + 3. TEXTURES, BODIES, THE BACKDROP CONTRACT ────────────────────
console.log('\n== 1. textures   2. bodies   3. the backdrop RNG contract');
const off = await boot('');
const pg = { V2: await boot(PILOT), V2B: await boot(PILOT_B) };
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
const sOff = await snapshot(off);
const snap = { V2: await snapshot(pg.V2), V2B: await snapshot(pg.V2B) };
const ADDED = {
  V2: ['vp-con-heavy', 'vp-con-ped-c', 'vp-crate-a', 'vp-crate-b', 'vp-drum', 'vp-drum-b', 'vp-swarm'],
  V2B: ['vp-swarm', 'vp2b-con-heavy', 'vp2b-con-ped-c', 'vp2b-con-wall', 'vp2b-crane', 'vp2b-crate-a', 'vp2b-crate-b', 'vp2b-drum', 'vp2b-drum-b', 'vp2b-shuttle'],
};
const SOLID_PILOT = { V2: [/^vp-/, 11], V2B: [/^vp2b-/, 13] };    // V2: 8 cover + 3 drums; V2B: + shuttle + gantry
const geo = (l) => l.map((x) => x.split('|')[1]).sort().join(';');
for (const M of ['V2', 'V2B']) {
  const sOn = snap[M];
  const keysOff = Object.keys(sOff.tex), keysOn = Object.keys(sOn.tex);
  const changed = keysOff.filter((k) => sOff.tex[k] !== sOn.tex[k]);
  const added = keysOn.filter((k) => !(k in sOff.tex)).sort();
  const missing = keysOff.filter((k) => !(k in sOn.tex));
  check(`${M}: the only changed flag-off texture is \`player\``, changed.length === 1 && changed[0] === 'player', `changed: ${changed.join(' ') || 'none'}`);
  check(`${M}: the added textures are exactly its own set`, JSON.stringify(added) === JSON.stringify(ADDED[M]), `added: ${added.join(' ')}`);
  check(`${M}: no texture is missing`, missing.length === 0, missing.join(' '));
  const roster = keysOff.filter((k) => /^ro-|^grunt$|^shooter$|^wpn-|^bullet|^nem-|^champ-|^boss$/.test(k));
  check(`${M}: every roster / weapon / projectile / boss texture byte-identical (${roster.length}, incl. the white Rifleman ro-rif-*)`, roster.length > 20 && roster.every((k) => sOff.tex[k] === sOn.tex[k]) && roster.some((k) => k.startsWith('ro-rif-')));
  check(`${M}: player sheet keeps the 24-frame contract (anim key, frame 96 wide)`, sOn.playerFrame[0] === 96 && sOn.playerFrame[2] === sOff.playerFrame[2], `${sOff.playerFrame} vs ${sOn.playerFrame}`);
  check(`${M}: player body circle identical at scales 1, breathing 1.015, recoil 1.2 / 0.88`, JSON.stringify(sOff.player) === JSON.stringify(sOn.player), `${sOff.player[0]} vs ${sOn.player[0]}`);
  check(`${M}: swarmling body circle identical (radius x 0.7, centred)`, sOff.swarm.body === sOn.swarm.body, `${sOff.swarm.body} vs ${sOn.swarm.body}`);
  check(`${M}: swarmling render scale, hp, radius and speed identical`, JSON.stringify([sOff.swarm.scale, sOff.swarm.hp, sOff.swarm.radius, sOff.swarm.speed]) === JSON.stringify([sOn.swarm.scale, sOn.swarm.hp, sOn.swarm.radius, sOn.swarm.speed]));
  check(`${M}: the pilot ran — swarmling wears \`vp-swarm\`, its own prefix, no tint`, sOn.swarm.key === 'vp-swarm' && sOn.swarm.prefix === 'vp-swarm' && !sOn.swarm.tinted, `${sOn.swarm.key}/${sOn.swarm.prefix}/${sOn.swarm.tinted}`);
  check(`${M}: every static body in the Hangar identical (${sOff.statics.length} cover + props + walls)`, geo(sOff.statics) === geo(sOn.statics) && sOff.statics.length === sOn.statics.length);
  const [re, n] = SOLID_PILOT[M];
  const k = sOn.statics.filter((x) => re.test(x)).length;
  check(`${M}: the pilot ran — ${n} Hangar solids stand on its own art`, k === n, `${k}; off: ${sOff.statics.filter((x) => /^vp/.test(x)).length}`);
}
check('flag off: swarmling is the legacy grunt sheet, tinted acid green', sOff.swarm.key === 'grunt' && sOff.swarm.prefix === 'grunt' && sOff.swarm.tint === 0x70e838);
check('V2B keeps V2\'s protagonist and swarmling byte-identical', snap.V2.tex.player === snap.V2B.tex.player && snap.V2.tex['vp-swarm'] === snap.V2B.tex['vp-swarm']);

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
// LIGHTS OUT, forced to full darkness: the material class and tint of every
// roomLayer object (pilot keys mapped back to the spec's keys) and every
// emissive part must be the flag-off ones.
const darkState = (p) => p.evaluate(() => {
  const gs = window.__gs;
  const back = (k) => k.replace(/^vp2b-|^vp-/, (m) => '').replace(/^(crate-[ab])$/, 'ch-$1').replace(/^(con-ped-c|con-heavy|con-wall)$/, 'ch-$1').replace(/^(drum(-b)?|shuttle|crane)$/, 'prop-$1');
  gs._enterDarkArena(); gs._darkChain?.stop?.(); gs._darkMix.v = 1; gs._applyDarkMix(); gs.envLight?.setPower(1);
  const layer = gs.roomLayer.getChildren().map((o) => `${o.type === 'RenderTexture' ? 'RT' : back(o.texture?.key ?? o.type)}|${o._loClass}|${o.isTinted ? o.tintTopLeft : '-'}`).sort();
  const light = (gs.envLight?.parts || []).map((q) => `${q.texture.key}|${q.x.toFixed(1)},${q.y.toFixed(1)}|${q.displayWidth.toFixed(1)}x${q.displayHeight.toFixed(1)}|${q.alpha.toFixed(3)}|${q.visible}|${q.tintTopLeft}`).sort();
  gs._clearLightsOut?.();
  return { layer, light };
});
{
  const a = await paintRoom(off, 'hangar');
  const b = { V2: await paintRoom(pg.V2, 'hangar'), V2B: await paintRoom(pg.V2B, 'hangar') };
  for (const M of ['V2', 'V2B']) {
    check(`${M}: Hangar load takes the same Math.random draws and leaves the same next value`, a.draws === b[M].draws && a.next === b[M].next, `draws ${a.draws}/${b[M].draws}, next ${a.next}/${b[M].next}`);
    check(`${M}: the pilot ran — its Hangar backdrop differs from R1`, a.bg !== b[M].bg);
  }
  check('V2B\'s Hangar backdrop differs from V2\'s (a distinct candidate)', b.V2.bg !== b.V2B.bg);
  const dOff = await darkState(off);
  for (const M of ['V2', 'V2B']) {
    const d = await darkState(pg[M]);
    check(`${M}: LIGHTS OUT — every roomLayer material class and dark tint, and every emissive part, as R1 (${dOff.layer.length} objects, ${dOff.light.length} light parts)`,
      JSON.stringify(d.layer) === JSON.stringify(dOff.layer) && JSON.stringify(d.light) === JSON.stringify(dOff.light) && dOff.light.length > 0,
      JSON.stringify(d.layer.filter((x, i) => x !== dOff.layer[i]).slice(0, 3)));
  }
  for (const id of ['corridor', 'detention', 'vader']) {
    const x = await paintRoom(off, id);
    for (const M of ['V2', 'V2B']) {
      const y = await paintRoom(pg[M], id);
      check(`${M} ${id}: backdrop byte-identical, same draws, same cover keys`, x.bg === y.bg && x.draws === y.draws && x.next === y.next && x.cover === y.cover, `${x.bg === y.bg} ${x.draws}/${y.draws} ${x.cover === y.cover}`);
    }
  }
}
await off.close(); await pg.V2.close(); await pg.V2B.close();

// ── 4. SAME FIGHT ─────────────────────────────────────────────────────────
console.log('\n== 4. same fight, R1 vs V2 vs V2B');
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
  const a = await replay(baseFlags, q);
  traces[label] = a;
  for (const M of ['V2', 'V2B']) {
    const b = await replay([baseFlags, MODES[M]].filter(Boolean).join('&'), q);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${M} ${label}: ${TICKS} headless ticks identical to R1 (state + draws)`, d < 0, d < 0 ? `${a.draws} draws, ${a.spawned} spawned` : `first divergent tick ${d}`);
    if (q === Q_SWARM) {
      check(`${M} ${label}: swarmlings really fought (${a.swarm}) and every one wore V2 at 0.7`, a.swarm > 0 && b.swarm === a.swarm && b.swarmV2 === b.swarm && a.swarmV2 === 0 && b.swarmBad === 0, `off ${a.swarmV2}/${a.swarm}, on ${b.swarmV2}/${b.swarm}`);
    }
  }
}
{
  const n = Math.min(TICKS, 600);
  const a = await replay('', Q_SWARM, { headless: false, ticks: n });
  for (const M of ['V2', 'V2B']) {
    const b = await replay(MODES[M], Q_SWARM, { headless: false, ticks: n });
    const d = firstDiff(a.hashes, b.hashes);
    check(`${M} SWARM TIDE, production: ${n} RENDERED ticks identical to R1`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  }
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
// `--old` = the V2 build (`bcd22e3`): its no-flags game is R1 (itself proven
// identical to `d05ac13`), and its `?visualPilot=v2` is V2 as delivered.
if (OLD && !SELF) {
  console.log(`\n== 6. against the previous build (${OLD})`);
  for (const [label, flags] of [['no flags (R1)', ''], ['V2 (?visualPilot=v2)', PILOT]]) {
    const pOld = await bootPage(browser, { base: OLD, flags, baseline: null, q: 'room=hangar', seed: 4242 });
    await instrument(pOld);
    const pNew = await boot(flags);
    const tOld = await pOld.evaluate(() => window.__allTex()), tNew = await pNew.evaluate(() => window.__allTex());
    const diffKeys = [...new Set([...Object.keys(tOld), ...Object.keys(tNew)])].filter((k) => tOld[k] !== tNew[k]);
    check(`${label}: every texture byte-identical to the previous build`, diffKeys.length === 0, diffKeys.join(' '));
    const bOld = await paintRoom(pOld, 'hangar'), bNew = await paintRoom(pNew, 'hangar');
    check(`${label}: the Hangar backdrop, its draws and next value match the previous build`, bOld.bg === bNew.bg && bOld.draws === bNew.draws && bOld.next === bNew.next);
    await pOld.close(); await pNew.close();
  }
  for (const [label, q, flags] of [['SWARM TIDE, no flags', Q_SWARM, ''], ['SWARM TIDE, legacy baseline', Q_SWARM, 'baseline=legacy'], ['BOMBER RUN, no flags', Q_BOMB, ''], ['SWARM TIDE, V2', Q_SWARM, PILOT]]) {
    const a = await replay(flags, q, { base: OLD }), b = traces[label.replace('no flags', 'production')] || await replay(flags, q);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: ${TICKS} ticks identical to the previous build`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
  }
} else if (!SELF) console.log('\n== 6. skipped (no --old=URL)');

// ── 7. RESTART AND RELOAD KEEP THE MODE ───────────────────────────────────
if (!SELF) {
  console.log('\n== 7. restart and reload keep the mode');
  for (const [M, flags] of [['V2', PILOT], ['V2B', PILOT_B], ['R1', '']]) {
    const p = await boot(flags);
    const want = { V2: 'v2', V2B: 'v2b', R1: null }[M];
    const re = { V2: /^vp-/, V2B: /^vp2b-/, R1: /^vp/ }[M];
    const before = await p.evaluate(() => ({ player: window.__texHash('player'), solids: window.__statics().map((x) => x.split('|')[0]).sort().join(',') }));
    const after = await p.evaluate(async () => {
      const g = window.game, gs = window.__gs;
      gs.scene.start('Game', { mode: 'endless', seed: 4242 });
      for (let i = 0; i < 600 && !(gs.roomSpec && gs.player?.active && gs.walls?.getChildren().length); i++) window.__adv(1);
      window.__adv(20);
      const e = gs.spawnEnemyAt('swarmling', 640, 700, {});
      const out = { vp: window.__dbg.getVisualPilot(), player: window.__texHash('player'), room: gs.roomSpec?.id,
        solids: window.__statics().map((x) => x.split('|')[0]).sort().join(','), swarm: e.texture.key };
      gs._destroyEnemyFully(e);
      return out;
    });
    const pilotSolids = after.solids.split(',').filter((k) => re.test(k)).length;
    check(`${M}: a scene restart keeps the mode, the protagonist sheet and the Hangar art`,
      after.vp === want && after.player === before.player && after.room === 'hangar' && after.solids === before.solids && (M === 'R1' ? pilotSolids === 0 : pilotSolids > 0) && after.swarm === (M === 'R1' ? 'grunt' : 'vp-swarm'),
      JSON.stringify({ vp: after.vp, room: after.room, pilotSolids, swarm: after.swarm, same: after.solids === before.solids }));
    await p.reload();
    await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
    const rl = await p.evaluate(async () => {
      const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
      const d = await import(u);
      return { vp: d.getVisualPilot(), b: window.game.textures.exists('vp2b-shuttle'), a: window.game.textures.exists('vp-crate-a') };
    });
    check(`${M}: a reload keeps the mode (and paints only its own set)`, rl.vp === want && rl.b === (M === 'V2B') && rl.a === (M === 'V2'), JSON.stringify(rl));
    await p.close();
  }
}

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
