import Phaser from 'phaser';
import {
  setDialogueMuted, setDuelRequest, parseDuelParams, setHitstopMuted, setMoveNamesMuted,
  setEncDebug, setEncForce, parseEncDebugParams, setChampDebug, setChampWhich, setChampPlacementOff, setVanguardScreenOff, setVanguardFrontOff,
  setCapTel, setB0, setB1Variant, setShowColliders, applyGameplayFlags, applyVisualFlags,
} from '../systems/debug.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { b0Store } from '../systems/b0Report.js';
import { applyB1Tuning } from '../systems/b1Combat.js';
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
    // THE GAMEPLAY BASELINE (R1): the HUMAN-approved integrated configuration
    // is the default — roster v1, move v22, gait v2, Bulwark and Marksman stuck
    // B, Marksman T1, free-Bulwark T2. `?baseline=legacy` selects the pre-R1
    // game; `?roster=` `?move=` `?gait=` `?bulwarkStuck=` `?marksmanStuck=`
    // `?marksmanAngle=` `?bulwarkAngle=` override one switch each. Grammar and
    // the R0 experiment labels: systems/debug.js, "THE GAMEPLAY BASELINE".
    applyGameplayFlags(params);
    // `?visualPilot=v2` — the Visual Identity V2 look-development candidate
    // (presentation only, opt-in, not a default). Applied before Preload paints
    // anything, because its protagonist is painted into the `player` key there.
    applyVisualFlags(params);
    // `?colliders=1` draws enemy physics footprints (diagnostic only).
    if (params.has('colliders')) setShowColliders(true);
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
      this.registry.set('encdbgStart', { room: enc.room, sector: enc.sector, wave: enc.wave });
      setChampPlacementOff(enc.nochamp);
      setVanguardScreenOff(enc.noscreen);
      setVanguardFrontOff(enc.nofront);
    }

    // `?champdbg=1` injects one Champion into each ordinary wave — the Phase B
    // vertical slice. Debug only; production places the Captain only through `CHAMPION_PLACEMENTS`.
    if (params.has('champdbg')) {
      setChampDebug(true);
      // `?champdbg=interdictor` / `?champdbg=harrower` reach the two rejected
      // candidates for a side-by-side; anything else (including `1`) is the
      // active one, the SHOCK CAPTAIN.
      setChampWhich(params.get('champdbg'));
    }

    // `?captel=1` turns on the Captain combat-economy telemetry — a separate
    // flag from `champdbg` on purpose, because most Champion reviews are not
    // about numbers and should not have a panel over them. Observation only.
    if (params.has('captel')) setCapTel(true);

    // `?b0=1|A|B` — B0 combat-baseline telemetry (measurement only, opt-in).
    // The controller is created HERE so the title screen already offers the
    // B0 DATA button and a run interrupted by a reload or a closed tab is
    // recovered before the next one starts.
    if (params.has('b0')) { setB0(params.get('b0') || '1'); b0Store(); }

    // `?b1=G|M|S` — B1 combat experiments (HUMAN-authorized, opt-in). The
    // shared STANDARD tuning is written once here, before any scene reads it.
    if (params.has('b1')) { setB1Variant(params.get('b1')); applyB1Tuning(); }

    this.scene.start('Preload');
  }
}
