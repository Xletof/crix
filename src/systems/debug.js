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
