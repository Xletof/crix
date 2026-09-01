// EVIDENCE — REACTOR JUNCTION TOPOLOGY DIAGRAM, before and after.
//
//   node tests/shot-junction-layout.mjs
//
// A plan view of what is SOLID in the room, drawn from the live spec rather
// than from a hand-copied list, so the diagram cannot disagree with the game.
// Bodies are drawn at their real rects; the crossing — the room's own authored
// open region, and the clear-combat envelope this pass adopts — is outlined;
// every obstacle pair closer than the 160px lane target is joined by a red bar.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/evidence/arena-pilot';
mkdirSync(OUT, { recursive: true });

const RING = [
  { x: 700, y: 420, tex: 'ch-con-heavy' }, { x: 700, y: 980, tex: 'rj-cab-a' },
  { x: 420, y: 700, tex: 'ch-con-ped-b' }, { x: 980, y: 700, tex: 'ch-con-ped-a' },
  { x: 500, y: 500, tex: 'rj-cab-b' }, { x: 900, y: 500, tex: 'rj-cab-a' },
  { x: 500, y: 900, tex: 'rj-cab-b' }, { x: 900, y: 900, tex: 'rj-cab-a' },
];

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1240, height: 700 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));
await page.goto(URL);
await page.waitForTimeout(4000);

const png = await page.evaluate(async ({ ring }) => {
  const { ROOMS } = await import('/src/data/rooms.js');
  const { snapAll } = await import('/src/data/mapUtils.js');
  const spec = ROOMS.find((r) => r.id === 'corridor');
  const LANE = 160, S = 0.4, PAD = 40, W = 1400 * S;

  const rectsFor = (cover) => [
    ...snapAll(cover).map((c) => ({ x: c.x - 35, y: c.y - 35, w: 70, h: 70, kind: 'cover', tex: c.tex })),
    ...spec.props.filter((p) => p.solid).map((p) => ({
      x: p.x - p.bodyW / 2, y: p.y - p.bodyH / 2, w: p.bodyW, h: p.bodyH, kind: 'prop', tex: p.tex })),
  ];

  const cv = document.createElement('canvas');
  cv.width = W * 2 + PAD * 3; cv.height = W + PAD * 2 + 34;
  const g = cv.getContext('2d');
  g.fillStyle = '#0d1014'; g.fillRect(0, 0, cv.width, cv.height);

  const panel = (ox, cover, title) => {
    const T = (v) => v * S;
    g.save(); g.translate(ox, PAD + 26);
    g.fillStyle = '#181d23'; g.fillRect(0, 0, W, W);
    g.strokeStyle = '#3a444f'; g.lineWidth = 2; g.strokeRect(0, 0, W, W);
    // the crossing — the authored open region
    g.setLineDash([6, 5]); g.strokeStyle = '#5f8f6a';
    g.strokeRect(T(400), T(400), T(600), T(600)); g.setLineDash([]);
    g.fillStyle = '#5f8f6a'; g.font = '11px monospace';
    g.fillText('crossing 600x600', T(408), T(392));
    // gates, spawn, exit, objective
    const dot = (x, y, c, label) => {
      g.fillStyle = c; g.beginPath(); g.arc(T(x), T(y), 5, 0, 7); g.fill();
      g.font = '11px monospace'; g.fillText(label, T(x) + 8, T(y) + 4);
    };
    spec.gates.forEach((gt, i) => dot(gt.x, gt.y, '#c98a3a', 'gate' + i));
    dot(spec.spawn.x, spec.spawn.y, '#5aa8d8', 'spawn');
    dot(spec.exit.x, spec.exit.y, '#5ad8a8', 'exit');

    const rs = rectsFor(cover);
    for (const r of rs) {
      g.fillStyle = r.kind === 'prop' ? '#4a5460' : (r.tex.startsWith('rj-cab') ? '#39424c' : '#6b7c8c');
      g.fillRect(T(r.x), T(r.y), T(r.w), T(r.h));
      g.strokeStyle = '#8f9dab'; g.lineWidth = 1;
      g.strokeRect(T(r.x), T(r.y), T(r.w), T(r.h));
    }
    // sub-lane gaps
    const gap = (a, b) => Math.max(
      Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) - (a.w + b.w) / 2,
      Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) - (a.h + b.h) / 2);
    let chokes = 0;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const d = gap(rs[i], rs[j]);
      if (d > 0 && d < 160) {
        chokes++;
        g.strokeStyle = '#d05050'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(T(rs[i].x + rs[i].w / 2), T(rs[i].y + rs[i].h / 2));
        g.lineTo(T(rs[j].x + rs[j].w / 2), T(rs[j].y + rs[j].h / 2));
        g.stroke();
      }
    }
    // objective
    g.strokeStyle = '#e8e2d0'; g.lineWidth = 2;
    g.beginPath(); g.arc(T(700), T(700), 8, 0, 7); g.stroke();
    g.fillStyle = '#e8e2d0'; g.font = '11px monospace'; g.fillText('objective', T(700) + 12, T(700) + 4);

    g.fillStyle = '#cfd6dd'; g.font = 'bold 15px monospace';
    g.fillText(title, 0, -8);
    g.fillStyle = chokes ? '#d05050' : '#5f8f6a'; g.font = '12px monospace';
    g.fillText(`${snapAll(cover).length} cover · ${chokes} sub-160px gap${chokes === 1 ? '' : 's'}`, W - 210, -8);
    g.restore();
  };

  panel(PAD, ring, 'BEFORE — the eight-cover ring');
  panel(PAD * 2 + W, spec.cover, 'AFTER — ' + spec.cover.length + ' cover, open crossing');
  return cv.toDataURL('image/png').split(',')[1];
}, { ring: RING });

writeFileSync(`${OUT}/junction-topology-diagram.png`, Buffer.from(png, 'base64'));
console.log(`wrote ${OUT}/junction-topology-diagram.png`);
await browser.close();
