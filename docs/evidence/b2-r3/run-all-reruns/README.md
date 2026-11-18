# run-all reruns (B2-R3)

`run-all` on the B2-R3 code: 42/52 (`../run-all.txt`). Every failure was re-run
standalone, one suite at a time with nothing else running. File prefixes:

- `head-*`, `headrep-*` — this build, served from the main checkout;
- `wthead-*`, `wthead2-*` — this build (same commit), served from a fresh worktree;
- `old-*`, `oldrep-*`, `old2-*`, `old3-*` — the previous build `40adb64` (B2-R2's
  deploy), served from its worktree with its own tests.

Repeated runs of one suite under the same prefix overwrite its file; `status.txt`
keeps every run's line.

| Suite | This build | 40adb64 | Classification |
|---|---|---|---|
| captain-rifle, deflect, vader | pass standalone | — | load during run-all |
| boss-moves | fail 5/5 | fail 5 of 8 (same three checks) | inherited, intermittent |
| flight | fail 5 of 9 (worktree), 3/3 (main checkout) | fail 4 of 10 | inherited, intermittent |
| champion | crash (`_castChampionMove` refuses; `h.phase` of null) | same crash | inherited |
| champion-placement | fail | fail | inherited (register #9) |
| captel | fail (same 2 checks) | fail | inherited |
| captain-visual | fail (same check) | fail | inherited |
| pathing | fail | fail | inherited |

None of these suites sets `?b2=`; without it no B2 module is installed, and the
modules changed since `40adb64` have no top-level side effects. `champion`,
`captel` and `captain-visual` passed in B2-R2's run-all on 2026-11-17 and fail
today on both builds: something in the environment changed; not investigated.
