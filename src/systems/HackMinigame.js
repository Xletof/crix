import { VIEW } from '../config.js';
import { SFX } from './FX.js';

// Three-round Imperial-cipher timing puzzle. The cursor sweeps a horizontal
// bar; the player must tap when the cursor is inside the highlighted safe
// zone. Each successful round narrows the zone and speeds the cursor; three
// in a row = terminal sliced. Missing a tap fires the room alarm and resets
// to round 1 (no damage — failure is social, not mechanical).
//
// State machine:
//   idle    — not visible
//   active  — bar live, waiting for tap
//   success — round passed, briefly green-flashing before next round
//   fail    — round failed, red-flashing klaxon before restart
//   done    — all 3 rounds passed; closing
//
// Owns no game-state — emits events on the GameScene events bus:
//   'hack-success' (terminal)
//   'hack-fail'    (terminal)
// HackMinigame is owned by HUDScene and ticked from its update().

const ROUNDS = [
  { zone: 0.34, speed: 0.0011 },  // wide & slow   — generous warm-up
  { zone: 0.24, speed: 0.0015 },  // medium        — pay attention
  { zone: 0.18, speed: 0.0018 },  // narrow & fast — fair skill check
];

const BAR_W = 540, BAR_H = 36;
const BAR_Y = VIEW.height * 0.42;

export class HackMinigame {
  constructor(hudScene) {
    this.hud = hudScene;
    this.state = 'idle';
    this.terminal = null;
    this.round = 0;
    this.cursor = 0;
    this.cursorSpeed = 0;
    this.zoneStart = 0;
    this.zoneEnd = 0;
    this.stateTimer = 0;
    this.flashAlpha = 0;

    // ── Visuals (start hidden) ──────────────────────────────────────────
    this.container = hudScene.add.container(VIEW.width / 2, BAR_Y).setDepth(40);
    this.bgGfx     = hudScene.add.graphics();
    this.barGfx    = hudScene.add.graphics();
    this.cursorGfx = hudScene.add.graphics();
    this.flashGfx  = hudScene.add.graphics();
    this.headerText = hudScene.add.text(0, -84, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd040',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.subText = hudScene.add.text(0, -52, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#aaaa88',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.hintText = hudScene.add.text(0, 56, 'TAP TO LOCK', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffd040',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.container.add([this.bgGfx, this.barGfx, this.cursorGfx, this.flashGfx,
                        this.headerText, this.subText, this.hintText]);
    this.container.setAlpha(0).setActive(false).setVisible(false);

    // ── Tap zone (covers the bar area only; avoids joysticks) ─────────────
    // Joysticks sit in the bottom 200px; bar+text occupy roughly y=270..620.
    this.tapZone = hudScene.add.zone(VIEW.width / 2, BAR_Y, VIEW.width, 280)
      .setOrigin(0.5)
      .setDepth(39);
    this.tapZone.setVisible(false);
    this.tapZone.on('pointerdown', () => this.handleTap());
    // Desktop fallback
    this._spaceKey = hudScene.input.keyboard?.on('keydown-ENTER', () => this.handleTap());
    this._spaceKey2 = hudScene.input.keyboard?.on('keydown-F', () => this.handleTap());
  }

  // GameScene calls this when the player enters a terminal's radius.
  start(terminal) {
    if (this.state !== 'idle' && this.terminal === terminal) return; // already running
    this.terminal = terminal;
    this.round = 1;
    this._setupRound();
    this.container.setAlpha(1).setActive(true).setVisible(true);
    this.tapZone.setVisible(true);
    this.tapZone.setInteractive();
  }

  // GameScene calls this when the player walks out of range (or terminal dies).
  cancel() {
    if (this.state === 'idle') return;
    this._close();
  }

  _setupRound() {
    const cfg = ROUNDS[Math.min(ROUNDS.length - 1, this.round - 1)];
    // Random starting direction so muscle memory can't trivialise rounds.
    this.cursorSpeed = cfg.speed * (Math.random() < 0.5 ? 1 : -1);
    this.cursor = 0.5;
    // Safe zone placed somewhere in the middle 70% of the bar so it's never
    // pinned to an edge (which would let players just slam-tap at the wall).
    const innerSpan = 0.7 - cfg.zone;
    this.zoneStart = 0.15 + Math.random() * Math.max(0, innerSpan);
    this.zoneEnd   = this.zoneStart + cfg.zone;
    this.state = 'active';
    this.stateTimer = 0;
    this.headerText.setText(`SLICE  ${this.round}/3`);
    this.subText.setText(['ICE: STANDARD', 'ICE: HARDENED', 'ICE: BLACK'][this.round - 1]);
    this.headerText.setColor('#ffd040');
  }

  handleTap() {
    if (this.state !== 'active') return;
    const inZone = this.cursor >= this.zoneStart && this.cursor <= this.zoneEnd;
    if (inZone) {
      SFX.hackTick();
      this.state = 'success';
      this.stateTimer = 220;
      this.flashAlpha = 0.6;
      this.flashColor = 0x40ff80;
    } else {
      SFX.alarm();
      this.state = 'fail';
      this.stateTimer = 700;
      this.flashAlpha = 0.7;
      this.flashColor = 0xff2828;
      this.headerText.setText(`TRACE — ROUND 1/3`);
      this.headerText.setColor('#ff4040');
      // Tell the world we got pinged.
      this.hud.gameScene?.events.emit('hack-fail', this.terminal);
    }
  }

  update(delta) {
    if (this.state === 'idle') return;

    if (this.state === 'active') {
      this.cursor += this.cursorSpeed * delta;
      if (this.cursor < 0) { this.cursor = 0; this.cursorSpeed = -this.cursorSpeed; }
      if (this.cursor > 1) { this.cursor = 1; this.cursorSpeed = -this.cursorSpeed; }
    } else if (this.state === 'success') {
      this.stateTimer -= delta;
      this.flashAlpha = Math.max(0, this.flashAlpha - delta * 0.003);
      if (this.stateTimer <= 0) {
        if (this.round >= 3) {
          this._complete();
          return;
        }
        this.round += 1;
        this._setupRound();
      }
    } else if (this.state === 'fail') {
      this.stateTimer -= delta;
      this.flashAlpha = Math.max(0, this.flashAlpha - delta * 0.0015);
      if (this.stateTimer <= 0) {
        this.round = 1;
        this._setupRound();
      }
    }

    this._draw();
  }

  _draw() {
    // ── Backdrop card behind the bar ────────────────────────────────────
    const bg = this.bgGfx;
    bg.clear();
    bg.fillStyle(0x06060c, 0.78);
    bg.fillRoundedRect(-BAR_W / 2 - 24, -110, BAR_W + 48, 200, 8);
    bg.lineStyle(2, 0x0080ff, 0.7);
    bg.strokeRoundedRect(-BAR_W / 2 - 24, -110, BAR_W + 48, 200, 8);

    // ── Bar ──────────────────────────────────────────────────────────────
    const b = this.barGfx;
    b.clear();
    // Track
    b.fillStyle(0x0a0e18, 1);
    b.fillRoundedRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, 4);
    b.lineStyle(2, 0x1a2a44, 1);
    b.strokeRoundedRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, 4);
    // Safe zone
    const zx = -BAR_W / 2 + this.zoneStart * BAR_W;
    const zw = (this.zoneEnd - this.zoneStart) * BAR_W;
    const zoneColor = this.state === 'fail' ? 0x802020 : 0x20a040;
    b.fillStyle(zoneColor, 0.85);
    b.fillRoundedRect(zx, -BAR_H / 2 + 3, zw, BAR_H - 6, 3);
    b.fillStyle(0x80ffaa, this.state === 'fail' ? 0.15 : 0.4);
    b.fillRect(zx, -BAR_H / 2 + 3, zw, 3); // top sheen
    // Tick marks
    b.lineStyle(1, 0x244, 0.6);
    for (let i = 1; i < 10; i++) {
      b.beginPath();
      b.moveTo(-BAR_W / 2 + (BAR_W / 10) * i, -BAR_H / 2 + 4);
      b.lineTo(-BAR_W / 2 + (BAR_W / 10) * i, BAR_H / 2 - 4);
      b.strokePath();
    }

    // ── Cursor ──────────────────────────────────────────────────────────
    const c = this.cursorGfx;
    c.clear();
    const cx = -BAR_W / 2 + this.cursor * BAR_W;
    const cursorCol = this.state === 'fail' ? 0xff4040 : 0xffffff;
    c.fillStyle(cursorCol, 0.5);
    c.fillRect(cx - 4, -BAR_H / 2 - 4, 8, BAR_H + 8); // glow
    c.fillStyle(cursorCol, 1);
    c.fillRect(cx - 1, -BAR_H / 2 - 6, 2, BAR_H + 12); // core line

    // ── Flash overlay (round-result feedback) ──────────────────────────
    const fl = this.flashGfx;
    fl.clear();
    if (this.flashAlpha > 0) {
      fl.fillStyle(this.flashColor, this.flashAlpha);
      fl.fillRoundedRect(-BAR_W / 2 - 24, -110, BAR_W + 48, 200, 8);
    }

    // Pip dots for round progress (above bar)
    const pipY = -34;
    for (let i = 0; i < 3; i++) {
      const px = -36 + i * 36;
      const lit = i + 1 < this.round || (i + 1 === this.round && this.state === 'success');
      b.fillStyle(lit ? 0x40ff80 : 0x2a2a3a, 1);
      b.fillCircle(px, pipY, 6);
      b.lineStyle(2, lit ? 0x80ffaa : 0x444, 0.9);
      b.strokeCircle(px, pipY, 6);
    }
  }

  _complete() {
    SFX.hackComplete();
    this.hud.gameScene?.events.emit('hack-success', this.terminal);
    this._close();
  }

  _close() {
    this.state = 'idle';
    this.terminal = null;
    this.container.setAlpha(0).setActive(false).setVisible(false);
    this.tapZone.setVisible(false);
    this.tapZone.disableInteractive();
  }

  shutdown() {
    this.container?.destroy();
    this.tapZone?.destroy();
  }
}
