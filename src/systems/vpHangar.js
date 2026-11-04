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
// V2B (`?visualPilot=v2b`): the same idea, more objects. Crates re-planed
// (`paintPilotCrateB`); consoles, drums, the shuttle, the gantry and the wall
// panel take the RELIEF pass (`paintReliefPass`) — every source pixel where it
// was, the same canvas, so the shuttle's two ADD faces, every console's kit
// light and every static body still register exactly.
export const HANGAR_PILOT_TEX_V2B = Object.freeze({
  'ch-crate-a': 'vp2b-crate-a',
  'ch-crate-b': 'vp2b-crate-b',
  'ch-con-ped-c': 'vp2b-con-ped-c',
  'ch-con-heavy': 'vp2b-con-heavy',
  'prop-drum': 'vp2b-drum',
  'prop-drum-b': 'vp2b-drum-b',
  'prop-shuttle': 'vp2b-shuttle',
  'prop-crane': 'vp2b-crane',
  'ch-con-wall': 'vp2b-con-wall',
});
// V2C stands on the V2B set: only its ground differs.
export const hangarPilotTex = (variant) => (variant === 'v2b' || variant === 'v2c' ? HANGAR_PILOT_TEX_V2B : HANGAR_PILOT_TEX);
const pilotKey = (scene, k, variant = 'v2') => {
  const m = hangarPilotTex(variant);
  return m[k] && scene.textures.exists(m[k]) ? m[k] : k;
};

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
export function paintPilotHangarBackdrop(scene, key, worldW, worldH, opts, spec, variant = 'v2') {
  const scorch = opts.scorch ?? 40;                       // paintBackdrop's default
  // V2C draws no hex tiling at all: a second grid that disagreed with the deck
  // plates. `hexAlpha` takes no draws, so the stream is the same either way.
  const C = variant === 'v2c';
  paintBackdrop(scene, key, worldW, worldH, { ...opts, scorch: 0, hexAlpha: C ? 0 : (opts.hexAlpha ?? 1) * 0.45 });
  for (let i = 0; i < scorch * 3; i++) Math.random();     // the scorch loop's draws, exactly
  const tex = scene.textures.get(key);
  const ctx = tex.getContext();
  materialPass(scene, ctx, worldW, worldH, spec, opts.openings || [], variant === 'v2b' || C, C);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
}

function materialPass(scene, ctx, W, H, spec, openings, B = false, C = false) {
  // `B` is V2B. Every V2B difference is a branch on it; the V2 statements, their
  // order and their seeded draws are exactly as delivered (`smoke-visual-pilot`
  // compares the V2 backdrop with the previous build's).
  // `C` is V2C: V2B in every respect except the GROUND — V2's plate grid
  // (step 1) and its wear (step 3) are replaced by `groundC`; everything else
  // (light, wall shadows, coping, chipped paint, floor relief, cast shadows)
  // is V2B's, drawn on top of the new ground in the same order.
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
  if (C) groundC(ctx, spec, T, W, H, onDeck, runs);
  else onDeck((ctx) => {
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
  // The deck between the pools drops a step first, so the pools read by
  // contrast rather than by lifting the room's average value.
  ctx.globalAlpha = 0.07; ctx.fillStyle = '#000000';
  ctx.fillRect(T, T, W - 2 * T, H - 2 * T);
  const pools = [
    [800, 690, 500, 0.13], [430, 330, 300, 0.08], [1080, 1120, 310, 0.075], [1180, 330, 260, 0.065],
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
  if (!B) {
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.38 * (1 - i / 18) ** 1.5; ctx.fillStyle = '#000000';
      for (const side of ['top', 'bottom', 'left', 'right']) edgeStrip(side, i * 4, 4);
    }
  } else {
    // V2B: THE WALLS CAST, they do not glow dark. The north and west walls
    // stand between the deck and the north-west sun, so they throw a long
    // stepped shadow onto it; the south and east walls throw theirs outward,
    // and the deck at their foot keeps only a tight contact line.
    ctx.fillStyle = '#03050a';
    for (let i = 0; i < 20; i++) {
      ctx.globalAlpha = i < 3 ? 0.50 : 0.40 * (1 - i / 20) ** 1.3;
      edgeStrip('top', i * 4, 4); edgeStrip('left', i * 4, 4);
    }
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.34 * (1 - i / 5);
      edgeStrip('bottom', i * 4, 4); edgeStrip('right', i * 4, 4);
    }
  }
  ctx.restore();

  // The wall's coping: the top edge of the band catches the light along its
  // inner lip, so the wall reads as standing above the deck it shadows.
  if (T > 0) {
    ctx.save();
    ctx.fillStyle = '#a9b4c2';
    const cop = B ? [['top', 0.34], ['left', 0.34], ['right', 0.20], ['bottom', 0.20]] : [['top', 0.20], ['left', 0.20], ['right', 0.12], ['bottom', 0.12]];
    for (const [side, a] of cop) { ctx.globalAlpha = a; edgeStrip(side, B ? -6 : -4, B ? 4 : 2); }
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#050607';            // the dark line where wall meets deck
    for (const side of ['top', 'bottom', 'left', 'right']) edgeStrip(side, -2, 2);
    ctx.restore();
  }

  // ── 3. WEAR — where work happens, and nowhere else ───────────────────────
  if (!C) onDeck((ctx) => {
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

  if (B) floorRelief(ctx, spec, T, W, H);

  // ── 4. CAST SHADOWS — mass that stands on the deck ──────────────────────
  if (B) { castShadowsB(scene, ctx, spec, T, W, H); return; }
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

// ═══════════════════════════════════════════════════════════════════════════
// V2B — FORM ON THE FLOOR, AND SHADOWS THAT KNOW HOW TALL THINGS ARE
// ═══════════════════════════════════════════════════════════════════════════

// The room's OWN built forms, given the relief they claim (the spec is the
// source of truth — nothing here invents a form):
//   - the STAGING BAY is declared recessed: the deck's lip throws a stepped
//     shadow into it along its north and west edges, and its far (south /
//     east) wall catches a lit edge. It reads as lower than the lane.
//   - the three DECK PLATES become a second metal: tread plate, a shade
//     cooler and a step lighter than the matte deck, edged with a lit
//     north-west bevel and a dark south-east one — a different surface you can
//     see from across the room, not a texture you can only see up close.
function floorRelief(ctx, spec, T, W, H) {
  const arch = spec.floor?.architecture || [];
  ctx.save();
  ctx.beginPath(); ctx.rect(T, T, W - 2 * T, H - 2 * T); ctx.clip();
  for (const it of arch) {
    if (it.kind === 'region' && it.tone === 'recess') {
      ctx.fillStyle = '#03050a';
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = 0.46 * (1 - i / 6);
        ctx.fillRect(it.x, it.y + i * 4, it.w, 4);                    // under the north lip
        ctx.fillRect(it.x + i * 4, it.y, 4, it.h);                    // under the west lip
      }
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#b4bfcc';
      ctx.fillRect(it.x, it.y + it.h - 4, it.w, 2);                   // the far wall's lit edge
      ctx.fillRect(it.x + it.w - 4, it.y, 2, it.h);
    } else if (it.kind === 'plate') {
      const x0 = it.x + 3, y0 = it.y + 3, w = it.w - 6, h = it.h - 6;
      // A shade cooler and a touch DARKER than the matte deck — a different
      // metal, not a lighter rug. (The first pass lifted it and lit the tread
      // at 0.20: at phone size it was the brightest large area on the floor.)
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#0a1422';
      ctx.fillRect(x0, y0, w, h);
      // TREAD: a diamond-plate lattice of short 45-degree bars, alternating —
      // a texture you feel at 1x and see only as a tone at phone size
      for (let y = y0 + 8, row = 0; y < y0 + h - 8; y += 16, row++) {
        for (let x = x0 + 8 + (row % 2) * 8, k = 0; x < x0 + w - 10; x += 16, k++) {
          const up = (k + row) % 2 === 0;
          for (let j = 0; j < 3; j++) {
            const px = x + j * 2, py = up ? y + 4 - j * 2 : y + j * 2;
            ctx.globalAlpha = 0.08; ctx.fillStyle = '#c3ccd8'; ctx.fillRect(px, py, 2, 2);
            ctx.globalAlpha = 0.10; ctx.fillStyle = '#05070a'; ctx.fillRect(px, py + 2, 2, 2);
          }
        }
      }
      ctx.globalAlpha = 0.30; ctx.fillStyle = '#c3ccd8';               // raised: lit NW bevel
      ctx.fillRect(it.x + 2, it.y + 2, it.w - 4, 2); ctx.fillRect(it.x + 2, it.y + 2, 2, it.h - 4);
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#03050a';               // dark SE bevel and its drop
      ctx.fillRect(it.x + 2, it.y + it.h - 4, it.w - 2, 3); ctx.fillRect(it.x + it.w - 4, it.y + 2, 3, it.h - 2);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(it.x + 4, it.y + it.h, it.w, 4); ctx.fillRect(it.x + it.w, it.y + 4, 4, it.h);
    }
  }
  ctx.restore();
}

// A sprite's opaque cells at its 4px grain, mirrored when it is placed flipped.
function cellMask(scene, texKey, flip, s = 4) {
  if (!scene.textures.exists(texKey)) return null;
  const src = scene.textures.get(texKey).getSourceImage();
  if (!src?.width) return null;
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const c2 = cv.getContext('2d');
  c2.drawImage(src, 0, 0);
  const d = c2.getImageData(0, 0, src.width, src.height).data;
  const w = Math.round(src.width / s), h = Math.round(src.height / s);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y * s + (s >> 1)) * src.width + (x * s + (s >> 1))) * 4 + 3;
    if (d[i] > 127) m[y * w + (flip ? w - 1 - x : x)] = 1;
  }
  return { w, h, m, s, pw: src.width, ph: src.height };
}

// THE V2B SHADOW SYSTEM — three things, kept apart:
//   CONTACT  tight and dark, directly under the foot: the object touches here.
//   CAST     the object's own columns PROJECTED onto the deck by the north-west
//            sun: each column throws a slanted run whose length is that
//            column's height (x `hs`, the share of the drawn height that is
//            real height rather than lid depth). A crate throws a short block,
//            the gantry's legs throw long bars, a drum a rounded stub — mass
//            you can read from the shadow alone. Two steps: a core and a
//            penumbra one cell wider. Cool near-black, translucent, so the deck
//            shows through: a shadow, never a hole.
//   OFFSET   the shuttle stands on its gear, so its plan-view silhouette is
//            displaced whole, further than anything else: it is the one object
//            in the room that is OFF the deck.
const SUN = { ax: 0.70, ay: 0.38 };   // a low north-west sun: long enough to read at phone size
function castShadowsB(scene, ctx, spec, T, W, H) {
  ctx.save();
  ctx.beginPath(); ctx.rect(T, T, W - 2 * T, H - 2 * T); ctx.clip();
  const SH = '#03050a';
  const layerOf = (pw, ph) => { const c = document.createElement('canvas'); c.width = pw; c.height = ph; return c; };

  // elevation sprites: projected columns + contact
  const project = (texKey, left, top, flip, hs, core = 0.46, pen = 0.18) => {
    const M = cellMask(scene, texKey, flip);
    if (!M) return;
    const { w, h, m, s } = M;
    let base = -1;
    for (let y = h - 1; y >= 0 && base < 0; y--) for (let x = 0; x < w; x++) if (m[y * w + x]) { base = y; break; }
    if (base < 0) return;
    const maxH = Math.ceil((base + 1) * hs) + 2;
    const cw = w + Math.ceil(maxH * SUN.ax) + 3, ch = base + maxH + Math.ceil(maxH * SUN.ay) + 4;
    const cells = new Uint8Array(cw * ch);
    // Per column: the bottom `hr` drawn rows are the vertical FACE (a cell k
    // rows above the foot stands k high over the foot); the rows above that are
    // the TOP plane, standing `hr` high over the ground `hr` rows further south.
    // So a box throws its face as a slanted run AND its lid shifted south-east —
    // the shadow shows beside the box, not only under its foot.
    const put = (sx, sy) => { if (sx >= 0 && sy >= 0 && sx < cw && sy < ch) cells[sy * cw + sx] = 1; };
    for (let x = 0; x < w; x++) {
      let topRow = -1, foot = -1;
      for (let y = 0; y <= base; y++) if (m[y * w + x]) { if (topRow < 0) topRow = y; foot = y; }
      if (topRow < 0) continue;
      const hr = Math.round((foot - topRow + 1) * hs);
      for (let k = 0; k <= hr; k++) put(x + Math.round(k * SUN.ax), foot + Math.round(k * SUN.ay));
      for (let y = topRow; y < foot - hr; y++) {
        if (!m[y * w + x]) continue;
        put(x + Math.round(hr * SUN.ax), y + hr + Math.round(hr * SUN.ay));
      }
    }
    const coreL = layerOf(cw * s, ch * s), penL = layerOf(cw * s, ch * s);
    const cc = coreL.getContext('2d'), pc = penL.getContext('2d');
    cc.fillStyle = SH; pc.fillStyle = SH;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (!cells[y * cw + x]) continue;
      cc.fillRect(x * s, y * s, s, s);
      pc.fillRect(x * s, y * s, s * 2, s * 2);                       // one cell wider, right and down
    }
    ctx.globalAlpha = pen; ctx.drawImage(penL, left, top);
    ctx.globalAlpha = core; ctx.drawImage(coreL, left, top);
    // CONTACT: the foot row's columns, one cell under, tight and dark
    ctx.fillStyle = SH;
    for (let x = 0; x < w; x++) {
      let foot = -1;
      for (let y = base; y >= Math.max(0, base - 2); y--) if (m[y * w + x]) { foot = y; break; }
      if (foot < 0) continue;
      ctx.globalAlpha = 0.55; ctx.fillRect(left + x * s, top + (foot + 1) * s, s, s);
      ctx.globalAlpha = 0.25; ctx.fillRect(left + x * s, top + (foot + 2) * s, s, s);
    }
  };

  for (const cp of spec.cover || []) {
    const k = pilotKey(scene, cp.tex ?? spec.coverTex ?? 'bush', 'v2b');
    const crate = /crate/.test(cp.tex || '');
    project(k, Math.round(cp.x - 56), Math.round(cp.y - 56), false, crate ? 0.55 : 0.72);
  }
  for (const pr of spec.props || []) {
    if (!pr.solid) continue;                                       // wall-mounted art throws nothing on the deck
    const k = pilotKey(scene, pr.tex, 'v2b');
    if (!scene.textures.exists(k)) continue;
    const src = scene.textures.get(k).getSourceImage();
    const left = Math.round(pr.x - src.width / 2), top = Math.round(pr.y - src.height);
    if (/shuttle/.test(pr.tex)) {
      // OFF THE DECK: the plan-view silhouette, displaced whole
      const M = cellMask(scene, k, !!pr.flip);
      if (!M) continue;
      const L = layerOf(M.pw + 8, M.ph + 8), lc = L.getContext('2d');
      lc.fillStyle = SH;
      for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.m[y * M.w + x]) lc.fillRect(x * 4, y * 4, 4, 4);
      ctx.globalAlpha = 0.18; ctx.drawImage(L, left + 40, top + 26);
      ctx.globalAlpha = 0.40; ctx.drawImage(L, left + 32, top + 20);
    } else {
      project(k, left, top, !!pr.flip, /crane/.test(pr.tex) ? 0.7 : 0.8, /crane/.test(pr.tex) ? 0.36 : 0.44);
    }
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// V2C — THE GROUND (`?visualPilot=v2c`): a deck the V2B objects can stand on
// ═══════════════════════════════════════════════════════════════════════════
//
// THE DIAGNOSIS (V2B, at 1x and at the phone's 0.54x):
//   - ONE SHEET. Every walkable field — lane, apron, general deck — is the same
//     flat blue-grey with a spread of 8-15 luminance levels, nearly all of it
//     the seam lines themselves: nothing says worn, newer, heavier or busier.
//   - TWO GRIDS THAT DISAGREE. The hex tiling (left at 0.135) cuts diagonally
//     across the rectangular plates, so neither reads as construction.
//   - SEAMS WITHOUT THICKNESS. A 2px joint with a 1px lip draws a grid on a
//     sheet; it does not separate heavy slabs, and at 0.54x it vanishes — the
//     middle of the fight reads as empty backdrop.
//   - WEAR THAT IS NOT ATTACHED TO ANYTHING. Seventy thin polish streaks read
//     as scan lines at 1x and as nothing at phone size.
//   - THE FLOOR DOES NOT ANSWER ITS OBJECTS. Shadows are the only link: no
//     grime at a machine's foot, no worn patch where an operator stands.
//
// THE GROUND, from the room spec's own forms (nothing invented):
//   FIELDS   the deployment LANE (long plates along its axis, polished traffic
//            metal, two wheel paths), the launch APRON (heavy square blast
//            plates, heat-darkened, a soot fan aft of the shuttle's engines),
//            the STAGING BAY (darker freight floor around its tread plate), and
//            the GENERAL deck (standard plates, matte, worn). Each field is
//            bounded by a heavy expansion joint.
//   PLATES   real slabs: a dark joint, a lit north-west bevel and a dark
//            south-east chamfer (the room's one sun), corner fasteners, and a
//            per-plate tone — a patchwork of older and replaced steel you can
//            see at phone size, quiet enough that bolts never compete.
//   WEAR     where the work is: wheel paths and rubber at the joints they
//            cross; a scuffed, polished stand in front of every console; grime
//            settled round the foot of every cover object and machine; a
//            darker, grimier kick strip where the deck meets the walls.
// Values only (black / cool-white at low alpha, one warm soot): no red, no small
// green points, no circles, nothing tall. Its own seeded generator.
function groundC(ctx, spec, T, W, H, onDeck, runs) {
  const R = rng(0x9a0d2c11);
  const arch = spec.floor?.architecture || [];
  const regions = arch.filter((it) => it.kind === 'region');
  const lane = regions.find((r) => r.w > 1000);
  const apron = regions.find((r) => r !== lane && r.tone !== 'recess');
  const bay = regions.find((r) => r.tone === 'recess');
  const LIT = '#b4bfcc', DK = '#030406';

  // A field of plates: `bond` offsets alternate rows by half a plate.
  const plates = (g, f, pw, ph, bond, amp) => {
    g.save();
    g.beginPath(); g.rect(f.x, f.y, f.w, f.h); g.clip();
    for (let row = 0, y = f.y; y < f.y + f.h; row++, y += ph) {
      const off = bond && row % 2 ? pw / 2 : 0;
      for (let x = f.x - off; x < f.x + f.w; x += pw) {
        // the plate's own steel: most within a few levels, a few replaced
        // (newer, cooler) and a few old (darker, grimier)
        const r = R();
        if (r < 0.12) { g.globalAlpha = 0.07; g.fillStyle = '#a9b6c6'; }
        else if (r < 0.22) { g.globalAlpha = 0.11; g.fillStyle = '#0b0a08'; }
        else { const v = (R() - 0.5) * 2 * amp; g.globalAlpha = Math.abs(v); g.fillStyle = v > 0 ? '#9aa4b0' : '#000000'; }
        g.fillRect(x + 3, y + 3, pw - 5, ph - 5);
        // the slab: joint, lit north-west bevel, dark south-east chamfer
        g.globalAlpha = 0.55; g.fillStyle = DK;
        g.fillRect(x, y, pw, 2); g.fillRect(x, y, 2, ph);
        // (0.15 on the first render read as a ruled grid at phone size: the
        // slab is carried by its chamfer and its own tone, the lit bevel only
        // has to catch)
        g.globalAlpha = 0.10; g.fillStyle = LIT;
        g.fillRect(x + 2, y + 2, pw - 4, 2); g.fillRect(x + 2, y + 2, 2, ph - 4);
        g.globalAlpha = 0.28; g.fillStyle = DK;
        g.fillRect(x + 2, y + ph - 2, pw - 2, 2); g.fillRect(x + pw - 2, y + 2, 2, ph - 2);
        // corner fasteners
        for (const [bx, by] of [[x + 7, y + 7], [x + pw - 11, y + 7], [x + 7, y + ph - 11], [x + pw - 11, y + ph - 11]]) {
          g.globalAlpha = 0.26; g.fillStyle = DK; g.fillRect(bx, by, 4, 4);
          g.globalAlpha = 0.14; g.fillStyle = LIT; g.fillRect(bx, by, 2, 2);
        }
      }
    }
    g.restore();
  };
  // A heavy expansion joint round a field: a dark 4px channel, its far (south /
  // east) wall lit — the same groove read as a plate joint, one size up.
  const fieldJoint = (g, f) => {
    g.globalAlpha = 0.60; g.fillStyle = DK;
    g.fillRect(f.x, f.y - 2, f.w, 4); g.fillRect(f.x, f.y + f.h - 2, f.w, 4);
    g.fillRect(f.x - 2, f.y, 4, f.h); g.fillRect(f.x + f.w - 2, f.y, 4, f.h);
    g.globalAlpha = 0.16; g.fillStyle = LIT;
    g.fillRect(f.x, f.y + 2, f.w, 2); g.fillRect(f.x, f.y + f.h + 2, f.w, 2);
    g.fillRect(f.x + 2, f.y, 2, f.h); g.fillRect(f.x + f.w + 2, f.y, 2, f.h);
  };

  onDeck((g) => {
    // ── THE GENERAL DECK: everything outside the three fields ─────────────
    g.save();
    g.beginPath(); g.rect(T, T, W - 2 * T, H - 2 * T);
    for (const f of [lane, apron, bay]) if (f) g.rect(f.x, f.y, f.w, f.h);
    g.clip('evenodd');
    plates(g, { x: T, y: T, w: W - 2 * T, h: H - 2 * T }, 160, 140, true, 0.05);
    g.restore();

    // ── THE APRON: heavy blast plates, heat-darkened ──────────────────────
    if (apron) {
      g.globalAlpha = 0.12; g.fillStyle = '#000000'; g.fillRect(apron.x, apron.y, apron.w, apron.h);
      g.globalAlpha = 0.07; g.fillStyle = '#2a2116'; g.fillRect(apron.x, apron.y, apron.w, apron.h);
      plates(g, apron, apron.w / 3, apron.h / 3, false, 0.045);
    }
    // ── THE LANE: long plates on its axis, polished by traffic ────────────
    if (lane) {
      g.globalAlpha = 0.06; g.fillStyle = '#c3cdd8'; g.fillRect(lane.x, lane.y, lane.w, lane.h);
      plates(g, lane, lane.w / 6, lane.h / 2, true, 0.03);
    }
    // ── THE STAGING BAY: darker freight floor round the tread plate ───────
    if (bay) {
      g.globalAlpha = 0.08; g.fillStyle = '#000000'; g.fillRect(bay.x, bay.y, bay.w, bay.h);
      plates(g, bay, bay.w / 5, bay.h / 3, false, 0.04);
    }
    for (const f of [lane, apron, bay]) if (f) fieldJoint(g, f);

    // ── THE KICK STRIP: a darker, grimier band where the deck meets the walls
    const K = 28;
    g.globalAlpha = 0.14; g.fillStyle = '#000000';
    for (const [side, rs] of [['top', runs('top')], ['bottom', runs('bottom')], ['left', runs('left')], ['right', runs('right')]]) {
      for (const [a, b] of rs) {
        if (side === 'top') g.fillRect(a, T, b - a, K);
        else if (side === 'bottom') g.fillRect(a, H - T - K, b - a, K);
        else if (side === 'left') g.fillRect(T, a, K, b - a);
        else g.fillRect(W - T - K, a, K, b - a);
      }
    }
    for (const [side, rs] of [['top', runs('top')], ['bottom', runs('bottom')], ['left', runs('left')], ['right', runs('right')]]) {
      for (const [a, b] of rs) {
        g.globalAlpha = 0.5; g.fillStyle = DK;
        if (side === 'top') g.fillRect(a, T + K, b - a, 2);
        else if (side === 'bottom') g.fillRect(a, H - T - K - 2, b - a, 2);
        else if (side === 'left') g.fillRect(T + K, a, 2, b - a);
        else g.fillRect(W - T - K - 2, a, 2, b - a);
        g.globalAlpha = 0.13; g.fillStyle = LIT;
        if (side === 'top') g.fillRect(a, T + K + 2, b - a, 2);
        else if (side === 'bottom') g.fillRect(a, H - T - K, b - a, 2);
        else if (side === 'left') g.fillRect(T + K + 2, a, 2, b - a);
        else g.fillRect(W - T - K, a, 2, b - a);
      }
    }

    // ── WHEEL PATHS down the lane, below its rail track ───────────────────
    if (lane) {
      const pw = lane.w / 6;
      for (const cy of [lane.y + lane.h * 0.50, lane.y + lane.h * 0.80]) {
        const y = q4(cy - 14);
        g.globalAlpha = 0.06; g.fillStyle = '#d0d8e2'; g.fillRect(lane.x + 24, y, lane.w - 48, 28);
        g.globalAlpha = 0.05; g.fillRect(lane.x + 24, y + 8, lane.w - 48, 12);
        // the abraded edges: short breaks, so the path is worn in, not ruled
        g.globalAlpha = 0.07; g.fillStyle = '#000000';
        for (let x = lane.x + 24; x < lane.x + lane.w - 24; x += 24 + q4(R() * 24)) {
          g.fillRect(x, y - 2, 8 + q4(R() * 12), 2); g.fillRect(x + 12, y + 28, 8 + q4(R() * 12), 2);
        }
        // rubber where the wheels cross a joint
        for (let x = lane.x + pw; x < lane.x + lane.w - 10; x += pw) {
          g.globalAlpha = 0.20; g.fillStyle = '#060504';
          g.fillRect(x - 8, y + 4, 16, 4); g.fillRect(x - 4, y + 20, 12, 4);
        }
      }
    }

    // ── THE SOOT FAN aft of the shuttle's engines (on the apron) ──────────
    const shuttle = (spec.props || []).find((p) => /shuttle/.test(p.tex));
    if (shuttle && apron) {
      const x0 = shuttle.x, y0 = shuttle.y;
      for (let i = 0; i < 6; i++) {
        const w = 72 + i * 24, y = y0 + i * 14;
        if (y > apron.y + apron.h - 8) break;
        g.globalAlpha = 0.16 - i * 0.02; g.fillStyle = '#0a0705';
        g.fillRect(q4(x0 - w / 2), y, q4(w), 14);
      }
    }

    // ── AN OPERATOR'S STAND in front of every console: scuffed bright ─────
    for (const cp of spec.cover || []) {
      if (!/con/.test(cp.tex || '')) continue;
      const x = q4(cp.x - 36), y = q4(cp.y + 60);
      g.globalAlpha = 0.07; g.fillStyle = '#d0d8e2'; g.fillRect(x, y, 72, 32);
      g.globalAlpha = 0.10;
      for (let k = 0; k < 4; k++) {
        const sx = x + 8 + q4(R() * 52), sy = y + 6 + q4(R() * 18);
        for (let j = 0; j < 3; j++) g.fillRect(sx + j * 2, sy + j * 2, 2, 2);
      }
    }

    // ── GRIME round the foot of every cover object and solid machine ──────
    // Stepped bands round the body footprint, densest at the foot.
    const apronOf = (x, y, w, h) => {
      for (let i = 0; i < 4; i++) {
        const d = 4 + i * 6;
        g.globalAlpha = 0.14 - i * 0.03; g.fillStyle = '#080706';
        g.fillRect(x - d, y + h, w + 2 * d, 6);                       // south (the side we see)
        g.fillRect(x - d, y - d, 6, h + d);                           // west
        g.fillRect(x + w + d - 6, y - d, 6, h + d);                   // east
      }
    };
    for (const cp of spec.cover || []) apronOf(cp.x - 35, cp.y - 35 + 24, 70, 46);
    for (const pr of spec.props || []) {
      if (!pr.solid || /shuttle/.test(pr.tex)) continue;            // the shuttle stands on its gear
      const bw = pr.bodyW ?? 60, bh = pr.bodyH ?? 50;
      apronOf(pr.x - bw / 2, pr.y - bh, bw, bh);
    }

    // ── A FEW IMPACT SCARS, on the ground the fights cross ────────────────
    for (const [sx, sy] of [[980, 480], [640, 820], [1190, 960], [300, 760]]) {
      const cx = q4(sx), cy = q4(sy);
      g.globalAlpha = 0.24; g.fillStyle = '#050505';
      g.fillRect(cx - 6, cy - 4, 12, 8); g.fillRect(cx - 10, cy - 2, 20, 4);
      g.globalAlpha = 0.12;
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0]]) {
        const len = 2 + Math.floor(R() * 3);
        for (let k = 2; k < len + 2; k++) g.fillRect(cx + dx * k * 4 - 2, cy + dy * k * 3 - 2, 4, 4);
      }
    }
  });
}
