# Handover template

Fill every section; write "none" where nothing applies. Delete these guidance
lines and every `<...>` placeholder. Target 1–2 pages (about 120 lines at
most): link paths and commits instead of copying text from them.

## Status vocabulary — use exactly these labels

| label | meaning | needs |
|---|---|---|
| **HUMAN-APPROVED / FROZEN 🔒** | handset verdict approved it; closed to change | HUMAN words, or the §0 line that records them |
| **HUMAN-ACCEPTED — NOT FROZEN** | HUMAN accepted a direction or parts of it; may still change | HUMAN words, quoted |
| **CANDIDATE — AWAITING HUMAN** | delivered and deployed, verdict not given | a deployed flag/URL |
| **VALIDATED — NOT APPROVED** | tests, metrics or evidence pass; no verdict | the suite, its count and the commit it ran on |
| **IMPLEMENTED — NOT VALIDATED** | in Git, not yet proven | the commit |
| **AGENT-RECOMMENDED** | the agent's proposal only | — |
| **AUTHORIZED NEXT** | the HUMAN authorized it for the next session | HUMAN words, quoted |
| **DEFERRED** | known, not scheduled (register # if any) | — |
| **NOT AUTHORIZED** | must not be started without a new HUMAN instruction | — |

Tests passing, a successful deploy or the agent's opinion never move an item
above VALIDATED. A focus named in `/crix-handoff <focus>` is the next session's
*focus*; it is AUTHORIZED NEXT only for the scope the HUMAN actually stated.

---

````markdown
# CRIX / FRIX — session handover, <YYYY-MM-DD>

Closes <the session's milestone, one line>. Next focus: **<focus, or "none named">**.
`HANDOVER.md` §0 stays the single source of truth for status; this file records
the closure and the next session's boundaries. Trust `git` over any hash here.

## 1. Repository state (verified <UTC timestamp>)

| ref | commit | note |
|---|---|---|
| session branch `<branch>` | `<sha>` | this handover's commit follows it |
| canonical dev `<canonical>` | `<sha>` | <fast-forwarded / unchanged — why> |
| `FRIX` (Pages, live build) | `<sha>` | Pages run #<n> <result> / unverified: <why> |

Undeployed build inputs on HEAD: <none / list>. Uncommitted work: <none / see §7>.

## 2. Completed this session

- <milestone> — <status label> — commits `<sha>`…`<sha>` — evidence `<path>`.

## 3. Latest HUMAN decisions

> "<verbatim, short>" — <date> — <what it settled>

Older verdicts: §0 and `<previous handover path>`.

## 4. Boundaries

| item | flag / where | status | authority |
|---|---|---|---|
| <item the next focus touches or this session changed> | `<flag>` / `<path>` | <label> | <"quote", date / §0 line / none> |

Everything frozen in `CLAUDE.md` "Human gates" and §0 stays frozen; list here
only what the next session could plausibly touch.

## 5. Play it

- R1 (production, no flags): https://xletof.github.io/crix/
- <candidate>: <URL>

## 6. Defects and blockers

- <register #n — one line> / <new: one line, where it is recorded>

## 7. Next session — <focus>

- **Authorized scope:** <the HUMAN's words, quoted> — or: *not yet stated; the
  HUMAN's brief at session start defines it. Do not infer it from this file.*
- **Open HUMAN questions:** <e.g. a candidate awaiting its verdict> / none.
- **Read first, in order:** this file; `HANDOVER.md` §0 CURRENT STATUS and
  register; <2–4 exact paths: engineering doc, evidence README, test rig>.
- **Guarding tests:** `<tests/...mjs>` — last result <n/m> at `<sha>`.
- **Suggested skills:** <`/skill` — why> / none.
- **NOT authorized:** <specific items near the focus>; plus every frozen system,
  flipping any default, force-pushing or moving `FRIX` without a finished change.
- **Unfinished / uncommitted work:** <path — state — what to do with it> / none.

## Bootstrap — paste into a new Claude Code session

```text
You are continuing CRIX / FRIX (repo Xletof/crix; canonical dev branch
<canonical>; Pages deploys only from FRIX → https://xletof.github.io/crix/).

1. git fetch origin <canonical> FRIX. Your branch must contain
   origin/<canonical> (<sha> or later): if `git merge-base --is-ancestor
   origin/<canonical> HEAD` fails, run `git merge --ff-only origin/<canonical>`;
   if that fails, stop and ask me.
2. Read docs/handover/<file>, then the CURRENT STATUS block and the
   UNRESOLVED-WORK REGISTER of HANDOVER.md §0 (grep the headings; do not read
   the whole file). CLAUDE.md loads automatically.
3. Next focus: <focus>. Authorized scope: <quoted, or "none yet — wait for my brief">.
4. Hold: <the 2–4 boundaries most at risk in this focus>.

If this message carries no task brief, summarize the refs, the frozen
boundaries, the open candidates and the next focus, then STOP.
```
````
