#!/usr/bin/env bash
# stamp-cache.sh — cache-bust app.js and styles.css in index.html.
#
# Rewrites the <link>/<script> references in index.html to
#   styles.css?v=<hash>   and   app.js?v=<hash>
# where <hash> is the first 8 hex chars of each file's SHA-1. Because the
# URL changes whenever the file's contents change (and ONLY then), browsers
# and the GitHub Pages / Fastly CDN are forced to refetch after a real
# deploy, while unchanged deploys stay fully cached.
#
# Idempotent: re-running replaces any existing ?v=... stamp.
#
# Usage:
#   ./stamp-cache.sh [target-dir]
# target-dir defaults to the directory this script lives in. Pass the deploy
# folder (…/sea-monkey-experience/recital-programs) to stamp that copy too.

set -euo pipefail

dir="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
html="$dir/index.html"

for f in "$html" "$dir/app.js" "$dir/styles.css"; do
  [ -f "$f" ] || { echo "error: missing $f" >&2; exit 1; }
done

hash_of() { shasum "$1" | cut -c1-8; }

css_hash=$(hash_of "$dir/styles.css")
js_hash=$(hash_of "$dir/app.js")

# macOS/BSD sed (-i '') — replace the asset URL whether or not it already
# carries a ?v=... stamp.
sed -E -i '' \
  -e "s#(href=\")styles\.css(\?v=[a-f0-9]+)?(\")#\1styles.css?v=${css_hash}\3#g" \
  -e "s#(src=\")app\.js(\?v=[a-f0-9]+)?(\")#\1app.js?v=${js_hash}\3#g" \
  "$html"

echo "stamped $html"
echo "  styles.css?v=${css_hash}"
echo "  app.js?v=${js_hash}"
