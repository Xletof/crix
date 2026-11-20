# run-all reruns (B2-R6)

`run-all` on the B2-R6 code (`894b209`) scored **47/52** (`../run-all.txt`). The failures were:
`boss-moves`, `champion-placement`, `vanguard-front`, `captain-closeout` and `pathing`. `nemesis`,
which failed intermittently in the R5 baseline, passed.

Every failure was re-run standalone, one suite at a time with nothing else running. Each ran first on
this build. Those that still failed then ran on the previous build `d3ecad6` (B2-R5 final, Pages #313),
served on :5173 from its own worktree, with its own Vite `cacheDir` and its own copies of the tests.

| Suite | In run-all | Standalone, this build | Standalone, `d3ecad6` | Classification |
|---|---|---|---|---|
| boss-moves | fail (1/18: "and costs them a dash charge") | pass (18/18) | not needed | intermittent; also inherited (it failed in run-all in the R2–R4 records and passed standalone) |
| pathing | fail ("efficiency 1.01 exceeds 1.0 — the sampler is dropping movement") | pass | not needed | a harness load artefact: the suite's own message says the sampler dropped movement |
| champion-placement | fail (7/60) | fail (7/60) | fail (7/60), the same seven checks | inherited (register #9; also in the R5 baseline) |
| vanguard-front | fail (1/30: "the opening lanes SEPARATE the pair at the close hold") | fail, the same check | fail, the same check | inherited. It passed standalone in R5's reruns and fails today on both builds. |
| captain-closeout | fail (1/60: "a damage tick makes the source react") | fail, the same check | fail, the same check | inherited (in the R5 baseline and the B0 record) |

`status.txt` keeps every run's line; `head-*` are this build, `old-*` are `d3ecad6`.

None of these suites sets `?b2=`, so no B2 module is installed and none of B2-R6's code runs in them
beyond a module import (`b2Thunder.js` defines functions and constants only). Against the R5 baseline,
the four suites it named (`champion-placement`, `vanguard-front`, `captain-closeout`, `nemesis`) are
three inherited failures plus `nemesis` passing this time. The other two failures (`boss-moves`,
`pathing`) pass standalone. **No new failure.**

`vanguard-front` passing standalone in R5 and failing on both builds today repeats what B2-R4's record
found for other suites: something outside the code under test changes between days. It was not
investigated (out of scope for an audio task).
