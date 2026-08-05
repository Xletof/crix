import Phaser from 'phaser';
import { VIEW, FONTS } from '../config.js';
import { SFX, stopMusic } from '../systems/FX.js';
import { loadStats, saveStats } from './TitleScene.js';
import { rankFor } from '../data/ranks.js';
import { seedToCode } from '../systems/rng.js';
import { NARRATIVE } from '../data/narrative.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ win, stats, mode }) {
    stopMusic();
    if (win) SFX.victory();
    else SFX.defeat();

    const globalStats = loadStats();
    globalStats.runs = (globalStats.runs || 0) + 1;
    if (win) globalStats.wins = (globalStats.wins || 0) + 1;

    // Compare and update records
    if (stats) {
      if (win) {
        if (!globalStats.bestTime || stats.clearTime < globalStats.bestTime) {
          globalStats.bestTime = stats.clearTime;
        }
      }
      globalStats.bestStealthKills = Math.max(globalStats.bestStealthKills || 0, stats.stealthKills);
      globalStats.bestMaxCombo = Math.max(globalStats.bestMaxCombo || 1.0, stats.maxCombo);
      globalStats.lastDamageTaken = stats.damageTaken;
      globalStats.bestKills  = Math.max(globalStats.bestKills || 0, stats.kills || 0);
      globalStats.totalKills = (globalStats.totalKills || 0) + (stats.kills || 0);
      // Score records are kept per MODE. Campaign and endless score on
      // completely different curves — endless keeps paying out for as long as
      // you survive — so one shared best would make the campaign record
      // permanently unbeatable and meaningless.
      const scoreKey = mode === 'endless' ? 'bestScoreEndless' : 'bestScore';
      const prevBest = globalStats[scoreKey] || 0;
      globalStats[scoreKey] = Math.max(prevBest, stats.score || 0);
      this._newScoreRecord = (stats.score || 0) > prevBest && (stats.score || 0) > 0;
      globalStats.totalScore = (globalStats.totalScore || 0) + (stats.score || 0);
      if (mode === 'endless') {
        globalStats.bestEndlessSector = Math.max(globalStats.bestEndlessSector || 0, stats.sector || 0);
      }
    }
    saveStats(globalStats);

    const cx = VIEW.width / 2;
    this.cameras.main.setBackgroundColor('#06060c');

    const g = this.add.graphics();

    // ── Background ─────────────────────────────────────────────────────────
    g.fillStyle(0x06060c, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);

    // Stars
    const rng = new Phaser.Math.RandomDataGenerator(['sw-gameover-seed']);
    for (let i = 0; i < 160; i++) {
      const sx = rng.between(0, VIEW.width);
      const sy = rng.between(0, VIEW.height);
      const b = rng.frac();
      g.fillStyle(0xffffff, 0.3 + b * 0.5);
      g.fillRect(sx, sy, b > 0.88 ? 2 : 1, b > 0.88 ? 2 : 1);
    }

    if (win) {
      // ── WIN: Hologram transmission panel ────────────────────────────────
      // Blue hologram glow backdrop
      g.fillStyle(0x0038bb, 0.08);
      g.fillRect(0, 0, VIEW.width, VIEW.height);

      // Scan line effect
      for (let y = 0; y < VIEW.height; y += 6) {
        g.fillStyle(0x0050ff, 0.04);
        g.fillRect(0, y, VIEW.width, 2);
      }

      // Panel border
      const pw = VIEW.width - 60, ph = 700;
      const px = 30, py = 60;
      g.lineStyle(3, 0x0060ff, 0.9);
      g.strokeRoundedRect(px, py, pw, ph, 6);
      g.fillStyle(0x001830, 0.6);
      g.fillRoundedRect(px, py, pw, ph, 6);
      // Corner brackets
      this._brackets(g, px, py, pw, ph, 0x0080ff, 20);

      // "TRANSMISSION RECEIVED" header
      this.add.text(cx, py + 40, '[ TRANSMISSION RECEIVED ]', {
        fontFamily: FONTS.display,
        fontSize: '22px',
        color: '#4080ff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      // Main outcome
      const outcomeY = py + 200;
      const outcomeShadow = this.add.text(cx + 4, outcomeY + 4, 'BOUNTY\nDELIVERED', {
        fontFamily: FONTS.display,
        fontSize: '82px',
        fontStyle: 'bold',
        color: '#000000',
        align: 'center',
      }).setOrigin(0.5).setAlpha(0.5).setResolution(2);

      const outcome = this.add.text(cx, outcomeY, 'BOUNTY\nDELIVERED', {
        fontFamily: FONTS.display,
        fontSize: '82px',
        fontStyle: 'bold',
        color: '#4080ff',
        stroke: '#001060',
        strokeThickness: 6,
        align: 'center',
      }).setOrigin(0.5).setResolution(2);

      // Pop-in
      outcome.setScale(0.3);
      outcomeShadow.setScale(0.3);
      this.tweens.add({
        targets: [outcome, outcomeShadow],
        scale: 1,
        duration: 380,
        delay: 80,
        ease: 'Back.easeOut',
      });

      // Hologram flicker
      this.tweens.add({
        targets: outcome,
        alpha: { from: 1, to: 0.75 },
        duration: 120,
        yoyo: true,
        repeat: -1,
        repeatDelay: 1800,
        ease: 'Linear',
      });

      // Subtitle — questline closing line.
      this.add.text(cx, py + 312, NARRATIVE.victoryLine, {
        fontFamily: FONTS.body,
        fontSize: '20px',
        fontStyle: 'italic',
        color: '#8ab8ff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      // Stats block card
      // Grown from 150 to fit the score line added above the four stat rows.
      // The two buttons below moved down to match; leaving them where they were
      // put RETRY straight through the middle of this card.
      const boxY = py + 332, boxW = pw - 60, boxH = 176;
      g.fillStyle(0x0038bb, 0.15);
      g.fillRoundedRect(px + 30, boxY, boxW, boxH, 6);
      g.lineStyle(1.5, 0x0060ff, 0.45);
      g.strokeRoundedRect(px + 30, boxY, boxW, boxH, 6);
      
      const formatTime = (ms) => {
        if (!ms) return 'N/A';
        const sec = Math.floor(ms / 1000) % 60;
        const min = Math.floor(ms / 60000);
        return `${min}m ${sec}s`;
      };
      
      const statsStyle = {
        fontFamily: FONTS.body,
        fontSize: '18px',
        color: '#8ab8ff',
        stroke: '#000000',
        strokeThickness: 2,
      };

      // Score leads. It is the one line that summarises the whole run, so it
      // gets its own colour and the record flag rather than being the fourth
      // row of a list.
      // Rank sits on the right of the card; the score line's right edge stops
      // short of it so a long score and its record tag cannot run underneath.
      this._rankBadge(px + pw - 105, boxY + 58, stats?.score || 0, 'campaign');
      this._scoreLine(px + 50, boxY + 14, stats?.score || 0, globalStats.bestScore || 0, px + pw - 190);
      this.add.text(px + 50, boxY + 62, `TIME:    ${formatTime(stats?.clearTime)}  (PB: ${formatTime(globalStats.bestTime)})`, statsStyle);
      this.add.text(px + 50, boxY + 90, `KILLS:   ${stats?.kills || 0}  (PB: ${globalStats.bestKills || 0})`, statsStyle);
      this.add.text(px + 50, boxY + 118, `CHARGE:  x${(stats?.maxCombo || 1.0).toFixed(1)}  (PB: x${(globalStats.bestMaxCombo || 1.0).toFixed(1)})`, statsStyle);
      this.add.text(px + 50, boxY + 146, `DAMAGE:  ${stats?.damageTaken || 0} HP`, statsStyle);
      this._seedLine(cx, boxY + 190, stats?.seed);

      // Buttons
      this.impButton(cx, py + ph - 150, 'NEW MISSION', true, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
      }, win);
      this.impButton(cx, py + ph - 60, 'MAIN MENU', false, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
      }, win);

    } else {
      // ── LOSE: Imperial Alert Screen ──────────────────────────────────────
      // Red alert overlay
      g.fillStyle(0x200000, 0.7);
      g.fillRect(0, 0, VIEW.width, VIEW.height);

      // Red scan lines
      for (let y = 0; y < VIEW.height; y += 6) {
        g.fillStyle(0xff0000, 0.04);
        g.fillRect(0, y, VIEW.width, 2);
      }

      // Panel border
      const pw = VIEW.width - 60, ph = 700;
      const px = 30, py = 60;
      g.lineStyle(3, 0xff0000, 0.9);
      g.strokeRoundedRect(px, py, pw, ph, 6);
      g.fillStyle(0x1a0000, 0.75);
      g.fillRoundedRect(px, py, pw, ph, 6);
      this._brackets(g, px, py, pw, ph, 0xff2020, 20);

      // "IMPERIAL ALERT" header
      this.add.text(cx, py + 40, '[ IMPERIAL ALERT ]', {
        fontFamily: FONTS.display,
        fontSize: '24px',
        color: '#ff2020',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      // Imperial logo hint (cog outline)
      g.lineStyle(2, 0x440000, 0.8);
      g.strokeCircle(cx, py + 120, 36);
      g.strokeCircle(cx, py + 120, 20);
      // 8 cog teeth
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const r1 = 38, r2 = 46;
        g.lineStyle(3, 0x550000, 0.8);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r1, py + 120 + Math.sin(a) * r1);
        g.lineTo(cx + Math.cos(a) * r2, py + 120 + Math.sin(a) * r2);
        g.strokePath();
      }

      // Main outcome
      const outcomeY = py + 215;
      const outcomeShadow = this.add.text(cx + 4, outcomeY + 4, 'TARGET\nNEUTRALIZED', {
        fontFamily: FONTS.display,
        fontSize: '78px',
        fontStyle: 'bold',
        color: '#000000',
        align: 'center',
      }).setOrigin(0.5).setAlpha(0.5).setResolution(2);

      const outcome = this.add.text(cx, outcomeY, 'TARGET\nNEUTRALIZED', {
        fontFamily: FONTS.display,
        fontSize: '78px',
        fontStyle: 'bold',
        color: '#ff2020',
        stroke: '#440000',
        strokeThickness: 6,
        align: 'center',
      }).setOrigin(0.5).setResolution(2);

      outcome.setScale(0.3);
      outcomeShadow.setScale(0.3);
      this.tweens.add({
        targets: [outcome, outcomeShadow],
        scale: 1,
        duration: 380,
        delay: 80,
        ease: 'Back.easeOut',
      });

      // Flicker
      this.tweens.add({
        targets: outcome,
        alpha: { from: 1, to: 0.6 },
        duration: 80,
        yoyo: true,
        repeat: -1,
        repeatDelay: 1200,
      });

      this.add.text(cx, py + 312, 'The bounty hunter has been eliminated.', {
        fontFamily: FONTS.body,
        fontSize: '20px',
        fontStyle: 'italic',
        color: '#aa4040',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      // Stats block card (Lose)
      // See the note on the victory card: grown for the score line, and the
      // buttons below moved down out of it.
      const boxY = py + 332, boxW = pw - 60, boxH = 176;
      g.fillStyle(0xff0000, 0.08);
      g.fillRoundedRect(px + 30, boxY, boxW, boxH, 6);
      g.lineStyle(1.5, 0xff0000, 0.4);
      g.strokeRoundedRect(px + 30, boxY, boxW, boxH, 6);
      
      const formatTime = (ms) => {
        if (!ms) return 'N/A';
        const sec = Math.floor(ms / 1000) % 60;
        const min = Math.floor(ms / 60000);
        return `${min}m ${sec}s`;
      };

      const statsStyle = {
        fontFamily: FONTS.body,
        fontSize: '18px',
        color: '#ff8080',
        stroke: '#000000',
        strokeThickness: 2,
      };

      // Endless runs care about depth reached more than elapsed time, so swap
      // the first line for the sector record when that's the mode played.
      const firstLine = mode === 'endless'
        ? `SECTOR REACHED: ${stats?.sector || 0}  (PB: ${globalStats.bestEndlessSector || 0})`
        : `TIME ELAPSED: ${formatTime(stats?.clearTime)}`;
      this._rankBadge(px + pw - 105, boxY + 58, stats?.score || 0, mode);
      this._scoreLine(px + 50, boxY + 14, stats?.score || 0,
        (mode === 'endless' ? globalStats.bestScoreEndless : globalStats.bestScore) || 0,
        px + pw - 190);
      this.add.text(px + 50, boxY + 62, firstLine, statsStyle);
      this.add.text(px + 50, boxY + 90, `KILLS:        ${stats?.kills || 0}  (PB: ${globalStats.bestKills || 0})`, statsStyle);
      this.add.text(px + 50, boxY + 118, `CHARGE PEAK:  x${(stats?.maxCombo || 1.0).toFixed(1)}  (PB: x${(globalStats.bestMaxCombo || 1.0).toFixed(1)})`, statsStyle);
      this.add.text(px + 50, boxY + 146, `DAMAGE TAKEN: ${stats?.damageTaken || 0} HP`, statsStyle);
      this._seedLine(cx, boxY + 190, stats?.seed);

      this.impButton(cx, py + ph - 150, mode === 'endless' ? 'RETRY ENDLESS' : 'RETRY MISSION', true, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', mode === 'endless' ? { mode: 'endless' } : undefined));
      }, win);
      this.impButton(cx, py + ph - 60, 'MAIN MENU', false, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
      }, win);
    }

    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  // Corner bracket decoration helper
  _brackets(g, x, y, w, h, color, size) {
    g.lineStyle(3, color, 1);
    // TL
    g.beginPath(); g.moveTo(x + size, y); g.lineTo(x, y); g.lineTo(x, y + size); g.strokePath();
    // TR
    g.beginPath(); g.moveTo(x + w - size, y); g.lineTo(x + w, y); g.lineTo(x + w, y + size); g.strokePath();
    // BL
    g.beginPath(); g.moveTo(x + size, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h - size); g.strokePath();
    // BR
    g.beginPath(); g.moveTo(x + w - size, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - size); g.strokePath();
  }

  // Imperial-style button
  // The run's score, plus its personal best — or a NEW RECORD flash when this
  // run WAS the best. Shared by the victory and defeat panels so the two
  // cannot drift apart.
  // The rank badge — a big letter beside the score, plus what the next one up
  // would have cost. The "next" line is the point of the whole feature: a bare
  // grade tells you how you did, a grade plus its target tells you what to aim
  // at on the retry.
  _rankBadge(cx, y, score, mode) {
    const rank = rankFor(score, mode === 'endless' ? 'endless' : 'campaign');

    const letter = this.add.text(cx, y, rank.name, {
      fontFamily: FONTS.display,
      fontSize: '76px',
      fontStyle: 'bold',
      color: rank.color,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setResolution(2);

    this.add.text(cx, y + 48, rank.blurb, {
      fontFamily: FONTS.body,
      fontSize: '15px',
      fontStyle: 'bold',
      color: rank.color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    if (rank.next) {
      this.add.text(cx, y + 70, `${rank.next.id} AT ${rank.next.at.toLocaleString('en-US')}`, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#8ab8ff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
    }

    // Land it like a stamp rather than fading it in — this is the verdict on
    // the run and it should arrive with some weight.
    letter.setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: letter, scale: 1, alpha: 1, duration: 420, delay: 260, ease: 'Back.easeOut' });
    return rank;
  }

  // The run's seed, as the short code the player can read back to us. Quiet by
  // design — it is diagnostic, not a score — but it has to be ON the screen,
  // because a bad encounter nobody can reproduce is a bug report nobody can act
  // on. Paired with the DebugScene entry field, it also lets a run be replayed.
  _seedLine(cx, y, seed) {
    if (seed == null) return;
    this.add.text(cx, y, `SEED ${seedToCode(seed)}`, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: '#4a5a80',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }

  _scoreLine(x, y, score, best, rightEdge = VIEW.width - 40) {
    const label = this.add.text(x, y, `SCORE  ${score.toLocaleString('en-US')}`, {
      fontFamily: FONTS.display,
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#ffd040',
      stroke: '#000000',
      strokeThickness: 4,
    }).setResolution(2);

    // Build the tag FIRST and measure it, then place it — do not guess either
    // width. A fixed offset put "NEW RECORD" on top of a six-figure score, and
    // guessing the tag's width instead bumped it onto a second line where it
    // landed on the first stat row. Both were caught in screenshots, not by an
    // assertion, which is why the layout test now measures real bounds.
    const record = !!this._newScoreRecord;
    const tag = this.add.text(0, 0, record ? 'NEW RECORD' : `PB ${best.toLocaleString('en-US')}`, {
      fontFamily: FONTS.body,
      fontSize: record ? '16px' : '15px',
      fontStyle: record ? 'bold' : 'normal',
      color: record ? '#40ff90' : '#8ab8ff',
      stroke: '#000000',
      strokeThickness: record ? 3 : 2,
    });

    // Right-align the tag to the space available, then shrink the score if the
    // two would still collide. Staying on one line matters: the row below is
    // the first stat and there is nowhere else for this to go.
    tag.setPosition(Math.max(x, rightEdge - tag.width), y + 10);
    const gap = 12;
    if (label.x + label.width + gap > tag.x) {
      label.setFontSize(22);
      tag.setPosition(Math.max(x, rightEdge - tag.width), y + 6);
    }

    if (record) {
      this.tweens.add({ targets: tag, alpha: 0.25, duration: 520, yoyo: true, repeat: -1 });
    }
  }

  impButton(cx, cy, label, isPrimary, onClick, win) {
    const btnW = 380, btnH = 78;
    const bg = this.add.graphics();
    const mainColor = win
      ? (isPrimary ? 0x0040cc : 0x002080)
      : (isPrimary ? 0xcc0000 : 0x660000);
    const hoverColor = win
      ? (isPrimary ? 0x0060ff : 0x003acc)
      : (isPrimary ? 0xff2020 : 0xaa0000);
    const borderColor = win ? 0x0080ff : 0xff2020;
    const textColor = win ? '#40b8ff' : '#ff4444';

    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.5);
      bg.fillRoundedRect(cx - btnW / 2 + 3, cy - btnH / 2 + 5, btnW, btnH, 4);
      bg.fillStyle(hover ? hoverColor : mainColor, 1);
      bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 4);
      bg.lineStyle(2, borderColor, hover ? 1 : 0.6);
      bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 4);
      // Top shimmer
      bg.fillStyle(0xffffff, hover ? 0.12 : 0.06);
      bg.fillRoundedRect(cx - btnW / 2 + 6, cy - btnH / 2 + 6, btnW - 12, 12, 3);
    };

    draw(false);

    const text = this.add.text(cx, cy, label, {
      fontFamily: FONTS.display,
      fontSize: '36px',
      fontStyle: 'bold',
      color: textColor,
      stroke: '#000000',
      strokeThickness: 3,
      letterSpacing: 4,
    }).setOrigin(0.5);

    if (isPrimary) {
      this.tweens.add({
        targets: text,
        scale: 1.04,
        duration: 750,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const zone = this.add.zone(cx, cy, btnW, btnH).setOrigin(0.5).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => draw(true));
    zone.on('pointerup', () => onClick());
  }
}
