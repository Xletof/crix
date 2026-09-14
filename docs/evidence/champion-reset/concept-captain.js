// THE IMPERIAL SHOCK CAPTAIN — concept-sheet painter. OFF-REPO, evidence only.
//
// IT IS DRAWN IN THE HOUSE GRAMMAR, and that is the whole correction. Every
// CRIX actor is a HIGH-ANGLE TOP-DOWN figure: a big helmet DOME at the north
// edge, shoulders below it and wider, a chest panel, then three rows of boot at
// the south edge. Vader is 40x40 with a 16px dome; the grunt is 20x20 with an
// 11px one. The first concept ignored that and stacked horizontal bars, which
// photographed as a machine rather than a man.
//
// 28x28 logical at scale 4 = 112x112. Between the player (96) and Vader (160).
//
// NO WEAPON IS PAINTED INTO THE BODY. Every armed actor here carries a separate
// `weaponSprite` overlay painted EAST-facing at origin (0.15, 0.5); a rifle
// baked into the body sheet would be a second author for the same object.
window.__paintCaptain = function (scene, bodyKey, gunKey) {
  const W = 28, H = 28, S = 4;
  const POSES = ['idle', 'back', 'side', 'walkA', 'walkB', 'strafe',
    'ready', 'fire', 'recoil', 'windup', 'stagger', 'broken'];
  const N = POSES.length;

  // ── PALETTE ───────────────────────────────────────────────────────────────
  // PLACED AGAINST THE DECK AND AGAINST THE TWO THINGS HE MUST NOT BE.
  // The hangar deck is #212328. Troopers are cool white (#dcdce8); Vader is
  // near-black (#12121a). The Captain's armour sits in the Imperial palette's
  // MIDDLE — the body three steps above the deck and the top planes four, which
  // is the arena rule ("top plates two steps above the deck") applied to an
  // actor. An earlier build used #2e3038 and photographed as a second dark blob
  // standing next to Vader: technically between the two, visually one of them.
  const P = {
    black: '#08080c', deep: '#1e2028', body: '#3e4048', plate: '#5a5c62',
    lit: '#7a7c80', trim: '#9a9c9e',
    // Rank plate is WARM bone, so it reads apart from the trooper's cool white
    // even where the two silhouettes overlap in a crowd.
    bone: '#c6c0b0', boneHi: '#e6e0d0', boneLo: '#8c8678',
    vis: '#4fc3ff', visHot: '#dcf2ff', visDim: '#1a4763',
    hot: '#ffd27a', white: '#ffffff',
  };

  if (scene.textures.exists(bodyKey)) scene.textures.remove(bodyKey);
  const tex = scene.textures.createCanvas(bodyKey, W * N * S, H * S);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  let F = 0;
  const px = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    ctx.fillStyle = c; ctx.fillRect((F * W + x) * S, y * S, S, S);
  };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  const hl = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) px(x, y, c); };
  const vl = (x, y0, y1, c) => { for (let y = y0; y <= y1; y++) px(x, y, c); };
  // A black rim around a plate is what makes it sit ON something rather than
  // beside it. Every actor in this game is outlined; the first two concept
  // builds were not and both photographed as flat pasted rectangles.
  const rim = (x, y, w, h) => {
    hl(y - 1, x, x + w - 1, P.black); hl(y + h, x, x + w - 1, P.black);
    vl(x - 1, y, y + h - 1, P.black); vl(x + w, y, y + h - 1, P.black);
  };

  function draw(pose) {
    const broken = pose === 'broken';
    const back   = pose === 'back';
    const side   = pose === 'side';
    const hurt   = pose === 'stagger';

    // Two channels, exactly as drawVader and drawTrooper use: a vertical BOB
    // and a forward LEAN. At this size nothing finer survives.
    const bob  = pose === 'walkA' ? -1 : pose === 'walkB' ? 1
               : pose === 'windup' ? -2 : pose === 'recoil' ? 2 : hurt ? 2 : 0;
    const lean = pose === 'fire' ? 1 : pose === 'recoil' ? -1 : pose === 'windup' ? -1
               : hurt ? -2 : 0;
    // Shoulder height — the clearest tell a body this small has.
    const sh   = pose === 'windup' ? -2 : pose === 'recoil' ? 2 : hurt ? 1 : 0;
    const cx   = 14;
    const cy   = 8 + bob + lean;          // helmet centre
    const sy   = 14 + bob + sh;           // shoulder line
    const ty   = 14 + bob;                // torso top — NOT shoulder-driven
    const bone = broken ? P.boneLo : P.bone;

    // ── THE PACK ──────────────────────────────────────────────────────────
    // A compact power/thruster assembly on his back. Seen from above that is
    // NORTH of the torso and mostly UNDER the helmet, so it is drawn first and
    // shows as two dark wings either side of the dome. An earlier build put two
    // glowing nozzles ABOVE the head and they read as antennae — or as a second
    // pair of eyes competing with the visor.
    const flare = pose === 'windup' || pose === 'strafe';
    if (!side) {
      rect(cx - 7, ty - 3, 14, 3, P.deep);
      hl(ty - 3, cx - 7, cx + 6, P.body);
      rim(cx - 7, ty - 3, 14, 3);
      px(cx - 7, ty - 2, flare ? P.vis : P.black);
      px(cx + 6, ty - 2, flare ? P.vis : P.black);
      if (flare) { px(cx - 8, ty - 2, P.visHot); px(cx + 7, ty - 2, P.visHot); }
    } else {
      rect(cx - 6, ty - 3, 6, 3, P.deep);
      hl(ty - 3, cx - 6, cx - 1, P.body);
      rim(cx - 6, ty - 3, 6, 3);
      px(cx - 7, ty - 2, flare ? P.vis : P.black);
    }

    // ── HELMET DOME ───────────────────────────────────────────────────────
    // A real circle at r = 6, graded north-to-south, with black side rims. An
    // earlier build used a squashed ellipse plus a full-width crown row and
    // photographed as a BUCKET: flat on top, vertical at the sides.
    for (let dy = -5; dy <= 5; dy++) {
      const w = Math.round(Math.sqrt(36 - dy * dy));
      const tone = dy <= -4 ? P.lit : dy === -3 ? P.plate
                 : dy >= 4 ? P.deep : dy >= 2 ? P.body : P.body;
      hl(cy + dy, cx - w, cx + w - 1, tone);
    }
    vl(cx - 6, cy - 2, cy + 2, P.black);
    vl(cx + 5, cy - 2, cy + 2, P.black);
    hl(cy - 6, cx - 3, cx + 2, P.black);
    hl(cy + 6, cx - 3, cx + 2, P.black);

    // THE CREST. A bone rank ridge running fore-and-aft along the crown, drawn
    // INSIDE the dome. An earlier build stood it proud of the helmet and at 1x
    // it was a pale lump — an aerial on a robot, or a bun. A crest seen from
    // above is a stripe, and a stripe is what this is.
    if (!side) {
      rect(cx - 1, cy - 5, 2, back ? 8 : 5, bone);
      hl(cy - 5, cx - 1, cx, P.boneHi);
      vl(cx - 2, cy - 4, cy - 1, P.black);
      vl(cx + 1, cy - 4, cy - 1, P.black);
    } else {
      rect(cx - 4, cy - 5, 7, 2, bone);
      hl(cy - 5, cx - 4, cx + 2, P.boneHi);
      hl(cy - 3, cx - 4, cx + 2, P.black);
    }

    if (!back && !side) {
      // Brow, then a WIDE luminous visor slit. One strong horizontal light on a
      // dark dome: the only bright small thing above the shoulders.
      hl(cy, cx - 5, cx + 4, P.black);
      hl(cy + 1, cx - 5, cx + 4, hurt ? P.white : broken ? P.visDim : P.vis);
      hl(cy + 2, cx - 4, cx + 3, hurt ? P.white : broken ? P.visDim : P.vis);
      px(cx - 5, cy + 1, P.visHot); px(cx + 4, cy + 1, P.visHot);
      if (pose === 'windup' || pose === 'fire') {
        hl(cy + 1, cx - 5, cx + 4, P.visHot); hl(cy + 2, cx - 4, cx + 3, P.visHot);
      }
      // Squared breather jaw, cut flat out of the bottom of the dome.
      hl(cy + 3, cx - 3, cx + 2, P.black);
      hl(cy + 4, cx - 2, cx + 1, P.black);
      px(cx - 4, cy + 4, P.plate); px(cx + 3, cy + 4, P.plate);
    } else if (side) {
      rect(cx + 2, cy, 4, 3, P.black);         // mask juts EAST
      px(cx + 5, cy + 1, broken ? P.visDim : P.vis);
      px(cx + 6, cy + 1, P.visHot);
      hl(cy + 3, cx - 3, cx + 2, P.deep);
    } else {
      hl(cy + 1, cx - 4, cx + 3, P.deep);      // cabling, no light at all
      hl(cy + 4, cx - 3, cx + 2, P.black);
    }

    // ── TORSO ─────────────────────────────────────────────────────────────
    // Drawn FIRST so the pauldron lands on top of it and the two are one mass.
    if (!side) {
      rect(cx - 5, ty, 10, 8, P.body);
      hl(ty, cx - 5, cx + 4, P.lit);
      hl(ty + 1, cx - 5, cx + 4, P.plate);
      hl(ty + 7, cx - 5, cx + 4, P.deep);
      rim(cx - 5, ty, 10, 8);
      if (!back) {
        // THE CHEST IS DARK, AND THAT IS WHAT MAKES THE PAULDRON ASYMMETRIC.
        // A bone rank band across the sternum sat at the same height and the
        // same tone as the pauldron beside it, and the two fused into one wide
        // pale bar straight across the shoulders — the single loudest mark on
        // the body, and perfectly symmetrical. The bone now appears exactly
        // twice: the crest on the centreline and ONE shoulder.
        rect(cx - 3, ty + 2, 6, 5, P.body);
        hl(ty + 2, cx - 3, cx + 2, P.lit);      // the plate stands proud
        hl(ty + 3, cx - 3, cx + 2, P.deep);
        hl(ty + 6, cx - 3, cx + 2, P.black);
        rim(cx - 3, ty + 2, 6, 5);
        rect(cx - 1, ty + 4, 2, 2, broken ? P.visDim : P.vis);   // sternum core
        px(cx - 1, ty + 4, P.visHot);
        if (broken) { px(cx - 4, ty + 6, P.hot); px(cx + 3, ty + 3, P.hot); }
      } else {
        vl(cx - 1, ty + 1, ty + 6, P.deep); vl(cx, ty + 1, ty + 6, P.deep);
        hl(ty + 4, cx - 4, cx + 3, P.plate);
      }
    } else {
      rect(cx - 4, ty, 8, 8, P.body);
      hl(ty, cx - 4, cx + 3, P.plate);
      rim(cx - 4, ty, 8, 8);
      vl(cx + 3, ty + 1, ty + 6, P.deep);
      px(cx + 3, ty + 4, broken ? P.visDim : P.vis);
    }

    // ── SHOULDERS ─────────────────────────────────────────────────────────
    // ASYMMETRIC BY CONSTRUCTION. One bone COMMAND PAULDRON, one small dark
    // plate — never a mirror. The pauldron's inner column sits ON the torso's
    // outer column: an earlier build left a dark seam between them and at 1x
    // the plate read as a white card he was holding.
    if (!side) {
      const px0 = back ? cx + 4 : cx - 10;
      if (!broken) {
        rect(px0, sy, 6, 6, bone);
        hl(sy, px0 + 1, px0 + 4, P.boneHi);
        hl(sy + 5, px0, px0 + 5, P.boneLo);
        rim(px0, sy, 6, 6);
        px(px0, sy, P.black); px(px0 + 5, sy, P.black);          // stepped 45s
        px(px0, sy + 5, P.black); px(px0 + 5, sy + 5, P.black);
        // RANK MARKS RUN ACROSS, NOT DOWN. Two vertical notches on a pale plate
        // are two eye sockets: at 3x the command pauldron photographed as a
        // SKULL, which is a different faction's iconography entirely.
        hl(sy + 2, px0 + 1, px0 + 3, P.boneLo);
        hl(sy + 3, px0 + 1, px0 + 2, P.boneLo);
        // IT WRAPS over the arm, so it is a shoulder and not cargo.
        rect(px0 + 1, sy + 6, 4, 2, P.boneLo);
        rim(px0 + 1, sy + 6, 4, 2);
      } else {
        rect(px0 + 2, sy + 1, 4, 4, P.plate);
        hl(sy + 1, px0 + 2, px0 + 5, P.lit);
        rim(px0 + 2, sy + 1, 4, 4);
        px(px0 + 1, sy + 2, P.boneLo); px(px0 + 1, sy + 4, P.boneLo);
        px(px0, sy + 3, P.hot); px(px0 - 1, sy + 1, P.hot); px(px0, sy + 5, P.hot);
      }
      // Off side: smaller, darker, one row lower. Never a mirror.
      const qx = back ? cx - 10 : cx + 4;
      rect(qx, sy + 2, 6, 5, P.body);
      hl(sy + 2, qx, qx + 5, P.plate);
      rim(qx, sy + 2, 6, 5);
      // Arms. Without them the shoulders are cargo, not limbs.
      const ao = pose === 'strafe' ? 1 : 0;
      rect(qx + 1 + ao, sy + 7, 4, 3, P.body);
      hl(sy + 7, qx + 1 + ao, qx + 4 + ao, P.plate);
      rim(qx + 1 + ao, sy + 7, 4, 3);
    } else {
      rect(cx - 7, sy + 1, 4, 5, P.deep);       // far shoulder behind
      rim(cx - 7, sy + 1, 4, 5);
      rect(cx - 5, sy, 7, 6, bone);             // near command pauldron
      hl(sy, cx - 5, cx + 1, P.boneHi);
      hl(sy + 5, cx - 5, cx + 1, P.boneLo);
      rim(cx - 5, sy, 7, 6);
      hl(sy + 2, cx - 4, cx - 1, P.boneLo);
      hl(sy + 3, cx - 4, cx - 2, P.boneLo);
      rect(cx, sy + 6, 5, 3, P.body);
      hl(sy + 6, cx, cx + 4, P.plate);
      rim(cx, sy + 6, 5, 3);
    }

    // ── KAMA ──────────────────────────────────────────────────────────────
    // A short armoured skirt. It gives him MASS below the chest without a cape
    // — the cape is Vader's and may not be borrowed. It flares on the wind-up
    // and pulls in on the recovery, so the silhouette breathes with the attack.
    const ky = ty + 8, sp = pose === 'windup' ? 1 : pose === 'recoil' ? -1 : 0;
    rect(cx - 6 - sp, ky, 12 + sp * 2, 2, P.deep);
    hl(ky, cx - 6 - sp, cx + 5 + sp, P.body);
    rim(cx - 6 - sp, ky, 12 + sp * 2, 2);
    if (!back && !side) { px(cx - 1, ky + 1, P.plate); px(cx, ky + 1, P.plate); }

    // ── LEGS ──────────────────────────────────────────────────────────────
    // FOUR ROWS AND A FOUR-PIXEL GAP: greave over boot, not a boot cap. The
    // brief asks for a strong leg silhouette and it is also the fastest BIPED
    // read there is — an earlier build spent three rows on boots alone and the
    // lower body fused with the kama into one dark mass.
    const gy = ky + 2;
    let lx = cx - 6, ly = gy, rx = cx + 2, ry = gy;
    if (pose === 'walkA') { lx = cx - 7; ly = gy - 1; rx = cx + 3; ry = gy; }
    else if (pose === 'walkB') { lx = cx - 5; ly = gy; rx = cx + 1; ry = gy - 1; }
    else if (pose === 'strafe') { lx = cx - 8; rx = cx + 4; }
    else if (pose === 'windup' || pose === 'ready') { lx = cx - 7; rx = cx + 3; }
    else if (hurt) { lx = cx - 8; ly = gy; rx = cx + 4; ry = gy - 1; }
    const leg = (x, y) => {
      rect(x, y, 4, 2, P.body); hl(y, x, x + 3, P.plate);
      rect(x, y + 2, 4, 2, P.deep); hl(y + 3, x, x + 3, P.black);
      vl(x - 1, y, y + 3, P.black); vl(x + 4, y, y + 3, P.black);
    };
    leg(lx, ly); leg(rx, ry);

    // Hit flash — the whole chest goes white for the frame, as the rank and
    // file already do.
    if (hurt) { hl(ty + 4, cx - 4, cx + 3, P.white); hl(ty + 5, cx - 4, cx + 3, P.white); }
  }

  POSES.forEach((p, i) => { F = i; draw(p); });
  tex.refresh();
  for (let i = 0; i < N; i++) tex.add(i, 0, i * W * S, 0, W * S, H * S);

  // ── THE WEAPON OVERLAY ────────────────────────────────────────────────────
  // 22x8 at scale 4. Painted EAST-facing, held end LEFT, at the same origin
  // convention as every other overlay. Heavier than the E-11 the rank and file
  // carry (18x8) — a braced repeater, with a blue core line tying it to the
  // visor. DARKER THAN THE ARMOUR, ALWAYS: an earlier build painted it in the
  // body's own mid-greys and at 1x it photographed as a pale slab laid across
  // his chest, the weapon out-reading the man carrying it.
  const GW = 22, GH = 8;
  if (scene.textures.exists(gunKey)) scene.textures.remove(gunKey);
  const gtex = scene.textures.createCanvas(gunKey, GW * S, GH * S);
  const g = gtex.getContext();
  g.imageSmoothingEnabled = false;
  const gpx = (x, y, c) => { g.fillStyle = c; g.fillRect(x * S, y * S, S, S); };
  const grect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) gpx(x + i, y + j, c); };
  const ghl = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) gpx(x, y, c); };
  grect(0, 2, 3, 4, P.deep);
  ghl(2, 0, 2, P.body); ghl(5, 0, 2, P.black);
  grect(3, 1, 7, 5, P.deep);
  ghl(1, 3, 9, P.body); ghl(5, 3, 9, P.black);
  grect(5, 3, 4, 1, P.vis); gpx(5, 3, P.visHot);
  grect(7, 6, 3, 2, P.deep); ghl(7, 7, 9, P.black);
  grect(10, 2, 10, 2, P.deep);
  ghl(2, 10, 19, P.body); ghl(4, 10, 19, P.black);
  gpx(12, 1, P.body); gpx(16, 1, P.body);
  gpx(20, 2, P.plate); gpx(21, 2, P.visHot);
  gtex.refresh();

  return {
    bodyKey, gunKey, poses: POSES, w: W * S, h: H * S, gw: GW * S, gh: GH * S,
    // ONE ANGLE PER POSE. The offset is not authored: the renderer places it at
    // `radius - 4` along this bearing, which is the rule `Enemy.preUpdate` uses
    // for every weapon overlay in the game. An authored dx/dy would be a second
    // way of saying the same thing and would drift away from it.
    gun: {
      idle: 0.62, back: null, side: 0.10,
      walkA: 0.62, walkB: 0.62, strafe: 0.34,
      ready: 0.04, fire: 0.04, recoil: -0.16, windup: -0.62,
      stagger: 1.25, broken: 0.62,
    },
    gunOffset: 7,
  };
};
