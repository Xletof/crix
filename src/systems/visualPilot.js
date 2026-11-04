// VISUAL IDENTITY V2 — the pilot's SEAMS (`?visualPilot=v2`).
//
// The only entry points the game calls, each a no-op unless the flag is on:
//   PreloadScene  paintVisualPilot(scene)          — every V2 texture + anims
//   GameScene     pilotTexFor(spec, key)           — Hangar cover / prop art
//                 wearPilotSwarm(enemy)            — a swarmling's V2 body
//                 paintPilotHangarBackdrop(...)    — (vpHangar.js) the floor
// The protagonist needs no runtime seam: PreloadScene paints the V2 sheet into
// the `player` key, on the same 24-frame contract the `mando-*` keys read.
//
// PRESENTATION ONLY. See `systems/debug.js` (VISUAL IDENTITY V2) for the
// contract and `tests/smoke-visual-pilot.mjs` for the proof.

import { isVisualPilotV2 } from './debug.js';
import { paintPilotSwarm, paintPilotCrate, paintMaterialPass, registerStockAnims } from './vpPaint.js';
import { HANGAR_PILOT_TEX } from './vpHangar.js';

export const PILOT_SWARM_TEX = 'vp-swarm';

/** Paint every V2 texture and register the swarm sheet's stock anim keys. */
export function paintVisualPilot(scene) {
  if (!isVisualPilotV2()) return;
  paintPilotSwarm(scene, PILOT_SWARM_TEX);
  registerStockAnims(scene, PILOT_SWARM_TEX, PILOT_SWARM_TEX);
  paintPilotCrate(scene, 'vp-crate-a', 'a');
  paintPilotCrate(scene, 'vp-crate-b', 'b');
  paintMaterialPass(scene, 'ch-con-ped-c', 'vp-con-ped-c');
  paintMaterialPass(scene, 'ch-con-heavy', 'vp-con-heavy');
  paintMaterialPass(scene, 'prop-drum', 'vp-drum');
  paintMaterialPass(scene, 'prop-drum-b', 'vp-drum-b');
}

/** The texture a Hangar cover object / prop stands on: V2 art under the flag, else `key`. */
export function pilotTexFor(scene, spec, key) {
  if (!isVisualPilotV2() || spec?.id !== 'hangar') return key;
  const k = HANGAR_PILOT_TEX[key];
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
