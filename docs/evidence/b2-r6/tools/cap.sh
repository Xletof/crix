#!/bin/bash
# R6 captures through the R5 film rig: name|flags|scenario|ticks|extra (one at a time)
cd /tmp/claude-0/-home-user-crix/ba42f3b2-6497-510c-b515-9798bd1bce79/scratchpad/r6
B='b2=B&b2c=1&b2r=4&b2iso=1'
while IFS='|' read -r name flags scn ticks extra; do
  [ -z "$name" ] && continue
  [ -f F/$name/log.json ] && { echo "skip $name"; continue; }
  rm -rf F/$name; timeout 2400 node ../r5/r5film.mjs F/$name "$B&$flags" $scn $ticks $extra > F/$name.log 2>&1; echo "$name exit $?"
done < "$1"
echo CAP-DONE
