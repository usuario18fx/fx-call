#!/usr/bin/env bash
set -Eeuo pipefail
cd /app || exit 1
echo "=== FX CALL NOVA V7 / MOBILE UI REFINEMENT ==="

BRANCH="feature/fxcall-general-room-20261127"
BASE_HTML="8a6c4e086b6fbcb5829be8923477cc51c02e3e51"
HTML="frontend/public/nova-studio.html"
API="backend/server.py"
WEB="frontend/app/(tabs)/studio.web.tsx"
NATIVE="frontend/app/(tabs)/studio.tsx"

for path in "$HTML" "$API" "$WEB" "$NATIVE"; do
  if [[ ! -f "$path" ]]; then
    echo "STOPPED: missing $path — nothing changed"
    exit 1
  fi
done
if [[ ! -x frontend/node_modules/.bin/tsc ]]; then
  echo "STOPPED: TypeScript compiler missing"
  exit 1
fi

git fetch origin "$BRANCH"
git cat-file -e "$BASE_HTML" || { echo "STOPPED: V6 base HTML unavailable, preserving your local files"; exit 1; }
STAGE="$(mktemp -d /tmp/fxcall-v7-XXXXXX)"
SNAP="/app/FXCALL-V7-BEFORE-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SNAP"

for path in "$HTML" "$API" "$WEB" "$NATIVE"; do
  mkdir -p "$SNAP/$(dirname "$path")" "$STAGE/$(dirname "$path")"
  cp -p "$path" "$SNAP/$path"
done
echo "BACKUP: $SNAP"

git show "FETCH_HEAD:$HTML" > "$STAGE/new-html"
git cat-file blob "$BASE_HTML" > "$STAGE/base-html"
if cmp -s "$HTML" "$STAGE/base-html"; then
  cp "$STAGE/new-html" "$STAGE/$HTML"
  echo "HTML: clean V7 upgrade"
elif cmp -s "$HTML" "$STAGE/new-html"; then
  cp -p "$HTML" "$STAGE/$HTML"
  echo "HTML: already V7"
elif git merge-file -p "$HTML" "$STAGE/base-html" "$STAGE/new-html" > "$STAGE/merged-html"; then
  cp "$STAGE/merged-html" "$STAGE/$HTML"
  echo "HTML: local edits preserved through 3-way merge"
else
  echo "STOPPED: conflicting custom HTML changes; nothing overwritten"
  echo "Original HTML remains in $SNAP"
  exit 1
fi

cp "$API" "$STAGE/$API"
cp "$WEB" "$STAGE/$WEB"
cp "$NATIVE" "$STAGE/$NATIVE"

python3 - "$STAGE" <<'PY'
from pathlib import Path
import re
import sys

stage = Path(sys.argv[1])
api = stage / "backend/server.py"
s = api.read_text()
route = 'if request.url.path == "/api/studio/nova.html":'
end_marker = '    elif IS_PROD:'
if s.count(route) != 1 or s.count(end_marker) != 1:
    raise RuntimeError("Backend CSP route structure changed; stop safely")
start = s.index(route)
end = s.index(end_marker, start)
block = s[start:end]
if 'response.headers["X-Frame-Options"] = "SAMEORIGIN"' not in block:
    marker = '        response.headers["Content-Security-Policy"] = ('
    if block.count(marker) != 1:
        raise RuntimeError("Unexpected backend CSP structure")
    block = block.replace(marker, '        response.headers["X-Frame-Options"] = "SAMEORIGIN"\n' + marker)
block = block.replace("frame-ancestors 'none'", "frame-ancestors 'self'")
if "frame-ancestors 'self'" not in block:
    raise RuntimeError("Could not enable same-origin iframe")
api.write_text(s[:start] + block + s[end:])

for filename in ("studio.web.tsx", "studio.tsx"):
    p = stage / "frontend/app/(tabs)" / filename
    body = p.read_text()
    if filename == "studio.web.tsx":
        body = body.replace('src="/nova-studio.html?', 'src="/api/studio/nova.html?')
        if 'src="/api/studio/nova.html?' not in body:
            raise RuntimeError("Web Studio backend iframe path missing")
    body, count = re.subn(
        r'fxbuild=(?:general-room|novastudio)-v[0-9]+-20261127',
        'fxbuild=novastudio-v7-20261127',
        body
    )
    if count != 1:
        raise RuntimeError(f"Unexpected Studio build markers in {filename}: {count}")
    p.write_text(body)

html = (stage / "frontend/public/nova-studio.html").read_text()
required = [
    '/* FX NOVA V7',
    'data-mode="live"', 'data-mode="private"', 'data-mode="general"',
    'grid-template-columns: repeat(3, minmax(0, 1fr))',
    '<h2>Studio Controls</h2>',
]
missing = [marker for marker in required if marker not in html]
if missing:
    raise RuntimeError("Missing NOVA V7 markers: " + repr(missing))
print("V7 HTML, WEB/NATIVE ROUTES, AND CSP VALIDATED")
PY

restore() {
  trap - ERR
  set +e
  echo "CHECK FAILED — RESTORING V7 BACKUP"
  for path in "$HTML" "$API" "$WEB" "$NATIVE"; do
    cp -p "$SNAP/$path" "$path"
  done
  supervisorctl restart backend >/dev/null 2>&1 || true
  echo "RESTORE COMPLETE: $SNAP"
  exit 1
}
trap restore ERR

for path in "$HTML" "$API" "$WEB" "$NATIVE"; do
  cp "$STAGE/$path" "$path"
done

node <<'NODE'
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync("frontend/public/nova-studio.html", "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if (scripts.length < 3) throw new Error("Missing NOVA scripts");
scripts.forEach((m, i) => new vm.Script(m[1], {filename: "nova-"+i+".js"}));
console.log("JAVASCRIPT PASS");
NODE

(cd frontend && ./node_modules/.bin/tsc --noEmit)
echo "TYPESCRIPT PASS"
python3 -m py_compile backend/server.py
echo "BACKEND PYTHON PASS"

echo "RESTARTING BACKEND ONLY (EXPO REMAINS RUNNING)..."
supervisorctl restart backend
supervisorctl status backend expo

URL="$(node <<'NODE'
const fs=require('fs');
let url=process.env.EXPO_PUBLIC_BACKEND_URL||'';
for(const f of ['frontend/.env.local','frontend/.env','.env']){
 if(url||!fs.existsSync(f))continue;
 const m=fs.readFileSync(f,'utf8').match(/^EXPO_PUBLIC_BACKEND_URL\s*=\s*([^\r\n#]+)/m);
 if(m)url=m[1].trim().replace(/^['"]|['"]$/g,'');
}
console.log(url.replace(/\/$/,''));
NODE
)"
if [[ "$URL" != https://* ]]; then
  echo "BACKEND URL MISSING — cannot verify V7 delivery"
  exit 1
fi

BODY="$STAGE/served-nova.html"
HEADERS="$STAGE/served-nova-headers.txt"
curl -fsSL --retry 3 --retry-delay 2 --max-time 25 -D "$HEADERS" \
  "$URL/api/studio/nova.html?fxbuild=novastudio-v7-20261127" -o "$BODY"
grep -Fq '/* FX NOVA V7' "$BODY"
grep -Fq 'data-mode="general"' "$BODY"
grep -iq '^x-frame-options: SAMEORIGIN' "$HEADERS"
echo "VERIFIED: SERVER DELIVERS NOVA V7 + GENERAL + SAME-ORIGIN WEB EMBED"

trap - ERR
rm -rf "$STAGE"
echo "FX CALL V7 INSTALLED — RESPONSIVE MOBILE STUDIO READY"
echo "BACKUP: $SNAP"
echo "No Expo restart or cache deletion performed."
