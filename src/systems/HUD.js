import Phaser from 'phaser';
import { VIEW, PLAYER, WEAPONS, COLORS, HUDCFG, FONTS, DARKNESS } from '../config.js';
import { Joystick } from './Joystick.js';
import { SuperButton } from './SuperButton.js';
import { DashButton } from './DashButton.js';
import { MeleeButton } from './MeleeButton.js';
import { HackMinigame } from './HackMinigame.js';
import { getControl } from './controlLayout.js';
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

    // ── Exit waypoint (endless "move to next sector") ────────────────────
    // Own layer, drawn above the threat chevrons so guidance always wins over
    // ambient threat markers. Kept separate from chevronGfx so the threat
    // routine stays untouched.
    this.waypointGfx = this.add.graphics().setDepth(36);

    // ── Boss enrage tint: subtle red ambient overlay when boss is in
    // phase 2 or 3. Sits below the vignette so low-HP still dominates.
    this.bossTint = this.add.graphics().setDepth(6);
    this._bossPhase = 1;

    // ── Duel bar ────────────────────────────────────────────────────────
    // A nemesis had no health bar at all, which is most of why it read as "a
    // normal enemy but enlarged": there was nothing on screen saying this one
    // is a fight. `_duelFoe` is the live enemy; it is dropped on duel-end so a
    // recycled pool sprite can never keep the bar alive.
    this._duelFoe = null;
    this.duelBar = this.add.graphics().setDepth(37).setVisible(false);
    this.duelName = this.add
      .text(VIEW.width / 2, HUDCFG.topBarHeight + 12, '', {
        fontFamily: FONTS.body, fontSize: '20px', color: '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setDepth(38)
      .setVisible(false);

    // ── Imperial top bar ────────────────────────────────────────────────
    // Its height is the shared inset the game camera is pushed down by, so the
    // world never renders behind it (see GameScene camera setViewport).
    const barH = HUDCFG.topBarHeight;
    const top = this.add.graphics();
    // Dark metal base — opaque so the transparent world edge behind reads clean.
    top.fillStyle(0x0a0c14, 1);
    top.fillRect(0, 0, VIEW.width, barH);
    // Blue LED strip bottom (Imperial)
    top.fillStyle(0x0038bb, 0.8);
    top.fillRect(0, barH - 4, VIEW.width, 3);
    // Subtle top edge sheen
    top.fillStyle(0x2e3038, 0.5);
    top.fillRect(0, 0, VIEW.width, 2);
    // Side accent lines
    top.fillStyle(0x1e2028, 1);
    top.fillRect(0, 0, 2, barH);
    top.fillRect(VIEW.width - 2, 0, 2, barH);

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

    // Run score (left of the timer). This slot used to be the kill counter;
    // score subsumes it — points are kills weighted by what they were and how
    // fast you chained them — and the top bar has no room for both. Kills are
    // still tracked and still shown on the end-of-run summary and the records
    // screen, they just are not the live readout any more.
    this.scoreText = this.add.text(VIEW.width / 2 - 170, 60, '', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffd040',
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
    // Banner sits just under the top bar, NOT at 32% height: at 60px with a
    // 1.3x pop it covered the upper play area where enemies close in, and big
    // streak text landing on top of the fight is what made the screen unreadable.
    this.banner = this.add
      .text(VIEW.width / 2, HUDCFG.topBarHeight + 66, ' ', {
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

    // ── Persistent sector directive sign ────────────────────────────────
    // Deliberately NOT routed through showBanner: that auto-fades in ~1.6s and
    // shrinks any text over 14 chars to 34px, which is exactly why the old
    // prompt read as brief and small. This one holds until the player leaves.
    // Upper third so it's readable from anywhere in the room without covering
    // the combat zone around the player.
    this._buildSectorSign();

    // Energy cell ammo pips (above the aim stick) and the secondary-weapon
    // readout (above the move stick). Both ride with their stick, so their
    // positions come from _layoutChrome() rather than from HUDCFG directly.
    this.ammoPips = [];
    for (let i = 0; i < PLAYER.ammoMax; i++) this.ammoPips.push(this.add.graphics());

    const sec = getControl('moveStick');
    const secX = sec.x, secY = sec.y - sec.radius - 60;
    this.secGfx = this.add.graphics();
    this.secIcon = this.add.image(secX, secY, 'pickup-rifle').setDepth(5).setScale(0.42).setVisible(false);
    this.secText = this.add.text(secX, secY + 42, ' ', {
      fontFamily: FONTS.body,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffaa40',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);

    // Super button (lightsaber hilt) — by default big and inside the right-thumb
    // arc. Tap auto-aims + fires; drag to aim manually.
    //
    // Every touch widget below takes its x / y / scale from controlLayout.js
    // (Pause > CONTROLS edits it). The `radius` passed here is the *unscaled*
    // base; the widget multiplies it by the layout scale itself.
    const superL = getControl('superBtn');
    this.superButton = new SuperButton(this, {
      x: superL.x,
      y: superL.y,
      scale: superL.scale,
      radius: 58,
      joystick: this.joystickRight,
      onAim: (v) => this.gameScene?.player?.setSuperAimInput(v),
      onRelease: (v) => this.gameScene?.player?.releaseSuperAim(v),
      isReady: () =>
        !!this.gameScene?.player &&
        this.gameScene.player.superCharge >= PLAYER.superHitsToCharge,
    });

    // Dash button (chevrons pointing right >>) — thumb-arc diagonal below super
    const dashL = getControl('dashBtn');
    this.dashButton = new DashButton(this, {
      x: dashL.x,
      y: dashL.y,
      scale: dashL.scale,
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

    // Melee "Broken Wings" button — left of super, above dash. Must also be
    // listed in fireStick.shouldClaim above or taps here leak into the primary.
    const meleeL = getControl('meleeBtn');
    this.meleeButton = new MeleeButton(this, {
      x: meleeL.x,
      y: meleeL.y,
      scale: meleeL.scale,
      radius: 46,
      onAim: (v) => {
        const p = this.gameScene?.player;
        if (!p?.alive) return;
        // First aim event of a press starts the hold clock; the rest just steer.
        if (!p._meleeHoldActive) p.beginMeleeAim();
        p.setMeleeAimInput(v);
      },
      onRelease: (v) => this.gameScene?.player?.releaseMeleeAim(v),
      isReady: () => {
        const p = this.gameScene?.player;
        if (!p?.alive) return false;
        // Mid-combo the button stays live even with an empty meter, because
        // casts 2 and 3 are free inside the window.
        return p.meleeReady || (p._comboStage > 0 && p._comboWindowMs > 0);
      },
    });

    // Combo multiplier badge — top-LEFT, just under the bar. It used to sit
    // above the super button, i.e. inside the right-thumb zone directly over the
    // action buttons, where a hand covers it exactly when a combo is running.
    this.multText = this.add.text(18, HUDCFG.topBarHeight + 10, ' ', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffd040',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0).setAlpha(0);

    // Pause button — top-right play-area corner (right half, excluded from the
    // fire stick's claim region so tapping it never starts an aim drag).
    this._buildPauseButton();

    // Joysticks
    const moveL = getControl('moveStick');
    const fireL = getControl('fireStick');
    this.moveStick = new Joystick(this, 'left', {
      x: moveL.x, y: moveL.y, scale: moveL.scale,
      onMove: (v) => this.gameScene?.player?.setMoveInput(v),
      onEnd: () => this.gameScene?.player?.setMoveInput({ x: 0, y: 0, force: 0 }),
    });
    this.fireStick = new Joystick(this, 'right', {
      x: fireL.x, y: fireL.y, scale: fireL.scale,
      shouldClaim: (pointer) => {
        // Don't claim the pointer if the user is interacting with the
        // hack mini-game or the super button — keeps fire input from
        // leaking into other UI.
        if (this.hackMinigame && this.hackMinigame.state !== 'idle') return false;
        return !this.superButton.containsPoint(pointer.x, pointer.y)
          && !this.dashButton.containsPoint(pointer.x, pointer.y)
          // Optional chaining: the stick is constructed before the buttons, so
          // before meleeButton exists this correctly falls through to "claim".
          && !this.meleeButton?.containsPoint(pointer.x, pointer.y)
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
    // Bind to the GAME scene's emitter, tracking each handler so it can be
    // removed by REFERENCE on shutdown.
    //
    // This used to be a long list of `ge.off('name')` calls, which remove EVERY
    // listener for that name — including GameScene's own. GameScene listens for
    // boss-start, boss-phase and boss-died too, and `scene.stop('HUD')` is
    // deferred to the end of the frame, so on a restart the HUD's shutdown ran
    // AFTER the new GameScene had already re-registered: the HUD silently tore
    // the fresh scene's boss handlers straight back off again. Caught by
    // tests/smoke-restart.mjs, which counts listeners across four restarts.
    const bound = [];
    const gbind = (event, fn, ctx) => { bound.push([event, fn, ctx]); ge.on(event, fn, ctx); };

    gbind('player-hp-changed',    this.refreshHp,    this);
    this._onPlayerHurt = (amt, dir) => { this.refreshHp(); if (typeof dir === 'number') this._addHitArc(dir); };
    gbind('player-hurt',          this._onPlayerHurt);
    gbind('player-ammo-changed',  this.refreshAmmo,  this);
    gbind('player-fire',          this.refreshAmmo,  this);
    gbind('player-super-changed', this.refreshSuper, this);
    gbind('player-super-ready',   this.refreshSuper, this);
    gbind('player-melee-changed', this.refreshMelee, this);
    gbind('player-melee-ready',   this.refreshMelee, this);
    gbind('player-melee-cast',    this.refreshMelee, this);
    // SUPPRESSION. The HUD REFLECTS the rule; it does not create it — the gate
    // lives in Player.tryFireSuper / Player.tryMeleeCombo, so a hidden or
    // stale button cannot let a Super through.
    gbind('player-suppressed',    this._onSuppressed, this);
    gbind('player-suppress-end',  this._onSuppressEnd, this);
    gbind('player-super-denied',  this._onSuperDenied, this);
    this._onMultChanged = (mult, streak) => {
      if (streak > 0) {
        // "CHARGE", not "COMBO". This badge shows Player.accuracyMult — a
        // streak of consecutive HITS that resets on a miss, whose actual effect
        // is that the super and melee meters fill that many times faster. It is
        // a different system from the chain-kill streak that drives the "x3!"
        // splash and now the score multiplier, and calling both of them "combo"
        // meant the player had no way to tell which one they were looking at or
        // what either did.
        this.multText.setText(`CHARGE x${mult.toFixed(1)}`);
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
    gbind('player-mult-changed',  this._onMultChanged);
    gbind('room-start',           (n, total, spec) => {
      // Belt-and-braces hide: the per-frame driver also clears the sign when
      // doorZone is destroyed on room load, but a stale permanent sign burned
      // onto a fresh room is the worst failure mode for this element.
      this.hideSectorSign();
      this.refreshChamber(n, total, spec);
    });
    gbind('boss-start',           ()               => this.showBanner('VADER APPROACHES', '#ff2828'));
    gbind('boss-phase',           (phase)          => { this._bossPhase = phase; this.showBanner('ENRAGED!', '#ff8888'); });
    gbind('boss-died',            ()               => { this._bossPhase = 1; });
    gbind('show-banner',          (text, color)    => this.showBanner(text, color));
    gbind('duel-start',           (foe)            => this.startDuel(foe));
    gbind('duel-end',             ()               => this.endDuel());
    gbind('lives-changed',        (n)              => this.drawLives(n));
    gbind('secondary-equipped',     (id)           => this.refreshSecondary(id));
    gbind('secondary-ammo-changed', ()             => this.refreshSecondary());
    gbind('takedown-available',     (avail)        => this.setTakedownVisible(avail));
    gbind('objective-update',       (done, total)  => this.refreshObjective(done, total));
    gbind('wave-update',            (n, total)     => this.refreshWave(n, total));
    gbind('score-changed',          (t, d)         => this.refreshScore(t, d));
    gbind('score-popup',            (x, y, n, l, m) => this.showScorePopup(x, y, n, l, m));
    gbind('score-medal',            (name, pts, col) => this.showMedal(name, pts, col));
    gbind('wave-remaining',         (k)            => this.refreshWaveRemaining(k));
    gbind('modifier-active',        (name, color)  => this.refreshModifier(name, color));
    gbind('set-darkness',           (on, mode)     => this.setDarkness(on, mode));
    gbind('hack-prompt',            (avail)        => this.setHackVisible(avail));
    gbind('show-combo',             (n)            => this.showCombo(n));
    gbind('hack-start',             (terminal)     => {
      this.setHackVisible(false);
      this.hackMinigame?.start(terminal);
    });
    gbind('hack-cancel',            ()             => this.hackMinigame?.cancel());

    // Spin up the slicing mini-game (hidden until hack-start fires)
    this.hackMinigame = new HackMinigame(this);

    this.events.on('shutdown', () => {
      for (const [event, fn, ctx] of bound) ge.off(event, fn, ctx);
      this.comboText = null;
      // THE SCENE INSTANCE OUTLIVES ITS DISPLAY LIST.
      //
      // Phaser reuses the scene object across `scene.start()`, so a lazily
      // created Text cached on `this` survives the restart as a DESTROYED
      // object — and the next `setText` on it reaches into a null canvas:
      //
      //   TypeError: Cannot read properties of null (reading 'drawImage')
      //     at updateUVs -> setCutPosition -> setSize -> updateText -> setText
      //     at _renderMedal (HUD.js) <- _drainMedals <- showMedal
      //
      // which kills the HUD scene and takes the run with it. `comboText` above
      // is the same bug, found and fixed earlier; the medal lane was added
      // afterwards and did not inherit the lesson. Same family as the ledger
      // living on the ledger rather than on GameScene (HANDOVER §10c).
      //
      // The queue and the flag have to go too, and not only for tidiness: a
      // `_medalShowing` left true from the previous run means every future
      // medal is pushed onto a queue that nothing will ever drain.
      this._medalText = null;
      this._medalQueue = null;
      this._medalShowing = false;
      for (const ov of Object.values(this._overlays || {})) ov.destroy();
      this._overlays = null;
      this._darkTweens = null;
      this.darknessOverlay = null;
      this.hackMinigame?.shutdown();
      this.hackMinigame = null;
      this.moveStick?.shutdown();
      this.fireStick?.shutdown();
      this.superButton?.shutdown();
      this.dashButton?.shutdown();
    });

    this._layoutChrome();
    this.refreshHp();
    this.refreshAmmo();
    this.refreshSuper();
    this.refreshScore(this.gameScene?.runScore ?? 0);
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

  // ── Touch-control layout ───────────────────────────────────────────────
  // Re-read controlLayout.js and push it into the live widgets. Called by
  // ControlsScene when the editor closes, so a layout edited mid-run applies
  // without a restart.
  applyControlLayout() {
    this.moveStick?.setLayout(getControl('moveStick'));
    this.fireStick?.setLayout(getControl('fireStick'));
    this.superButton?.setLayout(getControl('superBtn'));
    this.meleeButton?.setLayout(getControl('meleeBtn'));
    this.dashButton?.setLayout(getControl('dashBtn'));
    this._layoutChrome();
    // The gauges were cleared by setLayout; these repaint them at the new
    // radius. The dash gauge is polled every frame, so it needs no nudge.
    this.refreshAmmo();
    this.refreshSuper();
    this.refreshMelee();
    this.refreshSecondary();
  }

  // Every sprite that makes up a touch control. Order is stable across calls,
  // which is what lets setTouchControlsVisible() restore by index.
  _touchControlObjects() {
    return [
      this.moveStick?.base, this.moveStick?.knob,
      this.fireStick?.base, this.fireStick?.knob,
      this.superButton?.image, this.superButton?.gauge, this.superButton?.knob, this.superButton?.readyGlow,
      this.meleeButton?.image, this.meleeButton?.gauge, this.meleeButton?.knob, this.meleeButton?.readyGlow,
      this.dashButton?.image, this.dashButton?.gauge,
    ].filter(Boolean);
  }

  // Used by ControlsScene, which draws its own draggable proxies on top: two
  // sets of controls on screen at once is unreadable. Restores the PREVIOUS
  // visibility rather than forcing true — the ready-glows are shown and hidden
  // on charge edges, so blanket-restoring would light a halo that should be off.
  setTouchControlsVisible(visible) {
    const objs = this._touchControlObjects();
    if (!visible) {
      this._ctrlVisWas = objs.map((o) => o.visible);
      objs.forEach((o) => o.setVisible(false));
    } else if (this._ctrlVisWas) {
      objs.forEach((o, i) => o.setVisible(this._ctrlVisWas[i] ?? true));
      this._ctrlVisWas = null;
    }
  }

  // Position the readouts that ride with a stick: ammo pips above the aim
  // stick, secondary-weapon panel above the move stick. Both were pinned to the
  // HUDCFG defaults before the sticks could move.
  _layoutChrome() {
    const fire = getControl('fireStick');
    const pipSpacing = 28;
    for (let i = 0; i < this.ammoPips.length; i++) {
      this.ammoPips[i].x = fire.x + (i - (this.ammoPips.length - 1) / 2) * pipSpacing;
      this.ammoPips[i].y = fire.y - fire.radius - 50;
    }
    const move = getControl('moveStick');
    this._secX = move.x;
    this._secY = move.y - move.radius - 60;
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
      this.meleeButton?.forceRelease();
      const p = this.gameScene?.player;
      if (p) {
        p.setMoveInput({ x: 0, y: 0, force: 0 });
        p.setAimInput({ x: 0, y: 0, force: 0 });
        // Drop a melee hold outright rather than releasing it — resuming from
        // pause must not cast the combo the player never let go of.
        p._meleeHoldActive = false;
        p._kbMeleeHold     = false;
        p.meleeAiming      = false;
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

  // Both Super controls go to their not-ready texture and take a locked
  // tint/alpha on top, so SUPPRESSED is distinguishable from merely uncharged:
  // an uncharged button is dim with a filling gauge, a suppressed one is dim
  // AND desaturated while its gauge still shows the charge it kept.
  //
  // TINT AND ALPHA ONLY, NEVER SCALE. A touch widget's `scale` is the player's
  // own setting from Pause -> CONTROLS, and writing a bare value here would
  // silently reset a resized button to 100%.
  _applySuppressLook(on) {
    for (const btn of [this.superButton, this.meleeButton]) {
      const img = btn?.image;
      if (!img) continue;
      if (on) img.setTint(0x6a6a86).setAlpha(0.5);
      else    { img.clearTint(); img.setAlpha(1); }
    }
  }

  _onSuppressed() {
    this._applySuppressLook(true);
    this.refreshSuper();
    this.refreshMelee();
  }

  _onSuppressEnd() {
    this._applySuppressLook(false);
    this.refreshSuper();
    this.refreshMelee();
    // Lightweight relight so "my Supers are back" needs no banner. Alpha only.
    for (const btn of [this.superButton, this.meleeButton]) {
      const img = btn?.image;
      if (!img) continue;
      this.tweens.killTweensOf(img);
      img.setAlpha(0.35);
      this.tweens.add({ targets: img, alpha: 1, duration: 260, ease: 'Sine.easeOut' });
    }
    // Not on a revive: `clearSuppression` fires this too, and a ready chime
    // over a death fade belongs to nothing.
    if (this.gameScene?.player?.alive) SFX.superReady?.();
  }

  // Pressed a Super while it is offline. Rate-limited upstream by
  // Player._denyFxT, so a held button cannot machine-gun this.
  _onSuperDenied() {
    for (const btn of [this.superButton, this.meleeButton]) {
      const img = btn?.image;
      if (!img) continue;
      this.tweens.killTweensOf(img);
      img.setTint(0xff5060).setAlpha(0.85);
      this.tweens.add({
        targets: img, alpha: 0.5, duration: 180, ease: 'Sine.easeIn',
        onComplete: () => { if (this.gameScene?.player?.suppressed) img.setTint(0x6a6a86); },
      });
    }
    SFX.uiClick?.();
  }

  // THE POCKET FOLLOWS THE PLAYER, NOT THE SCREEN.
  //
  // The overlay is `scrollFactor(0)` in the HUD scene, so it is pinned to the
  // middle of the display. That was harmless for the ambient vignette, whose
  // clear core is 158px and whose ramp is gentle — but this one has a 90px
  // core and is at 0.66 by 300px, and the game camera CLAMPS at the arena
  // bounds. Push into a corner of a 1600px arena and the camera stops while
  // the player keeps walking, up to ~360px horizontally and ~598px vertically
  // off centre — which with a tight gradient puts the player in the dark part
  // of their own sight radius. Recentring costs two subtractions a frame.
  //
  // `cam.y` is the HUD-top-bar inset (the game viewport starts below it), so
  // it has to be added back or the pocket rides 84px high of the player.
  _trackBlackout(p) {
    const ov = this._overlays?.blackout;
    if (!ov?.visible || !p) return;
    const cam = this.gameScene.cameras.main;
    const [px, py] = DARKNESS.blackout.pad;
    const sx = (p.x - cam.scrollX) * cam.zoom + cam.x;
    const sy = (p.y - cam.scrollY) * cam.zoom + cam.y;
    ov.setPosition(
      Phaser.Math.Clamp(sx, VIEW.width / 2 - px, VIEW.width / 2 + px),
      Phaser.Math.Clamp(sy, VIEW.height / 2 - py, VIEW.height / 2 + py),
    );
  }

  refreshMelee() {
    const p = this.gameScene?.player;
    if (!p || !this.meleeButton) return;
    const max = PLAYER.meleeHitsToCharge;
    const inCombo = p._comboStage > 0 && p._comboWindowMs > 0;
    this.meleeButton.setReady((p.meleeCharge >= max || inCombo) && !p.suppressed);
    this.meleeButton.drawGauge(p.meleeCharge, max, inCombo ? p._comboStage : 0);
  }

  refreshSuper() {
    const p = this.gameScene.player;
    if (!p) return;
    const ready = p.superCharge >= PLAYER.superHitsToCharge && !p.suppressed;
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

    const ICON = { rifle: 'pickup-rifle', cluster: 'pickup-cluster' };
    const NAMES = { rifle: 'DC-15', cluster: 'CLUSTER' };
    const COLS  = { rifle: 0xff8010, cluster: 0xff2020 };

    const ammo  = p?.secondaryAmmo ?? 0;
    const col   = COLS[id] ?? 0xffaa40;
    const cx    = this._secX;
    const cy    = this._secY;

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
    this._trackBlackout(p);
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
    // Update dash button loading gauge — use the player's UPGRADED values so
    // EXTRA THRUSTER (more charges) and QUICK CHARGE (faster recharge) actually
    // show on the button, not the bare config constants.
    if (p && p.alive && this.dashButton) {
      const maxCharges = (PLAYER.dashChargesMax || 3) + (p.dashChargesBonus || 0);
      const rechargeMs = (PLAYER.dashRechargeMs || 2800) * (p.dashRechargeMult || 1);
      const rechargeRatio = p.dashCharges < maxCharges ? p.dashRechargeTimer / rechargeMs : 0;
      this.dashButton.drawGauge(p.dashCharges, maxCharges, rechargeRatio);
    }
    // Low-HP red vignette pulse
    this._drawVignette(time);
    // Boss enrage ambient red tint
    this._drawBossTint(time);
    // Directional hit arcs
    this._drawHitArcs(delta);
    // Off-screen threat chevrons
    this._drawThreatChevrons();
    // Nemesis duel health bar
    this._drawDuelBar(time);
    // Exit waypoint guidance (endless)
    this._drawExitWaypoint(time);
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
    // The game camera is inset below the HUD bar, so chevrons pin to the visible
    // game viewport rect (screen space), not the full screen.
    const vpx = cam.x, vpy = cam.y;        // viewport top-left in screen px
    const cx = vpx + cam.width  / 2;
    const cy = vpy + cam.height / 2;
    const halfW = cam.width  / 2;
    const halfH = cam.height / 2;

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
    // Both hostile pools: a deflected bolt is incoming fire like any other, and
    // it is the one the player has the least warning about.
    (gs.hostileBullets ?? [gs.enemyBullets]).forEach((grp) => grp?.getChildren().forEach((b) => {
      if (!b.active || onScreen(b.x, b.y)) return;
      const vx = b.body?.velocity.x || 0, vy = b.body?.velocity.y || 0;
      if (Math.hypot(vx, vy) < FAST_PROJ) return;
      // incoming = moving toward the player (velocity dotted with bullet→player)
      if (vx * (p.x - b.x) + vy * (p.y - b.y) <= 0) return;
      projs.push({ x: b.x, y: b.y, d: Math.hypot(b.x - p.x, b.y - p.y) });
    }));
    projs.sort((a, b) => a.d - b.d);

    const drawChevron = (wx, wy, coreColor, glowColor, boss) => {
      const sx = vpx + (wx - vw.x) * zoom;   // threat position in screen space
      const sy = vpy + (wy - vw.y) * zoom;
      const ang = Math.atan2(sy - cy, sx - cx);
      const absC = Math.abs(Math.cos(ang));
      const absS = Math.abs(Math.sin(ang));
      const R = (absC < 0.001 ? halfH : absS < 0.001 ? halfW : Math.min(halfW / absC, halfH / absS)) * 0.9;
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

  // ── Persistent sector directive sign ──────────────────────────────────
  // Cold, clinical signage: a flat after-action line above a flat order. The
  // "cold" here is attitude, not colour — it states the body count and issues
  // the directive without ceremony, then just sits there.
  _buildSectorSign() {
    const W = VIEW.width - 56;
    const H = 128;
    const cx = VIEW.width / 2;
    const cy = 214;                       // upper third, clear of the 84px bar
    const COL = 0x40ff90;

    this.sectorSign = this.add.container(cx, cy).setDepth(37).setVisible(false).setAlpha(0);

    const plate = this.add.graphics();
    // Dark plate — semi-transparent so the arena still reads behind it.
    plate.fillStyle(0x04140c, 0.78);
    plate.fillRect(-W / 2, -H / 2, W, H);
    // Hard rules top and bottom (engraved signage, not a soft glow).
    plate.fillStyle(COL, 0.95);
    plate.fillRect(-W / 2, -H / 2, W, 3);
    plate.fillRect(-W / 2, H / 2 - 3, W, 3);
    plate.fillStyle(COL, 0.25);
    plate.fillRect(-W / 2, -H / 2 + 5, W, 1);
    plate.fillRect(-W / 2, H / 2 - 6, W, 1);
    // Corner ticks.
    plate.fillStyle(COL, 0.9);
    const T = 22;
    [[-W / 2, -H / 2], [W / 2 - T, -H / 2], [-W / 2, H / 2 - 3], [W / 2 - T, H / 2 - 3]]
      .forEach(([x, y]) => plate.fillRect(x, y, T, 3));
    plate.fillRect(-W / 2, -H / 2, 3, 20);
    plate.fillRect(W / 2 - 3, -H / 2, 3, 20);
    plate.fillRect(-W / 2, H / 2 - 20, 3, 20);
    plate.fillRect(W / 2 - 3, H / 2 - 20, 3, 20);

    // After-action line — small, dim, matter-of-fact.
    this.signSub = this.add.text(0, -H / 2 + 26, '', {
      fontFamily: FONTS.body,
      fontSize: '19px',
      color: '#8fdfae',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setResolution(2);

    // The directive — large. This is the fix for "very small".
    this.signMain = this.add.text(0, 16, 'MOVE TO NEXT SECTOR', {
      fontFamily: FONTS.display,
      fontSize: '46px',
      fontStyle: 'bold',
      color: '#40ff90',
      stroke: '#00160a',
      strokeThickness: 8,
      letterSpacing: 2,
    }).setOrigin(0.5).setResolution(2);

    // Scanline — a thin bright bar that sweeps down the plate on a loop.
    this.signScan = this.add.graphics();
    this.signScan.fillStyle(0xc0ffd8, 0.22);
    this.signScan.fillRect(-W / 2 + 3, -2, W - 6, 4);

    this.sectorSign.add([plate, this.signScan, this.signSub, this.signMain]);
    this._signH = H;
    this._signShown = false;
    this._signTweens = [];
  }

  // Idempotent. Latched by _signShown so the per-frame driver can call this
  // every tick without restarting tweens or leaking graphics.
  showSectorSign(sector, kills) {
    const sub = kills > 0
      ? `SECTOR ${sector} CLEARED — ${kills} HOSTILES DOWN`
      : `SECTOR ${sector} CLEARED`;
    this.signSub.setText(sub);
    if (this._signShown) return;
    this._signShown = true;

    const c = this.sectorSign;
    c.setVisible(true).setAlpha(0).setScale(1.14, 0.7);
    // Arrival: slam in, then hold indefinitely.
    this._signTweens.push(this.tweens.add({
      targets: c, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 260, ease: 'Back.easeOut',
    }));
    // Sustained breathing — subtle enough to ignore mid-fight.
    this._signTweens.push(this.tweens.add({
      targets: c, alpha: { from: 1, to: 0.86 },
      duration: 1400, yoyo: true, repeat: -1, delay: 300, ease: 'Sine.easeInOut',
    }));
    // Scanline sweep, bounded to the plate so no mask is needed.
    const h = this._signH;
    this.signScan.y = -h / 2;
    this._signTweens.push(this.tweens.add({
      targets: this.signScan, y: { from: -h / 2 + 4, to: h / 2 - 4 },
      duration: 2200, repeat: -1, ease: 'Sine.easeInOut',
    }));
    SFX.uiClick?.();
  }

  hideSectorSign() {
    if (!this._signShown) return;
    this._signShown = false;
    this._signTweens.forEach((t) => t?.remove());
    this._signTweens = [];
    this.tweens.killTweensOf(this.sectorSign);
    this.tweens.killTweensOf(this.signScan);
    this.sectorSign.setVisible(false).setAlpha(0);
  }

  // Guidance to the open exit so a cleared room never leaves the player
  // hunting for the way out. Off-screen → a big pulsing arrow pinned to the
  // viewport edge; on-screen → a pulsing ring at the door itself. Styled
  // green/amber and larger than threat chevrons so the two never confuse.
  _drawExitWaypoint(time) {
    const g = this.waypointGfx;
    g.clear();
    const gs = this.gameScene;
    const p  = gs?.player;
    // One condition drives BOTH the arrow and the sign, so they can never
    // disagree: an exit exists, is open, and hasn't been taken yet.
    const active = !!(p && p.alive && gs.doorZone && !gs._doorTriggered);

    // The persistent directive sign is endless-only. Both calls are latched, so
    // driving them per frame costs nothing and self-heals across room changes
    // (doorZone is destroyed on room load, which flips `active` false).
    if (active && gs.mode === 'endless') {
      this.showSectorSign(gs.sector ?? 1,
        Math.max(0, (gs.runKills || 0) - (gs._roomKillsAtStart || 0)));
    } else {
      this.hideSectorSign();
    }

    if (!active) return;

    const cam = gs.cameras.main;
    const vw  = cam.worldView;
    if (!vw || vw.width <= 0) return;
    const zoom = cam.zoom;
    const wx = gs.doorZone.x, wy = gs.doorZone.y;

    // Same projection contract as the threat chevrons: the game camera is
    // inset below the HUD bar, so screen space is viewport-relative.
    const sx = cam.x + (wx - vw.x) * zoom;
    const sy = cam.y + (wy - vw.y) * zoom;
    const pulse = 0.72 + Math.sin(time * 0.006) * 0.28;
    const COL = 0x40ff90, GLOW = 0xc0ffd8;

    const onScreen = wx >= vw.x && wx <= vw.x + vw.width
                  && wy >= vw.y && wy <= vw.y + vw.height;

    if (onScreen) {
      // Door is visible — mark it in place instead of pointing off-screen.
      g.lineStyle(4, COL, 0.55 + pulse * 0.4);
      g.strokeCircle(sx, sy, 26 + pulse * 12);
      g.lineStyle(2, GLOW, 0.5 * pulse);
      g.strokeCircle(sx, sy, 40 + pulse * 16);
      return;
    }

    // Off-screen — pin a large arrow to the viewport edge along the ray from
    // viewport centre toward the door.
    const cx = cam.x + cam.width / 2;
    const cy = cam.y + cam.height / 2;
    const halfW = cam.width / 2;
    const halfH = cam.height / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const absC = Math.abs(Math.cos(ang));
    const absS = Math.abs(Math.sin(ang));
    const R = (absC < 0.001 ? halfH : absS < 0.001 ? halfW
              : Math.min(halfW / absC, halfH / absS)) * 0.84;
    const ax = cx + Math.cos(ang) * R;
    const ay = cy + Math.sin(ang) * R;

    const s = 1.5 * (0.9 + pulse * 0.25);       // deliberately bigger than a chevron
    const dcx = Math.cos(ang), dcy = Math.sin(ang);
    const pcx = -dcy, pcy = dcx;
    const hh = 22 * s, hw = 15 * s;
    const tip = [ax + dcx * hh, ay + dcy * hh];
    const bl  = [ax + pcx * hw - dcx * hh * 0.5, ay + pcy * hw - dcy * hh * 0.5];
    const br  = [ax - pcx * hw - dcx * hh * 0.5, ay - pcy * hw - dcy * hh * 0.5];
    g.fillStyle(GLOW, 0.3 * pulse);
    g.fillTriangle(tip[0] + dcx * 5, tip[1] + dcy * 5,
                   bl[0] + pcx * 4, bl[1] + pcy * 4,
                   br[0] - pcx * 4, br[1] - pcy * 4);
    g.fillStyle(COL, 0.55 + pulse * 0.4);
    g.fillTriangle(tip[0], tip[1], bl[0], bl[1], br[0], br[1]);
    // Small trailing bar so it reads as a "go this way" marker, not a threat.
    g.fillStyle(COL, 0.4 + pulse * 0.3);
    g.fillTriangle(
      ax - dcx * hh * 0.55 + pcx * hw * 0.45, ay - dcy * hh * 0.55 + pcy * hw * 0.45,
      ax - dcx * hh * 0.55 - pcx * hw * 0.45, ay - dcy * hh * 0.55 - pcy * hw * 0.45,
      ax - dcx * hh * 1.05, ay - dcy * hh * 1.05,
    );
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

  // Run score. Grouped with commas because six-figure totals are unreadable
  // at 17px otherwise, and the pop scales with the size of the award so a
  // 25,000-point Vader kill does not land with the same nudge as a swarmling.
  refreshScore(total, delta = 0) {
    this.scoreText.setText(`SCORE ${total.toLocaleString('en-US')}`);
    // Magnitude, not signed value — a big PENALTY should punch as hard as a
    // big bonus, and a raw negative delta shrank the readout instead.
    const pop = 1.12 + Math.min(0.5, Math.abs(delta || 0) / 4000);
    this.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(pop);
    this.tweens.add({ targets: this.scoreText, scale: 1, duration: 150, ease: 'Back.easeOut' });
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
  // ONE OVERLAY PER MODE, each built from its own gradient in `DARKNESS`.
  //
  // They are separate objects rather than one image whose texture is swapped,
  // because a swap mid-tween would pop and because the ambient modifier and a
  // boss blackout are not guaranteed to be mutually exclusive forever — today
  // `loadRoom`'s boss branch lowers ambient before Vader walks in, and that is
  // a scene-side courtesy, not a contract this file may lean on. Two overlays
  // simply composite.
  _ensureOverlay(mode) {
    if (this._overlays?.[mode]) return this._overlays[mode];
    this._overlays = this._overlays || {};
    const cfg = DARKNESS[mode];
    const [px, py] = cfg.pad || [0, 0];
    const w = VIEW.width + px * 2, h = VIEW.height + py * 2;
    const key = `darkness-${mode}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, w, h);
      const ctx = tex.getContext();
      const cx = w / 2, cy = h / 2;
      const grad = ctx.createRadialGradient(cx, cy, cfg.inner, cx, cy, cfg.outer);
      for (const [t, a] of cfg.stops) grad.addColorStop(t, `rgba(${cfg.color},${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      tex.refresh();
    }
    const ov = this.add.image(VIEW.width / 2, VIEW.height / 2, key)
      .setScrollFactor(0)
      .setDepth(-1)      // below all HUD chrome (>=0), above the game world
      .setAlpha(0)
      .setVisible(false);
    this._overlays[mode] = ov;
    // Legacy alias. Several rigs and the shutdown path reach for this by name.
    if (mode === 'ambient') this.darknessOverlay = ov;
    return ov;
  }

  // `mode` picks WHICH darkness. 'ambient' is the persistent DARKNESS room
  // modifier and is frozen as it always looked; 'blackout' is Vader's LIGHTS
  // OUT, which is a 2.6s EVENT and has to announce itself in a tenth of that.
  setDarkness(on, mode = 'ambient') {
    if (!on && !this._overlays?.[mode]) return;   // nothing to fade out
    const cfg = DARKNESS[mode];
    const ov = this._ensureOverlay(mode);
    this._darkTweens = this._darkTweens || {};
    // A chain is not a tween and `killTweensOf` does not reliably reach into
    // one, so the handle is held and stopped explicitly. Both are done anyway.
    this._darkTweens[mode]?.stop?.();
    this._darkTweens[mode]?.destroy?.();
    this._darkTweens[mode] = null;
    this.tweens.killTweensOf(ov);
    if (on) {
      ov.setVisible(true);
      if (cfg.flicker) {
        // The room loses power: a hard stutter, not a dim. First darkening
        // lands at 55ms; settled by 190ms.
        this._darkTweens[mode] = this.tweens.chain({
          targets: ov,
          tweens: [
            { alpha: 0.88, duration: 55, ease: 'Quad.easeIn' },
            { alpha: 0.30, duration: 45 },
            { alpha: 1,    duration: cfg.fadeInMs - 100, ease: 'Quad.easeOut' },
          ],
        });
      } else {
        this.tweens.add({ targets: ov, alpha: 1, duration: cfg.fadeInMs, ease: 'Sine.easeOut' });
      }
    } else {
      this.tweens.add({
        targets: ov, alpha: 0, duration: cfg.fadeOutMs, ease: 'Sine.easeIn',
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

  // Floating points off a kill. Deliberately smaller and cooler than the damage
  // numbers so a busy fight does not turn into two competing streams of digits;
  // the chain multiplier is what gets the colour, because that is the number
  // the player can actually influence.
  showScorePopup(worldX, worldY, points, label = null, mult = 1) {
    const cam = this.gameScene?.cameras?.main;
    if (!cam) return;
    // World -> screen, then into HUD space. The game camera is inset below the
    // top bar (setViewport), so its own y offset has to come back in here or
    // every popup lands 84px high.
    const sx = (worldX - cam.worldView.x) * cam.zoom + cam.x;
    const sy = (worldY - cam.worldView.y) * cam.zoom + cam.y;
    if (sx < -40 || sx > VIEW.width + 40 || sy < 0 || sy > VIEW.height) return;

    const hot = mult >= 2;
    const t = this.add.text(sx, sy, label ? `${label} +${points.toLocaleString('en-US')}` : `+${points.toLocaleString('en-US')}`, {
      fontFamily: FONTS.body,
      fontSize: hot ? '19px' : '15px',
      fontStyle: 'bold',
      color: hot ? '#ffd040' : '#cfe4ff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(34);

    this.tweens.add({
      targets: t,
      y: sy - (hot ? 54 : 38),
      alpha: 0,
      duration: hot ? 900 : 700,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // A named bonus — FLAWLESS, FAST CLEAR, ARENA CLEAR. Its own lane, so it can
  // coexist with the banner and the chain splash that fire on the same frame as
  // a wave clear.
  //
  // QUEUED, not overwritten. _awardWaveBonuses can emit FLAWLESS and FAST CLEAR
  // in the same call and a room clear adds a third; sharing one text object
  // meant the last one silently ate the others, so a perfect wave showed only
  // its speed bonus and the flawless clear was invisible.
  showMedal(name, points, color = '#ffd040') {
    this._medalQueue = this._medalQueue || [];
    this._medalQueue.push({ name, points, color });
    if (!this._medalShowing) this._drainMedals();
  }

  _drainMedals() {
    const next = this._medalQueue?.shift();
    if (!next) { this._medalShowing = false; return; }
    this._medalShowing = true;
    this._renderMedal(next.name, next.points, next.color);
    // Slightly longer than the fade below, so two medals never overlap.
    this.time.delayedCall(1000, () => this._drainMedals());
  }

  _renderMedal(name, points, color = '#ffd040') {
    // `.active` as well as existence: a destroyed Text is still a truthy object
    // and is exactly what a restart leaves behind here. Belt and braces with the
    // shutdown handler above, because this is the line that actually throws and
    // a future teardown path that forgets to null the field would crash again.
    if (!this._medalText?.active) {
      this._medalText = this.add.text(VIEW.width / 2, HUDCFG.topBarHeight + 232, ' ', {
        fontFamily: FONTS.display,
        fontSize: '26px',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(35).setAlpha(0).setResolution(2);
    }
    const m = this._medalText;
    this.tweens.killTweensOf(m);
    // Sign it properly. A penalty arrives as a negative, and "+-1,200" is what
    // a naive template produces.
    // Not every medal is worth points. The trait line and the nemesis grudge
    // line use this lane purely to say something, and "IT REMEMBERS YOUR BLOOD
    // +0" reads as a scoring bug rather than as a threat.
    const sign = points < 0 ? '-' : '+';
    const scored = points ? `  ${sign}${Math.abs(points).toLocaleString('en-US')}` : '';
    m.setText(`${name}${scored}`).setColor(color)
      .setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: m, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: m, alpha: 0, delay: 500, duration: 300 });
  }

  // Splash an "x2!", "x3!" etc combo text when chain kills happen.
  //
  // ── Why this is tiered ────────────────────────────────────────────────
  //
  // It used to draw every streak at 64px and blow it out to scale 1.5 on the
  // way out — a ~430x96 slab across the upper play area. That is the right
  // treatment for x10. It is the wrong one for x2, and x2 fires constantly:
  // _tickKillCombo splashes on EVERY chained kill from the second onward, so
  // the loudest text in the game was also the most frequent, and in a crowded
  // wave it was over the enemies for more of the fight than it was not.
  //
  // Escalation is the whole point of the counter, so the fix is to give it
  // somewhere to escalate TO rather than to turn it down. Routine streaks are
  // now quick and modest; the milestones every ten are bigger and longer than
  // anything the old flat treatment ever produced. The dopamine curve is
  // steeper, not shallower.
  showCombo(n) {
    // Reuse a single text object — kill any previous tween/state.
    if (!this.comboText) {
      // Stacked below the banner, both under the top bar — the two can fire in
      // the same instant (a multikill emits a banner AND a streak pop), so they
      // need their own lanes or they overlap into an unreadable pile.
      this.comboText = this.add.text(VIEW.width / 2, HUDCFG.topBarHeight + 146, ' ', {
        fontFamily: FONTS.display,
        fontStyle: 'bold',
        color: '#ffd040',
        stroke: '#000000',
        strokeThickness: 7,
      }).setOrigin(0.5).setDepth(35).setAlpha(0).setResolution(2);
    }
    this.tweens.killTweensOf(this.comboText);

    // SIZE TRACKS THE STREAK, and the milestone is a flourish ON TOP of that
    // — not the thing that earns the size.
    //
    // The first cut of this tiered on `n % 10 === 0`, which put x20 in the big
    // slab and x114 back in the routine one. A screenshot showed the two side
    // by side and the longer streak was visibly the smaller text: the display
    // was contradicting the achievement it was reporting. Divisibility is a
    // property of a number, not a measure of how well the player is doing.
    const milestone = n >= 10 && n % 10 === 0;
    const tier = n >= 10 ? 2 : (n >= 5 ? 1 : 0);
    const size    = [30, 46, 76][tier];
    const peak    = [1.0, 1.12, 1.3][tier];
    const holdMs  = [260, 520, 900][tier];
    const fadeMs  = [300, 500, 700][tier];
    const exit    = [1.06, 1.22, 1.62][tier];

    const colors = [null, null, '#ffd040', '#ffaa20', '#ff8020', '#ff4020', '#ff2020'];
    const col = milestone ? '#ffffff' : (colors[Math.min(colors.length - 1, n)] || '#ff2020');

    // Lane arbitration. A multikill emits its banner and this splash in the
    // same instant; the banner's exit tween grows it downward, so the splash
    // steps down out of the way when one is live rather than printing through
    // it. Milestones sit lower again — they are big enough to reach the banner
    // from the ordinary lane.
    const bannerLive = (this.banner?.alpha ?? 0) > 0.05;
    this.comboText.y = HUDCFG.topBarHeight + 146
      + (bannerLive ? 58 : 0) + (tier === 2 ? 26 : 0);

    this.comboText.setFontSize(size);
    this.comboText.setText(`x${n}!`).setColor(col);
    this.comboText.setScale(peak * 0.5).setAlpha(1);
    this.tweens.add({
      targets: this.comboText, scale: peak,
      duration: milestone ? 220 : 170, ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: this.comboText, alpha: 0, scale: exit,
      duration: fadeMs, delay: holdMs, ease: 'Cubic.easeIn',
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

  startDuel(foe) {
    if (!foe) return;
    this._duelFoe = foe;
    this._duelTint = Phaser.Display.Color.HexStringToColor(
      foe._nemesis?.tint || '#ff8020').color;
    this.duelName.setText((foe._nemesis?.name || 'NEMESIS').toUpperCase());
    this.duelName.setColor(foe._nemesis?.tint || '#ff8020');
    this.duelBar.setVisible(true);
    this.duelName.setVisible(true);
  }

  endDuel() {
    this._duelFoe = null;
    this.duelBar.setVisible(false).clear();
    this.duelName.setVisible(false);
  }

  /**
   * The duel bar. Drawn per frame from the foe's live hp rather than pushed on
   * a damage event, because damage arrives from bullets, melee, blasts and
   * regen ticks — an event-driven bar would need a hook on every one of them
   * and would silently desync the first time a new damage source was added.
   */
  _drawDuelBar() {
    const foe = this._duelFoe;
    if (!foe) return;
    // The pool recycles sprites, so a dead or reassigned foe must drop the bar
    // rather than keep rendering some other enemy's hp.
    if (!foe.active || !foe.alive || !foe._miniBoss) { this.endDuel(); return; }

    const frac = Phaser.Math.Clamp(foe.hp / (foe.hpMax || 1), 0, 1);
    const w = VIEW.width - 96;
    const h = 14;
    const x = 48;
    const y = HUDCFG.topBarHeight + 38;

    const g = this.duelBar;
    g.clear();
    // Dark bed, so the bar reads against a bright floor as well as the void.
    g.fillStyle(0x05060a, 0.85);
    g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle(0x1a1c24, 1);
    g.fillRect(x, y, w, h);
    // Fill in the nemesis's own tint — the same colour as its banner, its
    // regalia and its telegraphs, so the bar is identifiably THIS enemy's.
    g.fillStyle(this._duelTint, 1);
    g.fillRect(x, y, w * frac, h);
    // Phase pips at the thresholds where its kit changes, so the player can
    // see a transition coming instead of being surprised by it.
    g.fillStyle(0xffffff, 0.55);
    for (const t of [0.33, 0.66]) g.fillRect(x + w * t - 1, y - 2, 2, h + 4);
    g.lineStyle(2, 0x000000, 0.6);
    g.strokeRect(x, y, w, h);
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

    // THE BANNER MOVES OUT OF THE DUEL BLOCK'S WAY.
    //
    // The duel readout occupies screen y 96-139 (name at topBarHeight+12, bar
    // at +38 with its bed). The banner's home is topBarHeight+66 = 150, and a
    // 60px line centred there spans 120-180 — straight through the bar. Caught
    // in a screenshot of a nemesis fight: 'CHARGE' was drawn across the foe's
    // name and its own health bar, so the attack callout and the thing it was
    // an attack by were illegible together.
    //
    // A nemesis is exactly when a callout matters most, so the callout yields
    // rather than the bar: the fight-critical text is the one that must be
    // clean, and the bar is persistent while the banner is transient.
    const duelLive = this.duelBar?.visible;
    this.banner.y = HUDCFG.topBarHeight + (duelLive ? 112 : 66);

    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      scale: 1.05,
      duration: 220,
      onComplete: () => {
        this.tweens.add({
          targets: this.banner,
          alpha: 0,
          // 1.16, not 1.3. The exit grew a 60px line to ~78px tall and pushed
          // its bottom edge into the combo lane below, which is how MULTIKILL
          // and a combo splash ended up printed through each other.
          scale: 1.16,
          duration: 650,
          delay: 700,
        });
      },
    });
  }
}
