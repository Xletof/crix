---
name: crix-handoff
description: Close a CRIX / FRIX development session with a verified, Git-backed handover in docs/handover/ and a ready-to-paste bootstrap for the next session. Manual only — run when the HUMAN ends a session.
argument-hint: "[next milestone or session focus]"
disable-model-invocation: true
allowed-tools: Bash(bash ${CLAUDE_SKILL_DIR}/scripts/state.sh*) Bash(git status*) Bash(git log*) Bash(git show*) Bash(git diff*) Bash(git rev-parse*) Bash(git merge-base*) Bash(git cat-file*) Bash(git ls-tree*) Bash(git fetch*)
---

# CRIX session handoff

Close this session so a fresh agent can resume from Git alone. You write a
record of what is true; you do not start, plan in detail or recommend-and-begin
the next milestone.

**Next focus named by the HUMAN:** $ARGUMENTS
(empty = none named; write "none named" and leave scope to the HUMAN.)

## Rules

1. **Git is the fact.** Memory, compaction summaries and old documents are
   leads. Every SHA, branch, path and Pages result you write is verified in
   this run, or marked unverified with the reason.
2. **Approval comes only from the HUMAN's own words.** Classify every item with
   the status vocabulary in [template.md](template.md). Passing tests,
   successful deploys and your own judgement never move an item above
   VALIDATED. A candidate without a verdict is AWAITING HUMAN. Naming a focus
   in this command does not authorize its scope: record scope as AUTHORIZED
   NEXT only where the HUMAN stated it, quoted.
3. **Reference, don't copy.** `HANDOVER.md` §0 owns status, `docs/engineering/`
   owns invariants, evidence READMEs own results, `tests/README.md` owns the
   harness, `CLAUDE.md` owns the rules. Link path + commit; no code, no logs,
   no chronology, no project summary. 1–2 pages.
4. **Git safety.** Stage only the files this skill writes, by explicit path.
   Never discard, stash, reset, rebase, amend or reformat other work; never
   force-push; never move `FRIX`; never touch `src/`, flags or defaults. This
   invocation authorizes only these documentation edits and their commit.
5. **Redact** tokens, keys, passwords and personal data.
6. **No subagents, no mid-run questions.** What you cannot establish goes in
   the handover as unknown or as an open HUMAN question.
7. **Do not re-run test suites.** Cite the last recorded result and the commit
   it ran on (evidence folders, §0).

## Steps

1. **Verify state.** Run `bash ${CLAUDE_SKILL_DIR}/scripts/state.sh` (add
   `--canonical=<branch>` if it reports the canonical branch as unknown). It
   fetches, checks ancestry of `FRIX` and the canonical dev branch, the
   working tree, operations in progress and the next free handover filename.
   - `SAFETY: UNSAFE` → write and commit nothing. Report the UNSAFE lines, the
     state, and a bootstrap that tells the next session to resolve them
     first. Stop.
   - Check the Pages deploy of `origin/FRIX`'s head with the GitHub tools you
     have (workflow `deploy.yml`, branch `FRIX`): run number and conclusion
     for that SHA, or "unverified" with the reason.
2. **Collect decisions and facts.**
   - This conversation's HUMAN messages: verdicts, authorizations,
     prohibitions, with their dates. Quote short and verbatim. Treat a
     compaction summary as a lead and confirm it against §0 or the commits.
   - `HANDOVER.md` §0 CURRENT STATUS and UNRESOLVED-WORK REGISTER: grep the
     headings for line numbers and read only those ranges (the file is
     ~600 KB).
   - The newest file in `docs/handover/`, and `git log --oneline <its
     commit>..HEAD` for what this session added.
   - For the next focus: grep §0, the register and `docs/evidence/` for its
     name or subject to find the 2–4 entry points the next agent needs.
3. **Reconcile §0.** If this session changed status (a HUMAN verdict, a
   delivered candidate, a new defect) and §0 does not say so, edit the
   matching CURRENT STATUS bullet or register row in place: minimal, dated,
   nothing else rewritten. Point §0's "Fresh session?" line at the new
   handover. If §0 is already accurate, leave it.
4. **Write the handover** at the script's `next free` path, following
   [template.md](template.md). Earlier handovers are never edited.
5. **Check before committing.**
   - each SHA resolves (`git cat-file -e <sha>^{commit}`); each repo path
     exists; each URL's flag exists in `src/systems/debug.js`;
   - each APPROVED / FROZEN / ACCEPTED / AUTHORIZED label has a HUMAN quote or
     a §0 citation; nothing reads as approved because it passed or deployed;
   - nothing copied that a linked file already holds; about 120 lines at most;
   - `git status --short` shows only the handover (and `HANDOVER.md` if
     edited) as your changes; other dirty files are listed in the handover,
     untouched.
6. **Commit and sync.**
   - `git add <handover> [HANDOVER.md]`; commit
     `docs: session handover — <milestone closed>; next: <focus>` with the
     attribution lines the session requires.
   - `git push -u origin <session branch>`; on a network error retry after
     2, 4, 8 and 16 s.
   - Canonical dev branch: if `origin/<canonical>` is an ancestor of HEAD,
     fast-forward it with `git push origin HEAD:<canonical>`. Otherwise leave
     it and say where the handover lives.
   - `FRIX`: do not move it. If the script found no undeployed build inputs,
     `FRIX` lacks documentation only — say so. If it found some, say the live
     game is not HEAD; deploying is outside this handoff.
7. **Report, then STOP.** In this order:
   - **Handover:** path, branch(es) it is on.
   - **Commit:** SHA and where it was pushed.
   - **Git:** HEAD, canonical, `FRIX`, Pages run; working tree.
   - **Blockers:** open HUMAN questions, unsafe state, unverified items.
   - **Bootstrap:** the handover's bootstrap block, verbatim, in a `text` fence.

   Then end the turn. Do not begin, scaffold or offer to begin the next
   milestone. Stop background jobs you started; name any survivor.
