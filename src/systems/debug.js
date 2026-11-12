// Debug flags.
//
// Module scope, not scene state, for the same reason FX.js holds `muted` that
// way: PauseScene._restart() stops and restarts the Game scene, which builds a
// fresh Player. A flag living on the player or the scene would silently switch
// itself off on every restart, which is exactly when you least want to lose it.
//
// This ships in the production build on purpose. `window.game` is only exposed
// under import.meta.env.DEV (main.js), so on the deployed GitHub Pages build
// there is no console and no other way to reach any of this from a phone.

let godMode = false;

export function isGodMode() { return godMode; }
export function setGodMode(v) { godMode = !!v; }

// ── Dialogue mute ──────────────────────────────────────────────────────────
//
// The dialogue card PAUSES Game and HUD and waits for a tap. That is right for
// a player and fatal for a harness: the first measurement run after the
// narrative landed reported encounter 1 as 180.2s with 45,826 of 46,000 hp
// left, because `spawnBoss` raised Vader's arrival card and the bot then spent
// the entire cap unable to act. Eleven test files spawn a boss or a nemesis and
// every one of them would have hung the same way.
//
// Muted via `?nodlg=1` on the page URL rather than a method call, so a new
// harness copied from an existing one inherits it instead of rediscovering this
// the hard way. `smoke-dialogue` deliberately loads WITHOUT the flag — it is
// the one test whose subject is the card.
let dialogueMuted = false;

export function isDialogueMuted() { return dialogueMuted; }
export function setDialogueMuted(v) { dialogueMuted = !!v; }

// ── Hitstop mute ───────────────────────────────────────────────────────────
//
// Hitstop deliberately freezes `time.timeScale`, `physics.world.timeScale` and
// the game-wide `anims.globalTimeScale` for 45-80ms on a heavy landing. That is
// correct for a player and poison for a harness: the headless loop runs at
// ~10fps, so a single 70ms freeze swallows most of a sampled frame, and every
// measurement expressed in "how far did this move over N frames" reads short.
//
// It cost two full suite runs to work that out. The symptom is the tell — a
// DIFFERENT test failed each run (smoke-boss-moves, then smoke-vader, then
// smoke-endless and smoke-moves), all of them passing standalone, because
// whichever measurement happened to overlap a freeze was the one that lost.
//
// Muted via `?nofreeze=1` for the same reason `?nodlg=1` exists, and with the
// same rule: the one test whose SUBJECT is hitstop (`smoke-duel`) deliberately
// loads without the flag, so the behaviour itself stays covered.
let hitstopMuted = false;

export function isHitstopMuted() { return hitstopMuted; }
export function setHitstopMuted(v) { hitstopMuted = !!v; }

// ── Unlabelled review ──────────────────────────────────────────────────────
//
// `?nonames=1` suppresses the ATTACK-NAME banner for Vader's moves and nothing
// else. It exists to answer one question that no assertion can: with the name
// hidden, can the move still be identified from his motion, the telegraph and
// the effects alone? A move that only reads because the word FORCE PULL is
// printed across the top of the screen has not communicated anything.
//
// Deliberately narrow. It gates the six per-attack callouts (the five scripted
// moves plus the state machine's SLAM) and leaves every other banner alone —
// VADER APPROACHES, ENRAGED, DEFLECTION, LIGHTS OUT are phase and event
// presentation, not attack identity, and blanking them would change what the
// reviewer is looking at rather than what they are being asked about.
//
// It is inert unless the flag is on the URL, exactly like `?nodlg=1`, so the
// production build is untouched. This does NOT decide whether attack names ship
// — that stays a human call.
let moveNamesMuted = false;

export function areMoveNamesMuted() { return moveNamesMuted; }
export function setMoveNamesMuted(v) { moveNamesMuted = !!v; }

// ── Straight into a fight ──────────────────────────────────────────────────
//
// The first nemesis a run can meet is at SECTOR 3 — mini-bosses come only from
// the `detention` arena — so checking a change to one meant playing two rooms
// first, every time, on a phone. That is minutes per look at an 800ms
// telegraph, and it is the reason a broken dash survived a whole pass: nobody
// was going to replay to sector 3 to watch the same move again.
//
// `?duel=` drops you into the fight on load. It is a URL rather than a menu so
// it can be bookmarked on the handset and re-opened with one tap, and so a
// specific fight can be sent to someone else exactly as it was seen.
//
//   ?duel=1                       a random nemesis, right now
//   ?duel=bomber                  that base
//   ?duel=grunt:armored,colossal  that base with those traits
//   &move=slidesmash              it casts ONLY this move, on a 2s clock
//   &sector=12                     scale it as if the run were that deep
//
// Combine freely: ?duel=grunt:armored&move=slidesmash&sector=12
let duelRequest = null;

export function getDuelRequest() { return duelRequest; }
export function setDuelRequest(v) { duelRequest = v; }

/** Parse the `duel`/`move`/`sector` params into a request, or null. */
export function parseDuelParams(params) {
  const raw = params.get('duel');
  if (!raw) return null;
  const [base, traitList] = raw.split(':');
  const traits = traitList ? traitList.split(',').filter(Boolean) : null;
  const sector = parseInt(params.get('sector') || '', 10);
  return {
    base: base && base !== '1' ? base : null,
    traits,
    move: params.get('move') || null,
    sector: Number.isFinite(sector) ? sector : null,
  };
}

// ── Encounter test harness ─────────────────────────────────────────────────
//
// PHASE A INSTRUMENTATION, and nothing else. The encounter table
// (`src/data/encounters.js`) authors six tactical identities, and the human has
// no way to tell which one is running or to ask for a specific one: a wave's
// archetype is chosen from the arena and the sector band, so seeing CROSSFIRE
// in the junction and then CROSSFIRE in detention means playing sectors and
// hoping. That is the same friction `?duel=` exists to remove, one system
// along.
//
//   ?encdbg=1              the overlay on, selection starts at AUTO
//   ?encdbg=crossfire      the overlay on, that archetype pre-selected
//   &room=detention        start in that arena instead of the hangar
//   &sector=8              start at that sector, so the BAND is the one you want
//
// Module scope for the same reason `godMode` is: `PauseScene._restart()` builds
// a fresh Game scene, and a flag on the scene would switch itself off exactly
// when you least want it to.
//
// TWO PROPERTIES THIS MUST NEVER LOSE, both asserted by `smoke-encdbg`:
//   - with the flag ABSENT nothing changes, at all. No overlay, no forcing, no
//     extra pointer exclusion, and `encounterFor` decides every wave.
//   - the force only ever SUBSTITUTES for an encounter the real resolver
//     already returned. It cannot manufacture one, so the boss room and the
//     duel wave stay outside it by the same absence that protects them in
//     production rather than by a second rule that could drift.
let encDebug = false;
let encForce = null;   // archetype id, or null = AUTO (the authored plan decides)

export function isEncDebug() { return encDebug; }
export function setEncDebug(v) { encDebug = !!v; }
export function getEncForce() { return encForce; }
export function setEncForce(id) { encForce = id || null; }

// Two more pieces of grammar for the Phase B Champion placement pilot, both
// read ONLY alongside `?encdbg` and both inert without it:
//
//   &wave=2       start the FIRST room at that wave (1-based). The authored
//                 placements live on a room's second and third waves, and a
//                 bookmark that makes the reviewer clear a wave first is not a
//                 bookmark.
//   &nochamp=1    suppress the authored Champion placement, so the SAME cell
//                 can be played without him — the matched baseline. It never
//                 ADDS a Champion anywhere; it can only take one away.
//   &noscreen=1   switch the VANGUARD screen role off (the Shielded holds at
//                 its stock ~290px again), for the old-vs-new comparison. It
//                 can only take the role away, never grant it.
let champPlacementOff = false;
let vanguardScreenOff = false;
//   &nofront=1    switch the VANGUARD FRONT staging off (no drip hold after
//                 the opening shields, no opening lanes) while the 140px screen
//                 stays ON — the timing of `1b7c84d`, for the A/B. Separate
//                 from `noscreen` on purpose: they are two experiments.
let vanguardFrontOff = false;
export function isVanguardFrontOff() { return vanguardFrontOff; }
export function setVanguardFrontOff(v) { vanguardFrontOff = !!v; }

export function isVanguardScreenOff() { return vanguardScreenOff; }
export function setVanguardScreenOff(v) { vanguardScreenOff = !!v; }

export function isChampPlacementOff() { return champPlacementOff; }
export function setChampPlacementOff(v) { champPlacementOff = !!v; }

/** Parse `?encdbg` into `{ on, force, room, sector, wave, nochamp }`, or null when absent. */
export function parseEncDebugParams(params) {
  if (!params.has('encdbg')) return null;
  const raw = (params.get('encdbg') || '').trim();
  const sector = parseInt(params.get('sector') || '', 10);
  const wave = parseInt(params.get('wave') || '', 10);
  return {
    on: true,
    // '1', '' and 'on' all mean "overlay only, no forcing". Anything else is
    // taken as an archetype id and VALIDATED by the caller against the real
    // table — a typo must fall back to AUTO rather than force a null archetype.
    force: (raw && raw !== '1' && raw !== 'on') ? raw : null,
    room: params.get('room') || null,
    sector: Number.isFinite(sector) ? sector : null,
    wave: Number.isFinite(wave) ? wave : null,
    nochamp: params.has('nochamp') && params.get('nochamp') !== '0',
    noscreen: params.has('noscreen') && params.get('noscreen') !== '0',
    nofront: params.has('nofront') && params.get('nofront') !== '0',
  };
}

// ── Champion vertical slice ────────────────────────────────────────────────
//
// `?champdbg=1` injects exactly ONE Champion into each ordinary wave, into the
// real Phase A encounter — real room, real authored queue, real ordinary
// enemies, one real Champion standing in it. Combine it with the encounter
// harness so a whole test case is one bookmark:
//
//   ?champdbg=1&encdbg=crossfire&room=detention&sector=8
//
// This flag is the only path to a Champion OUTSIDE the authored placements in
// `CHAMPION_PLACEMENTS` (`src/data/encounters.js`) — there is no entry in any
// encounter pool, no branch in `_rollEnemyType` and no chance roll anywhere.
// `smoke-champion` and `smoke-champion-placement` assert both halves. On a
// placement wave the injector stands down, so the two never stack.
//
// `?champdbg=1` injects the ACTIVE candidate, which is the SHOCK CAPTAIN. The
// Interdictor and the Harrower are both HUMAN-REJECTED (`HANDOVER.md` §10af)
// and are kept in the tree only so the post-mortem sits next to the thing it is
// about; `?champdbg=interdictor` and `?champdbg=harrower` are the only ways to
// reach them, for a side-by-side when judging the new one.
//
// THE DEFAULT MATTERS. A rejected prototype left as what the flag produces is
// how a handset session ends up reviewing the wrong actor — so the default is
// the candidate under test, and anything unrecognised falls back to it rather
// than to a rejected one.
const CHAMP_CANDIDATES = ['captain', 'harrower', 'interdictor'];
let champDebug = false;
let champWhich = 'captain';

export function isChampDebug() { return champDebug; }
export function setChampDebug(v) { champDebug = !!v; }
/** Which candidate the flag spawns: 'captain' (active), 'harrower' or 'interdictor'. */
export function getChampWhich() { return champWhich; }
export function setChampWhich(v) {
  champWhich = CHAMP_CANDIDATES.includes(v) ? v : 'captain';
}

// ── Captain combat-economy telemetry ────────────────────────────────────────
//
// `?champdbg=1&captel=1`. A SEPARATE, EXPLICIT flag, deliberately not folded
// into `champdbg`: the Champion harness is for PLAYING the actor and this is
// for MEASURING a fight, and a measurement overlay that appears whenever the
// actor does would be in the way of every review that is not about numbers.
//
// WHY IT EXISTS. Balance thinking had reached "the Captain survives 2-3
// Supers", and that sentence is only meaningful if a Super is scarce. In real
// handset play the Super can be used roughly once a second, which makes it
// closer to high-power secondary fire than to an ultimate — so "survives three
// of them" may describe three seconds. This instrument answers the question
// with numbers instead of with the word: how often does a real player actually
// fire it, how much of the Captain's REAL durability does each one remove, and
// does the Captain get to perform his kit before he is gone.
//
// IT IS OBSERVATION ONLY. It changes no damage, no hp, no armour, no cooldown,
// no AI, no spawn composition and no Super cadence — `smoke-captel` asserts
// that the tuning is byte-identical with the flag on and off, because an
// instrument that perturbs the thing it measures is worse than no instrument.
//
// With the flag ABSENT nothing is constructed, nothing is listened to and
// nothing is drawn.
let capTel = false;

export function isCapTel() { return capTel; }
export function setCapTel(v) { capTel = !!v; }

// ── B0 combat-baseline telemetry (`?b0=1`, `?b0=A`, `?b0=B`) ────────────────
//
// MEASUREMENT ONLY (systems/b0Telemetry.js, b0Report.js). Records real handset
// play — enemy TTK, gun and ability economy, real durability removed by
// source, incoming damage, encounter pacing, frame pacing — and exports it as
// JSON from an end-of-run report. With the flag ABSENT nothing is constructed,
// listened to, wrapped, stored or drawn. With it present the seeded fight is
// unchanged (`tests/smoke-b0.mjs`). The value is the run's label: `A` / `B`
// name the two HUMAN playtest runs; `1` (or anything else) means no label.
let b0 = false;
let b0Label = null;
export function isB0() { return b0; }
export function getB0Label() { return b0Label; }

// ── B1 combat experiment variants (`?b1=G|M|S`) ──────────────────────────────
//
// HUMAN-AUTHORIZED EXPERIMENTS ONLY (2026-11-10), opt-in, never a default
// (systems/b1Combat.js). G = the B1 STANDARD rifle alone; M / S = the same
// rifle plus the moderate / full crowd-control Super. Anything else (or the
// parameter absent) is R1, with nothing installed and no tuning touched.
let b1Variant = null;
export function getB1Variant() { return b1Variant; }
export function setB1Variant(v) {
  const s = v == null ? '' : String(v).trim().toUpperCase();
  b1Variant = (s === 'G' || s === 'M' || s === 'S') ? s : null;
}
// B2-1 — THE FLAGSHIP EXPERIMENT (`?b2=A|B`, HUMAN-authorized 2026-11-12,
// opt-in, NOT a default). One automatic rifle built on a reusable weapon /
// presentation layer (systems/b2Flagship.js, b2Feel.js, b2Voice.js):
//   A = the new weapon on the R1 (per-hit, self-recharging) Super economy
//   B = the same weapon on the damage-based economy (no pellet self-charge)
// `&b2range=1` is the firing range; `&b2x.<knob>=<n>` overrides one tuning
// value (the knob table is B2_DEFAULTS in systems/b2Flagship.js). Ignored
// while a B1 variant is set, so the B1 links keep meaning what they meant.
let b2Variant = null;
let b2Range = false;
let b2Knobs = {};
export function getB2Variant() { return b2Variant; }
export function isB2Range() { return b2Range; }
export function getB2Knobs() { return b2Knobs; }
export function setB2(v, params = null) {
  const s = v == null ? '' : String(v).trim().toUpperCase();
  b2Variant = (s === 'A' || s === 'B') && !b1Variant ? s : null;
  b2Range = false; b2Knobs = {};
  if (!b2Variant || !params) return;
  b2Range = params.get('b2range') === '1';
  for (const [k, val] of params) {
    if (!k.startsWith('b2x.')) continue;
    const n = Number(val);
    if (Number.isFinite(n)) b2Knobs[k.slice(4)] = n;
  }
}
export function setB0(v) {
  if (v == null || v === false) { b0 = false; b0Label = null; return; }
  b0 = true;
  const s = String(v).trim().toUpperCase();
  b0Label = /^[A-Z0-9]{1,8}$/.test(s) && s !== '1' && s !== 'TRUE' ? s : null;
}

// ── Roster visual A/B (`?roster=v1`) ──────────────────────────────────────
//
// SINCE R1 THIS AND THE SIX GAMEPLAY SWITCHES BELOW ARE ON BY DEFAULT — see
// THE GAMEPLAY BASELINE after them. Each comment's "default off" / "absent"
// describes the `?baseline=legacy` game (the pre-R1 default).
//
// The Regular/Elite roster redesign arrives behind this switch. It selects
// PRESENTATION ONLY — body sheets, weapon overlays, elite presentation and the
// Bulwark field renderer — and never AI, hp, radius, speed, encounters or
// rewards. Absent, the game is the legacy roster exactly (`smoke-roster-seams`
// compares it against a fixture captured from `88e9b89`). Present, any role
// without registered v1 art still falls back to legacy art, so this flag can
// ship before the art does.
let rosterVersion = 'legacy';
export function getRosterVersion() { return rosterVersion; }
export function setRosterVersion(v) { rosterVersion = v === 'v1' ? 'v1' : 'legacy'; }
export function isRosterV1() { return rosterVersion === 'v1'; }

// `?move=v2` — CANDIDATE locomotion for the shared shooter tick (Gunner and
// Rifleman in swarm waves): committed strafe legs, settles, band hysteresis,
// eased velocity and a planted shot. THIS CHANGES GAMEPLAY (positions, lines,
// how long a body is still), which is why it is its own flag and not part of
// the roster presentation switch. Default off: the shipped movement.
let moveV2 = false;
export function setMoveV2(on) { moveV2 = !!on; }
export function isMoveV2() { return !!moveV2; }
// `?move=v21` — v2 plus a PERSONAL LANE per body (see `_tickSwarmLegs`).
export function setMoveV21(on) { moveV2 = on ? 'v21' : moveV2; }
export function isMoveV21() { return moveV2 === 'v21'; }
// `?move=v22` — v2 plus DESTINATION OWNERSHIP per leg (see `_pickDest`).
export function setMoveV22(on) { moveV2 = on ? 'v22' : moveV2; }
export function isMoveV22() { return moveV2 === 'v22'; }

// `?bulwarkStuck=prog|early` — Phase 3B CANDIDATE stuck recovery for the
// ORDINARY BULWARK ONLY (see systems/bulwarkStuck.js). THIS CHANGES GAMEPLAY
// (where a Bulwark goes when the frozen base check fires falsely), which is
// why it is its own flag and coupled to neither `?move=` nor `?roster=`.
// Default off: the frozen base check, exactly as shipped.
let bulwarkStuck = null;
export function setBulwarkStuck(v) { bulwarkStuck = v === 'prog' || v === 'early' ? v : null; }
export function getBulwarkStuck() { return bulwarkStuck; }

// `?marksmanStuck=prog|early` — Phase 3C stuck recovery for the ORDINARY
// MARKSMAN ONLY (see systems/marksmanStuck.js). Candidate B (`early`) is
// HUMAN-APPROVED in the integrated configuration (R0/R1); A (`prog`) is not.
// Gameplay, so its own flag,
// coupled to none of `?move=`, `?roster=`, `?gait=` or `?bulwarkStuck=`.
// Default off: the frozen base check, exactly as shipped.
let marksmanStuck = null;
export function setMarksmanStuck(v) { marksmanStuck = v === 'prog' || v === 'early' ? v : null; }
export function getMarksmanStuck() { return marksmanStuck; }

// `?marksmanAngle=1` — Phase 3C-T1 CANDIDATE firing-angle recovery for the
// ORDINARY MARKSMAN ONLY (see systems/marksmanAngle.js): a Marksman whose line
// to the player is cut walks to a spot on its own band that has one. Gameplay,
// so its own flag, coupled to none of `?move=`, `?roster=`, `?gait=`,
// `?bulwarkStuck=` or `?marksmanStuck=`. Default off: the frozen hold.
let marksmanAngle = false;
export function setMarksmanAngle(on) { marksmanAngle = !!on; }
export function isMarksmanAngle() { return marksmanAngle; }

// `?bulwarkAngle=1` — Phase T2 CANDIDATE tactical engagement for the ORDINARY
// FREE BULWARK ONLY (see systems/bulwarkAngle.js): a Bulwark whose line to the
// player is cut presses round the obstacle to a spot at its own range or closer
// that has one. Never a VANGUARD screen, never a nemesis. Gameplay, so its own
// flag, coupled to none of the others. Default off: the frozen hold.
let bulwarkAngle = false;
export function setBulwarkAngle(on) { bulwarkAngle = !!on; }
export function isBulwarkAngle() { return bulwarkAngle; }

// `?gait=v2` — the corrected roster-v1 LOCOMOTION PRESENTATION (anatomy gait,
// distance-driven cadence, retreat / strafe playback). Presentation only: it
// repaints the roster-v1 leg frames and picks the displayed frame after the
// frozen base class has chosen its animation. Default off until the handset.
let gaitV2 = false;
export function setGaitV2(on) { gaitV2 = !!on; }
export function isGaitV2() { return gaitV2; }

// ── THE GAMEPLAY BASELINE — R1 production rollout ──────────────────────────
//
// The seven switches above shipped OFF as opt-in candidates. Each was
// HUMAN-approved on its own; the human then played the integrated combination
// on the handset (R0, configuration "C"), approved it, and instructed that it
// become the default game. So a player who opens CRIX with no query string now
// gets all seven ON. No module changed to do this — it only decides which
// already-approved modules are installed (`GameScene.spawnEnemyAt`, unchanged).
//
//   production  (no `?baseline`, or `?baseline=production`) — THE DEFAULT:
//               roster v1, move v22, gait v2, bulwarkStuck early,
//               marksmanStuck early, marksmanAngle 1, bulwarkAngle 1
//   legacy      (`?baseline=legacy`) — the pre-R1 default: all seven OFF,
//               the game as it shipped up to `2ab24af`
//
// Each individual flag still overrides its baseline value, so every earlier
// experiment stays reachable. The URL grammar (`applyGameplayFlags`):
//   roster         v1 | legacy (or off / 0)
//   move           v2 | v21 | v22 | off (or legacy / 0); any other value keeps
//                  the baseline (`?duel=…&move=slidesmash` names a nemesis move)
//   gait           v2 | off (or legacy / v1 / 0)
//   bulwarkStuck   prog | early; PRESENT with any other value = off (as before)
//   marksmanStuck  prog | early; likewise
//   marksmanAngle  1 | 0 (or off)
//   bulwarkAngle   1 | 0 (or off)
// The R0 experiment labels keep their meaning:
//   A (the old default)  `?baseline=legacy`
//   B                    `?marksmanStuck=off`, i.e. `?baseline=legacy&roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1`
//   C (the new default)  no flags, i.e. `?baseline=legacy&` + C's seven flags
// Module scope like every flag here, so a restart keeps it; `BootScene` applies
// it once per page load, before anything is painted or spawned.
export const GAMEPLAY_BASELINES = Object.freeze({
  production: Object.freeze({ roster: 'v1', move: 'v22', gait: 'v2', bulwarkStuck: 'early', marksmanStuck: 'early', marksmanAngle: true, bulwarkAngle: true }),
  legacy: Object.freeze({ roster: 'legacy', move: 'off', gait: 'off', bulwarkStuck: null, marksmanStuck: null, marksmanAngle: false, bulwarkAngle: false }),
});
let gameplayBaseline = 'production';
export function getGameplayBaseline() { return gameplayBaseline; }

// `?move=` values: v2 -> true (the bare candidate), v21 / v22 -> the string, anything else -> off
function setMoveVersion(v) { moveV2 = v === 'v2' ? true : v === 'v21' || v === 'v22' ? v : false; }

export function applyGameplayBaseline(name) {
  gameplayBaseline = name === 'legacy' ? 'legacy' : 'production';
  const b = GAMEPLAY_BASELINES[gameplayBaseline];
  setRosterVersion(b.roster);
  setMoveVersion(b.move);
  setGaitV2(b.gait === 'v2');
  setBulwarkStuck(b.bulwarkStuck);
  setMarksmanStuck(b.marksmanStuck);
  setMarksmanAngle(b.marksmanAngle);
  setBulwarkAngle(b.bulwarkAngle);
}

const OFF = new Set(['off', 'legacy', '0']);
/** The baseline, then each flag the URL names. `params` is a URLSearchParams. */
export function applyGameplayFlags(params) {
  applyGameplayBaseline(params.get('baseline'));
  const v = (k) => (params.has(k) ? params.get(k) : null);
  const roster = v('roster');
  if (roster === 'v1') setRosterVersion('v1'); else if (OFF.has(roster)) setRosterVersion('legacy');
  const move = v('move');
  if (move === 'v2' || move === 'v21' || move === 'v22' || OFF.has(move)) setMoveVersion(move);
  const gait = v('gait');
  if (gait === 'v2') setGaitV2(true); else if (gait === 'v1' || OFF.has(gait)) setGaitV2(false);
  if (params.has('bulwarkStuck')) setBulwarkStuck(params.get('bulwarkStuck'));
  if (params.has('marksmanStuck')) setMarksmanStuck(params.get('marksmanStuck'));
  const ma = v('marksmanAngle');
  if (ma === '1') setMarksmanAngle(true); else if (OFF.has(ma)) setMarksmanAngle(false);
  const ba = v('bulwarkAngle');
  if (ba === '1') setBulwarkAngle(true); else if (OFF.has(ba)) setBulwarkAngle(false);
}
applyGameplayBaseline('production');

// `?colliders=1` draws every enemy's PHYSICS footprint (body circle, which
// Arcade scales with the sprite) and its BULLET hit radius (`cfg.radius`). It
// exists so a handset reviewer can judge art-to-hitbox honesty when v1 elite
// art renders at 1.0 while keeping the historical collider. Nothing is built
// without the flag.
let showColliders = false;
export function isShowColliders() { return showColliders; }
export function setShowColliders(v) { showColliders = !!v; }

// ── VISUAL IDENTITY V2 — look-development pilot (`?visualPilot=v2`) ────────
//
// HUMAN-AUTHORIZED OPT-IN PRESENTATION CANDIDATE (2026-11-04), NOT A DEFAULT.
// Absent (or any other value), nothing is painted, swapped or installed and the
// game is the R1 production presentation exactly. Present, it selects:
//   - the V2 protagonist sheet, painted into the `player` key at Preload (same
//     24-frame contract, same anim keys; the body circle is re-centred on the
//     frame by Player's own constructor, so the collider is unchanged);
//   - the V2 swarmling sheet (`vp-swarm`), worn by `swarmling` only, at the
//     same 0.7 render scale and the same body circle;
//   - the V2 Hangar treatment: a material pass on the Hangar backdrop and V2
//     cover / prop art on the same canvas sizes and the same bodies.
// PRESENTATION ONLY: no hp, radius, speed, AI, timing, spawn, camera, collision
// or `Math.random` draw may differ (`tests/smoke-visual-pilot.mjs`). It is
// coupled to none of the gameplay switches above and applies on top of either
// baseline. Painters: `systems/vpPaint.js`, `systems/vpHangar.js`.
//
// `?visualPilot=v2b` — VISUAL IDENTITY V2B (2026-11-04, a second candidate, also
// opt-in): the SAME V2 protagonist and swarmling, and a refined Hangar —
// material depth and contrast (relief-lit machinery, re-planed crates,
// height-projected cast shadows, region and wall relief). `v2` stays exactly
// as delivered so the two can be compared without rebuilding an old commit.
//
// `?visualPilot=v2c` — VISUAL IDENTITY V2C (2026-11-04, a third candidate, also
// opt-in): V2B in every respect — characters, objects, machinery, shadows —
// except the Hangar's GROUND (fields, slabs, purposeful wear; `groundC` in
// `systems/vpHangar.js`). `v2` and `v2b` stay exactly as delivered.
const VISUAL_PILOTS = ['v2', 'v2b', 'v2c'];
let visualPilot = null;
export function setVisualPilot(v) { visualPilot = VISUAL_PILOTS.includes(v) ? v : null; }
/** 'v2' | 'v2b' | 'v2c' | null */
export function getVisualPilot() { return visualPilot; }
/** The V2 character family (protagonist + swarmling): on for every candidate. */
export function isVisualPilotV2() { return visualPilot != null; }
/** The V2B Hangar objects (crates, relief, shadows): on for `v2b` AND `v2c`. */
export function isVisualPilotV2B() { return visualPilot === 'v2b' || visualPilot === 'v2c'; }
/** The V2C Hangar ground only. */
export function isVisualPilotV2C() { return visualPilot === 'v2c'; }
/** `?visualPilot=v2` / `v2b` / `v2c` on, anything else off. `params` is a URLSearchParams. */
export function applyVisualFlags(params) {
  setVisualPilot(params.get('visualPilot'));
  setPolish(params.get('polish'));
  setFxPilot(params.get('fxPilot'));
  setMuzzleAB(params.get('muzzle'));
}

// ── P1 — COMBAT VISUAL POLISH (`?visualPilot=v2c&polish=p1`) ───────────────
//
// HUMAN-AUTHORIZED OPT-IN PRESENTATION CANDIDATE (2026-11-05), NOT A DEFAULT.
// Three components the HUMAN judges independently, layered over the approved
// V2C presentation:
//   P1-A  width-aware announcement banners and the sector sign (HUD scene,
//         `systems/p1Banner.js`);
//   P1-B  the player's Super-ready indicator (`systems/p1Player.js`);
//   P1-C  the player's weapon presentation — new namespaced `p1-*` textures
//         (`systems/p1Paint.js`) on a weapon layer of its own.
// TIED TO V2C: `polish=p1` is honoured ONLY together with `visualPilot=v2c`,
// because the P1 weapons are drawn for the V2 protagonist. With any other
// pilot (or none) the parameter is ignored and the game is exactly that mode —
// R1, V2, V2B and V2C never acquire P1 silently. Any other `polish` value is
// off. PRESENTATION ONLY: no hp, radius, speed, timing, spawn, projectile
// origin, camera, collision or `Math.random` draw may differ
// (`tests/smoke-polish-p1.mjs`).
const POLISHES = ['p1'];
let polish = null;
export function setPolish(v) { polish = POLISHES.includes(v) ? v : null; }
/** The `polish` parameter as given ('p1' | null), honoured or not. */
export function getPolishRequested() { return polish; }
/** P1 is live: `polish=p1` AND `visualPilot=v2c`. */
export function isPolishP1() { return polish === 'p1' && visualPilot === 'v2c'; }

// ── P2-A — BLASTER FIRE & IMPACT (`?visualPilot=v2c&polish=p1&fxPilot=p2a`) ─
//
// HUMAN-AUTHORIZED OPT-IN PRESENTATION CANDIDATE (2026-11-05), NOT A DEFAULT.
// The player's ordinary pistol and DC-15 rifle fire: muzzle ignition, the
// projectile's tracer and its contact with bodies, metal and shields
// (`systems/p2aFx.js`, textures `systems/p2aPaint.js`). Super and melee
// effects are out of its scope.
// TIED TO P1: `fxPilot=p2a` is honoured ONLY when P1 is live (`polish=p1` +
// `visualPilot=v2c`), because the muzzle is drawn at the P1 weapons' own
// barrel faces. With anything else the parameter is ignored and the game is
// exactly that mode — R1, V2, V2B, V2C and P1 never acquire P2-A silently.
// Any other `fxPilot` value is off. PRESENTATION ONLY: no hp, radius, speed,
// timing, spawn, projectile origin, body, camera, hitstop, collision or
// `Math.random` draw may differ (`tests/smoke-fx-p2a.mjs`).
//
// `fxPilot=p2a2` — P2-A2, PRIMARY CARBINE & OVERRIDE (HUMAN-authorized
// candidate, 2026-11-06, opt-in): P2-A's layer plus a LOADOUT presentation.
// The hero visibly carries the approved P1 rifle at all times; the ordinary
// (pistol) fire path — unchanged, its ammo, cooldown, bolts and damage — is
// presented as the rifle's single-shot STANDARD mode, and the rifle pickup
// (internally still `'rifle'`, 27 rounds, three-shot burst) as the OVERRIDE
// firing-mode module. Also tied to P1. `p2a` keeps its output exactly
// (`tests/smoke-fx-p2a2.mjs`).
//
// `fxPilot=p2a3` — P2-A3, OVERRIDE REFINEMENT (HUMAN-authorized candidate,
// 2026-11-06, opt-in): ALL of P2-A2 plus the OVERRIDE readout fixed and
// redrawn (the round count and bar follow every shot; a three-round burst
// symbol), the carried rifle's power cell while OVERRIDE is engaged, and the
// engage / run-dry beats (`systems/p2a3Override.js`). Also tied to P1.
// `p2a2` keeps its output exactly (`tests/smoke-fx-p2a3.mjs`).
//   The STANDARD discharge under P2-A3 is the SHARP one (HUMAN verdict
//   2026-11-09: P2-A3 APPROVED with the sharp variant, made the default):
//   P2-A2's texture, size, depth and occlusion with a shorter persistence (the
//   peak on the first frame the shot is seen, gone ~2 frames later).
//   `&muzzle=current` — P2-A3 ONLY, a comparison flag: P2-A2's flash (the
//   ~4-frame fade) exactly. `&muzzle=sharp` is accepted and is the default.
//   Any other value, or any other mode, ignores it.
const FX_PILOTS = ['p2a', 'p2a2', 'p2a3'];
let fxPilot = null;
export function setFxPilot(v) { fxPilot = FX_PILOTS.includes(v) ? v : null; }
/** The `fxPilot` parameter as given ('p2a' | 'p2a2' | 'p2a3' | null), honoured or not. */
export function getFxPilotRequested() { return fxPilot; }
/** The P2-A layer is live: `fxPilot=p2a`, `p2a2` or `p2a3`, AND P1 live. */
export function isFxP2A() { return (fxPilot === 'p2a' || fxPilot === 'p2a2' || fxPilot === 'p2a3') && isPolishP1(); }
/** P2-A2's carbine loadout is live: `fxPilot=p2a2` or `p2a3` (which carries all of it), AND P1 live. */
export function isFxP2A2() { return (fxPilot === 'p2a2' || fxPilot === 'p2a3') && isPolishP1(); }
/** P2-A3 (the OVERRIDE refinement over P2-A2) is live: `fxPilot=p2a3` AND P1 live. */
export function isFxP2A3() { return fxPilot === 'p2a3' && isPolishP1(); }
const MUZZLE_AB = ['sharp', 'current'];
let muzzleAB = null;
export function setMuzzleAB(v) { muzzleAB = MUZZLE_AB.includes(v) ? v : null; }
/** The `muzzle` parameter as given ('sharp' | 'current' | null), honoured or not. */
export function getMuzzleABRequested() { return muzzleAB; }
/** The STANDARD discharge's sharp variant is live: P2-A3 live, unless `muzzle=current`. */
export function isMuzzleSharp() { return isFxP2A3() && muzzleAB !== 'current'; }
