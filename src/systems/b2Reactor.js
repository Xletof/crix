// B2 REACTOR OVERLOAD — the second visual-language candidate over B2
// (`?b2=A|B&b2r=1`, opt-in; HUMAN creative direction 2026-11-17; NOT approved,
// NOT frozen, NOT a default). It supersedes TEMPER's look where the HUMAN judged
// it: the stream is connected and glows again, and the Super is a chunky mass.
// Without the flag nothing here is installed. With both `b2r` and `b2t` set,
// this skin draws.
//
// THE IDEA. The rifle houses a generator that grows unstable as the Super
// charges: stable VIOLET, through MAGENTA and CRIMSON, to a CRITICAL RED that
// the weapon can barely hold.
//
//  THE GUN. Always lit under the flag. A reactor core in the receiver; channels
//    fill from the core outward and down the barrel, and the core is always the
//    hottest part (crimson at the core while the muzzle end is still violet).
//    FULL is four reds with one hot highlight, a pressure pulse, and two energy
//    threads orbiting the barrel. The Super's wind-up pulls everything into the
//    brake; afterwards the barrel cools and the core relights violet.
//  THE STREAM. TEMPER's slug body, with a tapering trail long enough to reach
//    the round behind it (its length comes from speed x cadence), over an
//    elongated glow. Core, body, rim, trail and glow change together but not in
//    step: the trail is always one stage behind the body.
//  THE SUPER. The shipped pellet keeps its body, scale and motion untouched and
//    is not drawn; a dense red mass is drawn on it (dark ruby shell, crimson,
//    scarlet, a small hot core), with a blocky wake, a blocky burst at the
//    barrel after a two-frame compression, and a blocky hit on each target.
//
// PIXELS ONLY, as TEMPER: no gameplay value is written, no `Math.random`, every
// object NORMAL blend, and the shipped Super effects still RUN (hidden) so the
// random stream is drawn exactly as in B2-B.
import Phaser from 'phaser';
import { isLowQuality } from './FX.js';
import { PLAYER } from '../config.js';
import { buildR2Atlas, R2_KEY, R2_SLUG, R2_RIB } from './b2R2Art.js';

export const REACTOR_KEY = 'b2r';
const G = 3, GG = 4;
const OUT = '#06070a';
// the round, per stage: 0 stable violet .. 4 critical red; g = OVERCHARGE gold
const BOLT = [
  { core: '#f6eaff', body: '#a968ff', rim: '#5a2ec4', trail: '#7b45e6', glow: [138, 80, 255] },
  { core: '#ffe6f8', body: '#e254dc', rim: '#8c22a0', trail: '#a968ff', glow: [226, 84, 220] },
  { core: '#ffe4e6', body: '#ff3f72', rim: '#a8143f', trail: '#e254dc', glow: [255, 63, 114] },
  { core: '#fff0dc', body: '#ff3526', rim: '#9c1018', trail: '#ff3f72', glow: [255, 53, 38] },
  { core: '#fff3b8', body: '#ff2a14', rim: '#6e0a12', trail: '#d81e30', glow: [255, 42, 20] },
];
const GOLD = { core: '#fff8e8', body: '#ffb020', rim: '#b05a10', trail: '#e08a18', glow: [255, 176, 32] };
// the gun's channels, per stage: [lit, deep]
const LAMP = [['#b98cff', '#6a3fd0'], ['#f070e6', '#9a2fb0'], ['#ff5a82', '#b01c48'], ['#ff4030', '#a81420'], ['#ff3a22', '#7a0a14']];
const HOT = '#ffd9a0';
const RUBY = '#6e0a12', CRIM = '#d81e30', SCAR = '#ff2a14';
const HEAT = [['#ffd9a8', '#ff8a3c', '#ffb070'], ['#ff8a3c', '#c2452a', '#e06030'], ['#c2452a', '#6a2420', '#8a3020'], ['#6a2420', null, null]];
// channel order: the core, then outward both ways, then down the barrel (art x on row 4)
const CH = [7, 8, 9, 6, 11, 5, 12, 13, 14, 15];
export const REACTOR = {
  muzzleMs: [28, 56, 84], hitMs: [30, 64, 100, 136],
  burstMs: [44, 88, 132], compMs: [35, 70], dimMs: [36, 72], dimAlpha: [0.42, 0.2],
  windupMs: [35, 70], heatMs: [150, 400, 700, 1000],
  igniteMs: 90, pulseMs: 900, pulseStepMs: 60, throbMs: 320, throbOnMs: 100,
  swirlMs: 55, swirlSlowMs: 95, swirlFrames: 12,
  massMs: 50, impMs: [40, 90, 150], wakeLen: 84, glowAlpha: 1,
};
const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
/** Charge in eighths, 0..7; FULL is its own state. */
export const reactorStep = (c) => (c >= 1 ? 8 : Math.max(0, Math.min(7, Math.floor(c * 8 + 1e-9))));
/** The bolt's stage: 0..3 while charging, 4 at FULL. */
export const reactorStage = (c) => (c >= 1 ? 4 : Math.max(0, Math.min(3, Math.floor(c * 4 + 1e-9))));
/** Art px of a round: long enough to reach the round fired before it. */
export const boltArtLen = (K) => Math.max(24, Math.min(44, Math.ceil((K.speed * K.cadence) / 1000 / G) + 1));

function buildAtlas(scene, K) {
  const n = boltArtLen(K), key = `${REACTOR_KEY}-${n}`;
  if (scene.textures.exists(key)) return scene.textures.get(key);
  const W = 1024, H = 1024;
  const tex = scene.textures.createCanvas(key, W, H), ctx = tex.getContext();
  let cx = 1, cy = 1, rowH = 0;
  const add = (name, rows, pal, g = G) => {
    const w = rows[0].length * g, h = rows.length * g;
    if (rows.some((r) => r.length !== rows[0].length)) throw new Error(`b2Reactor: ragged art "${name}"`);
    if (cx + w + 2 > W) { cx = 1; cy += rowH + 2; rowH = 0; }
    if (cy + h + 1 > H) throw new Error(`b2Reactor: atlas full at "${name}"`);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = pal[ch]; if (col) { ctx.fillStyle = col; ctx.fillRect(cx + x * g, cy + y * g, g, g); } }));
    tex.add(name, 0, cx, cy, w, h);
    cx += w + 2; rowH = Math.max(rowH, h);
  };
  const grid = (name, gr, g) => {
    const pal = {}, rows = [];
    let k = 0;
    for (const r of gr) { let s = ''; for (const c of r) { if (!c) { s += '.'; continue; } let q = Object.keys(pal).find((z) => pal[z] === c); if (!q) { q = String.fromCodePoint(0x100 + k++); pal[q] = c; } s += q; } rows.push(s); }
    add(name, rows, pal, g);
  };
  const blank = (w, h) => Array.from({ length: h }, () => new Array(w).fill(null));

  // ── the gun ─────────────────────────────────────────────────────────────
  const base = readRifle(scene);
  if (base) {
    const paint = (k, o = {}) => {
      const gr = base.map((r) => r.slice());
      const full = k >= 8, S = full ? 4 : Math.floor(k / 2), lit = full ? 10 : 2 + k;
      for (let i = 0; i < lit; i++) {
        const x = CH[i], s = Math.max(0, Math.min(4, S - Math.floor(i / 3))), L = LAMP[full ? 4 : s];
        const core = i < 2, head = i === lit - 1 && !full;
        gr[4][x] = core ? mix(L[0], '#ffffff', o.throb ? 0.8 : 0.5) : head ? (o.ignite ? '#ffffff' : mix(L[0], '#ffffff', 0.35)) : L[0];
        gr[5][x] = x >= 12 ? L[1] : mix(base[5][x], L[1], 0.55);
        if (base[3][x] && base[3][x] !== OUT) gr[3][x] = mix(base[3][x], L[0], o.throb && core ? 0.7 : 0.4);
      }
      const lens = LAMP[S];
      gr[1][10] = lens[0]; gr[2][10] = lens[1];
      if (full) {
        for (let x = 5; x <= 11; x++) gr[3][x] = mix(base[3][x], SCAR, 0.6);
        for (const x of [5, 6, 7, 8, 9, 11]) gr[5][x] = mix(base[5][x], RUBY, 0.7);
        gr[4][7] = HOT; gr[4][8] = '#ff8a4a'; gr[4][14] = '#ff8a4a';
        gr[3][12] = CRIM; gr[3][14] = CRIM; gr[3][16] = SCAR; gr[4][16] = HOT; gr[5][16] = CRIM; gr[6][16] = RUBY; gr[4][10] = RUBY;
        gr[1][10] = HOT; gr[2][10] = SCAR;
        if (o.pulse >= 0) for (const i of [o.pulse * 3, o.pulse * 3 + 1, o.pulse * 3 + 2]) { const x = CH[i]; if (x == null) continue; gr[4][x] = HOT; gr[5][x] = x >= 12 ? SCAR : mix(base[5][x], SCAR, 0.8); }
      }
      return gr;
    };
    for (let k = 0; k <= 7; k++) { grid(`gun-${k}`, paint(k), GG); grid(`gun-${k}i`, paint(k, { ignite: true }), GG); grid(`gun-${k}t`, paint(k, { throb: true }), GG); }
    grid('gun-8', paint(8, { pulse: -1 }), GG);
    for (let p = 0; p < 4; p++) grid(`gun-8p${p}`, paint(8, { pulse: p }), GG);
    const w0 = base.map((r) => r.slice());
    for (const x of [12, 13, 14, 15]) { w0[4][x] = HOT; w0[5][x] = SCAR; }
    w0[3][12] = SCAR; w0[3][14] = SCAR; w0[4][16] = '#ffffff'; w0[5][16] = HOT;
    grid('gun-w0', w0, GG);
    const w1 = base.map((r) => r.slice());
    for (const y of [3, 4, 5, 6]) w1[y][16] = '#ffffff';
    w1[4][15] = HOT; w1[5][15] = SCAR; w1[3][14] = '#ffffff';
    grid('gun-w1', w1, GG);
    HEAT.forEach(([a, b, c], i) => {
      const gr = blank(18, 10);
      for (const x of (i === 3 ? [14, 15] : [12, 13, 14, 15])) { gr[4][x] = a; if (b) gr[5][x] = b; }
      if (c) { gr[3][16] = c; gr[4][16] = a; gr[5][16] = b; gr[6][16] = b; gr[3][14] = c; if (i === 0) gr[3][12] = c; }
      grid(`heat-${i}`, gr, GG);
    });
    // the containment threads: a 26x18 canvas padded evenly round the 18x10 rifle (so a flip
    // keeps the bore on the centre row). Two threads on an ellipse round the barrel; the far
    // half of the orbit is hidden where the gun covers it.
    const solid = (x, y) => { const bx = x - 4, by = y - 4; return bx >= 0 && by >= 0 && bx < 18 && by < 10 && !!base[by][bx]; };
    for (const [nm, threads, pal] of [['sw', 2, [HOT, SCAR, CRIM]], ['sh', 1, ['#ff8aa0', CRIM, RUBY]]]) {
      for (let f = 0; f < REACTOR.swirlFrames; f++) {
        const gr = blank(26, 18);
        for (let t = 0; t < threads; t++) for (let seg = 4; seg >= 0; seg--) {
          const th = ((f - seg * 0.55) / REACTOR.swirlFrames) * Math.PI * 2 + t * Math.PI;
          const x = Math.round(17 + 7.6 * Math.cos(th)), y = Math.round(8.5 + 6.2 * Math.sin(th) - 0.5);
          if (x < 0 || y < 0 || x >= 26 || y >= 18) continue;
          if (Math.sin(th) < 0 && solid(x, y)) continue;      // passing behind the gun
          gr[y][x] = pal[seg === 0 ? 0 : seg < 3 ? 1 : 2];
        }
        grid(`${nm}-${f}`, gr, GG);
      }
    }
  }

  // ── the round: a slug with a trail that reaches the round behind it ─────
  const bolt = (name, P) => {
    const rows = blank(n, 5), hd = n - 20;          // the slug is the last 20 art px
    for (let x = 0; x < n; x++) {
      if (x < hd) {
        // the trail: one row, then three, darker and dithered toward its end
        // unbroken to its end, so it meets the head of the round behind it
        rows[2][x] = x < hd * 0.3 ? P.rim : P.trail;
        if (x >= Math.floor(hd * 0.3)) { const c = x >= hd - 5 ? P.trail : P.rim; rows[1][x] = c; rows[3][x] = c; }
        continue;
      }
      const u = x - hd;                                // 0..19 along the slug
      rows[2][u + hd] = u < 3 ? P.trail : u < 9 ? P.body : u < 16 ? P.core : '#ffffff';
      if (u <= 18) { const c = u < 4 ? P.rim : u < 15 ? P.body : P.core; rows[1][x] = c; rows[3][x] = c; }
      if (u >= 6 && u <= 16) { const c = u < 13 ? P.rim : P.body; rows[0][x] = c; rows[4][x] = c; }
    }
    grid(name, rows, G);
  };
  // its glow: an elongated stepped light under the round (no ball on the head)
  const glow = (name, P) => {
    const rows = [];
    for (let y = 0; y < 11; y++) {
      const d = Math.abs(y - 5), row = [];
      for (let x = 0; x < n; x++) {
        const t = x / (n - 1);
        const along = t < 0.3 ? 0.4 : t < 0.55 ? 0.6 : t < 0.8 ? 0.85 : 1;
        const across = d <= 2 ? 0 : d === 3 ? 0.44 : d === 4 ? 0.26 : 0.12;      // the bolt covers the middle
        const a = across * along * (x >= n - 1 && d > 3 ? 0 : 1);
        row.push(a > 0.01 ? `rgba(${P.glow[0]},${P.glow[1]},${P.glow[2]},${a.toFixed(3)})` : null);
      }
      rows.push(row);
    }
    grid(name, rows, G);
  };
  BOLT.forEach((P, s) => { bolt(`bolt-${s}`, P); glow(`glow-${s}`, P); });
  bolt('bolt-g', GOLD); glow('glow-g', GOLD);

  // ── the muzzle: a compact block of light, three frames; and its glow ────
  const MZ = [
    ['..HH.........', '.HHHHM.......', 'WWWWWWHHM....', 'WWWWWWWWHHHMM', 'WWWWWWHHM....', '.HHHHM.......', '..HH.........'],
    ['.HH..........', '.HHHM........', 'WWWWWHHM.....', 'WWWWWWWHHHMM.', 'WWWWWHHM.....', '.HHHM........', '.HH..........'],
    ['.............', '..M..........', '...HHHM......', '....HHHHHMM..', '...HHHM......', '..M..........', '.............'],
    ['.............', '.............', '.............', '.......M..M..', '.............', '.............', '.............'],
  ];
  const HITS = {
    s: [
      ['...........', '...........', '.....W.....', '.....W.....', '....HW.....', '...HHWH....', '....HW.....', '.....W.....', '.....W.....', '...........', '...........'],
      ['...........', '.....H.....', '...........', '...M.......', '...........', '..M........', '...........', '...M.......', '...........', '.....H.....', '...........'],
      ['.....M.....', '...........', '..D........', '...........', '...........', 'D..........', '...........', '...........', '..D........', '...........', '.....M.....'],
      ['...........', '.D.........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '.D.........', '...........'],
    ],
    b: [
      ['...........', '.....W.....', '.....W.....', '....HW.....', '...HHWH....', '..HHWWWH...', '...HHWH....', '....HW.....', '.....W.....', '.....W.....', '...........'],
      ['.....H.....', '....M......', '...........', '..M........', '...........', '.M...H.....', '...........', '..M........', '...........', '....M......', '.....H.....'],
      ['....M......', '...........', '.D.........', '...........', '...........', 'D..........', '...........', '...........', '.D.........', '...........', '....M......'],
      ['...D.......', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...D.......'],
    ],
  };
  const each = [...BOLT.map((P, s) => [String(s), P]), ['g', GOLD]];
  for (const [s, P] of each) {
    const pal = { W: '#ffffff', H: P.core, M: P.body, D: P.rim };
    MZ.forEach((rows, f) => add(`mz-${s}-${f}`, rows, pal));
    for (const sz of ['s', 'b']) HITS[sz].forEach((rows, f) => add(`hit-${s}${sz}-${f}`, rows, pal));
    const rows = [];
    for (let y = 0; y < 9; y++) { const row = []; for (let x = 0; x < 11; x++) { const r = Math.hypot((x - 4) / 5.2, (y - 4) / 4.2); row.push(r <= 0.6 ? `rgba(${P.glow.join(',')},0.34)` : r <= 1 ? `rgba(${P.glow.join(',')},0.16)` : null); } rows.push(row); }
    grid(`mzg-${s}`, rows, G);
  }

  // ── the Super ───────────────────────────────────────────────────────────
  const SP = { D: RUBY, C: CRIM, S: SCAR, H: '#ffb070', W: '#fff3b8' };
  // the mass (two frames: the shell shifts, the core breathes)
  add('mass-0', [
    '....DDDDDDDD......', '..DDCCCCCCCCDD....', '.DCCSSSSSSSSCCDD..', 'DCCSSSSSSHHSSSCCD.', 'DCSSSSSSHWWHSSSCCD',
    'DCSSSSSSHWWHSSSCCD', 'DCCSSSSSSHHSSSCCD.', '.DCCSSSSSSSSCCDD..', '..DDCCCCCCCCDD....', '....DDDDDDDD......'], SP, GG);
  add('mass-1', [
    '.....DDDDDDDD.....', '..DDDCCCCCCCDDD...', '.DCCCSSSSSSSCCD...', 'DCCSSSSSSSHHSSCCD.', 'DCSSSSSSSHWWHSSCCD',
    'DCSSSSSSHWWWHSSCCD', 'DCCSSSSSSSHHSSCCD.', '.DCCCSSSSSSSCCD...', '..DDDCCCCCCCDDD...', '.....DDDDDDDD.....'], SP, GG);
  // its wake: blocks that shrink behind it
  {
    const gr = blank(30, 10);
    const block = (x0, x1, y0, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) gr[y][x] = c; };
    block(22, 29, 2, 7, CRIM); block(23, 29, 3, 6, SCAR); block(14, 20, 3, 6, CRIM); block(15, 19, 4, 5, SCAR);
    block(7, 12, 4, 5, RUBY); block(8, 11, 4, 4, CRIM); block(3, 4, 5, 5, RUBY); block(0, 0, 4, 4, RUBY);
    grid('wake', gr, GG);
  }
  // an octagonal block or band (thick, hard-edged)
  const oct = (r, inner) => { const m = r * 2 + 1, gr = blank(m, m); for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) { const dx = Math.abs(x - r), dy = Math.abs(y - r), d = Math.max(dx, dy, (dx + dy) * 0.72); if (d <= r + 0.01 && d > inner) gr[y][x] = d; } return gr; };
  const shade = (gr, f) => gr.map((row) => row.map((d) => (d == null ? null : f(d))));
  grid('burst-0', shade(oct(6, -1), (d) => (d <= 2 ? '#ffffff' : d <= 3.5 ? '#fff3b8' : d <= 5 ? SCAR : CRIM)), GG);
  grid('burst-1', shade(oct(8, 5.2), (d) => (d <= 6.5 ? SCAR : CRIM)), GG);
  grid('burst-2', oct(10, 8.2).map((row, y) => row.map((d, x) => (d == null || (x + y) % 3 === 0 ? null : RUBY))), GG);
  grid('comp-0', shade(oct(8, 6.4), () => CRIM), GG);
  grid('comp-1', shade(oct(4, 2.4), () => SCAR), GG);
  grid('imp-0', shade(oct(5, -1), (d) => (d <= 1.5 ? '#ffffff' : d <= 3 ? '#fff3b8' : SCAR)), GG);
  grid('imp-1', oct(6, 3.6).map((row, y) => row.map((d, x) => (d == null || (Math.abs(x - 6) < 2 || Math.abs(y - 6) < 2) ? null : CRIM))), GG);
  grid('imp-2', oct(7, 5.6).map((row, y) => row.map((d, x) => (d == null || (Math.abs(x - 7) < 4 || Math.abs(y - 7) < 4) ? null : RUBY))), GG);
  tex.refresh();
  return tex;
}

// ── B2-R3: the reactor CHOKED (full, but the Super is suppressed) ─────────
// Every channel stays lit, so the charge reads as kept, but in ruby with no hot highlight,
// no pressure pulse and no threads; the lens goes cold grey and a steel clamp closes across
// the channel between the core and the barrel. `gun-8sf` is the strain: the core pushes to
// crimson for one beat against the clamp.
export const R3_KEY = 'b2r3';
/** B2-R3 shield on the armour (`&b2r=3`): the hero's own outer steel edge, lit cyan. */
export const R3_SHIELD = {
  alpha: 0.8,                 // blend of the cyan over the steel it sits on (the shading shows through)
  edges: [0, 8, 13, 19, 26],  // art rows lit at 0..4 quarters left: the shield recedes from the feet to the helmet
  fillMs: 220,                // a gain spreads down from the helmet over this
  glintMs: 1600, glintRunMs: 320,     // a brighter row runs down the edge once per glintMs
  hitMs: [50, 110],           // the shimmer on the side the hit came from: white, then bright cyan
  breakMs: [45, 95, 145, 195],        // the last point: the whole edge flashes, then shards fly 4/10/16px
  shards: 8,
};
// cyan per steel tone (hi, lt, md, dk): kept apart from the reactor's reds and violets
const SH_CY = [[214, 250, 255], [150, 236, 255], [90, 214, 240], [50, 160, 196]];
/** B2-R4: the same armour edge, a little more luminous. The silhouette's own dark keyline next
 *  to a lit edge takes a cyan glow (no pixel outside the sprite), stronger at full than at three
 *  quarters; every quarter is at least as bright as R3's 0.8; highlights a touch whiter; the
 *  shimmer two rows wide; a hit flares the keyline on its side too and holds a little longer;
 *  the break flashes the keyline and throws up to twelve shards. No blinking state. */
export const R4_SHIELD = {
  alpha: [0, 0.8, 0.85, 0.95, 1], key: [0, 0, 0, 0.35, 0.75], keyRgb: [60, 190, 220], hiLift: 0.15,
  glintMs: 1300, glintRows: 2, glintLift: 0.6, hitMs: [50, 140], breakMs: [45, 95, 145, 195],
  shards: 12, shardD: [0, 6, 14, 22], shardA: [0, 1, 0.7, 0.35],
};
export const R3_CHOKE = { strainMs: 900, strainOnMs: 90 };
/** B2-R4 timings: the wind-up hold's last-resort exit, the discharge's drawn frames, and how long
 *  after the blast they may still be drawn (two frames at 30 fps; a rifle hidden by the blade at the
 *  blast must not play the discharge when it returns). */
export const R4 = { holdMaxMs: 1500, disFrames: 2, disMaxMs: 70 };

// ── B2-R4: THE SUPER'S MUZZLE DISCHARGE IN THE REACTOR'S REDS ─────────────
// The shipped discharge is five layers (FX.superMuzzleFlash): the additive `muzzle` bloom,
// two `explosion` sprite pops (the yellow-orange fireball), a hot disc, a cone and a
// shockwave ring. The fireball keeps its frames, layering and timing: a copy of its sheet is
// palette-mapped role for role (white core -> pale pink-white, yellow -> scarlet, orange ->
// crimson, red-orange -> ruby, grey smoke -> dark ruby smoke). The bloom keeps its reds;
// its yellow sparks go scarlet. The disc, cone and ring keep their shapes; their four colours
// are mapped at draw time. Only the Super's own calls use these; every other explosion is
// unchanged. The five pellets, their impacts and the screen flash are not touched.
export const R4_FIRE = {
  explosion: { '#ffffff': '#fff0f2', '#ffee20': '#ff4a36', '#ff8810': '#d81e30', '#cc3010': '#7e0c16', '#504848': '#3c1a1e' },
  muzzle: { '#ffffff': '#fff0f2', '#ffee20': '#ff4a36' },
  draw: { 0xffffff: 0xfff0f2, 0xffe0c0: 0xffb8c0, 0xff6040: 0xff2a36, 0xffd0b0: 0xff8a96 },
};
const hex6 = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
function remapSheet(scene, from, to, map, stats) {
  if (scene.textures.exists(to)) return true;
  if (!scene.textures.exists(from) || typeof document === 'undefined') return false;
  const src = scene.textures.get(from), img = src.getSourceImage();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height), px = d.data;
  const rgb = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16))]));
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const k = hex6(px[i], px[i + 1], px[i + 2]), m = rgb[k];
    if (m) { px[i] = m[0]; px[i + 1] = m[1]; px[i + 2] = m[2]; stats.mapped++; } else stats.kept[k] = (stats.kept[k] || 0) + 1;
  }
  c.putImageData(d, 0, 0);
  const tex = scene.textures.addCanvas(to, cv);
  for (const name of src.getFrameNames()) { const f = src.frames[name]; tex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  return true;
}
function buildR4Fire(scene) {
  const st = { mapped: 0, kept: {} };
  const okE = remapSheet(scene, 'explosion', 'explosion-r4', R4_FIRE.explosion, st);
  const keptExplosion = { ...st.kept };
  const okM = remapSheet(scene, 'muzzle', 'muzzle-r4', R4_FIRE.muzzle, st);
  const a = scene.anims.get('explode');
  if (okE && a && !scene.anims.exists('explode-r4')) {
    scene.anims.create({ key: 'explode-r4', frames: a.frames.map((f) => ({ key: 'explosion-r4', frame: f.textureFrame })), frameRate: a.frameRate, repeat: 0 });
  }
  return { okE, okM, mapped: st.mapped, keptExplosion, kept: st.kept };
}
function buildR3Gun(scene) {
  if (scene.textures.exists(R3_KEY)) return scene.textures.get(R3_KEY);
  const base = readRifle(scene);
  const tex = scene.textures.createCanvas(R3_KEY, 3 * (18 * GG + 2) + 2, 10 * GG + 2), ctx = tex.getContext();
  const paint = (name, i, strain) => {
    const gr = base ? base.map((r) => r.slice()) : null;
    if (gr) {
      CH.forEach((x, j) => {
        const core = j < 2;
        gr[4][x] = core ? (strain ? CRIM : '#a8143f') : (strain && j < 4 ? '#a8143f' : RUBY);
        gr[5][x] = x >= 12 ? '#3a0609' : mix(base[5][x], '#3a0609', 0.6);
        if (base[3][x] && base[3][x] !== OUT) gr[3][x] = mix(base[3][x], RUBY, 0.3);
      });
      gr[1][10] = '#7c8794'; gr[2][10] = '#3c434c';                  // the lens: cold
      gr[3][10] = '#aab3bd'; gr[4][10] = '#8f99a6'; gr[5][10] = '#5a626c';   // the clamp
    }
    const x0 = 1 + i * (18 * GG + 2);
    if (gr) gr.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x0 + x * GG, 1 + y * GG, GG, GG); } }));
    tex.add(name, 0, x0, 1, 18 * GG, 10 * GG);
  };
  paint('gun-8s', 0, false); paint('gun-8sf', 1, true);
  // R4 `gun-dis`: the discharge — the core already dark, the energy rushing down the channels to a
  // white-hot brake (core ruby, the middle channels pink-white, the barrel channels and brake white)
  if (base) {
    const gr = base.map((r) => r.slice());
    CH.forEach((x, j) => {
      gr[4][x] = j < 2 ? RUBY : x >= 12 ? '#fff6f2' : '#ffb4a8';
      gr[5][x] = x >= 12 ? '#ffd0c4' : mix(base[5][x], '#3a0609', 0.5);
      if (base[3][x] && base[3][x] !== OUT && x >= 11) gr[3][x] = mix(base[3][x], '#ffffff', 0.55);
    });
    for (const y of [3, 4, 5, 6]) gr[y][16] = '#ffffff';
    gr[1][10] = RUBY; gr[2][10] = '#3a0609';
    const x0 = 1 + 2 * (18 * GG + 2);
    gr.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x0 + x * GG, 1 + y * GG, GG, GG); } }));
    tex.add('gun-dis', 0, x0, 1, 18 * GG, 10 * GG);
  }
  tex.refresh();
  return tex;
}

function readRifle(scene) {
  if (!scene.textures.exists('p1-rifle') || typeof document === 'undefined') return null;
  const src = scene.textures.get('p1-rifle').getSourceImage();
  if (!src || src.width !== 72 || src.height !== 40) return null;
  const cv = document.createElement('canvas'); cv.width = 72; cv.height = 40;
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0);
  const d = c.getImageData(0, 0, 72, 40).data, out = [];
  for (let y = 0; y < 10; y++) { out.push([]); for (let x = 0; x < 18; x++) { const i = ((y * 4 + 1) * 72 + x * 4 + 1) * 4; out[y].push(d[i + 3] ? `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}` : null); } }
  return out;
}

/** The skin `systems/b2Feel.js` draws through when `&b2r=1` (the same hooks as TEMPER's). */
export const R2 = {
  disMs: [30, 60, 100, 140], wallMs: [30, 64, 100], burnMs: [40, 85, 135, 185],
  linkGapK: 2.2, linkPad: 30, linkTurnDeg: 45, muzzleHoldK: 1.35,
  arcSlotMs: 70, arcPressureMs: 420, plateHitMs: 90, plateOffMs: 120, massMs: 50, wake2: 56,
};
/** `opts.r2`: B2-R2 (`&b2r=2`) — the stream ribbon, range dissipation, armour arcs and shield
 *  plates instead of the P1 rings and the shield bubble, and the dense Super mass. */
export function createReactorSkin(scene, api, K, h, opts = {}) {
  const IS2 = !!opts.r2;
  // B2-R3 (`&b2r=3`, HUMAN direction 2026-11-18) is B2-R2 with: no stream ribbon (each round is
  // its own slug, glow and dissipation, nothing joins them), B2-B's own Super (none of the
  // Super code below is installed), shield highlights on the hero's armour edges instead of
  // the plates, and a choked reactor while the Super is suppressed.
  const IS3 = IS2 && !!opts.r3;
  // B2-R4 (`&b2r=4`, HUMAN direction 2026-11-19) is B2-R3 plus: the reactor holds its compressed
  // wind-up until the Super really leaves (no empty frames before the blast) and shows a short
  // discharge, the Super's muzzle discharge in the reactor's reds, and a brighter armour shield.
  const IS4 = IS3 && !!opts.r4;
  const tex = buildAtlas(scene, K), KEY = tex.key;
  if (IS2) buildR2Atlas(scene);
  const has = (f) => !!tex.frames[f];
  const fx = scene.fx;
  const low = () => isLowQuality();
  const stats = {
    name: 'reactor', key: KEY, made: 0, peak: 0, rounds: 0, flashes: 0, hits: 0, supers: 0, lances: 0, ignites: 0, impacts: 0,
    gun: { n: 0, stage: 0, frame: null, heat: -1, shown: false, swirl: null, hasArt: has('gun-0') },
    cloak: { calls: 0, objects: 0, particles: 0 },
    sync: { checks: 0, bad: 0 }, drawn: { checks: 0, bad: 0 },
    frameSeen: { mz: [0, 0, 0], hit: [0, 0, 0, 0], crown: [0, 0, 0], ring: [0, 0], imp: [0, 0, 0] },
    pellet: { hidden: 0, restored: 0 },
    r2: IS2 ? { links: { drawn: 0, checks: 0, bad: 0, maxLen: 0, muzzle: 0, joined: 0, retract: 0, broken: 0 }, dis: [0, 0, 0, 0], wall: [0, 0, 0], burn: [0, 0, 0, 0], ends: {}, plates: { shown: 0, hits: 0, breaks: 0 }, arcs: 0, hidden: { shield: 0, ring: 0 } } : null,
  };
  if (IS2) stats.name = IS4 ? 'reactor4' : IS3 ? 'reactor3' : 'reactor2';
  if (IS4) stats.r4 = { held: 0, discharge: 0, disLapsed: 0, fireball: { pops: 0, swapped: 0, images: 0, graphics: 0 } };
  if (IS3) { buildR3Gun(scene); stats.r3 = { choked: 0, strain: 0, shield: { drawn: 0, frames: 0, rims: 0, bands: [0, 0, 0, 0, 0], hits: 0, sided: 0, breaks: 0, shards: 0, fills: 0, glints: 0, ringsHidden: 0, sync: { checks: 0, bad: 0 }, alpha: null } }; }
  const suppressedNow = () => (scene.player?._suppressedMs || 0) > 0;
  const pools = {}, pool = [];
  let out = 0;
  const img = (frame, key = KEY) => {
    const pl = key === KEY ? pool : (pools[key] = pools[key] || []);
    const o = pl.pop() || (stats.made++, scene.add.image(0, 0, key, frame));
    o.setFrame(frame).setCrop().setBlendMode(Phaser.BlendModes.NORMAL).setOrigin(0.5).setScale(1).setAlpha(1).setRotation(0).setFlipY(false).clearTint().setVisible(true);
    out++; if (out > stats.peak) stats.peak = out;
    return o;
  };
  const free = (o) => { if (!o) return; o.setVisible(false); (o.texture.key === KEY ? pool : (pools[o.texture.key] = pools[o.texture.key] || [])).push(o); out--; };
  let clock = 0;

  // ── the round ───────────────────────────────────────────────────────────
  const W = (IS2 ? R2_SLUG : boltArtLen(K)) * G, BH = 5 * G, GH = 11 * G;
  const chain = [];          // R2: the live and dying rounds, in firing order
  let frameNo = 0;
  function roundNew(v, rec) {
    stats.rounds++;
    v.st = rec.hot ? 'g' : String(reactorStage(rec.heat));
    if (IS2) {
      v.glow = low() ? null : img(`sglow-${v.st}`, R2_KEY).setOrigin(1, 0.5).setVisible(false);
      v.bolt = img(`slug-${v.st}`, R2_KEY).setOrigin(1, 0.5).setVisible(false);
      v.n = rec.n; v.t0 = clock; v.cx = Math.cos(v.ang); v.cy = Math.sin(v.ang); v.seen = -1;
      if (!IS3) chain.push(v);           // R3 draws no ribbon: nothing needs the firing order
      return;
    }
    v.glow = low() ? null : img(`glow-${v.st}`).setOrigin(1, 0.5).setVisible(false);
    v.bolt = img(`bolt-${v.st}`).setOrigin(1, 0.5).setVisible(false);
  }
  function place(o, hgt, v, hx, hy, L, live, dz) {
    if (live) o.setCrop(W - L, 0, L, hgt).setPosition(hx, hy);
    else { const eaten = Math.max(0, v.tLen - L); o.setCrop(W - v.tLen, 0, L, hgt).setPosition(hx + Math.cos(v.ang) * eaten, hy + Math.sin(v.ang) * eaten); }
    o.setVisible(true).setRotation(v.ang).setDepth(hy + 3 + dz);
    // what the sprite really shows, read back from its own crop and position
    const c = o._crop, near = W - c.x - c.width;
    stats.drawn.checks++;
    if (Math.abs(c.width - L) > 0.01 || Math.hypot(o.x - Math.cos(v.ang) * near - hx, o.y - Math.sin(v.ang) * near - hy) > 0.01) stats.drawn.bad++;
  }
  function roundDraw(v, hx, hy, L, live) {
    if (!v.bolt) return;
    if (L <= 1.5) { v.bolt.setVisible(false); v.glow?.setVisible(false); return; }
    if (v.glow) place(v.glow, GH, v, hx, hy, L, live, -0.02);
    place(v.bolt, BH, v, hx, hy, L, live, 0);
    if (IS2) { v.seen = frameNo; v.hx = hx; v.hy = hy; v.L = L; v.rx = hx - v.cx * L; v.ry = hy - v.cy * L; }
  }
  function roundFree(v) { free(v.bolt); free(v.glow); v.bolt = v.glow = null; v.freed = true; }

  // ── the muzzle ──────────────────────────────────────────────────────────
  const flashes = [];
  let lastShot = -1e9;
  function flashNew(rec, ang) {
    stats.flashes++;
    const st = rec.hot ? 'g' : String(reactorStage(rec.heat));
    flashes.push({ t: -1, ang, st, alt: rec.n & 1, img: img(`mz-${st}-${rec.n & 1}`).setOrigin(0, 0.5).setVisible(false), glow: low() ? null : img(`mzg-${st}`).setVisible(false) });
    lastShot = clock;
  }
  function updateMuzzle(dt, p) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t = f.t < 0 ? 0 : f.t + dt;                       // the age starts after the first drawn frame
      const m = p?.alive ? h.muzzleNow(p, f.ang) : null;
      const M = REACTOR.muzzleMs;
      const fr = f.t < M[0] ? 0 : f.t < M[1] ? 1 : f.t < M[2] ? 2 : -1;
      if (fr < 0 || !m) { free(f.img); free(f.glow); flashes.splice(i, 1); continue; }
      stats.frameSeen.mz[fr]++;
      const d = (m.depth ?? p.depth);
      f.img.setFrame(`mz-${f.st}-${fr === 0 ? f.alt : fr + 1}`).setPosition(m.x, m.y).setRotation(m.rot).setDepth(d + 0.3).setAlpha(m.alpha ?? 1).setVisible(true);
      if (f.glow) { if (fr < 2) f.glow.setPosition(m.x + Math.cos(m.rot) * 9, m.y + Math.sin(m.rot) * 9).setRotation(m.rot).setDepth(d + 0.25).setVisible(true); else f.glow.setVisible(false); }
    }
  }

  // ── the contact ─────────────────────────────────────────────────────────
  const hits = [];
  let curSt = '0';
  function hitNew(x, y, ang, big, depth, kind) {
    stats.hits++;
    if (IS2 && kind === 'wall') {
      // a wall: a flat flare across the surface and two sparks thrown back (not the body splash)
      hits.push({ t: -1, x, y, depth, key: `wall-${curSt}`, wall: true, img: img(`wall-${curSt}-0`, R2_KEY).setOrigin(0.4, 0.5).setRotation(ang).setVisible(false) });
      return;
    }
    const key = `hit-${curSt}${big ? 'b' : 's'}`;
    hits.push({ t: -1, x, y, depth, key, img: img(`${key}-0`).setRotation(ang).setVisible(false) });
  }
  function updateHits(dt) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const s = hits[i];
      s.t = s.t < 0 ? 0 : s.t + dt;
      const M = s.wall ? R2.wallMs : REACTOR.hitMs;
      const fr = s.t < M[0] ? 0 : s.t < M[1] ? 1 : s.t < M[2] ? 2 : (!s.wall && s.t < M[3]) ? 3 : -1;
      if (fr < 0) { free(s.img); hits.splice(i, 1); continue; }
      if (s.wall) stats.r2.wall[fr]++; else stats.frameSeen.hit[fr]++;
      s.img.setFrame(`${s.key}-${fr}`).setPosition(s.x, s.y).setDepth(s.depth).setVisible(true);
    }
  }
  function setContactRound(v) { curSt = v ? v.st : String(reactorStage(api.charge01())); }

  // ── the gun ─────────────────────────────────────────────────────────────
  const first = has('gun-0') ? 'gun-0' : 'bolt-0';
  const gun = scene.add.image(0, 0, KEY, first).setVisible(false);
  const heat = scene.add.image(0, 0, KEY, has('heat-0') ? 'heat-0' : first).setVisible(false);
  const swirl = scene.add.image(0, 0, KEY, has('sw-0') ? 'sw-0' : first).setVisible(false);
  let lastK = 0, igniteUntil = -1e9, windupAt = -1e9, blastAt = -1e9, readyAt = -1e9;
  const view = () => scene._p2a?.loadout?.view || null;
  const winding = () => {
    const t = clock - windupAt;
    if (t < 0 || blastAt >= windupAt) return false;
    // R4: the compressed reactor holds until the real blast (the shipped wind-up decides when);
    // it lets go only if the hero dies first, or after R4.holdMaxMs as a last resort
    if (IS4) return t < R4.holdMaxMs && !!scene.player?.alive;
    return t < REACTOR.windupMs[1];
  };
  let disLeft = 0;                    // R4: drawn frames of the discharge still to show
  function gunFrame() {
    if (winding()) { if (IS4 && clock - windupAt >= REACTOR.windupMs[1]) stats.r4.held++; return clock - windupAt < REACTOR.windupMs[0] ? 'gun-w0' : 'gun-w1'; }
    // R4: the reactor empties through the barrel for the first frames drawn after the blast
    if (IS4 && disLeft > 0) {
      if (clock - blastAt < R4.disMaxMs) { disLeft--; stats.r4.discharge++; return 'gun-dis'; }
      disLeft = 0; stats.r4.disLapsed++;
    }
    const k = reactorStep(api.charge01());
    // R3: full but suppressed — choked, ahead of the shot flash (a shot must not flash "ready").
    // On release from the suppression the ready pulse starts again from its first step.
    if (IS3 && k >= 8 && suppressedNow()) {
      lastK = 7; stats.gun.n = 10; stats.gun.stage = 4; stats.r3.choked++;
      if (clock % R3_CHOKE.strainMs < R3_CHOKE.strainOnMs) { stats.r3.strain++; return 'gun-8sf'; }
      return 'gun-8s';
    }
    if (k > lastK && k < 8) { igniteUntil = clock + REACTOR.igniteMs; stats.ignites++; }
    if (k === 8 && lastK < 8) readyAt = clock;
    lastK = k;
    stats.gun.n = k >= 8 ? 10 : 2 + k; stats.gun.stage = k >= 8 ? 4 : Math.floor(k / 2);
    const shot = clock - lastShot < REACTOR.muzzleMs[0];
    if (k < 8) {
      if (clock < igniteUntil || shot) return `gun-${k}i`;
      // containment pressure: from three quarters the core throbs
      if (k >= 6 && clock % REACTOR.throbMs < REACTOR.throbOnMs) return `gun-${k}t`;
      return `gun-${k}`;
    }
    if (shot) return 'gun-8p3';
    const step = Math.floor(((clock - readyAt) % REACTOR.pulseMs) / REACTOR.pulseStepMs);
    return step < 4 ? `gun-8p${step}` : 'gun-8';
  }
  function swirlFrame() {
    if (winding()) return null;
    const k = reactorStep(api.charge01());
    if (IS3 && k >= 8 && suppressedNow()) return null;          // choked: the threads stop
    if (k >= 8) return `sw-${Math.floor(clock / REACTOR.swirlMs) % REACTOR.swirlFrames}`;
    if (k >= 6) return `sh-${Math.floor(clock / REACTOR.swirlSlowMs) % REACTOR.swirlFrames}`;
    return null;
  }
  function heatFrame() {
    const t = clock - blastAt;
    if (t < 0) return null;
    const M = REACTOR.heatMs;
    const i = t < M[0] ? 0 : t < M[1] ? 1 : t < M[2] ? 2 : t < M[3] ? 3 : -1;
    return i < 0 ? null : `heat-${i}`;
  }
  const sameAs = (o, v) => o.x === v.x && o.y === v.y && o.rotation === v.rotation && o.flipY === v.flipY && o.alpha === v.alpha;
  function follow(o, v, frame, dz, ox = v.originX, oy = v.originY) {
    const tk = frame.startsWith('gun-8s') || frame === 'gun-dis' ? R3_KEY : KEY;
    if (o.texture.key !== tk) o.setTexture(tk);
    o.setFrame(frame).setOrigin(ox, oy).setPosition(v.x, v.y).setRotation(v.rotation).setFlipY(v.flipY).setAlpha(v.alpha).setDepth(v.depth + dz).setVisible(true);
  }
  function updateGun(p) {
    const v = view();
    const art = stats.gun.hasArt;
    const held = art && !!v && v.visible && v.alpha > 0 && /^p1-rifle/.test(v.texture?.key || '') && !!p?.alive;
    const gf = held ? gunFrame() : null, hf = held ? heatFrame() : null, sf = held ? swirlFrame() : null;
    stats.gun.frame = gf; stats.gun.heat = hf ? +hf.slice(5) : -1; stats.gun.shown = !!gf; stats.gun.swirl = sf;
    if (gf) follow(gun, v, gf, 0.01); else gun.setVisible(false);
    if (hf) follow(heat, v, hf, 0.02); else heat.setVisible(false);
    // the swirl's canvas is the rifle's, padded 4 art px all round: the same pivot in its own frame
    if (sf) follow(swirl, v, sf, 0.03, (v.originX * 72 + 16) / 104, 0.5); else swirl.setVisible(false);
  }
  const onPrerender = () => {
    hideRings();
    syncShield();
    const v = view();
    for (const o of [gun, heat, swirl]) { if (!o.visible || !v) continue; stats.sync.checks++; if (!sameAs(o, v)) stats.sync.bad++; }
  };
  scene.game.events.on('prerender', onPrerender);

  // ── the Super ───────────────────────────────────────────────────────────
  let emitters = null;
  const isEmitter = (o) => !!o && typeof o.emitParticleAt === 'function' && Array.isArray(o.alive);
  const cloak = (fn) => {
    stats.cloak.calls++;
    if (!emitters) emitters = scene.children.list.filter(isEmitter);
    const before = emitters.map((e) => e.alive.length);
    const dl = scene.sys.displayList, caught = [];
    const had = Object.prototype.hasOwnProperty.call(dl, 'add'), prevAdd = dl.add;
    dl.add = function (child, ...r) { caught.push(child); return prevAdd.call(this, child, ...r); };
    try { return fn(); } finally {
      if (had) dl.add = prevAdd; else delete dl.add;
      for (const o of caught) { if (Array.isArray(o)) { for (const q of o) q?.setVisible?.(false); stats.cloak.objects += o.length; } else { o?.setVisible?.(false); stats.cloak.objects++; } }
      emitters.forEach((e, i) => { for (let j = before[i]; j < e.alive.length; j++) { e.alive[j].x += 1e6; stats.cloak.particles++; } });
    }
  };
  const blast = { on: false, x: 0, y: 0, ang: 0, at: -1e9, casings: 0, pops: 0 };
  const bursts = [], masses = [], imps = [], comps = [];
  // B2-R3: B2-B's own Super. None of the Super code below is installed: the shipped cast, muzzle
  // flash, pops, casings, sparks, pellets, smoke trails, camera flash (and the closure
  // candidate's ice-violet one) draw exactly as in B2-B. The gun keeps its own wind-up and
  // cooling frames (updateGun), which are the reactor's, not the attack's.
  const dim = IS3 ? null : scene.add.rectangle(0, 0, 4, 4, 0x04050a, 1).setOrigin(0).setScrollFactor(0).setDepth(7990).setVisible(false);
  if (IS4) {
    // R4: the shipped Super discharge runs exactly as in B2-B (every object, tween and timing);
    // what it creates is drawn in the reactor's reds. No Math.random is drawn here.
    stats.r4.fire = buildR4Fire(scene);
    const pop = { x: 0, y: 0, ang: 0, at: -1e9, n: 0 };
    const GP = Phaser.GameObjects.Graphics.prototype;
    const mapC = (c) => (R4_FIRE.draw[c] ?? c);
    const recolour = (fn) => {
      const dl = scene.sys.displayList, caught = [];
      const had = Object.prototype.hasOwnProperty.call(dl, 'add'), prevAdd = dl.add;
      dl.add = function (child, ...r) { caught.push(child); return prevAdd.call(this, child, ...r); };
      const f0 = GP.fillStyle, l0 = GP.lineStyle;
      GP.fillStyle = function (c, a) { return f0.call(this, mapC(c), a); };
      GP.lineStyle = function (w, c, a) { return l0.call(this, w, mapC(c), a); };
      try { return fn(); } finally {
        GP.fillStyle = f0; GP.lineStyle = l0;
        if (had) dl.add = prevAdd; else delete dl.add;
        for (const o of caught.flat()) {
          if (!o) continue;
          if (o.type === 'Image' && o.texture?.key === 'muzzle' && stats.r4.fire.okM) { o.setTexture('muzzle-r4'); stats.r4.fireball.images++; }
          else if (o.type === 'Sprite' && o.texture?.key === 'explosion' && stats.r4.fire.okE) { const f = o.frame.name; o.setTexture('explosion-r4', f); o.play('explode-r4'); stats.r4.fireball.swapped++; }
          else if (o.type === 'Graphics') stats.r4.fireball.graphics++;
        }
      }
    };
    h.wrap(fx, 'superMuzzleFlash', (prev) => function (x, y, angle, ...r) {
      pop.x = x; pop.y = y; pop.ang = angle; pop.at = clock; pop.n = 0;
      return recolour(() => prev.call(this, x, y, angle, ...r));
    });
    // the second pop arrives 45ms later from a delayed call: recognised by its exact position
    h.wrap(fx, 'explosion', (prev) => function (x, y, ...r) {
      const mine = clock - pop.at < 200 && pop.n < 2 && [16, 44].some((d) => x === pop.x + Math.cos(pop.ang) * d && y === pop.y + Math.sin(pop.ang) * d);
      if (!mine) return prev.call(this, x, y, ...r);
      pop.n++; stats.r4.fireball.pops++;
      return recolour(() => prev.call(this, x, y, ...r));
    });
  }
  let dimAt = -1e9;
  if (!IS3) {
  h.wrap(scene, 'firePlayerSuper', (prev) => function (...a) { return cloak(() => prev.apply(this, a)); });
  h.wrap(scene, '_superBlast', (prev) => function (angle, ...r) {
    const cam = this.cameras.main;
    const hadF = Object.prototype.hasOwnProperty.call(cam, 'flash'), prevF = cam.flash;
    cam.flash = function () { return this; };
    blast.on = true;
    try { return prev.call(this, angle, ...r); } finally { blast.on = false; if (hadF) cam.flash = prevF; else delete cam.flash; }
  });
  h.wrap(fx, 'superMuzzleFlash', (prev) => function (x, y, angle, ...r) {
    blast.x = x; blast.y = y; blast.ang = angle; blast.at = clock; blast.casings = 0; blast.pops = 0; emitters = null;
    return cloak(() => prev.call(this, x, y, angle, ...r));
  });
  h.wrap(fx, 'explosion', (prev) => function (x, y, ...r) {
    const mine = clock - blast.at < 200 && blast.pops < 2 && [16, 44].some((d) => x === blast.x + Math.cos(blast.ang) * d && y === blast.y + Math.sin(blast.ang) * d);
    if (!mine) return prev.call(this, x, y, ...r);
    blast.pops++;
    return cloak(() => prev.call(this, x, y, ...r));
  });
  h.wrap(fx, 'ejectCasing', (prev) => function (x, y, angle, ...r) {
    const mine = clock - blast.at < 260 && blast.casings < 3 && x === blast.x && y === blast.y && angle === blast.ang;
    if (!mine) return prev.call(this, x, y, angle, ...r);
    blast.casings++;
    return cloak(() => prev.call(this, x, y, angle, ...r));
  });
  h.wrap(fx, 'burstDir', (prev) => function (...a) { return blast.on ? cloak(() => prev.apply(this, a)) : prev.apply(this, a); });
  const isMass = (x, y) => { for (const L of masses) if (L.b.active && L.b._gen === L.gen && L.b.x === x && L.b.y === y) return true; return false; };
  h.wrap(fx, 'smokeTrail', (prev) => function (x, y, ...r) { return isMass(x, y) ? cloak(() => prev.call(this, x, y, ...r)) : prev.call(this, x, y, ...r); });
  h.wrap(fx, 'trail', (prev) => function (x, y, ...r) { return isMass(x, y) ? cloak(() => prev.call(this, x, y, ...r)) : prev.call(this, x, y, ...r); });
  }

  const onBlast = () => {
    stats.supers++;
    blastAt = clock;
    if (IS4) disLeft = R4.disFrames;
    if (IS3) return;                     // the gun cools; the attack is B2-B's
    bursts.push({ t: -1, ang: blast.ang, img: img('burst-0').setVisible(false) });
    if (!low()) dimAt = clock;
    const g = scene.playerSuperBullets;
    for (const b of g?.getChildren?.() || []) {
      if (!b.active || masses.some((L) => L.b === b && L.gen === b._gen)) continue;
      // THE PELLET IS NOT TOUCHED: its texture, scale, body and motion are the shipped ones. It
      // is only not drawn; the mass is drawn where it is.
      stats.lances++;
      const ang = Math.atan2(b.body.velocity.y, b.body.velocity.x);
      if (IS2) masses.push({ b, gen: b._gen, ox: b.x, oy: b.y, ang, n: masses.length, img: img('mass2-0', R2_KEY).setVisible(false), wake: img('wake2', R2_KEY).setOrigin(1, 0.5).setVisible(false), glow: low() ? null : img('mglow', R2_KEY).setVisible(false) });
      else masses.push({ b, gen: b._gen, ox: b.x, oy: b.y, ang, n: masses.length, img: img('mass-0').setVisible(false), wake: img('wake').setOrigin(1, 0.5).setVisible(false) });
    }
  };
  scene.events.on('player-super-blast', onBlast);
  // R4: a death between the cast and the blast ends the wind-up hold (no held frame after a respawn)
  const onDied = () => { if (IS4 && blastAt < windupAt) windupAt = -1e9; };
  if (IS4) scene.events.on('player-dead', onDied);
  const onHit = (e) => {
    if (IS3 || scene._dmgSrc !== 'super' || !e) return;
    stats.impacts++;
    if (IS2) {
      // burn-through: a white-hot slab where the mass enters, shards out the far side
      let best = null, bd = 1e9;
      for (const L of masses) { const d = Math.hypot(L.b.x - e.x, L.b.y - e.y); if (d < bd) { bd = d; best = L; } }
      const ang = best ? best.ang : blast.ang, R = (e.cfg?.radius ?? 22) * 0.5;
      imps.push({ t: -1, burn: true, x: e.x - Math.cos(ang) * R, y: e.y - Math.sin(ang) * R, ang, depth: (e.depth ?? e.y) + 6, img: img('burn-0', R2_KEY).setOrigin(0.3, 0.5).setRotation(ang).setVisible(false) });
      return;
    }
    imps.push({ t: -1, x: e.x, y: e.y, depth: (e.depth ?? e.y) + 6, img: img('imp-0').setVisible(false) });
  };
  scene.events.on('enemy-hit', onHit);
  const showPellets = () => { for (const b of scene.playerSuperBullets?.getChildren?.() || []) if (b.active && !b.visible) { b.setVisible(true); stats.pellet.restored++; } };

  function updateSuper(dt, p) {
    if (IS3) return;
    // compression: a band closes on the muzzle during the shipped wind-up
    if (winding() && p?.alive) {
      const m = h.muzzleNow(p, p.superAim ?? p.facing);
      if (!comps.length) comps.push(img('comp-0').setVisible(false));
      const fr = clock - windupAt < REACTOR.compMs[0] ? 0 : 1;
      stats.frameSeen.ring[fr]++;
      comps[0].setFrame(`comp-${fr}`).setPosition(m.x, m.y).setDepth(8008).setVisible(true);
    } else if (comps.length) free(comps.pop());
    for (let i = bursts.length - 1; i >= 0; i--) {
      const c = bursts[i];
      c.t = c.t < 0 ? 0 : c.t + dt;
      const m = p?.alive ? h.muzzleNow(p, c.ang) : null;
      const M = REACTOR.burstMs;
      const fr = c.t < M[0] ? 0 : c.t < M[1] ? 1 : c.t < M[2] ? 2 : -1;
      if (fr < 0 || !m) { free(c.img); bursts.splice(i, 1); continue; }
      stats.frameSeen.crown[fr]++;
      const d = 10 + fr * 6;
      c.img.setFrame(`burst-${fr}`).setPosition(m.x + Math.cos(m.rot) * d, m.y + Math.sin(m.rot) * d).setRotation(0).setDepth(8010).setVisible(true);
    }
    for (let i = masses.length - 1; i >= 0; i--) {
      const L = masses[i], b = L.b;
      if (!b.active || b._gen !== L.gen) { free(L.img); free(L.wake); free(L.glow); masses.splice(i, 1); continue; }
      if (b.visible) { b.setVisible(false); stats.pellet.hidden++; }
      const cx = Math.cos(L.ang), cy = Math.sin(L.ang);
      if (IS2) {
        L.img.setFrame(`mass2-${(Math.floor(clock / R2.massMs) + L.n) & 1}`).setPosition(b.x, b.y).setRotation(L.ang).setDepth(b.depth + 0.1).setVisible(true);
        L.glow?.setPosition(b.x - cx * 6, b.y - cy * 6).setRotation(L.ang).setDepth(b.depth - 0.2).setVisible(true);
        // the wake starts at the mass's tail (44px behind its centre) and never reaches behind the barrel
        const along = (b.x - L.ox) * cx + (b.y - L.oy) * cy - 40;
        const len = Math.min(R2.wake2, along);
        if (len <= 2) { L.wake.setVisible(false); continue; }
        L.wake.setCrop(R2.wake2 - len, 0, len, 8 * GG).setPosition(b.x - cx * 40, b.y - cy * 40).setRotation(L.ang).setDepth(b.depth).setVisible(true);
        continue;
      }
      L.img.setFrame(`mass-${(Math.floor(clock / REACTOR.massMs) + L.n) & 1}`).setPosition(b.x, b.y).setRotation(L.ang).setDepth(b.depth + 0.1).setVisible(true);
      const along = (b.x - L.ox) * cx + (b.y - L.oy) * cy - 30;
      const len = Math.min(REACTOR.wakeLen, along);
      if (len <= 2) { L.wake.setVisible(false); continue; }
      L.wake.setCrop(REACTOR.wakeLen - len, 0, len, 10 * GG).setPosition(b.x - cx * 30, b.y - cy * 30).setRotation(L.ang).setDepth(b.depth).setVisible(true);
    }
    for (let i = imps.length - 1; i >= 0; i--) {
      const s = imps[i];
      s.t = s.t < 0 ? 0 : s.t + dt;
      if (s.burn) {
        const M = R2.burnMs;
        const fr = s.t < M[0] ? 0 : s.t < M[1] ? 1 : s.t < M[2] ? 2 : s.t < M[3] ? 3 : -1;
        if (fr < 0) { free(s.img); imps.splice(i, 1); continue; }
        stats.r2.burn[fr]++; stats.frameSeen.imp[Math.min(2, fr)]++;
        s.img.setFrame(`burn-${fr}`).setPosition(s.x, s.y).setDepth(s.depth).setVisible(true);
        continue;
      }
      const M = REACTOR.impMs;
      const fr = s.t < M[0] ? 0 : s.t < M[1] ? 1 : s.t < M[2] ? 2 : -1;
      if (fr < 0) { free(s.img); imps.splice(i, 1); continue; }
      stats.frameSeen.imp[fr]++;
      s.img.setFrame(`imp-${fr}`).setPosition(s.x, s.y).setDepth(s.depth).setVisible(true);
    }
    const dt2 = clock - dimAt;
    if (dt2 >= 0 && dt2 < REACTOR.dimMs[1]) {
      const cam = scene.cameras.main;
      dim.setSize(cam.width, cam.height).setPosition(0, 0).setAlpha(dt2 < REACTOR.dimMs[0] ? REACTOR.dimAlpha[0] : REACTOR.dimAlpha[1]).setVisible(true);
    } else dim.setVisible(false);
  }


  // ── R2: THE STREAM RIBBON ───────────────────────────────────────────────
  // Every round keeps its own straight path (b2Feel's tracer lifecycle draws its slug). The
  // ribbon is the stream BETWEEN rounds: from each round's head back to the rear of the round
  // fired just before it, and from the live muzzle to the newest round while the trigger runs.
  // A moving shooter bends it like water from a hose; nothing is dragged off its path. A link
  // whose older round has ended collapses into the newer one at the rounds' speed; a link to
  // the muzzle collapses the same way when the stream stops. Links break (are not drawn)
  // across a gap in the cadence, a turn sharper than linkTurnDeg, or a stretch longer than
  // linkGapK round spacings.
  const RW = R2_RIB * G;
  const links = new Map();           // newer round (or 'mz') -> { rib, glow, fx, fy, retract }
  let mzLink = null, mzRound = null;
  const spacing = (K.speed * K.cadence) / 1000;
  const cap = spacing * R2.linkGapK + R2.linkPad;
  const linkSprites = () => ({ rib: img('rib-0', R2_KEY).setOrigin(1, 0.5).setVisible(false), glow: low() ? null : img('rglow-0', R2_KEY).setOrigin(1, 0.5).setVisible(false) });
  function drawLink(L, st, nx, ny, fx, fy, depth) {
    const len = Math.hypot(nx - fx, ny - fy);
    if (len < 2 || len > Math.min(cap, RW)) { L.rib.setVisible(false); L.glow?.setVisible(false); if (len > cap) stats.r2.links.broken++; return false; }
    const ang = Math.atan2(ny - fy, nx - fx);
    L.rib.setFrame(`rib-${st}`).setCrop(RW - len, 0, len, 3 * G).setPosition(nx, ny).setRotation(ang).setDepth(depth).setVisible(true);
    L.glow?.setFrame(`rglow-${st}`).setCrop(RW - len, 0, len, 9 * G).setPosition(nx, ny).setRotation(ang).setDepth(depth - 0.02).setVisible(true);
    // read back what the sprite shows: its near end at (nx, ny), its far end at (fx, fy)
    const c = L.rib._crop;
    stats.r2.links.checks++;
    const ex = L.rib.x - Math.cos(ang) * c.width, ey = L.rib.y - Math.sin(ang) * c.width;
    if (Math.abs(c.width - len) > 0.01 || Math.hypot(ex - fx, ey - fy) > 0.05 || Math.hypot(L.rib.x - nx, L.rib.y - ny) > 0.01) stats.r2.links.bad++;
    stats.r2.links.drawn++;
    if (len > stats.r2.links.maxLen) stats.r2.links.maxLen = len;
    return true;
  }
  const freeLink = (L) => { if (!L) return; free(L.rib); free(L.glow); };
  const turnOk = (a, b) => Math.abs(Math.atan2(a.cx * b.cy - a.cy * b.cx, a.cx * b.cx + a.cy * b.cy)) <= (R2.linkTurnDeg * Math.PI) / 180;
  function updateLinks(dt, p) {
    const step = (K.speed * dt) / 1000;
    for (let i = 0; i < chain.length; i++) {
      const b = chain[i];
      if (b.freed && !links.has(b)) continue;
      const a = chain[i - 1];
      const near = !b.freed && b.seen === frameNo && b.L > 1.5;
      let L = links.get(b);
      const linked = a && a.n === b.n - 1 && b.t0 - a.t0 <= K.cadence * 1.6 && turnOk(a, b);
      if (!near || !linked) { if (L) { freeLink(L); links.delete(b); } continue; }
      if (!L) { L = linkSprites(); links.set(b, L); L.retract = false; }
      const aLive = !a.freed && a.seen === frameNo && a.L > 1.5;
      // into the middle of the older round's body: the band overlaps it instead of meeting its rear at a corner
      if (aLive) { L.fx = a.hx - a.cx * a.L * 0.5; L.fy = a.hy - a.cy * a.L * 0.5; L.retract = false; }
      else {
        // the older round has ended: the stream behind it runs on into the newer round
        if (L.fx == null) { freeLink(L); links.delete(b); continue; }
        if (!L.retract) { L.retract = true; stats.r2.links.retract++; }
        const d = Math.hypot(b.hx - L.fx, b.hy - L.fy);
        if (d <= step + 2) { freeLink(L); links.delete(b); continue; }
        L.fx += ((b.hx - L.fx) / d) * step; L.fy += ((b.hy - L.fy) / d) * step;
      }
      drawLink(L, b.st, b.hx, b.hy, L.fx, L.fy, Math.max(b.hy, L.fy) + 2.9);
    }
    // the muzzle link: from the live barrel to the newest round that is drawn (the round fired
    // this frame is not drawn until it clears the barrel), while the stream runs
    let r = null;
    for (let i = chain.length - 1; i >= 0 && i >= chain.length - 2; i--) { const q = chain[i]; if (!q.freed && q.seen === frameNo && q.L > 1.5) { r = q; break; } }
    const running = clock - lastShot <= K.cadence * R2.muzzleHoldK;
    const rDrawn = !!r;
    if (r !== mzRound) { if (mzLink) { freeLink(mzLink); mzLink = null; } mzRound = r; }
    if (rDrawn && p?.alive) {
      if (!mzLink) mzLink = { ...linkSprites(), mx: null, my: null };
      if (running) { const m = h.muzzleNow(p, r.ang); mzLink.mx = m.x; mzLink.my = m.y; }
      else if (mzLink.mx != null) {
        const d = Math.hypot(r.rx - mzLink.mx, r.ry - mzLink.my);
        if (d <= step + 2) mzLink.mx = null;
        else { mzLink.mx += ((r.rx - mzLink.mx) / d) * step; mzLink.my += ((r.ry - mzLink.my) / d) * step; }
      }
      // joined: the link is drawn, or there is no gap to bridge (a still shooter's newest round starts at the barrel)
      if (running && mzLink.mx != null && Math.hypot(mzLink.mx - r.rx, mzLink.my - r.ry) < 6) stats.r2.links.joined++;
      if (mzLink.mx != null) {
        if (drawLink(mzLink, r.st, mzLink.mx, mzLink.my, r.rx, r.ry, Math.max(r.ry, mzLink.my) + 2.9)) { stats.r2.links.muzzle++; stats.r2.links.joined++; }
      } else { mzLink.rib.setVisible(false); mzLink.glow?.setVisible(false); }
    } else if (mzLink) { freeLink(mzLink); mzLink = null; }
    // forget rounds nothing refers to any more (keep the newest for the next link)
    while (chain.length > 1 && chain[0].freed && !links.has(chain[1])) chain.shift();
  }

  // ── R2: RANGE EXPIRY ────────────────────────────────────────────────────
  // Called by b2Feel when a round ends: 'hit' | 'wall' | 'expire' | 'cancel'. Only an expiry
  // draws the dissipation; the round already stopped where gameplay stopped it.
  const dissolves = [];
  function roundEnd(v, kind) {
    if (!IS2) return;
    stats.r2.ends[kind] = (stats.r2.ends[kind] || 0) + 1;
    if (kind !== 'expire') return;
    dissolves.push({ t: -1, x: v.endX, y: v.endY, ang: v.ang, st: v.st, alt: v.r.n & 1, depth: v.endY + 3, img: img(`dis-${v.st}-${v.r.n & 1}-0`, R2_KEY).setOrigin(0, 0.5).setRotation(v.ang).setVisible(false) });
  }
  function updateDissolves(dt) {
    for (let i = dissolves.length - 1; i >= 0; i--) {
      const d = dissolves[i];
      d.t = d.t < 0 ? 0 : d.t + dt;
      const M = R2.disMs;
      const fr = d.t < M[0] ? 0 : d.t < M[1] ? 1 : d.t < M[2] ? 2 : d.t < M[3] ? 3 : -1;
      if (fr < 0) { free(d.img); dissolves.splice(i, 1); continue; }
      stats.r2.dis[fr]++;
      d.img.setFrame(`dis-${d.st}-${d.alt}-${fr}`).setPosition(d.x, d.y).setDepth(d.depth).setVisible(true);
    }
  }

  // ── R2: THE HERO — no rings; armour arcs at critical charge, shield plates ──────
  // The P1-B gauge / ready ring and the shield bubble (Player.shieldRing, drawn every frame
  // while shieldHp > 0) keep running and are hidden at pre-render. The gun is the Super meter.
  // At FULL, small red arcs run over the shoulders, chest and weapon arm (from 75%, a rare one
  // on the weapon arm). The shield is four corner plates round the hero, lit by how much of it
  // is left; a hit flashes them, the last point breaks them.
  const ARC_PTS = [[-14, -12], [13, -11], [0, -2], [-9, 8], [10, 6]];
  const arcs = IS2 ? [img('arc-0-0', R2_KEY).setVisible(false), img('arc-1-0', R2_KEY).setVisible(false), img('arc-0-0', R2_KEY).setVisible(false)] : [];
  const plates = IS2 && !IS3 ? [0, 1, 2, 3].map((k) => img('plate', R2_KEY).setRotation((k * Math.PI) / 2).setVisible(false)) : [];
  const PLATE_AT = [[-20, -24], [20, -24], [20, 20], [-20, 20]];
  let lastShield = 0, plateHitAt = -1e9, plateOffAt = -1e9;
  function updateHero(p) {
    if (!IS2) return;
    const alive = !!p?.alive && p.visible !== false;
    // arcs
    const k = reactorStep(api.charge01());
    const suppressed = (p?._suppressedMs || 0) > 0;
    const slot = Math.floor(clock / R2.arcSlotMs), ph = Math.floor(((clock % R2.arcSlotMs) / R2.arcSlotMs) * 3);
    const show = [];
    if (alive && !suppressed && !winding()) {
      if (k >= 8) {
        show.push([ARC_PTS[slot % ARC_PTS.length], slot & 1, (slot >> 1) & 3]);
        show.push([ARC_PTS[(slot + 2) % ARC_PTS.length], (slot + 1) & 1, (slot + 1) & 3]);
        if (slot % 3 === 0) { const v = view(); if (v) show.push([[v.x - p.x, v.y - p.y], slot & 1, (slot + 2) & 3]); }
      } else if (k >= 6 && clock % R2.arcPressureMs < R2.arcSlotMs) {
        const v = view();
        if (v) show.push([[v.x - p.x, v.y - p.y], slot & 1, slot & 3]);
      }
    }
    arcs.forEach((o, i) => {
      const a = show[i];
      if (!a) { o.setVisible(false); return; }
      stats.r2.arcs++;
      o.setFrame(`arc-${a[1]}-${ph}`).setPosition(Math.round(p.x + a[0][0]), Math.round(p.y + a[0][1])).setRotation((a[2] * Math.PI) / 2).setDepth(p.depth + 0.7).setAlpha(p.hiddenInBush ? PLAYER.bushAlpha : 1).setVisible(true);
    });
    if (IS3) { updateShield(p, alive); return; }
    // shield plates
    const hp = alive ? (p.shieldHp || 0) : 0;
    if (hp < lastShield) { if (hp <= 0) { plateOffAt = clock; stats.r2.plates.breaks++; } else { plateHitAt = clock; stats.r2.plates.hits++; } }
    lastShield = hp;
    const lit = hp > 0 ? Math.max(1, Math.ceil((4 * hp) / PLAYER.shieldHpMax)) : 0;
    const hit = clock - plateHitAt < R2.plateHitMs, off = hp <= 0 && clock - plateOffAt < R2.plateOffMs;
    plates.forEach((o, i) => {
      if (!alive || (hp <= 0 && !off)) { o.setVisible(false); return; }
      const kick = hit ? 2 : 0, sx = Math.sign(PLATE_AT[i][0]), sy = Math.sign(PLATE_AT[i][1]);
      const f = off ? 'plate-off' : hit ? 'plate-hit' : i < lit ? 'plate' : 'plate-dim';
      o.setFrame(f).setPosition(Math.round(p.x + PLATE_AT[i][0] + sx * kick), Math.round(p.y + PLATE_AT[i][1] + sy * kick)).setDepth(p.depth + 0.6).setAlpha(p.hiddenInBush ? PLAYER.bushAlpha : 1).setVisible(true);
    });
    if (hp > 0) stats.r2.plates.shown++;
  }
  // ── R3: THE SHIELD ON THE ARMOUR ────────────────────────────────────────
  // No bubble, no plates: the hero's own outer steel edge (steel pixels on the silhouette, read
  // from the frame the sprite shows) carries the shield, drawn over the sprite at its frame,
  // flip, scale and alpha, so the silhouette and the base sprite never change. The charge left
  // is how far down the edge stays lit (four steps, receding from the feet to the helmet); a
  // brighter row runs down it now and then; a hit shimmers on the side it came from; the last
  // point flashes the whole edge and throws a few shards. The shipped cyan absorb ring is hidden.
  const SH = R3_SHIELD;
  const shG = IS3 ? scene.add.graphics().setVisible(false) : null;
  const rimCache = new Map();
  let sheet = null, shKey = '', shDrawn = null, shGlintRow = -99;
  let shLast = 0, shEdge = 0, shFillFrom = 0, shFillAt = -1e9, shHitAt = -1e9, shHitSide = null, shBreakAt = -1e9, shBreakFrame = null, shGlintAt = 0;
  function rimsOf(p) {
    const fr = p.frame, key = `${p.texture.key}/${fr.name}`;
    if (rimCache.has(key)) return rimCache.get(key);
    let out = null;
    try {
      if (!sheet || sheet.src !== p.texture.getSourceImage()) {
        const src = p.texture.getSourceImage(), cv = document.createElement('canvas');
        cv.width = src.width; cv.height = src.height;
        const c = cv.getContext('2d'); c.drawImage(src, 0, 0);
        sheet = { src, w: src.width, d: c.getImageData(0, 0, src.width, src.height).data };
      }
      const g = fr.width % 4 === 0 && fr.height % 4 === 0 ? 4 : 1, W = fr.width / g, H = fr.height / g;
      const at = (x, y) => { const i = ((fr.cutY + y * g + (g >> 1) - (g > 1 ? 1 : 0)) * sheet.w + fr.cutX + x * g + (g >> 1) - (g > 1 ? 1 : 0)) * 4; return sheet.d[i + 3] ? [sheet.d[i], sheet.d[i + 1], sheet.d[i + 2]] : null; };
      const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      const cell = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = at(x, y);
        // steel: a cool grey (blue over red, low saturation) and not dark; outline: near black
        cell.push(!c ? 0 : lum(c) < 45 ? 1 : (c[2] - c[0] >= 8 && Math.max(...c) - Math.min(...c) <= 60 && lum(c) >= 75) ? 2 + (lum(c) >= 220 ? 0 : lum(c) >= 165 ? 1 : lum(c) >= 115 ? 2 : 3) : 9);
      }
      const ix = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x);
      // the outside: transparent cells reached from the frame's border
      const ext = new Uint8Array(W * H), st = [];
      for (let x = 0; x < W; x++) st.push([x, 0], [x, H - 1]);
      for (let y = 0; y < H; y++) st.push([0, y], [W - 1, y]);
      while (st.length) { const [x, y] = st.pop(), i = ix(x, y); if (i < 0 || ext[i] || cell[i] !== 0) continue; ext[i] = 1; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const outside = (x, y) => { const i = ix(x, y); return i < 0 || ext[i] === 1; };
      const outline = (x, y) => { const i = ix(x, y); return i >= 0 && cell[i] === 1 && N4.some(([dx, dy]) => outside(x + dx, y + dy)); };
      out = { g, W, H, px: [], inner: [] };
      const rim = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = cell[y * W + x];
        if (v < 2 || v > 5) continue;
        if (N4.some(([dx, dy]) => outside(x + dx, y + dy) || outline(x + dx, y + dy))) { out.px.push([x, y, v - 2]); rim[y * W + x] = 1; }
      }
      // the steel just inside the edge: a hit's first beat and the break's flash run two cells deep
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = cell[y * W + x];
        if (v >= 2 && v <= 5 && !rim[y * W + x] && N4.some(([dx, dy]) => { const i = ix(x + dx, y + dy); return i >= 0 && rim[i]; })) out.inner.push([x, y, v - 2]);
      }
      // the shards leave from the outermost edge cell in each of eight directions (R4: twelve)
      const cx = W / 2, cy = H / 2;
      const pick = (n) => { const best = new Array(n).fill(null); for (const q of out.px) { const a = Math.atan2(q[1] + 0.5 - cy, q[0] + 0.5 - cx), k = ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n, r = Math.hypot(q[1] + 0.5 - cy, q[0] + 0.5 - cx); if (!best[k] || r > best[k][2]) best[k] = [q[0], q[1], r, a]; } return best.filter(Boolean); };
      out.shards = pick(SH.shards);
      if (IS4) {
        out.shards12 = pick(R4_SHIELD.shards);
        // R4: the silhouette's dark keyline cells that touch a lit edge cell (inside the sprite)
        const seen = new Set(); out.key = [];
        for (const [x, y] of out.px) for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy, k = Y * W + X; if (outline(X, Y) && !seen.has(k)) { seen.add(k); out.key.push([X, Y]); } }
      }
    } catch (_) { out = null; }
    rimCache.set(key, out);
    if (out) { stats.r3.shield.frames++; stats.r3.shield.rims = Math.max(stats.r3.shield.rims, out.px.length); }
    return out;
  }
  const hexOf = (c) => (c[0] << 16) | (c[1] << 8) | c[2];
  const toward = (c, t) => [0, 1, 2].map((i) => Math.round(c[i] + (255 - c[i]) * t));
  if (IS3) {
    // where a hit came from: the shot's travel direction is passed in; the hit lands on the far side
    h.wrap(scene.player, 'damage', (prev) => function (amount, dir, ...r) {
      const had = this.shieldHp > 0;
      const ret = had ? cloakRing(() => prev.call(this, amount, dir, ...r)) : prev.call(this, amount, dir, ...r);
      if (had && this.shieldHp < shLast) { shHitAt = clock; shHitSide = typeof dir === 'number' ? dir + Math.PI : null; }
      return ret;
    });
  }
  let inAbsorb = false;
  function cloakRing(fn) { inAbsorb = true; try { return fn(); } finally { inAbsorb = false; } }
  if (IS3) h.wrap(fx, 'impactRing', (prev) => function (x, y, color, ...r) {
    if (inAbsorb && color === 0x00ffff) { stats.r3.shield.ringsHidden++; return cloak(() => prev.call(this, x, y, color, ...r)); }
    return prev.call(this, x, y, color, ...r);
  });
  function updateShield(p, alive) {
    const S = stats.r3.shield;
    const hp = alive ? (p.shieldHp || 0) : 0;
    const quarters = hp > 0 ? Math.max(1, Math.min(4, Math.ceil((4 * hp) / PLAYER.shieldHpMax))) : 0;
    if (hp < shLast && hp <= 0 && alive) { shBreakAt = clock; shBreakFrame = null; S.breaks++; }
    if (hp < shLast && hp > 0) S.hits++;
    const target = SH.edges[quarters];
    if (target > shEdge) { shFillFrom = shEdge; shFillAt = clock; S.fills++; }
    shEdge = target;
    shLast = hp;
    const tb = clock - shBreakAt, breaking = alive && tb >= 0 && tb < SH.breakMs[3];
    const show = alive && p.visible !== false && p.alpha > 0 && (hp > 0 || breaking);
    const R = show ? rimsOf(p) : null;
    if (!R) { shG.setVisible(false); shDrawn = null; return; }
    // the lit edge row, easing down from the helmet after a gain
    const tf = (clock - shFillAt) / SH.fillMs;
    const edge = tf < 1 ? Math.round(shFillFrom + (shEdge - shFillFrom) * Math.max(0, tf)) : shEdge;
    const HM = IS4 ? R4_SHIELD.hitMs : SH.hitMs;
    const th = clock - shHitAt, hit = hp > 0 && th >= 0 && th < HM[1] ? (th < HM[0] ? 0 : 1) : -1;
    const brk = breaking ? (tb < SH.breakMs[0] ? 0 : tb < SH.breakMs[1] ? 1 : tb < SH.breakMs[2] ? 2 : 3) : -1;
    if (hp > 0 && clock - shGlintAt > (IS4 ? R4_SHIELD.glintMs : SH.glintMs)) { shGlintAt = clock; S.glints++; }
    const tg = clock - shGlintAt, glint = hp > 0 && tg < SH.glintRunMs ? Math.floor((tg / SH.glintRunMs) * edge) : -99;
    shGlintRow = glint;
    const flip = !!p.flipX;
    const key = `${p.texture.key}/${p.frame.name}|${flip}|${edge}|${glint}|${hit}|${brk}`;
    const dox = p.displayOriginX, doy = p.displayOriginY, g = R.g;
    if (IS4 && key !== shKey) { shKey = key; drawShieldR4(R, p, flip, edge, quarters, hit, brk, dox, doy, g); shDrawn = { frame: p.frame.name, tex: p.texture.key, flip }; }
    if (!IS4 && key !== shKey) {
      shKey = key;
      shG.clear();
      const lx = (x) => (flip ? dox - (x + 1) * g : x * g - dox), ly = (y) => y * g - doy;
      let sx = 0, sy = 0;
      if (hit >= 0 && shHitSide != null) { sx = Math.cos(shHitSide - p.rotation) * (p.scaleX < 0 ? -1 : 1); sy = Math.sin(shHitSide - p.rotation); }
      const deep = brk === 0 || hit === 0;
      if (brk <= 0) for (const [x, y, t, inner] of deep ? [...R.px, ...R.inner.map((q) => [...q, 1])] : R.px) {
        const lit = brk === 0 || y < edge || (hit === 0 && inner !== 1);
        if (!lit) continue;
        let c = SH_CY[t], a = SH.alpha;
        if (brk === 0) { c = toward(c, inner ? 0.5 : 0.85); a = inner ? 0.85 : 1; }
        else {
          if (y === glint || y === glint - 1) { c = toward(c, 0.45); a = 0.95; }
          if (hit >= 0) {
            const ux = lx(x) + g / 2, uy = ly(y) + g / 2, d = Math.hypot(ux, uy) || 1;
            const side = shHitSide == null || (ux * sx + uy * sy) / d > 0.15;
            if (side) { c = hit === 0 ? toward(c, inner ? 0.55 : 0.9) : toward(c, 0.4); a = 1; }
            else if (inner || y >= edge) continue;           // off the struck side: only what is lit anyway
          }
        }
        shG.fillStyle(hexOf(c), a); shG.fillRect(lx(x), ly(y), g, g);
      }
      if (brk >= 1) {
        const d = [0, 4, 10, 16][brk], al = [0, 0.9, 0.6, 0.3][brk];
        for (const [x, y, , a0] of R.shards) {
          const ang = flip ? Math.PI - a0 : a0;
          shG.fillStyle(hexOf(SH_CY[1]), al); shG.fillRect(lx(x) + Math.cos(ang) * d, ly(y) + Math.sin(ang) * d, g, g);
          S.shards++;
        }
      }
      shDrawn = { frame: p.frame.name, tex: p.texture.key, flip };
    }
    if (hit >= 0) { S.sided++; }
    if (edge > 0 || brk >= 0) S.drawn++;
    S.bands[quarters]++;
    S.alpha = p.alpha;
    shG.setPosition(p.x, p.y).setScale(Math.abs(p.scaleX), p.scaleY).setRotation(p.rotation).setAlpha(p.alpha).setDepth(p.depth + 0.01).setVisible(true);
  }
  // R4: the brighter armour edge (see R4_SHIELD). Same overlay, same rules for what is lit.
  function drawShieldR4(R, p, flip, edge, quarters, hit, brk, dox, doy, g) {
    const S4 = R4_SHIELD, S = stats.r3.shield;
    shG.clear();
    const lx = (x) => (flip ? dox - (x + 1) * g : x * g - dox), ly = (y) => y * g - doy;
    let sx = 0, sy = 0;
    if (hit >= 0 && shHitSide != null) { sx = Math.cos(shHitSide - p.rotation); sy = Math.sin(shHitSide - p.rotation); }
    const onSide = (x, y) => { if (hit < 0) return false; if (shHitSide == null) return true; const ux = lx(x) + g / 2, uy = ly(y) + g / 2, d = Math.hypot(ux, uy) || 1; return (ux * sx + uy * sy) / d > 0.15; };
    const glint = shGlintRow;
    if (brk <= 0) {
      // the keyline glow first (under the edge), then the edge
      const ka = brk === 0 ? 1 : S4.key[quarters];
      for (const [x, y] of R.key || []) {
        const side = onSide(x, y);
        let a = y < edge ? ka : 0, c = S4.keyRgb;
        if (brk === 0) { a = 1; c = toward(c, 0.8); }
        else if (side) { a = Math.max(a, hit === 0 ? 0.9 : 0.8); c = hit === 0 ? toward(c, 0.75) : toward(c, 0.35); }
        if (a <= 0.01) continue;
        shG.fillStyle(hexOf(c), a); shG.fillRect(lx(x), ly(y), g, g);
      }
      const deep = brk === 0 || hit === 0;
      for (const [x, y, t, inner] of deep ? [...R.px, ...R.inner.map((q) => [...q, 1])] : R.px) {
        const side = onSide(x, y);
        const lit = brk === 0 || y < edge || (hit === 0 && inner !== 1 && side);
        if (!lit) continue;
        if (inner === 1 && brk !== 0 && !side) continue;
        let c = t <= 1 ? toward(SH_CY[t], S4.hiLift) : SH_CY[t], a = S4.alpha[Math.max(1, quarters)];
        if (brk === 0) { c = toward(c, inner ? 0.5 : 0.85); a = inner ? 0.9 : 1; }
        else {
          if (glint >= 0 && y <= glint && y > glint - S4.glintRows) { c = toward(c, S4.glintLift); a = 1; }
          if (side) { c = hit === 0 ? toward(c, inner ? 0.55 : 0.9) : toward(c, 0.45); a = 1; }
        }
        shG.fillStyle(hexOf(c), a); shG.fillRect(lx(x), ly(y), g, g);
      }
    }
    if (brk >= 1) {
      const d = S4.shardD[brk], al = S4.shardA[brk];
      for (const [x, y, , a0] of R.shards12 || R.shards) {
        const ang = flip ? Math.PI - a0 : a0;
        shG.fillStyle(hexOf(toward(SH_CY[1], 0.3)), al); shG.fillRect(lx(x) + Math.cos(ang) * d, ly(y) + Math.sin(ang) * d, g, g);
        S.shards++;
      }
    }
  }
  function syncShield() {
    // what the overlay shows, read back against the sprite at render time
    if (!IS3 || !shG.visible || !shDrawn) return;
    const P = scene.player, S = stats.r3.shield.sync;
    S.checks++;
    if (!P || shG.x !== P.x || shG.y !== P.y || shG.scaleY !== P.scaleY || shG.scaleX !== Math.abs(P.scaleX) || shG.alpha !== P.alpha || shDrawn.frame !== P.frame.name || shDrawn.tex !== P.texture.key || shDrawn.flip !== !!P.flipX) S.bad++;
  }
  function hideRings() {
    if (!IS2) return;
    const P = scene.player;
    if (P?.shieldRing?.visible) { P.shieldRing.setVisible(false); stats.r2.hidden.shield++; }
    const p1 = scene._p1Player;
    if (p1) for (const o of [p1.gauge, p1.ring, p1.ticks, p1.ping]) if (o?.visible) { o.setVisible(false); stats.r2.hidden.ring++; }
  }

  return {
    stats, boltLen: W, roundEnd,
    roundNew, roundDraw, roundFree, flashNew, hitNew, setContactRound,
    numberColor(killed) { const s = reactorStage(api.charge01()); return killed ? BOLT[s].body : '#ffeef4'; },
    onSuper() { windupAt = clock; },
    update(dt, clk, p) {
      clock = clk;
      updateHits(dt);
      updateMuzzle(dt, p);
      updateGun(p);
      updateSuper(dt, p);
      if (IS2) { if (!IS3) updateLinks(dt, p); updateDissolves(dt); updateHero(p); }
      frameNo++;              // rounds b2Feel draws next frame carry the next number
    },
    destroy() {
      scene.game.events.off('prerender', onPrerender);
      scene.events.off('player-super-blast', onBlast);
      scene.events.off('player-dead', onDied);
      scene.events.off('enemy-hit', onHit);
      try { showPellets(); } catch (_) { /* scene going down */ }
      for (const o of [gun, heat, swirl, dim, shG, ...pool, ...comps, ...Object.values(pools).flat(), ...arcs, ...plates]) { try { o?.destroy(); } catch (_) { /* */ } }
      for (const L of [...links.values(), mzLink]) { try { L?.rib.destroy(); L?.glow?.destroy(); } catch (_) { /* */ } }
      for (const d of dissolves) { try { d.img.destroy(); } catch (_) { /* */ } }
      links.clear(); chain.length = 0; dissolves.length = 0;
      for (const f of flashes) { try { f.img.destroy(); f.glow?.destroy(); } catch (_) { /* */ } }
      for (const s of [...hits, ...imps, ...bursts]) { try { s.img.destroy(); } catch (_) { /* */ } }
      for (const L of masses) { try { L.img.destroy(); L.wake.destroy(); L.glow?.destroy(); } catch (_) { /* */ } }
      pool.length = 0; flashes.length = 0; hits.length = 0; bursts.length = 0; masses.length = 0; imps.length = 0; comps.length = 0;
    },
  };
}
