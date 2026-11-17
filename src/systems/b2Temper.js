// B2 TEMPER — THE FLAGSHIP VISUAL LANGUAGE (`?b2=A|B&b2t=1`, opt-in over B2;
// HUMAN-authorized 2026-11-16 as an isolated candidate; NOT approved, NOT
// frozen, NOT a default). Without the flag nothing here is installed.
//
// ONE SENTENCE: STORED ENERGY IS COOL AND LIVES ON THE GUN; SPENT ENERGY IS
// WARM AND LEAVES IT.
//
//  THE GUN IS THE METER. Charge climbs the rifle's own pixels from the breech
//    to the muzzle as ten lamps: the hero's cyan, then sky, then periwinkle,
//    and at FULL the approved Super-ready colours (ice-white `#eef8ff`,
//    periwinkle `#8c9cff`, P1-B). The metal next to a lit lamp takes its
//    light. At 0 the overlay is off: the gun is the approved P1 sprite.
//  HUE, NOT BRIGHTNESS. A bolt has one size at every charge. It is the hero's
//    warm red slug; the charge is a COOL TIP that grows from the head back,
//    and at FULL the whole round is periwinkle with an ice core. No halo.
//    (Not a red-to-violet hue ramp: purple is the Marksman's, the Captain's
//    and the Force's colour, and thin red strips read as the Marksman's aim
//    lasers at phone size.)
//  FRAMES, NOT TWEENS. The muzzle and the contact are short frame-by-frame
//    animations keyed to milliseconds, at a fixed pixel size, eroding through
//    a palette ramp. Nothing is scaled, alpha-faded or additive.
//  THE SUPER IS A RELEASE. The lamps collapse to the muzzle in the wind-up; the
//    blast is a crown and a hard ring at the barrel and five ice lances, over
//    a two-frame dim instead of a screen flash; then the lamps are dark and
//    the brake glows and cools. The shipped fireball, wedges, sparks, casings,
//    smoke and warm flash still RUN (so `Math.random` is drawn exactly as in
//    B2-B and the fight is the same fight) but what they create is hidden.
//
// PIXELS ONLY. No damage, cadence, collision, aim, economy, camera or enemy
// value is read for anything but drawing. No `Math.random`. Every object is
// NORMAL blend (ADD breaks the y-sorted sprite batch: systems/p2aFx.js).
import Phaser from 'phaser';
import { isLowQuality } from './FX.js';

export const TEMPER_KEY = 'b2t';
const G = 3;                       // world px per art px for projectiles and effects
const OUT = '#06070a';             // the hero art's outline
const RED = { deep: '#a3201c', mid: '#ff4030', hot: '#ffb49a', white: '#fff1e6' };
const GOLD = { deep: '#b05a10', mid: '#ffb020', hot: '#ffe2a0', white: '#fff8e8' };   // OVERCHARGE rounds
const ICE = { deep: '#5868d8', mid: '#8c9cff', hot: '#dfe8ff', white: '#ffffff' };
// the lamps: [lit, deep] per stage; stage 4 is FULL (the P1-B ready colours)
const STAGE = [null, ['#7fe8ff', '#3fb4d6'], ['#86c8ff', '#4a8fe0'], ['#9aa8ff', '#5f6fe0'], ['#eef8ff', '#8c9cff']];
const HEAT = [['#ffd9a8', '#ff8a3c', '#ffb070'], ['#ff8a3c', '#c2452a', '#e06030'], ['#c2452a', '#6a2420', '#8a3020'], ['#6a2420', null, null]];
const LAMPS = [5, 6, 7, 8, 9, 11, 12, 13, 14, 15];     // art x of each lamp, on row 4
export const TEMPER = {
  boltLen: 78,
  muzzleMs: [28, 56, 84],          // frame ends
  hitMs: [30, 64, 100, 136],
  crownMs: [40, 80, 120, 160],
  ringMs: [[30, 70], [70, 110], [110, 150]],
  dimMs: [36, 72], dimAlpha: [0.42, 0.2],
  windupMs: [35, 70],
  heatMs: [150, 400, 700, 1000],
  igniteMs: 90, pulseMs: 1100, pulseStepMs: 60,
  wakeLen: 120,
};

const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
export const lampCount = (c) => (c >= 1 ? 10 : Math.max(0, Math.min(9, Math.floor(c * 10 + 1e-9))));
export const lampStage = (n) => (n <= 0 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : n <= 9 ? 3 : 4);
export const tipStep = (c) => (c >= 1 ? 8 : Math.max(0, Math.min(7, Math.floor(c * 8 + 1e-9))));

// ── the atlas: ONE canvas texture, every frame named ───────────────────────
function buildAtlas(scene) {
  if (scene.textures.exists(TEMPER_KEY)) return scene.textures.get(TEMPER_KEY);
  const W = 1024, H = 512;
  const tex = scene.textures.createCanvas(TEMPER_KEY, W, H), ctx = tex.getContext();
  let cx = 1, cy = 1, rowH = 0;
  /** `rows`: an array of strings, one char per art px; `pal`: char -> colour. */
  const add = (name, rows, pal, g = G) => {
    const w = rows[0].length * g, h = rows.length * g;
    if (rows.some((r) => r.length !== rows[0].length)) throw new Error(`b2Temper: ragged art "${name}"`);
    if (cx + w + 2 > W) { cx = 1; cy += rowH + 2; rowH = 0; }
    if (cy + h + 1 > H) throw new Error(`b2Temper: atlas full at "${name}"`);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = pal[ch]; if (col) { ctx.fillStyle = col; ctx.fillRect(cx + x * g, cy + y * g, g, g); } }));
    tex.add(name, 0, cx, cy, w, h);
    cx += w + 2; rowH = Math.max(rowH, h);
  };
  const grid = (name, gr, g) => {
    const pal = {}, rows = [];
    let n = 0;
    for (const r of gr) { let s = ''; for (const c of r) { if (!c) { s += '.'; continue; } let k = Object.keys(pal).find((q) => pal[q] === c); if (!k) { k = String.fromCharCode(0x41 + n++); pal[k] = c; } s += k; } rows.push(s); }
    add(name, rows, pal, g);
  };

  // ── the gun: the approved P1 rifle, re-lit ──────────────────────────────
  const base = readRifle(scene);
  if (base) {
    const lit = (gr, n, opts = {}) => {
      const st = STAGE[lampStage(n)];
      for (let i = 0; i < n; i++) {
        const x = LAMPS[i], head = i === n - 1 && n < 10;
        gr[4][x] = head ? (opts.ignite ? '#ffffff' : mix(st[0], '#ffffff', 0.65)) : st[0];
        gr[5][x] = x >= 12 ? st[1] : mix(base[5][x], st[1], 0.45);
        if (base[3][x] && base[3][x] !== OUT) gr[3][x] = head && opts.ignite ? st[0] : mix(base[3][x], st[0], 0.45);
      }
      return gr;
    };
    const full = (pulse = -1) => {
      const gr = lit(base.map((r) => r.slice()), 10);
      for (let x = 5; x <= 11; x++) gr[3][x] = '#cfefff';
      gr[3][6] = '#ffffff';
      gr[3][12] = ICE.mid; gr[3][14] = ICE.mid; gr[3][16] = '#eef8ff';
      gr[4][10] = ICE.mid; gr[4][16] = '#c9d4ff'; gr[5][16] = ICE.mid;
      gr[1][10] = '#ffffff'; gr[2][10] = '#e8fbff';
      for (const x of [5, 6, 7, 8, 9, 11]) gr[5][x] = mix(base[5][x], ICE.mid, 0.6);
      // the pulse: three lamps' underside and top edge go white, breech to muzzle
      if (pulse >= 0) {
        for (const i of [pulse * 3, pulse * 3 + 1, pulse * 3 + 2]) { const x = LAMPS[i]; if (x == null) continue; gr[5][x] = '#eef8ff'; if (gr[3][x] && gr[3][x] !== OUT) gr[3][x] = '#ffffff'; }
        if (pulse === 3) { gr[4][16] = '#ffffff'; gr[5][16] = '#eef8ff'; gr[3][16] = '#ffffff'; }
      }
      return gr;
    };
    for (let n = 1; n <= 9; n++) { grid(`gun-${n}`, lit(base.map((r) => r.slice()), n), 4); grid(`gun-${n}i`, lit(base.map((r) => r.slice()), n, { ignite: true }), 4); }
    grid('gun-10', full(), 4);
    for (let p = 0; p < 4; p++) grid(`gun-10p${p}`, full(p), 4);
    // the wind-up: the charge collapses into the barrel, then into the brake
    const w0 = base.map((r) => r.slice());
    for (const x of [12, 13, 14, 15]) { w0[4][x] = '#ffffff'; w0[5][x] = '#eef8ff'; }
    w0[3][12] = '#eef8ff'; w0[3][14] = '#eef8ff'; w0[4][16] = '#ffffff'; w0[5][16] = '#ffffff';
    grid('gun-w0', w0, 4);
    const w1 = base.map((r) => r.slice());
    for (const y of [3, 4, 5, 6]) w1[y][16] = '#ffffff';
    w1[4][15] = '#eef8ff'; w1[5][15] = ICE.mid; w1[3][14] = '#ffffff';
    grid('gun-w1', w1, 4);
    // the spent barrel: only the hot pixels (drawn over the gun)
    HEAT.forEach(([a, b, c], i) => {
      const gr = base.map((r) => r.map(() => null));
      const xs = i === 3 ? [14, 15] : [12, 13, 14, 15];
      for (const x of xs) { gr[4][x] = a; if (b) gr[5][x] = b; }
      if (c) { gr[3][16] = c; gr[4][16] = a; gr[5][16] = b; gr[6][16] = b; gr[3][14] = c; if (i === 0) gr[3][12] = c; }
      grid(`heat-${i}`, gr, 4);
    });
  }

  // ── the bolt: a 26x5 slug, the cool tip `k` eighths long ────────────────
  const bolt = (name, body, k) => {
    const tip = k >= 8 ? 26 : k <= 0 ? 0 : Math.max(4, Math.round((k / 8) * 26));
    const rows = [[], [], [], [], []];
    const pal = {};
    const put = (y, x, c) => { rows[y][x] = c; };
    for (let x = 0; x < 26; x++) {
      const P = x >= 26 - tip ? ICE : body;
      // centre row: a short dithered tail, deep, mid, hot, white head
      if (!(x < 3 && x === 1)) put(2, x, x < 6 ? P.deep : x < 12 ? P.mid : x < 21 ? P.hot : P.white);
      // inner rows
      if (x >= 5 && x <= 24) { const c = x < 9 ? P.deep : x < 20 ? P.mid : P.hot; put(1, x, c); put(3, x, c); }
      // the rim, widest behind the head
      if (x >= 11 && x <= 22) { const c = x < 18 ? P.deep : P.mid; put(0, x, c); put(4, x, c); }
    }
    const out = rows.map((r) => { let s = ''; for (let x = 0; x < 26; x++) { const c = r[x]; if (!c) { s += '.'; continue; } let key = Object.keys(pal).find((q) => pal[q] === c); if (!key) { key = String.fromCharCode(0x41 + Object.keys(pal).length); pal[key] = c; } s += key; } return s; });
    add(name, out, pal);
  };
  for (let k = 0; k <= 8; k++) { bolt(`bolt-r${k}`, RED, k); bolt(`bolt-g${k}`, GOLD, k); }

  // ── the muzzle: three frames, +x is the bore, origin at the left centre ─
  //   W white  H hot  M mid  (the lance)      s S (the brake's side jets)
  const MZ = [
    // frame 0: the lance and the brake's two jets
    ['.S............', '.Ss...........', '.sS...........', '..Ss..........', '.HHHMM........', 'WWWWWWWHHHHMMM', '.HHHMM........', '..Ss..........', '.sS...........', '.Ss...........', '.S............'],
    // frame 0, alternate: shorter jets, the same lance
    ['..............', '.S............', '.Ss...........', '..Ss..........', '.HHHM.........', 'WWWWWWHHHHHMM.', '.HHHM.........', '..Ss..........', '.Ss...........', '.S............', '..............'],
    // frame 1: the core lifts off the face, the jets thin and move out
    ['.s............', '.S............', '..............', '..............', '..............', '...HHHHHHMM...', '..............', '..............', '..............', '.S............', '.s............'],
    // frame 2: three embers
    ['s.............', '..............', '..............', '..............', '..............', '...........M..', '..............', '..............', '..............', '..............', 's.............'],
  ];
  for (let st = 0; st <= 4; st++) {
    const L = st === 4 ? ICE : RED;
    const J = st === 0 ? RED : st === 4 ? ICE : { hot: STAGE[st][0], mid: STAGE[st][1] };
    const pal = { W: L.white, H: L.hot, M: L.mid, S: J.hot, s: J.mid };
    MZ.forEach((rows, f) => add(`mz-${st}-${f}`, rows, pal));
  }
  // the light it throws on the deck: a stepped ellipse, drawn faint
  {
    const rows = [];
    for (let y = 0; y < 9; y++) { let s = ''; for (let x = 0; x < 19; x++) { const r = Math.hypot((x - 9) / 9.4, (y - 4) / 4.4); s += r <= 0.55 ? 'A' : r <= 1 ? 'B' : '.'; } rows.push(s); }
    add('spill-w', rows, { A: 'rgba(255,150,120,0.9)', B: 'rgba(255,110,90,0.5)' }, 4);
    add('spill-c', rows, { A: 'rgba(190,205,255,0.9)', B: 'rgba(140,156,255,0.5)' }, 4);
  }

  // ── the contact: four frames, +x is the flight (into the target) ────────
  const HIT = {
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
  for (const [pk, P] of [['w', RED], ['c', ICE], ['g', GOLD]]) for (const sz of ['s', 'b']) HIT[sz].forEach((rows, f) => add(`hit-${pk}${sz}-${f}`, rows, { W: P.white, H: P.hot, M: P.mid, D: P.deep }));

  // ── the Super: crown, ring, lance, wake ─────────────────────────────────
  const CROWN = [
    ['..S.......................', '..SS......................', '..SSS.....................', '...SSS....................', '...sSSS...................', '....sSS...................', '.....SS...................', '..HHHHHHHH................', '.WWWWWWWWWWWHHHH..........', 'WWWWWWWWWWWWWWWWWWHHHHMMMM', '.WWWWWWWWWWWHHHH..........', '..HHHHHHHH................', '.....SS...................', '....sSS...................', '...sSSS...................', '...SSS....................', '..SSS.....................', '..SS......................', '..S.......................'],
    ['..S.......................', '..S.......................', '..sS......................', '..........................', '..........................', '..........................', '..........................', '..........................', '....HHHHHHHHHHMM..........', '......WWWWWWWWWWWWHHHHMMMM', '....HHHHHHHHHHMM..........', '..........................', '..........................', '..........................', '..........................', '..........................', '..sS......................', '..S.......................', '..S.......................'],
    ['.s........................', '.s........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..............HHHHHHMMMMss', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '.s........................', '.s........................'],
    ['s.........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '......................s..s', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', 's.........................'],
  ];
  // at the hero art's own grain (4): the one moment the gun out-sizes its ordinary flash
  CROWN.forEach((rows, f) => add(`crown-${f}`, rows, { W: '#ffffff', H: ICE.hot, M: ICE.mid, S: ICE.hot, s: ICE.mid }, 4));
  [[9, ICE.hot], [14, ICE.mid], [19, ICE.deep]].forEach(([r, col], f) => {
    const n = r * 2 + 1, rows = [];
    for (let y = 0; y < n; y++) { let s = ''; for (let x = 0; x < n; x++) { const d = Math.hypot(x - r, y - r); const on = d >= r - 0.5 && d < r + 0.5 && !(f === 2 && (x + y) % 2 === 0); s += on ? 'A' : '.'; } rows.push(s); }
    add(`ring-${f}`, rows, { A: col });
  });
  // the lance: the Super pellet, on the SHIPPED 18x8 canvas (54x24: the hitbox is the texture width)
  add('lance', [
    '..................',
    '.........DDMMMM...',
    '.....DDDMMMMMHHHH.',
    '.DDMMMHHHHWWWWWWWW',
    '.DDMMMHHHHWWWWWWWW',
    '.....DDDMMMMMHHHH.',
    '.........DDMMMM...',
    '..................',
  ], { W: '#ffffff', H: ICE.hot, M: ICE.mid, D: ICE.deep });
  {
    const rows = ['', '', ''];
    for (let x = 0; x < 40; x++) {
      rows[1] += x < 4 && x % 2 === 1 ? '.' : x < 14 ? 'D' : x < 30 ? 'M' : 'H';
      const rim = x >= 26 ? 'D' : '.';
      rows[0] += rim; rows[2] += rim;
    }
    add('wake', rows, { H: ICE.hot, M: ICE.mid, D: ICE.deep });
  }
  tex.refresh();
  return tex;
}

/** The approved P1 rifle as an 18x10 grid of colours (null = clear), read from its texture. */
function readRifle(scene) {
  if (!scene.textures.exists('p1-rifle') || typeof document === 'undefined') return null;
  const src = scene.textures.get('p1-rifle').getSourceImage();
  if (!src || src.width !== 72 || src.height !== 40) return null;
  const cv = document.createElement('canvas'); cv.width = 72; cv.height = 40;
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0);
  const d = c.getImageData(0, 0, 72, 40).data, out = [];
  for (let y = 0; y < 10; y++) {
    out.push([]);
    for (let x = 0; x < 18; x++) { const i = ((y * 4 + 1) * 72 + x * 4 + 1) * 4; out[y].push(d[i + 3] ? `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}` : null); }
  }
  return out;
}

/**
 * The skin `systems/b2Feel.js` draws through when `&b2t=1`. `h`: { muzzleNow, wrap }.
 * b2Feel keeps the round's lifecycle (origin, collider, death, retraction, the tracer
 * invariant); this draws it.
 */
export function createTemperSkin(scene, api, K, h) {
  const tex = buildAtlas(scene);
  const has = (f) => !!tex.frames[f];
  const fx = scene.fx;
  const low = () => isLowQuality();
  const stats = {
    made: 0, peak: 0, rounds: 0, flashes: 0, hits: 0, supers: 0, lances: 0, ignites: 0,
    gun: { n: 0, stage: 0, frame: null, heat: -1, shown: false, hasArt: has('gun-1') },
    cloak: { calls: 0, objects: 0, particles: 0 },
    sync: { checks: 0, bad: 0 }, drawn: { checks: 0, bad: 0 },
    frameSeen: { mz: [0, 0, 0], hit: [0, 0, 0, 0], crown: [0, 0, 0, 0], ring: [0, 0, 0] },
  };
  // ── pool (NORMAL blend only) ────────────────────────────────────────────
  const pool = [];
  let out = 0;
  const img = (frame) => {
    const o = pool.pop() || (stats.made++, scene.add.image(0, 0, TEMPER_KEY, frame));
    o.setFrame(frame).setCrop().setBlendMode(Phaser.BlendModes.NORMAL).setOrigin(0.5).setScale(1).setAlpha(1).setRotation(0).setFlipY(false).clearTint().setVisible(true);
    out++; if (out > stats.peak) stats.peak = out;
    return o;
  };
  const free = (o) => { if (!o) return; o.setVisible(false); pool.push(o); out--; };
  let clock = 0;

  // ── the round ───────────────────────────────────────────────────────────
  const W = TEMPER.boltLen, BH = 5 * G;
  function roundNew(v, rec) {
    stats.rounds++;
    v.k = tipStep(rec.heat);
    v.pal = rec.hot ? 'g' : 'r';
    v.bolt = img(`bolt-${v.pal}${v.k}`).setOrigin(1, 0.5).setVisible(false);
  }
  /** Draw `L` px of the round ending at (hx, hy). Live: the head is at the collider.
   *  Finished: the round keeps travelling INTO its end point, so the part still
   *  outside is the sprite's rear, cropped at both ends. */
  function roundDraw(v, hx, hy, L, live) {
    const o = v.bolt;
    if (!o) return;
    if (L <= 1.5) { o.setVisible(false); return; }
    if (live) {
      o.setCrop(W - L, 0, L, BH).setPosition(hx, hy);
    } else {
      const eaten = Math.max(0, v.tLen - L);                  // px of the head already inside the end point
      o.setCrop(W - v.tLen, 0, L, BH).setPosition(hx + Math.cos(v.ang) * eaten, hy + Math.sin(v.ang) * eaten);
    }
    o.setVisible(true).setRotation(v.ang).setDepth(hy + 3);
    // what the sprite REALLY shows, read back from its own crop and position: it must be
    // exactly the L px that end at (hx, hy)
    const c = o._crop, near = W - c.x - c.width;
    stats.drawn.checks++;
    if (Math.abs(c.width - L) > 0.01 || Math.hypot(o.x - Math.cos(v.ang) * near - hx, o.y - Math.sin(v.ang) * near - hy) > 0.01) stats.drawn.bad++;
  }
  function roundFree(v) { free(v.bolt); v.bolt = null; }

  // ── the muzzle ──────────────────────────────────────────────────────────
  const flashes = [];
  let lastShot = -1e9, lastDir = 0, lastCool = false;
  const spill = scene.add.image(0, 0, TEMPER_KEY, 'spill-w').setDepth(5).setAlpha(0.16).setVisible(false);
  function flashNew(rec, ang) {
    stats.flashes++;
    const st = lampStage(lampCount(rec.heat));
    flashes.push({ t: -1, ang, st, alt: rec.n & 1, img: img(`mz-${st}-${rec.n & 1}`).setOrigin(0, 0.5).setVisible(false) });
    lastShot = clock; lastDir = ang; lastCool = st === 4;
  }
  function updateMuzzle(dt, p) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      // the age starts AFTER the first drawn frame, so frame 0 is never skipped
      f.t = f.t < 0 ? 0 : f.t + dt;
      const m = p?.alive ? h.muzzleNow(p, f.ang) : null;
      const fr = f.t < TEMPER.muzzleMs[0] ? 0 : f.t < TEMPER.muzzleMs[1] ? 1 : f.t < TEMPER.muzzleMs[2] ? 2 : -1;
      if (fr < 0 || !m) { free(f.img); flashes.splice(i, 1); continue; }
      stats.frameSeen.mz[fr]++;
      f.img.setFrame(`mz-${f.st}-${fr === 0 ? f.alt : fr + 1}`).setPosition(m.x, m.y).setRotation(m.rot).setDepth((m.depth ?? p.depth) + 0.3).setAlpha(m.alpha ?? 1).setVisible(true);
    }
    const since = clock - lastShot;
    if (low() || !p?.alive || since > 56) { spill.setVisible(false); return; }
    spill.setFrame(lastCool ? 'spill-c' : 'spill-w').setAlpha(since < 28 ? 0.16 : 0.08).setVisible(true)
      .setPosition(Math.round(p.x + Math.cos(lastDir) * 58), Math.round(p.y + Math.sin(lastDir) * 58 + 14));
  }

  // ── the contact ─────────────────────────────────────────────────────────
  const hits = [];
  let curPal = 'w';
  function hitNew(x, y, ang, big, depth, pal) {
    stats.hits++;
    hits.push({ t: -1, x, y, depth, key: `hit-${pal || curPal}${big ? 'b' : 's'}`, img: img(`hit-${pal || curPal}${big ? 'b' : 's'}-0`).setRotation(ang).setVisible(false) });
  }
  function updateHits(dt) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const s = hits[i];
      s.t = s.t < 0 ? 0 : s.t + dt;
      const M = TEMPER.hitMs;
      const fr = s.t < M[0] ? 0 : s.t < M[1] ? 1 : s.t < M[2] ? 2 : s.t < M[3] ? 3 : -1;
      if (fr < 0) { free(s.img); hits.splice(i, 1); continue; }
      stats.frameSeen.hit[fr]++;
      s.img.setFrame(`${s.key}-${fr}`).setPosition(s.x, s.y).setDepth(s.depth).setVisible(true);
    }
  }
  /** The palette of the round resolving a contact: cool once its tip is past the middle. */
  function setContactRound(v, k = 0) { curPal = v ? (v.pal === 'g' ? 'g' : v.k >= 5 ? 'c' : 'w') : (k >= 5 ? 'c' : 'w'); }

  // ── the gun ─────────────────────────────────────────────────────────────
  const gun = scene.add.image(0, 0, TEMPER_KEY, has('gun-1') ? 'gun-1' : 'bolt-r0').setVisible(false);
  const heat = scene.add.image(0, 0, TEMPER_KEY, has('heat-0') ? 'heat-0' : 'bolt-r0').setVisible(false);
  let lastN = 0, igniteUntil = -1e9, windupAt = -1e9, blastAt = -1e9, readyAt = -1e9;
  const view = () => scene._p2a?.loadout?.view || null;
  function gunFrame() {
    const sinceW = clock - windupAt;
    if (sinceW >= 0 && sinceW < TEMPER.windupMs[1] && blastAt < windupAt) return sinceW < TEMPER.windupMs[0] ? 'gun-w0' : 'gun-w1';
    const n = lampCount(api.charge01());
    if (n > lastN && n < 10) { igniteUntil = clock + TEMPER.igniteMs; stats.ignites++; }
    if (n === 10 && lastN < 10) readyAt = clock;
    lastN = n;
    stats.gun.n = n; stats.gun.stage = lampStage(n);
    if (n <= 0) return null;
    // each round draws on the charge: the head lamp flares with the shot (FULL: the muzzle end)
    const shot = clock - lastShot < TEMPER.muzzleMs[0];
    if (n < 10) return clock < igniteUntil || shot ? `gun-${n}i` : `gun-${n}`;
    if (shot) return 'gun-10p3';
    const ph = (clock - readyAt) % TEMPER.pulseMs;
    const step = Math.floor(ph / TEMPER.pulseStepMs);
    return step < 4 ? `gun-10p${step}` : 'gun-10';
  }
  function heatFrame() {
    const t = clock - blastAt;
    if (t < 0) return null;
    const M = TEMPER.heatMs;
    const i = t < M[0] ? 0 : t < M[1] ? 1 : t < M[2] ? 2 : t < M[3] ? 3 : -1;
    return i < 0 ? null : `heat-${i}`;
  }
  const sameAs = (o, v) => o.x === v.x && o.y === v.y && o.rotation === v.rotation && o.flipY === v.flipY && o.alpha === v.alpha && o.originX === v.originX && o.originY === v.originY;
  function follow(o, v, frame, dz) {
    o.setFrame(frame).setOrigin(v.originX, v.originY).setPosition(v.x, v.y).setRotation(v.rotation).setFlipY(v.flipY).setAlpha(v.alpha).setDepth(v.depth + dz).setVisible(true);
  }
  function updateGun(p) {
    const v = view();
    const gf = stats.gun.hasArt ? gunFrame() : null, hf = stats.gun.hasArt ? heatFrame() : null;
    const held = !!v && v.visible && v.alpha > 0 && /^p1-rifle/.test(v.texture?.key || '') && !!p?.alive;
    stats.gun.frame = held ? gf : null; stats.gun.heat = held && hf ? +hf.slice(5) : -1; stats.gun.shown = held && !!gf;
    if (held && gf) follow(gun, v, gf, 0.01); else gun.setVisible(false);
    if (held && hf) follow(heat, v, hf, 0.02); else heat.setVisible(false);
  }
  // the overlay must sit exactly on the weapon the frame that is rendered
  const onPrerender = () => {
    const v = view();
    for (const o of [gun, heat]) { if (!o.visible || !v) continue; stats.sync.checks++; if (!sameAs(o, v)) stats.sync.bad++; }
  };
  scene.game.events.on('prerender', onPrerender);

  // ── the Super ───────────────────────────────────────────────────────────
  // CLOAK: run shipped presentation code unchanged (so it draws `Math.random` exactly as it
  // always did) and hide what it creates: display objects are made invisible, particles it
  // emitted are moved off the world. Nothing is removed and no lifetime changes.
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
  const crowns = [];
  const lances = [];
  const dim = scene.add.rectangle(0, 0, 4, 4, 0x04050a, 1).setOrigin(0).setScrollFactor(0).setDepth(7990).setVisible(false);
  let dimAt = -1e9;
  h.wrap(scene, 'firePlayerSuper', (prev) => function (...a) {
    // the shipped wind-up ring (an inline Graphics and its tween): it still runs, unseen
    return cloak(() => prev.apply(this, a));
  });
  h.wrap(scene, '_superBlast', (prev) => function (angle, ...r) {
    const cam = this.cameras.main;
    const hadF = Object.prototype.hasOwnProperty.call(cam, 'flash'), prevF = cam.flash;
    cam.flash = function () { return this; };           // no screen tint: the dim below is the beat
    blast.on = true;
    try { return prev.call(this, angle, ...r); } finally {
      blast.on = false;
      if (hadF) cam.flash = prevF; else delete cam.flash;
    }
  });
  h.wrap(fx, 'superMuzzleFlash', (prev) => function (x, y, angle, ...r) {
    blast.x = x; blast.y = y; blast.ang = angle; blast.at = clock; blast.casings = 0; blast.pops = 0;
    emitters = null;                                    // a fresh list of the scene's emitters per blast
    return cloak(() => prev.call(this, x, y, angle, ...r));
  });
  // its second pop, 45ms later, and the three casings (one now, two delayed): matched exactly
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
  // the pellets' smoke and dot trail: the lance has its own wake
  const isLance = (x, y) => { for (const L of lances) if (L.b.active && L.b._gen === L.gen && L.b.x === x && L.b.y === y) return true; return false; };
  h.wrap(fx, 'smokeTrail', (prev) => function (x, y, ...r) { return isLance(x, y) ? cloak(() => prev.call(this, x, y, ...r)) : prev.call(this, x, y, ...r); });
  h.wrap(fx, 'trail', (prev) => function (x, y, ...r) { return isLance(x, y) ? cloak(() => prev.call(this, x, y, ...r)) : prev.call(this, x, y, ...r); });

  const onBlast = () => {
    stats.supers++;
    blastAt = clock;
    crowns.push({ t: -1, ang: blast.ang, crown: img('crown-0').setOrigin(2.5 / 26, 0.5).setVisible(false), ring: img('ring-0').setVisible(false) });
    if (!low()) dimAt = clock;
    const g = scene.playerSuperBullets;
    for (const b of g?.getChildren?.() || []) {
      if (!b.active || b.texture?.key !== g.texture) continue;
      const w0 = b.body?.width, r0 = b.body?.radius;
      b.setTexture(TEMPER_KEY, 'lance');
      b.setScale(b.scaleX, 1);                       // square pixels; X (the hitbox) untouched
      stats.lances++;
      if (b.body && (b.body.width !== w0 || b.body.radius !== r0)) stats.hitboxChanged = (stats.hitboxChanged || 0) + 1;
      lances.push({ b, gen: b._gen, ox: b.x, oy: b.y, ang: Math.atan2(b.body.velocity.y, b.body.velocity.x), wake: img('wake').setOrigin(1, 0.5).setVisible(false) });
    }
  };
  scene.events.on('player-super-blast', onBlast);
  // a pooled pellet keeps the texture it was given: hand the shipped one back when it is reused
  const restorePellets = () => { const g = scene.playerSuperBullets; for (const b of g?.getChildren?.() || []) if (b.texture?.key === TEMPER_KEY) { b.setTexture(g.texture); } };

  function updateSuper(dt, p) {
    for (let i = crowns.length - 1; i >= 0; i--) {
      const c = crowns[i];
      c.t = c.t < 0 ? 0 : c.t + dt;
      const m = p?.alive ? h.muzzleNow(p, c.ang) : null;
      const M = TEMPER.crownMs;
      const fr = c.t < M[0] ? 0 : c.t < M[1] ? 1 : c.t < M[2] ? 2 : c.t < M[3] ? 3 : -1;
      if (fr < 0 || !m) { free(c.crown); free(c.ring); crowns.splice(i, 1); continue; }
      stats.frameSeen.crown[fr]++;
      c.crown.setFrame(`crown-${fr}`).setOrigin(2.5 / 26, 0.5).setPosition(m.x, m.y).setRotation(m.rot).setDepth(8010).setVisible(true);
      const rf = TEMPER.ringMs.findIndex(([a, b]) => c.t >= a && c.t < b);
      if (rf < 0) c.ring.setVisible(false);
      else { stats.frameSeen.ring[rf]++; c.ring.setFrame(`ring-${rf}`).setOrigin(0.5).setPosition(m.x + Math.cos(m.rot) * 14, m.y + Math.sin(m.rot) * 14).setDepth(8009).setVisible(true); }
    }
    for (let i = lances.length - 1; i >= 0; i--) {
      const L = lances[i], b = L.b;
      if (!b.active || b._gen !== L.gen) { free(L.wake); lances.splice(i, 1); continue; }
      const cx = Math.cos(L.ang), cy = Math.sin(L.ang);
      const along = (b.x - L.ox) * cx + (b.y - L.oy) * cy - 24;        // behind the pellet's tail, never behind the barrel
      const len = Math.min(TEMPER.wakeLen, along);
      if (len <= 2) { L.wake.setVisible(false); continue; }
      L.wake.setCrop(TEMPER.wakeLen - len, 0, len, 3 * G).setPosition(b.x - cx * 24, b.y - cy * 24).setRotation(L.ang).setDepth(b.depth - 0.1).setVisible(true);
    }
    const dt2 = clock - dimAt;
    if (dt2 >= 0 && dt2 < TEMPER.dimMs[1]) {
      const cam = scene.cameras.main;
      dim.setSize(cam.width, cam.height).setPosition(0, 0).setAlpha(dt2 < TEMPER.dimMs[0] ? TEMPER.dimAlpha[0] : TEMPER.dimAlpha[1]).setVisible(true);
    } else dim.setVisible(false);
  }

  return {
    stats, boltLen: W,
    roundNew, roundDraw, roundFree, flashNew, hitNew, setContactRound,
    numberColor(killed, k) { return killed ? (k >= 5 ? '#b9c4ff' : '#ff8a6a') : '#ffe9e0'; },
    onSuper() { windupAt = clock; },
    update(dt, clk, p) {
      clock = clk;
      updateHits(dt);
      updateMuzzle(dt, p);
      updateGun(p);
      updateSuper(dt, p);
    },
    destroy() {
      scene.game.events.off('prerender', onPrerender);
      scene.events.off('player-super-blast', onBlast);
      try { restorePellets(); } catch (_) { /* scene going down */ }
      for (const o of [gun, heat, spill, dim, ...pool]) { try { o?.destroy(); } catch (_) { /* */ } }
      for (const f of flashes) { try { f.img.destroy(); } catch (_) { /* */ } }
      for (const s of hits) { try { s.img.destroy(); } catch (_) { /* */ } }
      for (const c of crowns) { try { c.crown.destroy(); c.ring.destroy(); } catch (_) { /* */ } }
      for (const L of lances) { try { L.wake.destroy(); } catch (_) { /* */ } }
      pool.length = 0; flashes.length = 0; hits.length = 0; crowns.length = 0; lances.length = 0;
    },
  };
}
