// Programmatic pixel-art system — Star Wars: Mandalorian on the Death Star
// Multi-frame SpriteSheet for walk/idle/fire animations.
// Characters face UP (weapon at y=0), Phaser applies setRotation() to aim.

// ── Star Wars Palette ──────────────────────────────────────────────────────
export const PAL = {
  // Space / base darks
  black:        '#06060c',
  spaceDark:    '#0a0c14',
  // Imperial metal
  impDark:      '#14161c',
  impMid:       '#1e2028',
  impGrey:      '#2e3038',
  impLight:     '#3e4048',
  impSilver:    '#5a5c62',
  impSheen:     '#7a7c80',
  metalLight:   '#9a9c9e',
  white:        '#e8e8f0',
  offWhite:     '#c8c8d0',
  // Beskar (Mandalorian armor) — cool silver
  beskarDeep:   '#252830',
  beskarDark:   '#353840',
  beskar:       '#4a5058',
  beskarMid:    '#6a7080',
  beskarLight:  '#8a9aa8',
  beskarShine:  '#b0c8d0',
  // Stormtrooper white armor
  troopWhite:   '#dcdce8',
  troopLight:   '#eeeef8',
  troopShade:   '#9898a8',
  troopDark:    '#606070',
  troopBlack:   '#10101a',
  // Death Trooper all-black
  dthDark:      '#0c0c10',
  dthMid:       '#181820',
  dthLight:     '#242430',
  dthLED:       '#20d020',
  dthLEDBright: '#80ff80',
  // Darth Vader
  vaderHelm:    '#0a0a0e',
  vaderArmor:   '#12121a',
  vaderSheen:   '#202028',
  vaderBreath:  '#282832',
  // Lightsaber / energy
  saberRed:     '#ee1010',
  saberRedGlow: '#ff6040',
  saberRedCore: '#ffe8e0',
  saberRedTip:  '#ffffff',
  // Blaster bolts
  boltRed:      '#ff2828',
  boltRedGlow:  '#ff8888',
  boltRedCore:  '#ffe0e0',
  boltGreen:    '#10ee10',
  boltGreenGlow:'#88ff88',
  boltGreenCore:'#e0ffe0',
  // Missile
  rocketBody:   '#3a3a3e',
  rocketFin:    '#602018',
  rocketFire:   '#ff6010',
  rocketFireBrt:'#ffb840',
  // Explosion
  expCore:      '#ffffff',
  expBright:    '#ffee20',
  expMid:       '#ff8810',
  expDark:      '#cc3010',
  expSmoke:     '#504848',
  // Skin (Moff, alien glimpse)
  skin:         '#c87848',
  skinLight:    '#e09058',
  skinShade:    '#8a5030',
  // Cape fabric
  capeBlack:    '#08080e',
  cape:         '#10101a',
  capeShade:    '#1a1a26',
  // Gold / Imperial trim
  gold:         '#dea020',
  goldBright:   '#ffc830',
  goldDark:     '#8a6010',
  // Bacta healing blue
  bactaBlue:    '#1898e8',
  bactaMid:     '#40b8ff',
  bactaLight:   '#90d8ff',
  bactaGlow:    '#0060aa',
  // Environment
  floorDark:    '#0c0c12',
  floorMid:     '#161620',
  floorPanel:   '#1e1e28',
  floorLine:    '#0a0a16',
  floorLight:   '#282838',
  stripRed:     '#cc0000',
  stripRedGlow: '#ff2020',
  stripBlue:    '#0038bb',
  stripBluGlow: '#2060ff',
  ledRed:       '#ff0808',
  ledGreen:     '#08ee08',
  // FX
  sparkWhite:   '#ffffff',
  sparkYellow:  '#ffdd40',
  sparkBlue:    '#40a0ff',
};

// ── PixelCanvas (single-frame, unchanged from Wild West for env / FX) ────────
export class PixelCanvas {
  constructor(scene, key, logicalW, logicalH, scale = 4) {
    this.scale = scale;
    this.w = logicalW;
    this.h = logicalH;
    this.key = key;
    this.tex = scene.textures.createCanvas(key, logicalW * scale, logicalH * scale);
    this.ctx = this.tex.getContext();
    if (this.ctx.imageSmoothingEnabled !== undefined) this.ctx.imageSmoothingEnabled = false;
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
  hline(y, x1, x2, color) { this.rect(x1, y, x2 - x1 + 1, 1, color); }
  vline(x, y1, y2, color) { this.rect(x, y1, 1, y2 - y1 + 1, color); }
  circle(cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r) this.px(cx + dx, cy + dy, color);
  }
  finish() { this.tex.refresh(); }
}

// ── SpriteSheet (multi-frame, horizontal strip layout) ────────────────────
export class SpriteSheet {
  constructor(scene, key, logicalW, logicalH, frameCount, scale = 4) {
    this.scene = scene;
    this.scale = scale;
    this.logW = logicalW;
    this.logH = logicalH;
    this.frameCount = frameCount;
    this.key = key;
    this.tex = scene.textures.createCanvas(key, logicalW * frameCount * scale, logicalH * scale);
    this.ctx = this.tex.getContext();
    if (this.ctx.imageSmoothingEnabled !== undefined) this.ctx.imageSmoothingEnabled = false;
    this._f = 0;
  }
  frame(n) { this._f = n; return this; }
  _ox() { return this._f * this.logW * this.scale; }
  px(x, y, color) {
    if (x < 0 || y < 0 || x >= this.logW || y >= this.logH) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this._ox() + x * this.scale, y * this.scale, this.scale, this.scale);
  }
  rect(x, y, w, h, color) {
    const cx = Math.max(0, x), cy = Math.max(0, y);
    const cw = Math.min(w, this.logW - cx), ch = Math.min(h, this.logH - cy);
    if (cw <= 0 || ch <= 0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this._ox() + cx * this.scale, cy * this.scale, cw * this.scale, ch * this.scale);
  }
  hline(y, x1, x2, color) { this.rect(x1, y, x2 - x1 + 1, 1, color); }
  vline(x, y1, y2, color) { this.rect(x, y1, 1, y2 - y1 + 1, color); }
  circle(cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r) this.px(cx + dx, cy + dy, color);
  }
  copyFrame(fromF, toF) {
    const fw = this.logW * this.scale, fh = this.logH * this.scale;
    const data = this.ctx.getImageData(fromF * fw, 0, fw, fh);
    this.ctx.putImageData(data, toF * fw, 0);
  }
  finish() {
    this.tex.refresh();
    const fw = this.logW * this.scale, fh = this.logH * this.scale;
    for (let i = 0; i < this.frameCount; i++) {
      this.tex.add(i, 0, i * fw, 0, fw, fh);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARACTERS  — 4-frame sprite sheets: [0]=idle [1]=walkA [2]=walkB [3]=fire
// All face UP (weapon at top). Phaser rotation aims them.
// VOXEL / CUBE-FACE shading: TOP=lightest, FRONT=medium, SIDE=darkest
// ═══════════════════════════════════════════════════════════════════════════

// ── PLAYER: Mandalorian (24×24, 4 frames, scale 4 → 384×96 strip) ────────
export function paintPlayer(scene, key = 'player') {
  const ss = new SpriteSheet(scene, key, 24, 24, 4, 4);

  function drawMando(f, legOffset = 0, fireMode = false) {
    ss.frame(f);
    const C = PAL;

    // ── BLASTER (pointing UP, x=11-12) — voxel depth shading ─────────────
    // Barrel: top edge lighter, body medium, bottom darker
    ss.vline(11, 0, 6, C.impGrey);
    ss.vline(12, 0, 6, C.impSheen);
    ss.px(11, 0, fireMode ? C.boltRed : C.metalLight);   // muzzle
    ss.px(12, 0, fireMode ? C.boltRedGlow : C.metalLight);
    // Barrel top face (1px lighter strip on left edge)
    ss.px(10, 1, C.impLight);
    ss.px(10, 2, C.impLight);
    ss.px(10, 3, C.impLight);
    // Slide body — TOP face brighter, FRONT medium, SIDE dark
    ss.rect(10, 5, 4, 2, C.impLight);    // TOP face of slide
    ss.hline(7, 10, 13, C.impGrey);      // FRONT face (row below top)
    ss.px(9, 5, C.impDark);              // left SIDE shadow
    ss.px(9, 6, C.impDark);
    ss.px(14, 5, C.impDark);             // right SIDE shadow
    ss.px(14, 6, C.impDark);
    // Grip — beskar cube
    ss.rect(10, 7, 4, 2, C.beskar);      // FRONT face
    ss.hline(7, 10, 13, C.beskarMid);    // TOP edge
    ss.px(9, 7, C.beskarDark);           // SIDE shadows
    ss.px(9, 8, C.beskarDark);

    // ── HELMET — drawn as a cubic voxel form ──────────────────────────────
    // TOP face of helmet dome (rows 7-9): brightest, 8px wide
    ss.hline(7, 9,  14, C.beskarLight);  // top-face highlight row
    ss.hline(8, 8,  15, C.beskarMid);    // top-face main
    // 1px dark outline separating top face from front face
    ss.hline(9, 8,  15, C.black);

    // FRONT face of helmet (rows 9-13): base color, full width
    ss.hline(10, 8,  15, C.beskar);
    ss.hline(11, 8,  15, C.beskar);
    ss.hline(12, 8,  15, C.beskar);
    ss.hline(13, 8,  15, C.beskarDark);  // bottom chin — slightly darker

    // T-VISOR: black horizontal band across FRONT face (rows 10-11)
    // This is the key feature — reads as a face, not just dome from above
    ss.hline(10, 9,  14, C.black);       // visor band row 1
    ss.hline(11, 9,  14, C.black);       // visor band row 2
    // Visor glint (thin inner highlight)
    ss.px(10, 10, C.beskarDeep);
    ss.px(13, 10, C.beskarDeep);

    // SIDE faces of helmet (darker beskarDark)
    ss.vline(8,  9, 13, C.beskarDark);   // left side face
    ss.vline(16, 9, 13, C.beskarDark);   // right side face
    // Chin plate (row 13) — darkest
    ss.hline(13, 9,  14, C.beskarDark);

    // Rangefinder stub (right side)
    ss.px(16, 9,  C.beskarDeep);
    ss.px(17, 10, C.beskarDeep);

    // ── PAULDRONS (shoulder armor) — voxel blocks ─────────────────────────
    // Left pauldron: TOP face lighter, FRONT face medium, SIDE darker
    ss.hline(14, 5,  9, C.beskarMid);    // TOP face
    ss.rect(5, 15, 5, 2, C.beskar);      // FRONT face
    ss.vline(5, 15, 16, C.beskarDark);   // left SIDE shadow
    ss.px(9, 15, C.beskarDark);
    ss.px(9, 16, C.beskarDark);
    // Right pauldron
    ss.hline(14, 14, 18, C.beskarMid);   // TOP face
    ss.rect(14, 15, 5, 2, C.beskar);     // FRONT face
    ss.vline(18, 15, 16, C.beskarDark);  // right SIDE shadow
    // Jetpack hint
    ss.px(5,  14, C.beskarDeep);
    ss.px(18, 14, C.beskarDeep);

    // ── ARMS — short voxel blocks ─────────────────────────────────────────
    // Left arm: TOP (row 16 lighter), FRONT (rows 17-18 medium), SIDE (darkest)
    ss.hline(16, 5,  7, C.beskarMid);    // TOP face
    ss.rect(5, 17, 3, 3, C.beskar);      // FRONT face
    ss.vline(5, 17, 19, C.beskarDark);   // SIDE shadow
    // Right arm
    ss.hline(16, 16, 18, C.beskarMid);   // TOP face
    ss.rect(16, 17, 3, 3, C.beskar);     // FRONT face
    ss.vline(18, 17, 19, C.beskarDark);  // SIDE shadow

    // ── CHEST PLATE — voxel block with signet ─────────────────────────────
    ss.hline(16, 9,  14, C.beskarMid);   // TOP edge (lighter)
    ss.rect(8, 17, 8, 4, C.beskar);      // FRONT face
    ss.hline(20, 9,  14, C.beskarDark);  // bottom SIDE shadow
    ss.vline(8,  17, 20, C.beskarDark);  // left SIDE shadow
    ss.vline(15, 17, 20, C.beskarDark);  // right SIDE shadow
    ss.px(10, 17, C.beskarLight);        // chest highlight pixel
    // Signet emblem (Mudhorn/gold)
    ss.px(12, 18, C.gold);
    ss.px(11, 19, C.goldDark);
    ss.px(13, 19, C.goldDark);
    // 1px dark outline separating top edge from front face
    ss.hline(17, 9, 14, C.black);

    // ── CAPE — dark voxel-fabric slabs ────────────────────────────────────
    ss.rect(4, 19, 3, 4, C.cape);        // left cape slab
    ss.rect(17, 19, 3, 4, C.cape);       // right cape slab
    ss.vline(4,  19, 22, C.capeBlack);   // left outer edge shadow
    ss.vline(19, 19, 22, C.capeBlack);   // right outer edge shadow
    ss.px(4, 22, C.capeShade);
    ss.px(19, 22, C.capeShade);

    // ── BELT — thin voxel strip ───────────────────────────────────────────
    ss.hline(21, 8, 15, C.beskarDeep);   // belt strap
    ss.hline(21, 9, 14, C.beskarDark);   // belt front face
    ss.px(11, 21, C.gold);               // buckle
    ss.px(12, 21, C.gold);

    // ── LEGS — chunky voxel blocks ────────────────────────────────────────
    const lx = 8 - legOffset;
    const rx = 13 + legOffset;
    // Left leg: TOP face lighter, FRONT medium, SIDE dark
    ss.hline(22, lx, lx + 3, C.impLight);        // TOP face
    ss.hline(23, lx, lx + 3, C.impGrey);          // FRONT face row 1
    ss.vline(lx, 22, 23, C.impDark);              // SIDE shadow
    // Right leg
    ss.hline(22, rx, rx + 3, C.impLight);
    ss.hline(23, rx, rx + 3, C.impGrey);
    ss.vline(rx + 3, 22, 23, C.impDark);
    // Boots: chunky rectangular voxel
    ss.hline(23, lx - 1, lx + 3, C.beskarMid);   // boot TOP face
    ss.hline(23, rx - 1, rx + 3, C.beskarMid);
    ss.vline(lx - 1, 23, 23, C.beskarDark);       // boot left SIDE
    ss.vline(rx + 3, 23, 23, C.beskarDark);
  }

  // Frame 0: Idle
  drawMando(0, 0, false);
  // Frame 1: Walk A
  drawMando(1, 1, false);
  // Frame 2: Walk B
  drawMando(2, -1, false);
  // Frame 3: Fire
  drawMando(3, 0, true);

  ss.finish();
}

// ── GRUNT: Stormtrooper (20×20, 4 frames, scale 4) ─────────────────────────
export function paintGrunt(scene, key = 'grunt') {
  const ss = new SpriteSheet(scene, key, 20, 20, 4, 4);
  const C = PAL;

  function drawTrooper(f, legOff = 0, attackMode = false) {
    ss.frame(f);

    // ── E-11 BLASTER (pointing UP) — voxel depth ──────────────────────────
    ss.vline(9,  0, 4, C.impGrey);
    ss.vline(10, 0, 4, C.impSheen);
    ss.px(9,  0, attackMode ? C.boltGreen : C.metalLight);
    ss.px(10, 0, attackMode ? C.boltGreenGlow : C.metalLight);
    // Barrel left side face (darker)
    ss.px(8, 1, C.impDark);
    ss.px(8, 2, C.impDark);
    ss.px(8, 3, C.impDark);
    // Grip/slide — TOP lighter, FRONT medium
    ss.rect(8, 5, 4, 2, C.impLight);    // TOP face
    ss.hline(7, 8, 11, C.impGrey);      // FRONT face
    ss.px(7, 5, C.impDark);             // SIDE shadow
    ss.px(7, 6, C.impDark);
    ss.px(12, 5, C.impDark);
    ss.px(12, 6, C.impDark);

    // ── STORMTROOPER HELMET — voxel cube form ─────────────────────────────
    // TOP face of dome (rows 5-7): white/bright — shows we see TOP of the dome
    ss.hline(5, 7,  12, C.troopLight);   // top-face row 1 (narrow)
    ss.hline(6, 6,  13, C.troopWhite);   // top-face row 2
    ss.hline(7, 5,  14, C.troopWhite);   // top-face row 3 (widest)
    // 1px dark outline separating top face from front face
    ss.hline(8, 5,  14, C.troopBlack);

    // FRONT face of dome (rows 8-11): base troopWhite
    ss.hline(9,  5, 14, C.troopWhite);
    ss.hline(10, 5, 14, C.troopShade);   // slightly shaded lower dome

    // TWO EYE SOCKETS — black rectangles on FRONT face (rows 8-9)
    // Left eye socket
    ss.px(6, 8, C.troopBlack);
    ss.px(7, 8, C.troopBlack);
    ss.px(8, 8, C.troopBlack);
    ss.px(6, 9, C.troopBlack);
    ss.px(7, 9, C.troopBlack);
    ss.px(8, 9, C.troopBlack);
    // Eye whites (tiny glint inside each socket)
    ss.px(7, 8, '#1a1a40');
    // Center bridge
    ss.px(9,  8, C.troopShade);
    ss.px(10, 8, C.troopShade);
    // Right eye socket
    ss.px(11, 8, C.troopBlack);
    ss.px(12, 8, C.troopBlack);
    ss.px(13, 8, C.troopBlack);
    ss.px(11, 9, C.troopBlack);
    ss.px(12, 9, C.troopBlack);
    ss.px(13, 9, C.troopBlack);

    // Mouth-piece / vent strips (row 10)
    ss.px(6,  10, C.troopBlack);
    ss.px(8,  10, C.troopBlack);
    ss.px(10, 10, C.troopBlack);
    ss.px(12, 10, C.troopBlack);

    // SIDE faces of helmet (darker)
    ss.vline(5,  8, 11, C.troopShade);   // left SIDE
    ss.vline(14, 8, 11, C.troopShade);   // right SIDE
    // Chin row
    ss.hline(11, 6, 13, C.troopShade);

    // ── CHEST ARMOR — voxel block ─────────────────────────────────────────
    ss.hline(11, 6,  13, C.troopLight);  // TOP face
    ss.hline(12, 6,  13, C.black);       // TOP/FRONT separator
    ss.rect(5, 12, 10, 3, C.troopWhite); // FRONT face
    ss.hline(15, 6,  13, C.troopShade);  // bottom shadow
    ss.vline(5,  12, 14, C.troopShade);  // left SIDE shadow
    ss.vline(14, 12, 14, C.troopShade);  // right SIDE shadow
    // Center seam
    ss.vline(10, 12, 14, C.troopShade);
    // Abdomen belt (dark strip)
    ss.hline(15, 5, 14, C.troopDark);

    // ── ARMS — voxel blocks ───────────────────────────────────────────────
    // Left arm: TOP lighter, FRONT white, SIDE shaded
    ss.hline(11, 2, 4, C.troopLight);    // TOP face
    ss.rect(2, 12, 3, 3, C.troopWhite);  // FRONT face
    ss.vline(2, 12, 14, C.troopShade);   // SIDE shadow
    // Right arm
    ss.hline(11, 15, 17, C.troopLight);
    ss.rect(15, 12, 3, 3, C.troopWhite);
    ss.vline(17, 12, 14, C.troopShade);

    // ── BELT / UTILITY ────────────────────────────────────────────────────
    ss.hline(15, 5,  14, C.impGrey);
    ss.px(8,  15, C.impSheen);
    ss.px(11, 15, C.impSheen);

    // ── LEGS — chunky voxel blocks ────────────────────────────────────────
    const lx = 5 - legOff;
    const rx = 11 + legOff;
    // Left leg: TOP lighter, FRONT white, SIDE shaded
    ss.hline(16, lx, lx + 3, C.troopLight);   // TOP face
    ss.hline(17, lx, lx + 3, C.black);         // TOP/FRONT separator
    ss.rect(lx, 17, 4, 2, C.troopWhite);       // FRONT face
    ss.vline(lx, 16, 18, C.troopShade);        // SIDE shadow
    // Right leg
    ss.hline(16, rx, rx + 3, C.troopLight);
    ss.hline(17, rx, rx + 3, C.black);
    ss.rect(rx, 17, 4, 2, C.troopWhite);
    ss.vline(rx + 3, 16, 18, C.troopShade);
    // Boots (dark chunky blocks)
    ss.hline(19, lx - 1, lx + 4, C.troopDark);
    ss.hline(19, rx - 1, rx + 4, C.troopDark);
    ss.vline(lx - 1, 19, 19, C.troopBlack);
    ss.vline(rx + 4, 19, 19, C.troopBlack);
  }

  drawTrooper(0, 0, false);
  drawTrooper(1, 1, false);
  drawTrooper(2, -1, false);
  drawTrooper(3, 0, true);

  ss.finish();
}

// ── SHOOTER: Death Trooper (20×20, 4 frames, scale 4) ─────────────────────
export function paintShooter(scene, key = 'shooter') {
  const ss = new SpriteSheet(scene, key, 20, 20, 4, 4);
  const C = PAL;

  function drawDeathTrooper(f, legOff = 0, fireMode = false) {
    ss.frame(f);

    // ── DT-29 HEAVY BLASTER (pointing UP) — voxel cube shading ───────────
    ss.vline(9,  0, 5, C.impGrey);
    ss.vline(10, 0, 5, C.impSheen);
    ss.px(9,  0, fireMode ? C.boltGreen     : C.metalLight);
    ss.px(10, 0, fireMode ? C.boltGreenGlow : C.metalLight);
    // Barrel left SIDE face (shadow)
    ss.px(8, 1, C.impDark);
    ss.px(8, 2, C.impDark);
    ss.px(8, 3, C.impDark);
    ss.px(8, 4, C.impDark);
    // Heavy body — TOP bright, FRONT medium, SIDE dark
    ss.rect(8, 5, 4, 3, C.impLight);    // TOP face
    ss.hline(8, 8, 11, C.impGrey);      // FRONT lower face
    ss.px(7, 5, C.impDark);             // left SIDE shadow
    ss.px(7, 6, C.impDark);
    ss.px(7, 7, C.impDark);
    ss.px(12, 5, C.impDark);            // right SIDE shadow

    // ── DEATH TROOPER HELMET — angular voxel cube, all black ─────────────
    // TOP face (rows 5-7): dthLight — slightly lighter black
    ss.hline(5, 7,  12, C.dthLight);    // top-face row 1 (narrow)
    ss.hline(6, 6,  13, C.dthLight);    // top-face row 2
    ss.hline(7, 5,  14, C.dthMid);      // top-face row 3 (widest, still dark)
    // 1px dark separator
    ss.hline(8, 5,  14, C.black);

    // FRONT face of helmet (rows 8-11): dthMid
    ss.hline(9,  5, 14, C.dthMid);
    ss.hline(10, 5, 14, C.dthMid);
    ss.hline(11, 5, 14, C.dthDark);     // chin row darker

    // GREEN LED EYES — bright rectangles on FRONT face (rows 8-9)
    // Left LED eye
    ss.px(5, 8, C.dthLED);
    ss.px(6, 8, C.dthLED);
    ss.px(7, 8, C.dthLED);
    ss.px(5, 9, C.dthLED);
    ss.px(6, 9, C.dthLEDBright);        // bright center
    ss.px(7, 9, C.dthLED);
    // LED glow bleed
    ss.px(4, 8, '#0a2a0a');
    ss.px(4, 9, '#0a2a0a');
    // Right LED eye
    ss.px(11, 8, C.dthLED);
    ss.px(12, 8, C.dthLED);
    ss.px(13, 8, C.dthLED);
    ss.px(11, 9, C.dthLED);
    ss.px(12, 9, C.dthLEDBright);
    ss.px(13, 9, C.dthLED);
    ss.px(14, 8, '#0a2a0a');
    ss.px(14, 9, '#0a2a0a');

    // Breather vents (row 10) — small dark slots
    ss.px(6,  10, C.dthDark);
    ss.px(8,  10, C.dthDark);
    ss.px(10, 10, C.dthDark);
    ss.px(12, 10, C.dthDark);

    // SIDE faces of helmet
    ss.vline(5,  8, 11, C.dthDark);     // left SIDE
    ss.vline(14, 8, 11, C.dthDark);     // right SIDE

    // ── CHEST ARMOR — angular black voxel block ───────────────────────────
    ss.hline(11, 5,  14, C.dthLight);   // TOP face
    ss.hline(12, 5,  14, C.black);      // TOP/FRONT separator
    ss.rect(4, 12, 12, 3, C.dthMid);    // FRONT face
    ss.hline(15, 5,  14, C.dthDark);    // bottom shadow
    ss.vline(4,  12, 14, C.dthDark);    // left SIDE shadow
    ss.vline(15, 12, 14, C.dthDark);    // right SIDE shadow
    // Center ridge
    ss.vline(9,  12, 14, C.dthDark);
    ss.vline(10, 12, 14, C.dthLight);

    // ── ARMS — armored voxel blocks ───────────────────────────────────────
    ss.hline(11, 2, 3, C.dthLight);     // L arm TOP face
    ss.rect(2, 12, 2, 4, C.dthMid);     // L arm FRONT
    ss.vline(2, 12, 15, C.dthDark);     // L SIDE shadow
    ss.hline(11, 16, 17, C.dthLight);   // R arm TOP face
    ss.rect(16, 12, 2, 4, C.dthMid);    // R arm FRONT
    ss.vline(17, 12, 15, C.dthDark);    // R SIDE shadow

    // ── BELT ──────────────────────────────────────────────────────────────
    ss.hline(15, 4, 15, C.dthDark);
    ss.px(9,  15, C.dthLED);            // LED indicator on belt
    ss.px(10, 15, C.dthLED);

    // ── LEGS — chunky voxel blocks ────────────────────────────────────────
    const lx = 4 - legOff;
    const rx = 11 + legOff;
    // Left leg: TOP lighter, FRONT mid, SIDE dark
    ss.hline(16, lx, lx + 3, C.dthLight);   // TOP face
    ss.hline(17, lx, lx + 3, C.black);       // TOP/FRONT separator
    ss.rect(lx, 17, 4, 2, C.dthMid);         // FRONT face
    ss.vline(lx, 16, 18, C.dthDark);         // SIDE shadow
    // Right leg
    ss.hline(16, rx, rx + 3, C.dthLight);
    ss.hline(17, rx, rx + 3, C.black);
    ss.rect(rx, 17, 4, 2, C.dthMid);
    ss.vline(rx + 3, 16, 18, C.dthDark);
    // Boots
    ss.hline(19, lx - 1, lx + 4, C.dthDark);
    ss.hline(19, rx - 1, rx + 4, C.dthDark);
    ss.vline(lx - 1, 19, 19, C.dthDark);
    ss.vline(rx + 4, 19, 19, C.dthDark);
  }

  drawDeathTrooper(0, 0, false);
  drawDeathTrooper(1, 1, false);
  drawDeathTrooper(2, -1, false);
  drawDeathTrooper(3, 0, true);

  ss.finish();
}

// ── BOSS: Darth Vader (40×40, 4 frames, scale 4 → 640×160 strip) ──────────
export function paintBoss(scene, key = 'boss') {
  const ss = new SpriteSheet(scene, key, 40, 40, 4, 4);
  const C = PAL;

  function drawVader(f, legOff = 0, enraged = false) {
    ss.frame(f);
    const saberColor = enraged ? C.saberRedGlow : C.saberRed;
    const saberCore  = enraged ? C.saberRedCore : C.saberRedGlow;

    // ── LIGHTSABER (pointing UP, x=19-20) — voxel depth on hilt ──────────
    // Blade
    ss.vline(19, 0, 16, saberColor);
    ss.vline(20, 0, 16, saberCore);
    ss.px(19, 0, C.saberRedTip);
    ss.px(20, 0, C.saberRedTip);
    // Glow halo (narrow saber aura)
    ss.px(18, 1, saberColor);
    ss.px(21, 1, saberColor);
    ss.px(18, 6, saberColor);
    ss.px(21, 6, saberColor);
    ss.px(18, 12, saberColor);
    ss.px(21, 12, saberColor);
    // Crossguard — TOP face lighter, FRONT medium, SIDE dark
    ss.hline(15, 16, 23, C.impLight);   // TOP face of crossguard
    ss.rect(16, 16, 8, 2, C.impGrey);   // FRONT face
    ss.hline(18, 16, 23, C.impDark);    // bottom SIDE shadow
    ss.vline(16, 16, 17, C.impDark);    // left SIDE
    ss.vline(23, 16, 17, C.impDark);    // right SIDE
    ss.hline(16, 17, 22, C.impSheen);   // crossguard highlight
    // Hilt body — voxel cube
    ss.hline(17, 18, 21, C.impLight);   // TOP face of hilt
    ss.rect(18, 18, 4, 4, C.impGrey);   // FRONT face
    ss.px(19, 18, C.impSheen);
    ss.px(20, 18, C.metalLight);
    ss.vline(18, 18, 21, C.impDark);    // left SIDE shadow
    ss.vline(21, 18, 21, C.impDark);    // right SIDE shadow
    // Hand grips
    ss.rect(17, 22, 3, 2, C.vaderArmor);
    ss.rect(20, 22, 3, 2, C.vaderArmor);
    ss.hline(22, 17, 22, C.vaderSheen);

    // ── VADER HELMET — massive voxel dome, iconic silhouette ──────────────
    // TOP face of dome (rows 15-20): slightly lighter black — shows the crown
    ss.hline(15, 18, 21, C.vaderSheen); // apex highlight (narrow)
    ss.hline(16, 17, 22, C.vaderSheen);
    ss.hline(17, 16, 23, C.vaderArmor); // dome top spreading
    ss.hline(18, 15, 24, C.vaderArmor);
    ss.hline(19, 14, 25, C.vaderArmor);
    ss.hline(20, 13, 26, C.vaderArmor);
    // TOP/FRONT separator (1px dark outline)
    ss.hline(21, 12, 27, C.black);

    // FRONT face of helmet (rows 21-27): vaderHelm (darkest)
    ss.hline(22, 11, 28, C.vaderHelm);
    ss.hline(23, 11, 28, C.vaderHelm);
    ss.hline(24, 11, 28, C.vaderHelm);
    ss.hline(25, 12, 27, C.vaderHelm);
    ss.hline(26, 13, 26, C.vaderHelm);

    // Dome sheen (subtle highlight on left edge)
    ss.px(13, 19, C.vaderSheen);
    ss.px(13, 20, C.vaderSheen);
    ss.px(14, 21, C.vaderSheen);

    // SIDE faces of dome
    ss.vline(11, 22, 26, C.vaderHelm);
    ss.vline(28, 22, 26, C.vaderHelm);

    // EYE SLITS — two narrow rectangles on FRONT face (row 22-23)
    // Left eye slit
    ss.hline(22, 13, 16, enraged ? C.saberRedGlow : C.impSilver);
    ss.hline(23, 13, 16, enraged ? C.saberRed     : C.impGrey);
    // Right eye slit
    ss.hline(22, 23, 26, enraged ? C.saberRedGlow : C.impSilver);
    ss.hline(23, 23, 26, enraged ? C.saberRed     : C.impGrey);

    // Nose / breathing apparatus box (voxel block centered)
    ss.hline(23, 18, 21, C.vaderArmor);  // nose bridge TOP
    ss.rect(18, 24, 4, 2, C.vaderArmor); // nose block FRONT
    ss.px(19, 24, C.impSilver);
    ss.px(20, 24, C.impSilver);
    ss.px(19, 25, C.impGrey);
    ss.px(20, 25, C.impGrey);
    ss.vline(18, 24, 25, C.vaderHelm);
    ss.vline(21, 24, 25, C.vaderHelm);

    // Jaw / lower mask
    ss.hline(26, 13, 26, C.vaderHelm);
    ss.hline(27, 14, 25, C.vaderArmor);

    // ── CHEST ARMOR PANEL (life-support) — voxel block with LEDs ─────────
    // TOP edge of chest plate
    ss.hline(27, 13, 26, C.vaderSheen);  // TOP face highlight
    ss.hline(28, 13, 26, C.black);       // TOP/FRONT separator
    ss.rect(12, 28, 16, 5, C.vaderArmor); // FRONT face
    ss.vline(12, 28, 32, C.vaderHelm);   // left SIDE shadow
    ss.vline(27, 28, 32, C.vaderHelm);   // right SIDE shadow
    // Left life-support panel (voxel sub-block)
    ss.rect(13, 29, 5, 3, C.vaderHelm);
    ss.px(14, 29, enraged ? C.saberRed : C.ledRed);
    ss.px(15, 29, C.ledRed);
    ss.px(16, 30, C.impGrey);
    ss.px(14, 30, C.impGrey);
    ss.px(15, 31, enraged ? C.saberRed : C.ledRed);
    // Right life-support panel
    ss.rect(22, 29, 5, 3, C.vaderHelm);
    ss.px(23, 29, C.ledRed);
    ss.px(24, 29, enraged ? C.saberRed : C.ledRed);
    ss.px(25, 30, C.impGrey);
    ss.px(23, 30, enraged ? C.saberRed : C.ledRed);
    ss.px(24, 31, C.impGrey);

    // ── SHOULDERS / PAULDRONS — massive voxel blocks ──────────────────────
    // Left shoulder: TOP face, FRONT face, SIDE shadow
    ss.hline(23, 8,  14, C.vaderSheen);  // TOP face
    ss.hline(24, 8,  14, C.black);       // TOP/FRONT separator
    ss.rect(7, 24, 8, 4, C.vaderArmor);  // FRONT face
    ss.vline(7, 24, 27, C.vaderHelm);    // left SIDE shadow
    // Right shoulder
    ss.hline(23, 25, 31, C.vaderSheen);  // TOP face
    ss.hline(24, 25, 31, C.black);       // TOP/FRONT separator
    ss.rect(25, 24, 8, 4, C.vaderArmor); // FRONT face
    ss.vline(32, 24, 27, C.vaderHelm);   // right SIDE shadow

    // ── ARMS — armored voxel blocks ───────────────────────────────────────
    // Left arm: TOP lighter, FRONT vaderArmor, SIDE dark
    ss.hline(27, 8, 10, C.vaderSheen);   // TOP face
    ss.rect(7, 28, 4, 5, C.vaderArmor);  // FRONT face
    ss.px(8, 28, C.vaderSheen);          // highlight corner
    ss.vline(7, 28, 32, C.vaderHelm);    // SIDE shadow
    // Right arm
    ss.hline(27, 29, 31, C.vaderSheen);
    ss.rect(29, 28, 4, 5, C.vaderArmor);
    ss.px(30, 28, C.vaderSheen);
    ss.vline(32, 28, 32, C.vaderHelm);

    // ── FLOWING CAPE — wide dramatic voxel slabs ──────────────────────────
    // Left cape slab
    ss.rect(3, 26, 5, 13, C.capeBlack);
    ss.rect(2, 30, 4, 9, C.cape);
    ss.vline(2, 30, 38, C.capeBlack);    // outer edge
    ss.vline(6, 26, 38, C.capeShade);    // inner fold
    // Right cape slab
    ss.rect(32, 26, 5, 13, C.capeBlack);
    ss.rect(34, 30, 4, 9, C.cape);
    ss.vline(37, 30, 38, C.capeBlack);
    ss.vline(33, 26, 38, C.capeShade);
    // Cape bottom hem
    ss.hline(39, 2,  7, C.capeBlack);
    ss.hline(39, 32, 37, C.capeBlack);

    // ── BELT — Imperial buckle voxel strip ────────────────────────────────
    ss.hline(32, 13, 26, C.impLight);    // TOP face of belt
    ss.hline(33, 13, 26, C.black);       // TOP/FRONT separator
    ss.rect(17, 33, 6, 2, C.impGrey);    // FRONT face — buckle block
    ss.px(19, 33, C.gold);
    ss.px(20, 33, C.gold);
    ss.px(19, 34, C.goldDark);
    ss.px(20, 34, C.goldDark);
    ss.vline(17, 33, 34, C.impDark);
    ss.vline(22, 33, 34, C.impDark);

    // ── LEGS — chunky voxel blocks ────────────────────────────────────────
    const lx = 13 - legOff;
    const rx = 21 + legOff;
    // Left leg: TOP sheen, FRONT armor, SIDE dark
    ss.hline(34, lx, lx + 4, C.vaderSheen);   // TOP face
    ss.hline(35, lx, lx + 4, C.black);         // TOP/FRONT separator
    ss.rect(lx, 35, 5, 3, C.vaderArmor);       // FRONT face
    ss.vline(lx, 34, 37, C.vaderHelm);         // SIDE shadow
    // Right leg
    ss.hline(34, rx, rx + 4, C.vaderSheen);
    ss.hline(35, rx, rx + 4, C.black);
    ss.rect(rx, 35, 5, 3, C.vaderArmor);
    ss.vline(rx + 4, 34, 37, C.vaderHelm);
    // Boots (darkest — vaderHelm)
    ss.hline(38, lx - 1, lx + 5, C.vaderHelm);
    ss.hline(38, rx - 1, rx + 5, C.vaderHelm);
    ss.hline(39, lx - 1, lx + 5, C.black);
    ss.hline(39, rx - 1, rx + 5, C.black);
  }

  drawVader(0, 0, false);
  drawVader(1, 1, false);
  drawVader(2, -1, false);
  drawVader(3, 0, true);

  ss.finish();
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT — Death Star corridor
// ═══════════════════════════════════════════════════════════════════════════

// ── DEATH STAR FLOOR BACKDROP ──────────────────────────────────────────────
export function paintBackdrop(scene, key, worldW, worldH) {
  const tex = scene.textures.createCanvas(key, worldW, worldH);
  const ctx = tex.getContext();

  // Base floor — dark imperial metal
  ctx.fillStyle = PAL.floorMid;
  ctx.fillRect(0, 0, worldW, worldH);

  // Hex-tile grid pattern
  const hexW = 64, hexH = 56;
  ctx.strokeStyle = PAL.floorLine;
  ctx.lineWidth = 1.5;
  for (let row = 0; row < worldH / hexH + 2; row++) {
    for (let col = 0; col < worldW / hexW + 2; col++) {
      const ox = (row % 2 === 0) ? 0 : hexW / 2;
      const cx = col * hexW + ox;
      const cy = row * hexH;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 3;
        const px = cx + Math.cos(a) * 30;
        const py = cy + Math.sin(a) * 28;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Panel sections — subtle darker rectangles
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = PAL.floorDark;
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * worldW;
    const y = Math.random() * worldH;
    const w = 80 + Math.random() * 160;
    const h = 40 + Math.random() * 80;
    ctx.fillRect(Math.floor(x / 4) * 4, Math.floor(y / 4) * 4, w, h);
  }

  // Red alert strip lights (horizontal runs)
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.stripRed;
  for (let y = 0; y < worldH; y += 200) {
    const yy = y + Math.random() * 80;
    ctx.fillRect(0, yy, worldW, 3);
    ctx.fillStyle = PAL.stripRedGlow;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, yy - 4, worldW, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.stripRed;
  }

  // Blue accent strips (alternating, less frequent)
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = PAL.stripBlue;
  for (let y = 100; y < worldH; y += 380) {
    const yy = y + Math.random() * 40;
    ctx.fillRect(0, yy, worldW, 2);
    ctx.fillStyle = PAL.stripBluGlow;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, yy - 3, worldW, 8);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = PAL.stripBlue;
  }

  // Scorch marks (blaster fire damage)
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#000000';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * worldW;
    const y = Math.random() * worldH;
    const r = 8 + Math.random() * 20;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  tex.refresh();
}

// ── IMPERIAL CONSOLE (cover — hides player) ───────────────────────────────
// 28×28 logical pixels, scale 4 → 112×112 texture
// Isometric 3D terminal block: TOP face (dark industrial), FRONT face (screen+keyboard), BASE edge
export function paintConsole(scene, key = 'bush') {
  const c = new PixelCanvas(scene, key, 28, 28, 4);

  // ── TOP FACE (rows 0-6): dark industrial grey, slightly skewed ────────
  // Fill with impLight (brightest face — we see the top)
  for (let y = 0; y <= 6; y++) {
    const inset = Math.floor(y * 0.4);           // slight skew taper
    c.hline(y, 2 + inset, 25 - inset, PAL.impLight);
  }
  // Top face highlight (nearest edge)
  c.hline(0, 3, 24, PAL.impSheen);
  // Vent lines on top face
  c.hline(1, 4, 23, PAL.impGrey);
  c.hline(3, 4, 23, PAL.impGrey);
  c.hline(5, 4, 23, PAL.impGrey);
  // Imperial cog on top face
  c.px(13, 3, PAL.impSilver);
  c.px(14, 3, PAL.impSilver);
  c.px(13, 4, PAL.metalLight);
  c.px(14, 4, PAL.metalLight);
  c.px(13, 5, PAL.impSilver);
  c.px(14, 5, PAL.impSilver);
  // 1px dark separator between top face and front face
  c.hline(6, 2, 25, PAL.black);

  // ── FRONT FACE (rows 7-21): medium grey body with screen and keyboard ──
  c.rect(2, 7, 24, 15, PAL.impGrey);
  // Side columns (SIDE face darkening — right side darker than left)
  c.vline(2,  7, 21, PAL.impLight);    // left edge (lighter — nearest)
  c.vline(25, 7, 21, PAL.impDark);     // right edge (darker — far side)

  // Screen area (blue glow) — voxel inset rect
  c.rect(5, 8, 18, 8, PAL.impDark);    // screen bezel
  c.rect(6, 9, 16, 6, '#0a1a30');      // screen glass
  // Screen content lines (data readout)
  c.hline(10, 7, 20, PAL.stripBluGlow);
  c.hline(11, 7, 14, PAL.stripBluGlow);
  c.hline(11, 16, 21, '#30a030');
  c.hline(12, 7,  13, PAL.stripBluGlow);
  c.hline(12, 15, 20, '#c04040');
  c.hline(13, 8,  18, '#1a3a5a');
  // Screen top edge highlight (voxel depth on screen bezel)
  c.hline(8,  5, 22, PAL.impMid);
  c.hline(16, 5, 22, PAL.impDark);     // bottom of screen bezel shadow

  // Keyboard/control panel (rows 17-21)
  c.rect(4, 17, 20, 5, PAL.impMid);
  // KEY LIGHTS on keyboard
  c.px(6,  18, PAL.ledRed);
  c.px(9,  18, PAL.ledGreen);
  c.px(13, 18, PAL.ledGreen);
  c.px(17, 18, PAL.ledRed);
  c.px(21, 18, PAL.ledRed);
  // Key rows
  c.hline(20, 5,  22, PAL.impLight);
  c.px(6,  20, PAL.impSheen);
  c.px(9,  20, PAL.impSheen);
  c.px(12, 20, PAL.impSheen);
  c.px(15, 20, PAL.impSheen);
  c.px(18, 20, PAL.impSheen);
  c.px(21, 20, PAL.impSheen);
  // Keyboard top edge (depth hint)
  c.hline(17, 4, 23, PAL.impSheen);

  // ── BOTTOM BASE EDGE (rows 22-27): darkest — shadow/base slab ─────────
  c.rect(2, 22, 24, 5, PAL.impDark);
  // Base top-face edge (slightly lighter strip)
  c.hline(22, 2, 25, PAL.impGrey);
  // Base left/right SIDE faces
  c.vline(2,  22, 26, PAL.impMid);
  c.vline(25, 22, 26, PAL.impDark);
  // Bottom line
  c.hline(27, 2, 25, PAL.black);
  // Corner bolts
  c.px(3,  23, PAL.impSheen);
  c.px(24, 23, PAL.impSheen);
  c.px(3,  26, PAL.impGrey);
  c.px(24, 26, PAL.impGrey);

  c.finish();
}

// ── BLAST DOOR SEGMENT (wall replacement) — isometric 3D cube layout ──────
// 26×26 logical, scale 4 → 104×104
// Vertices: B=(13,2) top, A=(2,8) left, C=(24,8) right,
//           D=(13,14) center, E=(2,20) btm-left, F=(24,20) btm-right, G=(13,26) bottom
export function paintBlastDoor(scene, key = 'wall') {
  const c = new PixelCanvas(scene, key, 26, 26, 4);

  // ── TOP FACE scanline fill (A-B-C-D diamond) ──────────────────────────
  // y in [2,8]: B→A (left) and B→C (right)
  for (let y = 2; y <= 8; y++) {
    const t = y - 2;
    const xl = 14 - 2 * t;   // B→A slope
    const xr = 12 + 2 * t;   // B→C slope
    if (xr >= xl) c.hline(y, xl, xr, PAL.impLight);
  }
  // y in [8,14]: A→D (left) and C→D (right)
  for (let y = 8; y <= 14; y++) {
    const t = y - 8;
    const xl = 2  + 2 * t;   // A→D slope
    const xr = 24 - 2 * t;   // C→D slope
    if (xr >= xl) c.hline(y, xl, xr, PAL.impLight);
  }
  // Top face highlight row (nearest to viewer = top edge)
  c.hline(2, 13, 13, PAL.metalLight);  // apex
  c.hline(3, 11, 15, PAL.metalLight);
  c.hline(4,  9, 17, PAL.impSheen);
  // Imperial cog on top face
  c.px(13, 8,  PAL.impSheen);
  c.px(12, 9,  PAL.metalLight);
  c.px(13, 9,  PAL.white);             // center bright
  c.px(14, 9,  PAL.metalLight);
  c.px(11, 10, PAL.impSheen);
  c.px(13, 10, PAL.impSheen);
  c.px(15, 10, PAL.impSheen);
  c.px(13, 11, PAL.impSheen);

  // Outline the top face edges (1px dark border)
  // Left edge B→A
  for (let y = 2; y <= 8; y++) { const x = 14 - 2*(y-2); c.px(x-1, y, PAL.black); }
  // Right edge B→C
  for (let y = 2; y <= 8; y++) { const x = 12 + 2*(y-2); c.px(x+1, y, PAL.black); }
  // Left-bottom edge A→D
  for (let y = 8; y <= 14; y++) { const x = 2 + 2*(y-8); c.px(x-1, y, PAL.black); }
  // Right-bottom edge C→D
  for (let y = 8; y <= 14; y++) { const x = 24 - 2*(y-8); c.px(x+1, y, PAL.black); }

  // ── LEFT FACE scanline fill (A-D-G-E quad) ────────────────────────────
  // y in [8,14]: slant from A to D (left=2, right=A→D)
  for (let y = 8; y <= 14; y++) {
    const xr = 2 + 2 * (y - 8);        // right boundary traces A→D diagonal
    c.hline(y, 2, xr, PAL.impGrey);
  }
  // y in [14,20]: rectangular left half
  for (let y = 14; y <= 20; y++) {
    c.hline(y, 2, 13, PAL.impGrey);
  }
  // y in [20,26]: slant from E to G
  for (let y = 20; y <= 26; y++) {
    const xl = 2 + 2 * (y - 20);       // left boundary traces E→G
    c.hline(y, xl, 13, PAL.impGrey);
  }
  // Warning stripes on left face
  c.px(3, 10, '#cc4400'); c.px(4, 10, '#000000');
  c.px(3, 11, '#000000'); c.px(4, 11, '#cc4400');
  c.px(3, 14, '#cc4400'); c.px(4, 14, '#000000');
  c.px(3, 15, '#000000'); c.px(4, 15, '#cc4400');
  c.px(3, 17, '#cc4400'); c.px(4, 17, '#000000');
  c.px(3, 18, '#000000'); c.px(4, 18, '#cc4400');
  // Vertical rivet line on left face
  c.vline(7, 14, 19, PAL.impSheen);

  // ── RIGHT FACE scanline fill (D-C-F-G quad) ───────────────────────────
  // y in [8,14]: slant from C to D (right=24, left=C→D)
  for (let y = 8; y <= 14; y++) {
    const xl = 24 - 2 * (y - 8);       // left boundary traces C→D diagonal
    c.hline(y, xl, 24, PAL.impDark);
  }
  // y in [14,20]: rectangular right half
  for (let y = 14; y <= 20; y++) {
    c.hline(y, 13, 24, PAL.impDark);
  }
  // y in [20,26]: slant from F to G
  for (let y = 20; y <= 26; y++) {
    const xr = 24 - 2 * (y - 20);      // right boundary traces F→G
    c.hline(y, 13, xr, PAL.impDark);
  }
  // Red/green LED indicators on right face
  c.px(17, 15, PAL.ledRed);
  c.px(19, 15, PAL.ledGreen);
  c.px(21, 15, PAL.ledGreen);
  c.px(23, 15, PAL.ledRed);
  c.px(17, 18, PAL.ledRed);
  c.px(20, 18, PAL.ledGreen);
  // Horizontal panel line on right face
  c.hline(17, 14, 23, PAL.impMid);

  // ── OUTLINE the face borders (1px dark edges) ─────────────────────────
  // Left face outer edge (A→E→G)
  c.vline(2, 8, 20, PAL.black);
  for (let y = 20; y <= 26; y++) { c.px(2 + 2*(y-20), y, PAL.black); }
  // Right face outer edge (C→F→G)
  c.vline(24, 8, 20, PAL.black);
  for (let y = 20; y <= 26; y++) { c.px(24 - 2*(y-20), y, PAL.black); }
  // Bottom center apex G
  c.px(13, 26, PAL.black);
  // D-divider (center vertical between left and right faces)
  for (let y = 14; y <= 19; y++) { c.px(13, y, PAL.black); }

  c.finish();
}

// ═══════════════════════════════════════════════════════════════════════════
// BULLETS / FX
// ═══════════════════════════════════════════════════════════════════════════

// Blaster bolt — elongated energy tracer, oriented UP
export function paintBolt(scene, key, coreColor, glowColor, len = 6) {
  const w = 4, h = len + 4;
  const c = new PixelCanvas(scene, key, w, h, 3);
  // Glow trail (faint)
  c.px(1, h - 1, glowColor);
  c.px(2, h - 1, glowColor);
  c.px(0, h - 2, glowColor);
  c.px(3, h - 2, glowColor);
  // Body
  c.rect(1, 1, 2, len + 1, coreColor);
  c.rect(0, len - 1, 4, 2, glowColor);  // glow halo at middle
  // Bright tip
  c.px(1, 0, '#ffffff');
  c.px(2, 0, '#ffffff');
  c.px(1, 1, coreColor);
  c.px(2, 1, coreColor);
  c.finish();
}

// Missile — fat projectile with fins
export function paintMissile(scene, key = 'bullet-super') {
  const c = new PixelCanvas(scene, key, 6, 14, 3);
  // Nose cone
  c.px(2, 0, PAL.metalLight);
  c.px(3, 0, PAL.metalLight);
  c.rect(2, 1, 2, 1, PAL.offWhite);
  // Body
  c.rect(1, 2, 4, 8, PAL.rocketBody);
  c.px(2, 2, PAL.impSheen);
  c.px(3, 2, PAL.impSheen);
  c.vline(1, 3, 9, PAL.impGrey);
  c.vline(4, 3, 9, PAL.impGrey);
  // Fins
  c.px(0, 9, PAL.rocketFin);
  c.px(5, 9, PAL.rocketFin);
  c.px(0, 10, PAL.rocketFin);
  c.px(5, 10, PAL.rocketFin);
  // Exhaust
  c.rect(2, 10, 2, 3, PAL.rocketFire);
  c.px(2, 12, PAL.rocketFireBrt);
  c.px(3, 12, PAL.rocketFireBrt);
  c.px(1, 13, PAL.rocketFire);
  c.px(4, 13, PAL.rocketFire);
  c.finish();
}

// Explosion — 3-frame sprite sheet for impact FX
export function paintExplosion(scene, key = 'explosion') {
  // Each frame 16×16 logical, scale 3 → 48×48 per frame, 3 frames = 144×48
  const ss = new SpriteSheet(scene, key, 16, 16, 3, 3);

  // Frame 0: bright core flash
  ss.frame(0);
  ss.circle(8, 8, 6, PAL.expBright);
  ss.circle(8, 8, 4, PAL.expCore);
  ss.circle(8, 8, 2, '#ffffff');
  // Spark rays
  ss.px(8, 1, PAL.expBright);
  ss.px(8, 15, PAL.expBright);
  ss.px(1, 8, PAL.expBright);
  ss.px(15, 8, PAL.expBright);
  ss.px(3, 3, PAL.expMid);
  ss.px(13, 3, PAL.expMid);
  ss.px(3, 13, PAL.expMid);
  ss.px(13, 13, PAL.expMid);

  // Frame 1: expanding orange
  ss.frame(1);
  ss.circle(8, 8, 7, PAL.expMid);
  ss.circle(8, 8, 5, PAL.expBright);
  ss.circle(8, 8, 2, PAL.expCore);
  // Fragments
  ss.px(8, 0, PAL.expDark);
  ss.px(0, 8, PAL.expDark);
  ss.px(15, 8, PAL.expDark);
  ss.px(8, 15, PAL.expDark);
  ss.px(2, 2, PAL.expMid);
  ss.px(13, 2, PAL.expMid);
  ss.px(2, 13, PAL.expMid);
  ss.px(14, 14, PAL.expMid);

  // Frame 2: dark smoke / dissipating
  ss.frame(2);
  ss.circle(8, 8, 7, PAL.expSmoke);
  ss.circle(8, 8, 5, PAL.expDark);
  ss.circle(8, 8, 2, PAL.expMid);
  ss.px(8, 1, PAL.expSmoke);
  ss.px(1, 8, PAL.expSmoke);
  ss.px(14, 8, PAL.expSmoke);
  ss.px(8, 14, PAL.expSmoke);

  ss.finish();
}

// Muzzle flash (blaster version — elongated blast)
export function paintMuzzle(scene, key = 'muzzle') {
  const c = new PixelCanvas(scene, key, 12, 12, 3);
  const cx = 6, cy = 6;
  c.rect(5, 5, 2, 2, '#ffffff');
  c.rect(4, 4, 4, 4, PAL.boltRedGlow);
  c.rect(3, 3, 6, 6, PAL.boltRed);
  // Cross arms (blaster flash style)
  c.hline(6, 0, 11, PAL.boltRed);
  c.vline(6, 0, 11, PAL.boltRed);
  c.hline(5, 1, 10, PAL.boltRedGlow);
  c.vline(5, 1, 10, PAL.boltRedGlow);
  // Diagonal sparks
  c.px(2, 2, PAL.expBright);
  c.px(9, 2, PAL.expBright);
  c.px(2, 9, PAL.expBright);
  c.px(9, 9, PAL.expBright);
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
  ctx.fillStyle = 'rgba(0, 0, 20, 0.5)';
  ctx.beginPath();
  ctx.ellipse(r, r, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

// Jetpack flame particle (for player movement trail)
export function paintJetFlame(scene, key = 'jet-flame') {
  const c = new PixelCanvas(scene, key, 4, 6, 3);
  c.rect(1, 0, 2, 2, PAL.expCore);
  c.rect(0, 2, 4, 2, PAL.rocketFire);
  c.rect(1, 4, 2, 2, PAL.rocketFire);
  c.px(0, 5, PAL.expMid);
  c.px(3, 5, PAL.expMid);
  c.finish();
}

// ═══════════════════════════════════════════════════════════════════════════
// HUD UI: Imperial console-style joystick + lightsaber super button
// ═══════════════════════════════════════════════════════════════════════════

export function paintJoystick(scene) {
  // BASE — Imperial sensor ring
  const baseR = 110;
  const base = scene.textures.createCanvas('joystick-base', baseR * 2, baseR * 2);
  const bctx = base.getContext();
  // Outer dark ring
  bctx.fillStyle = 'rgba(14, 14, 20, 0.7)';
  bctx.beginPath();
  bctx.arc(baseR, baseR, baseR - 4, 0, Math.PI * 2);
  bctx.fill();
  // Inner glow (blue tint)
  bctx.fillStyle = 'rgba(0, 30, 80, 0.3)';
  bctx.beginPath();
  bctx.arc(baseR, baseR, baseR - 18, 0, Math.PI * 2);
  bctx.fill();
  // Outer ring (Imperial blue/grey)
  bctx.strokeStyle = 'rgba(0, 80, 200, 0.7)';
  bctx.lineWidth = 4;
  bctx.beginPath();
  bctx.arc(baseR, baseR, baseR - 8, 0, Math.PI * 2);
  bctx.stroke();
  // Inner ring
  bctx.strokeStyle = 'rgba(0, 50, 160, 0.5)';
  bctx.lineWidth = 2;
  bctx.beginPath();
  bctx.arc(baseR, baseR, baseR - 20, 0, Math.PI * 2);
  bctx.stroke();
  // 8 tick marks
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const ix = baseR + Math.cos(a) * (baseR - 10);
    const iy = baseR + Math.sin(a) * (baseR - 10);
    bctx.fillStyle = 'rgba(0, 100, 220, 0.8)';
    bctx.fillRect(ix - 2, iy - 2, 4, 4);
  }
  base.refresh();

  // KNOB — targeting reticle style
  const knobR = 46;
  const knob = scene.textures.createCanvas('joystick-knob', knobR * 2, knobR * 2);
  const kctx = knob.getContext();
  kctx.fillStyle = PAL.impGrey;
  kctx.beginPath();
  kctx.arc(knobR, knobR, knobR - 4, 0, Math.PI * 2);
  kctx.fill();
  kctx.fillStyle = PAL.impMid;
  kctx.beginPath();
  kctx.arc(knobR, knobR, knobR - 12, 0, Math.PI * 2);
  kctx.fill();
  // Crosshair
  kctx.strokeStyle = 'rgba(0, 120, 255, 0.9)';
  kctx.lineWidth = 2;
  kctx.beginPath();
  kctx.moveTo(knobR - 14, knobR);
  kctx.lineTo(knobR - 6, knobR);
  kctx.moveTo(knobR + 6, knobR);
  kctx.lineTo(knobR + 14, knobR);
  kctx.moveTo(knobR, knobR - 14);
  kctx.lineTo(knobR, knobR - 6);
  kctx.moveTo(knobR, knobR + 6);
  kctx.lineTo(knobR, knobR + 14);
  kctx.stroke();
  // Center dot
  kctx.fillStyle = 'rgba(0, 160, 255, 0.9)';
  kctx.beginPath();
  kctx.arc(knobR, knobR, 4, 0, Math.PI * 2);
  kctx.fill();
  // Ring
  kctx.strokeStyle = 'rgba(40, 80, 160, 0.8)';
  kctx.lineWidth = 3;
  kctx.beginPath();
  kctx.arc(knobR, knobR, knobR - 5, 0, Math.PI * 2);
  kctx.stroke();
  knob.refresh();
}

export function paintSuperButton(scene) {
  // Lightsaber hilt button (ready = glowing red, off = dark)
  const make = (key, ready) => {
    const r = 60;
    const size = r * 2 + 8;
    const tex = scene.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const cx = size / 2, cy = size / 2;

    // Background disc
    ctx.fillStyle = ready ? 'rgba(60, 10, 10, 0.75)' : 'rgba(14, 14, 20, 0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = ready ? PAL.saberRed : PAL.impLight;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    ctx.stroke();

    // Saber blade (vertical, centered)
    if (ready) {
      // Glow aura
      const grad = ctx.createLinearGradient(cx, cy - r * 0.55, cx, cy + r * 0.1);
      grad.addColorStop(0, 'rgba(255, 200, 200, 0.0)');
      grad.addColorStop(0.3, 'rgba(255, 80, 80, 0.35)');
      grad.addColorStop(1, 'rgba(255, 30, 30, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 10, cy - r * 0.55, 20, r * 0.65);
      // Blade
      ctx.fillStyle = PAL.saberRedCore;
      ctx.fillRect(cx - 3, cy - r * 0.5, 6, r * 0.55);
      ctx.fillStyle = PAL.saberRed;
      ctx.fillRect(cx - 5, cy - r * 0.5, 10, r * 0.55);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, cy - r * 0.48, 4, r * 0.5);
    }

    // Hilt body (crossguard style)
    const hiltY = cy + r * 0.05;
    ctx.fillStyle = ready ? PAL.impGrey : PAL.impDark;
    ctx.fillRect(cx - 4, hiltY, 8, r * 0.4);
    // Crossguard
    ctx.fillRect(cx - r * 0.35, hiltY + 2, r * 0.7, 5);
    ctx.fillStyle = PAL.impSheen;
    ctx.fillRect(cx - 3, hiltY, 2, r * 0.4);
    ctx.fillRect(cx - r * 0.33, hiltY + 3, r * 0.66, 2);

    tex.refresh();
  };
  make('super-btn', true);
  make('super-btn-off', false);
}

// ── WEAPON PICKUPS ────────────────────────────────────────────────────────────
// Each pickup is 16×16 logical pixels @ scale 4 = 64×64 texture.
// Glowing outline so they read clearly on the dark floor.

export function paintWeaponPickups(scene) {
  // DC-15 Rifle — angular dark barrel, orange glow
  const rifle = new PixelCanvas(scene, 'pickup-rifle', 16, 16, 4);
  // Outer glow halo
  for (let x = 2; x <= 13; x++) { rifle.px(x, 0, '#804010'); rifle.px(x, 15, '#804010'); }
  for (let y = 1; y <= 14; y++) { rifle.px(1,  y, '#804010'); rifle.px(14, y, '#804010'); }
  // Barrel (long horizontal rectangle, top half)
  rifle.rect(2, 3, 12, 3, PAL.impDark);
  rifle.rect(3, 4, 10, 1, PAL.impGrey);
  rifle.rect(3, 3, 10, 1, PAL.impLight);
  // Muzzle tip orange
  rifle.rect(13, 3, 1, 3, '#ff8010');
  // Body / grip
  rifle.rect(3, 6, 7, 5, PAL.impMid);
  rifle.rect(4, 7, 5, 3, PAL.impGrey);
  rifle.rect(5, 6, 3, 1, PAL.impLight);
  // Scope
  rifle.rect(5, 2, 3, 2, PAL.impLight);
  rifle.rect(6, 2, 1, 1, PAL.bactaLight);
  // Mag
  rifle.rect(4, 11, 4, 3, PAL.impGrey);
  rifle.finish();

  // Flamethrower — squat tank + nozzle, orange flame
  const flame = new PixelCanvas(scene, 'pickup-flamer', 16, 16, 4);
  for (let x = 2; x <= 13; x++) { flame.px(x, 0, '#602800'); flame.px(x, 15, '#602800'); }
  for (let y = 1; y <= 14; y++) { flame.px(1,  y, '#602800'); flame.px(14, y, '#602800'); }
  // Tank body
  flame.rect(2, 5, 8, 7, PAL.impMid);
  flame.rect(3, 6, 6, 5, PAL.impGrey);
  flame.rect(3, 5, 6, 1, PAL.impLight);
  // Tank straps
  flame.rect(5, 5, 1, 7, PAL.impDark);
  flame.rect(7, 5, 1, 7, PAL.impDark);
  // Nozzle
  flame.rect(10, 7, 4, 3, PAL.impMid);
  flame.rect(11, 8, 2, 1, PAL.impLight);
  // Flame at tip
  flame.px(14, 7, '#ff8010');
  flame.px(14, 8, '#ffb040');
  flame.px(14, 9, '#ff8010');
  flame.px(15, 8, '#ffd060');
  // Pressure gauge (small detail)
  flame.rect(3, 9, 2, 2, '#1040aa');
  flame.finish();

  // Thermal Detonator — round sphere, red button, silver band
  const det = new PixelCanvas(scene, 'pickup-det', 16, 16, 4);
  for (let x = 3; x <= 12; x++) { det.px(x, 1, '#880000'); det.px(x, 14, '#880000'); }
  for (let y = 2; y <= 13; y++) { det.px(2,  y, '#880000'); det.px(13, y, '#880000'); }
  // Sphere body
  det.rect(4, 3, 8, 10, PAL.impMid);
  det.rect(3, 4, 10, 8, PAL.impMid);
  det.rect(5, 4, 6, 8, PAL.impGrey);
  det.rect(4, 5, 8, 6, PAL.impGrey);
  // Highlight
  det.rect(5, 4, 3, 2, PAL.impLight);
  // Equatorial silver band
  det.rect(3, 7, 10, 2, PAL.metalLight);
  det.rect(3, 7, 10, 1, PAL.impSheen);
  // Red activation button
  det.rect(6, 7, 4, 2, '#cc0000');
  det.rect(7, 7, 2, 2, '#ff2020');
  det.rect(7, 7, 2, 1, '#ff8888');
  det.finish();
}

// ── GRENADE PROJECTILE ────────────────────────────────────────────────────────
// 10×10 logical @ scale 3 = 30×30 texture
export function paintGrenade(scene) {
  const g = new PixelCanvas(scene, 'grenade', 10, 10, 3);
  // Sphere
  g.rect(2, 1, 6, 8, PAL.impMid);
  g.rect(1, 2, 8, 6, PAL.impMid);
  g.rect(3, 2, 4, 6, PAL.impGrey);
  g.rect(2, 3, 6, 4, PAL.impGrey);
  // Highlight
  g.rect(3, 2, 2, 2, PAL.impLight);
  // Band
  g.rect(1, 4, 8, 2, PAL.impSilver);
  // Fuse pin (top)
  g.px(4, 0, PAL.metalLight);
  g.px(5, 0, PAL.metalLight);
  g.px(4, 1, PAL.impSheen);
  g.px(5, 1, PAL.impSheen);
  // Red LED
  g.px(4, 4, '#ff2020');
  g.px(5, 4, '#ff4040');
  g.finish();
}
