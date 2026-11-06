// P2-A3 — THE OVERRIDE REFINEMENT (`?visualPilot=v2c&polish=p1&fxPilot=p2a3`).
// Installed by the P2-A layer (systems/p2aFx.js) OVER P2-A2's loadout when the
// flag is on; nothing here exists otherwise, and `fxPilot=p2a2` is drawn
// exactly as before (P2-A2's own files are not edited).
//
// HUMAN direction (2026-11-06, P2-A2 accepted as a direction): keep the rifle
// model, STANDARD's pistol mechanics, OVERRIDE's three-shot mechanics, the
// projectile effects and the muzzle-depth solution, and refine OVERRIDE:
//   1. THE ROUND COUNT. The shipped burst shot (`Player._fireBurstShot`) spends
//      a round and emits no `secondary-ammo-changed`, so the HUD's count and
//      bar only moved on pickup and on running dry (register #28). This layer
//      READS `player.secondaryAmmo` once a frame and, only when it differs from
//      the value last drawn, re-runs the HUD's own `refreshSecondary` — the
//      shipped panel, bar and count, drawn from the real value. No event is
//      emitted, no ammunition or burst field is written.
//   2. THE READOUT. P2-A2's panel carried a module picture and "3-SHOT BURST"
//      in 3x5 type (~8 CSS px on a phone). Here the count is the panel's
//      biggest element (the HUD's own Text, re-sized), the burst is a SYMBOL —
//      three of the game's red energy cells under one bracket — the bar is
//      split every three rounds (one segment = one pull), and the mode's name
//      sits under the panel in 4x5 capitals.
//   3. THE ACTIVE STATE. While OVERRIDE is engaged the carried rifle's power
//      cell is lit: the magazine glows amber and three pips light along the
//      receiver — pixels the P1 rifle already has, lit, on its own canvas and
//      origin (the same gun). A round leaving flicks the cell white; the last
//      two bursts pulse it. ENGAGE: the pips light in sequence, the cell flares
//      and one amber ring leaves it; the HUD panel's rim flashes and the symbol
//      pops (P2-A2's barrel prime stays). RUN DRY: the pips go out, the cell
//      flickers twice and dies, and the HUD says STANDARD where the panel was.
//
// ONE AUTHOR PER OBJECT. The cell, its glow, the ring and the HUD label / tag /
// bar segments / rim flash are this module's own objects. The HUD's `secIcon`
// and `secText` are restyled only inside `refreshSecondary` (an instance
// wrapper, after the shipped body and P2-A2's restyle — the shipped code never
// writes them anywhere else), plus the engage pop of `secIcon`'s scale while
// this module holds the readout. No Text object is created (Phaser's Text
// constructor draws Math.random). No Math.random, no tween, no listener.

import { P2A_TEX, P2A3_TEX } from './p2aPaint.js';
import { isLowQuality } from './FX.js';

export const P2A3 = {
  hud: {
    burst: { dy: -29, pop: 1.35, popMs: 260 },      // the symbol, inside the shipped 100x90 panel
    count: { dy: 7, font: '32px' },
    shippedFont: '15px',                            // HUD.js builds secText at this size
    label: { dy: 49 },                              // "OVERRIDE", just under the panel
    bar: { x: -38, y: 26, w: 76, h: 8 },            // HUD.refreshSecondary's bar
    seg: { every: 3, col: 0x0a0c14, w: 2 },         // a cut every 3 rounds: one segment per pull
    rim: { ms: 380, col: 0xfff1d8 },                // engage: the panel's rim flashes
    standard: { ms: 1100, fadeMs: 380, dy: -4 },    // run dry: "STANDARD" where the panel was
  },
  cell: {
    glow: { tint: 0xffa030, alpha: 0.4, scale: 0.55 },
    flickMs: 70,                                    // a round leaving
    low: { rounds: 6, periodMs: 380, min: 0.55 },   // the last two bursts
    engage: { pipMs: 60, flareMs: 260, ringMs: 300, ring: [7, 34], ringCol: 0xffb34a },
    drain: { pipMs: 70, flicker: [[40, 80, 0.7], [110, 140, 0.35]], ms: 420 },   // pips out, then the cell gutters twice
  },
};

/** Build the P2-A3 layer over this FX controller and its P2-A2 loadout. */
export function installOverrideP2A3(ctl, loadout) { return new OverrideP2A3(ctl, loadout); }

class OverrideP2A3 {
  constructor(ctl, loadout) {
    this.ctl = ctl;
    this.loadout = loadout;
    const s = (this.scene = ctl.scene);
    this.P = s.player;
    // world objects: the cell over the rifle, its glow, the engage ring
    this.cell = s.add.image(0, 0, P2A3_TEX.cell.keys[3]).setVisible(false);
    this.glow = s.add.image(0, 0, P2A_TEX.glow.key).setTint(P2A3.cell.glow.tint).setVisible(false);
    this.ring = s.add.graphics().setVisible(false);
    this.mode = 'off';          // 'off' | 'engage' | 'on' | 'drain'
    this.t = 0;
    this.clock = 0;
    this.flickT = 0;
    this.lastSec = this.P.secondary;
    this.lastAmmo = this.P.secondaryAmmo;
    if (this.lastSec === 'rifle') this.mode = 'on';
    // HUD state (its objects are built lazily: the HUD scene starts after us)
    this.drawnAmmo = null;
    this.hudStyled = false;
    this.rimT = -1; this.popT = -1; this.stdT = -1;
    this.h = { label: null, std: null, seg: null, rim: null };
    this.stats = { engages: 0, drains: 0, polls: 0, flicks: 0, hud: 0 };
    const hud = (this.hud = s.scene.get('HUD'));
    if (hud && typeof hud.refreshSecondary === 'function') {
      const had = Object.prototype.hasOwnProperty.call(hud, 'refreshSecondary');
      const prev = hud.refreshSecondary;
      hud.refreshSecondary = (id) => { const r = prev.call(hud, id); this._restyle(id); return r; };
      this._unHud = () => { if (had) hud.refreshSecondary = prev; else delete hud.refreshSecondary; };
    }
  }

  /** Every frame, from the P2-A layer's POST_UPDATE (after P2-A2 placed the rifle). */
  update(dt, realDt) {
    const P = this.P;
    if (!P?.scene) return;
    this.clock += dt;
    const sec = P.secondary, ammo = P.secondaryAmmo;
    // 1. the round count follows the real value, redrawn only when it changes
    if (sec === 'rifle' && ammo !== this.drawnAmmo) {
      const h = this.hud;
      if (h?.secIcon && h.gameScene) { this.stats.polls++; h.refreshSecondary(); }
    }
    // 3. the mode's beats
    if (sec === 'rifle' && this.lastSec !== 'rifle') { this.mode = 'engage'; this.t = 0; this.flickT = 0; this.rimT = 0; this.popT = 0; this.stats.engages++; }
    else if (sec !== 'rifle' && this.lastSec === 'rifle') { this.mode = 'drain'; this.t = 0; this.flickT = 0; this.stats.drains++; }
    else if (sec === 'rifle' && ammo < this.lastAmmo) { this.flickT = P2A3.cell.flickMs; this.stats.flicks++; }
    this.lastSec = sec; this.lastAmmo = ammo;
    this._drawCell(dt);
    this._drawHudBeats(realDt);
  }

  // ── the power cell ──────────────────────────────────────────────────────
  _drawCell(dt) {
    const C = P2A3.cell, K = P2A3_TEX.cell.keys, v = this.loadout?.view, low = isLowQuality();
    let key = null, a = 1, flare = 0, ringU = -1;
    if (this.mode === 'engage') {
      this.t += dt;
      const E = C.engage;
      key = K[Math.min(3, Math.floor(this.t / E.pipMs))];
      flare = Math.max(0, 1 - this.t / E.flareMs);
      if (this.t < E.ringMs) ringU = this.t / E.ringMs;
      if (this.t >= Math.max(3 * E.pipMs, E.flareMs, E.ringMs)) this.mode = 'on';
    } else if (this.mode === 'on') {
      if (this.flickT > 0) this.flickT -= dt;
      key = this.flickT > 0 ? P2A3_TEX.cell.hot : K[3];
      if (this.P.secondaryAmmo <= C.low.rounds && this.flickT <= 0) {
        const w = 0.5 + 0.5 * Math.cos((this.clock / C.low.periodMs) * Math.PI * 2);
        a = C.low.min + (1 - C.low.min) * w;
      }
    } else if (this.mode === 'drain') {
      this.t += dt;
      const D = C.drain, n = 3 - Math.floor(this.t / D.pipMs);
      if (n >= 0) key = K[n];
      else {
        const u = this.t - 4 * D.pipMs;
        const f = D.flicker.find(([t0, t1]) => u >= t0 && u < t1);
        if (f) { key = K[0]; a = f[2]; }
      }
      if (this.t >= D.ms) this.mode = 'off';
    }
    const shown = key && v && v.visible && v.alpha > 0 && /^p1-rifle/.test(v.texture.key);
    if (!shown) {
      if (this.cell.visible) this.cell.setVisible(false);
      if (this.glow.visible) this.glow.setVisible(false);
      if (this.ring.visible) this.ring.clear().setVisible(false);
      return;
    }
    if (this.cell.texture.key !== key) this.cell.setTexture(key);
    this.cell.setVisible(true).setOrigin(v.originX, v.originY).setPosition(v.x, v.y).setRotation(v.rotation)
      .setFlipY(v.flipY).setAlpha(v.alpha * a).setDepth(v.depth + 0.02);
    // the magazine, in the world: the rifle's canvas offset, rotated (flipY mirrors about the origin row)
    const T = P2A3_TEX.cell, dx = T.mag[0] - v.originX * T.w, dy0 = T.mag[1] - v.originY * T.h, dy = v.flipY ? -dy0 : dy0;
    const cs = Math.cos(v.rotation), sn = Math.sin(v.rotation);
    const mx = v.x + cs * dx - sn * dy, my = v.y + sn * dx + cs * dy;
    if (!low) {
      const G = C.glow, hot = this.mode === 'on' && this.flickT > 0 ? 1.5 : 1;
      this.glow.setVisible(true).setPosition(mx, my).setScale(G.scale * (1 + 0.9 * flare))
        .setAlpha(Math.min(1, v.alpha * a * G.alpha * hot * (1 + 1.2 * flare))).setDepth(v.depth + 0.01);
    } else if (this.glow.visible) this.glow.setVisible(false);
    if (ringU >= 0 && !low) {
      const E = C.engage, r = E.ring[0] + (E.ring[1] - E.ring[0]) * (1 - (1 - ringU) * (1 - ringU));
      const P = this.P;
      this.ring.clear().setVisible(true).setDepth(Math.max(v.depth, P.depth) + 3.2)
        .lineStyle(3 - 2 * ringU, E.ringCol, 0.85 * (1 - ringU) * v.alpha).strokeCircle(mx, my, r);
    } else if (this.ring.visible) this.ring.clear().setVisible(false);
  }

  // ── the HUD readout ─────────────────────────────────────────────────────
  _hudObjects() {
    const h = this.hud, o = this.h;
    if (!h?.add || !h.sys?.displayList) return null;
    if (!o.label?.scene) o.label = h.add.image(0, 0, P2A3_TEX.over.key).setDepth(5).setVisible(false);
    if (!o.std?.scene) o.std = h.add.image(0, 0, P2A3_TEX.std.key).setDepth(5).setVisible(false);
    if (!o.seg?.scene) o.seg = h.add.graphics().setDepth(1);
    if (!o.rim?.scene) o.rim = h.add.graphics().setDepth(6);
    return o;
  }

  /** After the shipped refresh and P2-A2's restyle, inside the same call. */
  _restyle(weaponId) {
    const h = this.hud, P = this.P;
    if (!h?.secIcon || !h?.secText) return;
    const o = this._hudObjects();
    if (!o) return;
    const id = weaponId !== undefined ? weaponId : P?.secondary;
    const H = P2A3.hud, cx = h._secX, cy = h._secY;
    if (id === 'rifle') {
      const ammo = P?.secondaryAmmo ?? 0;
      h.secIcon.setTexture(P2A3_TEX.burst.key).setScale(this._pop()).setPosition(cx, cy + H.burst.dy);
      h.secText.setFontSize(H.count.font).setText(`${ammo}`).setPosition(cx, cy + H.count.dy);
      o.label.setVisible(true).setPosition(cx, cy + H.label.dy);
      // one cut every three rounds across the shipped bar: a segment per pull
      const B = H.bar, S = H.seg, n = 27 / S.every;
      o.seg.clear().fillStyle(S.col, 1);
      for (let k = 1; k < n; k++) o.seg.fillRect(Math.round(cx + B.x + (B.w * k) / n - S.w / 2), cy + B.y, S.w, B.h);
      o.std.setVisible(false); this.stdT = -1;
      this.drawnAmmo = ammo;
      this.hudStyled = true;
      this.stats.hud++;
    } else {
      if (this.hudStyled) {
        h.secText.setFontSize(H.shippedFont);
        o.label.setVisible(false);
        o.seg.clear();
        o.rim.clear(); this.rimT = -1; this.popT = -1;
        if (!id) this.stdT = 0;          // back to STANDARD: say so where the panel was
        this.hudStyled = false;
      }
      this.drawnAmmo = null;
    }
  }

  _pop() {
    const H = P2A3.hud.burst;
    if (this.popT < 0 || this.popT >= H.popMs) return 1;
    const u = this.popT / H.popMs;
    return 1 + (H.pop - 1) * (1 - u) * (1 - u);
  }

  _drawHudBeats(dt) {
    const h = this.hud, o = this.h, H = P2A3.hud;
    if (!h?.secIcon) return;
    if (this.popT >= 0) {
      this.popT += dt;
      if (this.hudStyled && h.secIcon.active) h.secIcon.setScale(this._pop());
      if (this.popT >= H.burst.popMs) this.popT = -1;
    }
    if (this.rimT >= 0 && o.rim?.scene) {
      this.rimT += dt;
      const u = this.rimT / H.rim.ms;
      if (u >= 1 || !this.hudStyled) { o.rim.clear(); this.rimT = -1; }
      else {
        const cx = h._secX, cy = h._secY;
        o.rim.clear().lineStyle(4 - 2 * u, H.rim.col, Math.pow(1 - u, 1.5)).strokeRoundedRect(cx - 50, cy - 50, 100, 90, 6);
      }
    }
    if (this.stdT >= 0 && o.std?.scene) {
      this.stdT += dt;
      const S = H.standard;
      if (this.stdT >= S.ms) { o.std.setVisible(false); this.stdT = -1; }
      else {
        const a = this.stdT < S.ms - S.fadeMs ? 1 : (S.ms - this.stdT) / S.fadeMs;
        o.std.setVisible(true).setPosition(h._secX, h._secY + S.dy).setAlpha(a);
      }
    }
  }

  destroy() {
    this._unHud?.();
    const h = this.hud;
    if (this.hudStyled && h?.secText?.active) h.secText.setFontSize(P2A3.hud.shippedFont);
    for (const o of [this.cell, this.glow, this.ring, ...Object.values(this.h)]) { try { if (o?.scene) o.destroy(); } catch (_) { /* scene going down */ } }
    this.h = {}; this.cell = this.glow = this.ring = null;
    this.P = null; this.hud = null; this.scene = null;
  }
}
