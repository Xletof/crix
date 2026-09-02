import Phaser from 'phaser';

/**
 * ENVIRONMENT LIGHT — the arena's authored emissive layer.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LIGHTS OUT works by multiplicatively tinting `roomLayer` down. Everything
 * baked into the backdrop canvas or painted onto a room sprite goes down with
 * it — which is correct for ambient architecture and fatal for anything that is
 * supposed to be a LIGHT. A screen baked into the console texture cannot stay
 * lit while the console is being multiplied toward black, and it certainly
 * cannot throw anything onto the metal beside it. The emergency-power prototype
 * that shipped before this worked around it with one blue disc per console, and
 * was honest about being a placeholder.
 *
 * So the light does not live in `roomLayer` at all. It lives here: ADD-blended
 * objects that no tint touches, at a depth below every actor. Additive over a
 * near-black floor is a light; additive over a lit floor is an accent. That one
 * property is what lets the SAME source list serve both of the room's states —
 * the sources do not switch on when the power fails, they get louder, and the
 * room around them goes quiet.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * EMITTER + SPILL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every source draws two things, and the second one is the entire point:
 *
 *   EMITTER — the bright thing itself. Small, crisp, near its colour's hot end.
 *             This is the part that could have been a texture.
 *   SPILL   — evidence that it is producing light. A soft falloff around the
 *             emitter, SHAPED LIKE THE EMITTER.
 *
 * SPILL TAKES THE SHAPE OF ITS SOURCE. A monitor does not make a circular pool
 * on the floor, it washes the housing around it. A strip makes a long thin
 * halo. An LED makes a compact dot of contamination and nothing more. The kinds
 * below exist so a spec cannot ask for a radial pool under a rectangular
 * screen, which is exactly what the placeholder did to every source it had.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY TEXTURES AND NOT GRAPHICS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The first build of this drew each spill as a stack of expanding filled rects
 * with a ramped alpha — the same construction the saber's halo uses, where it
 * works because the shapes are capsules at a small scale. At environment scale
 * it failed: five concentric rectangles over a 150px wash are five visible
 * bands, and a wall screen photographed as a television in a box rather than as
 * something emitting. Six steps would not have fixed it; a stack of hard-edged
 * shapes has edges.
 *
 * So the falloff is baked into two small textures instead, painted per-pixel
 * once, and every source is an ADD-blended Image that tints and stretches one
 * of them. Three consequences, all good:
 *   - the falloff is smooth, because it is a real gradient
 *   - `setPower` becomes N alpha writes and NOTHING is re-rasterised
 *   - the textures are shared, so the source count costs sprites, not memory
 *
 * The soft-box texture is SEPARABLE — its alpha is a product of two 1-D
 * falloffs — which is what lets one 128px square be stretched to a 40x300
 * emergency strip and a 160x90 screen wash without the corners going wrong.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHAT IT IS NOT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Not a lighting engine. No occlusion, no shadow casting, no normals, no
 * shader, no per-frame anything. It is a list of hand-placed shapes with two
 * intensities each, and the room's power state picks a number between them.
 */

// Depth 3: above the floor-decal RenderTexture (2) and below every actor, which
// Y-sorts from ~90 up. Environment light therefore can never draw over the
// player, an enemy, a bullet, a telegraph or the saber — the brief's
// readability gate is enforced by a depth constant rather than by taste.
//
// THE ONE EXCEPTION IS THE `face` KIND, and it is exempt for the opposite
// reason: a face is registered on top of a large opaque prop, so at depth 3 it
// would be drawn underneath the object it is supposed to be lighting. It takes
// that prop's depth + 1 instead, and its rectangle is the prop's rectangle, so
// the pixels it can reach are pixels the prop already owns. See the case body.
export const ENV_LIGHT_DEPTH = 3;

const TEX_RADIAL = 'env-glow-radial';
const TEX_BOX    = 'env-glow-box';
const TEX_FLAT   = 'env-glow-flat';
const TEX_SIZE   = 128;

/**
 * The two falloff textures and the emitter face, painted once per game.
 * Idempotent — the second room to ask for them gets the first room's.
 *
 * ~64KB of texture in total (two 128x128 RGBA and one 4x4), shared by every
 * source in every room for the life of the process.
 */
function ensureGlowTextures(scene) {
  const S = TEX_SIZE, H = S / 2;
  if (!scene.textures.exists(TEX_RADIAL)) {
    const tex = scene.textures.createCanvas(TEX_RADIAL, S, S);
    const ctx = tex.getContext();
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.min(1, Math.hypot(x - H + 0.5, y - H + 0.5) / H);
        // A quadratic-ish falloff with no flat core: a point source is
        // brightest exactly at the point.
        const a = Math.pow(1 - d, 2.2);
        const i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
  }
  if (!scene.textures.exists(TEX_BOX)) {
    const tex = scene.textures.createCanvas(TEX_BOX, S, S);
    const ctx = tex.getContext();
    const img = ctx.createImageData(S, S);
    // SEPARABLE: alpha(x, y) = f(x) * f(y). This is what survives being
    // stretched 8:1 on one axis — a radial gradient scaled that far is an
    // ellipse with a visible long axis, which is not what a strip light does.
    // The inner 26% is flat, so the shape has a body before it falls away.
    const f = new Float32Array(S);
    for (let x = 0; x < S; x++) {
      const d = Math.min(1, Math.abs(x - H + 0.5) / H);
      f[x] = d < 0.26 ? 1 : Math.pow(1 - (d - 0.26) / 0.74, 2.0);
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(f[x] * f[y] * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
  }
  if (!scene.textures.exists(TEX_FLAT)) {
    const tex = scene.textures.createCanvas(TEX_FLAT, 4, 4);
    const ctx = tex.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
    tex.refresh();
  }
}

export class EnvLight {
  /**
   * @param {Phaser.Scene} scene
   * @param {Array} sources see `_build` for the kinds and their fields
   */
  constructor(scene, sources = []) {
    this.scene = scene;
    ensureGlowTextures(scene);
    // Every object this owns, so `destroy` is a sweep and cannot miss one.
    this.parts = [];
    this._v = null;
    for (const s of sources) this._build(s);
    this.setPower(0);
  }

  _img(tex, x, y, w, h, color, mul, angle = 0, depth = ENV_LIGHT_DEPTH) {
    const im = this.scene.add.image(x, y, tex)
      .setDisplaySize(w, h)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth);
    if (angle) im.setRotation(angle);
    im._mul = mul;   // this part's share of the source's intensity
    return im;
  }

  _build(s) {
    const col = s.color ?? 0x2a6fb0;
    const hot = s.hot ?? col;
    const parts = [];

    switch (s.kind) {
      // ── A MONITOR FACE. Rectangular emitter; the wash around it is a soft
      //    box biased DOWNWARD by `drop`, because a console screen is tilted up
      //    at its operator and the light it loses lands on the housing and the
      //    deck in front of it.
      case 'screen': {
        const w = s.w ?? 60, h = s.h ?? 22;
        const reach = s.reach ?? 46, drop = s.drop ?? 0.55;
        parts.push(this._img(TEX_BOX,
          s.x, s.y + reach * drop * 0.5,
          w + reach * 2.4, h + reach * 2.4,
          col, s.spill ?? 0.85));
        parts.push(this._img(TEX_FLAT, s.x, s.y, w, h, hot, 1.5));
        break;
      }

      // ── A LIT STRIP. Its halo is the same shape stretched on the short axis
      //    only; a strip that bloomed radially would read as a row of lamps.
      case 'strip': {
        const horiz = (s.dir ?? 'h') === 'h';
        const len = s.len ?? 200, t = s.t ?? 5, reach = s.reach ?? 22;
        const sw = horiz ? len + reach : t + reach * 2.6;
        const sh = horiz ? t + reach * 2.6 : len + reach;
        // `angle` lets a strip lie along something that is not an axis — the
        // tangent of the hero machine's rim, for instance. The box texture is
        // separable, so rotating an already-stretched instance is a plain
        // image rotation and costs nothing.
        const rot = s.angle ?? 0;
        parts.push(this._img(TEX_BOX, s.x, s.y, sw, sh, col, s.spill ?? 0.8, rot));
        // `emitter: false` is a SPILL WITHOUT A SOURCE, and there is exactly
        // one legitimate reason to ask for it: the source is somewhere this
        // layer cannot draw — painted into a prop's own face — and what is
        // wanted here is only the light it throws onto the deck. Left on, the
        // crisp `TEX_FLAT` bar photographs as a second bright object lying on
        // the floor beside the machine rather than as its light.
        if (s.emitter !== false) {
          parts.push(this._img(TEX_FLAT, s.x, s.y, horiz ? len : t, horiz ? t : len, hot, 1.4, rot));
        }
        break;
      }

      // ── A STATUS LAMP. Compact by definition. If it needs a big glow it is
      //    not an LED, it is a `core`.
      case 'led': {
        const r = s.r ?? 3, reach = s.reach ?? 10;
        parts.push(this._img(TEX_RADIAL, s.x, s.y, (r + reach) * 2, (r + reach) * 2, col, s.spill ?? 0.9));
        parts.push(this._img(TEX_FLAT, s.x, s.y, r * 2, r * 2, hot, 1.7));
        break;
      }

      // ── A MACHINERY CORE. The one kind where a radial pool IS the truth:
      //    something hot inside a housing, seen through it.
      case 'core': {
        const r = s.r ?? 14, reach = s.reach ?? 60;
        parts.push(this._img(TEX_RADIAL, s.x, s.y, (r + reach) * 2, (r + reach) * 2, col, s.spill ?? 0.85));
        parts.push(this._img(TEX_RADIAL, s.x, s.y, r * 2.2, r * 2.2, hot, 1.4));
        break;
      }

      // ── AN EMISSIVE FACE BOLTED TO A PROP.
      //
      //    Every other kind here is a shape this file draws. A `face` is an
      //    AUTHORED texture — emitter and its local spill painted together, in
      //    the prop's own space — registered exactly on top of the object it
      //    belongs to and given that object's depth plus one.
      //
      //    WHY IT MAY LEAVE DEPTH 3. The rest of the layer sits below the
      //    actor band precisely so environment light can never draw over
      //    combat. A large opaque prop breaks that arrangement in the other
      //    direction: at depth 3 a source on the prop's face is drawn entirely
      //    UNDERNEATH the prop and is simply not visible. The escape is sound
      //    because it is bounded — a face's rectangle is the prop's own
      //    rectangle, so the only pixels it can cover are pixels the prop is
      //    already covering opaquely. Anything the face could hide, the prop
      //    hid first. `smoke-arena` asserts that containment rather than
      //    trusting it.
      //
      //    A face carries no tint by default: the colour decisions were made
      //    in the texture, where a control bank can be cyan and its fault lamp
      //    can be one pixel of red at the same time.
      case 'face': {
        const im = this.scene.add.image(s.x, s.y, s.tex)
          .setOrigin(s.originX ?? 0.5, s.originY ?? 1)
          .setTint(s.color ?? 0xffffff)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(s.depth ?? ENV_LIGHT_DEPTH);
        im._mul = s.spill ?? 1;
        im._face = true;
        parts.push(im);
        break;
      }
    }

    for (const p of parts) {
      p._normal = s.normal ?? 0;
      p._emergency = s.emergency ?? 0;
      // A PURELY DESCRIPTIVE TAG. Nothing in this file reads it; it exists so a
      // test can measure the junction's emergency lane guidance on the LIVE
      // objects rather than re-deriving which spec entry each part came from.
      p._guide = !!s.guide;
      // The same idea, one step more general: a free-form label a room can put
      // on a source so a rig can find it again. `tag: 'reactor'` is what lets
      // the locality diag switch exactly the reactor's own light off and
      // photograph the difference, without a test re-deriving which spec entry
      // produced which Image.
      p._tag = s.tag ?? null;
      this.parts.push(p);
    }
  }

  /**
   * @param {number} v 0 = normal power, 1 = full emergency power.
   * Intermediate values are the outage transition and are honoured, so the
   * room's lights come up on exactly the clock its ambient goes down on.
   *
   * NOTHING IS RE-RASTERISED HERE. The geometry, the tint and the falloff were
   * all decided at room load; a power state is N alpha writes.
   */
  setPower(v) {
    const nv = Phaser.Math.Clamp(v || 0, 0, 1);
    if (this._v != null && Math.abs(nv - this._v) < 0.004) return;
    this._v = nv;
    for (const p of this.parts) {
      if (!p.scene) continue;
      // The two intensities are INDEPENDENT: a source may be dark at normal
      // power (an emergency strip) or dimmer under emergency power than it was
      // before (a screen on a browning-out bus). Neither implies the other.
      const a = p._normal + (p._emergency - p._normal) * nv;
      p.setAlpha(Math.min(1, a * p._mul));
      p.setVisible(a > 0.002);
    }
  }

  destroy() {
    for (const p of this.parts) p.destroy();
    this.parts = [];
    this.scene = null;
  }
}
