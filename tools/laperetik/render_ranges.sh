#!/bin/bash
# Renders frame ranges one after the other (each run reloads the latest scene code).
# Usage: tools/laperetik/render_ranges.sh <outDir> start:end [start:end ...]
out=$1; shift
for r in "$@"; do
  a=${r%%:*}; b=${r##*:}
  echo "=== range $a-$b $(date +%H:%M:%S)"
  node "$(dirname "$0")/render.js" frames "$out" "$a" "$b" 2>&1 | grep -v "GPU stall"
done
echo "=== done $(date +%H:%M:%S)"
