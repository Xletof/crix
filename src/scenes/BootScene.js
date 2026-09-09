import Phaser from 'phaser';
import {
  setDialogueMuted, setDuelRequest, parseDuelParams, setHitstopMuted, setMoveNamesMuted,
  setEncDebug, setEncForce, parseEncDebugParams, setChampDebug,
} from '../systems/debug.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { CAMERA } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // `?nodlg=1` suppresses the dialogue cards. For the test harnesses only:
    // the card pauses Game and HUD and waits for a tap, which is correct for a
    // player and hangs a bot for the whole measurement cap. Read here rather
    // than set per-test so a harness copied from another inherits it — see the
    // note in systems/debug.js.
    const params = new URLSearchParams(globalThis.location?.search || '');
    if (params.has('nodlg')) setDialogueMuted(true);
    // `?nofreeze=1` mutes hitstop. Harnesses only — see systems/debug.js.
    if (params.has('nofreeze')) setHitstopMuted(true);
    // `?nonames=1` hides Vader's ATTACK-NAME callouts, and only those, so a
    // reviewer can judge whether each move reads without its label.
    if (params.has('nonames')) setMoveNamesMuted(true);
    // `?duel=` drops straight into a nemesis fight — see systems/debug.js for
    // the grammar. Parsed here so the request survives the Preload/Title hop.
    // `?camdbg=1` raises the camera director's tuning overlay — the safe area,
    // the deadzone, the anchor and the gap between the camera's target and
    // where it actually is. Debug only; there is also a DEBUG card toggle.
    if (params.has('camdbg')) CAMERA.debug = true;

    setDuelRequest(parseDuelParams(params));

    // `?encdbg=1` raises the Phase A encounter test overlay — see
    // systems/debug.js for the grammar. `room` and `sector` are read here so a
    // whole test case ("CROSSFIRE in detention at sector 8") is one bookmark on
    // the handset. An unknown archetype id falls back to AUTO rather than
    // forcing something the table does not contain.
    const enc = parseEncDebugParams(params);
    if (enc) {
      setEncDebug(true);
      setEncForce(enc.force && ENCOUNTERS[enc.force] ? enc.force : null);
      this.registry.set('encdbgStart', { room: enc.room, sector: enc.sector });
    }

    // `?champdbg=1` injects one Champion into each ordinary wave — the Phase B
    // vertical slice. Debug only; normal Endless spawns none.
    if (params.has('champdbg')) setChampDebug(true);

    this.scene.start('Preload');
  }
}
