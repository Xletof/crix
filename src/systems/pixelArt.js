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
  // Melee energy blade ("Broken Wings")
  bladeSteel:   '#3a4652',
  bladeSteelMid:'#54677a',
  bladeSteelLt: '#8ba4bc',
  bladeEdge:    '#1a2028',
  energyCyan:   '#3aa8e8',
  energyGlow:   '#90d8ff',
  energyCore:   '#eafbff',
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
  // ── Per-room floor palettes ──────────────────────────────────────────────
  // Consumed by the `floor` field on each room spec (src/data/rooms.js) and
  // fed to paintBackdrop's opts. The four rooms were visually identical before
  // these existed — same hex, same red/blue strips, only the HUD label differed.
  // Hangar Bay — warm, dirty working deck. Amber guide lights, not red alert.
  hangBase:     '#1e1b14',
  hangLine:     '#0f0d08',
  hangPanel:    '#2a2620',
  hangStrip:    '#cc7a00',
  hangStripGlw: '#ffb020',
  hangAcc:      '#2a4a66',
  hangAccGlw:   '#4a7ea8',
  // Reactor Junction — hot. Rust and orange, tighter and busier.
  reacBase:     '#241008',
  reacLine:     '#120603',
  reacPanel:    '#3a1a0c',
  reacStrip:    '#ff3800',
  reacStripGlw: '#ff9020',
  reacAcc:      '#a03000',
  reacAccGlw:   '#ffc040',
  // Detention Block — cold and clinical. Pale cyan on blue-grey.
  detBase:      '#0f141c',
  detLine:      '#070a10',
  detPanel:     '#182029',
  detStrip:     '#2088a8',
  detStripGlw:  '#70d8f0',
  detAcc:       '#c8d8e0',
  detAccGlw:    '#ffffff',
  // Vader's Chamber — near-black, one deep red key. Severe and empty.
  vadBase:      '#0a0a0d',
  vadLine:      '#050508',
  vadPanel:     '#12121a',
  vadStrip:     '#8a0000',
  vadStripGlw:  '#e01818',
  vadAcc:       '#1a1a24',
  vadAccGlw:    '#303040',
  // ── Per-room perimeter walls ─────────────────────────────────────────────
  // The band painted around each arena's edge (see drawPerimeter). Three tones
  // per room: the wall top, its lit outer sliver, and the recessed greebles.
  // Deliberately desaturated against the floor palettes — the wall should frame
  // the room, not compete with the deck paint for attention.
  hangWall:     '#3a352a',
  hangWallLit:  '#4e4736',
  hangWallDark: '#221f18',
  reacWall:     '#3a2014',
  reacWallLit:  '#54301c',
  reacWallDark: '#1e0f08',
  detWall:      '#20272f',
  detWallLit:   '#2e3742',
  detWallDark:  '#11161c',
  vadWall:      '#131318',
  vadWallLit:   '#1d1d26',
  vadWallDark:  '#08080b',
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

// ── MELEE: energy greatsword overlay ──────────────────────────────────────
// Held-end LEFT, tip RIGHT, same convention as the pistol/rifle overlays so
// the existing weaponSprite rotation maths applies unchanged. Deliberately
// broader and longer than the rifle (20x8): the melee combo needs a weapon the
// player can actually SEE being swung, which the first pass never gave it.
// The chipped top edge is the "broken" blade read.
export function paintEnergyBlade(scene, key = 'wpn-blade') {
  const c = new PixelCanvas(scene, key, 24, 10, 4);
  const P = PAL;

  // Dark hilt: pommel, two-handed grip, wide crossguard. Kept dark and compact
  // so the bright blade owns the silhouette.
  c.rect(0, 3, 1, 4, P.bladeSteelMid);
  c.rect(1, 4, 4, 2, P.bladeEdge);
  c.px(2, 4, P.bladeSteelLt);
  c.rect(5, 1, 1, 8, P.bladeSteelMid);   // crossguard
  c.rect(6, 2, 1, 6, P.bladeSteel);
  c.px(5, 4, P.energyGlow);              // emitter gem
  c.px(5, 5, P.energyCore);

  // Blade: a bright energy slab, symmetric about the centre line, stepping down
  // in even widths to a point. Body / glow / core layering is the same
  // construction as paintSaberOverlay — it reads instantly at sprite scale,
  // which a mid-tone steel slab did not.
  const COLS = [
    [7, 2, 7], [8, 2, 7], [9, 2, 7], [10, 2, 7], [11, 2, 7], [12, 2, 7],
    [13, 3, 6], [14, 3, 6], [15, 3, 6], [16, 3, 6], [17, 3, 6],
    [18, 4, 5], [19, 4, 5], [20, 4, 5], [21, 4, 5], [22, 4, 5],
  ];
  for (const [x, top, bot] of COLS) {
    c.vline(x, top, bot, P.energyCyan);  // body
    c.px(x, 4, P.energyGlow);            // inner glow
    c.px(x, 5, P.energyCore);            // white-hot core
  }
  // Point.
  c.px(23, 4, P.energyGlow);
  c.px(23, 5, P.energyGlow);
  c.finish();
}

// ── NEMESIS WEAPONS ───────────────────────────────────────────────────────
//
// Every nemesis held the same `wpn-enemy-rifle`, which is the other half of why
// they read as recolours. All four use the weapon-overlay convention — held end
// LEFT, muzzle RIGHT — so `weaponSprite`'s existing rotation maths is unchanged.
// Each one's silhouette telegraphs its behaviour: the scattergun is stubby and
// wide-mouthed, the lance is long and thin, the flak tube is fat and short.

// SCATTERGUN — short, wide bore. Fires a 5-pellet cone; brutal up close.
export function paintScattergun(scene, key = 'wpn-nem-scatter') {
  const c = new PixelCanvas(scene, key, 16, 10, 4);
  const P = PAL;
  c.rect(0, 4, 4, 4, P.impDark);          // stock
  c.rect(3, 3, 6, 5, P.impMid);           // receiver
  c.hline(3, 3, 8, P.impLight);
  c.hline(7, 3, 8, P.black);
  c.rect(9, 2, 5, 7, P.impGrey);          // flared barrel
  c.rect(14, 1, 2, 9, P.impSilver);       // wide muzzle
  c.px(15, 4, P.boltRedGlow);
  c.px(15, 6, P.boltRedGlow);
  c.finish();
}

// FLAK LAUNCHER — fat tube, stubby. Lobs an arcing shell.
export function paintFlakLauncher(scene, key = 'wpn-nem-flak') {
  const c = new PixelCanvas(scene, key, 16, 10, 4);
  const P = PAL;
  c.rect(0, 5, 3, 4, P.impDark);
  c.rect(2, 2, 5, 7, P.impGrey);          // drum
  c.circle(4, 5, 2, P.impLight);
  c.px(4, 5, P.expMid);
  c.rect(7, 3, 8, 5, P.impMid);           // tube
  c.hline(3, 7, 14, P.impSilver);
  c.hline(7, 7, 14, P.black);
  c.rect(14, 2, 2, 7, P.impSilver);       // mouth
  c.px(15, 5, P.expBright);
  c.finish();
}

// BEAM LANCE — long and thin, with a charge coil. Telegraphs, then fires fast.
export function paintBeamLance(scene, key = 'wpn-nem-lance') {
  const c = new PixelCanvas(scene, key, 24, 8, 4);
  const P = PAL;
  c.rect(0, 3, 4, 3, P.impDark);
  c.rect(3, 2, 5, 5, P.impMid);           // coil housing
  c.rect(4, 3, 3, 3, P.energyCyan);
  c.px(5, 4, P.energyCore);
  c.rect(8, 3, 14, 2, P.impGrey);         // long barrel
  c.hline(3, 8, 21, P.impSilver);
  c.hline(4, 8, 21, P.black);
  c.rect(21, 2, 3, 4, P.impSilver);       // emitter
  c.px(23, 3, P.energyGlow);
  c.px(23, 4, P.energyGlow);
  c.finish();
}

// TWIN REPEATERS — double barrels, compact. A fast low-damage burst.
export function paintTwinRepeaters(scene, key = 'wpn-nem-repeater') {
  const c = new PixelCanvas(scene, key, 18, 10, 4);
  const P = PAL;
  c.rect(0, 4, 4, 4, P.impDark);
  c.rect(3, 3, 6, 6, P.impMid);           // twin receiver
  c.hline(3, 3, 8, P.impLight);
  c.hline(8, 3, 8, P.black);
  c.rect(9, 2, 8, 2, P.impGrey);          // upper barrel
  c.rect(9, 6, 8, 2, P.impGrey);          // lower barrel
  c.hline(2, 9, 16, P.impSilver);
  c.hline(6, 9, 16, P.impSilver);
  c.px(17, 2, P.boltGreenCore);
  c.px(17, 6, P.boltGreenCore);
  c.finish();
}

// ── NEMESIS REGALIA: one mark per trait ───────────────────────────────────
//
// A nemesis used to be a TINT AND A SCALE on a stock archetype. Six traits'
// worth of mechanical variety was real and completely invisible, so every one
// of them read as a recolour of the last.
//
// These are the marks that fix that. Each is a small overlay attached to the
// enemy the same way `weaponSprite` is, and each says something TRUE about the
// fight you are about to have: plate means it will not go down fast, canisters
// mean do not finish it standing next to it. Trait-driven rather than random on
// purpose — a silhouette that varies for decoration teaches the player nothing,
// and a dangerous loadout that looks harmless is worse than no variety at all.
//
// Drawn top-down to sit over a 20-24px body. Held-end/anchor convention matches
// the weapon overlays so the existing follow maths applies unchanged.

// ARMORED — heavy pauldrons and a chest plate. Wide and solid: the silhouette
// reads "this takes a while" before the tag line does.
export function paintRegaliaArmored(scene, key = 'reg-armored') {
  const c = new PixelCanvas(scene, key, 18, 14, 4);
  const P = PAL;
  c.rect(0, 3, 5, 7, P.beskarDark);       // left pauldron
  c.rect(0, 3, 5, 2, P.beskarMid);
  c.rect(1, 4, 2, 1, P.beskarLight);
  c.rect(13, 3, 5, 7, P.beskarDark);      // right pauldron
  c.rect(13, 3, 5, 2, P.beskarMid);
  c.rect(15, 4, 2, 1, P.beskarLight);
  c.rect(5, 5, 8, 6, P.beskarDeep);       // chest plate
  c.hline(5, 6, 11, P.beskarMid);
  c.hline(10, 5, 12, P.black);
  c.px(9, 7, P.beskarShine);
  c.finish();
}

// SWIFT — swept vents trailing back. Light, thin, angled: it should look like
// it is already moving while standing still.
export function paintRegaliaSwift(scene, key = 'reg-swift') {
  const c = new PixelCanvas(scene, key, 18, 14, 4);
  const P = PAL;
  for (let i = 0; i < 4; i++) {
    c.rect(2 + i * 2, 3 + i, 2, 2, P.impSilver);
    c.rect(2 + i * 2, 9 - i, 2, 2, P.impSilver);
  }
  c.rect(10, 5, 6, 1, P.energyCyan);
  c.rect(10, 8, 6, 1, P.energyCyan);
  c.px(16, 5, P.energyGlow);
  c.px(16, 8, P.energyGlow);
  c.finish();
}

// COLOSSAL — a hunched back plate. Sits high and heavy so the mass reads even
// before the 1.45x scale is applied.
export function paintRegaliaColossal(scene, key = 'reg-colossal') {
  const c = new PixelCanvas(scene, key, 18, 14, 4);
  const P = PAL;
  c.rect(3, 2, 12, 9, P.impGrey);
  c.rect(3, 2, 12, 2, P.impLight);
  c.hline(10, 3, 14, P.black);
  for (let i = 0; i < 4; i++) c.rect(4 + i * 3, 0, 2, 3, P.impSilver);  // spinal ridge
  c.px(8, 6, P.impSheen);
  c.px(11, 7, P.impSheen);
  c.finish();
}

// REGENERATOR — coolant tanks, lit. The glow is the tell: chip damage loses to
// this, so the player needs to see WHY before they waste a magazine finding out.
export function paintRegaliaRegenerator(scene, key = 'reg-regenerator') {
  const c = new PixelCanvas(scene, key, 18, 14, 4);
  const P = PAL;
  c.rect(2, 3, 4, 9, P.impDark);
  c.rect(12, 3, 4, 9, P.impDark);
  c.rect(3, 4, 2, 7, P.bactaBlue);
  c.rect(13, 4, 2, 7, P.bactaBlue);
  c.rect(3, 4, 2, 2, P.bactaLight);
  c.rect(13, 4, 2, 2, P.bactaLight);
  c.rect(6, 6, 6, 2, P.impGrey);          // cross-feed pipe
  c.hline(6, 6, 11, P.impSilver);
  c.px(8, 7, P.bactaMid);
  c.finish();
}

// SUMMONER — a back standard. Tall and unmistakable across a crowded arena,
// which is the point: this is the one you deal with FIRST.
export function paintRegaliaSummoner(scene, key = 'reg-summoner') {
  const c = new PixelCanvas(scene, key, 18, 16, 4);
  const P = PAL;
  c.rect(8, 0, 1, 15, P.impSilver);       // pole
  c.rect(9, 1, 7, 8, '#6a30c0');          // banner
  c.rect(9, 1, 7, 1, '#9060e0');
  c.hline(8, 9, 15, P.black);
  c.rect(11, 3, 3, 4, '#c080ff');         // sigil
  c.px(12, 4, P.white);
  c.rect(7, 0, 3, 1, P.gold);             // finial
  c.px(8, 1, P.goldBright);
  c.finish();
}

// VOLATILE — strapped canisters. The direct warning for the trait that punishes
// finishing a kill from inside the blast.
export function paintRegaliaVolatile(scene, key = 'reg-volatile') {
  const c = new PixelCanvas(scene, key, 18, 14, 4);
  const P = PAL;
  for (const x of [2, 7, 12]) {
    c.rect(x, 3, 4, 8, P.rocketBody);
    c.rect(x, 3, 4, 2, P.expDark);
    c.rect(x + 1, 5, 2, 4, P.expMid);
    c.px(x + 1, 6, P.expBright);
    c.hline(10, x, x + 3, P.black);
  }
  c.rect(0, 6, 18, 1, P.impDark);         // strap
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

// ── FLOOR MARKINGS ─────────────────────────────────────────────────────────
// A small vocabulary of deck-paint primitives, chosen declaratively per room
// via the `marks` array on the room spec (src/data/rooms.js). Config-driven so
// a new room is data, not another branch in here.
function drawFloorMarks(ctx, marks, color, alpha) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;

  for (const m of marks) {
    const a = m.alpha ?? 1;
    ctx.globalAlpha = alpha * a;

    switch (m.kind) {
      // Landing pad: outer ring, inner ring, and four approach ticks.
      case 'pad': {
        ctx.lineWidth = m.lw ?? 6;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = (m.lw ?? 6) / 2;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.62, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const ang = k * Math.PI / 2 + Math.PI / 4;
          const x1 = m.x + Math.cos(ang) * m.r * 1.06;
          const y1 = m.y + Math.sin(ang) * m.r * 1.06;
          const x2 = m.x + Math.cos(ang) * m.r * 1.3;
          const y2 = m.y + Math.sin(ang) * m.r * 1.3;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        break;
      }

      // Hazard chevrons: a band of >>> pointing dir (1 = right, -1 = left).
      case 'chevrons': {
        const dir = m.dir ?? 1, step = m.step ?? 44, h = m.h ?? 40;
        ctx.lineWidth = m.lw ?? 9;
        for (let x = 0; x < m.w; x += step) {
          const px = m.x + x;
          ctx.beginPath();
          ctx.moveTo(px, m.y);
          ctx.lineTo(px + dir * (h / 2), m.y + h / 2);
          ctx.lineTo(px, m.y + h);
          ctx.stroke();
        }
        break;
      }

      // Caution hatching: 45-degree stripes clipped to a rect.
      case 'stripes': {
        ctx.save();
        ctx.beginPath(); ctx.rect(m.x, m.y, m.w, m.h); ctx.clip();
        ctx.lineWidth = m.lw ?? 10;
        const gap = m.gap ?? 34;
        for (let i = -m.h; i < m.w + m.h; i += gap) {
          ctx.beginPath();
          ctx.moveTo(m.x + i, m.y);
          ctx.lineTo(m.x + i + m.h, m.y + m.h);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      // Bay / cell-door outline: a rect drawn as corner brackets, not a full
      // box — reads as a marked-out zone rather than a wall you cannot cross.
      case 'bay': {
        ctx.lineWidth = m.lw ?? 5;
        const c = m.corner ?? Math.min(m.w, m.h) * 0.3;
        const pts = [[m.x, m.y, 1, 1], [m.x + m.w, m.y, -1, 1],
                     [m.x, m.y + m.h, 1, -1], [m.x + m.w, m.y + m.h, -1, -1]];
        for (const [px, py, sx, sy] of pts) {
          ctx.beginPath();
          ctx.moveTo(px + sx * c, py);
          ctx.lineTo(px, py);
          ctx.lineTo(px, py + sy * c);
          ctx.stroke();
        }
        break;
      }

      // Plain ring — a dais or hazard circle.
      case 'ring': {
        ctx.lineWidth = m.lw ?? 8;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.stroke();
        break;
      }
    }
  }
  ctx.restore();
}

// ── PERIMETER DRESSING ─────────────────────────────────────────────────────
// A wall band painted around the arena edge, so a room reads as a room rather
// than as a floor texture that stops.
//
// Painted INTO the backdrop canvas, exactly like the floor markings and for the
// same reason: it never enters `this.walls`, so NavGrid and losRects cannot see
// it and pathing cannot regress. It is also not lying about collision — the
// physics world bounds already stop everything at these edges, so the band is
// drawing the wall that was always there but invisible.
//
// One painter for all four sides. Each edge is drawn in a LOCAL space where x
// runs along the edge (0..len) and y runs inward from the outside (0..thickness),
// with a transform placing it; that is why there is one body of drawing code
// here instead of four transposed copies.
//
// Gates and the exit are cut OUT of the band as doorways. That is the part that
// earns its keep: enemies surge in at the gates, and without openings they walk
// out of a painted wall.
function drawPerimeter(ctx, worldW, worldH, opts) {
  const {
    style     = 'ribbed',
    thickness = 64,
    wall      = PAL.floorDark,
    wallLit   = PAL.floorLight,
    wallDark  = PAL.floorLine,
    trim      = PAL.stripBlue,
    glow      = PAL.stripBluGlow,
    openings  = [],
    shadow    = 30,
  } = opts;

  // rot/translate chosen so local (x, y) lands on the right world pixels:
  //   top    (x, y) -> (x, y)                right  (x, y) -> (W - y, x)
  //   bottom (x, y) -> (W - x, H - y)        left   (x, y) -> (y, H - x)
  const edges = [
    { side: 'top',    len: worldW, tx: 0,      ty: 0,      rot: 0,             flip: false },
    { side: 'right',  len: worldH, tx: worldW, ty: 0,      rot: Math.PI / 2,   flip: false },
    { side: 'bottom', len: worldW, tx: worldW, ty: worldH, rot: Math.PI,       flip: true },
    { side: 'left',   len: worldH, tx: 0,      ty: worldH, rot: -Math.PI / 2,  flip: true },
  ];

  // An opening's `at` is a world coordinate along its edge. Two of the four
  // edges run backwards in local space, so their offsets mirror.
  const localAt = (e, at) => (e.flip ? e.len - at : at);
  const cutsFor = (e) => openings
    .filter((o) => o.side === e.side)
    .map((o) => ({ x0: localAt(e, o.at) - o.width / 2, w: o.width }));

  // Pass 1: the band itself.
  for (const e of edges) {
    ctx.save();
    ctx.translate(e.tx, e.ty);
    ctx.rotate(e.rot);

    // Clip the band minus its doorways. even-odd turns the opening rects into
    // holes, so nothing below has to know they exist.
    ctx.beginPath();
    ctx.rect(0, 0, e.len, thickness);
    for (const c of cutsFor(e)) ctx.rect(c.x0, -2, c.w, thickness + 4);
    ctx.clip('evenodd');

    // Wall top, then the lit outer sliver — the edge catching the corridor light.
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, e.len, thickness);
    ctx.fillStyle = wallLit;
    ctx.fillRect(0, 0, e.len, Math.round(thickness * 0.22));

    // Style greebles. Each room gets a different wall vocabulary; this is the
    // whole point of the pass, since a uniform band would just be a border.
    ctx.fillStyle = wallDark;
    if (style === 'ribbed') {
      // Hangar: heavy structural ribs, industrial and repetitive on purpose —
      // repetition reads as construction at this scale, not as a tiling bug.
      for (let x = 0; x < e.len; x += 26) {
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, 5, 11, thickness - 10);
        if ((x / 26) % 5 === 0) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = wallLit;
          ctx.fillRect(x + 11, 5, 3, thickness - 10);
          ctx.fillStyle = wallDark;
        }
      }
    } else if (style === 'pipes') {
      // Reactor: coolant runs along the wall with collars at intervals.
      ctx.globalAlpha = 0.6;
      for (const f of [0.34, 0.52, 0.7]) {
        ctx.fillRect(0, Math.round(thickness * f), e.len, 6);
      }
      ctx.globalAlpha = 0.75;
      for (let x = 18; x < e.len; x += 96) {
        ctx.fillRect(x, Math.round(thickness * 0.28), 10, Math.round(thickness * 0.5));
      }
    } else if (style === 'cells') {
      // Detention: recessed door alcoves, echoing the bay marks on the floor.
      for (let x = 40; x < e.len - 40; x += 170) {
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, 6, 96, thickness - 16);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = trim;
        ctx.fillRect(x, thickness - 12, 96, 3);
        ctx.fillStyle = wallDark;
      }
    } else if (style === 'bare') {
      // Vader: almost nothing. Tall narrow pilasters, far apart. The chamber
      // should feel severe, and greebles would make it look lived-in.
      ctx.globalAlpha = 0.6;
      for (let x = 60; x < e.len; x += 260) ctx.fillRect(x, 4, 16, thickness - 8);
    }
    ctx.globalAlpha = 1;

    // Inner lip: a lit trim line where the wall meets the deck.
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(0, thickness - 9, e.len, 9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = trim;
    ctx.fillRect(0, thickness - 3, e.len, 3);

    ctx.restore();
  }

  // Pass 2: the shadow the wall casts onto the deck. Separate pass so one
  // edge's shadow is never painted over by the next edge's opaque band, and
  // held off the corners where it would fall on the adjacent wall instead of
  // on the floor.
  for (const e of edges) {
    ctx.save();
    ctx.translate(e.tx, e.ty);
    ctx.rotate(e.rot);

    ctx.beginPath();
    ctx.rect(thickness, thickness, e.len - thickness * 2, shadow);
    for (const c of cutsFor(e)) ctx.rect(c.x0, thickness - 1, c.w, shadow + 2);
    ctx.clip('evenodd');

    const g = ctx.createLinearGradient(0, thickness, 0, thickness + shadow);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, thickness, e.len, shadow);
    ctx.restore();
  }

  // Pass 3: the doorways themselves — a dark recess with lit jambs, so a gate
  // reads as somewhere enemies come FROM.
  for (const e of edges) {
    const cuts = cutsFor(e);
    if (!cuts.length) continue;
    ctx.save();
    ctx.translate(e.tx, e.ty);
    ctx.rotate(e.rot);
    for (const c of cuts) {
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(c.x0, 0, c.w, thickness);
      ctx.globalAlpha = 1;
      // Jambs, and a threshold line across the mouth.
      ctx.fillStyle = trim;
      ctx.fillRect(c.x0 - 4, 0, 4, thickness);
      ctx.fillRect(c.x0 + c.w, 0, 4, thickness);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = glow;
      ctx.fillRect(c.x0, thickness - 3, c.w, 3);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

// ── DEATH STAR FLOOR BACKDROP ──────────────────────────────────────────────
//
// One painter, one look per room. Every colour and metric is an option with
// today's values as the default, so calling it with no `opts` produces exactly
// the texture it always did — that is what lets the four rooms diverge without
// any risk to the rooms that have not been styled yet.
//
// This is deliberately the ONLY kind of room identity that is safe to add
// right now: a floor texture never enters `this.walls`, and both the nav grid
// and the LOS rects are built from that group, so nothing here can affect
// pathing or line of sight. An earlier attempt at giving rooms character with
// actual wall geometry failed for exactly the opposite reason.
export function paintBackdrop(scene, key, worldW, worldH, opts = {}) {
  const {
    base       = PAL.floorMid,
    line       = PAL.floorLine,
    panel      = PAL.floorDark,
    strip      = PAL.stripRed,
    stripGlow  = PAL.stripRedGlow,
    accent     = PAL.stripBlue,
    accentGlow = PAL.stripBluGlow,
    hexW       = 64,
    hexH       = 56,
    stripEvery = 200,
    accentEvery = 380,
    panels     = 60,
    scorch     = 40,
    marks      = [],
    markColor  = null,   // defaults to the accent colour below
    markAlpha  = 0.5,
    perimeter  = null,   // { style, thickness, wall, wallLit, wallDark, trim, glow }
    openings   = [],     // doorway cuts, derived from the room's gates + exit
  } = opts;

  const tex = scene.textures.createCanvas(key, worldW, worldH);
  const ctx = tex.getContext();

  // Base floor
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, worldW, worldH);

  // Hex-tile grid pattern. The radii track hexW/hexH so a room can read as a
  // big open deck or as tight cell-block tiling.
  const rx = hexW * 0.469, ry = hexH * 0.5;
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  for (let row = 0; row < worldH / hexH + 2; row++) {
    for (let col = 0; col < worldW / hexW + 2; col++) {
      const ox = (row % 2 === 0) ? 0 : hexW / 2;
      const cx = col * hexW + ox;
      const cy = row * hexH;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 3;
        const px = cx + Math.cos(a) * rx;
        const py = cy + Math.sin(a) * ry;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Panel sections — subtle darker rectangles
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = panel;
  for (let i = 0; i < panels; i++) {
    const x = Math.random() * worldW;
    const y = Math.random() * worldH;
    const w = 80 + Math.random() * 160;
    const h = 40 + Math.random() * 80;
    ctx.fillRect(Math.floor(x / 4) * 4, Math.floor(y / 4) * 4, w, h);
  }

  // Primary strip lights (horizontal runs)
  ctx.globalAlpha = 1;
  ctx.fillStyle = strip;
  for (let y = 0; y < worldH; y += stripEvery) {
    const yy = y + Math.random() * 80;
    ctx.fillRect(0, yy, worldW, 3);
    ctx.fillStyle = stripGlow;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, yy - 4, worldW, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = strip;
  }

  // Accent strips (alternating, less frequent)
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = accent;
  for (let y = 100; y < worldH; y += accentEvery) {
    const yy = y + Math.random() * 40;
    ctx.fillRect(0, yy, worldW, 2);
    ctx.fillStyle = accentGlow;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, yy - 3, worldW, 8);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = accent;
  }

  // Floor markings — deck paint, drawn BEFORE the scorch pass so the battle
  // damage settles on top of them and they look worn in rather than decal'd on.
  //
  // These are the cheapest room identity available: they cost nothing at
  // runtime because they are baked into this canvas, and unlike a standing
  // prop there is no question of walking through them — they ARE the floor.
  if (marks.length) drawFloorMarks(ctx, marks, markColor || accent, markAlpha);

  // Perimeter wall band. After the strips so the full-width strip lights do not
  // run out across the wall, and before the scorch so the wall gets weathered
  // along with everything else.
  if (perimeter) drawPerimeter(ctx, worldW, worldH, { ...perimeter, openings });

  // Scorch marks (blaster fire damage)
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#000000';
  for (let i = 0; i < scorch; i++) {
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

// ═══════════════════════════════════════════════════════════════════════════
// ROOM PROPS
// ═══════════════════════════════════════════════════════════════════════════
//
// Large single objects, not tiles. This distinction is the whole point: an
// earlier attempt at room character stamped the one 104px blast-door texture
// eight times in a row, and a run of an identical tile reads as a texture bug
// rather than as architecture. A prop is one distinctive silhouette that
// cannot repeat with itself.
//
// Props are drawn with origin (0.5, 1.0) — bottom-centre — so their y IS the
// ground contact point and they Y-sort with actors via setDepth(y). Do not use
// the walls' `y + 56` convention on them; that assumes a 104px tile and would
// sort a 400px shuttle from its middle.
//
// Their collision bodies are deliberately SMALLER than their sprites: a
// shuttle's footprint is its hull, not its wingspan, so you can walk under the
// wing and the nav grid only loses the hull.

// ── LAMBDA SHUTTLE (hangar landmark) ──────────────────────────────────────
// 100x90 logical at scale 4 = 400x360. Nose down-screen, wings swept up.
export function paintShuttle(scene, key = 'prop-shuttle') {
  const c = new PixelCanvas(scene, key, 100, 90, 4);
  const HULL = PAL.impGrey, HULL_LT = PAL.impLight, HULL_DK = PAL.impDark;
  const EDGE = PAL.black, SHEEN = PAL.impSheen, GLASS = PAL.stripBluGlow;

  // ── Wings: two swept trapezoids either side, drawn first so the hull
  // overlaps them at the root.
  for (let side = 0; side < 2; side++) {
    const dir = side ? 1 : -1;
    for (let t = 0; t < 34; t++) {
      const y = 18 + t;                     // wing runs down the body
      const inner = 50 + dir * (10 + t * 0.35);
      const outer = 50 + dir * (10 + t * 1.15);
      const x1 = Math.round(Math.min(inner, outer));
      const x2 = Math.round(Math.max(inner, outer));
      c.hline(y, x1, x2, t < 6 ? HULL_LT : HULL);
      c.px(dir < 0 ? x1 : x2, y, EDGE);     // outboard edge
    }
    // Wing-tip cannon
    const tipX = side ? 89 : 11;
    c.vline(tipX, 46, 58, HULL_DK);
    c.px(tipX, 59, PAL.ledRed);
  }

  // ── Hull: a tapered fuselage down the centre.
  for (let y = 6; y < 78; y++) {
    const t = (y - 6) / 72;
    const halfW = Math.round(6 + t * 9);
    c.hline(y, 50 - halfW, 50 + halfW, HULL);
    c.px(50 - halfW - 1, y, EDGE);
    c.px(50 + halfW + 1, y, EDGE);
    if (y % 11 === 0) c.hline(y, 50 - halfW, 50 + halfW, HULL_DK); // panel seam
  }
  // Spine highlight — the light side of the fuselage
  c.rect(46, 8, 3, 68, HULL_LT);
  c.rect(49, 8, 2, 68, SHEEN);

  // ── Cockpit glass, near the nose (bottom of the sprite).
  c.rect(45, 64, 10, 8, PAL.impDark);
  c.rect(46, 65, 8, 6, GLASS);
  c.rect(47, 66, 6, 2, PAL.white);

  // ── Dorsal fin at the tail (top of the sprite).
  for (let t = 0; t < 10; t++) c.hline(6 + t, 50 - t, 50 + t, t < 3 ? HULL_LT : HULL);

  // ── Landing gear + engine glow at the base.
  c.rect(42, 78, 4, 6, HULL_DK);
  c.rect(54, 78, 4, 6, HULL_DK);
  c.rect(44, 84, 12, 2, EDGE);
  c.rect(46, 76, 3, 3, PAL.stripBluGlow);
  c.rect(51, 76, 3, 3, PAL.stripBluGlow);

  c.finish();
}

// ── CRANE GANTRY (hangar) ─────────────────────────────────────────────────
// 80x54 logical at scale 4 = 320x216. A loading gantry straddling the deck.
export function paintCraneGantry(scene, key = 'prop-crane') {
  const c = new PixelCanvas(scene, key, 80, 54, 4);
  const FRAME = PAL.impSilver, FRAME_DK = PAL.impMid, EDGE = PAL.black;
  const WARN = PAL.stripRed;

  // Two legs
  for (const lx of [8, 66]) {
    c.rect(lx, 14, 6, 34, FRAME_DK);
    c.rect(lx + 1, 14, 2, 34, FRAME);
    c.rect(lx - 2, 47, 10, 4, PAL.impDark);   // foot
    c.px(lx - 3, 50, EDGE); c.px(lx + 8, 50, EDGE);
  }
  // Top beam + lattice bracing
  c.rect(6, 8, 68, 7, FRAME_DK);
  c.rect(6, 8, 68, 2, FRAME);
  for (let x = 12; x < 68; x += 8) {
    c.px(x, 16, FRAME_DK); c.px(x + 1, 17, FRAME_DK);
    c.px(x + 2, 18, FRAME_DK); c.px(x + 3, 17, FRAME_DK);
  }
  // Hazard banding on the beam
  for (let x = 8; x < 72; x += 10) c.rect(x, 11, 4, 2, WARN);
  // Winch hanging from the middle
  c.vline(40, 15, 30, PAL.impDark);
  c.rect(36, 30, 9, 8, FRAME_DK);
  c.rect(37, 31, 7, 3, FRAME);
  c.px(40, 39, PAL.ledGreen);

  c.finish();
}

// ── FUEL DRUM (hangar clutter) ────────────────────────────────────────────
// 18x24 logical at scale 4 = 72x96. Two colourways, because this is the one
// prop small enough to appear more than once and repetition is the exact
// failure this whole art pass exists to avoid. Never place these in a line.
export function paintFuelDrum(scene, key = 'prop-drum', tint = null) {
  const c = new PixelCanvas(scene, key, 18, 24, 4);
  const BODY = tint || PAL.impGrey;
  const LIGHT = tint ? PAL.impSheen : PAL.impLight;
  const EDGE = PAL.black;

  // Elliptical top
  for (let t = 0; t < 4; t++) c.hline(3 + t, 4 - t, 13 + t, t < 2 ? LIGHT : BODY);
  c.hline(2, 6, 11, LIGHT);
  // Barrel
  c.rect(3, 6, 12, 15, BODY);
  c.rect(4, 6, 2, 15, LIGHT);          // vertical highlight
  c.hline(10, 3, 14, PAL.impDark);     // hoop rings
  c.hline(15, 3, 14, PAL.impDark);
  // Hazard chevron label
  c.rect(6, 12, 6, 3, PAL.stripRedGlow);
  c.px(8, 13, PAL.black);
  // Base + outline
  c.hline(21, 4, 13, PAL.impDark);
  for (let y = 6; y <= 21; y++) { c.px(2, y, EDGE); c.px(15, y, EDGE); }

  c.finish();
}

// ── REACTOR CORE HOUSING (Reactor Junction landmark) ──────────────────────
// 76x86 logical at scale 4 = 304x344. A containment cylinder with a lit core.
export function paintReactorCore(scene, key = 'prop-core') {
  const c = new PixelCanvas(scene, key, 76, 86, 4);
  const SHELL = PAL.impGrey, SHELL_LT = PAL.impLight, SHELL_DK = PAL.impDark;
  const GLOW = PAL.reacStripGlw, HOT = PAL.reacAccGlw, EDGE = PAL.black;

  // Elliptical cap
  for (let t = 0; t < 8; t++) {
    const w = 22 + t * 2;
    c.hline(6 + t, 38 - w / 2, 38 + w / 2, t < 3 ? SHELL_LT : SHELL);
  }
  // Cylinder body
  for (let y = 14; y < 74; y++) {
    c.hline(y, 12, 64, SHELL);
    c.hline(y, 14, 19, SHELL_LT);        // left highlight
    c.px(11, y, EDGE); c.px(65, y, EDGE);
  }
  // Containment bands
  for (const by of [20, 40, 60]) {
    c.rect(10, by, 57, 4, SHELL_DK);
    c.rect(10, by, 57, 1, PAL.impSheen);
  }
  // The lit core: a vertical glowing slot behind a grille
  c.rect(30, 26, 17, 30, PAL.black);
  c.rect(32, 28, 13, 26, GLOW);
  c.rect(35, 30, 7, 22, HOT);
  for (let gy = 28; gy < 54; gy += 4) c.hline(gy, 32, 44, SHELL_DK);
  // Base skirt
  c.rect(8, 74, 61, 6, SHELL_DK);
  c.rect(6, 80, 65, 4, PAL.impMid);
  c.hline(84, 6, 70, EDGE);
  c.finish();
}

// ── CATWALK STRUT (Reactor Junction) ──────────────────────────────────────
// 56x40 logical at scale 4 = 224x160. Angled support truss.
export function paintCatwalkStrut(scene, key = 'prop-strut') {
  const c = new PixelCanvas(scene, key, 56, 40, 4);
  const M = PAL.impSilver, D = PAL.impMid, E = PAL.black;
  // Upper deck plate
  c.rect(2, 4, 52, 8, D);
  c.rect(2, 4, 52, 2, M);
  c.hline(13, 2, 53, E);
  // Diagonal bracing
  for (let t = 0; t < 22; t++) {
    c.px(8 + t, 14 + t, D); c.px(9 + t, 14 + t, M);
    c.px(47 - t, 14 + t, D); c.px(46 - t, 14 + t, M);
  }
  // Feet
  c.rect(4, 34, 12, 4, PAL.impDark);
  c.rect(40, 34, 12, 4, PAL.impDark);
  // Hazard flash
  c.rect(24, 6, 8, 3, PAL.reacStrip);
  c.finish();
}

// ── SECURITY POST (Detention Block landmark) ──────────────────────────────
// 64x70 logical at scale 4 = 256x280. A glassed control booth.
export function paintSecurityPost(scene, key = 'prop-post') {
  const c = new PixelCanvas(scene, key, 64, 70, 4);
  const SHELL = PAL.impMid, LT = PAL.impLight, DK = PAL.impDark;
  const GLASS = PAL.detStripGlw, E = PAL.black;

  // Canopy
  c.rect(6, 4, 52, 6, DK);
  c.rect(7, 4, 50, 2, LT);
  // Glazed upper half
  c.rect(8, 10, 48, 24, PAL.black);
  c.rect(10, 12, 44, 20, GLASS);
  for (let x = 18; x < 54; x += 12) c.vline(x, 12, 31, DK);   // mullions
  c.rect(12, 14, 16, 5, PAL.white);                            // reflection
  // Console lip and body
  c.rect(6, 34, 52, 8, SHELL);
  c.rect(6, 34, 52, 2, LT);
  for (let x = 12; x < 52; x += 8) c.rect(x, 37, 3, 2, PAL.ledGreen);
  c.rect(8, 42, 48, 22, SHELL);
  c.rect(10, 44, 6, 18, LT);
  c.rect(24, 46, 18, 14, DK);
  // Base
  c.rect(6, 64, 52, 3, PAL.impDark);
  for (let y = 10; y <= 64; y++) { c.px(5, y, E); c.px(58, y, E); }
  c.finish();
}

// ── CELL BUNK (Detention Block) ───────────────────────────────────────────
// 34x26 logical at scale 4 = 136x104. Small; two colourways, scattered.
export function paintBunk(scene, key = 'prop-bunk', sheet = null) {
  const c = new PixelCanvas(scene, key, 34, 26, 4);
  const FRAME = PAL.impSilver, DK = PAL.impDark, E = PAL.black;
  const CLOTH = sheet || PAL.detPanel;
  // Mattress slab
  c.rect(4, 6, 26, 9, CLOTH);
  c.rect(4, 6, 26, 2, PAL.impSheen);
  c.rect(6, 8, 8, 5, PAL.detAcc);            // folded blanket
  // Frame + legs
  c.rect(2, 15, 30, 3, FRAME);
  c.rect(3, 18, 3, 5, DK);
  c.rect(28, 18, 3, 5, DK);
  c.hline(23, 2, 31, E);
  for (let y = 6; y <= 18; y++) { c.px(1, y, E); c.px(32, y, E); }
  c.finish();
}

// ── MEDITATION POD (Vader's Chamber landmark) ─────────────────────────────
// 88x82 logical at scale 4 = 352x328. The hyperbaric chamber, hinged open.
export function paintMeditationPod(scene, key = 'prop-pod') {
  const c = new PixelCanvas(scene, key, 88, 82, 4);
  const SHELL = PAL.vaderHelm || PAL.black, PLATE = PAL.impDark;
  const RIM = PAL.impMid, KEY = PAL.vadStripGlw, E = PAL.black;

  // Lower hemisphere — the seat
  for (let y = 30; y < 70; y++) {
    const t = (y - 30) / 40;
    const w = Math.round(38 * Math.sqrt(Math.max(0, 1 - (t - 0.1) * (t - 0.1) * 1.1)));
    c.hline(y, 44 - w, 44 + w, PLATE);
    c.px(44 - w - 1, y, E); c.px(44 + w + 1, y, E);
  }
  // Interior shadow + the single red key light
  c.rect(30, 40, 28, 22, SHELL);
  c.rect(40, 46, 8, 3, KEY);
  c.rect(42, 52, 4, 8, PAL.vadStrip);

  // Raised lid, hinged back and up
  for (let y = 4; y < 30; y++) {
    const t = (y - 4) / 26;
    const w = Math.round(34 * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))));
    c.hline(y, 44 - w, 44 + w, RIM);
    if (w > 6) c.hline(y, 44 - w + 2, 44 - w + 6, PAL.impSilver);
    c.px(44 - w - 1, y, E); c.px(44 + w + 1, y, E);
  }
  // Segment ribs on the lid
  for (const rx of [-20, 0, 20]) c.vline(44 + rx, 8, 28, PLATE);
  // Base ring
  c.rect(18, 70, 52, 5, RIM);
  c.rect(14, 75, 60, 4, PLATE);
  c.hline(80, 14, 74, E);
  c.finish();
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

// Super slug — the overcharged version of paintBolt's energy language. Points
// EAST (head right, tail left) so setRotation(travelAngle) orients it.
//
// IMPORTANT: the canvas MUST stay 18×8 @ scale 3 (= 54×24 px). Bullet.fire()
// derives the physics body from the texture with setCircle(this.width / 2), so
// the texture width IS the hitbox. All the added weight comes from filling the
// full height and pushing values white-hot — never from a bigger canvas.
export function paintSuperSlug(scene, key = 'bullet-super') {
  const c = new PixelCanvas(scene, key, 18, 8, 3);

  // ── Long fading tail (leftmost) — plasma bleeding off the back ──────
  c.px(0, 4, PAL.boltRed);
  c.px(1, 3, PAL.boltRed);      c.px(1, 4, PAL.boltRedGlow); c.px(1, 5, PAL.boltRed);
  c.px(2, 2, PAL.boltRed);      c.px(2, 3, PAL.boltRedGlow);
  c.px(2, 4, PAL.boltRedCore);  c.px(2, 5, PAL.boltRedGlow); c.px(2, 6, PAL.boltRed);

  // ── Heavy body — thick saturated slug filling most of the height ────
  c.rect(3, 2, 12, 5, PAL.boltRed);          // outer mass (5px tall vs bolt's 3)
  c.rect(3, 3, 12, 3, PAL.boltRedGlow);      // inner heat
  c.rect(3, 4, 12, 1, PAL.boltRedCore);      // core band

  // ── Pure white core line running the full length ────────────────────
  c.rect(4, 4, 11, 1, '#ffffff');
  c.rect(6, 3, 8, 1, '#ffffff');             // widened white belly (mass)

  // ── Soft glow halo top/bottom — the "bake the glow in" pass ─────────
  c.rect(4, 1, 10, 1, PAL.boltRed);
  c.rect(4, 7, 10, 1, PAL.boltRed);
  c.rect(5, 1, 7, 1, PAL.boltRedGlow);
  c.rect(5, 7, 7, 1, PAL.boltRedGlow);

  // ── Incandescent head — white-hot leading edge with a forward flare ─
  c.rect(15, 2, 1, 5, PAL.boltRedCore);
  c.rect(15, 3, 1, 3, '#ffffff');
  c.rect(16, 3, 1, 3, '#ffffff');
  c.px(17, 4, '#ffffff');
  c.px(16, 2, PAL.boltRedGlow);  c.px(16, 6, PAL.boltRedGlow);
  c.px(17, 3, PAL.boltRedCore);  c.px(17, 5, PAL.boltRedCore);

  c.finish();
}

// Wrist-rocket / missile — points EAST in the texture (nose right, flame left)
// so setRotation(travelAngle) orients it naturally to its velocity.
// This is the "future rocket-type weapon" it was kept for: the cluster pod's
// seeking micro-missiles paint it as 'frag-missile'.
export function paintMissile(scene, key = 'bullet-missile') {
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
  // Shotgun-spread button (ready = hot red, off = dark grey).
  //
  // Was a red lightsaber hilt, which described neither the ability nor anything
  // else in the game — the super is a 5-pellet scatter blast. Drawn in the same
  // idiom as the melee sword button (disc, rim, then a solid glyph with a bright
  // core), so the two action buttons read as a matched pair. The pellet count is
  // literally PLAYER.superPellets, so the icon states what the shot does.
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

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const bolt   = ready ? PAL.boltRed : '#4a3a3e';
    const core   = ready ? '#ffffff'   : '#6a5a5e';
    const barrel = ready ? PAL.impSilver : '#4a5058';
    const barrLo = ready ? PAL.impGrey   : '#343a42';

    ctx.save();
    ctx.translate(cx, cy + 20);        // muzzle sits low, spread opens upward

    // Muzzle: a stubby double barrel, the anchor the fan comes out of.
    ctx.fillStyle = barrLo;
    ctx.fillRect(-13, 0, 26, 16);
    ctx.fillStyle = barrel;
    ctx.fillRect(-13, 0, 26, 4);
    ctx.fillStyle = barrLo;
    ctx.fillRect(-2, 0, 4, 16);        // centre seam -> reads as two barrels

    // Five pellet streaks fanning out — one per PLAYER.superPellets. Tapered
    // polygons rather than strokes, so they keep weight at button size.
    const SPREAD = [-40, -20, 0, 20, 40];
    SPREAD.forEach((deg, i) => {
      const a = (deg - 90) * Math.PI / 180;
      const near = 8;
      const far  = i === 2 ? 46 : (i === 1 || i === 3 ? 42 : 35);
      const nx = Math.cos(a), ny = Math.sin(a);
      const px = -ny, py = nx;         // perpendicular
      const w0 = 4.8, w1 = 2.2;        // weight matched to the sword glyph
      ctx.fillStyle = bolt;
      ctx.beginPath();
      ctx.moveTo(nx * near + px * w0, ny * near + py * w0);
      ctx.lineTo(nx * far + px * w1, ny * far + py * w1);
      ctx.lineTo(nx * far - px * w1, ny * far - py * w1);
      ctx.lineTo(nx * near - px * w0, ny * near - py * w0);
      ctx.closePath();
      ctx.fill();
      // Hot pellet head, so each streak terminates in something solid.
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(nx * (far + 2), ny * (far + 2), 3.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Muzzle flash wedge tying the fan back to the barrel.
    ctx.fillStyle = ready ? 'rgba(255,120,90,0.45)' : 'rgba(120,100,100,0.20)';
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-16, -20);
    ctx.lineTo(16, -20);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    tex.refresh();
  };
  make('super-btn', true);
  make('super-btn-off', false);
}

// ── WEAPON PICKUPS ────────────────────────────────────────────────────────────
// Bold, readable weapon icons at 24×24 logical @ scale 4 = 96×96 texture, so
// they stay recognizable while floating above the drop. Both share the canvas
// size so the pickup + HUD can use one scale. Identity color/outline comes from
// WeaponPickup + the WEAPONS config; here we just draw a crisp, shaded weapon.

export function paintWeaponPickups(scene) {
  // ── DC-15 rifle — clean side profile, grip down, barrel to the right ──────
  const r = new PixelCanvas(scene, 'pickup-rifle', 24, 24, 4);
  // Stock (left)
  r.rect(2, 9, 4, 5, PAL.impMid);
  r.rect(2, 9, 4, 1, PAL.impLight);      // top highlight
  r.rect(2, 13, 4, 1, PAL.black);        // bottom shadow
  // Receiver / body
  r.rect(5, 8, 9, 7, PAL.impGrey);
  r.rect(5, 8, 9, 1, PAL.impLight);
  r.rect(6, 9, 6, 1, PAL.impSheen);      // sheen line
  r.rect(5, 14, 9, 1, PAL.black);
  r.px(5, 8, PAL.metalLight); r.px(13, 8, PAL.metalLight); // bright corners
  // Scope on top
  r.rect(7, 5, 5, 3, PAL.impMid);
  r.rect(7, 5, 5, 1, PAL.impLight);
  r.px(9, 6, PAL.bactaLight);            // lens glint
  // Grip (down)
  r.rect(6, 15, 3, 5, PAL.impMid);
  r.rect(6, 15, 3, 1, PAL.impGrey);
  r.rect(6, 19, 3, 1, PAL.black);
  // Magazine (down, ahead of the grip)
  r.rect(10, 15, 3, 6, PAL.impGrey);
  r.rect(10, 15, 3, 1, PAL.impLight);
  r.rect(10, 20, 3, 1, PAL.black);
  // Long barrel to the right
  r.rect(14, 10, 8, 3, PAL.impGrey);
  r.rect(14, 10, 8, 1, PAL.impLight);
  r.rect(14, 12, 8, 1, PAL.black);
  // Amber muzzle tip (rifle identity accent)
  r.rect(21, 10, 2, 3, '#ffb020');
  r.px(22, 9, '#ffd870');
  r.finish();

  // ── Cluster pod — canister with visible sub-munitions in a loading rack ────
  // Reads as "this comes apart" at a glance, which the old smooth detonator
  // sphere did not: the split is the whole point of the weapon now.
  const d = new PixelCanvas(scene, 'pickup-cluster', 24, 24, 4);
  const cx = 12, cy = 12;
  // Canister body — a capsule, deliberately NOT a sphere.
  d.rect(cx - 5, cy - 8, 10, 16, PAL.impDark);
  d.rect(cx - 4, cy - 7, 8, 14, PAL.impMid);
  d.rect(cx - 4, cy - 7, 3, 14, PAL.impGrey);    // left light face
  d.rect(cx - 4, cy - 7, 2, 5, PAL.impLight);    // upper highlight
  d.px(cx - 4, cy - 7, PAL.impSheen);
  // Nose cone.
  d.rect(cx - 3, cy - 9, 6, 1, PAL.impMid);
  d.rect(cx - 2, cy - 10, 4, 1, PAL.metalLight);
  // Rack bands — three seams where it splits open.
  [-4, 0, 4].forEach((oy) => {
    d.hline(cy + oy, cx - 5, cx + 4, PAL.metalLight);
    d.hline(cy + oy + 1, cx - 5, cx + 4, PAL.impDark);
  });
  // Sub-munition tips poking out of the rack, red so they read as live.
  [-6, -2, 2, 6].forEach((oy) => {
    d.px(cx + 5, cy + oy, '#cc0000');
    d.px(cx + 6, cy + oy, '#ff2828');
  });
  // Warning stripe.
  d.rect(cx - 3, cy + 6, 5, 1, '#ff2828');
  d.finish();
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

// Melee "Broken Wings" button. Draws the BLADE, not a slash arc: the previous
// icon was two stroked arcs, which is the exact shape the swing FX draws, so
// the button and the effect were indistinguishable from each other. An icon
// should name the ability (the weapon), not duplicate its animation.
export function paintMeleeButton(scene) {
  const make = (key, active) => {
    const r = 42;
    const size = r * 2 + 8;
    const tex = scene.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const cx = size / 2, cy = size / 2;

    // Background disc
    ctx.fillStyle = active ? 'rgba(12, 40, 60, 0.78)' : 'rgba(20, 20, 25, 0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = active ? '#90d8ff' : '#607080';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Sword, held on the diagonal so it fills a round button better than an
    // upright one and can't be mistaken for the vertical dash glyph.
    const blade  = active ? '#7ccdf5' : '#3d4a56';
    const core   = active ? '#ffffff' : '#5a6a78';
    const hilt   = active ? '#c2d2e2' : '#4a5662';
    const hiltLo = active ? '#5c7182' : '#39434d';

    ctx.save();
    ctx.translate(cx, cy + 2);
    ctx.rotate(-Math.PI / 4);          // tip toward upper-right

    // Blade: tapered, tip at the top.
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(0, -30);                // point
    ctx.lineTo(7, -19);
    ctx.lineTo(7, 4);
    ctx.lineTo(-7, 4);
    ctx.lineTo(-7, -19);
    ctx.closePath();
    ctx.fill();

    // White-hot centre channel, matching the in-game blade's construction.
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(2.6, -18);
    ctx.lineTo(2.6, 3);
    ctx.lineTo(-2.6, 3);
    ctx.lineTo(-2.6, -18);
    ctx.closePath();
    ctx.fill();

    // Crossguard — the widest element, so the silhouette reads as a sword.
    ctx.fillStyle = hilt;
    ctx.fillRect(-16, 4, 32, 6);
    ctx.fillStyle = hiltLo;
    ctx.fillRect(-16, 8, 32, 2);

    // Grip and pommel.
    ctx.fillStyle = hiltLo;
    ctx.fillRect(-3.5, 10, 7, 13);
    ctx.fillStyle = hilt;
    ctx.beginPath();
    ctx.arc(0, 25, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    tex.refresh();
  };
  make('melee-btn', true);
  make('melee-btn-off', false);
}
