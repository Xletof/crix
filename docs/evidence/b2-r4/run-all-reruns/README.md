# run-all reruns (B2-R4)

`run-all` on the B2-R4 code (`7367198`, the deploy commit) scored **46/52** (`../run-all.txt`).

Every failure was re-run standalone, one suite at a time with nothing else running, first on this build and then on the previous build `bfa765f` (B2-R3's deploy). The previous build was served on :5173 from its own worktree, with its own Vite `cacheDir`, and its own copies of the tests.

File prefixes:

| Prefix | Build | Notes |
|---|---|---|
| `head-*` | this build | the main checkout |
| `old-*` | `bfa765f` | |
| `oldrep-readability-*` | `bfa765f` | repeated `readability` runs |
| `headrep-readability-*` | this build | repeated `readability` runs |

`status.txt` keeps every run's line.

| Suite | In run-all | Standalone, this build | Standalone, `bfa765f` | Classification |
|---|---|---|---|---|
| boss-moves | fail (2/18) | pass | not needed | intermittent; also inherited (it fails on `d722707` and `40adb64` in the R2 and R3 records) |
| nemesis | fail (VOLATILE, 1/20) | pass | not needed | intermittent; also inherited (the VOLATILE check fails 2 runs in 4 on `dc7d9ea`, from the B0 record) |
| champion-placement | fail (6/60) | fail (6/60) | fail (7/60) | inherited (register #9) |
| captain-closeout | fail (1/60: "never entered the punctuation queue") | fail (1/60: "a damage tick makes the source react") | fail, the same check as this build | inherited (it also fails on `dc7d9ea` in the B0 record). In run-all it failed on a different check. |
| deflect | fail (1/73) | fail (2/73) | fail, the same two checks | inherited. It passed standalone in R2 and R3 and fails today on both builds. |
| readability | fail (1/19: "he is PLANTED through his wind-up") | 1 failure in 4 runs | 1 failure in 4 runs, the same check | inherited, intermittent |

None of these suites sets `?b2=`. Without it no B2 module is installed, so no B2-R4 code runs: all of it sits behind `&b2r=4`, `&b2a=B2S` or `&b2iso=1`.

`deflect` now fails standalone on both builds, where it passed in R3's reruns. Likewise `champion`, `captel` and `captain-visual` failed on both builds in R3's run and pass in this one. Something outside the code under test changes between days; it was not investigated.
