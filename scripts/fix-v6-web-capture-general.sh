#!/usr/bin/env bash
set -Eeuo pipefail
cd /app || exit 1

echo "=== FX CALL V6 / WEB SCREENSHOT ERROR + GENERAL REFRESH ==="

ROOT='frontend/app/_layout.tsx'
WEB='frontend/app/(tabs)/studio.web.tsx'
NATIVE='frontend/app/(tabs)/studio.tsx'
SNAP="/app/FXCALL-V6-SAFE-BACKUP-$(date +%Y%m%d-%H%M%S)"

for file in "$ROOT" "$WEB" "$NATIVE"; do
  if [[ ! -f "$file" ]]; then
    echo "STOPPED: missing $file; no files changed"
    exit 1
  fi
done

if [[ ! -x frontend/node_modules/.bin/tsc ]]; then
  echo "STOPPED: TypeScript dependencies unavailable"
  exit 1
fi

for file in "$ROOT" "$WEB" "$NATIVE"; do
  mkdir -p "$SNAP/$(dirname "$file")"
  cp -p "$file" "$SNAP/$file"
done
echo "LOCAL BACKUP: $SNAP"

restore() {
  trap - ERR
  set +e
  for file in "$ROOT" "$WEB" "$NATIVE"; do
    mkdir -p "$(dirname "$file")"
    cp -p "$SNAP/$file" "$file"
  done
  echo "ROLLBACK: your original files restored"
}
trap restore ERR

python3 <<'PY'
from pathlib import Path
import re

root = Path("frontend/app/_layout.tsx")
s = root.read_text()
imp = 'import { usePreventScreenCapture } from "expo-screen-capture";'
if imp not in s:
    s = imp + '\n' + s

anchor = "export default function RootLayout() {"
if s.count(anchor) != 1:
    raise RuntimeError("Unexpected RootLayout structure")

if "function NativeCaptureGuard()" not in s:
    # Remove only the old app-wide top-level hook, not other features.
    s = re.sub(r'(?m)^\s*usePreventScreenCapture\("fxcall-app"\);\s*\n', '', s)
    guard = (
        'function NativeCaptureGuard() {\n'
        '  usePreventScreenCapture("fxcall-app");\n'
        '  return null;\n'
        '}\n\n'
    )
    s = s.replace(anchor, guard + anchor, 1)

native_mount = '{Platform.OS === "web" ? null : <NativeCaptureGuard />}'
if native_mount not in s:
    status = '<StatusBar style="light" />'
    if s.count(status) != 1:
        raise RuntimeError("Cannot safely locate StatusBar slot")
    s = s.replace(status, status + '\n                  ' + native_mount, 1)

if s.count('usePreventScreenCapture("fxcall-app");') != 1:
    raise RuntimeError("Screen-capture hook must exist only once")
root.write_text(s)
print("WEB ERROR FIXED: native capture hook is not mounted in a browser")

for name in ("studio.web.tsx", "studio.tsx"):
    path = Path("frontend/app/(tabs)") / name
    old = path.read_text()
    updated, count = re.subn(
        r'fxbuild=general-room-v\d+-20261127',
        'fxbuild=general-room-v6-20261127',
        old
    )
    if count != 1:
        raise RuntimeError(f"Expected one Studio build marker in {name}, got {count}")
    path.write_text(updated)
    print(f"STUDIO REFRESH READY: {name}")

html = Path("frontend/public/nova-studio.html").read_text()
if 'data-mode="general"' not in html or 'id="launch-general"' not in html:
    raise RuntimeError("GENERAL layout is not installed in the current HTML")
print("GENERAL MODE PRESENT IN LOCAL HTML")
PY

(cd frontend && ./node_modules/.bin/tsc --noEmit)
echo "TYPESCRIPT PASS"

echo "=== FINAL CHECK ==="
grep -n -m1 'Platform.OS === "web" ? null : <NativeCaptureGuard />' "$ROOT"
grep -n -m1 'general-room-v6-20261127' "$WEB"
grep -n -m1 'general-room-v6-20261127' "$NATIVE"

trap - ERR
echo "FX CALL V6 FIX INSTALLED"
echo "No service restarted. Reload the browser and Expo Go."
echo "BACKUP: $SNAP"
