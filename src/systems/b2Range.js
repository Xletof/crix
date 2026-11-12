// B2-1 — THE FIRING RANGE (`?b2=A|B&b2range=1`; opt-in, debug-grade).
//
// A room with no waves, where targets arrive only when asked for: the place
// to judge how the weapon feels on its own, and to try a tuning knob, before
// a real run. The hangar loads as usual; its wave script simply never starts
// (an instance wrapper on `_startWave`, restored on exit), and a small DOM
// panel calls the game's own `spawnEnemyAt` / `_makeElite`. Enemy AI, hp and
// behaviour are exactly the game's. The hero starts invulnerable (the debug
// god flag) and the panel can turn that off.
import { isGodMode, setGodMode } from './debug.js';
import { PLAYER } from '../config.js';

const GROUPS = [
  ['SWARM', [['swarmling', 6]]],
  ['SQUAD', [['grunt', 3], ['shooter', 2]]],
  ['GUNNERS', [['shooter', 3]]],
  ['MARKSMEN', [['sniper', 2]]],
  ['DEMOS', [['bomber', 3]]],
  ['BULWARK', [['shielded', 1], ['grunt', 2]]],
  ['ELITE', [['shooter', 1, true]]],
  ['HORDE', [['swarmling', 8], ['grunt', 4], ['shooter', 2]]],
];

export function installB2Range(scene, api, wrap) {
  const game = scene.game;
  const stats = { spawned: 0, cleared: 0, groups: {} };
  wrap(scene, '_startWave', () => function () { /* the range has no waves */ });
  // The room's authored opening enemies do not belong on a range either.
  const empty = () => {
    scene.arenaActive = false; scene._spawnQueue = [];
    for (const e of (scene.enemies?.getChildren?.() || []).slice()) scene._destroyEnemyFully?.(e);
  };
  wrap(scene, 'loadRoom', (prev) => function (...a) { const r = prev.apply(this, a); empty(); return r; });
  if (scene.roomSpec) empty();
  const hadGod = isGodMode();
  setGodMode(true);

  const inWall = (x, y) => (scene.losRects || []).some((r) => x >= r.x - 26 && x <= r.right + 26 && y >= r.y - 26 && y <= r.bottom + 26);
  function place(i, n, ring) {
    const p = scene.player;
    const b = scene.roomSpec?.bounds ?? { w: 1600, h: 1600 };
    // towards the middle of the room, fanned, so a group arrives in front of the hero
    const base = Math.atan2(b.h / 2 - p.y, b.w / 2 - p.x) + (Math.hypot(b.w / 2 - p.x, b.h / 2 - p.y) < 60 ? -Math.PI / 2 : 0);
    for (let k = 0; k < 12; k++) {
      const a = base + ((n > 1 ? i / (n - 1) - 0.5 : 0) * 1.5) + k * 0.5 * (k % 2 ? 1 : -1);
      const r = ring + (i % 3) * 34 + k * 14;
      const x = Math.max(110, Math.min(b.w - 110, p.x + Math.cos(a) * r));
      const y = Math.max(150, Math.min(b.h - 110, p.y + Math.sin(a) * r));
      if (!inWall(x, y) && Math.hypot(x - p.x, y - p.y) > 150) return { x, y };
    }
    return { x: Math.max(110, Math.min(b.w - 110, p.x + 260)), y: Math.max(150, Math.min(b.h - 110, p.y - 260)) };
  }
  function spawn(label) {
    const g = GROUPS.find((q) => q[0] === label);
    if (!g || !scene.player?.alive) return 0;
    let made = 0;
    const total = g[1].reduce((s, q) => s + q[1], 0);
    let i = 0;
    for (const [type, count, elite] of g[1]) {
      for (let k = 0; k < count; k++, i++) {
        const { x, y } = place(i, total, type === 'sniper' ? 430 : type === 'swarmling' ? 300 : 350);
        const e = scene.spawnEnemyAt(type, x, y);
        if (e && elite) scene._makeElite?.(e);
        if (e) made++;
      }
    }
    stats.spawned += made; stats.groups[label] = (stats.groups[label] || 0) + 1;
    return made;
  }
  function clear() {
    const list = (scene.enemies?.getChildren?.() || []).slice();
    for (const e of list) if (e.active && e.alive) { stats.cleared++; e.damage(1e7, null); }
    for (const g of scene.hostileBullets || []) for (const b of g.getChildren().slice()) if (b.active) b.kill?.();
  }
  const setCharge = (full) => {
    const p = scene.player;
    if (!p) return;
    p.superCharge = full ? PLAYER.superHitsToCharge : 0;
    scene.events.emit(full ? 'player-super-ready' : 'player-super-changed');
  };

  // ── the panel ───────────────────────────────────────────────────────────
  let root = null, open = true, godBtn = null;
  const doc = typeof document !== 'undefined' ? document : null;
  const layout = () => {
    if (!root || !game.canvas) return;
    const r = game.canvas.getBoundingClientRect();
    const k = Math.max(0.6, Math.min(1.5, r.width / 520));
    root.style.left = `${Math.round(r.left + 6)}px`;
    root.style.top = `${Math.round(r.top + r.height * 0.105)}px`;
    root.style.fontSize = `${Math.round(11 * k)}px`;
    root.style.width = open ? `${Math.round(150 * k)}px` : 'auto';
  };
  const btn = (text, fn, wide = false) => {
    const b = doc.createElement('button');
    b.textContent = text;
    b.style.cssText = `font:inherit;letter-spacing:.06em;color:#dff6ff;background:rgba(8,14,22,.82);border:1px solid #2a6a86;border-radius:3px;padding:.55em .3em;margin:0;cursor:pointer;touch-action:manipulation;${wide ? 'grid-column:1 / span 2;' : ''}`;
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(b); });
    return b;
  };
  function build() {
    if (!doc) return;
    root = doc.createElement('div');
    root.id = 'b2-range';
    root.style.cssText = "position:fixed;z-index:30;font-family:'Rajdhani','Courier New',monospace;font-weight:600;display:grid;grid-template-columns:1fr 1fr;gap:3px;user-select:none;-webkit-user-select:none;";
    const body = [];
    const head = btn('RANGE ▾', (b) => { open = !open; b.textContent = open ? 'RANGE ▾' : 'RANGE ▸'; body.forEach((q) => { q.style.display = open ? '' : 'none'; }); layout(); }, true);
    root.appendChild(head);
    for (const [label] of GROUPS) body.push(root.appendChild(btn(label, () => spawn(label))));
    body.push(root.appendChild(btn('CLEAR', () => clear())));
    godBtn = root.appendChild(btn('SAFE: ON', (b) => { setGodMode(!isGodMode()); b.textContent = `SAFE: ${isGodMode() ? 'ON' : 'OFF'}`; }));
    body.push(godBtn);
    body.push(root.appendChild(btn('FILL SUPER', () => setCharge(true))));
    body.push(root.appendChild(btn('EMPTY SUPER', () => setCharge(false))));
    doc.body.appendChild(root);
    layout();
    window.addEventListener('resize', layout);
  }
  build();
  const relayout = () => layout();
  scene.scale?.on?.('resize', relayout);

  return {
    stats, spawn, clear, setCharge, groups: GROUPS.map((g) => g[0]),
    destroy() {
      setGodMode(hadGod);
      scene.scale?.off?.('resize', relayout);
      if (doc) window.removeEventListener('resize', layout);
      root?.remove(); root = null;
    },
  };
}
