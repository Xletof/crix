import Phaser from 'phaser';
import { VIEW, PLAYER, WEAPONS, COLORS, HUDCFG } from '../config.js';
import { Joystick } from './Joystick.js';
import { SuperButton } from './SuperButton.js';
import { ROOMS } from '../data/rooms.js';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create({ game }) {
    this.gameScene = game;
    this.cameras.main.setRoundPixels(true);

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
        fontFamily: 'Courier New, monospace',
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
        fontFamily: 'Courier New, monospace',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ff2828',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(1, 0);

    // Lives — saber icons top-left
    this.livesGfx = this.add.graphics();
    this.drawLives(3);

    // Reinforcement countdown badge (hidden by default)
    this.reinforceGfx = this.add.graphics();
    this.reinforceText = this.add.text(VIEW.width / 2, 100, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ff4040',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    // Banner (center, transient)
    this.banner = this.add
      .text(VIEW.width / 2, VIEW.height * 0.32, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '60px',
        fontStyle: 'bold',
        color: '#ff2828',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0);

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
    this.secText = this.add.text(secX, secY + 42, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffaa40',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);

    // Super button (lightsaber hilt)
    const superY = VIEW.height - HUDCFG.joystickBottom - HUDCFG.joystickRadius - 100;
    const superX = VIEW.width - HUDCFG.joystickMargin - HUDCFG.joystickRadius * 2 - 50;
    this.superButton = new SuperButton(this, {
      x: superX,
      y: superY,
      onAim: (v) => this.gameScene?.player?.setSuperAimInput(v),
      onRelease: (v) => this.gameScene?.player?.releaseSuperAim(v),
      isReady: () =>
        !!this.gameScene?.player &&
        this.gameScene.player.superCharge >= PLAYER.superHitsToCharge,
    });

    // Joysticks
    this.moveStick = new Joystick(this, 'left', {
      onMove: (v) => this.gameScene?.player?.setMoveInput(v),
      onEnd: () => this.gameScene?.player?.setMoveInput({ x: 0, y: 0, force: 0 }),
    });
    this.fireStick = new Joystick(this, 'right', {
      shouldClaim: (pointer) => !this.superButton.containsPoint(pointer.x, pointer.y),
      onStart: () => this.gameScene?.player?.setAimInput({ x: 0, y: 0, force: 0 }),
      onMove: (v) => {
        this.gameScene?.player?.setAimInput(v);
      },
      onEnd: (v) => this.gameScene?.player?.releaseAim(v),
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
      fontFamily: 'Courier New, monospace',
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

    // Keyboard fallback
    this.input.keyboard?.on('keydown-SPACE', () => this.gameScene?.player?.tryFireSuper());

    // Events
    const ge = this.gameScene.events;
    ge.on('player-hp-changed',    this.refreshHp,    this);
    ge.on('player-hurt',          this.refreshHp,    this);
    ge.on('player-ammo-changed',  this.refreshAmmo,  this);
    ge.on('player-fire',          this.refreshAmmo,  this);
    ge.on('player-super-changed', this.refreshSuper, this);
    ge.on('player-super-ready',   this.refreshSuper, this);
    ge.on('room-start',           (n, total, spec) => this.refreshChamber(n, total, spec));
    ge.on('boss-start',           ()               => this.showBanner('VADER APPROACHES', '#ff2828'));
    ge.on('boss-phase',           ()               => this.showBanner('ENRAGED!', '#ff8888'));
    ge.on('show-banner',          (text, color)    => this.showBanner(text, color));
    ge.on('lives-changed',        (n)              => this.drawLives(n));
    ge.on('secondary-equipped',     (id)           => this.refreshSecondary(id));
    ge.on('secondary-ammo-changed', ()             => this.refreshSecondary());
    ge.on('reinforce-tick',         (secs)         => this.refreshReinforce(secs));
    ge.on('reinforce-spawn',        ()             => this.onReinforceSpawn());
    ge.on('takedown-available',     (avail)        => this.setTakedownVisible(avail));

    this.events.on('shutdown', () => {
      ge.off('player-hp-changed',    this.refreshHp,    this);
      ge.off('player-hurt',          this.refreshHp,    this);
      ge.off('player-ammo-changed',  this.refreshAmmo,  this);
      ge.off('player-fire',          this.refreshAmmo,  this);
      ge.off('player-super-changed', this.refreshSuper, this);
      ge.off('player-super-ready',   this.refreshSuper, this);
      ge.off('room-start');
      ge.off('boss-start');
      ge.off('boss-phase');
      ge.off('show-banner');
      ge.off('lives-changed');
      ge.off('secondary-equipped');
      ge.off('secondary-ammo-changed');
      ge.off('reinforce-tick');
      ge.off('reinforce-spawn');
      ge.off('takedown-available');
      this.moveStick?.shutdown();
      this.fireStick?.shutdown();
      this.superButton?.shutdown();
    });

    this.refreshHp();
    this.refreshAmmo();
    this.refreshSuper();
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
    for (let i = 0; i < this.ammoPips.length; i++) {
      const pip = this.ammoPips[i];
      pip.clear();
      const loaded = i < p.ammo;
      const reloading = !loaded && i === p.ammo && p.ammoTimers.length > 0;

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

  refreshSuper() {
    const p = this.gameScene.player;
    if (!p) return;
    const ready = p.superCharge >= PLAYER.superHitsToCharge;
    this.superButton.setReady(ready);
    this.superButton.drawGauge(p.superCharge, PLAYER.superHitsToCharge);
  }

  refreshChamber(n, total, spec) {
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

  refreshReinforce(secs) {
    const g  = this.reinforceGfx;
    g.clear();
    if (secs <= 0) {
      this.reinforceText.setAlpha(0);
      return;
    }
    const cx = VIEW.width / 2;
    const cy = 100;
    const w  = 280, h = 36;
    // Pulse intensity based on time remaining
    const urgent = secs <= 5;
    const t = (this.time.now * (urgent ? 0.018 : 0.008)) % (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(t);
    const col = urgent ? 0xff2020 : 0xff8020;

    g.fillStyle(0x0a0c14, 0.85);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
    g.lineStyle(2, col, 0.6 + pulse * 0.4);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);

    this.reinforceText.setAlpha(1);
    this.reinforceText.setColor(urgent ? '#ff2020' : '#ff8040');
    this.reinforceText.setText(`⚠ REINFORCEMENTS INBOUND  ${secs}s`);
  }

  onReinforceSpawn() {
    this.reinforceGfx.clear();
    this.reinforceText.setAlpha(0);
    this.showBanner('REINFORCEMENTS!', '#ff2020');
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

    const ICON = { rifle: 'pickup-rifle', flamethrower: 'pickup-flamer', detonator: 'pickup-det' };
    const NAMES = { rifle: 'DC-15', flamethrower: 'FLAMER', detonator: 'DET.' };
    const COLS  = { rifle: 0xff8010, flamethrower: 0xff4010, detonator: 0xff2020 };

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
    const maxAmmo = id === 'rifle' ? 27 : id === 'flamethrower' ? 100 : 3;
    const ratio   = Math.max(0, ammo / maxAmmo);
    g.fillStyle(0x1a1c22, 1);
    g.fillRoundedRect(cx - 38, cy + 26, 76, 8, 3);
    g.fillStyle(col, 1);
    g.fillRoundedRect(cx - 38, cy + 26, 76 * ratio, 8, 3);

    const label = id === 'rifle' ? `${ammo}` : id === 'flamethrower' ? `${ammo}%` : `×${ammo}`;
    this.secText.setText(`${NAMES[id]}  ${label}`);
    this.secText.setPosition(cx, cy + 44);
  }

  update(time, delta) {
    if (this.gameScene?.player && this.gameScene.player.ammoTimers.length > 0) {
      this.refreshAmmo();
    }
    // Flamethrower: drain is continuous, refresh every frame while active
    if (this.gameScene?.player?.flameActive) {
      this.refreshSecondary();
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
