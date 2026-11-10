// THE B0 / B1 SCOPE GUARD. Not a test on its own: `smoke-b0` section 6,
// `smoke-b1` and the frozen-file sections of `smoke-fx-p2a`, `-p2a2` and
// `-p2a3` import it.
//
// The instruments and experiments since the HUMAN-APPROVED P2-A3 build
// `dc7d9ea` come in two ranges, each pinned line by line:
//
//   B0  dc7d9ea .. a3866f2  — the opt-in combat-baseline telemetry: the two
//       B0 modules, the flag (debug.js, BootScene) and GameScene's debug
//       attribution tags (`_dmgSrc`, `_hurtBy`, `_shotSrc`) + the install.
//   B1  a3866f2 .. working tree — the HUMAN-authorized opt-in experiments
//       (`?b1=G|M|S`): the new b1Combat.js, the flag (debug.js additions,
//       BootScene's flag line), GameScene's install and ONE branch at the
//       Super-pellet hit, and the B0 telemetry additions (b0Telemetry.js,
//       b0Report.js). No entity, config or data file may change.
//
// The P2-A suites measure their own phase up to `dc7d9ea` and call `b0Scope`
// for everything after it, which checks both ranges.
import { execSync } from 'node:child_process';

export const B0_BASE = 'dc7d9ea';
export const B1_BASE = 'a3866f2';

const diffLines = (root, range, file, sign) => execSync(`git diff -U0 ${range} -- ${file}`, { cwd: root, encoding: 'utf8' })
  .split('\n').filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3))).map((l) => l.slice(1).trim()).filter((l) => l && !l.startsWith('//'));

function b0Range(root) {
  const range = `${B0_BASE} ${B1_BASE}`;
  const ALLOWED = ['src/systems/debug.js', 'src/scenes/BootScene.js', 'src/scenes/GameScene.js', 'src/systems/b0Telemetry.js', 'src/systems/b0Report.js'];
  const files = execSync(`git diff --name-only ${range} -- src/`, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  const extraFiles = files.filter((f) => !ALLOWED.includes(f));
  const gsOk = (l) => /^(this\._(dmgSrc|hurtBy|shotSrc) = |const prevSrc = this\._dmgSrc;|: group === this\.playerFragBullets \? 'cluster' : src;$|import \{ attachB0Telemetry \} from '\.\.\/systems\/b0Telemetry\.js';$|if \(isB0\(\)\) attachB0Telemetry\(this\);$|isEncDebug, getEncForce, isChampDebug, getChampWhich, isCapTel, isB0, isChampPlacementOff, isVanguardScreenOff, isVanguardFrontOff,$)/.test(l);
  const gsAdded = diffLines(root, range, 'src/scenes/GameScene.js', '+');
  const gsRemoved = diffLines(root, range, 'src/scenes/GameScene.js', '-');
  const gsBad = gsAdded.filter((l) => !gsOk(l));
  const gsRemOk = gsRemoved.length === 1 && gsRemoved[0] === 'isEncDebug, getEncForce, isChampDebug, getChampWhich, isCapTel, isChampPlacementOff, isVanguardScreenOff, isVanguardFrontOff,';
  const bsAdded = diffLines(root, range, 'src/scenes/BootScene.js', '+');
  const bsRemoved = diffLines(root, range, 'src/scenes/BootScene.js', '-');
  const bsOk = (l) => /^(setCapTel, setB0, setShowColliders, applyGameplayFlags, applyVisualFlags,$|import \{ b0Store \} from '\.\.\/systems\/b0Report\.js';$|if \(params\.has\('b0'\)\) \{ setB0\(params\.get\('b0'\) \|\| '1'\); b0Store\(\); \}$)/.test(l);
  const bsBad = bsAdded.filter((l) => !bsOk(l));
  const bsRemOk = bsRemoved.length === 1 && bsRemoved[0] === 'setCapTel, setShowColliders, applyGameplayFlags, applyVisualFlags,';
  const dbRemoved = diffLines(root, range, 'src/systems/debug.js', '-');
  const ok = extraFiles.length === 0 && gsBad.length === 0 && gsRemOk && bsBad.length === 0 && bsRemOk && dbRemoved.length === 0;
  return { ok, files, gsAdded: gsAdded.length, bad: { extraFiles, gsBad, gsRemoved, bsBad, bsRemoved, dbRemoved } };
}

export function b1Scope(root = process.cwd() + '/') {
  const range = B1_BASE;
  const ALLOWED = ['src/systems/b1Combat.js', 'src/systems/debug.js', 'src/scenes/BootScene.js', 'src/scenes/GameScene.js', 'src/systems/b0Telemetry.js', 'src/systems/b0Report.js'];
  const files = execSync(`git diff --name-only ${range} -- src/ && git ls-files --others --exclude-standard -- src/`, { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean).sort();
  const extraFiles = files.filter((f) => !ALLOWED.includes(f));
  const gsOk = (l) => /^(import \{ installB1 \} from '\.\.\/systems\/b1Combat\.js';$|if \(getB1Variant\(\)\) installB1\(this\);$|if \(isSuper && this\._b1\?\.superApplies\(e\)\) this\._b1\.superHit\(e, b, kbVec\);$|else e\.damage\(b\.damage, kbVec\);$|isEncDebug, getEncForce, isChampDebug, getChampWhich, isCapTel, isB0, getB1Variant, isChampPlacementOff, isVanguardScreenOff, isVanguardFrontOff,$)/.test(l);
  const gsAdded = diffLines(root, range, 'src/scenes/GameScene.js', '+');
  const gsRemoved = diffLines(root, range, 'src/scenes/GameScene.js', '-');
  const gsBad = gsAdded.filter((l) => !gsOk(l));
  const gsRemOk = gsRemoved.length === 2 && gsRemoved.includes('e.damage(b.damage, kbVec);')
    && gsRemoved.includes('isEncDebug, getEncForce, isChampDebug, getChampWhich, isCapTel, isB0, isChampPlacementOff, isVanguardScreenOff, isVanguardFrontOff,');
  const bsAdded = diffLines(root, range, 'src/scenes/BootScene.js', '+');
  const bsRemoved = diffLines(root, range, 'src/scenes/BootScene.js', '-');
  const bsOk = (l) => /^(setCapTel, setB0, setB1Variant, setShowColliders, applyGameplayFlags, applyVisualFlags,$|import \{ applyB1Tuning \} from '\.\.\/systems\/b1Combat\.js';$|if \(params\.has\('b1'\)\) \{ setB1Variant\(params\.get\('b1'\)\); applyB1Tuning\(\); \}$)/.test(l);
  const bsBad = bsAdded.filter((l) => !bsOk(l));
  const bsRemOk = bsRemoved.length === 1 && bsRemoved[0] === 'setCapTel, setB0, setShowColliders, applyGameplayFlags, applyVisualFlags,';
  const dbRemoved = diffLines(root, range, 'src/systems/debug.js', '-');
  const ok = extraFiles.length === 0 && gsBad.length === 0 && gsRemOk && bsBad.length === 0 && bsRemOk && dbRemoved.length === 0;
  return { ok, files, gsAdded: gsAdded.length, bad: { extraFiles, gsBad, gsRemoved, bsBad, bsRemoved, dbRemoved } };
}

/** Everything under src/ after the P2-A3 build is B0's or B1's, line by line. */
export function b0Scope(root = process.cwd() + '/') {
  const a = b0Range(root), b = b1Scope(root);
  const ok = a.ok && b.ok;
  return {
    ok, files: [...new Set([...a.files, ...b.files])].sort(), gsAdded: a.gsAdded + b.gsAdded,
    detail: ok ? `B0 (${B0_BASE}..${B1_BASE}): ${a.files.length} files, GameScene +${a.gsAdded} tag/install lines; B1 (${B1_BASE}..): ${b.files.length} files, GameScene +${b.gsAdded} install/branch lines`
      : JSON.stringify({ b0: a.ok ? 'ok' : a.bad, b1: b.ok ? 'ok' : b.bad }),
  };
}
