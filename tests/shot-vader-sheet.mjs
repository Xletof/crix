// Compose the two review sheets from the frames `shot-vader-language.mjs` shot.
//
// The unlabelled sheet is the actual review artefact and it is built to be
// honest about the question it asks. The moves are in a FIXED SHUFFLED order and
// carry only a letter, so position on the page cannot leak the answer — a
// reviewer working down a sheet in registry order starts recognising moves by
// where they are, which quietly turns "can you identify this" into "can you
// count". The labelled key uses the SAME letters in the SAME order, so it
// decodes the sheet rather than being a second, differently-ordered document.
//
// Each row is one attack across its four beats, left to right:
//   early wind-up -> late wind-up -> release -> recovery
//
//   node tests/shot-vader-language.mjs              # labelled frames
//   node tests/shot-vader-language.mjs --nonames    # unlabelled frames
//   node tests/shot-vader-sheet.mjs                 # -> both sheets
//
// Writes tests/out/vlang/SHEET-unlabelled.png and SHEET-key.png.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';

const DIR = new URL('./out/vlang/', import.meta.url).pathname;

// Fixed, arbitrary, and deliberately not registry order.
const ROWS = [
  { letter: 'A', id: 'forcepush',    name: 'FORCE PUSH' },
  { letter: 'B', id: 'charge',       name: 'CHARGE' },
  { letter: 'C', id: 'forcepull',    name: 'FORCE PULL' },
  { letter: 'D', id: 'overheadslam', name: 'OVERHEAD SLAM' },
  { letter: 'E', id: 'vanishslash',  name: 'VANISH' },
  { letter: 'F', id: 'sabercombo',   name: 'SABER COMBO' },
  { letter: 'G', id: 'saberthrow',   name: 'SABER THROW' },
];
const MARKS = ['1-early', '2-late', '3-release', '4-after'];
const HEADS = ['early wind-up', 'late wind-up', 'release', 'recovery'];

const build = (sub, labelled) => {
  const cells = ROWS.map((r) => {
    const imgs = MARKS.map((m) => {
      const p = `${DIR}${sub}/${r.id}-${m}.png`;
      if (!existsSync(p)) throw new Error(`missing frame: ${p}`);
      // RELATIVE, and the page is written into the same directory. A
      // `setContent` page has an opaque origin, so Chromium refuses every
      // file:// image on it and the sheet renders as 28 broken-image icons —
      // which photographs as a completely blank review sheet and looks exactly
      // like the game having drawn nothing at all.
      return `<img src="${sub}/${r.id}-${m}.png">`;
    }).join('');
    const tag = labelled ? `${r.letter} &middot; ${r.name}` : r.letter;
    return `<div class="row"><div class="tag${labelled ? ' named' : ''}">${tag}</div>${imgs}</div>`;
  }).join('');

  return `<style>
    body{margin:0;background:#0b0d12;font-family:ui-monospace,Menlo,monospace;color:#c8d0dc}
    h1{font-size:22px;margin:22px 26px 4px;letter-spacing:.06em}
    p.sub{font-size:13px;margin:0 26px 18px;color:#7f8a9c;max-width:1100px;line-height:1.5}
    .heads{display:flex;margin:0 26px 6px;gap:10px}
    .heads .tag{width:150px}
    .heads span{width:250px;font-size:12px;color:#7f8a9c;text-align:center;letter-spacing:.08em;text-transform:uppercase}
    .row{display:flex;align-items:center;gap:10px;margin:0 26px 10px}
    .tag{width:150px;font-size:26px;font-weight:700;color:#e8703a;letter-spacing:.05em}
    .tag.named{font-size:15px;color:#e8a03a;line-height:1.3}
    img{width:250px;display:block;border:1px solid #1e2430;border-radius:3px}
  </style>
  <h1>${labelled ? 'KEY — Vader attack visual language' : 'Vader attack visual language — UNLABELLED'}</h1>
  <p class="sub">${labelled
    ? 'The same seven rows, same letters, same order as the unlabelled sheet.'
    : 'One attack per row, four beats left to right. Attack-name callouts are suppressed (?nonames=1). '
      + 'The question: from motion, telegraph and effects alone, which attack is each row?'}</p>
  <div class="heads"><div class="tag"></div>${HEADS.map((h) => `<span>${h}</span>`).join('')}</div>
  ${cells}`;
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1240, height: 1000 } });

for (const [sub, labelled, out] of [
  ['unlabelled', false, 'SHEET-unlabelled.png'],
  ['labelled', true, 'SHEET-key.png'],
]) {
  const tmp = `${DIR}_sheet-${sub}.html`;
  writeFileSync(tmp, build(sub, labelled));
  await page.goto(`file://${tmp}`);
  // Every frame must actually decode before the shutter, and a broken one must
  // FAIL rather than photograph as an empty cell.
  const broken = await page.evaluate(async () => {
    await Promise.all([...document.images].map((i) => i.decode().catch(() => null)));
    return [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
  });
  if (broken.length) {
    console.error(`FAIL: ${broken.length} frame(s) did not load, e.g. ${broken[0]}`);
    process.exit(1);
  }
  await page.screenshot({ path: `${DIR}${out}`, fullPage: true });
  unlinkSync(tmp);
  console.log(`  ${out}`);
}

await browser.close();
