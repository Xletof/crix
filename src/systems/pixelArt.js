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

// ── WEAPON OVERLAY SPRITES ─────────────────────────────────────────────────
// These small sprites float "in the character's hand" — the body never
// rotates; only the weapon orbits the character, pointing in the aim
// direction. Sprite is drawn facing RIGHT (barrel points +X) so it lines up
// naturally when setRotation(aim) is applied.
export function paintPistolOverlay(scene, key = 'wpn-pistol') {
  const c = new PixelCanvas(scene, key, 14, 8, 4);
  // Grip (held end) on the LEFT, barrel pointing RIGHT.
  // Grip
  c.rect(0, 3, 4, 4, PAL.beskarDark);
  c.rect(0, 3, 4, 1, PAL.beskarMid);
  c.rect(0, 6, 4, 1, PAL.black);
  c.px(1, 4, PAL.beskarLight);
  // Slide / receiver block
  c.rect(3, 2, 5, 4, PAL.impGrey);
  c.rect(3, 2, 5, 1, PAL.impLight);
  c.rect(3, 5, 5, 1, PAL.black);
  c.px(4, 3, PAL.impSheen);
  // Barrel
  c.rect(8, 3, 5, 2, PAL.impGrey);
  c.hline(3, 8, 12, PAL.impLight);
  c.hline(4, 8, 12, PAL.black);
  // Muzzle tip
  c.px(13, 3, PAL.metalLight);
  c.px(13, 4, PAL.offWhite);
  c.finish();
}

export function paintRifleOverlay(scene, key = 'wpn-rifle') {
  const c = new PixelCanvas(scene, key, 20, 8, 4);
  // Stock
  c.rect(0, 3, 3, 4, PAL.beskarDeep);
  c.hline(3, 0, 2, PAL.beskarMid);
  c.hline(6, 0, 2, PAL.black);
  // Receiver
  c.rect(3, 2, 7, 5, PAL.impGrey);
  c.hline(2, 3, 9, PAL.impLight);
  c.hline(6, 3, 9, PAL.black);
  c.px(5, 4, PAL.gold);  // selector
  // Long barrel
  c.rect(10, 3, 9, 2, PAL.impGrey);
  c.hline(3, 10, 18, PAL.impLight);
  c.hline(4, 10, 18, PAL.black);
  c.px(19, 3, PAL.metalLight);
  c.px(19, 4, PAL.offWhite);
  c.finish();
}

export function paintEnemyRifleOverlay(scene, key = 'wpn-enemy-rifle') {
  const c = new PixelCanvas(scene, key, 18, 8, 4);
  // Compact E-11 silhouette — held by stormtroopers + death troopers.
  c.rect(0, 3, 3, 4, PAL.impDark);
  c.rect(3, 2, 6, 5, PAL.impMid);
  c.hline(2, 3, 8, PAL.impLight);
  c.hline(6, 3, 8, PAL.black);
  c.rect(9, 3, 8, 2, PAL.impGrey);
  c.hline(3, 9, 16, PAL.impLight);
  c.hline(4, 9, 16, PAL.black);
  c.px(17, 3, PAL.metalLight);
  c.px(17, 4, PAL.boltGreenCore); // green-tinted muzzle hint
  c.finish();
}

export function paintSaberOverlay(scene, key = 'wpn-saber') {
  const c = new PixelCanvas(scene, key, 22, 6, 4);
  // Hilt
  c.rect(0, 1, 4, 4, PAL.impGrey);
  c.hline(0, 0, 3, PAL.impLight);
  c.hline(5, 0, 3, PAL.black);
  c.px(2, 2, PAL.gold);
  c.px(2, 3, PAL.goldDark);
  // Emitter
  c.rect(4, 2, 1, 2, PAL.metalLight);
  // Blade
  c.rect(5, 2, 17, 2, PAL.saberRed);
  c.hline(2, 5, 21, PAL.saberRedGlow);
  c.hline(3, 5, 21, PAL.saberRedCore);
  c.px(21, 2, PAL.saberRedTip);
  c.px(21, 3, PAL.saberRedTip);
  c.finish();
}

// ── PLAYER: Mandalorian (24×24, 4 frames) — TOP-DOWN 3/4 HIP-FIRE ──────────
// Body silhouette does the work: dome on top, wider pauldrons below, chest
// plate, cape flaring behind, weapon stub at the right hip. The weapon never
// extends past the dome — so it can't read as an antenna at any rotation.
export function paintPlayer(scene, key = 'player') {
  const ss = new SpriteSheet(scene, key, 24, 24, 24, 4);

  function drawMando(f, legPhase = 0, dir = 'front', hurt = false) {
    ss.frame(f);
    const C = PAL;
    const bob = (legPhase === 0) ? 0 : (Math.abs(legPhase) === 2 ? 1 : 0);
    const bodyTint = hurt ? C.beskarShine : C.beskar;
    const bodyMid  = hurt ? '#ffffff'      : C.beskarMid;

    // ── HELMET DOME ───────────────────────────────────────────────────────
    const cy = 8 + bob;
    ss.hline(cy - 4, 10, 13, C.beskarDark);
    ss.hline(cy - 3, 9,  14, bodyTint);
    ss.hline(cy - 2, 8,  15, bodyTint);
    ss.hline(cy - 1, 8,  15, bodyMid);
    ss.hline(cy,     8,  15, bodyMid);
    ss.hline(cy + 1, 8,  15, bodyTint);
    ss.hline(cy + 2, 9,  14, bodyTint);
    ss.hline(cy + 3, 10, 13, C.beskarDark);
    
    // Visor / details based on direction
    if (dir === 'front') {
      // Black T-visor
      ss.vline(11, cy - 1, cy + 2, C.black);
      ss.vline(12, cy - 1, cy + 2, C.black);
      ss.hline(cy, 9, 14, C.black);
      ss.px(10, cy - 1, C.beskarLight);
      ss.px(13, cy - 1, C.beskarLight);
    } else if (dir === 'side') {
      // Visor profile on the right (facing East)
      ss.vline(13, cy - 1, cy + 2, C.black);
      ss.px(14, cy, C.black);
      ss.px(12, cy, C.beskarLight);
    } else {
      // Back view - plain helmet back
      ss.px(11, cy - 1, C.beskarLight);
      ss.px(12, cy - 1, C.beskarLight);
    }

    // ── BODY LAYOUTS ──────────────────────────────────────────────────────
    if (dir === 'front') {
      ss.rect(4,  12 + bob, 4, 3, bodyTint);
      ss.rect(16, 12 + bob, 4, 3, bodyTint);
      ss.hline(12 + bob, 4,  7,  C.beskarLight);
      ss.hline(12 + bob, 16, 19, C.beskarLight);
      ss.hline(14 + bob, 4,  7,  C.beskarDark);
      ss.hline(14 + bob, 16, 19, C.beskarDark);
      ss.vline(4,  12 + bob, 14 + bob, C.beskarDeep);
      ss.vline(19, 12 + bob, 14 + bob, C.beskarDeep);

      ss.rect(8, 13 + bob, 8, 5, bodyTint);
      ss.hline(13 + bob, 8, 15, C.beskarLight);
      ss.hline(17 + bob, 8, 15, C.beskarDeep);
      ss.vline(8,  13 + bob, 17 + bob, C.beskarDark);
      ss.vline(15, 13 + bob, 17 + bob, C.beskarDark);
      ss.px(11, 15 + bob, C.gold);     ss.px(12, 15 + bob, C.gold);
      ss.px(11, 16 + bob, C.goldDark); ss.px(12, 16 + bob, C.goldDark);

      ss.hline(18 + bob, 8, 15, C.impDark);
      ss.px(11, 18 + bob, C.gold);
      ss.px(12, 18 + bob, C.gold);

      ss.rect(6, 19 + bob, 2, 3, C.cape);
      ss.rect(16, 19 + bob, 2, 3, C.cape);

    } else if (dir === 'back') {
      ss.rect(4, 12 + bob, 3, 3, bodyTint);
      ss.rect(17, 12 + bob, 3, 3, bodyTint);
      ss.rect(7, 12 + bob, 10, 11, C.cape);
      ss.hline(12 + bob, 7, 16, C.capeShade);
      ss.vline(7, 13 + bob, 22 + bob, C.capeBlack);
      ss.vline(16, 13 + bob, 22 + bob, C.capeBlack);
      ss.vline(11, 13 + bob, 22 + bob, C.capeBlack);

    } else if (dir === 'side') {
      ss.rect(5, 12 + bob, 4, 10, C.cape);
      ss.vline(5, 12 + bob, 21 + bob, C.capeBlack);
      ss.vline(8, 12 + bob, 21 + bob, C.capeShade);

      ss.rect(9, 12 + bob, 9, 6, bodyTint);
      ss.hline(12 + bob, 9, 17, C.beskarLight);
      ss.rect(11, 12 + bob, 5, 4, bodyMid);
      ss.hline(12 + bob, 11, 15, C.beskarLight);
      ss.px(13, 14 + bob, C.gold);
      ss.px(14, 14 + bob, C.gold);

      ss.hline(18 + bob, 9, 17, C.impDark);
      ss.px(16, 18 + bob, C.gold);
    }

    // ── LEGS ──────────────────────────────────────────────────────────────
    let lx = 10, ly = 21;
    let rx = 13, ry = 21;

    if (dir === 'side') {
      if (legPhase === 1) {
        lx = 8; ly = 21;
        rx = 14; ry = 21;
      } else if (legPhase === 2) {
        lx = 7; ly = 21;
        rx = 16; ry = 21;
      } else if (legPhase === -1) {
        lx = 12; ly = 21;
        rx = 10; ry = 21;
      } else if (legPhase === -2) {
        lx = 14; ly = 21;
        rx = 8; ry = 21;
      }
    } else {
      if (legPhase === 1) {
        lx = 9; ly = 20;
        rx = 14; ry = 22;
      } else if (legPhase === 2) {
        lx = 8; ly = 19;
        rx = 15; ry = 23;
      } else if (legPhase === -1) {
        lx = 11; ly = 22;
        rx = 12; ry = 20;
      } else if (legPhase === -2) {
        lx = 12; ly = 23;
        rx = 9; ry = 19;
      }
    }

    ss.rect(lx, ly, 2, 2, C.beskarDeep);
    ss.rect(lx, ly + 2, 2, 1, C.black);
    ss.rect(rx, ry, 2, 2, C.beskarDeep);
    ss.rect(rx, ry + 2, 2, 1, C.black);
  }

  // Front
  drawMando(0, 0, 'front', false);
  drawMando(1, 1, 'front', false);
  drawMando(2, 2, 'front', false);
  drawMando(3, 1, 'front', false);
  drawMando(4, -1, 'front', false);
  drawMando(5, -2, 'front', false);
  drawMando(6, -1, 'front', false);
  drawMando(7, 0, 'front', true);

  // Back
  drawMando(8, 0, 'back', false);
  drawMando(9, 1, 'back', false);
  drawMando(10, 2, 'back', false);
  drawMando(11, 1, 'back', false);
  drawMando(12, -1, 'back', false);
  drawMando(13, -2, 'back', false);
  drawMando(14, -1, 'back', false);
  drawMando(15, 0, 'back', true);

  // Side
  drawMando(16, 0, 'side', false);
  drawMando(17, 1, 'side', false);
  drawMando(18, 2, 'side', false);
  drawMando(19, 1, 'side', false);
  drawMando(20, -1, 'side', false);
  drawMando(21, -2, 'side', false);
  drawMando(22, -1, 'side', false);
  drawMando(23, 0, 'side', true);

  ss.finish();
}

// ── GRUNT: Stormtrooper (20×20, 24 frames) — 4-DIRECTIONAL ─────────────────
export function paintGrunt(scene, key = 'grunt') {
  const ss = new SpriteSheet(scene, key, 20, 20, 24, 4);
  const C = PAL;

  function drawTrooper(f, legPhase = 0, dir = 'front', hurt = false) {
    ss.frame(f);
    const bob = (legPhase === 0) ? 0 : (Math.abs(legPhase) === 2 ? 1 : 0);
    const main = hurt ? '#ffffff' : C.troopWhite;
    const mid  = hurt ? C.troopLight : C.troopLight;

    // ── HELMET DOME ───────────────────────────────────────────────────────
    const cy = 7 + bob;
    ss.hline(cy - 3, 7,  10, C.troopShade);
    ss.hline(cy - 2, 6,  11, main);
    ss.hline(cy - 1, 6,  11, mid);
    ss.hline(cy,     6,  11, mid);
    ss.hline(cy + 1, 6,  11, main);
    ss.hline(cy + 2, 7,  10, C.troopShade);
    // Crown highlight
    ss.px(8, cy - 1, '#ffffff');
    ss.px(9, cy - 1, '#ffffff');

    // Visor and details based on direction
    if (dir === 'front') {
      ss.hline(cy + 1, 7, 10, C.black);
      ss.px(8, cy + 2, C.impGrey);
      ss.px(9, cy + 2, C.impGrey);
    } else if (dir === 'side') {
      ss.hline(cy + 1, 9, 11, C.black);
      ss.px(11, cy + 2, C.impGrey);
    } else {
      // Back - plain helmet back
    }

    // ── BODY LAYOUTS ──────────────────────────────────────────────────────
    if (dir === 'front') {
      ss.rect(3, 11 + bob, 3, 3, main);
      ss.rect(14, 11 + bob, 3, 3, main);
      ss.hline(11 + bob, 3,  5, C.troopLight);
      ss.hline(11 + bob, 14, 16, C.troopLight);
      ss.hline(13 + bob, 3,  5, C.troopShade);
      ss.hline(13 + bob, 14, 16, C.troopShade);

      ss.rect(6, 12 + bob, 8, 4, main);
      ss.hline(12 + bob, 6, 13, C.troopLight);
      ss.hline(15 + bob, 6, 13, C.troopShade);
      ss.vline(6,  12 + bob, 15 + bob, C.troopShade);
      ss.vline(13, 12 + bob, 15 + bob, C.troopShade);
      ss.vline(9,  13 + bob, 14 + bob, C.troopShade);
      ss.vline(10, 13 + bob, 14 + bob, C.troopShade);
      ss.hline(16 + bob, 6, 13, C.impGrey);
      ss.px(8,  16 + bob, C.impSheen); ss.px(11, 16 + bob, C.impSheen);

    } else if (dir === 'back') {
      ss.rect(3, 11 + bob, 3, 3, main);
      ss.rect(14, 11 + bob, 3, 3, main);
      ss.rect(6, 12 + bob, 8, 4, main);
      ss.hline(12 + bob, 6, 13, C.troopLight);
      ss.hline(15 + bob, 6, 13, C.troopShade);
      ss.hline(16 + bob, 7, 12, '#ffffff');
      ss.hline(17 + bob, 7, 12, C.impGrey);

    } else if (dir === 'side') {
      ss.rect(5, 11 + bob, 4, 5, main);
      ss.hline(11 + bob, 5, 8, C.troopLight);
      ss.hline(15 + bob, 5, 8, C.troopShade);
      ss.vline(7, 12 + bob, 14 + bob, C.black);
      ss.rect(9, 12 + bob, 6, 4, main);
      ss.hline(16 + bob, 8, 13, C.impGrey);
    }

    // ── LEGS ──────────────────────────────────────────────────────────────
    let lx = 7, ly = 18;
    let rx = 11, ry = 18;

    if (dir === 'side') {
      if (legPhase === 1) { lx = 5; ly = 18; rx = 11; ry = 18; }
      else if (legPhase === 2) { lx = 4; ly = 18; rx = 13; ry = 18; }
      else if (legPhase === -1) { lx = 9; ly = 18; rx = 7; ry = 18; }
      else if (legPhase === -2) { lx = 11; ly = 18; rx = 5; ry = 18; }
    } else {
      if (legPhase === 1) { lx = 6; ly = 17; rx = 12; ry = 19; }
      else if (legPhase === 2) { lx = 5; ly = 16; rx = 13; ry = 20; }
      else if (legPhase === -1) { lx = 8; ly = 19; rx = 10; ry = 17; }
      else if (legPhase === -2) { lx = 9; ly = 20; rx = 9; ry = 16; }
    }

    ss.rect(lx, ly, 2, 2, C.troopDark); ss.rect(lx, ly + 2, 2, 1, C.troopBlack);
    ss.rect(rx, ry, 2, 2, C.troopDark); ss.rect(rx, ry + 2, 2, 1, C.troopBlack);
  }

  // Front
  drawTrooper(0, 0, 'front', false);
  drawTrooper(1, 1, 'front', false);
  drawTrooper(2, 2, 'front', false);
  drawTrooper(3, 1, 'front', false);
  drawTrooper(4, -1, 'front', false);
  drawTrooper(5, -2, 'front', false);
  drawTrooper(6, -1, 'front', false);
  drawTrooper(7, 0, 'front', true);

  // Back
  drawTrooper(8, 0, 'back', false);
  drawTrooper(9, 1, 'back', false);
  drawTrooper(10, 2, 'back', false);
  drawTrooper(11, 1, 'back', false);
  drawTrooper(12, -1, 'back', false);
  drawTrooper(13, -2, 'back', false);
  drawTrooper(14, -1, 'back', false);
  drawTrooper(15, 0, 'back', true);

  // Side
  drawTrooper(16, 0, 'side', false);
  drawTrooper(17, 1, 'side', false);
  drawTrooper(18, 2, 'side', false);
  drawTrooper(19, 1, 'side', false);
  drawTrooper(20, -1, 'side', false);
  drawTrooper(21, -2, 'side', false);
  drawTrooper(22, -1, 'side', false);
  drawTrooper(23, 0, 'side', true);

  ss.finish();
}

// ── SHOOTER: Death Trooper (20×20, 8 frames) ──────────────────────────────
export function paintShooter(scene, key = 'shooter') {
  const ss = new SpriteSheet(scene, key, 20, 20, 24, 4);
  const C = PAL;

  function drawDeathTrooper(f, legPhase = 0, dir = 'front', hurt = false) {
    ss.frame(f);
    const bob = (legPhase === 0) ? 0 : (Math.abs(legPhase) === 2 ? 1 : 0);
    const main = hurt ? C.dthLight : C.dthMid;
    const dark = hurt ? C.dthMid   : C.dthDark;

    // ── HELMET DOME ───────────────────────────────────────────────────────
    const cy = 7 + bob;
    ss.hline(cy - 3, 7,  10, dark);
    ss.hline(cy - 2, 6,  11, main);
    ss.hline(cy - 1, 6,  11, C.dthLight);
    ss.hline(cy,     6,  11, C.dthLight);
    ss.hline(cy + 1, 6,  11, main);
    ss.hline(cy + 2, 7,  10, dark);
    // Crown highlight
    ss.px(8, cy - 1, '#4a4a58');
    ss.px(9, cy - 1, '#4a4a58');

    // Visor LEDs / details
    if (dir === 'front') {
      ss.px(6, cy, C.dthLED);
      ss.px(11, cy, C.dthLED);
    } else if (dir === 'side') {
      // LED on the right profile
      ss.px(11, cy, C.dthLED);
    }

    // ── BODY LAYOUTS ──────────────────────────────────────────────────────
    if (dir === 'front') {
      ss.rect(3, 11 + bob, 3, 3, main);
      ss.rect(14, 11 + bob, 3, 3, main);
      ss.hline(11 + bob, 3,  5, C.dthLight);
      ss.hline(11 + bob, 14, 16, C.dthLight);
      ss.hline(13 + bob, 3,  5, dark);
      ss.hline(13 + bob, 14, 16, dark);

      ss.rect(6, 12 + bob, 8, 4, main);
      ss.hline(12 + bob, 6, 13, C.dthLight);
      ss.hline(15 + bob, 6, 13, dark);
      ss.vline(6,  12 + bob, 15 + bob, dark);
      ss.vline(13, 12 + bob, 15 + bob, dark);
      ss.vline(9,  13 + bob, 14 + bob, C.dthLight);
      ss.vline(10, 13 + bob, 14 + bob, C.dthLight);
      ss.hline(16 + bob, 6, 13, dark);
      ss.px(9,  16 + bob, C.dthLED);
      ss.px(10, 16 + bob, C.dthLEDBright);

    } else if (dir === 'back') {
      ss.rect(3, 11 + bob, 3, 3, main);
      ss.rect(14, 11 + bob, 3, 3, main);
      ss.rect(6, 12 + bob, 8, 4, main);
      ss.hline(12 + bob, 6, 13, C.dthLight);
      ss.hline(15 + bob, 6, 13, dark);
      // Detonator belt pack
      ss.hline(16 + bob, 7, 12, dark);
      ss.hline(17 + bob, 7, 12, C.black);

    } else if (dir === 'side') {
      ss.rect(5, 11 + bob, 4, 5, main);
      ss.hline(11 + bob, 5, 8, C.dthLight);
      ss.hline(15 + bob, 5, 8, dark);
      ss.vline(7, 12 + bob, 14 + bob, C.black);
      ss.rect(9, 12 + bob, 6, 4, main);
      ss.hline(16 + bob, 8, 13, dark);
    }

    // ── LEGS ──────────────────────────────────────────────────────────────
    let lx = 7, ly = 18;
    let rx = 11, ry = 18;

    if (dir === 'side') {
      if (legPhase === 1) { lx = 5; ly = 18; rx = 11; ry = 18; }
      else if (legPhase === 2) { lx = 4; ly = 18; rx = 13; ry = 18; }
      else if (legPhase === -1) { lx = 9; ly = 18; rx = 7; ry = 18; }
      else if (legPhase === -2) { lx = 11; ly = 18; rx = 5; ry = 18; }
    } else {
      if (legPhase === 1) { lx = 6; ly = 17; rx = 12; ry = 19; }
      else if (legPhase === 2) { lx = 5; ly = 16; rx = 13; ry = 20; }
      else if (legPhase === -1) { lx = 8; ly = 19; rx = 10; ry = 17; }
      else if (legPhase === -2) { lx = 9; ly = 20; rx = 9; ry = 16; }
    }

    ss.rect(lx, ly, 2, 2, dark);
    ss.rect(lx, ly + 2, 2, 1, C.black);
    ss.rect(rx, ry, 2, 2, dark);
    ss.rect(rx, ry + 2, 2, 1, C.black);
  }

  // Front
  drawDeathTrooper(0, 0, 'front', false);
  drawDeathTrooper(1, 1, 'front', false);
  drawDeathTrooper(2, 2, 'front', false);
  drawDeathTrooper(3, 1, 'front', false);
  drawDeathTrooper(4, -1, 'front', false);
  drawDeathTrooper(5, -2, 'front', false);
  drawDeathTrooper(6, -1, 'front', false);
  drawDeathTrooper(7, 0, 'front', true);

  // Back
  drawDeathTrooper(8, 0, 'back', false);
  drawDeathTrooper(9, 1, 'back', false);
  drawDeathTrooper(10, 2, 'back', false);
  drawDeathTrooper(11, 1, 'back', false);
  drawDeathTrooper(12, -1, 'back', false);
  drawDeathTrooper(13, -2, 'back', false);
  drawDeathTrooper(14, -1, 'back', false);
  drawDeathTrooper(15, 0, 'back', true);

  // Side
  drawDeathTrooper(16, 0, 'side', false);
  drawDeathTrooper(17, 1, 'side', false);
  drawDeathTrooper(18, 2, 'side', false);
  drawDeathTrooper(19, 1, 'side', false);
  drawDeathTrooper(20, -1, 'side', false);
  drawDeathTrooper(21, -2, 'side', false);
  drawDeathTrooper(22, -1, 'side', false);
  drawDeathTrooper(23, 0, 'side', true);

  ss.finish();
}

// ── BOSS: Darth Vader (40×40, 4 frames) — NO ROTATION ─────────────────────
// Massive cape spreading south, dome at top, weapon (saber) is a separate
// rotating overlay sprite — body itself is static aside from walk/idle.
export function paintBoss(scene, key = 'boss') {
  const ss = new SpriteSheet(scene, key, 40, 40, 24, 4);
  const C = PAL;

  function drawVader(f, legPhase = 0, dir = 'front', enraged = false) {
    ss.frame(f);
    const bob = (legPhase === 0) ? 0 : (Math.abs(legPhase) === 2 ? 2 : 0);
    const main = enraged ? C.vaderSheen : C.vaderArmor;

    // ── HELMET DOME (cy centered) ─────────────────────────────────────────
    const cy = 14 + bob;
    
    // Draw base dome shape
    for (let dy = -7; dy <= 7; dy++) {
      const w = Math.round(Math.sqrt(64 - dy * dy));
      const xl = 20 - w, xr = 19 + w;
      const tone = dy <= -5 || dy >= 5 ? C.vaderHelm
                 : dy <= -3 || dy >= 3 ? main
                 : C.vaderSheen;
      ss.hline(cy + dy, xl, xr, tone);
    }
    // Dark side rim
    ss.vline(11, cy - 3, cy + 3, C.black);
    ss.vline(28, cy - 3, cy + 3, C.black);

    // Visor and details based on direction
    if (dir === 'front') {
      // Crown center highlight
      ss.rect(18, cy - 2, 4, 4, C.vaderBreath);
      ss.px(19, cy - 1, C.impSilver);
      ss.px(20, cy - 1, C.impSilver);
      // Triangular mask grill
      ss.vline(19, cy + 2, cy + 5, C.black);
      ss.vline(20, cy + 2, cy + 5, C.black);
      ss.px(18, cy + 4, C.vaderBreath);
      ss.px(21, cy + 4, C.vaderBreath);
      
      // Eyes / visor
      const eyeColor = enraged ? C.saberRed : C.black;
      ss.rect(15, cy + 1, 3, 2, eyeColor);
      ss.rect(22, cy + 1, 3, 2, eyeColor);
      
    } else if (dir === 'side') {
      // Profile snout/mask sticking out right
      ss.vline(25, cy - 1, cy + 3, C.black);
      ss.rect(23, cy + 2, 3, 3, C.black);
      ss.px(26, cy + 3, C.vaderBreath); // breathing filter tip
      // Eye profile on right
      const eyeColor = enraged ? C.saberRed : C.black;
      ss.rect(21, cy + 1, 2, 2, eyeColor);
      
    } else {
      // Back view - solid black dome back
      ss.rect(18, cy - 2, 4, 4, C.black);
    }

    // ── BODY LAYOUTS ──────────────────────────────────────────────────────
    if (dir === 'front') {
      // Pauldrons
      ss.rect(3,  cy + 5, 8, 6, main);
      ss.rect(29, cy + 5, 8, 6, main);
      ss.hline(cy + 5,  3,  10, C.vaderSheen);
      ss.hline(cy + 5,  29, 36, C.vaderSheen);
      ss.hline(cy + 10, 3,  10, C.black);
      ss.hline(cy + 10, 29, 36, C.black);
      ss.vline(3,  cy + 5, cy + 10, C.black);
      ss.vline(36, cy + 5, cy + 10, C.black);

      // Chest panel
      const cy2 = cy + 11;
      ss.rect(11, cy2, 18, 8, main);
      ss.hline(cy2,     11, 28, C.vaderSheen);
      ss.hline(cy2 + 7, 11, 28, C.black);
      ss.vline(11, cy2, cy2 + 7, C.black);
      ss.vline(28, cy2, cy2 + 7, C.black);
      // LEDs
      ss.rect(14, cy2 + 2, 12, 4, C.vaderHelm);
      ss.px(16, cy2 + 3, enraged ? C.saberRed : C.ledRed);
      ss.px(19, cy2 + 3, C.ledGreen);
      ss.px(20, cy2 + 3, C.ledGreen);
      ss.px(23, cy2 + 3, enraged ? C.saberRed : C.ledRed);
      ss.px(16, cy2 + 4, C.impGrey);
      ss.px(23, cy2 + 4, C.impGrey);

      // Cape (flares behind shoulders)
      ss.rect(8,  29 + bob, 24, 10, C.cape);
      ss.rect(6,  31 + bob, 28, 8,  C.cape);
      ss.rect(4,  33 + bob, 32, 6,  C.cape);
      ss.vline(4,  33 + bob, 38 + bob, C.capeBlack);
      ss.vline(35, 33 + bob, 38 + bob, C.capeBlack);
      ss.vline(6,  31 + bob, 38 + bob, C.capeBlack);
      ss.vline(33, 31 + bob, 38 + bob, C.capeBlack);
      ss.hline(38 + bob, 4, 35, C.capeBlack);
      ss.vline(12, 31 + bob, 38 + bob, C.capeShade);
      ss.vline(20, 31 + bob, 38 + bob, C.capeShade);
      ss.vline(27, 31 + bob, 38 + bob, C.capeShade);

    } else if (dir === 'back') {
      // Cape covers everything
      ss.rect(4, cy + 5, 32, 25, C.cape);
      ss.hline(cy + 5, 4, 35, C.capeShade);
      ss.vline(4, cy + 5, cy + 29, C.capeBlack);
      ss.vline(35, cy + 5, cy + 29, C.capeBlack);
      ss.vline(20, cy + 5, cy + 29, C.capeBlack);
      ss.hline(cy + 29, 4, 35, C.capeBlack);

    } else if (dir === 'side') {
      // Cape hangs left (West)
      ss.rect(6, cy + 5, 12, 24, C.cape);
      ss.vline(6, cy + 5, cy + 28, C.capeBlack);
      ss.vline(17, cy + 5, cy + 28, C.capeShade);

      // Side shoulder + chest profile
      ss.rect(18, cy + 5, 12, 14, main);
      ss.hline(cy + 5, 18, 29, C.vaderSheen);
      ss.rect(19, cy + 7, 7, 7, C.vaderHelm); // shoulder armor plate
      // Side control box
      ss.rect(26, cy + 11, 4, 6, C.black);
      ss.px(28, cy + 13, C.ledRed);
    }

    // ── LEGS ──────────────────────────────────────────────────────────────
    let lx = 15, ly = 37;
    let rx = 22, ry = 37;

    if (dir === 'side') {
      if (legPhase === 1) { lx = 11; ly = 37; rx = 23; ry = 37; }
      else if (legPhase === 2) { lx = 8; ly = 37; rx = 26; ry = 37; }
      else if (legPhase === -1) { lx = 20; ly = 37; rx = 14; ry = 37; }
      else if (legPhase === -2) { lx = 23; ly = 37; rx = 11; ry = 37; }
    } else {
      if (legPhase === 1) {
        lx = 13; ly = 35;
        rx = 24; ry = 38;
      } else if (legPhase === 2) {
        lx = 11; ly = 33;
        rx = 26; ry = 39;
      } else if (legPhase === -1) {
        lx = 17; ly = 38;
        rx = 20; ry = 35;
      } else if (legPhase === -2) {
        lx = 19; ly = 39;
        rx = 18; ry = 33;
      }
    }

    // Draw left boot
    ss.rect(lx, ly, 3, 2, C.vaderHelm);
    ss.rect(lx, ly + 2, 3, 1, C.black);
    // Draw right boot
    ss.rect(rx, ry, 3, 2, C.vaderHelm);
    ss.rect(rx, ry + 2, 3, 1, C.black);
  }

  // Front
  drawVader(0, 0, 'front', false);
  drawVader(1, 1, 'front', false);
  drawVader(2, 2, 'front', false);
  drawVader(3, 1, 'front', false);
  drawVader(4, -1, 'front', false);
  drawVader(5, -2, 'front', false);
  drawVader(6, -1, 'front', false);
  drawVader(7, 0, 'front', true);

  // Back
  drawVader(8, 0, 'back', false);
  drawVader(9, 1, 'back', false);
  drawVader(10, 2, 'back', false);
  drawVader(11, 1, 'back', false);
  drawVader(12, -1, 'back', false);
  drawVader(13, -2, 'back', false);
  drawVader(14, -1, 'back', false);
  drawVader(15, 0, 'back', true);

  // Side
  drawVader(16, 0, 'side', false);
  drawVader(17, 1, 'side', false);
  drawVader(18, 2, 'side', false);
  drawVader(19, 1, 'side', false);
  drawVader(20, -1, 'side', false);
  drawVader(21, -2, 'side', false);
  drawVader(22, -1, 'side', false);
  drawVader(23, 0, 'side', true);

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

// ── HACK TERMINAL (objective) ──────────────────────────────────────────────
// 24×24 logical @ scale 4 = 96×96. A floor-standing Imperial data terminal
// with a glowing amber screen — visually distinct from the grey cover console.
// The entity tints it green once hacked.
export function paintTerminal(scene, key = 'terminal') {
  const c = new PixelCanvas(scene, key, 24, 24, 4);
  const C = PAL;

  // Base pedestal (dark metal, top-down footprint)
  c.rect(5, 16, 14, 6, C.impDark);
  c.hline(16, 5, 18, C.impGrey);     // near edge highlight
  c.hline(21, 5, 18, C.black);       // far edge shadow
  c.vline(5,  16, 21, C.impMid);
  c.vline(18, 16, 21, C.black);

  // Main console body
  c.rect(4, 4, 16, 13, C.impMid);
  c.hline(4, 5, 18, C.impLight);     // top sheen
  c.vline(4, 4, 16, C.impGrey);
  c.vline(19, 4, 16, C.impDark);
  c.hline(16, 4, 19, C.black);       // body/base separator

  // Amber screen (the objective glow)
  c.rect(6, 6, 12, 8, '#2a1800');    // bezel
  c.rect(7, 7, 10, 6, '#ff9010');    // amber screen
  c.rect(7, 7, 10, 1, '#ffd060');    // top highlight
  // Scrolling data lines
  c.hline(8,  8, 14, '#ffe0a0');
  c.hline(9,  8, 12, '#cc6000');
  c.hline(10, 8, 15, '#ffe0a0');
  c.hline(11, 8, 11, '#cc6000');
  c.hline(11, 13, 15, '#ffe0a0');
  // Imperial cog on screen corner
  c.px(15, 11, '#cc6000');
  c.px(16, 11, '#cc6000');

  // Status LEDs along the top
  c.px(6,  5, C.ledRed);
  c.px(9,  5, '#ffaa20');
  c.px(12, 5, C.ledGreen);
  c.px(17, 5, '#ffaa20');

  // Antenna dish (top-left protrusion) — reads as "transmitting"
  c.px(3, 3, C.impSilver);
  c.px(2, 2, C.impSheen);
  c.px(4, 2, C.metalLight);

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

// Energy blaster bolt — long horizontal tracer, points EAST in the texture
// (matches Phaser's natural rotation-0 axis, so setRotation(travelAngle)
// orients the streak correctly). Rendered as a bright white core line
// surrounded by a saturated colored glow + diffuse halo + fading tail.
export function paintBolt(scene, key, coreColor, glowColor, len = 22) {
  // Width = streak length, height = thin glow band.
  const w = len + 6, h = 5;
  const c = new PixelCanvas(scene, key, w, h, 3);

  // ── Fading tail (leftmost few pixels) — diffuse, weak ──────────────
  c.px(0, 2, glowColor);
  c.px(1, 1, glowColor); c.px(1, 2, glowColor); c.px(1, 3, glowColor);
  c.px(2, 1, glowColor); c.px(2, 2, coreColor); c.px(2, 3, glowColor);

  // ── Main streak — bright outer band + thin saturated core ──────────
  c.rect(3, 1, w - 5, 3, coreColor);          // outer body (3 px tall)
  c.rect(3, 2, w - 5, 1, '#ffffff');          // pure white centre line

  // ── Soft glow halo above/below ─────────────────────────────────────
  c.rect(4, 0, w - 6, 1, glowColor);
  c.rect(4, 4, w - 6, 1, glowColor);

  // ── Bright head (rightmost) — incandescent tip ─────────────────────
  c.px(w - 3, 1, '#ffffff');
  c.px(w - 3, 2, '#ffffff');
  c.px(w - 3, 3, '#ffffff');
  c.px(w - 2, 1, glowColor);
  c.px(w - 2, 2, '#ffffff');
  c.px(w - 2, 3, glowColor);
  c.px(w - 1, 2, '#ffffff');

  c.finish();
}

// Wrist-rocket / missile — points EAST in the texture (nose right, flame left)
// so setRotation(travelAngle) orients it naturally to its velocity.
export function paintMissile(scene, key = 'bullet-super') {
  const c = new PixelCanvas(scene, key, 18, 8, 3);

  // ── Exhaust flame (leftmost) — bright multi-layer plume ─────────────
  c.px(0, 4, PAL.expMid);
  c.px(1, 3, PAL.rocketFire);     c.px(1, 4, PAL.rocketFireBrt); c.px(1, 5, PAL.rocketFire);
  c.px(2, 2, PAL.rocketFire);     c.px(2, 3, PAL.rocketFireBrt); c.px(2, 4, PAL.expBright); c.px(2, 5, PAL.rocketFireBrt); c.px(2, 6, PAL.rocketFire);
  c.rect(3, 3, 2, 3, PAL.rocketFireBrt);
  c.rect(3, 3, 1, 3, PAL.expBright);

  // ── Body (centre) — Imperial grey rocket with rivet line ────────────
  c.rect(5, 2, 8, 5, PAL.rocketBody);
  c.hline(2, 5, 12, PAL.impSheen);   // top sheen
  c.hline(6, 5, 12, PAL.black);      // bottom shadow
  c.px(8,  4, PAL.impLight);
  c.px(10, 4, PAL.impLight);

  // ── Fins (just behind nose) ─────────────────────────────────────────
  c.px(11, 1, PAL.rocketFin); c.px(12, 1, PAL.rocketFin);
  c.px(11, 7, PAL.rocketFin); c.px(12, 7, PAL.rocketFin);

  // ── Nose cone (rightmost) — bright incandescent tip ─────────────────
  c.rect(13, 3, 2, 3, PAL.metalLight);
  c.rect(15, 3, 1, 3, PAL.offWhite);
  c.px(16, 4, PAL.offWhite);
  c.px(17, 4, '#ffffff');

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
// Muzzle flash — forward-pointing flame (EAST in the texture), so it lines
// up with the barrel when fired at any angle. Bright white core that fades
// into a saturated red flare with side spark wings.
export function paintMuzzle(scene, key = 'muzzle') {
  const c = new PixelCanvas(scene, key, 18, 10, 3);

  // ── White-hot core right where the barrel ends (leftmost band) ─────
  c.rect(0, 4, 4, 2, '#ffffff');
  c.rect(0, 3, 4, 1, PAL.boltRedCore);
  c.rect(0, 6, 4, 1, PAL.boltRedCore);

  // ── Forward flame body — wider taper ───────────────────────────────
  c.rect(4, 3, 6, 4, PAL.boltRedGlow);
  c.rect(4, 4, 6, 2, '#ffffff');
  c.rect(10, 3, 3, 4, PAL.boltRed);
  c.rect(10, 4, 3, 2, PAL.boltRedGlow);

  // ── Forward flare tongue (rightmost) — pointed flame ───────────────
  c.px(13, 4, PAL.boltRedGlow); c.px(13, 5, PAL.boltRedGlow);
  c.px(14, 4, PAL.boltRed);     c.px(14, 5, PAL.boltRed);
  c.px(15, 5, PAL.boltRed);
  c.px(16, 5, PAL.boltRedGlow);

  // ── Side spark wings flying outward at the muzzle ──────────────────
  c.px(2, 1, PAL.boltRed);  c.px(3, 0, PAL.boltRedGlow);
  c.px(2, 8, PAL.boltRed);  c.px(3, 9, PAL.boltRedGlow);
  c.px(4, 1, PAL.expBright); c.px(4, 8, PAL.expBright);
  c.px(5, 2, PAL.boltRedGlow); c.px(5, 7, PAL.boltRedGlow);
  // Extra forward sparks
  c.px(8, 1, PAL.boltRedGlow); c.px(8, 8, PAL.boltRedGlow);
  c.px(9, 2, PAL.expBright);  c.px(9, 7, PAL.expBright);

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

// Shell casing particle (ejected on shots)
export function paintCasing(scene, key = 'casing') {
  const c = new PixelCanvas(scene, key, 3, 2, 3);
  c.rect(0, 0, 3, 2, '#d4af37'); // Gold brass
  c.px(2, 0, '#805000'); // Rim shade
  c.px(2, 1, '#805000');
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

export function paintDashButton(scene) {
  const make = (key, active) => {
    const r = 42;
    const size = r * 2 + 8;
    const tex = scene.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const cx = size / 2, cy = size / 2;

    // Background disc
    ctx.fillStyle = active ? 'rgba(10, 50, 60, 0.75)' : 'rgba(20, 20, 25, 0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = active ? '#40ffc8' : '#607080';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();

    // Two chevrons pointing right >>
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = active ? '#ffffff' : '#4a5a6a';

    const drawChevron = (offset) => {
      ctx.beginPath();
      ctx.moveTo(cx - 10 + offset, cy - 14);
      ctx.lineTo(cx + 4 + offset, cy);
      ctx.lineTo(cx - 10 + offset, cy + 14);
      ctx.stroke();
    };

    drawChevron(-4);
    drawChevron(10);

    tex.refresh();
  };
  make('dash-btn', true);
  make('dash-btn-off', false);
}
