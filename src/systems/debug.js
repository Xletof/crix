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
