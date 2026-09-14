// CONCEPT SHEET — THE IMPERIAL SHOCK CAPTAIN. Evidence only, off-repo rig.
//
//   node <this> [tag]
//
// TWO ARTEFACTS, AND THE ORDER IS THE POINT:
//   1x-row-*.png   the acceptance authority — five actors at GAMEPLAY SCALE on
//                  a real hangar deck, same camera, same HUD inset.
//   poses.png      art inspection only, enlarged 3x on a neutral ground.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const TAG = process.argv[2] || 'r1';
const HERE = 'docs/evidence/champion-reset';
const SCRATCH = process.env.TMPDIR || '/tmp';
const OUT = `${HERE}/${TAG}`;
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const PAINTER = readFileSync(`${HERE}/concept-captain.js`, 'utf8');

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// The hangar deck, late sector so nothing about the room is a first-room special
// case. SPAWN VADER keeps the room; we only need his TEXTURE, not the actor.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
  await new Promise((r) => setTimeout(r, 2200));
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
});
await page.waitForTimeout(4200);

await page.addScriptTag({ content: PAINTER });

const info = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs._sectorTint?.setAlpha(0);
  gs.cameras.main.resetFX();
  const hud = window.game.scene.getScene('HUD');
  hud?.hud?.banner?.setAlpha(0);
  const meta = window.__paintCaptain(gs, 'concept-captain', 'concept-captain-gun');
  const dims = {};
  for (const k of ['grunt', 'shooter', 'player', 'boss', 'concept-captain']) {
    const t = gs.textures.get(k), f = t.get(0);
    dims[k] = [f.width, f.height];
  }
  return {
    meta, dims,
    sheet: gs.textures.get('concept-captain').getSourceImage().toDataURL(),
    gun: gs.textures.get('concept-captain-gun').getSourceImage().toDataURL(),
  };
});
console.log('1x frame sizes:', JSON.stringify(info.dims));

writeFileSync(`${SCRATCH}/sheet.png`, Buffer.from(info.sheet.split(',')[1], 'base64'));

// ── 1x HIERARCHY ROW ──────────────────────────────────────────────────────
// A PAUSED scene still renders, and a paused camera cannot be overwritten by
// the director — so the scroll is placed by hand and stays placed.
const row = async (labels) => {
  await page.evaluate((withLabels) => {
    const gs = window.game.scene.getScene('Game');
    gs._concept?.forEach((o) => o.destroy());
    gs._concept = [];
    // A CLEAR STRETCH OF REAL HANGAR DECK. The objective terminal at (800,700)
    // and the crate at (950,900) are hidden for the shutter and nothing else
    // is: the floor art, the baked plate seams, the emissive layer, the sector
    // tint and the HUD inset are all the live room.
    // A CLEAR STRETCH OF REAL HANGAR DECK. The objective terminal at (800,700)
    // is destroyed for the shutter and the crate at (950,900) is hidden; NOTHING
    // else is. The floor art, the baked plate seams, the emissive layer, the
    // sector tint and the HUD's own inset are all the live room.
    gs._hidden = [];
    gs.terminals?.slice().forEach((t) => t.destroy());
    gs.terminals = [];
    gs.roomLayer?.getChildren().slice().forEach((o) => {
      if (Math.hypot((o.x ?? 0) - 950, (o.y ?? 0) - 900) < 70 && o.visible) {
        o.setVisible(false); gs._hidden.push(o);
      }
    });
    gs.player.setVisible(false);
    gs.player.weaponSprite?.setVisible(false);
    gs.player.shadow?.setVisible(false);
    gs.player.glowRing?.setVisible(false);

    const cam = gs.cameras.main;
    // The camera clamps: at the hangar's southern limit the centre is y 802, so
    // a row on the deck at y 780 lands in the clear band between the top bar
    // and the touch controls. This is a PLACED camera, not a followed one.
    const CX = 800, CY = 802;
    cam.setScroll(CX - cam.width / 2, CY - cam.height / 2);

    const AIM = 0.62;   // facing south-east, the ordinary carry angle
    const members = [
      ['grunt', 'grunt', 22, null],
      ['shooter', 'shooter', 22, 'wpn-enemy-rifle'],
      ['player', 'player', 22, 'wpn-pistol'],
      ['concept-captain', 'SHOCK CAPTAIN', 30, 'concept-captain-gun'],
      ['boss', 'VADER', 56, 'wpn-saber'],
    ];
    const widths = members.map(([k]) => gs.textures.get(k).get(0).width);
    const gap = 30;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (members.length - 1);
    let x = CX - total / 2;
    const baseY = 790;              // a common FOOT line, not a common centre
    members.forEach(([key, name, radius, gun], i) => {
      const h = gs.textures.get(key).get(0).height;
      const cxp = x + widths[i] / 2, cyp = baseY - h / 2;
      gs._concept.push(gs.add.ellipse(cxp, baseY - 8, widths[i] * 0.46, widths[i] * 0.17,
        0x000000, 0.45).setDepth(4000));
      gs._concept.push(gs.add.image(cxp, cyp, key, 0).setDepth(4001));
      if (gun) {
        const off = radius - 4;
        gs._concept.push(gs.add.image(cxp + Math.cos(AIM) * off, cyp + Math.sin(AIM) * off, gun)
          .setOrigin(0.15, 0.5).setRotation(AIM).setDepth(4002));
      }
      if (withLabels) {
        gs._concept.push(gs.add.text(cxp, baseY + 18, name, {
          fontFamily: 'monospace', fontSize: '13px', color: '#93a4b4',
        }).setOrigin(0.5, 0).setDepth(4005));
        gs._concept.push(gs.add.text(cxp, baseY + 34, `${widths[i]}x${h}`, {
          fontFamily: 'monospace', fontSize: '11px', color: '#51606d',
        }).setOrigin(0.5, 0).setDepth(4005));
      }
      x += widths[i] + gap;
    });
    gs.scene.pause();
  }, labels);
  await page.waitForTimeout(500);
};

await row(true);
writeFileSync(`${OUT}/1x-row-labeled.png`, await page.screenshot());
console.log('   1x-row-labeled');

await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
await page.waitForTimeout(300);
await row(false);
writeFileSync(`${OUT}/1x-row-clean.png`, await page.screenshot());
console.log('   1x-row-clean');


// ── THE READABILITY TEST THAT ACTUALLY MATTERS ────────────────────────────
// A row answers hierarchy. It does not answer "can I find him in a fight",
// which is the question a Champion has to pass. Same deck, same camera, the
// Captain standing inside an ordinary wave.
await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
await page.waitForTimeout(300);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._concept?.forEach((o) => o.destroy());
  gs._concept = [];
  const cam = gs.cameras.main;
  cam.setScroll(800 - cam.width / 2, 802 - cam.height / 2);
  const AIM = 0.62;
  const crowd = [
    ['grunt', 610, 690, null], ['shooter', 700, 760, 'wpn-enemy-rifle'],
    ['grunt', 560, 790, null], ['grunt', 900, 700, null],
    ['shooter', 980, 780, 'wpn-enemy-rifle'], ['grunt', 1010, 660, null],
    ['grunt', 770, 640, null], ['shooter', 860, 840, 'wpn-enemy-rifle'],
    ['concept-captain', 800, 760, 'concept-captain-gun'],
    ['player', 660, 890, 'wpn-pistol'],
  ];
  crowd.forEach(([key, x, y, gun]) => {
    const t = gs.textures.get(key).get(0);
    const radius = key === 'concept-captain' ? 30 : 22;
    gs._concept.push(gs.add.ellipse(x, y + t.height / 2 - 8, t.width * 0.46,
      t.width * 0.17, 0x000000, 0.45).setDepth(3000 + y));
    gs._concept.push(gs.add.image(x, y, key, 0).setDepth(3001 + y));
    if (gun) {
      const off = radius - 4;
      gs._concept.push(gs.add.image(x + Math.cos(AIM) * off, y + Math.sin(AIM) * off, gun)
        .setOrigin(0.15, 0.5).setRotation(AIM).setDepth(3002 + y));
    }
  });
  gs.scene.pause();
});
await page.waitForTimeout(500);
writeFileSync(`${OUT}/1x-crowd.png`, await page.screenshot());
console.log('   1x-crowd');

await browser.close();

// ── ENLARGED POSE SHEET ───────────────────────────────────────────────────
// A plain page, neutral ground, nearest-neighbour. Art inspection only.
const POSES = info.meta.poses;
const FW = info.meta.w, FH = info.meta.h;
const Z = 3, COLS = 4;
const CELLW = FW * Z + 34, CELLH = FH * Z + 46;
const PW = COLS * CELLW + 36, PH = Math.ceil(POSES.length / COLS) * CELLH + 72;
const b64 = info.sheet, gunB64 = info.gun;
const GUN = info.meta.gun, GW = info.meta.gw, GH = info.meta.gh;
const GOFF = info.meta.gunOffset;
const html = `<!doctype html><html><body style="margin:0;background:#15171c">
<canvas id="c" width="${PW}" height="${PH}"></canvas><script>
const img = new Image(); const gun = new Image();
let n = 0; const go = () => { if (++n < 2) return; render(); };
img.onload = go; gun.onload = go;
const render = () => {
  const x = document.getElementById('c').getContext('2d');
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#15171c'; x.fillRect(0,0,${PW},${PH});
  x.fillStyle = '#8fa0b0'; x.font = '16px monospace';
  x.fillText('THE IMPERIAL SHOCK CAPTAIN — concept poses, ${Z}x (art inspection only)', 18, 30);
  const poses = ${JSON.stringify(POSES)};
  poses.forEach((p,i) => {
    const cx = 18 + (i % ${COLS}) * ${CELLW}, cy = 50 + Math.floor(i / ${COLS}) * ${CELLH};
    x.fillStyle = '#1d2027'; x.fillRect(cx, cy, ${FW * Z + 20}, ${FH * Z + 20});
    x.drawImage(img, i * ${FW}, 0, ${FW}, ${FH}, cx + 10, cy + 10, ${FW * Z}, ${FH * Z});
    const rot = ${JSON.stringify(GUN)}[p];
    if (rot !== null && rot !== undefined) {
      const off = ${GOFF} * 4 * ${Z};
      x.save();
      x.translate(cx + 10 + ${FW * Z / 2} + Math.cos(rot) * off,
                  cy + 10 + ${FH * Z / 2} + Math.sin(rot) * off);
      x.rotate(rot);
      x.drawImage(gun, -${GW * Z} * 0.15, -${GH * Z} / 2, ${GW * Z}, ${GH * Z});
      x.restore();
    }
    x.fillStyle = '#6f8090'; x.font = '14px monospace';
    x.fillText(p, cx + 10, cy + ${FH * Z} + 34);
  });
  document.title = 'ready';
};
img.src = '${b64}'; gun.src = '${gunB64}';
<\/script></body></html>`;
writeFileSync(`${SCRATCH}/poses.html`, html);

const b2 = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p2 = await b2.newPage({ viewport: { width: PW, height: PH } });
await p2.goto(`file://${SCRATCH}/poses.html`);
await p2.waitForFunction(() => document.title === 'ready', null, { timeout: 10000 });
writeFileSync(`${OUT}/poses.png`, await p2.screenshot());
console.log('   poses');
await b2.close();
