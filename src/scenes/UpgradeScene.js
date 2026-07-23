import Phaser from 'phaser';
import { VIEW, FONTS } from '../config.js';
import { SFX } from '../systems/FX.js';
import { pickThree } from '../data/upgrades.js';

// Overlay scene launched on top of a paused Game + HUD after a room clear.
// Mirrors PauseScene's launch/pause pattern exactly (its own live input,
// scenes beneath frozen). Picking a card applies the upgrade to the
// (persistent) Player instance, resumes play, and opens the room's door —
// the door was deliberately left shut by GameScene until a pick is made.
export class UpgradeScene extends Phaser.Scene {
  constructor() {
    super('Upgrade');
  }

  create(data) {
    this.gs = data?.game || null;
    const cx = VIEW.width / 2;
    this._closing = false;

    // Dim backdrop
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.7);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    for (let y = 0; y < VIEW.height; y += 6) {
      g.fillStyle(0x0040aa, 0.03);
      g.fillRect(0, y, VIEW.width, 2);
    }

    // Header
    this.add.text(cx, VIEW.height * 0.12, 'UPGRADE ACQUIRED', {
      fontFamily: FONTS.display,
      fontSize: '42px', fontStyle: 'bold',
      color: '#40ff90', stroke: '#000000', strokeThickness: 8, letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(cx, VIEW.height * 0.12 + 48, 'CHOOSE ONE', {
      fontFamily: FONTS.body,
      fontSize: '20px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 3, letterSpacing: 3,
    }).setOrigin(0.5);

    // Three cards, stacked
    const cards = pickThree();
    const cardW = 600, cardH = 190, gap = 26;
    const totalH = cardH * cards.length + gap * (cards.length - 1);
    const startY = VIEW.height * 0.24 + (VIEW.height * 0.62 - totalH) / 2;

    cards.forEach((up, i) => {
      const cy = startY + i * (cardH + gap) + cardH / 2;
      this._card(cx, cy, cardW, cardH, up);
    });

    this.cameras.main.fadeIn(150, 0, 0, 0);
  }

  // A tappable upgrade card: colored glass border, name + description, pop on
  // pick. Returns nothing — self-contained interactive element.
  _card(cx, cy, w, h, up) {
    const colorNum = Phaser.Display.Color.HexStringToColor(up.color).color;
    const bg = this.add.graphics();

    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.5);
      bg.fillRoundedRect(cx - w / 2 + 4, cy - h / 2 + 5, w, h, 10);
      bg.fillStyle(hover ? 0x1c2230 : 0x0c101d, 0.92);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
      bg.lineStyle(hover ? 4 : 3, colorNum, hover ? 1 : 0.65);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
      bg.fillStyle(colorNum, hover ? 0.16 : 0.08);
      bg.fillRoundedRect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, 12, 5);
    };
    draw(false);

    const name = this.add.text(cx, cy - 26, up.name, {
      fontFamily: FONTS.display,
      fontSize: '30px', fontStyle: 'bold',
      color: up.color, stroke: '#000000', strokeThickness: 5, letterSpacing: 2,
    }).setOrigin(0.5);

    const desc = this.add.text(cx, cy + 26, up.desc, {
      fontFamily: FONTS.body,
      fontSize: '20px',
      color: '#c0d8f0', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    const zone = this.add.zone(cx, cy, w, h).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => draw(true));
    zone.on('pointerup', () => this._pick(up, [bg, name, desc, zone]));

    return { bg, name, desc, zone };
  }

  _pick(up, nodes) {
    if (this._closing || !this.gs) return;
    this._closing = true;
    SFX.superReady();

    up.apply(this.gs.player);
    this.gs.player._upgrades.push(up.id);

    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.resume('Game');
      this.scene.resume('HUD');
      this.gs._openDoor();
      this.scene.stop();
    });
  }
}
