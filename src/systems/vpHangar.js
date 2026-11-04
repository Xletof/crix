// VISUAL IDENTITY V2 — the Hangar look-development pass (`?visualPilot=v2`).
//
// OPT-IN, PRESENTATION ONLY, ONE ROOM. `GameScene.loadRoom` calls this instead
// of `paintBackdrop` for the Hangar when the flag is on, and only then. It is
// paint on the backdrop canvas: no body, no nav cell, no LOS rect, no light
// source, nothing in `roomLayer` that was not already there. Room geometry,
// cover, spawns, the emissive layer and the LIGHTS OUT state are untouched —
// the backdrop still takes the `floor` tint in a blackout, so everything here
// goes out with the ambient, which is what overhead light and painted wear do.
//
// THE RNG CONTRACT. `paintBackdrop` draws from `Math.random` (its panel and
// scorch scatter), and the gameplay stream is shared with AI cooldowns. The
// pilot paints the backdrop with IDENTICAL options except two: `hexAlpha`
// (no draws) and `scorch: 0`. The scorch loop is paintBackdrop's LAST
// consumer and takes exactly three draws per mark, unconditionally, so the
// pilot then burns `scorch * 3` draws itself — the stream leaves this function
// in exactly the state it would have left paintBackdrop. Everything the pass
// adds is placed by its own seeded generator, never `Math.random`.
// `tests/smoke-visual-pilot.mjs` checks the draw count and the next value.
//
// WHAT THE PASS IS FOR — the brief's hierarchy, bottom up:
//   1. A QUIET BUT TEXTURED GROUND. The 50 random black discs are gone (they
//      read as holes, and they landed in the calm centre as often as not);
//      the hex tiling drops to a whisper. In their place, a deck that is BUILT:
//      running-bond plates with recessed seams (dark groove, lit south / east
//      lip — the north-west sun every sprite uses), a little value variation
//      plate to plate, and wear where work happens — polish and tyre marks
//      down the deployment lane, drag scuffs at the freight, oil under the
//      machines, chipped deck paint. Low contrast throughout: texture you see
//      when the frame is paused and do not see in motion.
//   2. CONVINCING MASS. Every cover object and machine gets a cast shadow:
//      its OWN silhouette, offset to the south-east by a distance that says
//      how tall it is, plus a hard contact line under its foot. The shuttle's
//      wings and the gantry beam throw shadows on the deck, which is the
//      cheapest way there is to say "this stands up".
//   3/4. ACTORS AND THREATS are not painted here at all. The floor's job is to
//      be darker at the edges and slightly lit in the middle, so whatever
//      stands in the fight is the brightest, crispest thing in it.
//
// Rules kept: no red (wear is brown-black, paint is the room's own amber), no
// small green points, no tall solid mass (shadows and stains only), shapes on
// horizontals, verticals and 45-degree cuts.

import { paintBackdrop } from './pixelArt.js';

// The Hangar's V2 cover / prop art, by the texture key the room spec names.
// Same canvas sizes as the originals (so a static body sized from the sprite
// is the same body); consoles and drums are the originals with the material
// pass (`paintMaterialPass`), every source pixel where it was. The wall panel
// (`ch-con-wall`) is not here: it is mounted on the wall, not standing on the
// deck, and an outline would stand it up.
export const HANGAR_PILOT_TEX = Object.freeze({
  'ch-crate-a': 'vp-crate-a',
  'ch-crate-b': 'vp-crate-b',
  'ch-con-ped-c': 'vp-con-ped-c',
  'ch-con-heavy': 'vp-con-heavy',
  'prop-drum': 'vp-drum',
  'prop-drum-b': 'vp-drum-b',
});
const pilotKey = (scene, k) => (HANGAR_PILOT_TEX[k] && scene.textures.exists(HANGAR_PILOT_TEX[k]) ? HANGAR_PILOT_TEX[k] : k);

// A small seeded generator (mulberry32). The pass's only randomness.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const q4 = (v) => Math.round(v / 4) * 4;

/**
 * The Hangar backdrop with the V2 material pass. Same signature as
 * `paintBackdrop` plus the room spec (for its cover, props and floor forms).
 */
export function paintPilotHangarBackdrop(scene, key, worldW, worldH, opts, spec) {
  const scorch = opts.scorch ?? 40;                       // paintBackdrop's default
  paintBackdrop(scene, key, worldW, worldH, { ...opts, scorch: 0, hexAlpha: (opts.hexAlpha ?? 1) * 0.45 });
  for (let i = 0; i < scorch * 3; i++) Math.random();     // the scorch loop's draws, exactly
  const tex = scene.textures.get(key);
  const ctx = tex.getContext();
  materialPass(scene, ctx, worldW, worldH, spec, opts.openings || []);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
}

function materialPass(scene, ctx, W, H, spec, openings) {
  const R = rng(0x5eed2604);
  const T = spec.perimeter?.thickness ?? 0;
  // The runs of a wall's inner edge between its doorways: [from, to] along the side.
  const runs = (side) => {
    const len = side === 'top' || side === 'bottom' ? W : H;
    let segs = [[T - 4, len - T + 4]];
    for (const o of openings.filter((op) => op.side === side)) {
      const a = o.at - o.width / 2, b = o.at + o.width / 2;
      segs = segs.flatMap(([s0, s1]) => (b <= s0 || a >= s1 ? [[s0, s1]] : [[s0, a], [b, s1]].filter(([u, v]) => v - u > 4)));
    }
    return segs;
  };
  // A strip `t` deep along `side`, `d` in from the band's inner edge, on each run.
  const edgeStrip = (side, d, t) => {
    for (const [a, b] of runs(side)) {
      if (side === 'top') ctx.fillRect(a, T + d, b - a, t);
      else if (side === 'bottom') ctx.fillRect(a, H - T - d - t, b - a, t);
      else if (side === 'left') ctx.fillRect(T + d, a, t, b - a);
      else ctx.fillRect(W - T - d - t, a, t, b - a);
    }
  };
  const arch = spec.floor?.architecture || [];
  const rectOf = (it) => {
    if (it.kind === 'track') {
      const v = (it.dir ?? 'h') === 'v';
      return [it.x, it.y, v ? (it.t ?? 46) : it.len, v ? it.len : (it.t ?? 46)];
    }
    return [it.x, it.y, it.w, it.h];
  };
  const solidForms = arch.filter((it) => ['track', 'plate', 'inset', 'doorframe', 'hatch', 'vent'].includes(it.kind));

  // THE OPEN DECK: inside the wall band, minus every built floor form. Drawn
  // on a scratch layer that then has the band and each form punched out of it
  // (`destination-out`), so overlapping forms are a union, never a parity
  // flip, and composited once.
  const onDeck = (draw) => {
    const layer = document.createElement('canvas');
    layer.width = W; layer.height = H;
    const lc = layer.getContext('2d');
    draw(lc);
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'destination-out';
    lc.fillStyle = '#000';
    lc.fillRect(0, 0, W, T); lc.fillRect(0, H - T, W, T); lc.fillRect(0, 0, T, H); lc.fillRect(W - T, 0, T, H);
    for (const it of solidForms) { const [x, y, w, h] = rectOf(it); lc.fillRect(x - 2, y - 2, w + 4, h + 4); }
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, 0, 0);
  };
  const interior = () => { ctx.beginPath(); ctx.rect(T, T, W - 2 * T, H - 2 * T); ctx.clip(); };

  // ── 1. DECK PLATES — running bond on the room's own tiling module ────────
  const PW = spec.floor?.hexW ?? 160, PH = spec.floor?.hexH ?? 140;
  onDeck((ctx) => {
    for (let row = 0, y = T; y < H - T; row++, y += PH) {
      const off = (row % 2) ? PW / 2 : 0;
      for (let x = T - off; x < W - T; x += PW) {
        // value variation, plate to plate: a few RGB steps, never more
        const v = (R() - 0.5) * 0.07;
        ctx.globalAlpha = Math.abs(v);
        ctx.fillStyle = v > 0 ? '#9aa4b0' : '#000000';
        ctx.fillRect(x + 2, y + 2, PW - 2, PH - 2);
        // the groove: dark, then the lit lip on its south / east wall
        ctx.globalAlpha = 0.42; ctx.fillStyle = '#050607';
        ctx.fillRect(x, y, PW, 2); ctx.fillRect(x, y, 2, PH);
        ctx.globalAlpha = 0.11; ctx.fillStyle = '#8c95a2';
        ctx.fillRect(x, y + 2, PW, 1); ctx.fillRect(x + 2, y, 1, PH);
        // two fasteners, NW and SE, low contrast
        for (const [bx, by] of [[x + 8, y + 8], [x + PW - 12, y + PH - 12]]) {
          ctx.globalAlpha = 0.30; ctx.fillStyle = '#050607'; ctx.fillRect(bx, by, 4, 4);
          ctx.globalAlpha = 0.16; ctx.fillStyle = '#a7b0bc'; ctx.fillRect(bx, by, 2, 2);
        }
      }
    }
  });

  // ── 2. LIGHT: dark edges, a lit floor where the work is ──────────────────
  // Overhead pools on the deck the fight crosses — soft, wide and faint: the
  // centre of the frame lifts a few steps and the corners recede, so actors
  // standing in the middle are the highest-contrast thing in it.
  ctx.save();
  interior();
  const pools = [
    [800, 690, 480, 0.10], [430, 330, 300, 0.065], [1080, 1120, 300, 0.06], [1180, 330, 260, 0.055],
  ];
  for (const [cx, cy, r, a] of pools) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(176,196,214,${a})`);
    g.addColorStop(0.55, `rgba(176,196,214,${a * 0.45})`);
    g.addColorStop(1, 'rgba(176,196,214,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Wall-foot occlusion: the deck darkens into the walls in hard 4px steps,
  // and not across a doorway — the floor runs on through those.
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = 0.38 * (1 - i / 18) ** 1.5; ctx.fillStyle = '#000000';
    for (const side of ['top', 'bottom', 'left', 'right']) edgeStrip(side, i * 4, 4);
  }
  ctx.restore();

  // The wall's coping: the top edge of the band catches the light along its
  // inner lip, so the wall reads as standing above the deck it shadows.
  if (T > 0) {
    ctx.save();
    ctx.fillStyle = '#a9b4c2';
    for (const [side, a] of [['top', 0.20], ['left', 0.20], ['right', 0.12], ['bottom', 0.12]]) { ctx.globalAlpha = a; edgeStrip(side, -4, 2); }
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#050607';            // the dark line where wall meets deck
    for (const side of ['top', 'bottom', 'left', 'right']) edgeStrip(side, -2, 2);
    ctx.restore();
  }

  // ── 3. WEAR — where work happens, and nowhere else ───────────────────────
  onDeck((ctx) => {
    // Polish down the deployment lane: pale streaks along the room's long axis,
    // clustered on the line the traffic actually takes.
    const lane = arch.find((it) => it.kind === 'region' && it.w > 1000) || { x: T, y: H / 2 - 120, w: W - 2 * T, h: 240 };
    for (let i = 0; i < 70; i++) {
      const t = (R() + R() + R()) / 3;
      const y = q4(lane.y + 12 + t * (lane.h - 24));
      const x = q4(lane.x + R() * lane.w);
      const len = q4(24 + R() * 170);
      ctx.globalAlpha = 0.035 + R() * 0.05; ctx.fillStyle = '#c3cbd6';
      ctx.fillRect(x, y, len, 2);
    }
    // Tyre marks: paired dark runs, parallel to the lane.
    for (let i = 0; i < 9; i++) {
      const y = q4(lane.y + 40 + R() * (lane.h - 90));
      const x = q4(lane.x + 40 + R() * (lane.w - 360));
      const len = q4(90 + R() * 220), gap = 20 + q4(R() * 8);
      ctx.globalAlpha = 0.10 + R() * 0.06; ctx.fillStyle = '#000000';
      for (const dy of [0, gap]) {
        for (let s = 0; s < len; s += 36) ctx.fillRect(x + s, y + dy, Math.min(28, len - s), 3);
      }
    }
    // Drag scuffs at the freight: short 45-degree scratches off each crate's
    // corners — the marks a module leaves when it is pushed into place.
    for (const cp of spec.cover || []) {
      if (!/crate/.test(cp.tex || '')) continue;
      for (let i = 0; i < 9; i++) {
        const side = R() < 0.5 ? -1 : 1;
        const x0 = q4(cp.x + side * (40 + R() * 30)), y0 = q4(cp.y + 30 + R() * 40);
        const n = 2 + Math.floor(R() * 4);
        ctx.globalAlpha = 0.07 + R() * 0.06; ctx.fillStyle = '#cdd3da';
        for (let k = 0; k < n; k++) ctx.fillRect(x0 + k * 2 * side, y0 + k * 2, 2, 2);
      }
    }
    // Oil: irregular stains under the machines and beside the freight, built on
    // the 4px grain by a short random walk. Brown-black — never green, never red.
    const stainAt = (cx, cy, cells) => {
      let x = q4(cx), y = q4(cy);
      for (let k = 0; k < cells; k++) {
        ctx.globalAlpha = 0.16 + R() * 0.12; ctx.fillStyle = '#0c0a07';
        ctx.fillRect(x, y, 8, 4);
        const d = Math.floor(R() * 4);
        x += d === 0 ? 4 : d === 1 ? -4 : 0; y += d === 2 ? 4 : d === 3 ? -4 : 0;
      }
    };
    for (const cp of spec.cover || []) if (R() < 0.6) stainAt(cp.x + (R() - 0.5) * 90, cp.y + 64 + R() * 24, 22 + Math.floor(R() * 26));
    for (const pr of spec.props || []) {
      if (!pr.solid) continue;
      const n = pr.bodyW > 200 ? 3 : 1;
      for (let i = 0; i < n; i++) stainAt(pr.x + (R() - 0.5) * (pr.bodyW ?? 80), pr.y + 10 + R() * 30, 26 + Math.floor(R() * 30));
    }
    // Blaster scars, a handful, off the calm centre: a dark core with short rays
    // on the 45-degree grid. They replace fifty random discs.
    const scars = [[300, 760], [1250, 520], [620, 1180], [1360, 780], [980, 210]];
    for (const [sx, sy] of scars) {
      const cx = q4(sx + (R() - 0.5) * 40), cy = q4(sy + (R() - 0.5) * 40);
      ctx.globalAlpha = 0.30; ctx.fillStyle = '#050505';
      ctx.fillRect(cx - 6, cy - 6, 12, 12); ctx.fillRect(cx - 10, cy - 2, 20, 4); ctx.fillRect(cx - 2, cy - 10, 4, 20);
      ctx.globalAlpha = 0.16;
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const len = 3 + Math.floor(R() * 4);
        for (let k = 2; k < len + 2; k++) ctx.fillRect(cx + dx * k * 4 - 2, cy + dy * k * 4 - 2, 4, 4);
      }
      ctx.globalAlpha = 0.07; ctx.fillStyle = '#d8c8a8';                 // the heat-bleached rim
      ctx.fillRect(cx - 14, cy - 14, 28, 2); ctx.fillRect(cx - 14, cy + 12, 28, 2);
    }
  });

  // Chipped deck paint: deck-coloured flecks across every painted mark, so the
  // amber reads worn in rather than printed on.
  ctx.save();
  interior();
  const deck = spec.floor?.base || '#212328';
  for (const m of spec.floor?.marks || []) {
    const n = Math.round((m.w * m.h) / 900);
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.45 + R() * 0.3; ctx.fillStyle = deck;
      ctx.fillRect(q4(m.x + R() * m.w), q4(m.y + R() * m.h), R() < 0.3 ? 8 : 4, 4);
    }
  }
  ctx.restore();

  // ── 4. CAST SHADOWS — mass that stands on the deck ──────────────────────
  // Each object's own silhouette, offset south-east by how tall it is, at the
  // backdrop's resolution on the 4px grain; then a hard contact line at the
  // foot. Drawn last so a shadow falls across the wear, not under it.
  const silhouette = (texKey, flip) => {
    const src = scene.textures.exists(texKey) ? scene.textures.get(texKey).getSourceImage() : null;
    if (!src?.width) return null;
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const c2 = cv.getContext('2d');
    if (flip) { c2.translate(src.width, 0); c2.scale(-1, 1); }
    c2.drawImage(src, 0, 0);
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.globalCompositeOperation = 'source-in';
    c2.fillStyle = '#000000';
    c2.fillRect(0, 0, cv.width, cv.height);
    return cv;
  };
  const cast = (texKey, x, y, ox, oy, dx, dy, a, flip = false) => {
    const sil = silhouette(texKey, flip);
    if (!sil) return;
    const left = Math.round(x - sil.width * ox), top = Math.round(y - sil.height * oy);
    ctx.globalAlpha = a;
    ctx.drawImage(sil, left + dx, top + dy);
    ctx.globalAlpha = a * 0.45;                                  // a softer second step
    ctx.drawImage(sil, left + dx + 8, top + dy + 4);
  };
  ctx.save();
  interior();
  for (const cp of spec.cover || []) {
    const k = pilotKey(scene, cp.tex ?? spec.coverTex ?? 'bush');
    cast(k, cp.x, cp.y, 0.5, 0.5, 16, 12, 0.34);
    ctx.globalAlpha = 0.38; ctx.fillStyle = '#000000';
    ctx.fillRect(q4(cp.x - 52), q4(cp.y + 48), 104, 6);         // contact line at the pallet
  }
  for (const pr of spec.props || []) {
    if (!pr.solid) continue;                                     // wall-mounted art throws nothing on the deck
    const tall = (pr.bodyW ?? 0) >= 140;
    cast(pilotKey(scene, pr.tex), pr.x, pr.y, 0.5, 1, tall ? 28 : 8, tall ? 16 : 8, tall ? 0.30 : 0.32, !!pr.flip);
  }
  ctx.restore();
}
