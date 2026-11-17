// B2-R2 — the second atlas REACTOR draws from with `&b2r=2` (systems/b2Reactor.js).
// REACTOR's own atlas (the approved gun, threads and colours) is unchanged; this
// one holds what B2-R2 adds or replaces: the short-tailed slug and its glow, the
// STREAM RIBBON that links successive rounds, range-expiry dissipation, wall
// sparks, armour arcs, the shield plates, and the dense Super mass with its
// glow, wake and burn-through.
//
// All painted once, no `Math.random`.
export const R2_KEY = 'b2r2';
const G = 3, GG = 4;
// per stage 0..4 (violet .. critical red) and gold, the REACTOR stream palette
export const R2_PAL = [
  { core: '#f6eaff', body: '#a968ff', rim: '#5a2ec4', trail: '#7b45e6', glow: [138, 80, 255] },
  { core: '#ffe6f8', body: '#e254dc', rim: '#8c22a0', trail: '#a968ff', glow: [226, 84, 220] },
  { core: '#ffe4e6', body: '#ff3f72', rim: '#a8143f', trail: '#e254dc', glow: [255, 63, 114] },
  { core: '#fff0dc', body: '#ff3526', rim: '#9c1018', trail: '#ff3f72', glow: [255, 53, 38] },
  { core: '#fff3b8', body: '#ff2a14', rim: '#6e0a12', trail: '#d81e30', glow: [255, 42, 20] },
];
export const R2_GOLD = { core: '#fff8e8', body: '#ffb020', rim: '#b05a10', trail: '#e08a18', glow: [255, 176, 32] };
const RUBY = '#6e0a12', CRIM = '#d81e30', SCAR = '#ff2a14', HOT = '#ffb070', WH = '#fff3b8', INK = '#2a0306';
/** Art px of the slug (20 px body + a 6 px tapering tail). */
export const R2_SLUG = 26;
/** Art px of a ribbon texture (cropped to the link's length). */
export const R2_RIB = 72;

export function buildR2Atlas(scene) {
  if (scene.textures.exists(R2_KEY)) return scene.textures.get(R2_KEY);
  const W = 1024, H = 1024;
  const tex = scene.textures.createCanvas(R2_KEY, W, H), ctx = tex.getContext();
  let cx = 1, cy = 1, rowH = 0;
  const grid = (name, gr, g = G) => {
    const h = gr.length, w = gr[0].length;
    if (cx + w * g + 2 > W) { cx = 1; cy += rowH + 2; rowH = 0; }
    if (cy + h * g + 1 > H) throw new Error(`b2R2Art: atlas full at "${name}"`);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = gr[y][x]; if (c) { ctx.fillStyle = c; ctx.fillRect(cx + x * g, cy + y * g, g, g); } }
    tex.add(name, 0, cx, cy, w * g, h * g);
    cx += w * g + 2; rowH = Math.max(rowH, h * g);
  };
  const rows = (name, strs, pal, g = G) => grid(name, strs.map((s) => [...s].map((ch) => pal[ch] || null)), g);
  const blank = (w, h) => Array.from({ length: h }, () => new Array(w).fill(null));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  const ALL = [...R2_PAL.map((P, s) => [String(s), P]), ['g', R2_GOLD]];

  for (const [s, P] of ALL) {
    // ── the slug: body + a tail that thins and dithers out (no hard rear edge) ──
    const sl = blank(R2_SLUG, 5), T = R2_SLUG - 20;
    for (let x = 0; x < R2_SLUG; x++) {
      if (x < T) {                                     // tail: 1 row, broken toward its end
        if (x >= 2 || x === 0) sl[2][x] = x < 3 ? P.rim : P.trail;
        if (x >= T - 2) { sl[1][x] = P.rim; sl[3][x] = P.rim; }
        continue;
      }
      const u = x - T;
      sl[2][x] = u < 3 ? P.trail : u < 9 ? P.body : u < 16 ? P.core : '#ffffff';
      if (u <= 18) { const c = u < 4 ? P.rim : u < 15 ? P.body : P.core; sl[1][x] = c; sl[3][x] = c; }
      if (u >= 6 && u <= 16) { const c = u < 13 ? P.rim : P.body; sl[0][x] = c; sl[4][x] = c; }
    }
    grid(`slug-${s}`, sl);
    // its glow: stepped, brightest toward the head, no ball
    const gl = [];
    for (let y = 0; y < 11; y++) {
      const d = Math.abs(y - 5), row = [];
      for (let x = 0; x < R2_SLUG; x++) {
        const t = x / (R2_SLUG - 1), along = t < 0.25 ? 0.35 : t < 0.6 ? 0.7 : 1;
        const across = d <= 1 ? 0 : d === 2 ? 0.6 : d === 3 ? 0.44 : d === 4 ? 0.26 : 0.12;
        const a = across * along;
        row.push(a > 0.01 ? rgba(P.glow, a) : null);
      }
      gl.push(row);
    }
    grid(`sglow-${s}`, gl);
    // ── the ribbon: the stream between two rounds. Uniform along its length (it is cropped,
    //    never scaled), its far end (x = 0, the older round) thins over 6 px ──
    // one bright centre row (the glow below carries the width); both ends thin out, so a link
    // never shows a hard edge where it meets a round or the barrel
    // a body-coloured centre with dithered rims: three rows wide but soft, so a bent stream
    // stays a stream and never a zig-zag of hard bars
    const rb = blank(R2_RIB, 3);
    for (let x = 0; x < R2_RIB; x++) {
      const far = x < 6;
      if (!far || x % 2 === 0) rb[1][x] = x < 3 ? P.rim : x < 10 ? P.trail : P.body;
      if (x >= 6 && x % 2 === 0) { rb[0][x] = P.rim; rb[2][x] = P.rim; }
    }
    grid(`rib-${s}`, rb);
    const rg = [];
    for (let y = 0; y < 9; y++) {
      const d = Math.abs(y - 4), row = [];
      for (let x = 0; x < R2_RIB; x++) {
        const fade = x < 8 ? 0.4 + 0.075 * x : 1;
        const across = d === 0 ? 0 : d === 1 ? 0.5 : d === 2 ? 0.4 : d === 3 ? 0.24 : 0.11;
        const a = across * fade;
        row.push(a > 0.01 ? rgba(P.glow, a) : null);
      }
      rg.push(row);
    }
    grid(`rglow-${s}`, rg);
    // ── range expiry: the core contracts, three remnants run on and go out ──
    //  (11x7, +x = the flight; origin at the left centre = the end point)
    const DIS = [
      ['...........', '...........', '..MHH......', '.MHWWH.....', '..MHH......', '...........', '...........'],
      ['...........', '.....M.....', '...........', '...H...M...', '...........', '......M....', '...........'],
      ['.......D...', '...........', '...........', '......M...D', '...........', '...........', '........D..'],
      ['...........', '..........D', '...........', '...........', '...........', '.........D.', '...........'],
    ];
    const DIS2 = [
      DIS[0],
      ['...........', '......M....', '...........', '...H....M..', '...........', '....M......', '...........'],
      ['........D..', '...........', '...........', '.......M..D', '...........', '......D....', '...........'],
      ['...........', '...........', '..........D', '...........', '........D..', '...........', '...........'],
    ];
    const pal = { W: '#ffffff', H: P.core, M: P.body, D: P.rim };
    DIS.forEach((r, f) => rows(`dis-${s}-0-${f}`, r, pal));
    DIS2.forEach((r, f) => rows(`dis-${s}-1-${f}`, r, pal));
    // ── a wall: a flat flare across the surface and two sparks thrown back ──
    const WALL = [
      ['...H.....', '...HM....', '..HWM....', '..HWWM...', '..HWM....', '...HM....', '...H.....'],
      ['.M.......', '...M.....', '.........', '...H.....', '.........', '...M.....', '.M.......'],
      ['D........', '.........', '.........', '..D......', '.........', '.........', 'D........'],
    ];
    WALL.forEach((r, f) => rows(`wall-${s}-${f}`, r, pal));
  }

  // ── armour arcs (critical charge): jagged 2-3 px lightning, three frames each, two shapes ──
  const ARC = [
    [['.....', 'H....', '.HS..', '...HS', '.....'], ['.....', 'S....', '.SH..', '..S.H', '.....'], ['.....', '.....', '.C...', '...C.', '.....']],
    [['..H..', '..S..', '.H...', '..HS.', '....H'], ['..S..', '.....', '.S...', '..S..', '....S'], ['.....', '.....', '.C...', '.....', '...C.']],
  ];
  ARC.forEach((frames, k) => frames.forEach((r, f) => rows(`arc-${k}-${f}`, r, { H: '#ffd9a0', S: SCAR, C: CRIM }, G)));
  // ── shield plates: one L-bracket (the four corners are this, rotated) and its hit flash ──
  rows('plate', ['CCCC', 'CL..', 'C...', 'C...'], { C: '#7ff0ff', L: '#d8fbff' }, G);
  rows('plate-dim', ['CCCC', 'C...', 'C...', 'C...'], { C: '#2a8aa0' }, G);
  rows('plate-hit', ['WWWW', 'WC..', 'W...', 'W...'], { W: '#ffffff', C: '#7ff0ff' }, G);
  rows('plate-off', ['C.C.', '....', 'C...', '....'], { C: '#2a8aa0' }, G);

  // ── the Super mass: a stepped, compressed block; white-hot only on its leading faces,
  //    crimson flanks, ruby shading on the lower side, an ink outline ──
  const MP = { K: INK, R: RUBY, C: CRIM, S: SCAR, H: HOT, W: WH, Z: '#ffffff' };
  rows('mass2-0', [
    '.....KKKKKKKKK........',
    '...KKCCCCCSSSSKK......',
    '..KCCCSSSSSSSSHHKK....',
    '.KCCSSSSSSSSSHHWWWKK..',
    'KCCSSSSSSSSSSHWWZZWWK.',
    'KCSSSSSSSSSSHHWZZZZWWK',
    'KCSSSSSSSSSSHWWZZZZWWK',
    'KRCSSSSSSSSHHWWZZZWWK.',
    '.KRCCSSSSSSHHWWWWKK...',
    '..KRRCCCSSSSHHKK......',
    '...KKRRRRCCCKK........',
    '.....KKKKKKKK.........',
  ], MP, GG);
  rows('mass2-1', [
    '......KKKKKKKK........',
    '...KKKCCCCSSSSKK......',
    '..KCCCSSSSSSSSHHKK....',
    '.KCCSSSSSSSSSHHHWWKK..',
    'KCCSSSSSSSSSSHWWZZWWK.',
    'KCSSSSSSSSSSHWWZZZZWWK',
    'KCSSSSSSSSSSHHWZZZZWWK',
    'KRCSSSSSSSSSHWWZZZWWK.',
    '.KRCCSSSSSSHHHWWWKK...',
    '..KRRCCCCSSSHHKK......',
    '...KKRRRRRCCKK........',
    '......KKKKKKK.........',
  ], MP, GG);
  {
    const gr = [];
    for (let y = 0; y < 18; y++) { const row = []; for (let x = 0; x < 28; x++) { const r = Math.hypot((x - 15) / 14, (y - 8.5) / 9); row.push(r <= 0.7 ? rgba([255, 42, 20], 0.2) : r <= 1 ? rgba([216, 30, 48], 0.1) : null); } gr.push(row); }
    grid('mglow', gr, GG);
  }
  // the wake: dense, short, stepping down behind the mass (x = 0 is its far end)
  rows('wake2', [
    '..........KKKK',
    '.....RRRRCCCCC',
    '..RRRCCCCSSSSS',
    'R.RCCCSSSSSSHH',
    'R.RCCCSSSSSSHH',
    '..RRRCCCCSSSSS',
    '.....RRRRCCCCC',
    '..........KKKK',
  ], MP, GG);
  // the burn-through on a target: a white-hot slab across the flight, then crimson shards
  // thrown out the far side, then embers (+x = the flight; origin at the slab)
  rows('burn-0', ['..KS......', '.KSHS.....', 'KSHWHS....', 'KSHWWHS...', 'KSHWWZHS..', 'KSHWWHS...', 'KSHWHS....', '.KSHS.....', '..KS......'], MP, GG);
  rows('burn-1', ['......S...', '...H...C..', '..........', '.....HS..S', '..SHWZHS.C', '.....HS..S', '..........', '...H...C..', '......S...'], MP, GG);
  rows('burn-2', ['........C.', '..........', '......S...', '.........C', '....H.S...', '.........C', '......S...', '..........', '........C.'], MP, GG);
  rows('burn-3', ['..........', '.........R', '..........', '..........', '.......C.R', '..........', '..........', '.........R', '..........'], MP, GG);
  tex.refresh();
  return tex;
}
