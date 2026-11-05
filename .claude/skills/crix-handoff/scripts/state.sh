#!/usr/bin/env bash
# crix-handoff — verified repository state for a session handover.
# Read-only except `git fetch`. Prints a report and always exits 0; the
# SAFETY line at the end is the verdict the skill acts on.
#
#   bash .claude/skills/crix-handoff/scripts/state.sh [--canonical=<branch>]
#
# The canonical dev branch defaults to the one named on a "canonical" line of
# the newest docs/handover/ file in HEAD; pass --canonical to override.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "SAFETY: UNSAFE — not inside a git repository"; exit 0; }

CANON=""
for a in "$@"; do case "$a" in --canonical=*) CANON="${a#*=}";; esac; done
DIR=docs/handover
PREFIX=CRIX-SESSION-HANDOVER
UNSAFE=()
WARN=()

latest_in() { git ls-tree --name-only "$1" "$DIR/" 2>/dev/null | grep "/$PREFIX-" | sort -V | tail -1; }

if [ -z "$CANON" ]; then
  L=$(latest_in HEAD)
  [ -n "$L" ] && CANON=$(git show "HEAD:$L" | grep -i 'canonical' | grep -o '`claude/[A-Za-z0-9._/-]*`' | head -1 | tr -d '`')
  CANON_SRC="${L:-none}"
else
  CANON_SRC="--canonical"
fi

BR=$(git symbolic-ref --quiet --short HEAD || echo "")
[ -z "$BR" ] && UNSAFE+=("detached HEAD")

# fetch with the project's retry policy (2s, 4s, 8s, 16s)
FETCHED=no
for d in 0 2 4 8 16; do
  sleep "$d"
  if git fetch --quiet origin 2>/dev/null; then FETCHED=yes; break; fi
done
[ "$FETCHED" = no ] && WARN+=("git fetch failed after 5 attempts — remote refs below may be stale")

echo "== crix-handoff state  $(date -u +%FT%TZ)"
echo "fetch:      $FETCHED"
echo "branch:     ${BR:-<detached>}"
echo "HEAD:       $(git rev-parse --short HEAD)  $(git log -1 --format=%s)"

if [ -n "$BR" ] && git rev-parse --quiet --verify "origin/$BR" >/dev/null; then
  read -r BEHIND AHEAD < <(git rev-list --left-right --count "origin/$BR...HEAD")
  echo "upstream:   origin/$BR  ahead $AHEAD  behind $BEHIND"
  [ "$BEHIND" != 0 ] && UNSAFE+=("HEAD is behind origin/$BR by $BEHIND commit(s) — someone else pushed; reconcile first")
  [ "$AHEAD" != 0 ] && WARN+=("$AHEAD local commit(s) not pushed to origin/$BR")
else
  echo "upstream:   none (origin/$BR does not exist yet)"
fi

# operations in progress / conflicts
G=$(git rev-parse --git-dir)
for f in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD BISECT_LOG; do [ -e "$G/$f" ] && UNSAFE+=("$f present — an operation is in progress"); done
[ -d "$G/rebase-merge" ] || [ -d "$G/rebase-apply" ] && UNSAFE+=("rebase in progress")
UNMERGED=$(git diff --name-only --diff-filter=U)
[ -n "$UNMERGED" ] && UNSAFE+=("unmerged paths: $(echo $UNMERGED)")

echo
echo "== refs (origin)"
for R in FRIX ${CANON:+"$CANON"}; do
  if ! git rev-parse --quiet --verify "origin/$R" >/dev/null; then echo "$R: missing on origin"; UNSAFE+=("origin/$R missing"); continue; fi
  S=$(git rev-parse --short "origin/$R")
  if git merge-base --is-ancestor "origin/$R" HEAD; then REL="ancestor of HEAD ($(git rev-list --count "origin/$R..HEAD") behind HEAD)"
  elif git merge-base --is-ancestor HEAD "origin/$R"; then REL="AHEAD of HEAD by $(git rev-list --count "HEAD..origin/$R") — pull it in before writing"; UNSAFE+=("origin/$R is ahead of HEAD")
  else REL="DIVERGED from HEAD"; UNSAFE+=("origin/$R diverged from HEAD")
  fi
  echo "$R: $S  $(git log -1 --format='%ad %s' --date=short "origin/$R")  — $REL"
done
echo "canonical:  ${CANON:-UNKNOWN} (source: $CANON_SRC)"
[ -z "$CANON" ] && WARN+=("canonical dev branch unknown — find it in HANDOVER.md §0 / the newest handover, or pass --canonical")

# what the live build lacks: deployable paths only (src, index.html, public, build config)
if git rev-parse --quiet --verify origin/FRIX >/dev/null; then
  UNDEPLOYED=$(git diff --stat origin/FRIX HEAD -- src index.html public package.json package-lock.json vite.config.js .github | tail -1)
  echo "undeployed build inputs (origin/FRIX..HEAD): ${UNDEPLOYED:-none}"
  [ -n "$UNDEPLOYED" ] && WARN+=("HEAD has build inputs that are not on FRIX — the live game is NOT HEAD")
fi

echo
echo "== working tree"
ST=$(git status --short)
echo "${ST:-clean}"
[ -n "$ST" ] && WARN+=("uncommitted changes — list them in the handover; never discard them")
STASH=$(git stash list)
[ -n "$STASH" ] && { echo "stashes:"; echo "$STASH"; WARN+=("stash entries exist"); }
WT=$(git worktree list | tail -n +2)
[ -n "$WT" ] && { echo "extra worktrees:"; echo "$WT"; WARN+=("extra worktrees exist"); }

echo
echo "== recent commits (HEAD)"
git log --format='%h %ad %s' --date=short -8

echo
echo "== handovers"
for R in HEAD ${CANON:+"origin/$CANON"} origin/FRIX; do echo "$R: $(latest_in "$R" | sed "s#$DIR/##")"; done
TODAY=$(date -u +%F)
N="$DIR/$PREFIX-$TODAY.md"; i=2
taken() { [ -e "$1" ] && return 0; for R in HEAD ${CANON:+"origin/$CANON"} origin/FRIX; do git cat-file -e "$R:$1" 2>/dev/null && return 0; done; return 1; }
while taken "$N"; do N="$DIR/$PREFIX-$TODAY-$i.md"; i=$((i+1)); done
echo "next free:  $N"

echo
for w in "${WARN[@]}"; do echo "WARN: $w"; done
if [ ${#UNSAFE[@]} -eq 0 ]; then echo "SAFETY: SAFE"
else for u in "${UNSAFE[@]}"; do echo "UNSAFE: $u"; done; echo "SAFETY: UNSAFE — report, do not commit or push"; fi
exit 0
