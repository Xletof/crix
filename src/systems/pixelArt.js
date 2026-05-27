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
// ═══════════════════════════════════════════════════════════════════════════

// ── PLAYER: Mandalorian (24×24, 4 frames, scale 4 → 384×96 strip) ────────
export function paintPlayer(scene, key = 'player') {
  const ss = new SpriteSheet(scene, key, 24, 24, 4, 4);

  // Helper: draw full base Mando pose onto current frame
  function drawMando(f, legOffset = 0, fireMode = false) {
    ss.frame(f);
    const C = PAL;

    // ── BLASTER (pointing UP, x=11-12) ────────────────────────────────
    ss.vline(11, 0, 4, C.impGrey);
    ss.vline(12, 0, 4, C.impSheen);
    ss.px(11, 0, C.metalLight);   // muzzle glint
    ss.px(12, 0, C.metalLight);
    // Slide + ejector
    ss.rect(10, 5, 4, 2, C.impLight);
    ss.px(11, 5, C.impGrey);
    ss.px(12, 5, C.impSheen);
    ss.px(13, 5, C.impDark);
    // Grip (beskar-gloved hands)
    ss.rect(10, 7, 4, 2, C.beskarDark);
    ss.hline(7, 11, 12, C.beskar);

    if (fireMode) {
      // Muzzle glow hint on blaster tip
      ss.px(11, 0, C.boltRed);
      ss.px(12, 0, C.boltRed);
    }

    // ── HELMET ────────────────────────────────────────────────────────
    // Dome top
    ss.hline(8, 10, 13, C.beskar);
    ss.px(11, 8, C.beskarMid);
    ss.px(12, 8, C.beskarMid);
    // Dome main
    ss.hline(9, 9, 14, C.beskarMid);
    ss.px(9, 9, C.beskar);
    ss.px(14, 9, C.beskar);
    ss.px(10, 9, C.beskarLight);   // highlight
    // Dome wide row
    ss.hline(10, 8, 15, C.beskarMid);
    // T-VISOR SLOT (rows 10-11) — the defining Mando feature
    ss.hline(10, 9, 14, C.black);   // horizontal visor
    ss.px(8, 10, C.beskarMid);
    ss.px(15, 10, C.beskarMid);
    ss.hline(11, 9, 14, C.black);   // visor row 2
    ss.px(8, 11, C.beskarDark);
    ss.px(15, 11, C.beskarDark);
    // T-visor vertical bridge (center)
    ss.px(11, 12, C.black);
    ss.px(12, 12, C.black);
    // Lower helm / chin
    ss.hline(12, 8, 15, C.beskarDark);
    ss.px(9, 12, C.beskar);
    ss.px(14, 12, C.beskar);
    ss.hline(13, 9, 14, C.beskarDark);

    // Rangefinder stub (right side of helmet)
    ss.px(15, 9, C.beskarDeep);
    ss.px(16, 10, C.beskarDeep);

    // ── PAULDRONS (shoulder armor) ────────────────────────────────────
    ss.rect(5, 14, 5, 3, C.beskarDark);    // L pauldron
    ss.rect(14, 14, 5, 3, C.beskarDark);   // R pauldron
    ss.hline(14, 6, 9, C.beskarMid);       // L highlight
    ss.hline(14, 14, 17, C.beskarMid);     // R highlight
    ss.px(6, 15, C.beskar);
    ss.px(17, 15, C.beskar);
    // Jetpack bump (visible on upper back-shoulder area)
    ss.px(5, 14, C.beskar);
    ss.px(18, 14, C.beskar);

    // ── ARMS ──────────────────────────────────────────────────────────
    ss.rect(5, 17, 3, 3, C.beskar);       // L arm beskar
    ss.rect(16, 17, 3, 3, C.beskar);      // R arm beskar
    ss.px(6, 17, C.beskarMid);
    ss.px(17, 17, C.beskarMid);
    ss.hline(19, 6, 7, C.beskarDark);
    ss.hline(19, 16, 17, C.beskarDark);

    // ── CHEST PLATE ───────────────────────────────────────────────────
    ss.rect(8, 17, 8, 4, C.beskar);
    ss.hline(17, 9, 14, C.beskarMid);     // top edge
    ss.hline(20, 9, 14, C.beskarDark);    // bottom shadow
    ss.px(10, 17, C.beskarLight);          // chest highlight
    // Signet emblem (small bright pixel)
    ss.px(12, 18, C.gold);
    ss.px(11, 19, C.goldDark);
    ss.px(13, 19, C.goldDark);

    // ── CAPE (dark fabric sides + back) ────────────────────────────────
    ss.rect(4, 19, 3, 5, C.cape);
    ss.rect(17, 19, 3, 5, C.cape);
    ss.px(4, 21, C.capeBlack);
    ss.px(18, 21, C.capeBlack);
    ss.px(4, 23, C.capeShade);
    ss.px(18, 23, C.capeShade);

    // ── BELT ──────────────────────────────────────────────────────────
    ss.hline(21, 8, 15, C.beskarDeep);
    ss.px(11, 21, C.gold);
    ss.px(12, 21, C.gold);

    // ── LEGS ──────────────────────────────────────────────────────────
    // Default stance (no legOffset): legs side by side
    const lx = 8 - legOffset;   // left leg x offset
    const rx = 13 + legOffset;  // right leg x offset
    ss.rect(lx, 22, 4, 1, C.impGrey);
    ss.rect(rx, 22, 4, 1, C.impGrey);
    // Boots
    ss.rect(lx - 1, 23, 5, 1, C.beskarDark);
    ss.rect(rx - 1, 23, 5, 1, C.beskarDark);
    ss.px(lx, 23, C.beskar);
    ss.px(rx, 23, C.beskar);
  }

  // Frame 0: Idle
  drawMando(0, 0, false);
  // Frame 1: Walk A — left leg forward (+1 stride)
  drawMando(1, 1, false);
  // Frame 2: Walk B — right leg forward (mirror stride)
  drawMando(2, -1, false);
  // Frame 3: Fire — highlight muzzle
  drawMando(3, 0, true);

  ss.finish();
}

// ── GRUNT: Stormtrooper (20×20, 4 frames, scale 4) ─────────────────────────
export function paintGrunt(scene, key = 'grunt') {
  const ss = new SpriteSheet(scene, key, 20, 20, 4, 4);
  const C = PAL;

  function drawTrooper(f, legOff = 0, attackMode = false) {
    ss.frame(f);

    // ── E-11 BLASTER (pointing UP, x=9-10) ────────────────────────────
    ss.vline(9, 0, 4, C.impGrey);
    ss.vline(10, 0, 4, C.impSheen);
    ss.px(9, 0, C.metalLight);
    // Blaster scope on barrel
    ss.px(11, 2, C.impLight);
    ss.px(11, 3, C.impGrey);
    // Grip
    ss.rect(8, 5, 4, 2, C.impLight);
    ss.px(10, 6, C.impSheen);

    if (attackMode) {
      ss.px(9, 0, C.boltGreen);
      ss.px(10, 0, C.boltGreen);
    }

    // ── STORMTROOPER HELMET (iconic rounded white dome) ─────────────────
    // Top of dome
    ss.hline(6, 7, 12, C.troopLight);
    ss.px(8, 6, C.troopWhite);
    ss.px(11, 6, C.troopWhite);
    // Main dome
    ss.hline(7, 5, 14, C.troopWhite);
    ss.px(5, 7, C.troopShade);
    ss.px(14, 7, C.troopShade);
    // Eye row
    ss.hline(8, 4, 15, C.troopWhite);
    // Two oval eye lenses (black with slight blue tint)
    ss.px(5, 8, C.troopBlack);
    ss.px(6, 8, C.troopBlack);
    ss.px(7, 8, C.troopBlack);
    ss.px(8, 8, C.troopBlack);
    // center bridge (white)
    ss.px(9, 8, C.troopShade);
    ss.px(10, 8, C.troopShade);
    // right eye
    ss.px(11, 8, C.troopBlack);
    ss.px(12, 8, C.troopBlack);
    ss.px(13, 8, C.troopBlack);
    ss.px(14, 8, C.troopBlack);
    // Cheeks
    ss.px(4, 8, C.troopWhite);
    ss.px(15, 8, C.troopWhite);
    // Mouth-piece / vents
    ss.hline(9, 4, 15, C.troopShade);
    ss.px(6, 9, C.troopBlack);
    ss.px(7, 9, C.troopBlack);
    ss.px(9, 9, C.troopBlack);
    ss.px(10, 9, C.troopBlack);
    ss.px(12, 9, C.troopBlack);
    ss.px(13, 9, C.troopBlack);
    // Chin
    ss.hline(10, 6, 13, C.troopWhite);
    ss.px(6, 10, C.troopShade);
    ss.px(13, 10, C.troopShade);

    // ── CHEST ARMOR (white plate, black joints) ────────────────────────
    ss.rect(5, 11, 10, 4, C.troopWhite);
    // Chest highlight
    ss.hline(11, 6, 13, C.troopLight);
    // Chest shadow
    ss.hline(14, 6, 13, C.troopShade);
    // Center seam
    ss.vline(10, 11, 14, C.troopShade);
    // Abdomen plates (dark grey accordion sections)
    ss.hline(15, 5, 14, C.troopDark);

    // ── ARMS ──────────────────────────────────────────────────────────
    ss.rect(2, 11, 3, 4, C.troopWhite);   // L arm
    ss.rect(15, 11, 3, 4, C.troopWhite);  // R arm
    ss.px(2, 11, C.troopLight);
    ss.px(17, 11, C.troopLight);
    ss.px(4, 14, C.troopShade);
    ss.px(15, 14, C.troopShade);

    // ── BELT / UTILITY ────────────────────────────────────────────────
    ss.hline(15, 5, 14, C.impGrey);
    ss.px(8, 15, C.impSheen);
    ss.px(11, 15, C.impSheen);

    // ── LEGS ──────────────────────────────────────────────────────────
    const lx = 5 - legOff;
    const rx = 11 + legOff;
    ss.rect(lx, 16, 4, 3, C.troopWhite);
    ss.rect(rx, 16, 4, 3, C.troopWhite);
    // Knee guards
    ss.px(lx + 1, 17, C.troopLight);
    ss.px(rx + 1, 17, C.troopLight);
    ss.px(lx, 17, C.troopShade);
    ss.px(rx, 17, C.troopShade);
    // Boots
    ss.hline(19, lx - 1, lx + 4, C.troopDark);
    ss.hline(19, rx - 1, rx + 4, C.troopDark);
  }

  drawTrooper(0, 0, false);   // idle
  drawTrooper(1, 1, false);   // walkA
  drawTrooper(2, -1, false);  // walkB
  drawTrooper(3, 0, true);    // fire/attack

  ss.finish();
}

// ── SHOOTER: Death Trooper (20×20, 4 frames, scale 4) ─────────────────────
export function paintShooter(scene, key = 'shooter') {
  const ss = new SpriteSheet(scene, key, 20, 20, 4, 4);
  const C = PAL;

  function drawDeathTrooper(f, legOff = 0, fireMode = false) {
    ss.frame(f);

    // ── DT-29 HEAVY BLASTER (pointing UP) ────────────────────────────
    ss.vline(9, 0, 5, C.impGrey);
    ss.vline(10, 0, 5, C.impSheen);
    ss.px(9, 0, fireMode ? C.boltGreen : C.metalLight);
    ss.px(10, 0, fireMode ? C.boltGreenGlow : C.metalLight);
    // Heavy body
    ss.rect(8, 5, 4, 3, C.impLight);
    ss.px(9, 6, C.impGrey);
    ss.px(10, 6, C.impSheen);
    ss.px(11, 5, C.impDark);

    // ── DEATH TROOPER HELMET (all black, angular, green LED eyes) ─────
    // Top dome (flatter than stormtrooper, more angular)
    ss.hline(6, 7, 12, C.dthMid);
    ss.hline(7, 5, 14, C.dthMid);
    ss.px(5, 7, C.dthDark);
    ss.px(14, 7, C.dthDark);
    // Main helmet face
    ss.hline(8, 4, 15, C.dthMid);
    ss.hline(9, 4, 15, C.dthMid);
    ss.hline(10, 5, 14, C.dthLight);
    // GREEN LED EYES (distinctive feature)
    ss.px(5, 8, C.dthLED);
    ss.px(6, 8, C.dthLED);
    ss.px(7, 8, C.dthDark);
    ss.px(8, 8, C.dthDark);
    ss.px(11, 8, C.dthDark);
    ss.px(12, 8, C.dthLED);
    ss.px(13, 8, C.dthLED);
    ss.px(14, 8, C.dthDark);
    // LED glow hints
    ss.px(5, 9, C.dthLED);
    ss.px(6, 9, C.dthDark);
    ss.px(12, 9, C.dthDark);
    ss.px(13, 9, C.dthLED);
    // Lower face plate
    ss.hline(10, 6, 13, C.dthMid);
    // Breather vents
    ss.px(7, 10, C.dthDark);
    ss.px(9, 10, C.dthDark);
    ss.px(11, 10, C.dthDark);
    ss.px(12, 10, C.dthDark);

    // ── CHEST ARMOR (angular black plates) ────────────────────────────
    ss.rect(4, 11, 12, 4, C.dthMid);
    // Highlight on left plate
    ss.hline(11, 5, 9, C.dthLight);
    ss.hline(11, 10, 14, C.dthDark);
    // Center ridges
    ss.vline(9, 11, 14, C.dthDark);
    ss.vline(10, 11, 14, C.dthLight);

    // ── ARMS (armored) ────────────────────────────────────────────────
    ss.rect(2, 12, 2, 4, C.dthMid);
    ss.rect(16, 12, 2, 4, C.dthMid);
    ss.px(2, 12, C.dthLight);
    ss.px(17, 12, C.dthLight);

    // ── BELT ──────────────────────────────────────────────────────────
    ss.hline(15, 4, 15, C.dthDark);
    ss.px(9, 15, C.dthLED);   // LED on belt

    // ── LEGS ──────────────────────────────────────────────────────────
    const lx = 4 - legOff;
    const rx = 11 + legOff;
    ss.rect(lx, 16, 4, 3, C.dthMid);
    ss.rect(rx, 16, 4, 3, C.dthMid);
    ss.px(lx, 16, C.dthLight);
    ss.px(rx, 16, C.dthLight);
    // Boots
    ss.hline(19, lx - 1, lx + 4, C.dthDark);
    ss.hline(19, rx - 1, rx + 4, C.dthDark);
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

    // ── LIGHTSABER (pointing UP, x=19-20) — most iconic feature ────────
    // Saber blade
    ss.vline(19, 0, 16, saberColor);
    ss.vline(20, 0, 16, saberCore);
    ss.px(19, 0, C.saberRedTip);
    ss.px(20, 0, C.saberRedTip);
    ss.px(18, 1, saberColor);           // glow halo
    ss.px(21, 1, saberColor);
    ss.px(18, 8, saberColor);
    ss.px(21, 8, saberColor);
    // Crossguard / hilt start
    ss.rect(16, 16, 8, 2, C.impGrey);
    ss.hline(16, 17, 22, C.impSheen);
    // Hilt body (Vader's saber)
    ss.rect(18, 18, 4, 4, C.impLight);
    ss.px(19, 18, C.impSheen);
    ss.px(20, 18, C.metalLight);
    // Hand grips
    ss.rect(17, 22, 3, 2, C.vaderArmor);
    ss.rect(20, 22, 3, 2, C.vaderArmor);

    // ── VADER HELMET (THE dome, most recognizable silhouette) ──────────
    // Top of dome (narrow, tall)
    ss.hline(16, 17, 22, C.vaderHelm);
    ss.px(17, 16, C.vaderHelm);
    ss.px(22, 16, C.vaderHelm);
    ss.hline(17, 15, 24, C.vaderHelm);
    ss.hline(18, 14, 25, C.vaderHelm);
    ss.hline(19, 13, 26, C.vaderHelm);
    // Dome main
    ss.hline(20, 12, 27, C.vaderHelm);
    ss.hline(21, 11, 28, C.vaderHelm);
    ss.hline(22, 11, 28, C.vaderHelm);
    // Dome sheen (subtle highlight left side)
    ss.px(14, 19, C.vaderSheen);
    ss.px(14, 20, C.vaderSheen);
    ss.px(15, 21, C.vaderSheen);
    // Face mask area (wider than dome)
    ss.hline(23, 10, 29, C.vaderHelm);
    // Eyes — two narrow red-tinted slits in the mask
    ss.hline(23, 13, 16, enraged ? C.saberRedGlow : C.impSilver);  // L eye slit
    ss.hline(23, 23, 26, enraged ? C.saberRedGlow : C.impSilver);  // R eye slit
    // Nose/breathing apparatus
    ss.hline(24, 11, 28, C.vaderArmor);
    ss.px(19, 24, C.impSilver);
    ss.px(20, 24, C.impSilver);
    ss.px(19, 25, C.impGrey);
    ss.px(20, 25, C.impGrey);
    // Jaw / lower mask
    ss.hline(25, 12, 27, C.vaderHelm);
    ss.hline(26, 13, 26, C.vaderHelm);

    // ── CHEST ARMOR PANEL (life-support system) ────────────────────────
    ss.rect(12, 27, 16, 6, C.vaderArmor);
    // Left breathing control panel
    ss.rect(13, 28, 5, 4, C.vaderHelm);
    ss.px(14, 29, enraged ? C.saberRed : C.ledRed);
    ss.px(15, 28, C.ledRed);
    ss.px(16, 29, C.impGrey);
    ss.px(14, 30, C.impGrey);
    ss.px(16, 30, enraged ? C.saberRed : C.ledRed);
    // Right breathing control panel
    ss.rect(22, 28, 5, 4, C.vaderHelm);
    ss.px(23, 29, C.ledRed);
    ss.px(24, 28, enraged ? C.saberRed : C.ledRed);
    ss.px(25, 30, C.impGrey);
    ss.px(23, 30, enraged ? C.saberRed : C.ledRed);
    ss.px(25, 29, C.impGrey);
    // Chest plate highlight
    ss.hline(27, 13, 26, C.vaderSheen);

    // ── SHOULDERS / PAULDRONS (massive) ────────────────────────────────
    ss.rect(7, 24, 8, 4, C.vaderArmor);   // L shoulder
    ss.rect(25, 24, 8, 4, C.vaderArmor);  // R shoulder
    ss.hline(24, 8, 14, C.vaderSheen);
    ss.hline(24, 25, 31, C.vaderSheen);

    // ── ARMS (armored, black) ──────────────────────────────────────────
    ss.rect(7, 28, 4, 6, C.vaderArmor);
    ss.rect(29, 28, 4, 6, C.vaderArmor);
    ss.px(8, 28, C.vaderSheen);
    ss.px(30, 28, C.vaderSheen);

    // ── FLOWING CAPE (the most dramatic element) ───────────────────────
    // Cape behind body — wide dramatic sweep
    ss.rect(3, 26, 5, 14, C.capeBlack);
    ss.rect(32, 26, 5, 14, C.capeBlack);
    ss.rect(2, 30, 4, 10, C.cape);
    ss.rect(34, 30, 4, 10, C.cape);
    // Inner cape (slightly lighter)
    ss.vline(5, 29, 39, C.capeShade);
    ss.vline(34, 29, 39, C.capeShade);
    // Cape bottom hem
    ss.hline(39, 2, 7, C.capeBlack);
    ss.hline(39, 32, 37, C.capeBlack);

    // ── BELT (Imperial buckle) ─────────────────────────────────────────
    ss.hline(33, 12, 27, C.impLight);
    ss.rect(17, 32, 6, 3, C.impGrey);
    ss.px(19, 33, C.gold);
    ss.px(20, 33, C.gold);
    ss.px(19, 34, C.goldDark);
    ss.px(20, 34, C.goldDark);

    // ── LEGS ──────────────────────────────────────────────────────────
    const lx = 13 - legOff;
    const rx = 21 + legOff;
    ss.rect(lx, 35, 5, 4, C.vaderArmor);
    ss.rect(rx, 35, 5, 4, C.vaderArmor);
    ss.px(lx + 1, 35, C.vaderSheen);
    ss.px(rx + 1, 35, C.vaderSheen);
    // Boots
    ss.hline(39, lx - 1, lx + 5, C.vaderHelm);
    ss.hline(39, rx - 1, rx + 5, C.vaderHelm);
  }

  drawVader(0, 0, false);   // idle
  drawVader(1, 1, false);   // walkA
  drawVader(2, -1, false);  // walkB
  drawVader(3, 0, true);    // enraged / attack

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

// ── IMPERIAL CONSOLE (bush replacement — hides player) ─────────────────────
// 28×28 logical pixels, scale 4 → 112×112 texture
export function paintConsole(scene, key = 'bush') {
  const c = new PixelCanvas(scene, key, 28, 28, 4);

  // Console body
  c.rect(4, 4, 20, 20, PAL.impGrey);
  c.rect(5, 5, 18, 18, PAL.impMid);
  // Screen glow (blue)
  c.rect(7, 7, 14, 10, PAL.impDark);
  c.rect(8, 8, 12, 8, '#0a1a30');
  // Screen content lines (data readout)
  c.hline(9, 9, 18, PAL.stripBluGlow);
  c.hline(11, 9, 14, PAL.stripBluGlow);
  c.hline(11, 16, 18, '#30a030');
  c.hline(13, 9, 12, PAL.stripBluGlow);
  c.hline(13, 15, 17, '#c04040');
  // Keyboard/control panel bottom
  c.rect(6, 18, 16, 5, PAL.impLight);
  c.px(8, 19, PAL.ledRed);
  c.px(11, 19, PAL.ledGreen);
  c.px(14, 19, PAL.ledGreen);
  c.px(17, 19, PAL.ledRed);
  c.px(8, 21, PAL.impSheen);
  c.px(10, 21, PAL.impSheen);
  c.px(13, 21, PAL.impSheen);
  c.px(15, 21, PAL.impSheen);
  c.px(17, 21, PAL.impSheen);
  // Side panels / frame
  c.rect(4, 4, 2, 20, PAL.impLight);
  c.rect(22, 4, 2, 20, PAL.impLight);
  c.px(4, 4, PAL.impSheen);
  c.px(25, 4, PAL.impSheen);
  // Imperial cog emblem on side
  c.px(2, 12, PAL.impSheen);
  c.px(3, 12, PAL.impSilver);
  c.px(2, 13, PAL.impSheen);
  // Base
  c.rect(3, 24, 22, 3, PAL.impDark);
  c.px(4, 24, PAL.impGrey);
  c.px(22, 24, PAL.impGrey);
  c.finish();
}

// ── BLAST DOOR SEGMENT (wall replacement) ─────────────────────────────────
// 26×26 logical, scale 4 → 104×104
export function paintBlastDoor(scene, key = 'wall') {
  const c = new PixelCanvas(scene, key, 26, 26, 4);

  // Main door body
  c.rect(1, 1, 24, 24, PAL.impGrey);
  c.rect(2, 2, 22, 22, PAL.impMid);
  // Door ridges (horizontal armoring strips)
  c.hline(6, 2, 23, PAL.impLight);
  c.hline(7, 2, 23, PAL.impDark);
  c.hline(13, 2, 23, PAL.impLight);
  c.hline(14, 2, 23, PAL.impDark);
  c.hline(19, 2, 23, PAL.impLight);
  c.hline(20, 2, 23, PAL.impDark);
  // Warning stripes (orange/black diagonal - Imperial style)
  c.px(3, 3, '#cc4400');
  c.px(4, 3, '#000000');
  c.px(3, 4, '#000000');
  c.px(4, 4, '#cc4400');
  c.px(20, 3, '#cc4400');
  c.px(21, 3, '#000000');
  c.px(20, 4, '#000000');
  c.px(21, 4, '#cc4400');
  c.px(3, 20, '#cc4400');
  c.px(4, 20, '#000000');
  c.px(3, 21, '#000000');
  c.px(4, 21, '#cc4400');
  c.px(20, 20, '#cc4400');
  c.px(21, 20, '#000000');
  c.px(20, 21, '#000000');
  c.px(21, 21, '#cc4400');
  // Imperial cog symbol (center)
  c.circle(13, 13, 3, PAL.impSheen);
  c.circle(13, 13, 1, PAL.impGrey);
  // Cog teeth hints
  c.px(13, 9, PAL.impSilver);
  c.px(13, 17, PAL.impSilver);
  c.px(9, 13, PAL.impSilver);
  c.px(17, 13, PAL.impSilver);
  // Frame border
  c.rect(1, 1, 24, 1, PAL.impSheen);
  c.rect(1, 24, 24, 1, PAL.impDark);
  c.vline(1, 1, 25, PAL.impSheen);
  c.vline(24, 1, 25, PAL.impDark);
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
