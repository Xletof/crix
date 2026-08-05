// Title screen: endless as the front door, and the score to beat on it.
//
// The point of this stage is that the high-score mode leads and its record is
// the first thing you read. Both halves are things a layout tweak can silently
// undo — a reordered button or a band nudged under the portrait — and neither
// shows up in any gameplay assertion, so they are checked here as geometry and
// as content.
//
// The fresh-install case matters as much as the populated one: a brand new
// player must not be shown "BEST 0", which reads as a broken readout rather
// than as an invitation.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => fail(`page error: ${e}`));

const SAVE = {
  runs: 12, wins: 2, bestKills: 486, bestTime: 742000, totalKills: 3120,
  bestScore: 96500, bestScoreEndless: 283542, bestEndlessSector: 9, bestMaxCombo: 2,
};

const load = async (stats) => {
  await page.goto(URL);
  await page.evaluate((st) => {
    if (st === null) localStorage.removeItem('crix.stats');
    else localStorage.setItem('crix.stats', JSON.stringify(st));
  }, stats);
  await page.reload();
  await page.waitForTimeout(4200);
};

const snapshot = () => page.evaluate(() => {
  const t = window.game.scene.getScene('Title');
  const box = (o) => { const b = o.getBounds(); return { t: o.text ?? '(sprite)', x: b.x, y: b.y, r: b.right, b: b.bottom }; };
  const texts = t.children.list.filter((o) => o.type === 'Text' && o.visible && o.text.trim());
  const find = (frag) => { const o = texts.find((x) => x.text.includes(frag)); return o ? box(o) : null; };
  const sprite = t.children.list.find((o) => o.type === 'Sprite');
  // The character occupies roughly the middle of its frame — the rest of the
  // spritesheet cell is transparent padding, and Phaser reports the whole cell
  // as the bounds. Comparing raw bounds against neighbouring text reports an
  // overlap the screen plainly does not have, so inset to the drawn area. The
  // check still catches the regression that matters (a band moved onto the
  // sprite) without failing on empty pixels.
  const visible = (o) => {
    const b = o.getBounds();
    const pad = b.height * 0.14;
    return { t: '(portrait)', x: b.x, y: b.y + pad, r: b.right, b: b.bottom - pad };
  };
  return {
    all: texts.map((o) => o.text),
    best: find('BEST'),
    rankLine: find('RANK '),
    prompt: find('SURVIVE THE SECTORS'),
    endless: find('ENDLESS'),
    campaign: find('CAMPAIGN'),
    records: find('RECORDS'),
    portrait: sprite ? visible(sprite) : null,
  };
});

await load(SAVE);
const withRecord = await snapshot();

// The rank shown must be the ENDLESS rank for the endless best — using the
// campaign table here would over-grade it, which is the whole reason the two
// tables are separate.
const expectedRank = await page.evaluate(async (best) => {
  const { rankFor } = await import('/src/data/ranks.js');
  return { endless: rankFor(best, 'endless').name, campaign: rankFor(best, 'campaign').name };
}, SAVE.bestScoreEndless);

// Records overlay.
const records = await page.evaluate(async () => {
  const t = window.game.scene.getScene('Title');
  // The RECORDS zone sits at 0.925 of the screen height. Firing every zone
  // starts a run instead, and picking "the lowest" caught the wrong one.
  const zones = t.children.list.filter((o) => o.type === 'Zone' && o.input);
  const target = 1280 * 0.925;
  zones.sort((a, b) => Math.abs(a.y - target) - Math.abs(b.y - target))[0].emit('pointerup');
  await new Promise((res) => setTimeout(res, 600));
  // The overlay's rows live inside a Container, so they are not in the scene's
  // own display list — reading that list returned the title screen's text and
  // made this look like a content bug rather than a probe that never opened it.
  const container = t.children.list.find((o) => o.type === 'Container' && o.visible && o.list?.length);
  return (container?.list || []).filter((o) => o.type === 'Text' && o.text.trim()).map((o) => o.text);
});

await load(null);
const fresh = await snapshot();

await browser.close();

const overlaps = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

// ── The score to beat ────────────────────────────────────────────────────
check(!!withRecord.best && withRecord.best.t.includes('283,542'),
  'the endless record is on the title screen',
  withRecord.best ? withRecord.best.t : 'no BEST line');
check(!!withRecord.rankLine && withRecord.rankLine.t.includes(`RANK ${expectedRank.endless}`),
  'it is graded with the ENDLESS table, not the campaign one',
  `line "${withRecord.rankLine?.t}", endless rank ${expectedRank.endless}, campaign rank would be ${expectedRank.campaign}`);
check(!!withRecord.rankLine && withRecord.rankLine.t.includes('SECTOR 9'),
  'and shows how deep that run got', withRecord.rankLine?.t);
check(!!withRecord.rankLine && /S AT|TOP RANK/.test(withRecord.rankLine.t),
  'and what the next rank up would cost', withRecord.rankLine?.t);

// ── Endless leads ────────────────────────────────────────────────────────
check(!!withRecord.endless && !!withRecord.campaign && withRecord.endless.y < withRecord.campaign.y,
  'ENDLESS sits above CAMPAIGN — it is the front door now',
  `endless y=${Math.round(withRecord.endless?.y)}, campaign y=${Math.round(withRecord.campaign?.y)}`);

// ── Nothing collides ─────────────────────────────────────────────────────
check(!overlaps(withRecord.best, withRecord.portrait) && !overlaps(withRecord.rankLine, withRecord.portrait),
  'the score band clears the portrait',
  `band ${Math.round(withRecord.best?.y)}..${Math.round(withRecord.rankLine?.b)}, portrait ends ${Math.round(withRecord.portrait?.b)}`);
check(!overlaps(withRecord.rankLine, withRecord.endless) && !overlaps(withRecord.best, withRecord.endless),
  'and clears the ENDLESS button',
  `rank line ends ${Math.round(withRecord.rankLine?.b)}, button starts ${Math.round(withRecord.endless?.y)}`);
check(!overlaps(withRecord.endless, withRecord.campaign) && !overlaps(withRecord.campaign, withRecord.records),
  'the three buttons do not overlap each other', '');

// ── Fresh install ────────────────────────────────────────────────────────
check(!fresh.best, 'a player with no record is not shown a BEST line',
  fresh.best ? `showed "${fresh.best.t}"` : '');
check(!!fresh.prompt, 'they get an invitation instead', fresh.all.join(' | ').slice(0, 120));
check(!fresh.all.some((t) => /BEST\s+0\b/.test(t)), 'and never a zero score, which reads as broken',
  fresh.all.filter((t) => /BEST/.test(t)).join(', '));
check(!!fresh.endless && !!fresh.campaign && fresh.endless.y < fresh.campaign.y,
  'endless still leads on a fresh install', '');

// ── Records overlay ──────────────────────────────────────────────────────
const rec = records.join(' | ');
check(/ENDLESS BEST:\s*283,542/.test(rec), 'the records screen leads with the endless best', rec.slice(0, 160));
check(/CAMPAIGN BEST:\s*96,500/.test(rec), 'and carries the campaign best separately', rec.slice(0, 160));
check(records.some((t) => /ENDLESS BEST/.test(t) && /\[[SABCD]\]/.test(t)),
  'both bests are shown with the rank they earned',
  records.filter((t) => /BEST/.test(t)).join(' | '));

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — endless leads, and its record is the first thing you read`);
