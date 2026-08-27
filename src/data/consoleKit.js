/**
 * THE CONSOLE KIT — the emitter contract for the three console archetypes.
 *
 * The art lives in `pixelArt.js`; this is the other half of the same object.
 * Every luminous region of a console is declared here ONCE, in the sprite's
 * own logical pixels, and `GameScene.loadRoom` converts it to the room's
 * emissive layer. Two things follow from that and both are the point:
 *
 *   - A CONSOLE'S LIGHT CANNOT DRIFT FROM ITS ART. The screen coordinates are
 *     the same numbers the painter used, converted arithmetically rather than
 *     re-typed into a room spec. A hand-written screen coordinate is one edit
 *     away from glowing where a console used to be.
 *   - EMITTER + SPILL, WITH THE SPILL SHAPED LIKE ITS SOURCE. A display is a
 *     `screen` (rectangular emitter, soft box wash biased down onto the deck
 *     in front of it), a status lamp is a `led` (compact dot, nothing more).
 *     There are no generic circular floor pools in here; that was the
 *     placeholder this whole layer replaced.
 *
 * NORMAL VS EMERGENCY. Two independent intensities per region, as everywhere
 * else in the emissive layer. Under LIGHTS OUT the chassis recedes with the
 * rest of `roomLayer` and the screens carry the object — but RESTRAINT IS THE
 * RULE: a console is not supposed to become bright scenery when the power
 * drops, only to stay spatially identifiable. So nominal lamps do not get
 * louder in the dark at all (a lamp that says "fine" has no reason to shout),
 * and only ONE region in the kit — the heavy console's secondary display — is
 * dead at normal power and comes up on the emergency bus.
 *
 * NO RED SOURCES. Each archetype paints a single-pixel fault lamp into its
 * texture, and none of them is declared here. Red is combat language; a red
 * LIGHT in the environment is a different claim from a red pixel of hardware,
 * and `smoke-arena` colour-tests every source in the room.
 *
 * The sprite is 28x28 logical at scale 4, drawn at origin (0.5, 0.5), so a
 * logical pixel (lx, ly) is world offset ((lx + 0.5 - 14) * 4, (ly + 0.5 - 14) * 4)
 * from the console's placement. `L()` is that conversion and is the only place
 * the number 4 appears.
 */

const SPRITE = 28, SCALE = 4;
/** logical rect (x, y, w, h) → world-space {dx, dy, w, h} offsets from centre */
const L = (x, y, w, h) => ({
  dx: (x + w / 2 - SPRITE / 2) * SCALE,
  dy: (y + h / 2 - SPRITE / 2) * SCALE,
  w: w * SCALE,
  h: h * SCALE,
});
/** a logical rect that is a STRIP rather than a screen: same offset, but its
 *  extent is declared as the length/thickness `EnvLight` asks a strip for. */
const LSTRIP = (x, y, w, h) => { const r = L(x, y, w, h); return { dx: r.dx, dy: r.dy, len: r.h, t: r.w }; };
/** logical pixel → world-space offset */
const P = (x, y) => ({ dx: (x + 0.5 - SPRITE / 2) * SCALE, dy: (y + 0.5 - SPRITE / 2) * SCALE });

const SCREEN = { color: 0x1a5a96, hot: 0x9fe0ff };
const NOMINAL = { color: 0x1a7a3a, hot: 0x8fffb0 };

// `reach` on a console screen has to clear the console SPRITE. Environment
// light draws at depth 3 and a console Y-sorts at y + 56, so a wash smaller
// than the 112px sprite is drawn entirely underneath the object it belongs to
// and the console reads as bright rather than as lighting anything.
export const CONSOLE_KIT = {
  // ── A / PEDESTAL TERMINAL, variant A. One wide display, one key strip.
  'ch-con-ped-a': [
    { kind: 'screen', ...L(6, 8, 16, 7), ...SCREEN, normal: 0.20, emergency: 0.62, reach: 76, drop: 0.30 },
    { kind: 'led', ...P(19, 18), r: 2, ...NOMINAL, normal: 0.26, emergency: 0.26, reach: 9 },
  ],
  // ── A / PEDESTAL TERMINAL, variant B. Narrower display, amber readout
  //    column beside it. Same product, different order code — and the light
  //    follows the face, which is what makes the variation read as hardware.
  'ch-con-ped-b': [
    { kind: 'screen', ...L(5, 8, 11, 8), ...SCREEN, normal: 0.20, emergency: 0.60, reach: 74, drop: 0.30 },
    { kind: 'strip', dir: 'v', ...LSTRIP(19, 9, 3, 7),
      color: 0x6a3406, hot: 0xffab52, normal: 0.14, emergency: 0.42, reach: 20 },
    { kind: 'led', ...P(6, 19), r: 2, ...NOMINAL, normal: 0.26, emergency: 0.26, reach: 9 },
  ],
  // ── C / HEAVY SYSTEMS CONSOLE. Dual display. The SECONDARY is dead at
  //    normal power and comes up on the emergency bus — the one region in the
  //    kit that does, so the heavy console is the one whose face visibly
  //    changes when the chamber loses its bus.
  'ch-con-heavy': [
    { kind: 'screen', ...L(8, 9, 12, 6), ...SCREEN, normal: 0.22, emergency: 0.70, reach: 80, drop: 0.28 },
    { kind: 'screen', ...L(8, 17, 7, 3), color: 0x8a4a10, hot: 0xffcf8a, normal: 0, emergency: 0.55, reach: 46, drop: 0.35 },
    { kind: 'led', ...P(17, 21), r: 2, ...NOMINAL, normal: 0.26, emergency: 0.26, reach: 9 },
  ],
  // ── B / WALL CONTROL PANEL. Declared so the archetype is complete and can
  //    be photographed, and deliberately not placed in the pilot arena this
  //    round — see the painter's note.
  'ch-con-wall': [
    { kind: 'screen', ...L(8, 11, 9, 5), ...SCREEN, normal: 0.18, emergency: 0.52, reach: 44, drop: 0.20 },
    { kind: 'led', ...P(18, 12), r: 2, ...NOMINAL, normal: 0.24, emergency: 0.24, reach: 8 },
  ],
};

/**
 * The emissive sources for one placed console, in world coordinates.
 *
 * @param {string} tex   the console's texture key
 * @param {number} x,y   where it stands
 * @returns {Array} EnvLight source descriptors, or `[]` for a texture that is
 *                  not in the kit — the old `bush` among them, which is how
 *                  the three unstyled arenas stay out of this entirely.
 */
export function consoleEmissives(tex, x, y) {
  const kit = CONSOLE_KIT[tex];
  if (!kit) return [];
  return kit.map((s) => {
    const { dx = 0, dy = 0, ...rest } = s;
    return { ...rest, x: x + dx, y: y + dy };
  });
}
