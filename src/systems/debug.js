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
