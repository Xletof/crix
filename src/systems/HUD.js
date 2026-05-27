import Phaser from 'phaser';
import { VIEW, PLAYER, COLORS, HUDCFG } from '../config.js';
import { Joystick } from './Joystick.js';
import { SuperButton } from './SuperButton.js';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create({ game }) {
    this.gameScene = game;
    this.cameras.main.setRoundPixels(true);

    // --- Top bar background — leather strap look ---
    const top = this.add.graphics();
    top.fillStyle(0x2a1810, 0.78);       // dark leather
    top.fillRect(0, 0, VIEW.width, 84);
    top.fillStyle(0xb07820, 0.5);        // brass band at bottom
    top.fillRect(0, 80, VIEW.width, 3);
    top.fillStyle(0x6a3a20, 0.6);        // mid-leather highlight
    top.fillRect(0, 0, VIEW.width, 2);

    // HP bar
    this.hpBack = this.add.graphics();
    this.hpFront = this.add.graphics();
    this.hpText = this.add
      .text(VIEW.width / 2, 30, '', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#f0e0b8',
        stroke: '#1a0a04',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Wave label (right)
    this.waveText = this.add
      .text(VIEW.width - 20, 16, '', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffd040',
        stroke: '#1a0a04',
        strokeThickness: 4,
      })
      .setOrigin(1, 0);

    // Banner (center, transient)
    this.banner = this.add
      .text(VIEW.width / 2, VIEW.height * 0.32, '', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffd040',
        stroke: '#1a0a04',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Ammo pips (above the right joystick)
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

    // Super button as a drag-aim widget.
    const superY =
      VIEW.height - HUDCFG.joystickBottom - HUDCFG.joystickRadius - 100;
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

    // Joysticks — right one yields any pointer that started on the super button.
    this.moveStick = new Joystick(this, 'left', {
      onMove: (v) => this.gameScene?.player?.setMoveInput(v),
      onEnd: () => this.gameScene?.player?.setMoveInput({ x: 0, y: 0, force: 0 }),
    });
    this.fireStick = new Joystick(this, 'right', {
      shouldClaim: (pointer) => !this.superButton.containsPoint(pointer.x, pointer.y),
      onStart: () => this.gameScene?.player?.setAimInput({ x: 0, y: 0, force: 0 }),
      onMove: (v) => {
        this.gameScene?.player?.setAimInput(v);
        // Auto-fire while held
        if (v.force > 0.1) this.gameScene?.player?.tryFire();
      },
      onEnd: (v) => this.gameScene?.player?.releaseAim(v),
    });

    // Keyboard fallback (desktop)
    this.input.keyboard?.on('keydown-SPACE', () => this.gameScene?.player?.tryFireSuper());

    // React to gameplay events
    const ge = this.gameScene.events;
    ge.on('player-hp-changed', this.refreshHp, this);
    ge.on('player-hurt', this.refreshHp, this);
    ge.on('player-ammo-changed', this.refreshAmmo, this);
    ge.on('player-fire', this.refreshAmmo, this);
    ge.on('player-super-changed', this.refreshSuper, this);
    ge.on('player-super-ready', this.refreshSuper, this);
    ge.on('wave-start', (n, total) => this.showBanner(`WAVE ${n} / ${total}`));
    ge.on('boss-start', () => this.showBanner('BOSS', '#ff4d6d'));
    ge.on('boss-phase', (p) => this.showBanner(`ENRAGED!`, '#ffe066'));

    // Tear down on shutdown
    this.events.on('shutdown', () => {
      ge.off('player-hp-changed', this.refreshHp, this);
      ge.off('player-hurt', this.refreshHp, this);
      ge.off('player-ammo-changed', this.refreshAmmo, this);
      ge.off('player-fire', this.refreshAmmo, this);
      ge.off('player-super-changed', this.refreshSuper, this);
      ge.off('player-super-ready', this.refreshSuper, this);
      ge.off('wave-start');
      ge.off('boss-start');
      ge.off('boss-phase');
      this.moveStick?.shutdown();
      this.fireStick?.shutdown();
      this.superButton?.shutdown();
    });

    this.refreshHp();
    this.refreshAmmo();
    this.refreshSuper();
    this.refreshWave(1, 3);
    ge.on('wave-start', (n, total) => this.refreshWave(n, total));
  }

  refreshHp() {
    const p = this.gameScene.player;
    if (!p) return;
    const ratio = Math.max(0, Math.min(1, p.hp / p.hpMax));
    const w = 380;
    const h = 22;
    const x = (VIEW.width - w) / 2;
    const y = 20;
    this.hpBack.clear();
    this.hpBack.fillStyle(0x000000, 0.6);
    this.hpBack.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 6);
    this.hpBack.fillStyle(COLORS.hpBack, 1);
    this.hpBack.fillRoundedRect(x, y, w, h, 4);
    this.hpFront.clear();
    const col = ratio > 0.35 ? COLORS.hpFront : COLORS.hpLow;
    this.hpFront.fillStyle(col, 1);
    this.hpFront.fillRoundedRect(x, y, w * ratio, h, 4);
    this.hpText.setText(`${Math.ceil(p.hp)} / ${p.hpMax}`);
  }

  refreshAmmo() {
    const p = this.gameScene.player;
    if (!p) return;
    // Draw each ammo slot as a bullet shell standing upright (rectangle + tip)
    for (let i = 0; i < this.ammoPips.length; i++) {
      const pip = this.ammoPips[i];
      pip.clear();
      const loaded = i < p.ammo;
      const reloading = !loaded && i === p.ammo && p.ammoTimers.length > 0;
      // Dark holster slot (always visible)
      pip.fillStyle(0x1a0a04, 0.85);
      pip.fillRoundedRect(-7, -14, 14, 28, 3);
      pip.lineStyle(2, 0x6a3a20, 0.9);
      pip.strokeRoundedRect(-7, -14, 14, 28, 3);
      if (loaded) {
        // Gold brass casing
        pip.fillStyle(COLORS.ammoOn, 1);
        pip.fillRect(-5, -8, 10, 18);
        // Copper tip
        pip.fillStyle(0xff7020, 1);
        pip.fillTriangle(-5, -8, 5, -8, 0, -14);
        // Highlight stripe
        pip.fillStyle(0xfff4b8, 0.7);
        pip.fillRect(-4, -6, 1, 14);
      } else if (reloading) {
        const max = PLAYER.ammoReloadMs;
        const t = Math.max(0, max - p.ammoTimers[0]);
        const r = t / max;
        // Empty silhouette
        pip.fillStyle(0x2a1810, 1);
        pip.fillRect(-5, -8, 10, 18);
        // Filling shell from bottom up
        const filled = Math.round(18 * r);
        pip.fillStyle(COLORS.ammoOn, 1);
        pip.fillRect(-5, 10 - filled, 10, filled);
      } else {
        // Empty
        pip.fillStyle(0x2a1810, 1);
        pip.fillRect(-5, -8, 10, 18);
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

  refreshWave(n, total) {
    this.waveText.setText(total ? `WAVE ${n}/${total}` : `BOSS`);
  }

  update(time, delta) {
    // Live-update reloading pip so the player sees fill animate
    if (this.gameScene?.player && this.gameScene.player.ammoTimers.length > 0) {
      this.refreshAmmo();
    }
  }

  showBanner(text, color = '#ffe066') {
    this.banner.setText(text);
    this.banner.setColor(color);
    this.banner.setAlpha(0);
    this.banner.setScale(0.6);
    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      scale: 1.05,
      duration: 220,
      yoyo: false,
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
