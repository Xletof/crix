import Phaser from 'phaser';
import { VIEW, PLAYER, WEAPONS, COLORS, HUDCFG, FONTS } from '../config.js';
import { Joystick } from './Joystick.js';
import { SuperButton } from './SuperButton.js';
import { DashButton } from './DashButton.js';
import { HackMinigame } from './HackMinigame.js';
import { ROOMS } from '../data/rooms.js';
import { SFX } from './FX.js';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create({ game }) {
    this.gameScene = game;
    this.cameras.main.setRoundPixels(true);

    // ── Low-HP red vignette overlay (sits BEHIND the chrome panels) ─────
    // Sub-30% HP starts a soft pulsing red edge glow that intensifies as
    // the player's HP drops toward zero. Drawn as feathered edge bars.
    this.vignette = this.add.graphics().setDepth(8);

    // ── Directional hit indicator arcs along the screen edge ─────────────
    this.hitArcGfx = this.add.graphics().setDepth(35);
    this._hitArcs  = []; // { angle: rad, age: ms }

    // ── Off-screen threat chevrons ───────────────────────────────────────
    // Edge-pinned arrows pointing at enemies and fast incoming projectiles
    // that are outside the narrow portrait viewport. Sits just under the hit
    // arcs so a hit flash reads on top of the ambient threat markers.
    this.chevronGfx = this.add.graphics().setDepth(34);

    // ── Boss enrage tint: subtle red ambient overlay when boss is in
    // phase 2 or 3. Sits below the vignette so low-HP still dominates.
    this.bossTint = this.add.graphics().setDepth(6);
    this._bossPhase = 1;

    // ── Imperial top bar ────────────────────────────────────────────────
    const top = this.add.graphics();
    // Dark metal base
    top.fillStyle(0x0a0c14, 0.88);
    top.fillRect(0, 0, VIEW.width, 84);
    // Blue LED strip bottom (Imperial)
    top.fillStyle(0x0038bb, 0.8);
    top.fillRect(0, 80, VIEW.width, 3);
    // Subtle top edge sheen
    top.fillStyle(0x2e3038, 0.5);
    top.fillRect(0, 0, VIEW.width, 2);
    // Side accent lines
    top.fillStyle(0x1e2028, 1);
    top.fillRect(0, 0, 2, 84);
    top.fillRect(VIEW.width - 2, 0, 2, 84);

    // HP bar (bacta blue theme)
    this.hpBack = this.add.graphics();
    this.hpFront = this.add.graphics();
    this.hpText = this.add
      .text(VIEW.width / 2, 30, '', {
        fontFamily: FONTS.body,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#90d8ff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Chamber label (right) — e.g. "HANGAR BAY  CHAMBER 1/4"
    this.chamberText = this.add
      .text(VIEW.width - 20, 10, '', {
        fontFamily: FONTS.body,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ff2828',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(1, 0);

    // Objective readout (under the chamber label, top-right)
    this.objText = this.add
      .text(VIEW.width - 20, 32, '', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffd040',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0);

    // Room-modifier label (persistent while a modifier is active, top-right).
    this.modifierText = this.add
      .text(VIEW.width - 20, 54, '', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ff5030',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0);

    // Hack progress bar (center, only while actively slicing)
    this.hackBarGfx = this.add.graphics().setDepth(12);
    this.hackBarText = this.add.text(VIEW.width / 2, VIEW.height * 0.46 - 22, ' ', {
      fontFamily: FONTS.body,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffd040',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    // Lives — saber icons top-left
    this.livesGfx = this.add.graphics();
    this.drawLives(3);

    // Survival Timer text (top center, below HP bar)
    this.timerText = this.add.text(VIEW.width / 2, 60, '', {
      fontFamily: FONTS.body,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffaa30',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Kill counter (left of the timer) — run-wide tally
    this.killText = this.add.text(VIEW.width / 2 - 170, 60, '', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ff5050',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Next-surge ticker (right of the timer) — pulses red when imminent
    this.surgeText = this.add.text(VIEW.width / 2 + 175, 60, '', {
      fontFamily: FONTS.body,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ff8040',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Banner (center, transient)
    this.banner = this.add
      .text(VIEW.width / 2, VIEW.height * 0.32, ' ', {
        fontFamily: FONTS.display,
        fontSize: '60px',
        fontStyle: 'bold',
        color: '#ff2828',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setResolution(2);

    // Energy cell ammo pips (above right joystick)
    this.ammoPips = [];
    const ammoY = VIEW.height - HUDCFG.joystickBottom - HUDCFG.joystickRadius * 2 - 50;
    const ammoCx = VIEW.width - HUDCFG.joystickMargin - HUDCFG.joystickRadius;
    const pipSpacing = 28;
    for (let i = 0; i < PLAYER.ammoMax; i++) {
      const pip = this.add.graphics();
      pip.x = ammoCx + (i - (PLAYER.ammoMax - 1) / 2) * pipSpacing;
      pip.y = ammoY;
      this.ammoPips.push(pip);
    }

    // Secondary weapon display (left side, above left joystick)
    const secX = HUDCFG.joystickMargin + HUDCFG.joystickRadius;
    const secY = VIEW.height - HUDCFG.joystickBottom - HUDCFG.joystickRadius * 2 - 60;
    this.secGfx = this.add.graphics();
    this.secIcon = this.add.image(secX, secY, 'pickup-rifle').setDepth(5).setScale(0.7).setVisible(false);
    this.secText = this.add.text(secX, secY + 42, ' ', {
      fontFamily: FONTS.body,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffaa40',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);

    // Super button (lightsaber hilt) — big and inside the right-thumb arc.
    // Tap auto-aims + fires; drag to aim manually.
    const superY = VIEW.height - HUDCFG.joystickBottom - 260;
    const superX = VIEW.width - HUDCFG.joystickMargin - 150;
    this.superButton = new SuperButton(this, {
      x: superX,
      y: superY,
      radius: 58,
      joystick: this.joystickRight,
      onAim: (v) => this.gameScene?.player?.setSuperAimInput(v),
      onRelease: (v) => this.gameScene?.player?.releaseSuperAim(v),
      isReady: () =>
        !!this.gameScene?.player &&
        this.gameScene.player.superCharge >= PLAYER.superHitsToCharge,
    });

    // Dash button (chevrons pointing right >>) — thumb-arc diagonal below super
    const dashY = superY + 118;
    const dashX = superX - 118;
    this.dashButton = new DashButton(this, {
      x: dashX,
      y: dashY,
      radius: 56,
      onPress: () => {
        const p = this.gameScene?.player;
        if (p?.alive) {
          p.tryDash();
        }
      },
      isReady: () => {
        const p = this.gameScene?.player;
        return !!p?.alive && p.dashCharges > 0 && !p.isDashing;
      }
    });

    // Combo multiplier text (above Super button)
    this.multText = this.add.text(superX, superY - 78, ' ', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffd040',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);

    // Pause button — top-right play-area corner (right half, excluded from the
    // fire stick's claim region so tapping it never starts an aim drag).
    this._buildPauseButton();

    // Joysticks
    this.moveStick = new Joystick(this, 'left', {
      onMove: (v) => this.gameScene?.player?.setMoveInput(v),
      onEnd: () => this.gameScene?.player?.setMoveInput({ x: 0, y: 0, force: 0 }),
    });
    this.fireStick = new Joystick(this, 'right', {
      shouldClaim: (pointer) => {
        // Don't claim the pointer if the user is interacting with the
        // hack mini-game or the super button — keeps fire input from
        // leaking into other UI.
        if (this.hackMinigame && this.hackMinigame.state !== 'idle') return false;
        return !this.superButton.containsPoint(pointer.x, pointer.y)
          && !this.dashButton.containsPoint(pointer.x, pointer.y)
          && !this._overPauseBtn(pointer.x, pointer.y);
      },
      onStart: () => this.gameScene?.player?.setAimInput({ x: 0, y: 0, force: 0 }),
      onMove: (v) => {
        if (this.hackMinigame && this.hackMinigame.state !== 'idle') return;
        this.gameScene?.player?.setAimInput(v);
      },
      onEnd: (v) => {
        if (this.hackMinigame && this.hackMinigame.state !== 'idle') return;
        this.gameScene?.player?.releaseAim(v);
      },
    });

    // ── Contextual TAKEDOWN button (stealth) ───────────────────────────────
    // Fades in when the player is positioned behind an unalerted enemy.
    const tdX = VIEW.width / 2;
    const tdY = VIEW.height - 320;
    this.takedownBtn = this.add.container(tdX, tdY).setDepth(30).setAlpha(0);
    const tdBg = this.add.graphics();
    tdBg.fillStyle(0x062814, 0.85);
    tdBg.fillCircle(0, 0, 50);
    tdBg.lineStyle(3, 0x40ff80, 0.95);
    tdBg.strokeCircle(0, 0, 50);
    tdBg.lineStyle(2, 0x80ffaa, 0.5);
    tdBg.strokeCircle(0, 0, 44);
    // Knife glyph
    tdBg.fillStyle(0xd0ffe0, 1);
    tdBg.fillTriangle(-3, -22, 3, -22, 0, -4);
    tdBg.fillRect(-2, -4, 4, 16);
    tdBg.fillStyle(0x40ff80, 1);
    tdBg.fillRect(-7, 10, 14, 4);
    const tdLabel = this.add.text(0, 28, 'TAKEDOWN', {
      fontFamily: FONTS.body,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#80ffaa',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.takedownBtn.add([tdBg, tdLabel]);
    this._takedownReady = false;
    this.takedownZone = this.add.zone(tdX, tdY, 110, 110).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.takedownZone.on('pointerdown', () => {
      if (this._takedownReady) this.gameScene?.performTakedown();
    });
    this.input.keyboard?.on('keydown-Q', () => {
      if (this._takedownReady) this.gameScene?.performTakedown();
    });

    // ── Contextual HACK button (mirrors the takedown button, amber) ────────
    // Fades in when the player is standing on a hackable terminal. Tap = start
    // the slicing mini-game. The terminal does NOT auto-open the puzzle.
    const hkX = VIEW.width / 2;
    const hkY = VIEW.height - 320;
    this.hackBtn = this.add.container(hkX, hkY).setDepth(30).setAlpha(0);
    const hkBg = this.add.graphics();
    hkBg.fillStyle(0x2a1800, 0.85);
    hkBg.fillCircle(0, 0, 50);
    hkBg.lineStyle(3, 0xffaa30, 0.95);
    hkBg.strokeCircle(0, 0, 50);
    hkBg.lineStyle(2, 0xffd060, 0.5);
    hkBg.strokeCircle(0, 0, 44);
    // Terminal glyph (mini bars on a screen)
    hkBg.fillStyle(0xffd060, 1);
    hkBg.fillRect(-14, -16, 28, 18);
    hkBg.fillStyle(0x2a1800, 1);
    hkBg.fillRect(-12, -14, 24, 14);
    hkBg.fillStyle(0xffd060, 1);
    hkBg.fillRect(-10, -12, 14, 2);
    hkBg.fillRect(-10, -9,  20, 2);
    hkBg.fillRect(-10, -6,  10, 2);
    hkBg.fillStyle(0x80ffaa, 1);
    hkBg.fillRect(-6, 4, 12, 4);  // green base LED
    const hkLabel = this.add.text(0, 28, 'HACK', {
      fontFamily: FONTS.body,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffd060',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.hackBtn.add([hkBg, hkLabel]);
    this._hackReady = false;
    this.hackZone = this.add.zone(hkX, hkY, 110, 110).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.hackZone.on('pointerdown', () => {
      if (this._hackReady) this.gameScene?.requestHack();
    });
    this.input.keyboard?.on('keydown-E', () => {
      if (this._hackReady) this.gameScene?.requestHack();
    });



    // Events
    const ge = this.gameScene.events;
    ge.on('player-hp-changed',    this.refreshHp,    this);
    this._onPlayerHurt = (amt, dir) => { this.refreshHp(); if (typeof dir === 'number') this._addHitArc(dir); };
    ge.on('player-hurt',          this._onPlayerHurt);
    ge.on('player-ammo-changed',  this.refreshAmmo,  this);
    ge.on('player-fire',          this.refreshAmmo,  this);
    ge.on('player-super-changed', this.refreshSuper, this);
    ge.on('player-super-ready',   this.refreshSuper, this);
    this._onMultChanged = (mult, streak) => {
      if (streak > 0) {
        this.multText.setText(`COMBO x${mult.toFixed(1)}`);
        this.multText.setAlpha(1);
        if (mult > 1.0) {
          this.multText.setColor('#ff4040');
          this.tweens.killTweensOf(this.multText);
          this.multText.setScale(1.2);
          this.tweens.add({
            targets: this.multText,
            scale: 1,
            duration: 150,
            ease: 'Back.easeOut'
          });
        } else {
          this.multText.setColor('#ffd040');
        }
      } else {
        this.tweens.killTweensOf(this.multText);
        this.tweens.add({
          targets: this.multText,
          alpha: 0,
          duration: 300
        });
      }
    };
    ge.on('player-mult-changed',  this._onMultChanged);
    ge.on('room-start',           (n, total, spec) => this.refreshChamber(n, total, spec));
    ge.on('boss-start',           ()               => this.showBanner('VADER APPROACHES', '#ff2828'));
    ge.on('boss-phase',           (phase)          => { this._bossPhase = phase; this.showBanner('ENRAGED!', '#ff8888'); });
    ge.on('boss-died',            ()               => { this._bossPhase = 1; });
    ge.on('show-banner',          (text, color)    => this.showBanner(text, color));
    ge.on('lives-changed',        (n)              => this.drawLives(n));
    ge.on('secondary-equipped',     (id)           => this.refreshSecondary(id));
    ge.on('secondary-ammo-changed', ()             => this.refreshSecondary());
    ge.on('takedown-available',     (avail)        => this.setTakedownVisible(avail));
    ge.on('objective-update',       (done, total)  => this.refreshObjective(done, total));
    ge.on('wave-update',            (n, total)     => this.refreshWave(n, total));
    ge.on('kills-update',           (n)            => this.refreshKills(n));
    ge.on('wave-remaining',         (k)            => this.refreshWaveRemaining(k));
    ge.on('modifier-active',        (name, color)  => this.refreshModifier(name, color));
    ge.on('set-darkness',           (on)           => this.setDarkness(on));
    ge.on('hack-prompt',            (avail)        => this.setHackVisible(avail));
    ge.on('show-combo',             (n)            => this.showCombo(n));
    ge.on('hack-start',             (terminal)     => {
      this.setHackVisible(false);
      this.hackMinigame?.start(terminal);
    });
    ge.on('hack-cancel',            ()             => this.hackMinigame?.cancel());

    // Spin up the slicing mini-game (hidden until hack-start fires)
    this.hackMinigame = new HackMinigame(this);

    this.events.on('shutdown', () => {
      ge.off('player-hp-changed',    this.refreshHp,    this);
      ge.off('player-hurt',          this._onPlayerHurt);
      ge.off('player-ammo-changed',  this.refreshAmmo,  this);
      ge.off('player-fire',          this.refreshAmmo,  this);
      ge.off('player-super-changed', this.refreshSuper, this);
      ge.off('player-super-ready',   this.refreshSuper, this);
      ge.off('player-mult-changed',  this._onMultChanged);
      ge.off('room-start');
      ge.off('boss-start');
      ge.off('boss-phase');
      ge.off('show-banner');
      ge.off('lives-changed');
      ge.off('secondary-equipped');
      ge.off('secondary-ammo-changed');
      ge.off('takedown-available');
      ge.off('objective-update');
      ge.off('wave-update');
      ge.off('kills-update');
      ge.off('wave-remaining');
      ge.off('modifier-active');
      ge.off('set-darkness');
      ge.off('hack-prompt');
      ge.off('hack-start');
      ge.off('hack-cancel');
      ge.off('show-combo');
      this.comboText = null;
      this.darknessOverlay?.destroy();
      this.darknessOverlay = null;
      this.hackMinigame?.shutdown();
      this.hackMinigame = null;
      this.moveStick?.shutdown();
      this.fireStick?.shutdown();
      this.superButton?.shutdown();
      this.dashButton?.shutdown();
    });

    this.refreshHp();
    this.refreshAmmo();
    this.refreshSuper();
    this.refreshKills(this.gameScene?.runKills ?? 0);
    this.refreshChamber(1, ROOMS.length, ROOMS[0]);
  }

  refreshHp() {
    const p = this.gameScene.player;
    if (!p) return;
    const ratio = Math.max(0, Math.min(1, p.hp / p.hpMax));
    const w = 380, h = 20;
    const x = (VIEW.width - w) / 2, y = 22;
    this.hpBack.clear();
    this.hpBack.fillStyle(0x000000, 0.7);
    this.hpBack.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
    this.hpBack.fillStyle(COLORS.hpBack, 1);
    this.hpBack.fillRoundedRect(x, y, w, h, 3);
    this.hpFront.clear();
    const col = ratio > 0.35 ? COLORS.hpFront : COLORS.hpLow;
    this.hpFront.fillStyle(col, 1);
    this.hpFront.fillRoundedRect(x, y, w * ratio, h, 3);
    // Segment lines (Imperial style)
    this.hpFront.fillStyle(0x000000, 0.4);
    for (let i = 1; i < 10; i++) {
      this.hpFront.fillRect(x + (w / 10) * i - 1, y, 2, h);
    }
    this.hpText.setText(`${Math.ceil(p.hp)} / ${p.hpMax}`);
  }

  refreshAmmo() {
    const p = this.gameScene.player;
    if (!p) return;
    // Draw each ammo slot as an Imperial energy cell (rectangular, glowing red)
    if (!this._ammoPipPrevLoaded) this._ammoPipPrevLoaded = [];
    for (let i = 0; i < this.ammoPips.length; i++) {
      const pip = this.ammoPips[i];
      pip.clear();
      const loaded = i < p.ammo;
      const reloading = !loaded && i === p.ammo && p.ammoTimers.length > 0;
      // Detect the moment a reload completes (was unloaded, now loaded)
      const wasLoaded = this._ammoPipPrevLoaded[i] || false;
      if (loaded && !wasLoaded) this._pulseAmmoPip(pip);
      this._ammoPipPrevLoaded[i] = loaded;

      // Cell casing (dark border)
      pip.fillStyle(0x0a0c14, 0.9);
      pip.fillRoundedRect(-6, -13, 12, 26, 2);
      pip.lineStyle(1.5, 0x2e3038, 0.9);
      pip.strokeRoundedRect(-6, -13, 12, 26, 2);

      if (loaded) {
        // Charged energy cell — red glow
        pip.fillStyle(0xaa0000, 1);
        pip.fillRect(-4, -10, 8, 20);
        pip.fillStyle(COLORS.ammoOn, 1);   // bright red core
        pip.fillRect(-3, -9, 6, 18);
        // Bright center line
        pip.fillStyle(0xff8888, 0.8);
        pip.fillRect(-1, -8, 2, 16);
        // Top cap glow
        pip.fillStyle(0xff4444, 0.9);
        pip.fillRect(-4, -12, 8, 3);
      } else if (reloading) {
        const max = PLAYER.ammoReloadMs;
        const t = Math.max(0, max - p.ammoTimers[0]);
        const r = t / max;
        // Charging animation
        pip.fillStyle(0x220000, 1);
        pip.fillRect(-4, -10, 8, 20);
        const filled = Math.round(20 * r);
        pip.fillStyle(0xaa0000, 0.7);
        pip.fillRect(-4, 10 - filled, 8, filled);
        // Pulse shimmer
        pip.fillStyle(0xff2020, 0.4);
        pip.fillRect(-2, 10 - filled, 4, 2);
      } else {
        // Depleted cell
        pip.fillStyle(0x0e1018, 1);
        pip.fillRect(-4, -10, 8, 20);
        pip.fillStyle(0x1e2028, 0.5);
        pip.fillRect(-3, -9, 6, 18);
      }
    }
  }

  // ── Pause button ───────────────────────────────────────────────────────
  _buildPauseButton() {
    const r = 30;
    const x = VIEW.width - 44, y = 120;
    this._pauseBtn = { x, y, r };
    const g = this.add.graphics().setDepth(46);
    g.fillStyle(0x000000, 0.5); g.fillCircle(x + 2, y + 3, r);
    g.fillStyle(0x14161c, 0.92); g.fillCircle(x, y, r);
    g.lineStyle(3, 0x0050cc, 1); g.strokeCircle(x, y, r);
    // "II" pause glyph
    g.fillStyle(0x90d8ff, 1);
    g.fillRect(x - 9, y - 11, 6, 22);
    g.fillRect(x + 3, y - 11, 6, 22);
    const zone = this.add.zone(x, y, r * 2, r * 2).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this._openPause());
    this.pauseGfx = g;
    this.pauseZone = zone;

    // On resume, hard-reset the sticks: any pointer held across the pause never
    // delivered its pointerup to the paused scene, so clear state to avoid a
    // stuck joystick, and zero the player's move/aim input.
    this.events.on('resume', () => {
      this.moveStick?.forceRelease();
      this.fireStick?.forceRelease();
      this.superButton?.forceRelease();
      const p = this.gameScene?.player;
      if (p) {
        p.setMoveInput({ x: 0, y: 0, force: 0 });
        p.setAimInput({ x: 0, y: 0, force: 0 });
      }
    });
  }

  _overPauseBtn(px, py) {
    const b = this._pauseBtn;
    if (!b) return false;
    return Math.hypot(px - b.x, py - b.y) <= b.r;
  }

  _openPause() {
    if (!this.gameScene) return;
    SFX.uiClick();
    // Launch the overlay first, then freeze Game + HUD. The paused scenes stop
    // processing input, so the joysticks can't be left mid-drag.
    this.scene.launch('Pause', { game: this.gameScene });
    this.scene.pause('Game');
    this.scene.pause('HUD');
  }

  refreshSuper() {
    const p = this.gameScene.player;
    if (!p) return;
    const ready = p.superCharge >= PLAYER.superHitsToCharge;
    this.superButton.setReady(ready);
    this.superButton.drawGauge(p.superCharge, PLAYER.superHitsToCharge);
    // Brief scale pop on the super button each time the meter ticks up, so
    // the charge feeding from normal-shot hits reads on the HUD.
    if (p.superCharge > (this._superPrevCharge || 0)) {
      const img = this.superButton.image;
      this.tweens.killTweensOf(img);
      img.setScale(1.18);
      this.tweens.add({ targets: img, scale: 1, duration: 140, ease: 'Back.easeOut' });
    }
    this._superPrevCharge = p.superCharge;
  }

  refreshChamber(n, total, spec) {
    if (this.gameScene?.mode === 'endless') {
      this.chamberText.setText(`SECTOR ${this.gameScene.sector}`);
      return;
    }
    const name = spec?.name ?? '';
    this.chamberText.setText(`${name}   CHAMBER ${n}/${total}`);
  }

  drawLives(n) {
    const g = this.livesGfx;
    g.clear();
    // Three small saber-hilt icons top-left
    const startX = 16;
    const y      = 16;
    const gap    = 28;
    for (let i = 0; i < 3; i++) {
      const lit = i < n;
      const x = startX + i * gap;
      // Hilt body
      g.fillStyle(lit ? 0x888898 : 0x2e3038, 1);
      g.fillRect(x, y, 8, 18);
      // Blade
      g.fillStyle(lit ? 0xff2828 : 0x220010, 1);
      g.fillRect(x + 2, y - 22, 4, 22);
      // Blade glow
      if (lit) {
        g.fillStyle(0xff8080, 0.4);
        g.fillRect(x + 1, y - 22, 6, 22);
      }
      // Guard
      g.fillStyle(lit ? 0xaaaacc : 0x1e2028, 1);
      g.fillRect(x - 3, y, 14, 4);
    }
  }

  refreshSecondary(weaponId) {
    const p  = this.gameScene?.player;
    const id = weaponId !== undefined ? weaponId : p?.secondary;
    const g  = this.secGfx;
    g.clear();

    if (!id) {
      this.secIcon.setVisible(false);
      this.secText.setText('');
      return;
    }

    const ICON = { rifle: 'pickup-rifle', detonator: 'pickup-det' };
    const NAMES = { rifle: 'DC-15', detonator: 'DET.' };
    const COLS  = { rifle: 0xff8010, detonator: 0xff2020 };

    const ammo  = p?.secondaryAmmo ?? 0;
    const col   = COLS[id] ?? 0xffaa40;
    const cx    = HUDCFG.joystickMargin + HUDCFG.joystickRadius;
    const cy    = VIEW.height - HUDCFG.joystickBottom - HUDCFG.joystickRadius * 2 - 60;

    // Background panel
    g.fillStyle(0x0a0c14, 0.75);
    g.fillRoundedRect(cx - 50, cy - 50, 100, 90, 6);
    g.lineStyle(2, col, 0.7);
    g.strokeRoundedRect(cx - 50, cy - 50, 100, 90, 6);

    this.secIcon.setTexture(ICON[id] ?? 'pickup-rifle').setVisible(true);
    this.secIcon.setPosition(cx, cy - 14);

    // Ammo bar / counter
    const maxAmmo = id === 'rifle' ? 27 : 3;
    const ratio   = Math.max(0, ammo / maxAmmo);
    g.fillStyle(0x1a1c22, 1);
    g.fillRoundedRect(cx - 38, cy + 26, 76, 8, 3);
    g.fillStyle(col, 1);
    g.fillRoundedRect(cx - 38, cy + 26, 76 * ratio, 8, 3);

    const label = id === 'rifle' ? `${ammo}` : `×${ammo}`;
    this.secText.setText(`${NAMES[id]}  ${label}`);
    this.secText.setPosition(cx, cy + 44);
  }

  update(time, delta) {
    const p = this.gameScene?.player;
    if (p && p.ammoTimers.length > 0) {
      this.refreshAmmo();
    }
    // HP Regeneration visual pulse on health bar
    if (p && p.alive && p.isRegenerating) {
      this.refreshHp();
      const pulse = 1.0 + Math.sin(time * 0.008) * 0.04;
      this.hpText.setScale(pulse);
      this.hpText.setColor('#c0f0ff'); // bright cyan text for healing feedback
    } else if (this.hpText) {
      this.hpText.setScale(1.0);
      this.hpText.setColor('#90d8ff'); // default hpText color
    }

    // Tick the timing-puzzle mini-game (no-op when idle)
    this.hackMinigame?.update(delta);
    // Update dash button loading gauge
    if (p && p.alive && this.dashButton) {
      const rechargeRatio = p.dashCharges < PLAYER.dashChargesMax ? p.dashRechargeTimer / PLAYER.dashRechargeMs : 0;
      this.dashButton.drawGauge(p.dashCharges, PLAYER.dashChargesMax, rechargeRatio);
    }
    // Low-HP red vignette pulse
    this._drawVignette(time);
    // Boss enrage ambient red tint
    this._drawBossTint(time);
    // Directional hit arcs
    this._drawHitArcs(delta);
    // Off-screen threat chevrons
    this._drawThreatChevrons();
  }

  _addHitArc(hitDirRad) {
    // hitDirRad is FROM attacker TOWARD player (knockback dir).
    // Indicator faces toward the attacker = opposite direction.
    this._hitArcs.push({ angle: hitDirRad + Math.PI, age: 0 });
    // Cap at 4 simultaneous arcs to avoid overdraw
    if (this._hitArcs.length > 4) this._hitArcs.shift();
  }

  _drawHitArcs(delta) {
    const DURATION = 750;
    const g = this.hitArcGfx;
    g.clear();
    const cx = VIEW.width  / 2;
    const cy = VIEW.height / 2;
    this._hitArcs = this._hitArcs.filter(arc => {
      arc.age += delta;
      if (arc.age >= DURATION) return false;
      const t       = arc.age / DURATION;
      const alpha   = (1 - t) * (1 - t) * 0.90; // quadratic fade
      const ang     = arc.angle;
      // Edge radius in this direction (intersection of ray with screen rect)
      const absC    = Math.abs(Math.cos(ang));
      const absS    = Math.abs(Math.sin(ang));
      const R = (absC < 0.001 ? cy : absS < 0.001 ? cx : Math.min(cx / absC, cy / absS)) * 0.88;
      const SPAN    = 0.55; // ~63° total arc
      // Thick glow pass
      g.lineStyle(28, 0xff2020, alpha * 0.40);
      g.beginPath(); g.arc(cx, cy, R, ang - SPAN, ang + SPAN); g.strokePath();
      // Bright core pass
      g.lineStyle(10, 0xff5050, alpha);
      g.beginPath(); g.arc(cx, cy, R, ang - SPAN, ang + SPAN); g.strokePath();
      return true;
    });
  }

  // Edge-pinned arrows pointing at threats outside the viewport. Enemies (and
  // the boss) get a warm chevron; fast incoming projectiles get a sharper,
  // brighter one. Counts are capped and sorted by nearness so dense waves don't
  // flood the screen edge.
  _drawThreatChevrons() {
    const g  = this.chevronGfx;
    g.clear();
    const gs = this.gameScene;
    const p  = gs?.player;
    if (!p || !p.alive) return;
    const cam = gs.cameras.main;
    const vw  = cam.worldView;             // world rect currently on screen
    if (!vw || vw.width <= 0) return;
    const zoom = cam.zoom;
    const cx = VIEW.width  / 2;
    const cy = VIEW.height / 2;

    const MAX_ENEMY = 6;   // nearest N off-screen enemies
    const MAX_PROJ  = 4;   // nearest N off-screen incoming fast projectiles
    const FAST_PROJ = 600; // px/s — only genuinely fast rounds get a marker
    const MIND = 260, MAXD = 1500; // proximity ramp (world px)

    // world → screen (full-viewport camera, uniform zoom)
    const onScreen = (wx, wy) =>
      wx >= vw.x && wx <= vw.x + vw.width && wy >= vw.y && wy <= vw.y + vw.height;

    // Collect off-screen enemies (nearest first); the boss is handled
    // separately so it always gets a marker regardless of the enemy cap.
    const enemies = [];
    gs.enemies?.getChildren().forEach((e) => {
      if (!e.alive || onScreen(e.x, e.y)) return;
      enemies.push({ x: e.x, y: e.y, d: Math.hypot(e.x - p.x, e.y - p.y) });
    });
    enemies.sort((a, b) => a.d - b.d);
    const boss = gs.boss;
    const bossOff = boss && boss.active && boss.alive !== false && !onScreen(boss.x, boss.y);

    // Collect off-screen fast, incoming enemy projectiles, nearest first.
    const projs = [];
    gs.enemyBullets?.getChildren().forEach((b) => {
      if (!b.active || onScreen(b.x, b.y)) return;
      const vx = b.body?.velocity.x || 0, vy = b.body?.velocity.y || 0;
      if (Math.hypot(vx, vy) < FAST_PROJ) return;
      // incoming = moving toward the player (velocity dotted with bullet→player)
      if (vx * (p.x - b.x) + vy * (p.y - b.y) <= 0) return;
      projs.push({ x: b.x, y: b.y, d: Math.hypot(b.x - p.x, b.y - p.y) });
    });
    projs.sort((a, b) => a.d - b.d);

    const drawChevron = (wx, wy, coreColor, glowColor, boss) => {
      const ang = Math.atan2((wy - vw.y) * zoom - cy, (wx - vw.x) * zoom - cx);
      const absC = Math.abs(Math.cos(ang));
      const absS = Math.abs(Math.sin(ang));
      const R = (absC < 0.001 ? cy : absS < 0.001 ? cx : Math.min(cx / absC, cy / absS)) * 0.9;
      const px = cx + Math.cos(ang) * R;
      const py = cy + Math.sin(ang) * R;
      const d = Math.hypot(wx - p.x, wy - p.y);
      const prox = Math.max(0.35, Math.min(1, (MAXD - d) / (MAXD - MIND)));
      const s = (boss ? 1.5 : 1) * (0.7 + prox * 0.6);
      const alpha = 0.4 + prox * 0.55;
      const dcx = Math.cos(ang), dcy = Math.sin(ang);   // outward
      const pcx = -dcy, pcy = dcx;                       // perpendicular
      const hh = 20 * s, hw = 13 * s;
      const tip = [px + dcx * hh, py + dcy * hh];
      const bl  = [px + pcx * hw - dcx * hh * 0.55, py + pcy * hw - dcy * hh * 0.55];
      const br  = [px - pcx * hw - dcx * hh * 0.55, py - pcy * hw - dcy * hh * 0.55];
      // Glow pass (fatter, faint) then solid core.
      g.fillStyle(glowColor, alpha * 0.35);
      g.fillTriangle(
        tip[0] + dcx * 4, tip[1] + dcy * 4,
        bl[0] + pcx * 3, bl[1] + pcy * 3,
        br[0] - pcx * 3, br[1] - pcy * 3,
      );
      g.fillStyle(coreColor, alpha);
      g.fillTriangle(tip[0], tip[1], bl[0], bl[1], br[0], br[1]);
    };

    if (bossOff) drawChevron(boss.x, boss.y, 0xff40c0, 0xff90e0, true);
    for (let i = 0; i < enemies.length && i < MAX_ENEMY; i++) {
      drawChevron(enemies[i].x, enemies[i].y, 0xff5828, 0xffa060, false);
    }
    for (let i = 0; i < projs.length && i < MAX_PROJ; i++) {
      drawChevron(projs[i].x, projs[i].y, 0xffe030, 0xfff7a0, false);
    }
  }

  // Soft pulsing red full-screen tint while the boss is enraged (phase ≥ 2).
  // Phase 3 is stronger. Cleared automatically when the boss dies.
  _drawBossTint(time) {
    const g = this.bossTint;
    g.clear();
    const phase = this._bossPhase || 1;
    if (phase < 2) return;
    const base = phase >= 3 ? 0.10 : 0.05;
    const pulse = 0.85 + 0.15 * Math.sin(time * 0.005);
    g.fillStyle(0xff1010, base * pulse);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // Soft red edge glow that fades in below 30% HP and pulses faster as
  // the player gets closer to death. Three feathered bands per edge.
  _drawVignette(time) {
    const g = this.vignette;
    g.clear();
    const p = this.gameScene?.player;
    if (!p || !p.alive) return;
    const ratio = p.hp / p.hpMax;
    if (ratio >= 0.3) return;
    // 0..1 intensity: 0 at 30% HP, 1 at 0% HP
    const t = Math.min(1, (0.3 - ratio) / 0.3);
    const pulseSpeed = 0.005 + t * 0.012;
    const pulse = 0.6 + 0.4 * Math.sin(time * pulseSpeed);
    const w = VIEW.width, h = VIEW.height;
    // Three feathered red bands per edge (outer-most thinnest+strongest)
    const bands = [
      { thick: 18, a: 0.55 },
      { thick: 44, a: 0.28 },
      { thick: 86, a: 0.12 },
    ];
    for (const b of bands) {
      const a = b.a * t * pulse;
      g.fillStyle(0xff0000, a);
      g.fillRect(0, 0, w, b.thick);                 // top
      g.fillRect(0, h - b.thick, w, b.thick);       // bottom
      g.fillRect(0, 0, b.thick, h);                 // left
      g.fillRect(w - b.thick, 0, b.thick, h);       // right
    }
  }

  refreshObjective(done, total) {
    if (!total) { this.objText.setText(''); return; }
    const complete = done >= total;
    this.objText.setColor(complete ? '#40ff80' : '#ffd040');
    this.objText.setText(complete ? '✓ TERMINALS SLICED' : `⛁ SLICE TERMINALS ${done}/${total}`);
  }

  refreshKills(n) {
    this.killText.setText(`KILLS ${n}`);
    // Quick pop on each tick-up
    this.tweens.killTweensOf(this.killText);
    this.killText.setScale(1.25);
    this.tweens.add({ targets: this.killText, scale: 1, duration: 130, ease: 'Back.easeOut' });
  }

  // Secondary readout under the timer: enemies remaining in the current wave.
  refreshWaveRemaining(k) {
    if (k === undefined || k === null || k <= 0 || !this.timerText.text) {
      this.surgeText.setText('');
      return;
    }
    this.surgeText.setText(`LEFT ${k}`);
    if (k <= 3) {
      this.surgeText.setColor('#ff2020');
      this.surgeText.setScale(1.0 + 0.10 * Math.sin(this.time.now * 0.015));
    } else {
      this.surgeText.setColor('#ff8040');
      this.surgeText.setScale(1.0);
    }
  }

  // Primary readout: current wave number. null clears it (round over).
  refreshWave(n, total) {
    if (n === undefined || n === null) {
      this.timerText.setText('');
      this.surgeText?.setText('');
      return;
    }
    this.timerText.setText(`WAVE ${n}/${total}`);
    this.timerText.setColor('#40c0ff');
    this.tweens.killTweensOf(this.timerText);
    this.timerText.setScale(1.25);
    this.tweens.add({ targets: this.timerText, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  // Persistent room-modifier label (top-right). null/'' clears it.
  refreshModifier(name, color) {
    if (!name) { this.modifierText.setText(''); return; }
    this.modifierText.setText(name);
    this.modifierText.setColor(color || '#ff5030');
    this.tweens.killTweensOf(this.modifierText);
    this.modifierText.setScale(1.3);
    this.tweens.add({ targets: this.modifierText, scale: 1, duration: 200, ease: 'Back.easeOut' });
  }

  // Lazily build the DARKNESS radial vignette. It's a screen-space image at a
  // depth BELOW every HUD element, so it dims the gameplay showing through the
  // HUD scene without ever dimming the HUD chrome itself. The camera follows
  // the player near screen-center, so a screen-centered radial reads as a
  // "sight radius" without any per-frame player tracking.
  _ensureDarknessOverlay() {
    if (this.darknessOverlay) return this.darknessOverlay;
    const w = VIEW.width, h = VIEW.height, key = 'darknessVignette';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, w, h);
      const ctx = tex.getContext();
      const cx = w / 2, cy = h / 2;
      const inner = Math.min(w, h) * 0.22;   // bright sight-radius
      const outer = Math.hypot(w, h) * 0.62; // fully dark by the corners
      const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      grad.addColorStop(0,    'rgba(2,2,6,0)');
      grad.addColorStop(0.55, 'rgba(2,2,6,0.45)');
      grad.addColorStop(1,    'rgba(2,2,6,0.82)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      tex.refresh();
    }
    this.darknessOverlay = this.add.image(w / 2, h / 2, key)
      .setScrollFactor(0)
      .setDepth(-1)      // below all HUD chrome (≥0), above the game world
      .setAlpha(0)
      .setVisible(false);
    return this.darknessOverlay;
  }

  setDarkness(on) {
    if (!on && !this.darknessOverlay) return; // nothing to fade out
    const ov = this._ensureDarknessOverlay();
    this.tweens.killTweensOf(ov);
    if (on) {
      ov.setVisible(true);
      this.tweens.add({ targets: ov, alpha: 1, duration: 420, ease: 'Sine.easeOut' });
    } else {
      this.tweens.add({
        targets: ov, alpha: 0, duration: 420, ease: 'Sine.easeIn',
        onComplete: () => ov.setVisible(false),
      });
    }
  }

  refreshHackBar(ratio) {
    const g = this.hackBarGfx;
    g.clear();
    if (!ratio || ratio <= 0 || ratio >= 1) {
      this.hackBarText.setAlpha(0);
      return;
    }
    const cx = VIEW.width / 2, cy = VIEW.height * 0.46;
    const w = 320, h = 22;
    g.fillStyle(0x000000, 0.7);
    g.fillRoundedRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, 4);
    g.fillStyle(0x2a1800, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 3);
    g.fillStyle(0xffaa20, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w * ratio, h, 3);
    g.fillStyle(0xffe0a0, 0.7);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w * ratio, 5, 3);
    this.hackBarText.setAlpha(1).setText(`SLICING… ${Math.round(ratio * 100)}%`);
  }

  // Brief scale-up flash when an ammo cell finishes reloading.
  _pulseAmmoPip(pip) {
    this.tweens.killTweensOf(pip);
    pip.setScale(1.55);
    this.tweens.add({
      targets: pip, scale: 1,
      duration: 240, ease: 'Back.easeOut',
    });
  }

  // Splash an "x2!", "x3!" etc combo text when chain kills happen.
  showCombo(n) {
    // Reuse a single text object — kill any previous tween/state.
    if (!this.comboText) {
      this.comboText = this.add.text(VIEW.width / 2, VIEW.height * 0.36, ' ', {
        fontFamily: FONTS.display,
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffd040',
        stroke: '#000000',
        strokeThickness: 7,
      }).setOrigin(0.5).setDepth(35).setAlpha(0).setResolution(2);
    }
    this.tweens.killTweensOf(this.comboText);
    const colors = [null, null, '#ffd040', '#ffaa20', '#ff8020', '#ff4020', '#ff2020'];
    const col = colors[Math.min(colors.length - 1, n)] || '#ff2020';
    this.comboText.setText(`x${n}!`).setColor(col);
    this.comboText.setScale(0.5).setAlpha(1);
    this.tweens.add({
      targets: this.comboText, scale: 1.15,
      duration: 180, ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: this.comboText, alpha: 0, scale: 1.5,
      duration: 600, delay: 700, ease: 'Cubic.easeIn',
    });
  }

  setHackVisible(avail) {
    if (avail === this._hackReady) return;
    this._hackReady = avail;
    this.tweens.killTweensOf(this.hackBtn);
    if (avail) {
      this.hackBtn.setScale(0.6);
      this.tweens.add({
        targets: this.hackBtn,
        alpha: 1,
        scale: 1,
        duration: 160,
        ease: 'Back.easeOut',
      });
      this._hackPulse = this.tweens.add({
        targets: this.hackBtn,
        scale: 1.06,
        duration: 700,
        yoyo: true,
        repeat: -1,
        delay: 200,
        ease: 'Sine.easeInOut',
      });
    } else {
      this._hackPulse?.stop();
      this.tweens.add({
        targets: this.hackBtn,
        alpha: 0,
        scale: 0.6,
        duration: 140,
      });
    }
  }

  setTakedownVisible(avail) {
    if (avail === this._takedownReady) return;
    this._takedownReady = avail;
    this.tweens.killTweensOf(this.takedownBtn);
    if (avail) {
      this.takedownBtn.setScale(0.6);
      this.tweens.add({
        targets: this.takedownBtn,
        alpha: 1,
        scale: 1,
        duration: 160,
        ease: 'Back.easeOut',
      });
      // Gentle idle pulse while available
      this._takedownPulse = this.tweens.add({
        targets: this.takedownBtn,
        scale: 1.08,
        duration: 600,
        yoyo: true,
        repeat: -1,
        delay: 180,
        ease: 'Sine.easeInOut',
      });
    } else {
      this._takedownPulse?.stop();
      this.tweens.add({
        targets: this.takedownBtn,
        alpha: 0,
        scale: 0.6,
        duration: 140,
      });
    }
  }

  showBanner(text, color = '#ff2828') {
    // Adaptive sizing: long or multi-line messages (tips/objectives) shrink so
    // they don't overflow the portrait width.
    const longest = Math.max(...text.split('\n').map((s) => s.length));
    const size = text.includes('\n') || longest > 14 ? 34 : 60;
    this.banner.setFontSize(size);
    this.banner.setAlign('center');
    this.banner.setText(text);
    this.banner.setColor(color);
    this.banner.setAlpha(0);
    this.banner.setScale(0.6);
    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      scale: 1.05,
      duration: 220,
      onComplete: () => {
        this.tweens.add({
          targets: this.banner,
          alpha: 0,
          scale: 1.3,
          duration: 650,
          delay: 700,
        });
      },
    });
  }
}
