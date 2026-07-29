import Phaser from 'phaser';
import { VIEW, FONTS, HUDCFG } from '../config.js';
import { SFX } from '../systems/FX.js';
import {
  CONTROL_IDS,
  SCALE_MIN,
  SCALE_MAX,
  getControl,
  setControl,
  resetControls,
} from '../systems/controlLayout.js';

// Touch-control layout editor, opened from Pause > CONTROLS.
//
// Drag a control to move it, then use the SIZE slider to resize the selected
// one. Everything is written straight through to controlLayout.js (which
// persists), and HUD.applyControlLayout() picks it up when this closes — so a
// layout edited mid-run applies without a restart.
//
// Two things it deliberately does NOT do:
//
//  * It does not rebind which half of the screen each stick claims. The sticks
//    float: they re-anchor under your thumb on touch, so their x/y is only a
//    resting spot. That is why the store clamps each stick to its own half —
//    showing one where it can never be dragged would be a lie.
//  * It has no live game underneath. Game and HUD stay paused, exactly as they
//    are under the pause and debug overlays, so the proxies below are drawn
//    from the same textures rather than being the real widgets.
//
// Pointer routing note: Phaser emits a Game Object's `pointerdown` BEFORE the
// scene-level one, so a "did I grab a control this gesture?" flag set in the
// global handler is not yet set when the card's zones run. The card guards
// itself by hit-testing the controls directly (_controlAt) instead.
export class ControlsScene extends Phaser.Scene {
  constructor() {
    super('Controls');
  }

  create(data) {
    this.gs = data?.game || null;
    // Phaser reuses this instance on every launch — same trap PauseScene
    // documents. Reset every piece of gesture state here, not just _closing.
    this._closing = false;
    this._dragId = null;
    this._dragCtrl = null;
    this._grabDX = 0;
    this._grabDY = 0;
    this._sliderDrag = false;
    this.selected = CONTROL_IDS[0];

    const cx = VIEW.width / 2;

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.72);
    g.fillRect(0, 0, VIEW.width, VIEW.height);

    // Half-screen divider: which stick claims which side is fixed, and this is
    // the only thing on screen that says so.
    this.add.graphics().lineStyle(2, 0x0050cc, 0.35)
      .lineBetween(cx, HUDCFG.topBarHeight, cx, VIEW.height);

    // Card kept in the top third: everything the player is arranging lives in
    // the bottom two thirds, so chrome up here never sits under a thumb.
    const cardW = 640, cardH = 342;
    const cardX = cx - cardW / 2, cardY = 56;
    g.fillStyle(0x0c101d, 0.9);
    g.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    g.lineStyle(3.5, 0x00a0ff, 0.45);
    g.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);

    this.add.text(cx, cardY + 44, 'CONTROLS', {
      fontFamily: FONTS.display,
      fontSize: '44px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 7, letterSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(cx, cardY + 82, 'DRAG A CONTROL TO MOVE IT', {
      fontFamily: FONTS.body, fontSize: '17px', fontStyle: 'bold',
      color: '#7fa8c8', letterSpacing: 2,
    }).setOrigin(0.5);
    this.add.text(cx, cardY + 104, 'STICKS FLOAT — THIS SETS WHERE THEY REST', {
      fontFamily: FONTS.body, fontSize: '15px',
      color: '#5d7d96', letterSpacing: 1,
    }).setOrigin(0.5);

    // Selected-control readout, above the size slider it drives.
    this.selText = this.add.text(cx, cardY + 142, '', {
      fontFamily: FONTS.body, fontSize: '22px', fontStyle: 'bold',
      color: '#ffd040', stroke: '#000000', strokeThickness: 3, letterSpacing: 3,
    }).setOrigin(0.5);

    this._buildSlider(cx, cardY + 208);

    this._button(cx - 158, cardY + 288, 'RESET', () => this._reset(), 288);
    this._button(cx + 158, cardY + 288, 'DONE', () => this._close(), 288);

    // ── Proxies ────────────────────────────────────────────────────────────
    // Selection ring under the proxies so a highlighted control still reads.
    this.ringGfx = this.add.graphics().setDepth(5);
    // Blank the real widgets underneath: two sets of controls on screen at once
    // reads as clutter, and the stale pair is the one you cannot drag.
    this.scene.get('HUD')?.setTouchControlsVisible?.(false);
    this.proxies = {};
    for (const id of CONTROL_IDS) this.proxies[id] = this._buildProxy(id);
    this._refresh();

    this.input.on('pointerdown', this._onDown, this);
    this.input.on('pointermove', this._onMove, this);
    this.input.on('pointerup', this._onUp, this);
    this.input.on('pointerupoutside', this._onUp, this);

    this.input.keyboard?.on('keydown-ESC', () => this._close());
    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  // ── Proxies ──────────────────────────────────────────────────────────────

  // A stand-in drawn from the same texture as the real widget, at the same
  // size, so what you arrange here is what you get in the HUD. Sticks get their
  // knob too — without it a bare ring reads as a target, not a stick.
  _buildProxy(id) {
    const c = getControl(id);
    const img = this.add.image(c.x, c.y, c.tex).setDepth(6).setAlpha(0.92);
    const knob = c.tex === 'joystick-base'
      ? this.add.image(c.x, c.y, 'joystick-knob').setDepth(7).setAlpha(0.9)
      : null;
    const label = this.add.text(c.x, c.y, c.label, {
      fontFamily: FONTS.body, fontSize: '15px', fontStyle: 'bold',
      color: '#c8e8ff', stroke: '#000000', strokeThickness: 4, letterSpacing: 2,
    }).setOrigin(0.5).setDepth(8);
    return { img, knob, label };
  }

  _placeProxy(id) {
    const c = getControl(id);
    const p = this.proxies[id];
    // joystick-base is a 220px texture and joystick-knob a 100px one; the HUD
    // scales them by radius/110 and knobRadius/50 respectively. Mirror that or
    // the preview lies about the size.
    if (p.knob) {
      p.img.setPosition(c.x, c.y).setScale(c.radius / 110);
      p.knob.setPosition(c.x, c.y).setScale((HUDCFG.joystickKnobRadius * c.scale) / 50);
    } else {
      p.img.setPosition(c.x, c.y).setScale(c.scale);
    }
    // Label below, unless that would run off the bottom edge — a stick resting
    // in its default corner is 130px tall and its caption would be off screen.
    const below = c.y + c.radius + 14;
    p.label.setPosition(c.x, below > VIEW.height - 14 ? c.y - c.radius - 14 : below);
  }

  _refresh() {
    for (const id of CONTROL_IDS) this._placeProxy(id);
    const sel = getControl(this.selected);
    this.selText.setText(`${sel.label}   ${Math.round(sel.scale * 100)}%`);
    this._drawSlider(this._scaleToFrac(sel.scale), this._sliderDrag);

    const r = this.ringGfx;
    r.clear();
    r.lineStyle(3, 0xffd040, 0.9);
    r.strokeCircle(sel.x, sel.y, sel.radius + 10);
    r.lineStyle(1.5, 0xffd040, 0.35);
    r.strokeCircle(sel.x, sel.y, sel.radius + 18);
  }

  // Topmost control under a point, or null. Buttons are tested before sticks
  // because the melee/dash/super cluster sits inside the aim stick's half and
  // can overlap its resting circle.
  _controlAt(x, y) {
    const order = ['dashBtn', 'meleeBtn', 'superBtn', 'fireStick', 'moveStick'];
    for (const id of order) {
      const c = getControl(id);
      // A small grab margin: the smallest control is 46px and a thumb is not.
      if (Math.hypot(x - c.x, y - c.y) <= c.radius + 12) return id;
    }
    return null;
  }

  // ── Gestures ─────────────────────────────────────────────────────────────

  _onDown(pointer) {
    if (this._dragId !== null || this._sliderDrag) return;
    const id = this._controlAt(pointer.x, pointer.y);
    if (!id) return;
    const c = getControl(id);
    this._dragId = pointer.id;
    this._dragCtrl = id;
    // Grab offset, so a control does not snap its centre to the finger.
    this._grabDX = c.x - pointer.x;
    this._grabDY = c.y - pointer.y;
    if (this.selected !== id) {
      this.selected = id;
      SFX.uiClick();
    }
    this._refresh();
  }

  _onMove(pointer) {
    if (this._dragId !== pointer.id || !this._dragCtrl) return;
    setControl(this._dragCtrl, { x: pointer.x + this._grabDX, y: pointer.y + this._grabDY });
    this._refresh();
  }

  _onUp(pointer) {
    if (this._dragId !== pointer.id) return;
    this._dragId = null;
    this._dragCtrl = null;
  }

  // ── Size slider ──────────────────────────────────────────────────────────

  _scaleToFrac(scale) { return (scale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN); }
  _fracToScale(frac) { return SCALE_MIN + frac * (SCALE_MAX - SCALE_MIN); }

  _buildSlider(cx, cy) {
    this._sl = { cx, cy, trackW: 420, trackH: 12, handleR: 15 };
    this.add.text(cx - this._sl.trackW / 2, cy - 30, 'SIZE', {
      fontFamily: FONTS.body, fontSize: '20px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 3, letterSpacing: 2,
    });
    this.sliderGfx = this.add.graphics();

    const zone = this.add.zone(cx, cy, this._sl.trackW + this._sl.handleR * 2, 56)
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (pointer) => {
      // A control dragged over the card wins the pointer — see the routing note
      // at the top of this file for why this is a hit test and not a flag.
      if (this._controlAt(pointer.x, pointer.y)) return;
      this._sliderDrag = true;
      this._applySlider(pointer);
    });
    this.input.on('pointermove', (pointer) => {
      if (this._sliderDrag) this._applySlider(pointer);
    });
    this.input.on('pointerup', () => {
      if (!this._sliderDrag) return;
      this._sliderDrag = false;
      this._refresh();
    });
  }

  _applySlider(pointer) {
    const { cx, trackW } = this._sl;
    const frac = Phaser.Math.Clamp((pointer.x - (cx - trackW / 2)) / trackW, 0, 1);
    setControl(this.selected, { scale: this._fracToScale(frac) });
    this._refresh();
  }

  _drawSlider(val, active) {
    const { cx, cy, trackW, trackH, handleR } = this._sl;
    const g = this.sliderGfx;
    g.clear();
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(cx - trackW / 2 + 3, cy - trackH / 2 + 3, trackW, trackH, 4);
    g.fillStyle(active ? 0x2e3038 : 0x14161c, 1);
    g.fillRoundedRect(cx - trackW / 2, cy - trackH / 2, trackW, trackH, 4);
    g.lineStyle(2.5, active ? 0x40b8ff : 0x0050cc, 1);
    g.strokeRoundedRect(cx - trackW / 2, cy - trackH / 2, trackW, trackH, 4);
    const hx = cx - trackW / 2 + val * trackW;
    g.fillStyle(active ? 0x40b8ff : 0x0050cc, 0.75);
    g.fillRoundedRect(cx - trackW / 2 + 2, cy - trackH / 2 + 2, Math.max(4, val * trackW - 4), trackH - 4, 2);
    g.fillStyle(0x000000, 0.45);
    g.fillCircle(hx + 2, cy + 3, handleR);
    g.fillStyle(active ? 0x90d8ff : 0x0080ff, 1);
    g.fillCircle(hx, cy, handleR);
    g.lineStyle(2.5, 0xffffff, 1);
    g.strokeCircle(hx, cy, handleR);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  _reset() {
    resetControls();
    SFX.uiClick();
    this._refresh();
  }

  // Push the edited layout into the live HUD, then hand control back exactly as
  // DebugScene does: Game and HUD were paused by the pause button and are ours
  // to resume.
  _close() {
    if (this._closing) return;
    this._closing = true;
    SFX.uiClick();
    const hud = this.scene.get('HUD');
    hud?.applyControlLayout?.();
    hud?.setTouchControlsVisible?.(true);
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
  }

  // Imperial-console button. Copied from DebugScene for the same reason it
  // copied PauseScene's: 30 lines, no dependencies, and this overlay must not
  // be able to break the real menu. The pointerup guard is the one addition —
  // a control dragged across a button must not press it.
  _button(cx, cy, text, onClick, btnW = 420) {
    const btnH = 60;
    const bg = this.add.graphics();
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.55);
      bg.fillRoundedRect(cx - btnW / 2 + 4, cy - btnH / 2 + 5, btnW, btnH, 6);
      bg.fillStyle(hover ? 0x2e3038 : 0x14161c, 1);
      bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 6);
      bg.lineStyle(3, hover ? 0x40b8ff : 0x0050cc, 1);
      bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 6);
      bg.fillStyle(hover ? 0x40b8ff : 0x0050cc, 0.22);
      bg.fillRoundedRect(cx - btnW / 2 + 6, cy - btnH / 2 + 6, btnW - 12, 9, 4);
    };
    draw(false);

    const label = this.add.text(cx, cy, text, {
      fontFamily: FONTS.display,
      fontSize: '26px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 4, letterSpacing: 3,
    }).setOrigin(0.5);

    const zone = this.add.zone(cx, cy, btnW, btnH).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => draw(true));
    zone.on('pointerup', () => {
      draw(false);
      if (this._dragId !== null) return;
      onClick();
    });

    return { bg, label, zone };
  }
}
