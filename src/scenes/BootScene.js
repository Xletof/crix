import Phaser from 'phaser';
import { setDialogueMuted } from '../systems/debug.js';

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

    this.scene.start('Preload');
  }
}
