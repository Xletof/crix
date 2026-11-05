// P1-A — MOBILE BANNER READABILITY (`?visualPilot=v2c&polish=p1`).
//
// OPT-IN AND PRESENTATION ONLY. `installBannerPolish(hud)` runs from the HUD
// scene's `create`; without the flag it removes anything a previous run put on
// the instance and the HUD is exactly the shipped one. With it, four instance
// methods are replaced — the prototype code is untouched:
//   showBanner     the transient centre banner
//   _renderMedal   the medal / trait line lane
//   showCombo      the "x3!" streak splash (its lane only)
//   showSectorSign the persistent exit sign (its directive's size and slam)
// Every event, delay, duration and ease is the shipped one; what changes is
// the TYPE SIZE, the LINE BREAK and the LANE. One deliberate timing fix, P1
// only: a new banner kills the previous banner's tweens, so a stale exit tween
// can no longer fade the new text early (the shipped banner did, whenever two
// arrived inside ~1.5s).
//
// WHAT WAS WRONG. `showBanner` chose its size from the CHARACTER COUNT (60px
// up to 14 characters, else 34px) and never measured the result. Orbitron is a
// wide face, the stroke adds 8px, and the exit tween grows the text to 1.16x
// while it fades — so at its widest the banner was drawn past the 720px canvas
// for every long line: SLICE TERMINALS FOR SUPPORT (-22..742), ARENA SURVIVED —
// FINISH THEM! (-31..751), SUPPORT: SHIELD CHARGED & BACTA VIAL (-144..864),
// and CHAMBER CLEAR (13 characters, so 60px) touched both edges. The medal lane
// had no fit at all (SUPPRESSED — he takes the power, not the gun at 26px is
// ~860px). The sector sign's directive (690px) was wider than its own 664px
// plate, and its arrival slam stretched the plate to 757px.
//
// THE RULE NOW. Every line is MEASURED (the canvas's own advance plus the
// stroke) and fitted so that the LARGEST box the animation ever draws stays
// inside the canvas with a margin. A type scale keeps the hierarchy:
//   HERO      <= 14 characters    one line, 60px, fitted down to no less than 46
//   CALLOUT   15+ characters      one line, up to 44px, kept while >= 36
//   STACK     anything longer     two balanced lines, up to 42px (never below 24)
// so short callouts stay as loud as they were, mid-length callouts get BIGGER
// than the old 34px, and instructions are composed on two lines instead of
// being shrunk. If no size fits (an absurd string) containment still wins.
// The PAUSE BUTTON (top-right, drawn over the banner) is an obstacle too: a
// banner whose band crosses its rows is fitted short of it, symmetrically.

import { VIEW, HUDCFG, FONTS } from '../config.js';
import { isPolishP1 } from './debug.js';
import { SFX } from './FX.js';

export const P1_BANNER = {
  margin: 24,          // px clear of each canvas edge at the animation's widest
  peak: 1.16,          // the banner's exit-tween end scale: the largest it is drawn
  ink: 1.03,           // measured advance -> painted ink (Orbitron caps, the ⚠ glyph)
  hero: { chars: 14, max: 60, min: 46 },
  callout: { max: 44, min: 36 },
  stack: { max: 42, min: 24 },
  lineSpacing: -4,     // two-line stacks sit tight: one announcement, not two
  ceilingGap: 18,      // a banner's top edge never rises above the bar + this (the legacy one-line top)
  laneGap: 6,          // between stacked transient lanes
  medal: { size: 26, min: 18, peak: 1.04 },   // Back.easeOut 0.7 -> 1 overshoots to ~1.03
  sign: { pad: 20, slamX: 1.06 },             // directive inset in the plate; the plate's widest arrival
};

const SAFE_W = () => VIEW.width - 2 * P1_BANNER.margin;
const ORIG = ['showBanner', '_renderMedal', 'showCombo', 'showSectorSign'];

/** Install (flag on) or remove (flag off) the P1 banner layout on a HUD scene instance. */
export function installBannerPolish(hud) {
  for (const k of ORIG) if (Object.prototype.hasOwnProperty.call(hud, k)) delete hud[k];
  hud._p1 = null;
  if (!isPolishP1()) return false;
  hud._p1 = { bannerPeak: null, bannerUntil: 0 };
  hud.showBanner = (text, color) => showBannerP1(hud, text, color);
  hud._renderMedal = (name, points, color) => renderMedalP1(hud, name, points, color);
  hud.showCombo = (n) => showComboP1(hud, n);
  hud.showSectorSign = (sector, kills) => showSectorSignP1(hud, sector, kills);
  return true;
}

// ── measuring ──────────────────────────────────────────────────────────────
// Width of each line at the text object's CURRENT font, the way Phaser sizes
// its canvas (advance + strokeThickness), for a text with no letter spacing.
function lineWidths(t, lines) {
  t.style.syncFont(t.canvas, t.context);
  const st = t.style.strokeThickness || 0;
  return lines.map((l) => t.context.measureText(l).width + st);
}
// The largest integer size at which `lines`, measured at `ref`, fit `w` at
// `scale` (advance scales with the size, the stroke does not).
function fitSize(t, lines, ref, w, scale) {
  t.setFontSize(ref);
  const st = t.style.strokeThickness || 0;
  const adv = Math.max(...lineWidths(t, lines)) - st;
  return Math.floor(((w / (scale * P1_BANNER.ink)) - st) * ref / Math.max(1, adv));
}
// Every two-line split at a space; the best minimises the wider line, with a
// nudge toward phrase breaks (below).
function splits(text) {
  const words = text.split(' ');
  const out = [];
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    if (a === '—' || b === '—' || a === '&' || b === '&') continue;
    out.push([a, b]);
  }
  return out;
}
function bestSplit(t, text, ref) {
  t.setFontSize(ref);
  let best = null;
  for (const s of splits(text)) {
    const w = Math.max(...lineWidths(t, s));
    // a break after ':' or '—' (or before '&') reads as the phrase it is; a
    // line that STARTS with a dash reads as a fragment
    const bonus = (/[:—]$/.test(s[0]) || /^&/.test(s[1]) ? 0.96 : 1) * (/^—/.test(s[1]) ? 1.2 : 1);
    const score = w * bonus;
    if (!best || score < best.score) best = { lines: s, score };
  }
  return best?.lines ?? null;
}

/**
 * Lay a string out on a Text object by the type scale above. Sets the size and
 * the (possibly two-line) text; returns { size, lines, tier }.
 */
export function layoutBanner(t, text, { safeW = SAFE_W(), peak = P1_BANNER.peak } = {}) {
  const B = P1_BANNER;
  const given = text.split('\n');
  let pick;
  if (given.length > 1) {
    const s = Math.min(B.stack.max, fitSize(t, given, 60, safeW, peak));
    pick = { size: Math.max(8, s), lines: given, tier: 'stack' };
  } else {
    const hero = text.length <= B.hero.chars;
    const max1 = hero ? B.hero.max : B.callout.max;
    const min1 = hero ? B.hero.min : B.callout.min;
    const s1 = Math.min(max1, fitSize(t, [text], 60, safeW, peak));
    if (s1 >= min1) pick = { size: s1, lines: [text], tier: hero ? 'hero' : 'callout' };
    else {
      const two = text.includes(' ') ? bestSplit(t, text, 60) : null;
      const s2 = two ? Math.min(B.stack.max, fitSize(t, two, 60, safeW, peak)) : -1;
      if (two && s2 >= s1 + 2) pick = { size: Math.max(s2, 8), lines: two, tier: 'stack' };
      else pick = { size: Math.max(Math.min(s1, max1), 8), lines: [text], tier: 'callout' };
    }
  }
  t.setFontSize(pick.size);
  t.setLineSpacing(pick.lines.length > 1 ? B.lineSpacing : 0);
  t.setText(pick.lines.join('\n'));
  // Rounding and hinting: verify on the real object and step down if needed.
  for (let i = 0; i < 12 && t.width * peak * B.ink > safeW && pick.size > 8; i++) {
    pick.size -= 1; t.setFontSize(pick.size);
  }
  return pick;
}

// ── the lanes ──────────────────────────────────────────────────────────────
// Every transient lane is placed by the box it will occupy at its PEAK scale.
// `occupied` is the lowest screen y already claimed below the bar: the duel
// block when a nemesis is live, the sector sign when it is up, and (for the
// combo and medal lanes) a live banner.
const DUEL_BOTTOM = HUDCFG.topBarHeight + 55;     // name +12, bar +38 with its bed (HUD.startDuel)
function signBottom(hud) {
  if (!hud._signShown || !hud.sectorSign?.visible) return 0;
  return hud.sectorSign.y + (hud._signH || 0) / 2;
}
// The pause button's rows and the centred width that clears it (HUD._buildPauseButton).
export function pauseZone(hud) {
  const pb = hud._pauseBtn;
  if (!pb) return null;
  const gap = 8;
  return { top: pb.y - pb.r - gap, bottom: pb.y + pb.r + 3 + gap, safeW: 2 * (pb.x - pb.r - gap - VIEW.width / 2) };
}
// A banner is LIVE from the moment it is called until its exit tween ends —
// not "while its alpha shows": a multikill emits its banner and its streak
// splash in the same frame, when the banner is still at alpha 0, and an alpha
// test lets the splash print straight through it.
function bannerLiveBottom(hud) {
  const b = hud.banner, s = hud._p1;
  if (!b || !s?.bannerPeak || !(hud.time.now < s.bannerUntil)) return 0;
  return b.y + s.bannerPeak / 2;
}

function showBannerP1(hud, text, color = '#ff2828') {
  const b = hud.banner;
  hud.tweens.killTweensOf(b);          // P1: a new banner owns the object outright
  b.setAlign('center');
  layoutBanner(b, text);
  b.setColor(color);
  b.setAlpha(0);
  b.setScale(0.6);

  // Home is the shipped one (bar + 66, or bar + 112 under a duel block). A
  // taller (two-line) banner moves DOWN by what it gained, so its top edge is
  // never higher than the shipped single line's; under the sign it goes below.
  const B = P1_BANNER;
  const duelLive = hud.duelBar?.visible;
  const home = HUDCFG.topBarHeight + (duelLive ? 112 : 66);
  const ceiling = Math.max(HUDCFG.topBarHeight + B.ceilingGap, duelLive ? DUEL_BOTTOM + B.laneGap : 0, signBottom(hud) + B.laneGap);
  const place = () => { const ph = b.height * B.peak; b.y = Math.max(home, ceiling + ph / 2); return ph; };
  let peakH = place();
  // THE PAUSE BUTTON. It is drawn above the banner (depth 46) in the top-right
  // corner, so a line that runs under it loses its last letters exactly as if
  // the canvas had cut them. When the banner's peak band crosses the button's
  // rows the line is fitted to a symmetric width that stops short of it.
  const pz = pauseZone(hud);
  if (pz && b.y - peakH / 2 < pz.bottom && b.y + peakH / 2 > pz.top) {
    layoutBanner(b, text, { safeW: pz.safeW });
    peakH = place();
  }
  hud._p1.bannerPeak = peakH;
  hud._p1.bannerUntil = hud.time.now + 220 + 700 + 650;

  hud.tweens.add({
    targets: b, alpha: 1, scale: 1.05, duration: 220,
    onComplete: () => {
      hud.tweens.add({ targets: b, alpha: 0, scale: B.peak, duration: 650, delay: 700 });
    },
  });
}

function renderMedalP1(hud, name, points, color = '#ffd040') {
  // The shipped `_renderMedal`, with the line fitted to the canvas and lane
  // stepped below a live banner / the sign. Same object life cycle (the
  // shutdown handler nulls `_medalText`).
  const B = P1_BANNER;
  if (!hud._medalText?.active) {
    hud._medalText = hud.add.text(VIEW.width / 2, HUDCFG.topBarHeight + 232, ' ', {
      fontFamily: FONTS.display,
      fontSize: `${B.medal.size}px`, fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(35).setAlpha(0).setResolution(2);
  }
  const m = hud._medalText;
  hud.tweens.killTweensOf(m);
  const sign = points < 0 ? '-' : '+';
  const scored = points ? `  ${sign}${Math.abs(points).toLocaleString('en-US')}` : '';
  const text = `${name}${scored}`;
  m.setAlign('center').setColor(color);
  const safeW = SAFE_W(), peak = B.medal.peak;
  let size = Math.min(B.medal.size, fitSize(m, [text], B.medal.size, safeW, peak));
  let lines = [text];
  if (size < B.medal.min + 4 && text.includes(' ')) {
    const two = bestSplit(m, text, B.medal.size);
    const s2 = Math.min(B.medal.size, fitSize(m, two, B.medal.size, safeW, peak));
    if (s2 > size) { size = s2; lines = two; }
  }
  m.setFontSize(Math.max(size, 8)).setLineSpacing(lines.length > 1 ? -2 : 0).setText(lines.join('\n'));
  for (let i = 0; i < 12 && m.width * peak * B.ink > safeW && size > 8; i++) m.setFontSize(--size);
  const peakH = m.height * peak;
  const home = HUDCFG.topBarHeight + 232;
  m.y = Math.max(home, Math.max(bannerLiveBottom(hud), signBottom(hud)) + B.laneGap + peakH / 2);
  m.setAlpha(1).setScale(0.7);
  hud.tweens.add({ targets: m, scale: 1, duration: 200, ease: 'Back.easeOut' });
  hud.tweens.add({ targets: m, alpha: 0, delay: 500, duration: 300 });
}

function showComboP1(hud, n) {
  // The shipped streak splash — sizes, colours, timings — with its lane taken
  // from the boxes above it rather than a fixed +58 step.
  if (!hud.comboText) {
    hud.comboText = hud.add.text(VIEW.width / 2, HUDCFG.topBarHeight + 146, ' ', {
      fontFamily: FONTS.display,
      fontStyle: 'bold', color: '#ffd040', stroke: '#000000', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(35).setAlpha(0).setResolution(2);
  }
  const c = hud.comboText;
  hud.tweens.killTweensOf(c);
  const milestone = n >= 10 && n % 10 === 0;
  const tier = n >= 10 ? 2 : (n >= 5 ? 1 : 0);
  const size = [30, 46, 76][tier];
  const peak = [1.0, 1.12, 1.3][tier];
  const holdMs = [260, 520, 900][tier];
  const fadeMs = [300, 500, 700][tier];
  const exit = [1.06, 1.22, 1.62][tier];
  const colors = [null, null, '#ffd040', '#ffaa20', '#ff8020', '#ff4020', '#ff2020'];
  const col = milestone ? '#ffffff' : (colors[Math.min(colors.length - 1, n)] || '#ff2020');
  c.setFontSize(size);
  c.setText(`x${n}!`).setColor(col);
  // Lane: the shipped home (+26 for a milestone), stepped clear of the
  // banner's peak box and the sign. The splash's own reference is its HOLD
  // scale — its exit growth happens while it fades out.
  const home = HUDCFG.topBarHeight + 146 + (tier === 2 ? 26 : 0);
  const half = (c.height * peak) / 2;
  c.y = Math.max(home, Math.max(bannerLiveBottom(hud), signBottom(hud)) + P1_BANNER.laneGap + half);
  c.setScale(peak * 0.5).setAlpha(1);
  hud.tweens.add({ targets: c, scale: peak, duration: milestone ? 220 : 170, ease: 'Back.easeOut' });
  hud.tweens.add({ targets: c, alpha: 0, scale: exit, duration: fadeMs, delay: holdMs, ease: 'Cubic.easeIn' });
}

function showSectorSignP1(hud, sector, kills) {
  // The shipped sign, with its directive fitted INSIDE the plate and an
  // arrival slam that never stretches the plate past the canvas.
  const sub = kills > 0 ? `SECTOR ${sector} CLEARED — ${kills} HOSTILES DOWN` : `SECTOR ${sector} CLEARED`;
  hud.signSub.setText(sub);
  if (hud._signShown) return;
  hud._signShown = true;
  const W = VIEW.width - 56;
  const inner = W - 2 * P1_BANNER.sign.pad;
  const main = hud.signMain;
  if (!main._p1Fit) {
    let s = 46;
    main.setFontSize(s);
    for (let i = 0; i < 30 && main.width * P1_BANNER.ink > inner && s > 20; i++) main.setFontSize(--s);
    main._p1Fit = s;
  }
  // and the after-action line, which grows with the kill count
  let ss = 19; hud.signSub.setFontSize(ss);
  for (let i = 0; i < 10 && hud.signSub.width * P1_BANNER.ink > inner && ss > 12; i++) hud.signSub.setFontSize(--ss);

  const slamX = Math.min(P1_BANNER.sign.slamX, (VIEW.width - 16) / W);
  const c = hud.sectorSign;
  c.setVisible(true).setAlpha(0).setScale(slamX, 0.7);
  hud._signTweens.push(hud.tweens.add({ targets: c, alpha: 1, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' }));
  hud._signTweens.push(hud.tweens.add({ targets: c, alpha: { from: 1, to: 0.86 }, duration: 1400, yoyo: true, repeat: -1, delay: 300, ease: 'Sine.easeInOut' }));
  const h = hud._signH;
  hud.signScan.y = -h / 2;
  hud._signTweens.push(hud.tweens.add({ targets: hud.signScan, y: { from: -h / 2 + 4, to: h / 2 - 4 }, duration: 2200, repeat: -1, ease: 'Sine.easeInOut' }));
  SFX.uiClick?.();
}
