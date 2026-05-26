import Phaser from 'phaser';
import { VIEW, PLAYER, COLORS, HUDCFG } from '../config.js';
import { Joystick } from './Joystick.js';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create({ game }) {
    this.gameScene = game;
    this.cameras.main.setRoundPixels(true);

    // --- Top bar background ---
    const top = this.add.graphics();
    top.fillStyle(0x000000, 0.4);
    top.fillRect(0, 0, VIEW.width, 84);

    // HP bar
    this.hpBack = this.add.graphics();
    this.hpFront = this.add.graphics();
    this.hpText = this.add
      .text(VIEW.width / 2, 30, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Wave label (right)
    this.waveText = this.add
      .text(VIEW.width - 20, 16, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0);

    // Banner (center, transient)
    this.banner = this.add
      .text(VIEW.width / 2, VIEW.height * 0.32, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#000000',
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

    // Super button
    const superY =
      VIEW.height - HUDCFG.joystickBottom - HUDCFG.joystickRadius - 100;
    const superX = VIEW.width - HUDCFG.joystickMargin - HUDCFG.joystickRadius * 2 - 50;
    this.superBtn = this.add
      .image(superX, superY, 'super-btn-off')
      .setDepth(40)
      .setInteractive({ useHandCursor: true });
    this.superBtn.on('pointerdown', () => {
      if (this.gameScene?.player) this.gameScene.player.tryFireSuper();
    });
    this.superGauge = this.add.graphics().setDepth(41);

    // Joysticks
    this.moveStick = new Joystick(this, 'left', {
      onMove: (v) => this.gameScene?.player?.setMoveInput(v),
      onEnd: () => this.gameScene?.player?.setMoveInput({ x: 0, y: 0, force: 0 }),
    });
    this.fireStick = new Joystick(this, 'right', {
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
    for (let i = 0; i < this.ammoPips.length; i++) {
      const pip = this.ammoPips[i];
      pip.clear();
      const loaded = i < p.ammo;
      const reloading = !loaded && i === p.ammo && p.ammoTimers.length > 0;
      pip.fillStyle(0x000000, 0.5);
      pip.fillCircle(0, 0, 11);
      if (loaded) {
        pip.fillStyle(COLORS.ammoOn, 1);
        pip.fillCircle(0, 0, 9);
      } else if (reloading) {
        const max = PLAYER.ammoReloadMs;
        const t = Math.max(0, max - p.ammoTimers[0]);
        const r = t / max;
        pip.fillStyle(COLORS.ammoOff, 1);
        pip.fillCircle(0, 0, 9);
        pip.fillStyle(COLORS.ammoOn, 1);
        pip.slice(0, 0, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r, false);
        pip.fillPath();
      } else {
        pip.fillStyle(COLORS.ammoOff, 1);
        pip.fillCircle(0, 0, 9);
      }
    }
  }

  refreshSuper() {
    const p = this.gameScene.player;
    if (!p) return;
    const ready = p.superCharge >= PLAYER.superHitsToCharge;
    this.superBtn.setTexture(ready ? 'super-btn' : 'super-btn-off');
    this.superGauge.clear();
    if (!ready) {
      const r = p.superCharge / PLAYER.superHitsToCharge;
      const cx = this.superBtn.x;
      const cy = this.superBtn.y;
      const radius = 56;
      this.superGauge.lineStyle(6, COLORS.superGauge, 0.95);
      this.superGauge.beginPath();
      this.superGauge.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r, false);
      this.superGauge.strokePath();
    } else {
      // Pulse outline
      const cx = this.superBtn.x;
      const cy = this.superBtn.y;
      this.superGauge.lineStyle(5, COLORS.superReady, 1);
      this.superGauge.strokeCircle(cx, cy, 58);
    }
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
