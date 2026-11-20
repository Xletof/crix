# run-all reruns (B2-R5)

`run-all` on the B2-R5 code (`1a88281`, the deploy commit) scored **48/52** (`../run-all.txt`).

Every failure was re-run standalone, one suite at a time with nothing else running, first on this build and then on the previous build `7e73dae` (B2-R4's deploy). The previous build was served on :5173 from its own worktree, with its own Vite `cacheDir` and its own copies of the tests.

File prefixes:

| Prefix | Build | Notes |
|---|---|---|
| `head-*` | this build | |
| `old-*` | `7e73dae` | |
| `headrep-nemesis-*` | this build | repeated runs |
| `oldrep-nemesis-*` | `7e73dae` | repeated runs |

`status.txt` keeps every run's line.

| Suite | In run-all | Standalone, this build | Standalone, `7e73dae` | Classification |
|---|---|---|---|---|
| vanguard-front | fail (1/30) | pass | not needed | load during run-all (it passed standalone in R2 too) |
| champion-placement | fail (7/60) | fail (7/60) | fail (7/60), the same checks | inherited (register #9) |
| captain-closeout | fail (1/60) | fail, the same check | fail, the same check | inherited (it also fails on `dc7d9ea` in the B0 record) |
| nemesis | fail (VOLATILE, 1/20) | 2 failures in 4 runs | 2 failures in 4 runs, the same check | inherited, intermittent |

None of these suites sets `?b2=`, so no B2 or R5 module is installed during them.

Compared with R4's run-all (46/52): boss-moves, deflect and readability passed this time, and vanguard-front failed under load. Their run-to-run behaviour varies, as recorded in the R2 to R4 reruns.
