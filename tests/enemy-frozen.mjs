// THE FROZEN-ENEMY GUARD, NARROWED TO ONE AUTHORIZED SEAM. Not a test on its
// own (run-all names its tests explicitly); smoke-bulwark, smoke-roster-2b and
// smoke-demolisher import it.
//
// Until the Phase 2D correction these three suites pinned the WHOLE of
// `src/entities/Enemy.js` to the approved 3ce5680 with a `git diff --stat`.
// The correction was authorized to change exactly one thing in it: the
// Demolisher's (EnemyBomber's) answer to the shared stuck test's first check,
// which always measured 0px moved and armed a 600ms sidestep in open floor.
// So the guard is not removed, it is NARROWED:
//   - everything OUTSIDE `class EnemyBomber` — the Enemy base, Shooter (the
//     Gunner), Grunt (the Rifleman), Shielded (the Bulwark), Sniper (the
//     Marksman), Swarmling — is byte-identical to 3ce5680;
//   - inside `class EnemyBomber`, deleting the authorized veto (its two origin
//     fields, its one call at the top of `_tickSwarm`, and the
//     `_vetoFalseStuck` method) gives back the 3ce5680 class byte for byte;
//   - and the veto's CODE is pinned too, so the seam cannot quietly grow into
//     something it was not authorized to be.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FILE = 'src/entities/Enemy.js';
const REF = '3ce5680';

const ORIGIN = "    // where the shared stuck test's FIRST window begins — see _vetoFalseStuck\n"
  + '    this._stuckOriginX = x;\n'
  + '    this._stuckOriginY = y;\n';
const CALL = '    this._vetoFalseStuck();\n';
const DOC_HEAD = '  /**\n   * THE FIRST STUCK CHECK MEASURES NOTHING';
// the veto's code, comments stripped and whitespace collapsed
const VETO_CODE = '_vetoFalseStuck() { if (this._stuckFirstSeen || this._miniBoss) return; if (this._stuckRefX === undefined) return; this._stuckFirstSeen = true; '
  + 'const moved = Math.hypot(this._stuckRefX - this._stuckOriginX, this._stuckRefY - this._stuckOriginY); '
  + 'if (moved >= 12 && this._stuckSidestepMs > 0) this._stuckSidestepMs = 0; }';

const bomberSplit = (src) => {
  const a = src.indexOf('export class EnemyBomber ');
  const b = src.indexOf('\nexport class ', a + 10);
  return { rest: src.slice(0, a) + src.slice(b), cls: src.slice(a, b) };
};

export function enemyJsGuard(root) {
  const old = execSync(`git show ${REF}:${FILE}`, { cwd: root, encoding: 'utf8' });
  const cur = readFileSync(root + FILE, 'utf8');
  const O = bomberSplit(old), C = bomberSplit(cur);
  const outside = O.rest === C.rest;
  // the veto method: its doc comment, the method, and the blank line after it
  const d = C.cls.indexOf(DOC_HEAD), m = C.cls.indexOf('  _vetoFalseStuck() {');
  const end = m >= 0 ? C.cls.indexOf('\n  }\n', m) + 5 : -1;
  const method = d >= 0 && end > m ? C.cls.slice(m, end) : '';
  const code = method.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
  const once = (s, x) => s.split(x).length === 2;
  let stripped = null;
  if (d >= 0 && end > m && C.cls[end] === '\n' && once(C.cls, ORIGIN) && once(C.cls, CALL)) {
    stripped = (C.cls.slice(0, d) + C.cls.slice(end + 1)).replace(ORIGIN, '').replace(CALL, '');
  }
  return {
    outside,
    bomberOnlyVeto: stripped === O.cls,
    vetoCode: code === VETO_CODE,
    detail: JSON.stringify({ outside, hasDoc: d >= 0, hasMethod: m >= 0, code: code.slice(0, 160) }),
  };
}
