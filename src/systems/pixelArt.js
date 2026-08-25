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
  // ── PILOT CHAMBER MATERIAL LADDER ───────────────────────────────────────
  // The Vader chamber's environment pilot. Cool graphite rather than neutral
  // black: every step is blue-shifted, so the room reads as gunmetal under
  // dead fluorescents instead of as an unlit void, and nothing in it is warm
  // enough to be mistaken for the crimson that belongs to the saber and the
  // telegraphs.
  //
  // Read as a VALUE ladder, darkest to lightest. The gaps are deliberately
  // uneven: recess -> deck is a small step (the floor should stay calm) and
  // deck -> rib is a large one (structure should read first).
  chSink:       '#080a0e',   // deepest recess — trench floors, wall bays
  chRecess:     '#12151d',   // side aisles, inset regions
  chDeck:       '#191d27',   // the nave — the floor the fight happens on
  chDeckLit:    '#222734',   // dais top face, lit plate edges
  chRib:        '#2e3542',   // structural ribs, plate seams, door frames
  chRibLit:     '#3d4655',   // the lit sliver on a raised edge
  chMach:       '#1d212b',   // machinery mass body
  chMachLit:    '#2b313d',   // machinery top face
  chSeam:       '#06080c',   // the dark line of a seam or a cast edge
  chBolt:       '#4a5262',   // small hardware — bolts, vent slats
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
  // The Force family's own mote. FORCE PULL and FORCE PUSH used to draw their
  // gathering motes from `spark-blue`, which is the HEALING colour — a pale
  // cyan-blue that belongs to a bacta pickup, not to a man crushing the air.
  // Both Force powers now share one desaturated violet so they read as one
  // family, and are told apart by which WAY the motes move.
  sparkViolet:  '#a888ff',
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
// ── PORTRAIT BUSTS: the face of the thing talking to you ──────────────────
//
// Everything else in this file is TOP-DOWN, because everything else is a body
// on a floor. These are the one exception: head-and-shoulders, facing the
// player, for the dialogue card.
//
// The alternative was framing the existing 24x24 top-down sprite in the box,
// the way IntroScene does with the player. It is nearly free and it reads as a
// placeholder — a bird's-eye body in a portrait frame is a picture of the
// player looking down at someone's helmet, not a character addressing them.
// `Telegraph.js` shipped as a circle and a rectangle on exactly that reasoning
// and it is the reason a boss redesign took four releases.
//
// 32x36 logical at scale 5. The first pass was 28x32 with a 12px-wide head and
// a rectangular shoulder slab, and the screenshot was unambiguous: it read as a
// robot head sitting on a plinth. The head has to fill most of the frame and
// the shoulders have to SLOPE, or the neck reads as a post. Head occupies
// roughly x6-26 / y0-21, then four widening rows of shoulder.
//
// NOT TINTED at display time. Tinting full-colour pixel art multiplies every
// channel and turns a white stormtrooper helmet into a flat wash of the
// nemesis colour. The per-nemesis colour goes on a glow layer BEHIND the bust
// in DialogueScene, which reads as lighting on it rather than as paint.

const BUST_W = 32;
const BUST_H = 36;
const BUST_SCALE = 5;

// Neck and sloping shoulders — shared, because the difference between these
// characters is the head and nothing else.
function bustFrame(c, armor, armorLit, armorDeep) {
  const P = PAL;

  c.rect(13, 18, 6, 5, P.impDark);          // neck, short and overlapped below
  c.rect(13, 18, 6, 1, P.black);            // shadow where the helmet sits on it
  c.rect(13, 19, 1, 4, '#000000');

  // Trapezoid: each row wider than the last, so the silhouette tapers up into
  // the neck instead of meeting it at a right angle.
  c.rect(10, 22, 12, 2, armorDeep);
  c.rect(7, 24, 18, 2, armor);
  c.rect(4, 26, 24, 2, armor);
  c.rect(1, 28, 30, 3, armor);
  c.rect(0, 31, 32, 5, armor);

  c.rect(8, 24, 16, 1, armorLit);           // light along the top of the slope
  c.rect(4, 26, 4, 1, armorLit);
  c.rect(24, 26, 4, 1, armorLit);
  c.rect(1, 28, 4, 1, armorLit);
  c.rect(27, 28, 4, 1, armorLit);
  c.rect(0, 34, 32, 2, armorDeep);          // grounded, not floating
  // Sternum seam, SHORT. A full-height one split the shoulders into two lumps
  // and read as a bib rather than as a chest.
  c.rect(15, 25, 2, 5, armorDeep);
}

/** GRUNT — the stormtrooper everyone knows. Clean white, hollow eyes. */
export function paintBustGrunt(scene, key = 'bust-grunt') {
  const c = new PixelCanvas(scene, key, BUST_W, BUST_H, BUST_SCALE);
  const P = PAL;
  bustFrame(c, P.troopShade, P.troopWhite, P.troopDark);

  c.rect(7, 2, 18, 17, P.troopWhite);       // shell
  c.rect(8, 0, 16, 3, P.troopWhite);        // crown
  c.rect(9, 1, 13, 2, P.troopLight);        // top highlight
  c.rect(7, 2, 1, 15, P.troopLight);        // rim light down the left
  c.rect(6, 5, 1, 11, P.troopShade);        // side shade
  c.rect(24, 4, 1, 13, P.troopShade);
  c.hline(6, 8, 23, P.troopShade);          // brow line

  c.rect(8, 7, 6, 4, P.troopBlack);         // eye lenses — big, this is the face
  c.rect(18, 7, 6, 4, P.troopBlack);
  c.rect(9, 8, 2, 1, P.troopDark);          // lens sheen
  c.rect(19, 8, 2, 1, P.troopDark);
  c.rect(14, 6, 4, 7, P.troopWhite);        // centre ridge between the lenses
  c.rect(15, 7, 2, 5, P.troopLight);

  c.rect(7, 12, 4, 5, P.troopDark);         // cheek vents
  c.rect(21, 12, 4, 5, P.troopDark);
  c.rect(12, 13, 8, 5, P.troopBlack);       // mouth grille
  c.hline(14, 12, 19, P.troopShade);
  c.hline(16, 12, 19, P.troopShade);
  c.rect(9, 18, 14, 2, P.troopWhite);       // chin
  c.hline(19, 10, 21, P.troopShade);
  c.finish();
}

/** SHOOTER — marksman's visored helm, comm antenna, lit optic. */
export function paintBustShooter(scene, key = 'bust-shooter') {
  const c = new PixelCanvas(scene, key, BUST_W, BUST_H, BUST_SCALE);
  const P = PAL;
  bustFrame(c, P.impGrey, P.impSilver, P.impMid);

  c.rect(7, 3, 18, 16, P.troopShade);       // shell — dirtier than a grunt's
  c.rect(8, 1, 16, 3, P.troopWhite);
  c.rect(9, 2, 13, 1, P.troopLight);
  c.rect(7, 4, 1, 13, P.troopWhite);
  c.rect(6, 6, 1, 10, P.impMid);
  c.rect(24, 6, 1, 10, P.impMid);

  c.rect(24, 0, 2, 7, P.impSilver);         // comm antenna
  c.rect(24, 0, 2, 1, P.energyCyan);
  c.rect(22, 5, 3, 2, P.impGrey);           // its mount

  c.rect(6, 7, 20, 5, P.impDark);           // full wraparound visor
  c.rect(7, 8, 18, 3, '#2a3c4e');
  c.rect(8, 9, 9, 1, P.energyCyan);         // lit strip
  c.rect(20, 9, 2, 1, P.energyGlow);        // targeting dot

  c.rect(12, 14, 8, 5, P.troopBlack);       // respirator
  c.hline(16, 12, 19, P.impSilver);
  c.rect(7, 13, 4, 5, P.impGrey);           // cheek plates
  c.rect(21, 13, 4, 5, P.impGrey);
  c.rect(9, 19, 14, 2, P.troopShade);
  c.hline(20, 10, 21, P.impMid);
  c.finish();
}

/** BOMBER — demolition hood, blast visor, canisters over the shoulders. */
export function paintBustBomber(scene, key = 'bust-bomber') {
  const c = new PixelCanvas(scene, key, BUST_W, BUST_H, BUST_SCALE);
  const P = PAL;
  bustFrame(c, P.rocketBody, P.impSheen, P.impDark);

  c.rect(6, 3, 20, 17, P.impGrey);          // wide armoured hood
  c.rect(7, 1, 18, 3, P.impLight);
  c.rect(8, 2, 15, 1, P.impSheen);
  c.rect(6, 3, 1, 15, P.impLight);
  c.rect(5, 7, 1, 10, P.impMid);            // heavy cheek guards
  c.rect(26, 7, 1, 10, P.impMid);
  c.rect(9, 5, 14, 1, P.impDark);           // brow seam

  c.rect(7, 7, 18, 5, P.impDark);           // blast visor, one narrow slit
  c.rect(8, 9, 16, 2, '#3a2410');
  c.rect(9, 9, 7, 1, P.expBright);          // ember reflection across the glass
  c.rect(18, 10, 5, 1, P.expMid);

  c.rect(10, 13, 12, 6, P.impDark);         // filter block
  c.rect(12, 14, 3, 4, P.expDark);
  c.rect(17, 14, 3, 4, P.expDark);
  c.rect(12, 15, 3, 1, P.expMid);
  c.rect(17, 15, 3, 1, P.expMid);
  c.hline(19, 10, 21, P.black);

  c.rect(0, 26, 5, 9, P.rocketBody);        // shoulder canisters
  c.rect(27, 26, 5, 9, P.rocketBody);
  c.rect(0, 26, 5, 2, P.expDark);
  c.rect(27, 26, 5, 2, P.expDark);
  c.rect(1, 29, 3, 1, P.expMid);
  c.rect(28, 29, 3, 1, P.expMid);
  c.px(2, 31, P.expBright);
  c.px(29, 31, P.expBright);
  c.finish();
}

/** SHIELDED — riot helm, with the raised shield filling the left of frame. */
export function paintBustShielded(scene, key = 'bust-shielded') {
  const c = new PixelCanvas(scene, key, BUST_W, BUST_H, BUST_SCALE);
  const P = PAL;
  bustFrame(c, P.beskarDark, P.beskarMid, P.beskarDeep);

  c.rect(8, 2, 17, 17, P.impLight);         // tall riot helm
  c.rect(9, 0, 15, 3, P.impSilver);
  c.rect(10, 1, 12, 1, P.impSheen);
  c.rect(15, 0, 3, 7, P.impSheen);          // centre crest
  c.rect(16, 1, 1, 5, P.beskarShine);
  c.rect(8, 3, 1, 14, P.impSilver);
  c.rect(25, 5, 1, 11, P.impMid);

  c.rect(8, 8, 17, 5, P.impDark);           // wraparound visor
  c.rect(9, 9, 15, 3, '#1e2e3a');
  c.rect(9, 9, 15, 1, P.energyCyan);
  c.rect(11, 10, 4, 1, P.energyGlow);
  c.rect(12, 14, 8, 5, P.impDark);          // chin block
  c.hline(16, 12, 19, P.impSilver);
  c.rect(9, 19, 14, 2, P.impLight);

  // The raised shield, held on the near side. Wide with a domed top and a
  // central boss — a narrow strip with evenly spaced rivets read as a ruler.
  c.rect(0, 8, 9, 28, P.beskar);
  c.rect(1, 6, 7, 3, P.beskar);             // domed top
  c.rect(2, 5, 5, 2, P.beskar);
  c.rect(2, 5, 5, 1, P.beskarShine);        // light catching the crown
  c.rect(1, 7, 7, 1, P.beskarLight);
  c.rect(0, 8, 1, 27, P.beskarLight);       // outer edge
  c.rect(8, 8, 1, 28, P.beskarDeep);        // inner edge, in shadow
  c.rect(2, 16, 5, 7, P.beskarMid);         // central boss
  c.rect(3, 17, 3, 5, P.beskarDark);
  c.rect(3, 17, 3, 1, P.beskarShine);
  c.rect(1, 12, 7, 1, P.beskarDeep);        // two banding rules, not a gauge
  c.rect(1, 27, 7, 1, P.beskarDeep);
  c.finish();
}

/** SNIPER — death trooper. Elongated, matte black, dead green optics. */
export function paintBustSniper(scene, key = 'bust-sniper') {
  const c = new PixelCanvas(scene, key, BUST_W, BUST_H, BUST_SCALE);
  const P = PAL;
  bustFrame(c, P.dthMid, P.dthLight, P.dthDark);

  c.rect(8, 1, 16, 18, P.dthMid);           // narrow, elongated skull helm
  c.rect(9, 0, 14, 2, P.dthLight);
  c.rect(10, 0, 11, 1, P.impSilver);
  c.rect(8, 2, 1, 15, P.dthLight);          // rim light
  c.rect(7, 5, 1, 11, P.dthDark);
  c.rect(24, 5, 1, 11, P.dthDark);
  c.rect(10, 17, 12, 4, P.dthDark);         // long jaw pushed forward
  c.rect(11, 19, 10, 1, P.dthMid);

  c.rect(9, 7, 6, 4, P.dthDark);            // sunken lenses
  c.rect(17, 7, 6, 4, P.dthDark);
  c.rect(9, 8, 6, 2, P.dthLED);
  c.rect(17, 8, 6, 2, P.dthLED);
  c.rect(9, 8, 2, 1, P.dthLEDBright);
  c.rect(21, 8, 2, 1, P.dthLEDBright);
  c.rect(15, 6, 2, 7, P.dthLight);          // nasal ridge
  c.rect(15, 7, 1, 5, P.impSilver);

  c.rect(12, 13, 8, 4, P.dthDark);          // grille
  c.hline(14, 12, 19, P.dthLight);
  c.hline(16, 12, 19, P.dthLight);
  c.rect(23, 3, 5, 4, P.dthLight);          // scope rail on the temple
  c.rect(23, 3, 5, 1, P.impSilver);
  c.px(27, 5, P.dthLED);
  c.finish();
}

/** VADER — the mask. Nothing lit: he is the only one with no optics at all. */
export function paintBustVader(scene, key = 'bust-vader') {
  const c = new PixelCanvas(scene, key, BUST_W, BUST_H, BUST_SCALE);
  const P = PAL;
  bustFrame(c, P.vaderArmor, P.vaderSheen, P.vaderHelm);

  // The dome, and the flare that falls from it over the ears. This shape is
  // the whole silhouette — get it wrong and he is any black helmet.
  c.rect(7, 0, 18, 8, P.vaderHelm);
  c.rect(5, 3, 2, 12, P.vaderHelm);         // left flare
  c.rect(25, 3, 2, 12, P.vaderHelm);        // right flare
  c.rect(6, 6, 1, 9, P.vaderHelm);
  c.rect(25, 6, 1, 9, P.vaderHelm);
  c.rect(9, 0, 14, 1, P.vaderSheen);        // one cold highlight, top only
  c.rect(8, 1, 5, 1, P.vaderBreath);
  c.rect(7, 2, 1, 12, P.vaderSheen);        // faint edge light down the left

  c.rect(8, 6, 16, 14, P.vaderArmor);       // face plate
  c.rect(8, 6, 16, 1, P.vaderSheen);        // brow ridge
  c.rect(9, 9, 6, 4, P.vaderHelm);          // eye sockets — flat, no lens at all
  c.rect(17, 9, 6, 4, P.vaderHelm);
  c.rect(9, 9, 6, 1, P.vaderBreath);        // the only glint, on the socket rim
  c.rect(17, 9, 6, 1, P.vaderBreath);
  c.rect(15, 7, 2, 7, P.vaderSheen);        // nose ridge

  c.rect(10, 14, 12, 6, P.vaderHelm);       // respirator
  c.rect(11, 15, 10, 1, P.vaderSheen);
  c.rect(11, 17, 10, 1, P.vaderBreath);
  c.rect(12, 19, 8, 1, P.vaderSheen);
  c.rect(8, 13, 2, 6, P.vaderBreath);       // cheek tusks
  c.rect(22, 13, 2, 6, P.vaderBreath);
  c.rect(11, 20, 10, 2, P.vaderHelm);       // chin

  c.rect(0, 24, 6, 12, P.vaderHelm);        // cape, closing both sides
  c.rect(26, 24, 6, 12, P.vaderHelm);
  c.rect(13, 27, 6, 4, P.vaderHelm);        // chest control box
  c.rect(14, 28, 2, 1, P.saberRed);
  c.px(17, 28, P.expBright);
  c.px(14, 30, P.energyCyan);
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
// Frames 24-32: raise / thrust / recoil, three per facing, in beat order.
//
// Shared by the two 20x20 trooper sheets. Every nemesis base collapses to one
// of them — grunt/bomber/swarmling to `grunt`, shooter/shielded/sniper to
// `shooter` — so nine frames each covers all five archetypes.
//
// The order MUST stay `POSE_BASE + facingIndex * 3 + poseIndex`, because
// PreloadScene derives the anim keys from that arithmetic for Vader and for
// these alike.
function paintPoseFrames(draw) {
  const dirs = ['front', 'back', 'side'];
  const poses = ['raise', 'thrust', 'recoil'];
  dirs.forEach((d, di) => poses.forEach((p, pi) => draw(24 + di * 3 + pi, 0, d, false, p)));
}

export function paintGrunt(scene, key = 'grunt') {
  const ss = new SpriteSheet(scene, key, 20, 20, 33, 4);
  const C = PAL;

  function drawTrooper(f, legPhase = 0, dir = 'front', hurt = false, pose = null) {
    ss.frame(f);
    // ── Attack poses ──────────────────────────────────────────────────────
    //
    // Same two channels drawVader uses, halved for a 20x20 body: a vertical
    // BOB and a forward LEAN, plus an arm offset because at this size the
    // shoulder blocks are the only limbs there are. Without these a scripted
    // move played out with the body standing in its idle frame, which is the
    // single thing that made Vader's moves read as broken before he had them.
    const poseBob = pose === 'raise' ? -1 : pose === 'thrust' ? 1 : pose === 'recoil' ? 2 : null;
    const lean    = pose === 'raise' ? -1 : pose === 'thrust' ? 2 : pose === 'recoil' ? -1 : 0;
    // Arms move on BOTH axes. First pass used the vertical alone and the strike
    // frame sank the shoulder blocks into the torso, so at a glance the arms
    // just vanished — the silhouette got smaller on the one beat that should
    // read as reaching. Out is what sells a strike at this size.
    const armDy   = pose === 'raise' ? -3 : pose === 'thrust' ? -1 : pose === 'recoil' ? 2 : 0;
    const armDx   = pose === 'raise' ?  0 : pose === 'thrust' ?  2 : pose === 'recoil' ? 1 : 0;
    const bob = poseBob !== null ? poseBob : ((legPhase === 0) ? 0 : (Math.abs(legPhase) === 2 ? 1 : 0));
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
      const ay = 11 + bob + armDy;
      const alx = 3 - armDx, arx = 14 + armDx;
      ss.rect(alx, ay, 3, 3, main);
      ss.rect(arx, ay, 3, 3, main);
      ss.hline(ay, alx, alx + 2, C.troopLight);
      ss.hline(ay, arx, arx + 2, C.troopLight);
      ss.hline(ay + 2, alx, alx + 2, C.troopShade);
      ss.hline(ay + 2, arx, arx + 2, C.troopShade);

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
      ss.rect(3 - armDx, 11 + bob + armDy, 3, 3, main);
      ss.rect(14 + armDx, 11 + bob + armDy, 3, 3, main);
      ss.rect(6, 12 + bob, 8, 4, main);
      ss.hline(12 + bob, 6, 13, C.troopLight);
      ss.hline(15 + bob, 6, 13, C.troopShade);
      ss.hline(16 + bob, 7, 12, '#ffffff');
      ss.hline(17 + bob, 7, 12, C.impGrey);

    } else if (dir === 'side') {
      ss.rect(5 + lean, 11 + bob, 4, 5, main);
      ss.hline(11 + bob, 5 + lean, 8 + lean, C.troopLight);
      ss.hline(15 + bob, 5 + lean, 8 + lean, C.troopShade);
      ss.vline(7 + lean, 12 + bob, 14 + bob, C.black);
      ss.rect(9 + lean, 12 + bob, 6, 4, main);
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

  // ── Attack poses, frames 24-32 ────────────────────────────────────────
  // Three per facing in beat order, matching Vader's layout so PreloadScene
  // builds the anim keys the same way. Legs held at phase 0: the pose owns the
  // body, and a walk cycle underneath it just muddies both.
  paintPoseFrames(drawTrooper);

  ss.finish();
}

// ── SHOOTER: Death Trooper (20×20, 8 frames) ──────────────────────────────
export function paintShooter(scene, key = 'shooter') {
  const ss = new SpriteSheet(scene, key, 20, 20, 33, 4);
  const C = PAL;

  function drawDeathTrooper(f, legPhase = 0, dir = 'front', hurt = false, pose = null) {
    ss.frame(f);
    // ── Attack poses ──────────────────────────────────────────────────────
    //
    // Same two channels drawVader uses, halved for a 20x20 body: a vertical
    // BOB and a forward LEAN, plus an arm offset because at this size the
    // shoulder blocks are the only limbs there are. Without these a scripted
    // move played out with the body standing in its idle frame, which is the
    // single thing that made Vader's moves read as broken before he had them.
    const poseBob = pose === 'raise' ? -1 : pose === 'thrust' ? 1 : pose === 'recoil' ? 2 : null;
    const lean    = pose === 'raise' ? -1 : pose === 'thrust' ? 2 : pose === 'recoil' ? -1 : 0;
    // Arms move on BOTH axes. First pass used the vertical alone and the strike
    // frame sank the shoulder blocks into the torso, so at a glance the arms
    // just vanished — the silhouette got smaller on the one beat that should
    // read as reaching. Out is what sells a strike at this size.
    const armDy   = pose === 'raise' ? -3 : pose === 'thrust' ? -1 : pose === 'recoil' ? 2 : 0;
    const armDx   = pose === 'raise' ?  0 : pose === 'thrust' ?  2 : pose === 'recoil' ? 1 : 0;
    const bob = poseBob !== null ? poseBob : ((legPhase === 0) ? 0 : (Math.abs(legPhase) === 2 ? 1 : 0));
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
      const ay = 11 + bob + armDy;
      const alx = 3 - armDx, arx = 14 + armDx;
      ss.rect(alx, ay, 3, 3, main);
      ss.rect(arx, ay, 3, 3, main);
      ss.hline(ay, alx, alx + 2, C.dthLight);
      ss.hline(ay, arx, arx + 2, C.dthLight);
      ss.hline(ay + 2, alx, alx + 2, dark);
      ss.hline(ay + 2, arx, arx + 2, dark);

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
      ss.rect(3 - armDx, 11 + bob + armDy, 3, 3, main);
      ss.rect(14 + armDx, 11 + bob + armDy, 3, 3, main);
      ss.rect(6, 12 + bob, 8, 4, main);
      ss.hline(12 + bob, 6, 13, C.dthLight);
      ss.hline(15 + bob, 6, 13, dark);
      // Detonator belt pack
      ss.hline(16 + bob, 7, 12, dark);
      ss.hline(17 + bob, 7, 12, C.black);

    } else if (dir === 'side') {
      ss.rect(5 + lean, 11 + bob, 4, 5, main);
      ss.hline(11 + bob, 5 + lean, 8 + lean, C.dthLight);
      ss.hline(15 + bob, 5 + lean, 8 + lean, dark);
      ss.vline(7 + lean, 12 + bob, 14 + bob, C.black);
      ss.rect(9 + lean, 12 + bob, 6, 4, main);
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

  // Attack poses, frames 24-32. See the note in paintGrunt.
  paintPoseFrames(drawDeathTrooper);

  ss.finish();
}

// ── BOSS: Darth Vader (40×40, 4 frames) — NO ROTATION ─────────────────────
// Massive cape spreading south, dome at top, weapon (saber) is a separate
// rotating overlay sprite — body itself is static aside from walk/idle.
export function paintBoss(scene, key = 'boss') {
  // 36 frames, not 24: the last twelve are ATTACK POSES.
  //
  // Vader's whole sheet was idle + 6 walk + 1 enraged per facing, so while he
  // attacked he played his WALK cycle — his body never performed any of it, and
  // the moves were sold entirely by tweens and floor decals. That is a large
  // part of why the first version of them read as "very buggy": the sprite was
  // doing one thing and the effects another.
  //
  // Three poses per facing, driven by the move beats:
  //
  //   raise   ANTICIPATE — drawn up and back, pauldrons high, cape flared.
  //   thrust  ACT        — driven forward, shoulders low and narrow.
  //   recoil  RECOVER    — hunched and open, which is also the punish window.
  //
  // At 40px the readable channels are silhouette HEIGHT, LEAN and cape SPREAD,
  // so that is what the poses move. Fine detail is wasted here.
  const ss = new SpriteSheet(scene, key, 40, 40, 36, 4);
  const C = PAL;

  function drawVader(f, legPhase = 0, dir = 'front', enraged = false, pose = 'idle') {
    ss.frame(f);
    // Pose overrides the walk bob: it is the same vertical channel, and letting
    // the leg cycle fight the pose would flatten both.
    const poseBob = pose === 'raise' ? -2 : pose === 'thrust' ? 1 : pose === 'recoil' ? 3 : null;
    const bob = poseBob !== null
      ? poseBob
      : ((legPhase === 0) ? 0 : (Math.abs(legPhase) === 2 ? 2 : 0));
    // Lean, in pixels, along the facing axis. Positive is forward.
    const lean = pose === 'raise' ? -2 : pose === 'thrust' ? 3 : pose === 'recoil' ? -1 : 0;
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
      // Pauldrons. `sh` lifts them for the wind-up and drops them for the
      // recovery — shoulder height is the clearest tell available on a body
      // this small, and it costs nothing to animate.
      const sh = pose === 'raise' ? -3 : pose === 'recoil' ? 2 : 0;
      ss.rect(3,  cy + 5 + sh, 8, 6, main);
      ss.rect(29, cy + 5 + sh, 8, 6, main);
      if (pose === 'raise') {
        // Both fists up beside the helmet — the silhouette that says a force
        // power is coming, readable even as a 40px shape at arm's length.
        ss.rect(5,  cy - 4, 5, 7, main);
        ss.rect(30, cy - 4, 5, 7, main);
        ss.hline(cy - 4, 5, 9,  C.vaderSheen);
        ss.hline(cy - 4, 30, 34, C.vaderSheen);
      } else if (pose === 'thrust') {
        // Driven forward: one long arm out of the chest, toward the viewer.
        ss.rect(15, cy + 16, 10, 6, main);
        ss.hline(cy + 16, 15, 24, C.vaderSheen);
        ss.hline(cy + 21, 15, 24, C.black);
      }
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

      // Cape (flares behind shoulders). `sp` widens it on the wind-up and pulls
      // it in on the recovery, so the silhouette breathes with the attack.
      const sp = pose === 'raise' ? 2 : pose === 'recoil' ? -2 : 0;
      ss.rect(8 - sp,  29 + bob, 24 + sp * 2, 10, C.cape);
      ss.rect(6 - sp,  31 + bob, 28 + sp * 2, 8,  C.cape);
      ss.rect(4 - sp,  33 + bob, 32 + sp * 2, 6,  C.cape);
      ss.vline(4,  33 + bob, 38 + bob, C.capeBlack);
      ss.vline(35, 33 + bob, 38 + bob, C.capeBlack);
      ss.vline(6,  31 + bob, 38 + bob, C.capeBlack);
      ss.vline(33, 31 + bob, 38 + bob, C.capeBlack);
      ss.hline(38 + bob, 4, 35, C.capeBlack);
      ss.vline(12, 31 + bob, 38 + bob, C.capeShade);
      ss.vline(20, 31 + bob, 38 + bob, C.capeShade);
      ss.vline(27, 31 + bob, 38 + bob, C.capeShade);

    } else if (dir === 'back') {
      // Cape covers everything. From behind, the only channel is how wide it
      // spreads — so that is the whole pose.
      const bs = pose === 'raise' ? 3 : pose === 'recoil' ? -2 : 0;
      ss.rect(4 - bs, cy + 5, 32 + bs * 2, 25, C.cape);
      if (pose === 'raise') {
        ss.rect(2, cy - 2, 5, 8, main);
        ss.rect(33, cy - 2, 5, 8, main);
      }
      ss.hline(cy + 5, 4, 35, C.capeShade);
      ss.vline(4, cy + 5, cy + 29, C.capeBlack);
      ss.vline(35, cy + 5, cy + 29, C.capeBlack);
      ss.vline(20, cy + 5, cy + 29, C.capeBlack);
      ss.hline(cy + 29, 4, 35, C.capeBlack);

    } else if (dir === 'side') {
      // Cape hangs left (West). In profile the lean is the whole read, so the
      // cape trails BACK on a thrust and billows forward on the wind-up.
      ss.rect(6 - lean, cy + 5, 12, 24, C.cape);
      ss.vline(6 - lean, cy + 5, cy + 28, C.capeBlack);
      ss.vline(17 - lean, cy + 5, cy + 28, C.capeShade);

      // Side shoulder + chest profile, carried forward by the lean.
      ss.rect(18 + lean, cy + 5, 12, 14, main);
      ss.hline(cy + 5, 18 + lean, 29 + lean, C.vaderSheen);
      ss.rect(19 + lean, cy + 7, 7, 7, C.vaderHelm); // shoulder armor plate
      if (pose === 'thrust') {
        // Arm punched out ahead of the profile.
        ss.rect(29, cy + 11, 9, 5, main);
        ss.hline(cy + 11, 29, 37, C.vaderSheen);
        ss.hline(cy + 15, 29, 37, C.black);
      } else if (pose === 'raise') {
        ss.rect(20, cy - 4, 6, 8, main);
        ss.hline(cy - 4, 20, 25, C.vaderSheen);
      }
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

  // ── Attack poses, 24-35 ─────────────────────────────────────────────────
  // Three per facing, in the order the beats fire them.
  drawVader(24, 0, 'front', false, 'raise');
  drawVader(25, 0, 'front', false, 'thrust');
  drawVader(26, 0, 'front', false, 'recoil');
  drawVader(27, 0, 'back',  false, 'raise');
  drawVader(28, 0, 'back',  false, 'thrust');
  drawVader(29, 0, 'back',  false, 'recoil');
  drawVader(30, 0, 'side',  false, 'raise');
  drawVader(31, 0, 'side',  false, 'thrust');
  drawVader(32, 0, 'side',  false, 'recoil');
  // Enraged variants of the strike, for phase 2+.
  drawVader(33, 0, 'front', true,  'thrust');
  drawVader(34, 0, 'back',  true,  'thrust');
  drawVader(35, 0, 'side',  true,  'thrust');

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

// ── AUTHORED FLOOR ARCHITECTURE ────────────────────────────────────────────
//
// The third tier of backdrop art, between the base floor and the deck paint.
// `drawFloorMarks` paints things that are PAINTED ON the deck; this paints
// things the deck IS — regions, raised platforms, recessed channels, structural
// ribs, plate seams.
//
// WHY IT IS BAKED. Every primitive here is one more canvas operation at room
// load and zero objects and zero draw calls afterwards. A room's large forms do
// not move, so nothing about them belongs in a live Graphics node.
//
// WHY IT CANNOT LIE ABOUT COLLISION. Like the floor marks and the perimeter
// band, this paints into the backdrop canvas. A backdrop image never enters
// `this.walls`, so neither the nav grid nor the LOS rects nor bullet collision
// can see it. That is also the constraint on the vocabulary: everything here is
// FLAT or RECESSED. There is no primitive that draws a tall solid mass on the
// open floor, because the player would read it as cover and walk through it.
// Machinery lives in the perimeter band, where the world bounds already are.
//
// Three tiers, and they are drawn in that order so the small never sits under
// the large:
//   LARGE   region, dais            — the chamber's shape
//   MEDIUM  trench, rib, plate, bay — its identity
//   SMALL   vent, bolts, hatch      — sparse, and never on the fighting floor
//
// A raised form is lit on its NORTH edge and casts south, because that is the
// convention every prop and every actor shadow in this game already uses.
function drawArchitecture(ctx, items, pal) {
  const P = {
    sink: pal.sink ?? PAL.chSink,
    recess: pal.recess ?? PAL.chRecess,
    deck: pal.deck ?? PAL.chDeck,
    deckLit: pal.deckLit ?? PAL.chDeckLit,
    rib: pal.rib ?? PAL.chRib,
    ribLit: pal.ribLit ?? PAL.chRibLit,
    seam: pal.seam ?? PAL.chSeam,
    bolt: pal.bolt ?? PAL.chBolt,
  };
  // Named fills, so a spec says what a thing IS rather than what colour it is.
  const tone = (n) => P[n] ?? n;

  // A soft downward cast under a raised edge. One gradient, not a blur.
  const cast = (x, y, w, h, a = 0.55) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };

  ctx.save();
  for (const it of items) {
    ctx.globalAlpha = it.alpha ?? 1;
    switch (it.kind) {
      // ── LARGE ────────────────────────────────────────────────────────────
      // A floor region. The chamber's biggest graphic decision: which parts of
      // the deck are lighter and which recede. Partial alpha by default so the
      // hex tiling still reads through and the region looks like a value of the
      // floor rather than a rectangle painted over it.
      case 'region': {
        ctx.fillStyle = tone(it.tone);
        ctx.globalAlpha = it.alpha ?? 0.85;
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.globalAlpha = 1;
        // Its own boundary, drawn as a seam rather than an outline: a dark
        // line on the far side, a lit sliver on the near side.
        if (it.edge !== false) {
          ctx.fillStyle = P.seam;
          ctx.fillRect(it.x - 2, it.y, 3, it.h);
          ctx.fillRect(it.x + it.w - 1, it.y, 3, it.h);
        }
        break;
      }

      // A raised platform. Octagonal rather than circular: a straight-edged
      // form reads as built, and the chamber's one ceremonial object should
      // not look like a decal. Top face, north light, south cast.
      case 'dais': {
        const { x, y, r } = it;
        const oct = (rad) => {
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = -Math.PI / 2 + k * Math.PI / 4 + (it.rot ?? Math.PI / 8);
            const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad * (it.squash ?? 1);
            if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        };
        // The cast first, so the platform sits ON it.
        ctx.save();
        oct(r * 1.03);
        ctx.clip();
        cast(x - r * 1.1, y, r * 2.2, r * 1.15, 0.5);
        ctx.restore();
        // Riser band: the platform's thickness, seen from above as a rim.
        ctx.fillStyle = P.seam;
        oct(r); ctx.fill();
        // Top face.
        ctx.fillStyle = tone(it.tone ?? 'deckLit');
        oct(r - (it.lip ?? 14)); ctx.fill();
        // North light on the rim, south shade.
        ctx.save();
        oct(r); ctx.clip();
        ctx.fillStyle = P.ribLit; ctx.globalAlpha = 0.55;
        ctx.fillRect(x - r, y - r * (it.squash ?? 1), r * 2, 6);
        ctx.globalAlpha = 1;
        ctx.restore();
        // Two step bands on the approach side, so the dais has a way up.
        if (it.steps) {
          for (let i = 0; i < 2; i++) {
            const sy = y + r * (it.squash ?? 1) + 10 + i * 22;
            ctx.fillStyle = i ? P.recess : P.deck;
            ctx.fillRect(x - r * (0.62 - i * 0.1), sy, r * (1.24 - i * 0.2), 18);
            ctx.fillStyle = P.seam;
            ctx.fillRect(x - r * (0.62 - i * 0.1), sy + 18, r * (1.24 - i * 0.2), 2);
          }
        }
        break;
      }

      // ── MEDIUM ───────────────────────────────────────────────────────────
      // A recessed channel with a grate over it. `dir` is 'v' or 'h'.
      case 'trench': {
        const v = (it.dir ?? 'v') === 'v';
        const w = v ? it.t : it.len, h = v ? it.len : it.t;
        ctx.fillStyle = P.sink;
        ctx.fillRect(it.x, it.y, w, h);
        // The wall of the recess: dark on the near lip, lit on the far one.
        ctx.fillStyle = P.seam;
        if (v) ctx.fillRect(it.x, it.y, 3, h); else ctx.fillRect(it.x, it.y, w, 3);
        ctx.fillStyle = P.ribLit;
        ctx.globalAlpha = 0.35;
        if (v) ctx.fillRect(it.x + w - 2, it.y, 2, h); else ctx.fillRect(it.x, it.y + h - 2, w, 2);
        ctx.globalAlpha = it.alpha ?? 1;
        // Grate slats. Kept LOW-CONTRAST on purpose: at full rib value a
        // 900px trench photographed as a ladder painted down the aisle and
        // pulled the eye off the fight.
        ctx.globalAlpha = (it.alpha ?? 1) * 0.55;
        ctx.fillStyle = P.rib;
        const step = it.step ?? 26;
        if (v) for (let k = 10; k < h - 6; k += step) ctx.fillRect(it.x + 2, it.y + k, w - 4, 5);
        else   for (let k = 10; k < w - 6; k += step) ctx.fillRect(it.x + k, it.y + 2, 5, h - 4);
        break;
      }

      // A structural rib crossing the floor. Two-tone: the raised band and the
      // dark seam it sits in. This is the primitive that makes a large empty
      // deck read as constructed rather than as a texture.
      case 'rib': {
        const v = (it.dir ?? 'h') === 'v';
        const w = v ? (it.t ?? 22) : it.len, h = v ? it.len : (it.t ?? 22);
        ctx.fillStyle = P.seam;
        ctx.fillRect(it.x - 2, it.y - 2, w + 4, h + 4);
        ctx.fillStyle = tone(it.tone ?? 'rib');
        ctx.fillRect(it.x, it.y, w, h);
        ctx.fillStyle = P.ribLit;
        ctx.globalAlpha = (it.alpha ?? 1) * 0.6;
        if (v) ctx.fillRect(it.x, it.y, 3, h); else ctx.fillRect(it.x, it.y, w, 3);
        ctx.globalAlpha = it.alpha ?? 1;
        break;
      }

      // A large deck plate: a seam outline and, optionally, four corner bolts.
      // Big on purpose. Small repeated plates are floor noise; a 300px plate is
      // architecture.
      case 'plate': {
        ctx.strokeStyle = P.seam;
        ctx.lineWidth = it.lw ?? 3;
        ctx.strokeRect(it.x, it.y, it.w, it.h);
        ctx.strokeStyle = P.ribLit;
        ctx.globalAlpha = (it.alpha ?? 1) * 0.30;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(it.x, it.y + it.h); ctx.lineTo(it.x, it.y); ctx.lineTo(it.x + it.w, it.y);
        ctx.stroke();
        ctx.globalAlpha = it.alpha ?? 1;
        if (it.bolts !== false) {
          ctx.fillStyle = P.bolt;
          const m = it.inset ?? 14;
          for (const [bx, by] of [[it.x + m, it.y + m], [it.x + it.w - m, it.y + m],
                                  [it.x + m, it.y + it.h - m], [it.x + it.w - m, it.y + it.h - m]]) {
            ctx.fillRect(bx - 2, by - 2, 4, 4);
          }
        }
        break;
      }

      // A recessed bay in the floor — a dark inset with a lit far lip. Used
      // where the room wants a hole rather than a mark.
      case 'inset': {
        ctx.fillStyle = tone(it.tone ?? 'recess');
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.fillStyle = P.seam;
        ctx.fillRect(it.x, it.y, it.w, 4);
        ctx.fillStyle = P.ribLit;
        ctx.globalAlpha = (it.alpha ?? 1) * 0.30;
        ctx.fillRect(it.x, it.y + it.h - 3, it.w, 3);
        ctx.globalAlpha = it.alpha ?? 1;
        break;
      }

      // A heavy frame around a doorway, standing on the deck side of the wall
      // band. Gives a gate a threshold instead of a hole.
      case 'doorframe': {
        const { x, y, w, h } = it;
        ctx.fillStyle = P.rib;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = P.seam;
        ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
        ctx.fillStyle = P.ribLit;
        ctx.globalAlpha = (it.alpha ?? 1) * 0.5;
        ctx.fillRect(x, y, w, 4);
        ctx.globalAlpha = it.alpha ?? 1;
        break;
      }

      // ── SMALL ────────────────────────────────────────────────────────────
      // A grille. Deliberately the only repeated small element, and it is only
      // ever placed at the perimeter.
      case 'vent': {
        ctx.fillStyle = P.seam;
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.fillStyle = P.bolt;
        ctx.globalAlpha = (it.alpha ?? 1) * 0.7;
        for (let k = 4; k < it.h - 3; k += 7) ctx.fillRect(it.x + 3, it.y + k, it.w - 6, 3);
        ctx.globalAlpha = it.alpha ?? 1;
        break;
      }

      // A grounding shadow. Not decoration — this is what stops a console or a
      // prop from looking like a sticker on the deck. Ellipse, softened, and
      // baked so it darkens with the floor when the room loses power (a shadow
      // that survives a blackout is a shadow with no light to cast it).
      case 'ground': {
        const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, it.r);
        g.addColorStop(0, `rgba(0,0,0,${it.a ?? 0.55})`);
        g.addColorStop(0.55, `rgba(0,0,0,${(it.a ?? 0.55) * 0.55})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.scale(1, it.squash ?? 0.45);
        ctx.translate(-it.x, -it.y);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
    }
    ctx.globalAlpha = 1;
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
    } else if (style === 'chamber') {
      // THE PILOT WALL. `bare` was severe by being empty, and empty photographs
      // as unfinished: at the room's corners the band was a dark strip with one
      // red line on it and nothing else in frame.
      //
      // This is severe by RHYTHM instead. A repeating bay — heavy pilaster,
      // deep recess, machinery block — at a large 320px period, so the wall has
      // structure without becoming greebles. Three values do the work: the band
      // (wall), the recess (wallDark) and the pilaster face (wallLit).
      //
      // Relief is kept SHALLOW on purpose. The world bounds sit at the outside
      // of this band, so the player can stand on it; a wall that reads as a
      // tall solid mass here would be promising a collision the room does not
      // have. Everything below is a surface treatment, not a silhouette.
      const period = 320;
      for (let x = 0; x < e.len + period; x += period) {
        // The recessed bay between pilasters — the dark part of the rhythm.
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = wallDark;
        ctx.fillRect(x + 54, 8, period - 108, thickness - 20);
        // Its lit inner lip, so the recess has a depth read.
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = wallLit;
        ctx.fillRect(x + 54, thickness - 14, period - 108, 3);
        // Machinery block seated in the bay: a denser mass with vertical ribs.
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = wall;
        ctx.fillRect(x + 96, 14, period - 192, thickness - 34);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = wallDark;
        for (let k = 0; k < period - 192; k += 18) ctx.fillRect(x + 100 + k, 18, 7, thickness - 42);
        // Its top face catches the corridor light.
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = wallLit;
        ctx.fillRect(x + 96, 14, period - 192, 4);
        // The pilasters themselves — the light part of the rhythm, and the
        // only place the band reaches full thickness.
        ctx.globalAlpha = 1;
        ctx.fillStyle = wall;
        ctx.fillRect(x + 12, 0, 42, thickness);
        ctx.fillStyle = wallLit;
        ctx.fillRect(x + 12, 0, 42, Math.round(thickness * 0.30));
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = wallDark;
        ctx.fillRect(x + 12, 0, 4, thickness);
        ctx.fillRect(x + 50, 0, 4, thickness);
        // One small hardware detail per bay and no more: a vent on the block.
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = wallDark;
        ctx.fillRect(x + period / 2 - 22, thickness - 26, 44, 12);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = wallLit;
        for (let k = 0; k < 4; k++) ctx.fillRect(x + period / 2 - 19 + k * 11, thickness - 24, 6, 8);
      }
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
    // ── PILOT ADDITIONS. All three default to off, so a room that has not
    // been authored paints exactly the texture it always did.
    architecture = [],   // baked large/medium/small forms — see drawArchitecture
    archPal    = {},     // per-room override of the material ladder
    grounding  = [],     // contact shadows, derived from the room's own cover/props
    hexAlpha   = 1,      // the tiling's contrast. An authored floor wants it low.
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
  ctx.globalAlpha = hexAlpha;
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

  ctx.globalAlpha = 1;

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

  // ── AUTHORED ARCHITECTURE ────────────────────────────────────────────────
  // After the random panel variation and before the deck paint: the large and
  // medium forms are what the panels vary WITHIN, and the paint goes on top of
  // the structure exactly as it would on a real deck.
  ctx.globalAlpha = 1;
  if (architecture.length) drawArchitecture(ctx, architecture, archPal);
  // Contact shadows last on the structure, so a console grounds onto whatever
  // plate it happens to stand on rather than under it.
  if (grounding.length) drawArchitecture(ctx, grounding, archPal);

  // Primary strip lights (horizontal runs).
  //
  // `stripEvery: 0` turns them off entirely. An authored room carries its light
  // in the emissive layer instead — a full-width 3px line at every 520px is a
  // ceiling fixture drawn on the floor, and in the Vader chamber it was also
  // CRIMSON, which is the one colour the environment may not spend.
  ctx.globalAlpha = 1;
  ctx.fillStyle = strip;
  for (let y = 0; stripEvery > 0 && y < worldH; y += stripEvery) {
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
  for (let y = 100; accentEvery > 0 && y < worldH; y += accentEvery) {
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

/**
 * The caught super, handed back.
 *
 * Round on purpose. Every other projectile in this game is a stretched bolt
 * pointing at where it is going, because they are all fast — and the whole
 * point of this one is that it is SLOW and you are meant to walk away from it.
 * A sphere reads as a mass being pushed rather than a shot being fired, and it
 * gives the eye no speed line to misjudge.
 *
 * It is the PLAYER'S red, not Vader's crimson lane colour, with a white-hot
 * core: it has to be legible as your own super coming home. The violet fringe
 * is the only thing of his in it — that is the Force holding it together.
 *
 * SIZE IS A HITBOX. `Bullet.fire` calls `setCircle(this.width / 2)`, so this
 * canvas's dimensions ARE the collision radius: 22 logical px at scale 4 is an
 * 88px sprite and a 44px body, against the super pellet's 27 and an ordinary
 * bolt's 9. Changing the canvas silently changes how hard it is to dodge — see
 * the bullet-hitbox trap in CLAUDE.md.
 */
export function paintForceOrb(scene, key = 'boss-force-orb') {
  const R = 11;
  const c = new PixelCanvas(scene, key, R * 2, R * 2, 4);
  const cx = R - 1, cy = R - 1;

  c.circle(cx, cy, 10, '#5a1e6e');                      // Force fringe
  c.circle(cx, cy, 9,  PAL.boltRed);
  c.circle(cx, cy, 7,  PAL.boltRedGlow);
  c.circle(cx, cy, 4,  PAL.boltRedCore);
  c.circle(cx, cy, 2,  '#ffffff');

  // Crackle. Four stubs off the equator so the mass looks contained rather than
  // drawn — a clean gradient sphere reads as a bubble, which is the one thing
  // it must not read as.
  for (const [dx, dy] of [[10, 0], [-10, 0], [0, 10], [0, -10],
                          [7, 7], [-7, -7], [7, -7], [-7, 7]]) {
    c.px(cx + dx, cy + dy, PAL.boltRedCore);
  }
  c.px(cx - 3, cy - 4, '#ffffff');
  c.px(cx + 4, cy + 3, '#ffffff');

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

// ── NEMESIS BODIES ──────────────────────────────────────────────────────────
//
// Why these exist at all: a nemesis used to be the ordinary 20x20 trooper sheet
// rendered at 1.8x. The verdict was "the detached head and torso looks bad, and
// doesn't look special like a mini boss. Just looks like a not-scale-intended
// big classic enemy" — and that is exactly what it was.
//
// The trooper is drawn with rows y=10..11 EMPTY between the helmet (y 4..9) and
// the torso (y 12..15), and with arms as free-floating 3x3 blocks separated
// from the torso by another clear pixel. At 1x those gaps are hairlines that
// read as shading. At 1.8x each logical pixel is ~7 screen px, so the gap
// becomes a ~14px transparent band and the sprite comes apart into three
// pieces. No amount of tinting or regalia fixes art whose proportions assume it
// will never be looked at closely.
//
// The reference for what "special" means here is `drawVader`, and the three
// things he does that a trooper does not:
//
//   1. a SOLVED CURVED dome, not a stack of hlines
//   2. head -> gorget -> pauldrons -> chest WELDED, each overlapping the next,
//      so there is no row the silhouette can come apart on
//   3. MASS BELOW THE BELT — his cape. It is the single biggest silhouette
//      differentiator between a boss and a trooper, and troopers have two 2px
//      boots there.
//
// These are 32x32 (Vader is 40x40, a trooper 20x20) at the same scale 4, so a
// nemesis carries 2.5x the art resolution it used to at the same on-screen
// size — `_spawnMiniBoss` drops the render scale to compensate.
//
// Frame order is IDENTICAL to the trooper sheets (0-7 front, 8-15 back, 16-23
// side, 24-32 poses via paintPoseFrames), so PreloadScene's anim-key arithmetic
// and everything reading `_animPrefix` keeps working untouched.

const NEM_W = 32, NEM_H = 32, NEM_FRAMES = 33;

/**
 * One nemesis sheet.
 *
 * `skin` carries the palette and the per-type details, so a new archetype is a
 * data object rather than another 200-line painter — "types, then variations".
 */
function paintNemesisSheet(scene, key, skin) {
  const ss = new SpriteSheet(scene, key, NEM_W, NEM_H, NEM_FRAMES, 4);
  const C = PAL;
  const cx = 16;

  function draw(f, legPhase = 0, dir = 'front', hurt = false, pose = null) {
    ss.frame(f);
    // Same two channels as drawVader: a vertical BOB and a forward LEAN, so a
    // pose changes the SILHOUETTE and not just an arm. A pose that only moves
    // limbs is invisible at this size.
    const poseBob = pose === 'raise' ? -2 : pose === 'thrust' ? 2 : pose === 'recoil' ? 3 : null;
    const lean = pose === 'raise' ? -2 : pose === 'thrust' ? 3 : pose === 'recoil' ? -2 : 0;
    const armDx = pose === 'raise' ? 0 : pose === 'thrust' ? 3 : pose === 'recoil' ? 2 : 0;
    const armDy = pose === 'raise' ? -4 : pose === 'thrust' ? -1 : pose === 'recoil' ? 3 : 0;
    const bob = poseBob !== null ? poseBob : (legPhase === 0 ? 0 : (Math.abs(legPhase) === 2 ? 1 : 0));

    const main = hurt ? C.white : skin.main;
    const mid = hurt ? C.offWhite : skin.mid;
    const dark = skin.dark;
    const trim = skin.trim;

    // ── SKIRT / TASSETS — mass below the belt ───────────────────────────────
    // Drawn FIRST so the belt and boots overlap it rather than the reverse.
    // This is the boss-silhouette trick: without weight down here the shape is
    // a trooper however big it is drawn.
    const sy = 24 + bob;
    for (let i = 0; i < 6; i++) {
      const w = 6 + i;                       // widens as it falls
      // Lit at the top, falling to black at the hem, so it reads as a hanging
      // mass rather than a painted trapezoid.
      const tone = i === 0 ? skin.light : (i < 3 ? skin.skirt : dark);
      ss.hline(sy + i, cx - w + lean, cx + w - 1 + lean, tone);
    }
    // Vertical folds, so the skirt is not a flat slab.
    for (const fx of [-7, -3, 2, 6]) {
      ss.vline(cx + fx + lean, sy + 1, sy + 5, C.black);
    }

    // ── LEGS ────────────────────────────────────────────────────────────────
    // Short: the skirt carries the mass down here, and long legs under it turn
    // the shape back into a trooper.
    const step = legPhase;
    ss.rect(cx - 5 + lean, 30 + bob + (step > 0 ? -1 : 0), 4, 2, C.black);
    ss.rect(cx + 1 + lean, 30 + bob + (step < 0 ? -1 : 0), 4, 2, C.black);

    // ── TORSO ───────────────────────────────────────────────────────────────
    const ty = 16 + bob;
    ss.rect(cx - 6 + lean, ty, 12, 10, main);
    ss.hline(ty, cx - 6 + lean, cx + 5 + lean, skin.light);      // lit top edge
    ss.hline(ty + 9, cx - 6 + lean, cx + 5 + lean, dark);        // shaded bottom
    ss.vline(cx - 6 + lean, ty, ty + 9, dark);
    ss.vline(cx + 5 + lean, ty, ty + 9, dark);
    // Chest plate, so the middle of the body is not empty at this size.
    ss.rect(cx - 4 + lean, ty + 2, 8, 5, mid);
    ss.hline(ty + 2, cx - 4 + lean, cx + 3 + lean, skin.light);
    skin.chest?.(ss, cx + lean, ty, C);

    // ── BELT ────────────────────────────────────────────────────────────────
    ss.hline(24 + bob, cx - 7 + lean, cx + 6 + lean, C.impGrey);
    ss.hline(25 + bob, cx - 7 + lean, cx + 6 + lean, C.black);
    ss.rect(cx - 2 + lean, 24 + bob, 4, 2, trim);                // buckle

    // ── PAULDRONS ───────────────────────────────────────────────────────────
    // 8 wide and overlapping the torso by 2px on each side. The trooper's arms
    // are 3x3 with a clear pixel between them and the body; these are welded,
    // which is most of why the silhouette holds together when scaled.
    // 6 wide, not 8. The first pass ran them cx-12..cx+11 — 24px of a 32px
    // frame against a 12px torso — which made the silhouette a squat T. Vader
    // reads as a boss partly because he is VERTICAL; a nemesis whose widest
    // feature is its shoulders reads as a beetle.
    const py = 15 + bob + armDy;
    ss.rect(cx - 10 - armDx + lean, py, 6, 8, mid);
    ss.rect(cx + 4 + armDx + lean, py, 6, 8, mid);
    ss.hline(py, cx - 10 - armDx + lean, cx - 5 - armDx + lean, skin.light);
    ss.hline(py, cx + 4 + armDx + lean, cx + 9 + armDx + lean, skin.light);
    ss.hline(py + 7, cx - 10 - armDx + lean, cx - 5 - armDx + lean, dark);
    ss.hline(py + 7, cx + 4 + armDx + lean, cx + 9 + armDx + lean, dark);
    // Trim ridge along the top of each pauldron.
    ss.hline(py + 1, cx - 9 - armDx + lean, cx - 6 - armDx + lean, trim);
    ss.hline(py + 1, cx + 5 + armDx + lean, cx + 8 + armDx + lean, trim);

    // ── GORGET ──────────────────────────────────────────────────────────────
    // The piece the trooper does not have. It fills rows 13..16 between the
    // dome and the chest, so there is no row where the body can separate.
    ss.rect(cx - 4 + lean, 13 + bob, 8, 4, dark);
    ss.hline(13 + bob, cx - 4 + lean, cx + 3 + lean, C.impSilver);

    // ── HELMET DOME ─────────────────────────────────────────────────────────
    // Solved per row rather than stacked hlines, and it overlaps the gorget by
    // two rows so head and body are one shape.
    const hy = 9 + bob;
    const R = 6;
    for (let dy = -R; dy <= R; dy++) {
      const w = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
      if (w <= 0) continue;
      const tone = dy <= -4 ? skin.light : (dy >= 4 ? dark : (dy <= -2 ? main : mid));
      ss.hline(hy + dy, cx - w + lean, cx + w - 1 + lean, tone);
    }
    // Crown glint.
    ss.px(cx - 3 + lean, hy - 4, C.white);
    ss.px(cx - 2 + lean, hy - 4, C.white);

    // ── FACE, per facing ────────────────────────────────────────────────────
    if (dir === 'front') {
      ss.rect(cx - 5 + lean, hy, 10, 3, C.black);                // visor band
      skin.visor?.(ss, cx + lean, hy, C);
      // Breathing vents, centred under the visor.
      ss.rect(cx - 2 + lean, hy + 3, 4, 2, C.impDark);
    } else if (dir === 'side') {
      ss.rect(cx + 1 + lean, hy, 5, 3, C.black);
      skin.visor?.(ss, cx + 2 + lean, hy, C);
      ss.rect(cx - 5 + lean, hy + 1, 3, 3, dark);                // rear cowl
    } else {
      // Back: a ridged crest, plus a nape shadow, so the reverse view is
      // recognisably the back of something and not a blank dome.
      ss.vline(cx + lean, hy - 5, hy + 5, dark);
      ss.vline(cx - 1 + lean, hy - 5, hy + 5, skin.light);
      ss.hline(hy + 4, cx - 4 + lean, cx + 3 + lean, dark);
      ss.px(cx - 1 + lean, hy - 5, C.white);
    }

    skin.extra?.(ss, cx + lean, bob, dir, C, { armDx, armDy, lean });
  }

  // Frame table — identical shape to the trooper sheets.
  const walk = [0, 1, 2, 1, 0, -1, -2, -1];
  ['front', 'back', 'side'].forEach((dir, di) => {
    const base = di * 8;
    draw(base, 0, dir);                                   // idle
    for (let i = 1; i <= 6; i++) draw(base + i, walk[i], dir);
    draw(base + 7, 0, dir, true);                         // hurt / fire
  });
  paintPoseFrames(draw);
  ss.finish();
}

// ── The types ───────────────────────────────────────────────────────────────
//
// Variation is palette and a couple of drawn details, not a new painter. A
// trait recolours on top of this at runtime via setTint, exactly as before.

export function paintNemesisBrute(scene, key = 'nem-brute') {
  paintNemesisSheet(scene, key, {
    main: PAL.beskar, mid: PAL.beskarMid, dark: PAL.beskarDeep,
    light: PAL.beskarLight, trim: PAL.gold, skirt: PAL.beskarDark,
    visor: (ss, cx, hy, C) => { ss.px(cx - 3, hy + 1, C.ledRed); ss.px(cx + 2, hy + 1, C.ledRed); },
    chest: (ss, cx, ty, C) => {
      // A heavy central rib — the brute reads as armour first.
      ss.vline(cx, ty + 2, ty + 6, C.beskarShine);
      ss.rect(cx - 3, ty + 7, 6, 2, C.impDark);
    },
  });
}

export function paintNemesisDemolisher(scene, key = 'nem-demo') {
  paintNemesisSheet(scene, key, {
    main: PAL.impGrey, mid: PAL.impLight, dark: PAL.impDark,
    light: PAL.impSheen, trim: PAL.expMid, skirt: PAL.impMid,
    visor: (ss, cx, hy, C) => { ss.rect(cx - 2, hy + 1, 4, 1, C.expBright); },
    chest: (ss, cx, ty, C) => {
      // Warning chevrons across the chest.
      for (let i = 0; i < 3; i++) ss.hline(ty + 3 + i, cx - 3 + i, cx + 2 - i, C.expBright);
    },
    // The charge pack, DRAWN INTO THE BODY. It used to be the `reg-volatile`
    // overlay: an 18px-wide slab of canisters pinned at a fixed world offset
    // that did not flip with the sprite or track its walk bob, which is why it
    // read as "not attached properly to enemy".
    extra: (ss, cx, bob, dir, C) => {
      if (dir === 'back') return;                 // the pack is on its back
      const py = 18 + bob;
      for (const dx of [-11, -8, 8, 11]) {
        ss.rect(cx + dx - 1, py, 3, 6, C.rocketBody);
        ss.rect(cx + dx - 1, py, 3, 2, C.expDark);
        ss.px(cx + dx, py + 3, C.expBright);
      }
    },
  });
}

export function paintNemesisMarksman(scene, key = 'nem-marks') {
  paintNemesisSheet(scene, key, {
    main: PAL.dthMid, mid: PAL.dthLight, dark: PAL.dthDark,
    light: PAL.impSilver, trim: PAL.dthLED, skirt: PAL.dthDark,
    visor: (ss, cx, hy, C) => {
      ss.px(cx - 3, hy + 1, C.dthLEDBright);
      ss.px(cx + 2, hy + 1, C.dthLEDBright);
      ss.hline(hy + 2, cx - 3, cx + 2, C.dthLED);
    },
    chest: (ss, cx, ty, C) => {
      // Sensor bank — reads as equipment rather than plate.
      for (let i = 0; i < 3; i++) ss.px(cx - 2 + i * 2, ty + 4, C.dthLEDBright);
      ss.hline(ty + 6, cx - 3, cx + 2, C.impDark);
    },
  });
}
