// VISUAL IDENTITY V2 — the pilot's SEAMS (`?visualPilot=v2`).
//
// The only entry points the game calls, each a no-op unless the flag is on
// (`v2` or `v2b`; the two differ only in the Hangar set):
//   PreloadScene  paintVisualPilot(scene)          — every V2 texture + anims
//   GameScene     pilotTexFor(spec, key)           — Hangar cover / prop art
//                 wearPilotSwarm(enemy)            — a swarmling's V2 body
//                 paintPilotHangarBackdrop(...)    — (vpHangar.js) the floor
// The protagonist needs no runtime seam: PreloadScene paints the V2 sheet into
// the `player` key, on the same 24-frame contract the `mando-*` keys read.
//
// PRESENTATION ONLY. See `systems/debug.js` (VISUAL IDENTITY V2) for the
// contract and `tests/smoke-visual-pilot.mjs` for the proof.

import { isVisualPilotV2, isVisualPilotV2B, getVisualPilot } from './debug.js';
import { paintPilotSwarm, paintPilotCrate, paintMaterialPass, registerStockAnims, paintPilotCrateB, paintReliefPass } from './vpPaint.js';
import { hangarPilotTex } from './vpHangar.js';

export const PILOT_SWARM_TEX = 'vp-swarm';

/**
 * Paint every pilot texture and register the swarm sheet's stock anim keys.
 * `v2` and `v2b` share the protagonist (painted in PreloadScene) and the swarm
 * sheet; each paints only its own Hangar set.
 */
export function paintVisualPilot(scene) {
  if (!isVisualPilotV2()) return;
  paintPilotSwarm(scene, PILOT_SWARM_TEX);
  registerStockAnims(scene, PILOT_SWARM_TEX, PILOT_SWARM_TEX);
  if (isVisualPilotV2B()) {
    paintPilotCrateB(scene, 'vp2b-crate-a', 'a');
    paintPilotCrateB(scene, 'vp2b-crate-b', 'b');
    // technical fixtures: near-black housings, so the threshold drops and the
    // rim is strong — the housing reads by its lit edges and joint lips
    // their chassis rows are `conChassis`'s own (pedestal: top 0-5, base
    // 21-26; heavy: top 0-6, base 22-27) — a lit top plane over a dark face
    paintReliefPass(scene, 'ch-con-ped-c', 'vp2b-con-ped-c', { outline: true, bodyLum: 14, rim: 0.50, planes: { top: [0, 5, 0.26], base: [21, 26, 0.78] } });
    paintReliefPass(scene, 'ch-con-heavy', 'vp2b-con-heavy', { outline: true, bodyLum: 14, rim: 0.50, planes: { top: [0, 6, 0.26], base: [22, 27, 0.78] } });
    paintReliefPass(scene, 'prop-drum', 'vp2b-drum', { sym: true, outline: true });
    paintReliefPass(scene, 'prop-drum-b', 'vp2b-drum-b', { sym: true, outline: true });
    // the landmark: OUTER edges only (no joint lips — a lit line on every panel
    // seam turned the craft into a blueprint) and a restrained rim
    paintReliefPass(scene, 'prop-shuttle', 'vp2b-shuttle', { rim: 0.46, inner: false });
    // the Hangar places the gantry flipped: its north-west is texture east
    paintReliefPass(scene, 'prop-crane', 'vp2b-crane', { flip: true, outline: true, rim: 0.36 });
    paintReliefPass(scene, 'ch-con-wall', 'vp2b-con-wall', { bodyLum: 14 });
    return;
  }
  paintPilotCrate(scene, 'vp-crate-a', 'a');
  paintPilotCrate(scene, 'vp-crate-b', 'b');
  paintMaterialPass(scene, 'ch-con-ped-c', 'vp-con-ped-c');
  paintMaterialPass(scene, 'ch-con-heavy', 'vp-con-heavy');
  paintMaterialPass(scene, 'prop-drum', 'vp-drum');
  paintMaterialPass(scene, 'prop-drum-b', 'vp-drum-b');
}

/** The texture a Hangar cover object / prop stands on: pilot art under the flag, else `key`. */
export function pilotTexFor(scene, spec, key) {
  if (!isVisualPilotV2() || spec?.id !== 'hangar') return key;
  const k = hangarPilotTex(getVisualPilot())[key];
  return k && scene.textures.exists(k) ? k : key;
}

/**
 * Put a swarmling on the V2 sheet WITHOUT moving its physics. Exactly what
 * `EnemySwarmling`'s constructor does for the legacy sheet — texture, prefix,
 * then the body circle at the SAME radius re-centred on the new frame — and
 * the 0.7 render scale is left alone, so Arcade's `radius x |scale|` body is
 * byte-identical. The tint is cleared because the colour is baked.
 */
export function wearPilotSwarm(enemy) {
  if (!isVisualPilotV2() || !enemy.scene.textures.exists(PILOT_SWARM_TEX)) return;
  enemy.anims?.stop();
  enemy.setTexture(PILOT_SWARM_TEX);
  enemy._animPrefix = PILOT_SWARM_TEX;
  enemy.clearTint();
  const r = enemy.cfg.radius;
  enemy.body.setCircle(r, enemy.width / 2 - r, enemy.height / 2 - r);
  enemy.play(`${PILOT_SWARM_TEX}-idle-front`);
}
