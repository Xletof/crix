// Programmatic pixel-art system for the Wild West theme.
// Every sprite, tile and effect is painted at a low logical resolution and
// then rendered at 1 logical pixel = SCALE screen pixels, producing chunky,
// crisp pixel art when combined with Phaser's pixelArt mode.

// ── Palette ────────────────────────────────────────────────────────────────
// Tightly curated wild-west palette. Use these constants everywhere so the
// whole game shares one visual identity.
export const PAL = {
  // Earth / dust
  dirtDeep:   '#1a0e06',
  dirtDark:   '#2a1810',
  dirtMid:    '#4a2818',
  dirtBrown:  '#6a3a20',
  dirtTan:    '#a87848',
  dirtSand:   '#c89868',
  dirtLight:  '#d4a96a',
  dirtCream:  '#e8c898',
  // Wood / hat
  wood:       '#5a3018',
  woodMid:    '#8a5828',
  woodLight:  '#b08040',
  // Iron / steel
  ironDark:   '#1c1c20',
  iron:       '#3a3a3e',
  ironLight:  '#5a5a5e',
  steel:      '#909090',
  steelLight: '#c0c0c0',
  // Skin
  skin:       '#d49060',
  skinLight:  '#e8b078',
  skinShade:  '#a86040',
  // Bandit red / blood
  red:        '#cc2020',
  redDark:    '#8a1010',
  redDeep:    '#4a0808',
  // Gold / brass (sheriff badge)
  gold:       '#ffd040',
  goldDark:   '#b07820',
  // Bone / teeth
  bone:       '#f0e0b8',
  boneShade:  '#c8a878',
  // Eye / shadow
  eyeDark:    '#100804',
  // FX accents
  fire:       '#ff7020',
  fireBright: '#ffc040',
  smokeLite:  '#a08070',
  // Shooter accents (slightly off-theme purple-ish for visual distinction)
  shooterCloth: '#5a2828',
  shooterTrim: '#a85020',
  // Toxic-ish acid (NOT used currently, reserved)
  acid:       '#88cc40',
};

// ── Pixel canvas helper ───────────────────────────────────────────────────
// Wraps a Phaser CanvasTexture so we can paint at logical pixel coordinates
// and have everything scaled up uniformly. Provides primitive helpers
// (px, rect, hline, vline, mirror) used by every sprite painter below.
export class PixelCanvas {
  constructor(scene, key, logicalW, logicalH, scale = 4) {
    this.scale = scale;
    this.w = logicalW;
    this.h = logicalH;
    this.key = key;
    this.tex = scene.textures.createCanvas(key, logicalW * scale, logicalH * scale);
    this.ctx = this.tex.getContext();
    // Disable any smoothing — we want crisp pixels
    if (this.ctx.imageSmoothingEnabled !== undefined) {
      this.ctx.imageSmoothingEnabled = false;
    }
  }
  px(x, y, color) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
  }
  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * this.scale, y * this.scale, w * this.scale, h * this.scale);
  }
  hline(y, x1, x2, color) {
    this.rect(x1, y, x2 - x1 + 1, 1, color);
  }
  vline(x, y1, y2, color) {
    this.rect(x, y1, 1, y2 - y1 + 1, color);
  }
  // Paint a pixel + its horizontal mirror across an axis (for symmetric chars).
  mirrorPx(cx, x, y, color) {
    this.px(cx + x, y, color);
    if (x !== 0) this.px(cx - x, y, color);
  }
  // Outline a filled circle of radius r in logical pixels, using
  // a midpoint-style approximation.
  circle(cx, cy, r, color) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, color);
      }
    }
  }
  finish() {
    this.tex.refresh();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARACTERS  — all face UP (gun/fists at top of sprite, feet at bottom).
// ═══════════════════════════════════════════════════════════════════════════

// ── PLAYER: Sheriff with revolver (24×24, scale 4 → 96×96 texture) ─────────
export function paintPlayer(scene, key = 'player') {
  const c = new PixelCanvas(scene, key, 24, 24, 4);
  const cx = 12; // center axis for body
  // GUN — revolver pointing UP
  // Barrel
  c.vline(11, 2, 8, PAL.iron);
  c.vline(12, 2, 8, PAL.steel);
  c.vline(13, 2, 8, PAL.iron);
  // Front sight
  c.px(12, 1, PAL.steelLight);
  // Cylinder (chunky body of revolver)
  c.rect(10, 9, 5, 3, PAL.ironLight);
  c.rect(11, 10, 3, 1, PAL.steel);
  c.px(12, 10, PAL.steelLight);
  // Hammer above grip
  c.rect(11, 11, 3, 1, PAL.iron);

  // HANDS (gripping revolver)
  c.rect(9, 12, 7, 2, PAL.skinShade);
  c.hline(13, 10, 14, PAL.skin);

  // HAT — wide cowboy brim (rows 13–14)
  c.hline(13, 3, 20, PAL.wood);
  c.hline(14, 2, 21, PAL.wood);
  c.hline(13, 4, 19, PAL.woodMid);
  c.hline(14, 4, 19, PAL.woodMid);
  // Brim front shadow
  c.hline(15, 7, 16, PAL.dirtDark);
  // Hat crown (top of head, peeking above brim)
  c.rect(8, 11, 8, 3, PAL.wood);
  c.rect(9, 11, 6, 1, PAL.woodMid);
  // Hat red band
  c.hline(12, 8, 15, PAL.red);
  c.px(11, 12, PAL.redDark);
  c.px(12, 12, PAL.gold); // small brass medallion
  // Hat top dent
  c.px(11, 11, PAL.dirtDark);
  c.px(12, 11, PAL.dirtDark);

  // FACE peeking under brim (rows 15–17)
  c.rect(9, 15, 6, 2, PAL.skin);
  c.rect(10, 16, 4, 1, PAL.skinLight);
  // Eyes (squinting)
  c.px(10, 15, PAL.eyeDark);
  c.px(13, 15, PAL.eyeDark);
  // Mustache (badass cowboy)
  c.hline(16, 10, 13, PAL.dirtDark);
  c.px(9, 16, PAL.dirtDark);
  c.px(14, 16, PAL.dirtDark);

  // SHOULDERS / BODY (rows 17–20)
  // Vest (leather brown with shoulder pads)
  c.rect(7, 17, 10, 4, PAL.dirtMid);
  c.rect(6, 18, 12, 2, PAL.dirtMid);
  // Vest shading
  c.hline(17, 8, 15, PAL.dirtBrown);
  c.hline(20, 8, 15, PAL.dirtDeep);
  // Shoulder highlights
  c.px(6, 18, PAL.dirtBrown);
  c.px(17, 18, PAL.dirtBrown);
  // SHIRT under vest (showing at neck + sides)
  c.hline(17, 11, 12, PAL.bone);
  c.px(11, 18, PAL.bone);
  c.px(12, 18, PAL.bone);
  // SHERIFF BADGE — gold star on left chest
  c.px(9, 18, PAL.gold);
  c.px(9, 19, PAL.gold);
  c.px(10, 19, PAL.goldDark);
  c.px(8, 19, PAL.gold);
  c.px(9, 20, PAL.gold);

  // BELT
  c.hline(21, 7, 16, PAL.dirtDeep);
  c.px(11, 21, PAL.goldDark); // buckle
  c.px(12, 21, PAL.gold);

  // LEGS / PANTS (rows 22–23)
  c.rect(7, 22, 4, 2, PAL.dirtDark);
  c.rect(13, 22, 4, 2, PAL.dirtDark);
  c.px(8, 22, PAL.dirtMid);
  c.px(14, 22, PAL.dirtMid);

  c.finish();
}

// ── GRUNT: Outlaw bandit with raised fists (20×20) ─────────────────────────
export function paintGrunt(scene, key = 'grunt') {
  const c = new PixelCanvas(scene, key, 20, 20, 4);
  // RAISED FISTS at top (melee threat) — rows 0–4
  // Left fist
  c.rect(4, 1, 3, 3, PAL.skinShade);
  c.rect(5, 1, 1, 1, PAL.skin);
  c.px(4, 3, PAL.dirtDark);
  c.px(6, 3, PAL.dirtDark);
  // Right fist
  c.rect(13, 1, 3, 3, PAL.skinShade);
  c.rect(14, 1, 1, 1, PAL.skin);
  c.px(13, 3, PAL.dirtDark);
  c.px(15, 3, PAL.dirtDark);
  // Arms reaching up
  c.rect(5, 4, 2, 5, PAL.dirtBrown);
  c.rect(13, 4, 2, 5, PAL.dirtBrown);
  c.hline(4, 5, 5, PAL.dirtDark);
  c.hline(4, 14, 15, PAL.dirtDark);

  // HAT — battered, low-crown
  c.hline(7, 5, 14, PAL.dirtDeep);
  c.hline(8, 4, 15, PAL.dirtDeep);
  c.rect(7, 6, 6, 1, PAL.dirtDark);
  c.px(8, 6, PAL.dirtDeep);
  c.px(11, 6, PAL.dirtDeep);

  // HEAD (rows 9–13)
  c.rect(7, 9, 6, 4, PAL.skinShade);
  c.rect(8, 10, 4, 2, PAL.skin);
  // Eyes (angry, narrow)
  c.px(8, 10, PAL.eyeDark);
  c.px(11, 10, PAL.eyeDark);
  // BANDANA MASK over lower face
  c.hline(11, 7, 12, PAL.red);
  c.hline(12, 7, 12, PAL.redDark);
  c.px(7, 11, PAL.redDark);
  c.px(12, 11, PAL.redDark);
  // Bandana knot dangle
  c.px(13, 12, PAL.red);

  // BODY / SHOULDERS (rows 13–16)
  c.rect(6, 13, 8, 3, PAL.dirtMid);
  c.rect(5, 14, 10, 2, PAL.dirtMid);
  c.hline(13, 7, 12, PAL.dirtBrown);
  c.hline(15, 7, 12, PAL.dirtDeep);
  // Ammo belt
  c.hline(16, 5, 14, PAL.dirtDark);
  c.px(7, 16, PAL.gold);
  c.px(10, 16, PAL.gold);
  c.px(13, 16, PAL.gold);

  // LEGS (rows 17–19)
  c.rect(6, 17, 3, 3, PAL.dirtDeep);
  c.rect(11, 17, 3, 3, PAL.dirtDeep);
  c.px(7, 17, PAL.dirtDark);
  c.px(12, 17, PAL.dirtDark);
  c.finish();
}

// ── SHOOTER: Gunslinger with pistol (20×20) ────────────────────────────────
export function paintShooter(scene, key = 'shooter') {
  const c = new PixelCanvas(scene, key, 20, 20, 4);

  // PISTOL pointing UP (top of sprite)
  // Barrel
  c.vline(13, 2, 6, PAL.iron);
  c.vline(14, 2, 6, PAL.steel);
  c.px(13, 1, PAL.steelLight);
  // Slide
  c.rect(12, 6, 3, 2, PAL.ironLight);
  // Hammer
  c.px(13, 8, PAL.iron);

  // RIGHT ARM raised holding pistol
  c.rect(12, 9, 3, 4, PAL.shooterCloth);
  c.hline(9, 12, 14, PAL.shooterTrim);
  // Hand on grip
  c.rect(11, 8, 3, 2, PAL.skin);
  c.px(13, 8, PAL.skinShade);

  // LEFT ARM at side
  c.rect(4, 11, 2, 5, PAL.shooterCloth);
  c.px(5, 16, PAL.skin); // hand peek

  // HAT — wide-brim gunslinger (black/dark)
  c.hline(8, 4, 13, PAL.dirtDeep);
  c.hline(9, 3, 14, PAL.dirtDeep);
  c.rect(6, 7, 5, 2, PAL.dirtDeep);
  c.hline(7, 7, 10, PAL.dirtDark);
  c.px(7, 7, PAL.shooterTrim); // hat band detail
  c.px(9, 7, PAL.shooterTrim);

  // FACE under brim (rows 10–12)
  c.rect(6, 10, 5, 3, PAL.skinShade);
  c.hline(11, 7, 9, PAL.skin);
  // Glowing eyes (dangerous gunslinger)
  c.px(7, 10, PAL.fireBright);
  c.px(9, 10, PAL.fireBright);
  c.px(7, 11, PAL.fire);
  c.px(9, 11, PAL.fire);
  // Mouth/jaw
  c.hline(12, 7, 9, PAL.dirtDark);

  // BODY — long coat (duster)
  c.rect(4, 13, 9, 3, PAL.shooterCloth);
  c.hline(13, 5, 11, '#7a3838');
  c.hline(15, 5, 11, PAL.redDeep);
  c.vline(8, 13, 18, PAL.dirtDeep); // center coat seam
  // Vest detail
  c.rect(6, 14, 5, 1, '#6a2828');
  c.px(8, 14, PAL.gold);

  // COAT LOWER (rows 16–18)
  c.rect(5, 16, 7, 2, PAL.shooterCloth);
  c.hline(17, 5, 11, PAL.redDeep);

  // BOOTS
  c.rect(5, 18, 3, 2, PAL.dirtDeep);
  c.rect(10, 18, 3, 2, PAL.dirtDeep);
  c.px(6, 18, PAL.dirtDark);
  c.px(11, 18, PAL.dirtDark);
  c.finish();
}

// ── BOSS: Bandit King with dual pistols (40×40, scale 4 → 160×160) ─────────
export function paintBoss(scene, key = 'boss') {
  const c = new PixelCanvas(scene, key, 40, 40, 4);

  // ── LEFT PISTOL pointing UP ───────────────────────────────────────────
  c.vline(11, 4, 13, PAL.iron);
  c.vline(12, 4, 13, PAL.steel);
  c.px(11, 3, PAL.steelLight);
  c.rect(10, 13, 4, 2, PAL.ironLight);
  // Hand
  c.rect(10, 15, 4, 3, PAL.skinShade);

  // ── RIGHT PISTOL pointing UP ──────────────────────────────────────────
  c.vline(27, 4, 13, PAL.iron);
  c.vline(28, 4, 13, PAL.steel);
  c.px(27, 3, PAL.steelLight);
  c.rect(26, 13, 4, 2, PAL.ironLight);
  c.rect(26, 15, 4, 3, PAL.skinShade);

  // ── ARMS ──────────────────────────────────────────────────────────────
  c.rect(9, 17, 6, 4, PAL.dirtMid);
  c.rect(25, 17, 6, 4, PAL.dirtMid);
  c.hline(20, 10, 13, PAL.dirtDark);
  c.hline(20, 26, 29, PAL.dirtDark);

  // ── HAT — MASSIVE bandit-king brim ────────────────────────────────────
  c.hline(13, 7, 32, PAL.dirtDeep);
  c.hline(14, 5, 34, PAL.dirtDeep);
  c.hline(15, 4, 35, PAL.dirtDeep);
  c.hline(13, 10, 29, PAL.dirtDark);
  c.hline(14, 9, 30, PAL.dirtDark);
  c.hline(15, 11, 28, PAL.iron);
  // Hat crown (taller, more imposing)
  c.rect(13, 9, 14, 4, PAL.dirtDark);
  c.rect(14, 9, 12, 1, PAL.dirtDeep);
  c.rect(13, 12, 14, 1, PAL.ironDark);
  // Skull insignia on hat band (Bandit King)
  c.rect(18, 11, 4, 2, PAL.bone);
  c.px(19, 12, PAL.eyeDark);
  c.px(20, 12, PAL.eyeDark);
  // Hat side feather/trim
  c.px(15, 8, PAL.red);
  c.px(16, 7, PAL.red);
  c.px(17, 8, PAL.red);

  // ── FACE / HEAD ──────────────────────────────────────────────────────
  c.rect(14, 16, 12, 5, PAL.skinShade);
  c.rect(16, 17, 8, 3, PAL.skin);
  // SCAR across face
  c.hline(17, 14, 25, PAL.redDark);
  c.px(15, 16, PAL.red);
  // EYES — menacing
  c.rect(15, 18, 3, 2, PAL.eyeDark);
  c.rect(22, 18, 3, 2, PAL.eyeDark);
  c.px(16, 18, PAL.fireBright); // gleam
  c.px(23, 18, PAL.fireBright);
  // Big mustache
  c.hline(20, 15, 24, PAL.dirtDark);
  c.hline(21, 14, 25, PAL.dirtDeep);
  c.px(13, 20, PAL.dirtDark);
  c.px(26, 20, PAL.dirtDark);
  // Lower jaw shadow
  c.hline(22, 16, 23, PAL.dirtDark);

  // ── BANDOLIER (chest, X-cross of bullets) ────────────────────────────
  for (let i = 0; i < 8; i++) {
    c.px(12 + i, 22 + i, PAL.gold);     // diagonal \
    c.px(11 + i, 23 + i, PAL.goldDark);
  }
  for (let i = 0; i < 8; i++) {
    c.px(27 - i, 22 + i, PAL.gold);     // diagonal /
    c.px(28 - i, 23 + i, PAL.goldDark);
  }

  // ── TORSO / DUSTER COAT ──────────────────────────────────────────────
  c.rect(10, 22, 20, 8, PAL.dirtMid);
  c.hline(22, 12, 27, PAL.dirtBrown);
  c.hline(29, 11, 28, PAL.dirtDeep);
  c.rect(9, 24, 22, 5, PAL.dirtMid);
  c.hline(24, 11, 28, PAL.dirtBrown);
  // Coat seam (center)
  c.vline(19, 22, 32, PAL.dirtDeep);
  c.vline(20, 22, 32, PAL.dirtDark);
  // SHIRT showing at neck
  c.rect(18, 22, 4, 1, PAL.bone);
  // Belt buckle (giant brass)
  c.rect(17, 30, 6, 2, PAL.goldDark);
  c.hline(30, 18, 21, PAL.gold);
  c.px(19, 31, PAL.dirtDeep);
  c.px(20, 31, PAL.dirtDeep);

  // ── HOLSTERS (sides) ─────────────────────────────────────────────────
  c.rect(8, 30, 3, 4, PAL.dirtDeep);
  c.rect(29, 30, 3, 4, PAL.dirtDeep);
  c.px(9, 30, PAL.gold);
  c.px(30, 30, PAL.gold);

  // ── LEGS / PANTS ─────────────────────────────────────────────────────
  c.rect(11, 33, 7, 5, PAL.dirtDark);
  c.rect(22, 33, 7, 5, PAL.dirtDark);
  c.hline(33, 12, 17, PAL.dirtMid);
  c.hline(33, 23, 28, PAL.dirtMid);
  c.hline(37, 12, 17, PAL.dirtDeep);
  c.hline(37, 23, 28, PAL.dirtDeep);
  // Boots
  c.rect(11, 37, 7, 2, PAL.dirtDeep);
  c.rect(22, 37, 7, 2, PAL.dirtDeep);
  // Spurs (gold)
  c.px(11, 38, PAL.gold);
  c.px(28, 38, PAL.gold);

  c.finish();
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT TILES
// ═══════════════════════════════════════════════════════════════════════════

// ── BACKDROP: cracked dry dirt with stripes and pebbles ────────────────────
export function paintBackdrop(scene, key, worldW, worldH) {
  // We paint at the full world size, scale 1 (no pixel-multiplication — it's
  // already large), then refresh. Using fillRect directly because we're at
  // texture-pixel resolution.
  const tex = scene.textures.createCanvas(key, worldW, worldH);
  const ctx = tex.getContext();
  // Base dirt
  ctx.fillStyle = PAL.dirtLight;
  ctx.fillRect(0, 0, worldW, worldH);
  // Lighter sandy patches (broad blotches)
  ctx.fillStyle = PAL.dirtCream;
  ctx.globalAlpha = 0.42;
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * worldW;
    const y = Math.random() * worldH;
    const r = 40 + Math.random() * 80;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Darker dirt patches
  ctx.fillStyle = PAL.dirtTan;
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * worldW;
    const y = Math.random() * worldH;
    const r = 30 + Math.random() * 60;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cracks (thin lines)
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = PAL.dirtMid;
  ctx.lineWidth = 2;
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * worldW;
    const y = Math.random() * worldH;
    const len = 20 + Math.random() * 70;
    const ang = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    // Crack branch
    ctx.lineTo(x + Math.cos(ang + 0.5) * len * 1.4, y + Math.sin(ang + 0.5) * len * 1.4);
    ctx.stroke();
  }
  // Scatter pebbles
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 700; i++) {
    const x = Math.floor(Math.random() * worldW);
    const y = Math.floor(Math.random() * worldH);
    const s = Math.random() < 0.7 ? 2 : 4;
    ctx.fillStyle = Math.random() < 0.5 ? PAL.dirtBrown : PAL.dirtMid;
    ctx.fillRect(x, y, s, s);
  }
  // Faint diagonal sun stripes for cinematic feel
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = PAL.dirtCream;
  for (let i = -worldH; i < worldW; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + worldH, worldH);
    ctx.lineTo(i + worldH + 14, worldH);
    ctx.lineTo(i + 14, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  tex.refresh();
}

// ── TUMBLEWEED (bush replacement, 28×28 logical pixels at scale 3) ────────
export function paintTumbleweed(scene, key = 'bush') {
  const c = new PixelCanvas(scene, key, 28, 28, 4);
  const cx = 14, cy = 14;
  // Outer dark ring (silhouette)
  for (let a = 0; a < 60; a++) {
    const ang = (a / 60) * Math.PI * 2;
    const r = 11 + Math.random() * 1.5;
    c.px(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), PAL.dirtDeep);
  }
  // Mid layer
  for (let a = 0; a < 80; a++) {
    const ang = (a / 80) * Math.PI * 2;
    const r = 7 + Math.random() * 3;
    c.px(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), PAL.dirtBrown);
  }
  // Inner highlight twigs
  for (let a = 0; a < 90; a++) {
    const ang = (a / 90) * Math.PI * 2;
    const r = 3 + Math.random() * 4;
    c.px(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), PAL.woodLight);
  }
  // Stray twig strands (radial lines)
  for (let k = 0; k < 18; k++) {
    const ang = Math.random() * Math.PI * 2;
    const len = 6 + Math.random() * 5;
    for (let r = 2; r < len; r++) {
      if (Math.random() < 0.55) {
        c.px(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), PAL.dirtMid);
      }
    }
  }
  // Bright tan accents (golden highlights catching the light)
  for (let k = 0; k < 12; k++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 6;
    c.px(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), PAL.dirtLight);
  }
  c.finish();
}

// ── CRATE (wall replacement, 26×26 logical at scale 3) ─────────────────────
export function paintCrate(scene, key = 'wall') {
  const c = new PixelCanvas(scene, key, 26, 26, 4);
  // Wood box base
  c.rect(1, 1, 24, 24, PAL.wood);
  // Plank borders
  c.rect(2, 2, 22, 22, PAL.woodMid);
  // Wood grain (horizontal planks)
  c.hline(7, 2, 23, PAL.wood);
  c.hline(13, 2, 23, PAL.wood);
  c.hline(19, 2, 23, PAL.wood);
  // Plank highlights
  c.hline(3, 3, 22, PAL.woodLight);
  c.hline(9, 3, 22, PAL.woodLight);
  c.hline(15, 3, 22, PAL.woodLight);
  c.hline(21, 3, 22, PAL.woodLight);
  // Iron banding (top + bottom)
  c.rect(1, 1, 24, 2, PAL.iron);
  c.rect(1, 23, 24, 2, PAL.iron);
  // Iron corner brackets
  c.rect(1, 1, 4, 4, PAL.ironDark);
  c.rect(21, 1, 4, 4, PAL.ironDark);
  c.rect(1, 21, 4, 4, PAL.ironDark);
  c.rect(21, 21, 4, 4, PAL.ironDark);
  // Rivets (light dots on corners)
  c.px(2, 2, PAL.steelLight);
  c.px(23, 2, PAL.steelLight);
  c.px(2, 23, PAL.steelLight);
  c.px(23, 23, PAL.steelLight);
  // Center brand/label
  c.rect(10, 10, 6, 6, PAL.dirtDark);
  c.hline(11, 11, 14, PAL.gold);
  c.hline(13, 11, 14, PAL.gold);
  c.hline(15, 11, 14, PAL.gold);
  c.px(12, 12, PAL.goldDark);
  c.px(13, 13, PAL.goldDark);
  c.px(14, 14, PAL.goldDark);
  c.finish();
}

// ═══════════════════════════════════════════════════════════════════════════
// BULLETS / FX
// ═══════════════════════════════════════════════════════════════════════════
export function paintBullet(scene, key, palCore, palTrail, len = 5) {
  // Bullet is a small elongated tracer pointing UP. Phaser rotates to angle.
  const w = 4, h = len + 4;
  const c = new PixelCanvas(scene, key, w, h, 3);
  // Trail tail (faint)
  c.px(1, h - 1, palTrail);
  c.px(2, h - 1, palTrail);
  c.px(1, h - 2, palTrail);
  c.px(2, h - 2, palTrail);
  // Body
  c.rect(1, 1, 2, len + 1, palCore);
  // Bright tip
  c.px(1, 0, '#ffffff');
  c.px(2, 0, '#ffffff');
  c.finish();
}

export function paintMuzzle(scene, key) {
  // Starburst flash (10×10 logical at scale 3)
  const c = new PixelCanvas(scene, key, 10, 10, 3);
  const cx = 5, cy = 5;
  // Bright core
  c.rect(4, 4, 2, 2, '#ffffff');
  c.rect(3, 3, 4, 4, PAL.fireBright);
  // Cross arms
  c.hline(5, 0, 9, PAL.fire);
  c.vline(5, 0, 9, PAL.fire);
  c.hline(4, 1, 8, PAL.fire);
  c.vline(4, 1, 8, PAL.fire);
  // Diagonal sparks
  c.px(2, 2, PAL.fireBright);
  c.px(7, 2, PAL.fireBright);
  c.px(2, 7, PAL.fireBright);
  c.px(7, 7, PAL.fireBright);
  c.finish();
}

export function paintSpark(scene, key, color, size = 3) {
  const c = new PixelCanvas(scene, key, size * 2, size * 2, 3);
  c.rect(size - 1, size - 1, 2, 2, color);
  c.px(size - 1, size, '#ffffff');
  c.finish();
}

export function paintShadow(scene, key, r) {
  const tex = scene.textures.createCanvas(key, r * 2, r * 2);
  const ctx = tex.getContext();
  ctx.fillStyle = 'rgba(20, 8, 4, 0.45)';
  ctx.beginPath();
  ctx.ellipse(r, r, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

// ═══════════════════════════════════════════════════════════════════════════
// HUD UI: joystick, super button
// ═══════════════════════════════════════════════════════════════════════════
export function paintJoystick(scene) {
  // BASE
  const baseR = 110;
  const base = scene.textures.createCanvas('joystick-base', baseR * 2, baseR * 2);
  const bctx = base.getContext();
  // Outer wood ring
  bctx.fillStyle = 'rgba(58, 26, 8, 0.55)';
  bctx.beginPath();
  bctx.arc(baseR, baseR, baseR - 4, 0, Math.PI * 2);
  bctx.fill();
  // Inner sand fill
  bctx.fillStyle = 'rgba(212, 169, 106, 0.18)';
  bctx.beginPath();
  bctx.arc(baseR, baseR, baseR - 12, 0, Math.PI * 2);
  bctx.fill();
  // Border ring (gold)
  bctx.strokeStyle = 'rgba(255, 208, 64, 0.7)';
  bctx.lineWidth = 4;
  bctx.beginPath();
  bctx.arc(baseR, baseR, baseR - 6, 0, Math.PI * 2);
  bctx.stroke();
  base.refresh();

  // KNOB
  const knobR = 50;
  const knob = scene.textures.createCanvas('joystick-knob', knobR * 2, knobR * 2);
  const kctx = knob.getContext();
  kctx.fillStyle = PAL.dirtBrown;
  kctx.beginPath();
  kctx.arc(knobR, knobR, knobR - 4, 0, Math.PI * 2);
  kctx.fill();
  kctx.fillStyle = PAL.woodMid;
  kctx.beginPath();
  kctx.arc(knobR, knobR, knobR - 10, 0, Math.PI * 2);
  kctx.fill();
  kctx.fillStyle = 'rgba(255, 208, 64, 0.9)';
  kctx.beginPath();
  kctx.arc(knobR - 12, knobR - 12, knobR * 0.4, 0, Math.PI * 2);
  kctx.fill();
  kctx.strokeStyle = PAL.gold;
  kctx.lineWidth = 3;
  kctx.beginPath();
  kctx.arc(knobR, knobR, knobR - 6, 0, Math.PI * 2);
  kctx.stroke();
  knob.refresh();
}

export function paintSuperButton(scene) {
  // Sheriff's gold star button
  const make = (key, ready) => {
    const r = 60;
    const size = r * 2 + 8;
    const tex = scene.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const cx = size / 2, cy = size / 2;
    // Background disc
    ctx.fillStyle = ready ? 'rgba(58, 26, 8, 0.6)' : 'rgba(20, 14, 6, 0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Gold/brass rim
    ctx.strokeStyle = ready ? PAL.gold : '#5a5040';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    ctx.stroke();
    // Sheriff star (5-pointed)
    const outer = r * 0.48, inner = r * 0.2;
    ctx.fillStyle = ready ? PAL.gold : '#3a3024';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // Star highlight
    if (ready) {
      ctx.fillStyle = '#fff5a8';
      ctx.beginPath();
      ctx.arc(cx - r * 0.12, cy - r * 0.18, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.refresh();
  };
  make('super-btn', true);
  make('super-btn-off', false);
}
