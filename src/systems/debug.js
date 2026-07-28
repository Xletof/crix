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
