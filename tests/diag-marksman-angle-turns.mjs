// DIAG: PHASE 3C-T1 — does a repositioning Marksman visibly TURN ROUND?
// (`?marksmanAngle=1`; reports, asserts nothing.)
//
// The module's own `reversals` counter compares the SIDE of the player each
// commitment is on, which is not what a player sees: a side flip relative to a
// player who is themselves running round the room can be a straight walk on
// screen. This measures the thing on screen. Every time a commitment is
// replaced IN THE SAME TICK by another, it compares the old walk's heading
// (from where that walk started to its destination) with the new one (from
// where the body is to the new destination) and records the turn, how long
// the old walk lasted and how far it got. A turn over 120 degrees is a
// turn-around.
//
// Real Detention, the real spawner, the same autopilot pilots and seeds as the
// t1enc matrix in `diag-tactical-engagement.mjs`.
//
// usage: node tests/diag-marksman-angle-turns.mjs [--vars=angB,ang] [--seeds=2] [--csv=FILE]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { CHROME } from './diag-stuck-audit.mjs';
import { tacPage, runEnc, VARIANTS, Q } from './diag-tactical-engagement.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const VARS = opt('vars', 'angB,ang').split(',');
const SEEDS = Array.from({ length: +opt('seeds', '2') }, (_, i) => 1001 + i * 7919);
const PLAN = [['mixed', ['handset', 'hide', 'circle', 'hop', 'charge', 'retreat', 'behind']], ['nest', ['handset', 'hide', 'hop', 'charge']]];
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const rows = [];
for (const vk of VARS) for (const [enc, pilots] of PLAN) for (const pilot of pilots) for (const seed of SEEDS) {
  const p = await tacPage(browser, VARIANTS[vk], Q[enc], seed);
  await p.evaluate(() => {
    const T = window.__tac; window.__k = [];
    const step0 = T.step;
    T.step = () => {
      step0();
      for (const r of T.list) {
        const e = r.e, M = e._marksmanAngle;
        if (!M || !(e.active && e.alive)) continue;
        window.__k.push([T.tick, r.id, M.commit ? M.commit.at : null, M.commit ? M.commit.x : null, M.commit ? M.commit.y : null, e.x, e.y]);
      }
    };
  });
  await runEnc(p, { seed, ticks: 2400, pilot: { mode: pilot }, fire: 7 });
  const k = await p.evaluate(() => window.__k);
  await p.close();
  const by = {};
  for (const w of k) (by[w[1]] ||= []).push(w);
  let commits = 0;
  for (const [actor, list] of Object.entries(by)) {
    let prev = null, start = null, from = null;
    for (const w of list) {
      if (w[2] != null && (!prev || w[2] !== prev[2])) {
        commits++;
        if (prev && prev[2] != null) {
          const a0 = Math.atan2(prev[4] - from[1], prev[3] - from[0]), a1 = Math.atan2(w[4] - w[6], w[3] - w[5]);
          let d = Math.abs(a1 - a0) % (2 * Math.PI);
          if (d > Math.PI) d = 2 * Math.PI - d;
          rows.push({ section: 'turn', scenario: `${enc}:${pilot}`, variant: vk, seed, actor: +actor, atMs: Math.round(w[0] * 1000 / 60),
            lifeMs: Math.round((w[0] - start) * 1000 / 60), turnDeg: Math.round(d * 180 / Math.PI), walkedPx: Math.round(Math.hypot(w[5] - from[0], w[6] - from[1])) });
        }
        start = w[0]; from = [w[5], w[6]];
      }
      prev = w;
    }
  }
  rows.push({ section: 'turnrun', scenario: `${enc}:${pilot}`, variant: vk, seed, commits });
  console.log(`  ${vk} ${enc}:${pilot} ${seed} commits ${commits}`);
}
await browser.close();
const q = (a, f) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(f * (a.length - 1))] : '');
for (const vk of VARS) {
  const all = rows.filter((r) => r.section === 'turn' && r.variant === vk), runs = rows.filter((r) => r.section === 'turnrun' && r.variant === vk);
  const ta = all.filter((r) => r.turnDeg > 120);
  console.log(`${vk}: ${runs.reduce((s, r) => s + r.commits, 0)} commitments in ${runs.length} runs; ${all.length} replaced in the same tick; ${ta.length} turn round (>120deg), ${ta.filter((r) => r.lifeMs < 450).length} of them inside 450ms`);
  console.log(`  turn-arounds: walk before turning ms median ${q(ta.map((r) => r.lifeMs), 0.5)} / p10 ${q(ta.map((r) => r.lifeMs), 0.1)} / min ${ta.length ? Math.min(...ta.map((r) => r.lifeMs)) : ''}; px median ${q(ta.map((r) => r.walkedPx), 0.5)} / p10 ${q(ta.map((r) => r.walkedPx), 0.1)}`);
  const byP = {};
  for (const r of ta) byP[r.scenario] = (byP[r.scenario] || 0) + 1;
  console.log(`  by pilot ${JSON.stringify(byP)}`);
}
const csv = opt('csv', '');
if (csv) {
  const cols = [];
  for (const r of rows) for (const c of Object.keys(r)) if (!cols.includes(c)) cols.push(c);
  writeFileSync(csv, [cols.join(','), ...rows.map((r) => cols.map((c) => r[c] ?? '').join(','))].join('\n') + '\n');
  console.log('wrote', csv, rows.length, 'rows');
}
