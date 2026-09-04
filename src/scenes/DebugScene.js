import Phaser from 'phaser';
import { VIEW, FONTS, PLAYER, WEAPONS, ENDLESS, CAMERA } from '../config.js';
import { SFX } from '../systems/FX.js';
import { isGodMode, setGodMode } from '../systems/debug.js';
import { ROOMS } from '../data/rooms.js';
import { rollNemesis } from '../data/nemesis.js';
import { makeRng } from '../systems/rng.js';

// Nemesis loadouts worth reaching for by hand. RANDOM rolls the live stream;
// the rest force a trait pair so a specific fight can be looked at repeatedly —
// including the two the balance sweep flagged as outliers.
const LOADOUTS = [
  { label: 'NEM: RANDOM', traits: null },
  { label: 'NEM: ARMORED', traits: ['armored'] },
  { label: 'NEM: SWIFT', traits: ['swift'] },
  { label: 'NEM: VOLATILE', traits: ['volatile'] },
  { label: 'NEM: SUMMONER', traits: ['summoner'] },
  { label: 'NEM: ARM+COL', traits: ['armored', 'colossal'] },   // the 5.5x outlier
  { label: 'NEM: SWI+VOL', traits: ['swift', 'volatile'] },     // the evasion one
];

// Debug panel, opened from the pause menu.
//
// This exists because there is no other way in. `window.game` is gated behind
// import.meta.env.DEV (main.js), so the deployed build has no console hook, and
// the only other debug affordance in the game (the AI overlay on U/backtick,
// GameScene) is keyboard-only and unreachable on a phone.
//
// It is a separate scene rather than more rows in the pause card because that
// card is 540x880 on a 92px button pitch and its five existing buttons already
// reach y~855. Splitting it also keeps the play screen untouched, so none of
// the HUD's pointer-routing exclusions (_overPauseBtn and the aim-stick guard)
// need to learn about a new button.
//
// RULE FOR EVERYTHING IN HERE: the HUD renders from events on the GameScene's
// emitter, so mutating player state directly without emitting leaves the HUD
// showing stale values. Prefer calling the real methods — equipSecondary(),
// spawnEnemyAt(), _startWave() — which emit correctly on their own. Where a
// field has to be written directly, emit the matching event right after.
export class DebugScene extends Phaser.Scene {
  constructor() {
    super('Debug');
  }

  create(data) {
    this.gs = data?.game || null;
    // Phaser reuses this instance on every launch, so the guard has to be reset
    // here or a second open stays frozen. Same trap PauseScene documents.
    this._closing = false;
    const cx = VIEW.width / 2;

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.72);
    g.fillRect(0, 0, VIEW.width, VIEW.height);

    // Sized to the content: five groups + CLOSE. Grew from 740 when the BOSSES
    // group landed — the alternative was a second page, and a page you have to
    // navigate to is one more step between changing a boss and seeing it, which
    // is the exact friction this group exists to remove. Grew by one `row` (62)
    // again for LOAD VADER CHAMBER; CLOSE was already sitting within a few px
    // of the old bottom edge, so a new row without this would push it outside
    // the card's own border. And once more for LOAD REACTOR JUNCTION, and
    // once more again for LOAD DETENTION BLOCK.
    const cardW = 620, cardH = 1168;
    const cardX = cx - cardW / 2, cardY = VIEW.height * 0.03;
    g.fillStyle(0x0c101d, 0.9);
    g.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    g.lineStyle(3.5, 0xff9020, 0.5);   // amber, so it never reads as a real menu
    g.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);

    this.add.text(cx, cardY + 44, 'DEBUG', {
      fontFamily: FONTS.display,
      fontSize: '44px', fontStyle: 'bold',
      color: '#ffb040', stroke: '#000000', strokeThickness: 7, letterSpacing: 6,
    }).setOrigin(0.5);

    let y = cardY + 96;
    const row = 62;        // tighter than the pause menu's 92 — more controls to fit
    const half = 152;      // x offset for the two-column rows

    const heading = (text) => {
      this.add.text(cardX + 26, y, text, {
        fontFamily: FONTS.body, fontSize: '20px', fontStyle: 'bold',
        color: '#ff9020', letterSpacing: 3,
      }).setOrigin(0, 0.5);
      y += 34;
    };

    // ── Survival ───────────────────────────────────────────────────────────
    heading('SURVIVAL');
    this.godBtn = this._button(cx - half, y, this._godLabel(), () => {
      setGodMode(!isGodMode());
      this.godBtn.label.setText(this._godLabel());
    }, 280);
    this._button(cx + half, y, 'FULL HEAL', () => this._heal(), 280);
    y += row;

    // ── Loadout ────────────────────────────────────────────────────────────
    heading('LOADOUT');
    this._button(cx - half, y, 'GIVE RIFLE', () => this._give('rifle'), 280);
    this._button(cx + half, y, 'GIVE POD', () => this._give('cluster'), 280);
    y += row;
    this._button(cx - half, y, 'REFILL AMMO', () => this._refillAmmo(), 280);
    this._button(cx + half, y, 'REFILL POD', () => this._refillSecondary(), 280);
    y += row;

    // ── Meters ─────────────────────────────────────────────────────────────
    heading('METERS');
    this._button(cx - half, y, 'FILL SUPER', () => this._fillSuper(), 280);
    this._button(cx + half, y, 'FILL MELEE', () => this._fillMelee(), 280);
    y += row;
    this._button(cx - half, y, 'REFILL DASH', () => this._refillDash(), 280);
    // CAMERA OVERLAY, in the free half of an existing row rather than a new one
    // — the card is 1168 tall and CLOSE already sits within a few px of its
    // border. Phase 1's numbers (anchor, deadzone, safe area, and the gap
    // between the camera's target and where it actually is) are invisible from
    // the outside, which is how a camera ends up tuned by guessing. Never on in
    // ordinary play.
    this.camBtn = this._button(cx + half, y, this._camLabel(), () => {
      CAMERA.debug = !CAMERA.debug;
      if (!CAMERA.debug) this.gs?.cameraDirector?.destroy();
      this.camBtn.label.setText(this._camLabel());
    }, 280);
    y += row;

    // ── Encounter ──────────────────────────────────────────────────────────
    heading('ENCOUNTER');
    const types = ['grunt', 'shooter', 'bomber', 'shielded', 'sniper', 'swarmling'];
    this._spawnType = 0;
    this.typeBtn = this._button(cx - half, y, this._typeLabel(types), () => {
      this._spawnType = (this._spawnType + 1) % types.length;
      this.typeBtn.label.setText(this._typeLabel(types));
    }, 280);
    this._button(cx + half, y, 'SPAWN x4', () => this._spawn(types[this._spawnType], 4), 280);
    y += row;
    this._button(cx - half, y, 'CLEAR WAVE', () => this._clearWave(), 280);
    this._button(cx + half, y, 'SKIP WAVE', () => this._skipWave(), 280);
    y += row;

    // ── Bosses ─────────────────────────────────────────────────────────────
    // Reaching Vader's third encounter means playing fifteen sectors. That
    // round trip — change a number, then play for minutes to see it — is why he
    // shipped mistuned twice. Everything here goes through the REAL entry
    // points (`_spawnMiniBoss`, `spawnBoss`), per this file's house rule, so
    // what you are testing is what ships.
    heading('BOSSES');
    this._loadout = 0;
    this.loadBtn = this._button(cx - half, y, this._loadoutLabel(), () => {
      this._loadout = (this._loadout + 1) % LOADOUTS.length;
      this.loadBtn.label.setText(this._loadoutLabel());
    }, 280);
    this._button(cx + half, y, 'SPAWN NEMESIS', () => this._spawnNemesis(), 280);
    y += row;

    this._vaderN = 1;
    this.vaderBtn = this._button(cx - half, y, this._vaderLabel(), () => {
      this._vaderN = (this._vaderN % 6) + 1;
      this.vaderBtn.label.setText(this._vaderLabel());
    }, 280);
    this._button(cx + half, y, 'SPAWN VADER', () => this._spawnVader(), 280);
    y += row;

    // SPAWN VADER above deliberately does NOT change rooms — its contract is
    // "put Vader 340px from where I am standing", and that is the right tool
    // for looking at his moves wherever you happen to be. The cost is that the
    // obvious way to inspect VADER'S CHAMBER shows Vader standing in the
    // hangar, because a fresh endless run starts there and the chamber is not
    // reached until sector 5. This is the way in. It loads the room and stops:
    // pairing them would take the other button's contract away.
    this._button(cx, y, 'LOAD VADER CHAMBER', () => this._loadBossRoom(), 420);
    y += row;

    // THE SAME PROBLEM, ONE ROOM ALONG. The reactor junction is the SECOND
    // room of an endless run (`_arenaCycle` starts at 1, so the rotation goes
    // hangar -> junction -> detention), which sounds cheap until you are
    // reviewing it: reaching it costs a full hangar clear, and re-entering it
    // after you leave costs three more rooms. Every other styled arena has a
    // way in from here; this is the junction's.
    this._button(cx, y, 'LOAD REACTOR JUNCTION', () => this._loadJunction(), 420);
    y += row;

    // AND THE THIRD, WHICH IS THE WORST OF THEM. The detention block is the
    // LAST room of the rotation, so reaching it costs a hangar clear and a
    // junction clear, and re-entering it after you leave costs three more. One
    // predicate, same loader, same contract as the other two.
    this._button(cx, y, 'LOAD DETENTION BLOCK', () => this._loadDetention(), 420);
    y += row;

    this.sectorBtn = this._button(cx - half, y, this._sectorLabel(), () => {
      this._cycleSector();
      this._syncLabels();
    }, 280);
    this._button(cx + half, y, 'CLEAR FIELD', () => this._clearField(), 280);
    y += row;
    this._button(cx - half, y, 'FORCE MOVE', () => this._forceMove(), 280);
    this.arenaBtn = this._button(cx + half, y, this._arenaLabel(), () => {
      if (!this.gs) return;
      this.gs.arenaActive = !this.gs.arenaActive;
      this._syncLabels();
    }, 280);
    y += row + 12;

    this._button(cx, y, 'CLOSE', () => this._close(), 420);

    this.input.keyboard?.on('keydown-ESC', () => this._close());
  }

  _godLabel() { return isGodMode() ? 'GOD: ON' : 'GOD: OFF'; }
  _camLabel() { return CAMERA.debug ? 'CAM DBG: ON' : 'CAM DBG: OFF'; }
  _typeLabel(types) { return types[this._spawnType].toUpperCase(); }
  _loadoutLabel() { return LOADOUTS[this._loadout].label; }
  _vaderLabel() { return `VADER #${this._vaderN}`; }
  _sectorLabel() { return `SECTOR ${this.gs?.sector ?? 1}`; }
  // Visible rather than implied: the spawn buttons turn the arena off, and a
  // silent state change is how you end up wondering why nothing is spawning.
  _arenaLabel() { return this.gs?.arenaActive ? 'ARENA: ON' : 'ARENA: OFF'; }

  _player() { return this.gs?.player || null; }

  _close() {
    if (this._closing) return;
    this._closing = true;
    SFX.uiClick();
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  _heal() {
    const p = this._player();
    if (!p) return;
    // hpMax, not PLAYER.hp — ARMOR PLATING raises it per run.
    p.hp = p.hpMax;
    this.gs.events.emit('player-hp-changed');
    SFX.uiClick();
  }

  _give(id) {
    const p = this._player();
    if (!p) return;
    p.equipSecondary(id);   // emits secondary-equipped + secondary-ammo-changed
  }

  _refillAmmo() {
    const p = this._player();
    if (!p) return;
    p.ammo = PLAYER.ammoMax;
    // Clearing the queue matters as much as setting the count: the HUD draws
    // reload pips straight off ammoTimers[0], so leaving it would show a
    // permanent reload-in-progress on a full magazine.
    p.ammoTimers = [];
    this.gs.events.emit('player-ammo-changed');
    SFX.uiClick();
  }

  _refillSecondary() {
    const p = this._player();
    if (!p || !p.secondary) return;
    const cfg = WEAPONS[p.secondary];
    p.secondaryAmmo = cfg.totalAmmo ?? cfg.charges ?? 0;
    this.gs.events.emit('secondary-ammo-changed');
    SFX.uiClick();
  }

  _fillSuper() {
    const p = this._player();
    if (!p) return;
    p.superCharge = PLAYER.superHitsToCharge;
    this.gs.events.emit('player-super-ready');
    SFX.uiClick();
  }

  _fillMelee() {
    const p = this._player();
    if (!p) return;
    p.meleeCharge = PLAYER.meleeHitsToCharge;
    this.gs.events.emit('player-melee-ready');
    SFX.uiClick();
  }

  _refillDash() {
    const p = this._player();
    if (!p) return;
    // No event: the dash gauge is polled every frame by the HUD.
    p.dashCharges = (PLAYER.dashChargesMax || 3) + (p.dashChargesBonus || 0);
    p.dashRechargeTimer = 0;
    SFX.uiClick();
  }

  _spawn(type, count) {
    const p = this._player();
    if (!p || !this.gs?.spawnEnemyAt) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.gs.spawnEnemyAt(type, p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320);
    }
    SFX.uiClick();
  }

  // ── Bosses ───────────────────────────────────────────────────────────────

  /**
   * Refresh the labels that read live scene state.
   *
   * Guarded on the scene still running: the spawn buttons close the panel, and
   * `_close()` stops the scene and destroys its Text objects. Touching one
   * afterwards throws inside Phaser's texture code ("cannot read drawImage"),
   * which reads as a rendering fault rather than as a dead label.
   */
  _syncLabels() {
    if (!this.scene.isActive()) return;
    this.sectorBtn?.label?.setText(this._sectorLabel());
    this.arenaBtn?.label?.setText(this._arenaLabel());
    this.vaderBtn?.label?.setText(this._vaderLabel());
    this.loadBtn?.label?.setText(this._loadoutLabel());
  }

  /**
   * Empty the arena and STOP it, so a boss test is a boss test.
   *
   * `_clearField` on its own was not enough: the wave spawner keeps running, so
   * the room refills within seconds and Vader arrives into a crowd. The player
   * reported exactly this — "I tried clearing level wave but it should stop the
   * level so I can spawn darth Vader". Killing the enemies without killing the
   * SPAWNER is treating the symptom.
   *
   * Also clears live bullets: a volley already in the air outlives the enemy
   * that fired it and lands on you a second into the duel, which looks like the
   * boss doing something it did not.
   */
  _isolate() {
    if (!this.gs) return;
    this.gs.arenaActive = false;              // stop the wave spawner
    this.gs._wavePhase = 'breather';
    this._clearField();
    this.gs.enemyBullets?.getChildren().forEach((b) => b.kill?.());
    this.gs.deflectedBullets?.getChildren().forEach((b) => b.kill?.());
    this.gs.bossSuperOrbs?.getChildren().forEach((b) => b.kill?.());
    this.gs.playerBullets?.getChildren().forEach((b) => b.kill?.());
    this.gs.clearTelegraphs?.();
    const p = this._player();
    if (p) { p.alive = true; p.hp = p.hpMax; this.gs.events.emit('player-hp-changed'); }
  }

  /**
   * Spawn the sector's nemesis on demand.
   *
   * RANDOM goes through the live `nemesis` stream, so it is the encounter the
   * run would actually have produced. A named loadout forces the traits with a
   * throwaway generator instead — forcing them through the run's stream would
   * consume draws and desync every later encounter from its seed, which would
   * make the debug menu itself a source of irreproducibility.
   */
  _spawnNemesis() {
    if (!this.gs?._spawnMiniBoss) return;
    this._isolate();
    const lo = LOADOUTS[this._loadout];
    const sector = this.gs.sector || 1;
    const nem = lo.traits
      ? rollNemesis(sector, { traits: lo.traits, rng: makeRng(Date.now() & 0xffff) })
      : rollNemesis(sector, { rng: this.gs.rng.nemesis });
    this.gs._spawnMiniBoss(nem);
    this._close();          // you asked to see it, not to read about it
  }

  /**
   * Vader at any rung of his ladder, without playing to it.
   *
   * `spawnBoss` derives which encounter he is from `sector`, so setting the
   * sector IS choosing the encounter — his hp, his intake cap and which
   * mechanics he has all follow from that one number.
   */
  _spawnVader() {
    if (!this.gs?.spawnBoss) return;
    const p = this._player();
    if (!p) return;
    if (this.gs.boss?.alive) this.gs.boss.retreat?.();
    this._isolate();
    this.gs.sector = this._vaderN * ENDLESS.bossEvery;
    this._syncLabels();
    // Encounter passed explicitly, not left to be derived from `sector`:
    // outside an endless run that derivation is skipped entirely and you get a
    // base-hp Vader with no mechanics — a boss-testing tool that hands back the
    // wrong boss is worse than none.
    this.gs.spawnBoss(p.x + 340, p.y, { encounter: this._vaderN });
    this._close();
  }

  /**
   * Load the boss arena, and nothing else.
   *
   * The room is RESOLVED from `ROOMS` by its own `boss` flag rather than by
   * index — `ROOMS[3]` is true today and is one reordering away from being a
   * debug button that loads the detention block. `_transitionToNext` resolves
   * it the same way for the real endless climb.
   *
   * Goes through `GameScene.loadRoom`, which is the authoritative entry point
   * and the same one the exit door uses, so what lands is the production room:
   * the player at its spawn, its arena survival round started, its banner. No
   * boss is spawned here — that is SPAWN VADER's job and it stays SPAWN
   * VADER's job. `_spawnVader` calls `_isolate()`, so pressing the two in
   * sequence sweeps the survival wave on its own.
   */
  _loadBossRoom() { this._loadArena((r) => r.boss); }

  /** The third styled arena — REACTOR JUNCTION, `ROOMS[1]`, id `corridor`. */
  _loadJunction() { this._loadArena((r) => r.id === 'corridor'); }

  /** The fourth — DETENTION BLOCK, id `detention`. */
  _loadDetention() { this._loadArena((r) => r.id === 'detention'); }

  /**
   * One loader behind both buttons, so a third arena costs a predicate rather
   * than a copy of this method.
   */
  _loadArena(find) {
    const spec = ROOMS.find(find);
    if (!this.gs?.loadRoom || !spec) return;
    this.gs.loadRoom(spec);
    this._close();
  }

  /**
   * Make every nemesis on the field cast its next move right now.
   *
   * Move clocks run at 7-10 seconds. Waiting one out to look at a single
   * telegraph is exactly the loop this whole group exists to shorten, and a
   * telegraph is ~800ms of animation you often want to see twice in a row.
   */
  _forceMove() {
    if (!this.gs?._castNemesisMove) return;
    let cast = 0;
    for (const e of this.gs.enemies.getChildren()) {
      if (e.alive && e._moveIds?.length) { this.gs._castNemesisMove(e); cast++; }
    }
    SFX.uiClick();
    if (cast) this._close();      // the telegraph is the thing to look at
  }

  // Jump the difficulty ramp. Steps rather than +1 so the interesting points
  // (early, mid, deep) are two taps apart instead of thirty.
  _cycleSector() {
    if (!this.gs) return;
    const STEPS = [1, 6, 12, 20, 30, 45];
    const cur = this.gs.sector || 1;
    const next = STEPS.find((s) => s > cur) ?? STEPS[0];
    this.gs.sector = next;
    // Re-derive the per-enemy multipliers, or the new sector is a label with no
    // effect on anything that spawns afterwards.
    this.gs._applySectorScaling?.(this.gs.roomSpec);
    this.gs.events.emit('sector-changed', next);
    SFX.uiClick();
  }

  // Everything gone, including a boss mid-retreat. Unlike CLEAR WAVE this does
  // NOT route through damage(): scoring a debug-spawned Vader would poison the
  // run's score, and the point here is to reset the field, not to win.
  _clearField() {
    if (!this.gs) return;
    this.gs.enemies.getChildren().slice().forEach((e) => this.gs._destroyEnemyFully(e));
    const b = this.gs.boss;
    if (b) {
      b.hpBar?.destroy(); b.shadow?.destroy();
      b.weaponSprite?.destroy(); b.threatRing?.destroy();
      b._attachments?.forEach((a) => a?.destroy?.());
      b.destroy();
      this.gs.boss = null;
    }
    SFX.uiClick();
  }

  _clearWave() {
    if (!this.gs) return;
    // Stop the spawner as well. Clearing a field that instantly refills is not
    // clearing it, which is what "I tried clearing level wave" ran into.
    this.gs.arenaActive = false;
    // Kill through the normal damage path rather than destroying the sprites.
    // RoomManager.aliveEnemies is only decremented by onEnemyDied(), which a
    // direct teardown skips — that would drift it out of step with the arena's
    // own _livingEnemyCount() and strand the wave state machine.
    this.gs.enemies.getChildren().forEach((e) => {
      if (e.active && e.alive) e.damage(999999);
    });
    if (this.gs.boss?.alive) this.gs.boss.damage(999999);
    SFX.uiClick();
  }

  _skipWave() {
    if (!this.gs?._startWave) return;
    this._clearWave();
    // Same jump the breather branch of _tickArena makes, so wave bookkeeping
    // stays on the rails.
    this.gs._startWave((this.gs._waveIdx ?? 0) + 1);
  }

  // Imperial-console button, from PauseScene. Copied rather than shared: it is
  // 30 lines with no dependencies, and PauseScene is a hot path for the real
  // menu that a debug screen should not be able to break.
  _button(cx, cy, text, onClick, btnW = 420) {
    const btnH = 52;
    const bg = this.add.graphics();
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.55);
      bg.fillRoundedRect(cx - btnW / 2 + 4, cy - btnH / 2 + 5, btnW, btnH, 6);
      bg.fillStyle(hover ? 0x2e3038 : 0x14161c, 1);
      bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 6);
      bg.lineStyle(3, hover ? 0xffb040 : 0xa05000, 1);
      bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 6);
      bg.fillStyle(hover ? 0xffb040 : 0xa05000, 0.22);
      bg.fillRoundedRect(cx - btnW / 2 + 6, cy - btnH / 2 + 6, btnW - 12, 8, 4);
    };
    draw(false);

    const label = this.add.text(cx, cy, text, {
      fontFamily: FONTS.display,
      fontSize: '20px', fontStyle: 'bold',
      color: '#ffd0a0', stroke: '#000000', strokeThickness: 4, letterSpacing: 2,
    }).setOrigin(0.5);

    const zone = this.add.zone(cx, cy, btnW, btnH).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => draw(true));
    zone.on('pointerup', onClick);

    return { bg, label, zone };
  }
}
