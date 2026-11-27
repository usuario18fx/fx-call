#!/usr/bin/env bash
set -Eeuo pipefail
cd /app || exit 1
echo "=== FX CALL / VERIFY & REPAIR PRIVATE V9 DELIVERY ==="
HTML=frontend/public/nova-studio.html
WEB='frontend/app/(tabs)/studio.web.tsx'
IOS='frontend/app/(tabs)/studio.tsx'
[[ -f "$HTML" && -f "$WEB" && -f "$IOS" ]] || { echo "STOP: NOVA source files missing"; exit 1; }
[[ -x frontend/node_modules/.bin/tsc ]] || { echo "STOP: TypeScript compiler missing"; exit 1; }
grep -Fq 'FX CALL PRIVATE ICONS V9 END' "$HTML" || { echo "STOP: PRIVATE V9 not installed locally"; exit 1; }
grep -Fq 'fx-private-icon-toggles' "$HTML" || { echo "STOP: PRIVATE V9 icons missing"; exit 1; }
BASE="$(node <<'NODE'
const fs=require('fs');
let value=process.env.EXPO_PUBLIC_BACKEND_URL||'';
for(const file of ['frontend/.env.local','frontend/.env','.env']){
 if(value||!fs.existsSync(file))continue;
 const m=fs.readFileSync(file,'utf8').match(/^EXPO_PUBLIC_BACKEND_URL\s*=\s*([^\r\n#]+)/m);
 if(m)value=m[1].trim().replace(/^["']|["']$/g,'');
}
console.log(value.replace(/\/$/,''));
NODE
)"
if [[ "$BASE" != https://* ]]; then
  echo "STOP: HTTPS EXPO_PUBLIC_BACKEND_URL unavailable — cannot verify actual server"
  exit 1
fi
echo "VERIFYING: $BASE/api/studio/nova.html"
TMP="$(mktemp /tmp/fxcall-v9-server-XXXXXX.html)"
curl -fsSL --max-time 25 --retry 2 --retry-delay 2 \
  "$BASE/api/studio/nova.html?fxcheck=$(date +%s)" -o "$TMP" || {
  echo "STOP: server is not delivering NOVA HTML; original files untouched"
  exit 1
}
if ! grep -Fq 'fx-private-icon-toggles' "$TMP" || ! grep -Fq 'FX CALL PRIVATE ICONS V9 END' "$TMP"; then
  echo "STOP: public API serves OLD PRIVATE controls; do not restart or patch Expo"
  echo "LOCAL HTML VERSION: V9"
  echo "PUBLIC API VERSION: OLD"
  echo "Server response sample:"
  head -c 250 "$TMP" || true
  echo
  exit 2
fi
echo "PUBLIC API VERSION: V9 VERIFIED"

SNAP="/app/FXCALL-V9-DELIVERY-BACKUP-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SNAP/$(dirname "$WEB")"
cp -p "$WEB" "$SNAP/$WEB"
cp -p "$IOS" "$SNAP/$IOS"
echo "BACKUP: $SNAP"

restore() {
  trap - ERR
  set +e
  cp -p "$SNAP/$WEB" "$WEB"
  cp -p "$SNAP/$IOS" "$IOS"
  echo "ROLLBACK: Studio routes restored"
}
trap restore ERR
python3 <<'PY'
from pathlib import Path
import re
web=Path('frontend/app/(tabs)/studio.web.tsx')
native=Path('frontend/app/(tabs)/studio.tsx')
w=web.read_text()
n=native.read_text()
# Web iframe must load same-origin API, which has just been checked live.
w,count=re.subn(r'src="/(?:api/studio/)?nova-studio\.html\?fxbuild=[^"]+"',
                'src="/api/studio/nova.html?fxbuild=private-icons-v10-20261127"',w)
if count != 1:
    w,count=re.subn(r'src="/api/studio/nova\.html\?fxbuild=[^"]+"',
                    'src="/api/studio/nova.html?fxbuild=private-icons-v10-20261127"',w)
if count!=1: raise RuntimeError('Unrecognized web iframe path')
if 'const novaPath = "/api/studio/nova.html"' not in n:
    raise RuntimeError('Native Studio is not using the backend HTML route')
n,count=re.subn(r'fxbuild=[A-Za-z0-9-]+','fxbuild=private-icons-v10-20261127',n,count=1)
if count!=1: raise RuntimeError('Native Studio version marker missing')
web.write_text(w)
native.write_text(n)
print('WEB IFRAMES NOW LOAD VERIFIED /api/studio/nova.html')
print('NATIVE AND WEB CACHE BUST: PRIVATE ICONS V10')
PY
(cd frontend && ./node_modules/.bin/tsc --noEmit)
echo "TYPESCRIPT PASS"
echo "RESTARTING EXPO WITHOUT DELETING CACHES..."
if ! supervisorctl restart expo; then
  echo "WARNING: initial Expo restart failed; retrying clean start"
  supervisorctl start expo || true
fi
sleep 2
if ! supervisorctl status expo | grep -q RUNNING; then
  echo "STOP: Expo did not start; restoring routes"
  exit 1
fi
trap - ERR
echo "EXPO RUNNING"
echo "FX CALL V9 VERIFIED AT SERVER AND STUDIO ROUTES REPAIRED"
echo "BACKUP: $SNAP"
