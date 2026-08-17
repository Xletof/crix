import Phaser from 'phaser';
import {
  setDialogueMuted, setDuelRequest, parseDuelParams, setHitstopMuted, setMoveNamesMuted,
} from '../systems/debug.js';

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
    setDuelRequest(parseDuelParams(params));

    this.scene.start('Preload');
  }
}
