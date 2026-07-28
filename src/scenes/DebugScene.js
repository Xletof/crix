import Phaser from 'phaser';
import { VIEW, FONTS, PLAYER, WEAPONS } from '../config.js';
import { SFX } from '../systems/FX.js';
import { isGodMode, setGodMode } from '../systems/debug.js';

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

    // Sized to the content: four groups + CLOSE bottom out around y=745 against
    // a card top of ~38.
    const cardW = 620, cardH = 740;
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
    this._button(cx, y, 'REFILL DASH', () => this._refillDash(), 280);
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
    y += row + 12;

    this._button(cx, y, 'CLOSE', () => this._close(), 420);

    this.input.keyboard?.on('keydown-ESC', () => this._close());
  }

  _godLabel() { return isGodMode() ? 'GOD: ON' : 'GOD: OFF'; }
  _typeLabel(types) { return types[this._spawnType].toUpperCase(); }

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

  _clearWave() {
    if (!this.gs) return;
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
