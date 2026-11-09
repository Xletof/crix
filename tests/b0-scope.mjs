// THE B0 SCOPE GUARD. Not a test on its own: `smoke-b0` section 6 and the
// frozen-file sections of `smoke-fx-p2a`, `smoke-fx-p2a2` and `smoke-fx-p2a3`
// import it.
//
// B0 (the opt-in combat-baseline telemetry, `?b0=`) is the first change on top
// of `dc7d9ea`, the HUMAN-APPROVED P2-A3 build. Those three suites pin their
// own phase's scope against their own base revision; since B0 they measure
// that scope from their base UP TO `dc7d9ea` (the phase is unchanged there),
// and this guard proves that everything after `dc7d9ea` under `src/` is B0's
// and only B0's:
//   - the files: the two new modules, debug.js (the flag), BootScene.js (flag
//     parsing + the controller) and GameScene.js (debug tags + the install);
//   - GameScene.js: every added code line is an attribution tag (`_dmgSrc`,
//     `_hurtBy`, `_shotSrc`), the install, or its import; the one removed line
//     is the import list the flag getter joined;
//   - BootScene.js: the import list, the controller import and the flag line.
import { execSync } from 'node:child_process';

export const B0_BASE = 'dc7d9ea';
const ALLOWED = ['src/systems/debug.js', 'src/scenes/BootScene.js', 'src/scenes/GameScene.js', 'src/systems/b0Telemetry.js', 'src/systems/b0Report.js'];

const lines = (root, file, sign) => execSync(`git diff -U0 ${B0_BASE} -- ${file}`, { cwd: root, encoding: 'utf8' })
  .split('\n').filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3))).map((l) => l.slice(1).trim()).filter((l) => l && !l.startsWith('//'));

export function b0Scope(root = process.cwd() + '/') {
  const files = execSync(`git diff --name-only ${B0_BASE} -- src/ && git ls-files --others --exclude-standard -- src/`, { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort();
  const extraFiles = files.filter((f) => !ALLOWED.includes(f));
  const gsOk = (l) => /^(this\._(dmgSrc|hurtBy|shotSrc) = |const prevSrc = this\._dmgSrc;|: group === this\.playerFragBullets \? 'cluster' : src;$|import \{ attachB0Telemetry \} from '\.\.\/systems\/b0Telemetry\.js';$|if \(isB0\(\)\) attachB0Telemetry\(this\);$|isEncDebug, getEncForce, isChampDebug, getChampWhich, isCapTel, isB0, isChampPlacementOff, isVanguardScreenOff, isVanguardFrontOff,$)/.test(l);
  const gsAdded = lines(root, 'src/scenes/GameScene.js', '+');
  const gsRemoved = lines(root, 'src/scenes/GameScene.js', '-');
  const gsBad = gsAdded.filter((l) => !gsOk(l));
  const gsRemOk = gsRemoved.length === 1 && gsRemoved[0] === 'isEncDebug, getEncForce, isChampDebug, getChampWhich, isCapTel, isChampPlacementOff, isVanguardScreenOff, isVanguardFrontOff,';
  const bsAdded = lines(root, 'src/scenes/BootScene.js', '+');
  const bsRemoved = lines(root, 'src/scenes/BootScene.js', '-');
  const bsOk = (l) => /^(setCapTel, setB0, setShowColliders, applyGameplayFlags, applyVisualFlags,$|import \{ b0Store \} from '\.\.\/systems\/b0Report\.js';$|if \(params\.has\('b0'\)\) \{ setB0\(params\.get\('b0'\) \|\| '1'\); b0Store\(\); \}$)/.test(l);
  const bsBad = bsAdded.filter((l) => !bsOk(l));
  const bsRemOk = bsRemoved.length === 1 && bsRemoved[0] === 'setCapTel, setShowColliders, applyGameplayFlags, applyVisualFlags,';
  // debug.js: additions only (the flag block), nothing removed
  const dbRemoved = lines(root, 'src/systems/debug.js', '-');
  const ok = extraFiles.length === 0 && gsBad.length === 0 && gsRemOk && bsBad.length === 0 && bsRemOk && dbRemoved.length === 0;
  return {
    ok, files, gsAdded: gsAdded.length,
    detail: ok ? `${files.length} files; GameScene +${gsAdded.length} tag/install lines`
      : JSON.stringify({ extraFiles, gsBad, gsRemoved, bsBad, bsRemoved, dbRemoved }),
  };
}
