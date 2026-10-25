#!/bin/sh
# Usage: ./check.sh            full build to index.html + syntax check + smoke test of every view
#        GP_ONLY=30,31 ./check.sh   check only the core plus your own modules, in a private temp file
set -e
cd "$(dirname "$0")"
if [ -n "$GP_ONLY" ]; then OUT=$(mktemp /tmp/gp-XXXXXX.html); export GP_OUT="$OUT"; else OUT="$PWD/index.html"; fi
node build.js
JS=$(mktemp /tmp/gp-XXXXXX.js)
node -e 'const fs=require("fs");const h=fs.readFileSync(process.argv[1],"utf8");fs.writeFileSync(process.argv[2],h.slice(h.indexOf("<script>")+8,h.lastIndexOf("</script>")));' "$OUT" "$JS"
node --check "$JS"
node smoke.js "$OUT"
