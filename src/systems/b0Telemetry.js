// ── B0 — COMBAT BASELINE TELEMETRY (`?b0=1`, `?b0=A`, `?b0=B`) ──────────────
//
// WHAT IT IS FOR. B0 measures how CRIX actually plays on a human handset before
// anyone decides whether STANDARD fire, OVERRIDE or the Super should change.
// It is MEASUREMENT ONLY: no weapon, ammo, damage, Super, enemy or balance
// value is read for writing, and nothing here is constructed without the flag.
//
// THE CONTRACT (proven by `tests/smoke-b0.mjs`):
//   1. Flag OFF: nothing exists — no listener, no wrapper, no DOM, no storage.
//   2. Flag ON: the seeded fight is the flag-OFF fight tick for tick — the same
//      `Math.random` draws, events, hp, ammo, kills and ability timings. This
//      module therefore NEVER calls `Math.random`, never emits a game event,
//      never draws in the Phaser canvas and never writes a gameplay field. Its
//      only presence in the world is a set of PURE WRAPPERS (they call the
//      original with the original arguments and return its result) and
//      listeners appended after the game's own.
//   3. Every handler is wrapped in try/catch: an instrument bug must never take
//      down a listener chain the game depends on.
//
// HOW DAMAGE IS ATTRIBUTED — CARRIED, NEVER GUESSED FROM A MAGNITUDE.
// `GameScene` sets debug tags synchronously around each damage call (the
// `_dmgSrc` idiom `CaptainTelemetry` introduced): `_dmgSrc` names the player
// system ('primary' | 'secondary' | 'super' | 'melee' | 'volatile' | null) and
// `_shotSrc` refines a bullet's pool ('override' = the rifle pickup's burst,
// 'cluster' = the cluster pod's fragments). `Enemy.damage` emits `enemy-hit`
// INLINE, so the tags are exact when the listener reads them.
//
// HOW DURABILITY IS COUNTED — REAL, NOT REQUESTED.
// `enemy-hit` carries the REQUESTED amount (after the punish multiplier). For
// a non-lethal hit on an ordinary enemy the pool moved by exactly that; on a
// lethal hit it moved by what the pool held, so the instrument keeps the last
// known hp of every actor (refreshed each frame and after every hit) and the
// difference is OVERKILL, recorded separately and never added to damage. An
// actor with a second layer (the Shock Captain's armour) supplies its own
// truth through the event's third argument. A shield BLOCK removes nothing and
// is counted as a block, never as body damage.
import { isGodMode } from './debug.js';
import * as dbg from './debug.js';
import { PLAYER, WEAPONS } from '../config.js';
import { b0Store } from './b0Report.js';

export const B0_SCHEMA = 'crix-b0/1';

const PLAYER_SRCS = ['standard', 'override', 'cluster', 'super', 'melee'];

/** Fresh per-source counters. */
const bySrc = (v = 0) => ({ standard: v, override: v, cluster: v, super: v, melee: v, volatile: v, other: v });

/** A 1ms-bin histogram (0..maxMs) with an overflow bin — exact percentiles, fixed memory. */
function hist(maxMs) {
  return { bins: new Array(maxMs + 1).fill(0), over: 0, n: 0, sum: 0, max: 0, maxMs };
}
function histAdd(h, v) {
  h.n++; h.sum += v; if (v > h.max) h.max = v;
  const i = Math.floor(v);
  if (i > h.maxMs) h.over++; else h.bins[Math.max(0, i)]++;
}
export function histPct(h, p) {
  if (!h.n) return null;
  const want = Math.ceil(h.n * p);
  let acc = 0;
  for (let i = 0; i < h.bins.length; i++) { acc += h.bins[i]; if (acc >= want) return i; }
  return h.maxMs + 1;
}

function resolvedConfig() {
  const g = (f) => { try { return f(); } catch (_) { return null; } };
  return {
    baseline: g(dbg.getGameplayBaseline),
    roster: g(dbg.getRosterVersion), moveV22: g(dbg.isMoveV22), gaitV2: g(dbg.isGaitV2),
    bulwarkStuck: g(dbg.getBulwarkStuck), marksmanStuck: g(dbg.getMarksmanStuck),
    marksmanAngle: g(dbg.isMarksmanAngle), bulwarkAngle: g(dbg.isBulwarkAngle),
    visualPilot: g(dbg.getVisualPilot), polishP1: g(dbg.isPolishP1),
    fxP2A3: g(dbg.isFxP2A3), muzzleSharp: g(dbg.isMuzzleSharp),
    godMode: g(isGodMode),
  };
}

/** A short id that does not touch `Math.random`. */
function runId() {
  let tail = '';
  try {
    const a = new Uint8Array(3); crypto.getRandomValues(a);
    tail = Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
  } catch (_) { tail = (performance.now() | 0).toString(16); }
  return `${Date.now().toString(36)}-${tail}`;
}

/**
 * Install the instrument on a freshly created GameScene. Called ONLY when
 * `isB0()` (`?b0=…`). Each GameScene `create()` is one RUN; a restart closes
 * the previous run and opens a new one.
 */
export function attachB0Telemetry(scene) {
  const game = scene.game;
  const wall0 = performance.now();
  const ctl = b0Store();               // DOM / storage controller (module singleton)
  // The scene clock is not running yet inside create(): the origin is the
  // first frame the instrument observes (see onPost).
  let t0 = null;
  const T = () => (t0 === null ? 0 : Math.round(scene.time.now - t0));   // game ms since run start
  const W = () => Math.round(performance.now() - wall0);     // wall ms since run start

  // ── THE RUN RECORD (this is exactly what is exported) ───────────────────
  const R = {
    schema: B0_SCHEMA,
    run: {
      id: runId(),
      n: ctl.nextRunNumber(),
      label: ctl.label,                       // 'A' | 'B' | null, from `?b0=`
      build: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev',
      url: (() => { try { return location.href; } catch (_) { return null; } })(),
      query: (() => { try { return location.search; } catch (_) { return ''; } })(),
      config: resolvedConfig(),
      mode: scene.mode, seed: scene.runSeed,
      startedAt: new Date().toISOString(), endedAt: null, endReason: null,
      device: (() => {
        try {
          return { ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
            touch: (navigator.maxTouchPoints || 0) > 0 };
        } catch (_) { return null; }
      })(),
      tuning: {                               // read-only snapshot, for theoretical figures
        pelletDamage: PLAYER.pelletDamage, fireCooldownMs: PLAYER.fireCooldownMs,
        ammoMax: PLAYER.ammoMax, ammoReloadMs: PLAYER.ammoReloadMs,
        superDamage: PLAYER.superDamage, superPellets: PLAYER.superPellets,
        superHitsToCharge: PLAYER.superHitsToCharge, meleeHitsToCharge: PLAYER.meleeHitsToCharge,
        rifle: { damage: WEAPONS.rifle?.damage, totalAmmo: WEAPONS.rifle?.totalAmmo,
          burstCount: WEAPONS.rifle?.burstCount, fireCooldownMs: WEAPONS.rifle?.fireCooldownMs },
        cluster: { charges: WEAPONS.cluster?.charges },
      },
    },
    clock: { gameMs: 0, wallMs: 0, pausedWallMs: 0, pauses: 0 },
    rooms: [],
    waves: [],
    enemies: [],
    player: {
      fired: bySrc(), hits: bySrc(), blocked: bySrc(), deflected: bySrc(), absorbedByVader: 0,
      dmg: bySrc(), overkill: bySrc(), kills: bySrc(), takedowns: 0,
      standard: {
        tryRefusedEmpty: 0, tryRefusedCooldown: 0, intervals: hist(4000),
        emptyMs: 0, fullMs: 0, ammoSampleMs: 0, ammoIntegral: 0, reloads: 0,
        combatMs: 0, combatShots: 0, combatDmg: 0,
      },
      override: { pickups: 0, bursts: 0, rounds: 0, emptied: 0, heldMs: 0 },
      cluster: { pickups: 0, throws: 0, emptied: 0 },
      super: { readies: 0, casts: 0, pellets: 0, denied: 0, readyAt: null, castAt: [], readyToCast: [],
        chargeMs: [], lastSpentAt: null, perCast: [], hitsByCast: [] },
      melee: { readies: 0, chains: 0, casts: 0, finishers: 0, readyAt: null, castAt: [], readyToCast: [],
        chargeMs: [], lastSpentAt: null },
      dash: 0,
    },
    incoming: {
      calls: 0, negated: 0, requested: 0, shieldAbsorbed: 0, hpRemoved: 0,
      bySource: {},            // key -> { calls, negated, shield, hp }
      deaths: 0, livesLost: 0,
    },
    upgrades: [],
    timeline: [],              // [wallMs, gameMs, code, ...data]
    perf: {
      frames: 0, frameMs: hist(250), overheadUs: hist(2000), overheadTotalMs: 0,
      longFrames: [],          // [wallMs, ms] for frames > 100ms (first 200)
      saveMs: hist(250),
    },
  };
  const P = R.player, I = R.incoming;
  const tl = (code, ...d) => { if (R.timeline.length < 20000) R.timeline.push([W(), T(), code, ...d]); };

  // ── OVERHEAD ACCOUNTING ─────────────────────────────────────────────────
  let frameCost = 0;
  const safe = (fn) => function (...a) {
    const s = performance.now();
    try { fn.apply(this, a); } catch (err) { R.errors = (R.errors || 0) + 1; if (!R.firstError) R.firstError = String(err && err.stack || err); }
    frameCost += performance.now() - s;
  };
  const bound = [];
  const on = (ev, fn) => { const h = safe(fn); bound.push([ev, h]); scene.events.on(ev, h); };

  // ── WRAPPERS (pure: original args, original return) ─────────────────────
  const restores = [];
  function wrapMethod(obj, name, make) {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    const had = Object.prototype.hasOwnProperty.call(obj, name);
    obj[name] = make(orig);
    restores.push(() => { if (had) obj[name] = orig; else delete obj[name]; });
  }

  // ── ENEMY REGISTRY ──────────────────────────────────────────────────────
  const recOf = new Map();       // actor -> record
  const live = new Set();        // records whose actor is alive
  let nextId = 1;
  let curRoom = null, curWave = null, curEnc = null;
  const ctx = { actor: null };   // the enemy whose preUpdate is running

  function kindOf(e) {
    if (e === scene.boss || e._isBoss) return 'vader';
    if (e._miniBoss) return 'nemesis';
    if (e.isChampion) return 'champion';
    return e.enemyType || e.constructor?.name || 'unknown';
  }
  // `fromHit`: first seen INSIDE its own damage event — spawned this frame, so
  // its pool before this hit was full (the event fires after hp moved).
  function register(e, fromHit = false) {
    if (recOf.has(e)) return recOf.get(e);
    const r = {
      id: nextId++, type: e.enemyType || (e === scene.boss ? 'vader' : (e.isChampion ? (e._championId || 'champion') : 'unknown')),
      kind: kindOf(e), elite: !!e._elite, champion: !!e.isChampion, nemesis: e._miniBoss ? (e._nemesis?.id || e._nemesis?.name || true) : false,
      vanguardScreen: !!e.spec?.vanguardScreen,
      room: curRoom?.roomId ?? null, sector: scene.sector ?? null, wave: curWave?.i ?? null, encounter: curEnc,
      hpMax: e.hpMax ?? e.hp ?? 0, armourMax: e.armourMax ?? 0,
      playerDmgMultAtSpawn: scene.player?.dmgMult ?? 1,
      spawnT: T(), spawnW: W(), seenT: null, firstDmgT: null, deathT: null, deathW: null,
      fate: 'alive', killSrc: null,
      hits: bySrc(), dmg: bySrc(), overkill: bySrc(), blocks: bySrc(), pierced: 0, armourRemoved: 0,
      attacks: { shots: 0, contactCalls: 0, bulletCalls: 0, moves: 0 }, dmgToPlayer: 0, shieldToPlayer: 0,
    };
    r._lastHp = fromHit ? (e.hpMax ?? e.hp ?? 0) : (e.hp ?? 0);
    r._lastArmour = fromHit ? (e.armourMax ?? e.armour ?? 0) : (e.armour ?? 0);
    r._actor = e;
    recOf.set(e, r); live.add(r); R.enemies.push(r);
    if (curWave) curWave.spawned++;
    // The actor's own AI runs in preUpdate: mark it as the current actor so a
    // player.damage() call made from inside it is attributed exactly.
    wrapMethod(e, 'preUpdate', (orig) => function (time, delta) {
      const prev = ctx.actor; ctx.actor = r;
      try { return orig.call(this, time, delta); } finally { ctx.actor = prev; }
    });
    // Shield interactions: a frontal block (no damage) and a piercing crossing.
    wrapMethod(e, 'onBlock', (orig) => function (...a) {
      try { const s = srcNow(true); r.blocks[s]++; P.blocked[s]++; } catch (_) { /* never break the block */ }
      return orig.apply(this, a);
    });
    wrapMethod(e, 'onPierce', (orig) => function (...a) {
      try { r.pierced++; } catch (_) { /* */ }
      return orig.apply(this, a);
    });
    return r;
  }

  function closeEnemy(r, fate) {
    if (!live.has(r)) return;
    live.delete(r);
    r.fate = fate;
    if (fate !== 'alive-at-end') { r.deathT = T(); r.deathW = W(); }
    if (curWave && (fate === 'killed' || fate === 'takedown' || fate === 'wounded')) curWave.killed++;
    r._actor = null;
  }

  /** The player system that owns the damage call in progress. */
  function srcNow(blockPath = false) {
    const d = scene._dmgSrc;
    if (blockPath) {
      const s = scene._shotSrc;
      return s === 'primary' ? 'standard' : (PLAYER_SRCS.includes(s) ? s : 'other');
    }
    if (d === 'primary') return 'standard';
    if (d === 'secondary') {
      const s = scene._shotSrc;
      return (s === 'override' || s === 'cluster') ? s : 'cluster';
    }
    if (d === 'super' || d === 'melee' || d === 'volatile') return d;
    return 'other';
  }

  // ── DAMAGE ON ENEMIES ───────────────────────────────────────────────────
  let bossPend = null;
  on('boss-hit', (b, amount) => {
    const r = register(b);
    bossPend = { r, amount, hpBefore: b.hp, src: srcNow() };
  });
  on('enemy-hit', (e, amount, feedback) => {
    const r = recOf.get(e) || register(e, true);
    if (bossPend && bossPend.r === r) bossPend = null;
    const s = srcNow();
    let removed;
    if (feedback && typeof feedback.shown === 'number') {
      removed = feedback.shown;
      const ar = (r._lastArmour || 0) - (e.armour ?? 0);
      if (ar > 0) r.armourRemoved += ar;
    } else {
      removed = (e.hp > 0) ? amount : Math.min(amount, r._lastHp);
    }
    removed = Math.max(0, removed);
    const over = Math.max(0, amount - removed);
    r._lastHp = e.hp ?? 0; r._lastArmour = e.armour ?? 0;
    if (removed <= 0 && over <= 0) return;
    r.hits[s]++; r.dmg[s] += removed; r.overkill[s] += over;
    P.hits[s]++; P.dmg[s] += removed; P.overkill[s] += over;
    if (r.firstDmgT === null) r.firstDmgT = T();
    if (s === 'super' && P.super.perCast.length) {
      P.super.perCast[P.super.perCast.length - 1] += removed;
      P.super.hitsByCast[P.super.hitsByCast.length - 1] += 1;
    }
    if (inCombat()) { if (s === 'standard') P.standard.combatDmg += removed; }
    if (!(e.hp > 0)) r._killSrc = s;
  });
  on('boss-wounded', (b) => {
    const r = recOf.get(b);
    if (!r) return;
    if (bossPend && bossPend.r === r) {
      // The wound intercept zeroes the pool: what was removed is what it held.
      const s = bossPend.src, removed = Math.max(0, bossPend.hpBefore);
      r.hits[s]++; r.dmg[s] += removed; r.overkill[s] += Math.max(0, bossPend.amount - removed);
      P.hits[s]++; P.dmg[s] += removed; P.overkill[s] += Math.max(0, bossPend.amount - removed);
      r.killSrc = s; P.kills[s]++;
      bossPend = null;
    }
    closeEnemy(r, 'wounded');
    tl('vader-wounded', r.id);
  });
  let takedownPending = false;
  on('stealth-kill', () => { takedownPending = true; });
  on('enemy-died', (e) => {
    const r = recOf.get(e) || register(e);
    if (!live.has(r)) return;
    if (r._killSrc) { r.killSrc = r._killSrc; P.kills[r.killSrc]++; closeEnemy(r, 'killed'); }
    else if (takedownPending) { r.killSrc = 'takedown'; P.takedowns++; closeEnemy(r, 'takedown'); }
    else { r.killSrc = 'unknown'; closeEnemy(r, 'killed'); }
    takedownPending = false;
    tl('kill', r.id, r.type, r.killSrc);
  });
  on('boss-reflected', () => { const s = srcNow(true); P.deflected[s]++; });
  on('boss-absorbed', () => { P.absorbedByVader++; });

  // ── ENEMY ACTIONS ───────────────────────────────────────────────────────
  on('shooter-fire', (s) => { const r = recOf.get(s) || register(s); r.attacks.shots++; });
  on('champion-round-fired', (c) => { const r = recOf.get(c) || register(c); r.attacks.shots++; });
  on('boss-move', (b, m) => { const r = recOf.get(b) || register(b); r.attacks.moves++; tl('boss-move', m?.id ?? m); });
  on('nemesis-move', (e, m) => { const r = recOf.get(e) || register(e); r.attacks.moves++; tl('nemesis-move', m?.id ?? m); });
  on('champion-spawned', (c) => { register(c); });

  // Which enemy fired which bolt: `fireShooter` is the one funnel every
  // ordinary (and nemesis-weapon) shot goes through. The bolts it put into the
  // pool are the ones whose fire generation changed during the call.
  const bulletOwner = new WeakMap();     // bullet -> { gen, r }
  wrapMethod(scene, 'fireShooter', (orig) => function (shooter, angle) {
    const pool = scene.enemyBullets?.getChildren?.() || [];
    let before = null;
    try { before = pool.map((b) => b._gen); } catch (_) { /* */ }
    const out = orig.call(this, shooter, angle);
    try {
      const r = recOf.get(shooter) || register(shooter);
      const now = scene.enemyBullets.getChildren();
      for (let i = 0; i < now.length; i++) {
        const b = now[i];
        if (!before || i >= before.length || b._gen !== before[i]) bulletOwner.set(b, { gen: b._gen, r });
      }
    } catch (_) { /* */ }
    return out;
  });

  // ── INCOMING DAMAGE (player.damage wrapper) ─────────────────────────────
  function incomingKey() {
    const b = scene._hurtBy;
    if (b) {
      if (scene.captainBullets?.contains?.(b)) { const c = [...live].find((x) => x.champion); return { key: 'champion:bolt', r: c }; }
      if (scene.deflectedBullets?.contains?.(b)) return { key: 'vader:deflected-shot' };
      if (scene.bossSuperOrbs?.contains?.(b)) return { key: 'vader:returned-super' };
      const own = bulletOwner.get(b);
      if (own && own.gen === b._gen) return { key: `${own.r.kind === 'vader' ? 'vader' : own.r.type}${own.r.elite ? '*' : ''}:bolt`, r: own.r, bullet: true };
      return { key: scene.boss?.alive ? 'vader:bolt?' : (([...live].some((x) => x.nemesis)) ? 'nemesis:bolt?' : 'bolt:unattributed'), bullet: true };
    }
    if (scene._dmgSrc === 'volatile') return { key: 'volatile-blast' };
    const a = ctx.actor;
    if (a) return { key: `${a.kind === 'vader' ? 'vader' : (a.champion ? 'champion' : a.type)}${a.elite ? '*' : ''}:contact`, r: a };
    if (scene.boss?.alive) return { key: 'vader:move?' };
    if ([...live].some((x) => x.nemesis)) return { key: 'nemesis:move?' };
    if ([...live].some((x) => x.champion)) return { key: 'champion:hazard?' };
    return { key: 'environment?' };
  }
  const wrappedPlayers = new WeakSet();
  function wrapPlayer(p) {
    if (!p || wrappedPlayers.has(p)) return;
    wrappedPlayers.add(p);
    wrapMethod(p, 'damage', (orig) => function (amount, dir) {
      const s = performance.now();
      let k = null, hp0 = 0, sh0 = 0;
      try { k = incomingKey(); hp0 = this.hp; sh0 = this.shieldHp || 0; } catch (_) { /* */ }
      const out = orig.call(this, amount, dir);
      try {
        const hpRem = Math.max(0, hp0 - this.hp), shRem = Math.max(0, sh0 - (this.shieldHp || 0));
        I.calls++; I.requested += amount || 0; I.shieldAbsorbed += shRem; I.hpRemoved += hpRem;
        const negated = hpRem <= 0 && shRem <= 0;
        if (negated) I.negated++;
        const bs = I.bySource[k.key] || (I.bySource[k.key] = { calls: 0, negated: 0, shield: 0, hp: 0 });
        bs.calls++; bs.shield += shRem; bs.hp += hpRem; if (negated) bs.negated++;
        if (k.r) {
          if (k.bullet) k.r.attacks.bulletCalls++; else k.r.attacks.contactCalls++;
          k.r.dmgToPlayer += hpRem; k.r.shieldToPlayer += shRem;
        }
        if (curWave) { curWave.dmgTaken += hpRem; curWave.shieldTaken += shRem; }
        if (!negated) tl('hurt', Math.round(hpRem), Math.round(shRem), k.key);
      } catch (_) { /* */ }
      frameCost += performance.now() - s;
      return out;
    });
    // Fire attempts the gun refused, and why (dry fire = the human pressed, no ammo).
    wrapMethod(p, 'tryFire', (orig) => function (angle) {
      const s = performance.now();
      let pre = null;
      try { pre = { alive: this.alive, ammo: this.ammo, cd: this.fireCooldown, sec: this.secondary, sa: this.secondaryAmmo }; } catch (_) { /* */ }
      const out = orig.call(this, angle);
      try {
        if (pre && pre.alive && !out) {
          const usingSec = (pre.sec === 'rifle' || pre.sec === 'cluster') && pre.sa > 0;
          if (!usingSec && pre.cd <= 0 && pre.ammo <= 0) { P.standard.tryRefusedEmpty++; tl('dry'); }
          else if (pre.cd > 0) P.standard.tryRefusedCooldown++;
        } else if (out && pre && pre.sec === 'rifle' && pre.sa > 0) { P.override.bursts++; }
      } catch (_) { /* */ }
      frameCost += performance.now() - s;
      return out;
    });
  }

  // ── PLAYER ACTIONS ──────────────────────────────────────────────────────
  let lastShotT = null;
  on('player-fire', () => {
    P.fired.standard++;
    const t = T();
    if (lastShotT !== null) histAdd(P.standard.intervals, t - lastShotT);
    lastShotT = t;
    if (inCombat()) P.standard.combatShots++;
  });
  on('player-fire-rifle', () => { P.fired.override++; P.override.rounds++; });
  on('player-fire-cluster', () => { P.fired.cluster++; P.cluster.throws++; tl('cluster'); });
  on('secondary-equipped', (id) => {
    if (id === 'rifle') { P.override.pickups++; tl('override-on'); }
    else if (id === 'cluster') { P.cluster.pickups++; tl('cluster-on'); }
    else if (id == null) {
      const prev = lastSecondary;
      if (prev === 'rifle') { P.override.emptied++; tl('override-off'); }
      if (prev === 'cluster') { P.cluster.emptied++; }
    }
    lastSecondary = id;
  });
  let lastSecondary = null;
  on('player-fire-super', () => {
    const S = P.super, t = T();
    S.casts++; S.castAt.push(t); S.perCast.push(0); S.hitsByCast.push(0);
    if (S.readyAt !== null) { S.readyToCast.push(t - S.readyAt); S.readyAt = null; }
    S.lastSpentAt = t;
    tl('super');
  });
  on('player-super-blast', (pellets) => { P.super.pellets += pellets || 0; P.fired.super += pellets || 0; });
  on('player-super-ready', () => {
    const S = P.super, t = T();
    S.readies++; S.readyAt = t;
    S.chargeMs.push(t - (S.lastSpentAt ?? 0));
    tl('super-ready');
  });
  on('player-super-denied', () => { P.super.denied++; });
  on('player-melee-ready', () => {
    const M = P.melee, t = T();
    M.readies++; M.readyAt = t;
    M.chargeMs.push(t - (M.lastSpentAt ?? 0));
    tl('melee-ready');
  });
  on('player-melee-cast', (dir, stage, finisher) => {
    const M = P.melee, t = T();
    M.casts++; P.fired.melee++;
    if (finisher) M.finishers++;
    if (stage === 1) {          // the first cast of a chain spends the meter (stages 1..3)
      M.chains++; M.castAt.push(t);
      if (M.readyAt !== null) { M.readyToCast.push(t - M.readyAt); M.readyAt = null; }
      M.lastSpentAt = t;
    }
    tl('melee', stage | 0, finisher ? 1 : 0);
  });
  on('player-dash', () => { P.dash++; });
  on('player-dead', () => { I.deaths++; tl('player-dead'); if (curWave) curWave.deaths++; });
  on('lives-changed', (n) => { I.livesLost++; R.run.livesLeft = n; if (n <= 0) R.run._defeat = true; });

  // ── ROOMS, WAVES, ENCOUNTERS ────────────────────────────────────────────
  function endWave(why) {
    if (!curWave) return;
    curWave.endT = T(); curWave.endW = W(); curWave.durMs = curWave.endT - curWave.startT; curWave.endWhy = why;
    curWave.aliveAtEnd = live.size;
    curWave.meanAlive = curWave._aliveMs > 0 ? +(curWave._aliveInt / curWave._aliveMs).toFixed(2) : 0;
    delete curWave._aliveInt; delete curWave._aliveMs;
    tl('wave-end', curWave.i, why);
    curWave = null;
  }
  on('room-start', (idx, total, spec) => {
    endWave('room-change');
    if (curRoom) { curRoom.endT = T(); curRoom.endW = W(); }
    curRoom = { i: R.rooms.length, roomId: spec?.id ?? null, sector: scene.sector ?? null, startT: T(), startW: W(), endT: null, endW: null, boss: false };
    R.rooms.push(curRoom);
    tl('room', curRoom.roomId, curRoom.sector);
  });
  on('encounter-set', (enc) => { curEnc = enc?.id ?? null; if (curWave) { curWave.encounter = curEnc; curWave.encounterName = enc?.name ?? null; } });
  on('wave-update', (idx, total) => {
    if (idx == null) { endWave('cleared'); return; }
    endWave('next-wave');
    curWave = {
      i: R.waves.length, room: curRoom?.roomId ?? null, roomIdx: curRoom?.i ?? null, sector: scene.sector ?? null,
      waveIdx: idx, waveTotal: total, encounter: scene._encounter?.id ?? curEnc, encounterName: scene._encounter?.name ?? null,
      modifier: scene._roomModifier?.name ?? null,
      startT: T(), startW: W(), endT: null, endW: null, durMs: null, endWhy: null,
      spawned: 0, killed: 0, maxAlive: 0, aliveAtEnd: 0, dmgTaken: 0, shieldTaken: 0, deaths: 0,
      upgrades: (scene.player?._upgrades || []).slice(),
      _aliveInt: 0, _aliveMs: 0,
    };
    curEnc = curWave.encounter;
    R.waves.push(curWave);
    tl('wave', curWave.i, curWave.encounter, idx, total);
  });
  // NOT a wave end: RoomManager emits this whenever its alive count touches 0,
  // which happens mid-wave between spawns (GameScene ignores it while the
  // arena is active). Waves end on 'breather', the next 'wave-update', the
  // arena's completion (wave-update null) or a room change.
  on('room-cleared', () => { tl('room-cleared'); });
  on('boss-start', () => { if (curRoom) curRoom.boss = true; tl('boss-start'); });
  on('sector-changed', (s) => tl('sector', s));
  on('duel-start', () => tl('duel-start'));
  on('duel-end', () => tl('duel-end'));

  const inCombat = () => live.size > 0;

  // ── PER-FRAME OBSERVATION (read-only) ───────────────────────────────────
  let lastAmmo = null, lastUpgrades = 0;
  const onPost = () => {
    const s = performance.now();
    try {
      if (t0 === null) t0 = scene.time.now;
      const dt = game.loop.delta || 0;
      const raw = (game.loop.rawDelta ?? game.loop.delta) || 0;
      R.perf.frames++;
      histAdd(R.perf.frameMs, raw);
      if (raw > 100 && R.perf.longFrames.length < 200) R.perf.longFrames.push([W(), Math.round(raw)]);

      const p = scene.player;
      if (p && !wrappedPlayers.has(p)) wrapPlayer(p);
      // new actors (ordinary enemies, Champions, nemeses) and Vader
      const kids = scene.enemies?.getChildren?.() || [];
      for (let i = 0; i < kids.length; i++) {
        const e = kids[i];
        if (e.active && e.alive && !recOf.has(e)) register(e);
      }
      if (scene.boss && scene.boss.alive && !recOf.has(scene.boss)) register(scene.boss);
      // removed without a death (room change, debug purge) -> despawned
      const view = scene.cameras?.main?.worldView;
      for (const r of live) {
        const e = r._actor;
        if (!e || !e.active || !e.scene) { closeEnemy(r, 'despawned'); continue; }
        if (e.alive) {
          r._lastHp = e.hp ?? r._lastHp; r._lastArmour = e.armour ?? r._lastArmour;
          if (r.seenT === null && view && view.contains(e.x, e.y)) r.seenT = T();
        }
      }
      // pacing
      if (curWave) {
        if (live.size > curWave.maxAlive) curWave.maxAlive = live.size;
        curWave._aliveInt += live.size * dt; curWave._aliveMs += dt;
        if (scene._wavePhase === 'breather' && curWave.endT === null) endWave('breather');
      }
      // gun economy
      if (p && p.alive) {
        const S = P.standard;
        S.ammoSampleMs += dt; S.ammoIntegral += (p.ammo || 0) * dt;
        if ((p.ammo || 0) <= 0) S.emptyMs += dt;
        if ((p.ammo || 0) >= PLAYER.ammoMax) S.fullMs += dt;
        if (lastAmmo !== null && p.ammo > lastAmmo) S.reloads += p.ammo - lastAmmo;
        lastAmmo = p.ammo;
        if (inCombat()) S.combatMs += dt;
        if (p.secondary === 'rifle' && p.secondaryAmmo > 0) P.override.heldMs += dt;
        const up = p._upgrades?.length || 0;
        if (up !== lastUpgrades) { for (let k = lastUpgrades; k < up; k++) { R.upgrades.push([W(), T(), p._upgrades[k]]); tl('upgrade', p._upgrades[k]); } lastUpgrades = up; }
      }
      R.clock.gameMs = T(); R.clock.wallMs = W();
    } catch (err) { R.errors = (R.errors || 0) + 1; if (!R.firstError) R.firstError = String(err && err.stack || err); }
    frameCost += performance.now() - s;
    histAdd(R.perf.overheadUs, frameCost * 1000);
    R.perf.overheadTotalMs += frameCost;
    frameCost = 0;
  };
  scene.events.on('postupdate', onPost);

  // pauses (the wall clock keeps running; the game clock does not)
  let pausedAt = null;
  const onPause = () => { pausedAt = performance.now(); R.clock.pauses++; tl('pause'); ctl.onPause(); };
  const onResume = () => { if (pausedAt !== null) R.clock.pausedWallMs += performance.now() - pausedAt; pausedAt = null; tl('resume'); ctl.onResume(); };
  scene.events.on('pause', onPause);
  scene.events.on('resume', onResume);

  // ── FINALISE ────────────────────────────────────────────────────────────
  function snapshot(final, reason) {
    const out = { ...R, run: { ...R.run }, enemies: R.enemies.map(({ _lastHp, _lastArmour, _actor, _killSrc, ...k }) => k) };
    delete out.run._defeat;
    if (final) {
      out.run.endedAt = new Date().toISOString();
      out.run.endReason = reason;
    } else {
      out.run.endReason = 'in-progress';
    }
    out.clock = { ...R.clock, gameMs: T(), wallMs: W() };
    return out;
  }
  let done = false;
  const finalize = (reason) => {
    if (done) return; done = true;
    endWave('run-end');
    for (const r of [...live]) closeEnemy(r, 'alive-at-end');
    if (curRoom) { curRoom.endT = T(); curRoom.endW = W(); }
    if (pausedAt !== null) { R.clock.pausedWallMs += performance.now() - pausedAt; pausedAt = null; }
    tl('run-end', reason);
    ctl.finishRun(snapshot(true, reason));
  };
  const teardown = () => {
    // Which way did the run end? A defeat is known now; restart vs quit is
    // decided by the controller once the next scene is up.
    finalize(R.run._defeat ? 'defeat' : 'ended');
    scene.events.off('postupdate', onPost);
    scene.events.off('pause', onPause);
    scene.events.off('resume', onResume);
    bound.forEach(([ev, fn]) => scene.events.off(ev, fn));
    bound.length = 0;
    restores.splice(0).reverse().forEach((f) => { try { f(); } catch (_) { /* */ } });
    if (scene._b0 === api) scene._b0 = null;
  };
  scene.events.once('shutdown', teardown);
  scene.events.once('destroy', teardown);

  const api = {
    record: () => R,
    snapshot: () => snapshot(false),
    finalize,
  };
  scene._b0 = api;
  ctl.startRun(api, R);
  tl('run-start', R.run.id, R.run.label);
  return api;
}
