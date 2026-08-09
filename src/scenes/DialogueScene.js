import Phaser from 'phaser';
import { VIEW, FONTS } from '../config.js';
import { SFX } from '../systems/FX.js';

// The dialogue card — a character talking to you about what has happened
// between you.
//
// ── Why it is a full stop ─────────────────────────────────────────────────
//
// This pauses Game and HUD and waits for a tap. On a phone, in the middle of a
// fight, a non-blocking overlay is a thing you do not read: the eye is on the
// enemy, the thumb is on the stick, and the line is gone. The cost is real —
// every card is a break in pace — and it is paid for by making cards RARE:
// `GameScene.queueDialogue` refuses one for a nemesis with no history, so a
// first-time stranger never raises this at all. If it ever starts firing on
// every mini-boss spawn, that is the bug, and `smoke-dialogue` asserts it.
//
// ── What it reuses ────────────────────────────────────────────────────────
//
//   - the launch/pause/resume contract from `UpgradeScene` (overlay over a
//     paused Game + HUD, own live input), which is already proven against
//     `PauseScene._restart()` rebuilding the Player underneath it;
//   - the plate vocabulary from `HUD._buildSectorSign` — dark panel, hard 3px
//     rules, corner ticks, a scanline sweeping down it. That is the only
//     persistent overlay in the game and it already looks right;
//   - the typewriter and tap-to-fast-forward from `IntroScene`.
//
// ── The portrait is not tinted ────────────────────────────────────────────
//
// `setTint` multiplies every channel, so a white stormtrooper helmet becomes a
// flat wash of the nemesis colour and every archetype looks the same again —
// which is the exact problem the busts were painted to fix. The colour goes on
// a glow BEHIND the bust instead, so it reads as light falling on it.
export class DialogueScene extends Phaser.Scene {
  constructor() {
    super('Dialogue');
  }

  /**
   * @param data.game     the GameScene, for resume + the completion callback
   * @param data.bust     texture key, e.g. 'bust-sniper'
   * @param data.name     the nameplate line (displayName(entry), or 'DARTH VADER')
   * @param data.color    '#rrggbb' — the nemesis tint, drives the glow and the name
   * @param data.sub      the small line under the name (grudgeLine(entry))
   * @param data.text     the speech itself
   * @param data.traits   trait ids, for the regalia badge strip
   */
  create(data) {
    this.gs = data?.game || null;
    this._closing = false;
    this._done = false;

    const cx = VIEW.width / 2;
    const W = VIEW.width - 48;
    // 420, not 452: at three lines of speech the taller card left an empty band
    // under the text that read as a layout mistake rather than as breathing room.
    const H = 420;
    const cy = VIEW.height * 0.44;
    const top = cy - H / 2;
    const left = cx - W / 2;

    const colorHex = data?.color || '#ffd040';
    const colorNum = Phaser.Display.Color.HexStringToColor(colorHex).color;

    // ── Backdrop ────────────────────────────────────────────────────────
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, VIEW.width, VIEW.height);
    // Step 16, not 6. A Graphics object re-submits its whole command list every
    // frame, so a scanline every 6px over a 1280px screen was 213 fills per
    // frame for something the eye reads as "faintly striped" either way.
    //
    // HONESTLY: this was a suspect for why the card's scene steps at ~6.5fps
    // against a ~10.6fps loop, and trimming it moved that to 6.8 — i.e. it is
    // NOT the cause. Kept anyway because 213 fills per frame for an identical
    // look is not worth paying, but do not read this as a fix. The real cost is
    // elsewhere (the arena and HUD keep rendering underneath while paused), and
    // nothing depends on the frame rate here any more — see `_close`.
    dim.fillStyle(colorNum, 0.03);
    for (let y = 0; y < VIEW.height; y += 16) dim.fillRect(0, y, VIEW.width, 2);

    // ── Plate ───────────────────────────────────────────────────────────
    // Same construction as the sector sign: engraved signage, not a soft glow.
    const plate = this.add.graphics();
    plate.fillStyle(0x000000, 0.55);
    plate.fillRect(left + 5, top + 6, W, H);
    plate.fillStyle(0x080a10, 0.94);
    plate.fillRect(left, top, W, H);
    plate.fillStyle(colorNum, 0.95);
    plate.fillRect(left, top, W, 3);
    plate.fillRect(left, top + H - 3, W, 3);
    plate.fillStyle(colorNum, 0.22);
    plate.fillRect(left, top + 5, W, 1);
    plate.fillRect(left, top + H - 6, W, 1);
    plate.fillStyle(colorNum, 0.9);
    const T = 26;
    [[left, top], [left + W - T, top], [left, top + H - 3], [left + W - T, top + H - 3]]
      .forEach(([x, y]) => plate.fillRect(x, y, T, 3));
    plate.fillRect(left, top, 3, 24);
    plate.fillRect(left + W - 3, top, 3, 24);
    plate.fillRect(left, top + H - 24, 3, 24);
    plate.fillRect(left + W - 3, top + H - 24, 3, 24);

    // ── Portrait ────────────────────────────────────────────────────────
    //
    // The bust sits in a RECESS, and its feet are flush with the bottom of it.
    // Drawn straight onto the plate the 36px-tall art ended at a hard
    // horizontal edge in mid-shoulder and read as clipped — worst on Vader,
    // whose shoulders are widest and darkest. Framed, the same crop reads as a
    // portrait in a housing, which is what it is.
    const recessX = left + 18;
    const recessY = top + 20;
    const recessW = 200;
    const recessH = 196;
    const bustX = recessX + recessW / 2;
    const bustY = recessY + recessH - 90 - 6;   // 180px tall art, 6px foot

    const glow = this.add.graphics();
    glow.fillStyle(0x0e131c, 1);
    glow.fillRect(recessX, recessY, recessW, recessH);
    // The tint, as light behind the bust. Three stacked discs rather than one,
    // so it falls off instead of ending at a hard circle edge.
    [[96, 0.12], [74, 0.16], [52, 0.22]].forEach(([r, a]) => {
      glow.fillStyle(colorNum, a);
      glow.fillCircle(bustX, recessY + 92, r);
    });
    // Housing: a hard inner edge on two sides and corner ticks, matching the
    // plate's own vocabulary rather than inventing a second one.
    glow.fillStyle(colorNum, 0.30);
    glow.fillRect(recessX, recessY, recessW, 2);
    glow.fillRect(recessX, recessY + recessH - 2, recessW, 2);
    glow.fillStyle(colorNum, 0.16);
    glow.fillRect(recessX, recessY, 2, recessH);
    glow.fillRect(recessX + recessW - 2, recessY, 2, recessH);
    glow.fillStyle(0x000000, 0.35);
    glow.fillRect(recessX + 2, recessY + recessH - 16, recessW - 4, 14);   // floor shadow

    if (data?.bust && this.textures.exists(data.bust)) {
      const bust = this.add.image(bustX, bustY, data.bust);
      // A slow breath, so the card is not a still image while it talks.
      this.tweens.add({
        targets: bust, y: bustY - 5,
        duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── Nameplate ───────────────────────────────────────────────────────
    const nameX = recessX + recessW + 26;
    // 30px unless the name is long — `displayName` produces things like
    // "GRAKK, HEIR OF VOSS", which overruns the plate at full size.
    const nameStr = data?.name || '';
    this.add.text(nameX, top + 42, nameStr, {
      fontFamily: FONTS.display,
      fontSize: nameStr.length > 18 ? '25px' : '32px',
      fontStyle: 'bold',
      color: colorHex,
      stroke: '#000000', strokeThickness: 6,
      letterSpacing: 1,
      wordWrap: { width: W - (recessW + 60) },
    }).setOrigin(0, 0).setResolution(2);

    if (data?.sub) {
      this.add.text(nameX, top + 104, data.sub, {
        fontFamily: FONTS.body,
        fontSize: '19px', fontStyle: 'bold',
        color: '#9fb4c8',
        stroke: '#000000', strokeThickness: 3,
        letterSpacing: 2,
        wordWrap: { width: W - (recessW + 60) },
      }).setOrigin(0, 0).setResolution(2);
    }

    // Trait regalia as badges. The same textures the enemy wears, so the card
    // and the thing on the floor agree about what you are fighting.
    (data?.traits || []).slice(0, 3).forEach((id, i) => {
      const key = `reg-${id}`;
      if (!this.textures.exists(key)) return;
      this.add.image(nameX + 34 + i * 78, top + 162, key).setScale(0.9);
    });

    // ── The line ────────────────────────────────────────────────────────
    this._fullText = data?.text || '';
    this._charIndex = 0;
    this.bodyText = this.add.text(left + 34, top + 240, '', {
      fontFamily: FONTS.body,
      fontSize: '27px', fontStyle: 'bold',
      color: '#e6eef8',
      stroke: '#000000', strokeThickness: 4,
      lineSpacing: 10,
      wordWrap: { width: W - 68 },
    }).setOrigin(0, 0).setResolution(2);

    this._typeTimer = this.time.addEvent({
      delay: 26, loop: true,
      callback: () => {
        this._charIndex += 1;
        this.bodyText.setText(this._fullText.slice(0, this._charIndex));
        const ch = this._fullText[this._charIndex - 1];
        if (ch && ch !== ' ' && ch !== '\n' && this._charIndex % 2 === 0) SFX.hackTick?.();
        if (this._charIndex >= this._fullText.length) this._finishTyping();
      },
    });

    // ── Scanline ────────────────────────────────────────────────────────
    this.scan = this.add.graphics();
    this.scan.fillStyle(colorNum, 0.13);
    this.scan.fillRect(left + 3, -2, W - 6, 4);
    this.scan.y = top;
    this.tweens.add({
      targets: this.scan, y: { from: top + 4, to: top + H - 4 },
      duration: 2400, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Dismiss ─────────────────────────────────────────────────────────
    this.hint = this.add.text(cx, top + H + 42, '', {
      fontFamily: FONTS.body,
      fontSize: '18px', color: '#5a6a80',
      stroke: '#000000', strokeThickness: 3, letterSpacing: 3,
    }).setOrigin(0.5).setAlpha(0);

    // Full-screen, so a tap anywhere advances. Created last, above everything.
    const zone = this.add.zone(cx, VIEW.height / 2, VIEW.width, VIEW.height)
      .setOrigin(0.5).setInteractive();
    zone.on('pointerdown', () => this._advance());
    this.input.keyboard?.on('keydown', () => this._advance());

    // Slam in, the way the sector sign arrives.
    const arrivals = [plate, glow, this.bodyText, this.scan];
    this.cameras.main.fadeIn(120, 0, 0, 0);
    this.tweens.add({
      targets: arrivals, alpha: { from: 0, to: 1 },
      duration: 180, ease: 'Quad.easeOut',
    });
    SFX.uiClick?.();
  }

  _finishTyping() {
    if (this._done) return;
    this._typeTimer?.remove();
    this._typeTimer = null;
    this._done = true;
    this.bodyText.setText(this._fullText);
    this.hint.setText('TAP TO CONTINUE');
    this.tweens.add({
      targets: this.hint, alpha: { from: 0, to: 1 }, duration: 200,
    });
    this.tweens.add({
      targets: this.hint, alpha: { from: 1, to: 0.45 },
      duration: 900, yoyo: true, repeat: -1, delay: 220, ease: 'Sine.easeInOut',
    });
  }

  // First tap completes the text, the second dismisses. An impatient player is
  // never held here longer than two taps.
  _advance() {
    if (this._closing) return;
    if (!this._done) {
      this._finishTyping();
      SFX.uiClick?.();
      return;
    }
    this._close();
  }

  _close() {
    if (this._closing) return;
    this._closing = true;
    this._typeTimer?.remove();
    SFX.uiClick?.();

    // RESUME UNCONDITIONALLY AND SYNCHRONOUSLY. This used to hang off
    // `camerafadeoutcomplete`, copying UpgradeScene, and that is a bad gate for
    // the one action that must not be missed: if the event is late or never
    // fires, Game and HUD stay paused behind a card that has already gone, and
    // the player is looking at a frozen game with nothing left to tap.
    //
    // Not hypothetical. Measured here at ~10fps: the camera's fade effect was
    // still reporting 83% progress 900ms after a 140ms fadeOut, and the card's
    // own scene was stepping at 6.5fps while the loop ran at 10.6. On a loaded
    // phone that gap is wider, not narrower. A dismissal has to be a state
    // change, not an animation callback.
    //
    // `isPaused` guards because PauseScene._restart() can tear the run down
    // while the card is open — resuming a scene that no longer exists throws.
    if (this.scene.isPaused('Game')) this.scene.resume('Game');
    if (this.scene.isPaused('HUD')) this.scene.resume('HUD');
    this.gs?._dialogueClosed?.();
    this.scene.stop();
  }
}
