#!/usr/bin/env bash
set -euo pipefail
cd /app || exit 1

# This installs only the Expo Go navigation and native Studio WebView fixes.
# User accounts, room data, server credentials and LiveKit/Resend are untouched.
cat > /tmp/fxcall-studio-nav-fix.py <<'PY'
from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

root = Path("/app")
branch = "design/nova-unified-20261124"
paths = (
    "frontend/src/navigation.ts",
    "frontend/app/(tabs)/_layout.tsx",
    "frontend/app/(tabs)/studio.tsx",
)
markers = {
    "frontend/src/navigation.ts": b"storeClient",
    "frontend/app/(tabs)/_layout.tsx": b"tab-studio",
    "frontend/app/(tabs)/studio.tsx": b"studio-unavailable",
}

def cmd(*args, cwd=root, capture=False):
    return subprocess.run(
        args, cwd=cwd, check=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None
    )

origin = cmd("git", "remote", "get-url", "origin", capture=True).stdout.decode().strip().lower()
if "usuario18fx/fx-call" not in origin:
    raise SystemExit("STOPPED: This is not the FX CALL repository. No changes made.")

for path in paths:
    if not (root / path).is_file():
        raise SystemExit("STOPPED: Missing local file: " + path + ". No changes made.")

print("FETCHING NOVA STUDIO NAVIGATION FIX", flush=True)
cmd("git", "fetch", "origin", branch)

payload = {}
for path in paths:
    data = cmd("git", "show", "FETCH_HEAD:" + path, capture=True).stdout
    if markers[path] not in data:
        raise SystemExit("STOPPED: Incorrect or incomplete update: " + path)
    payload[path] = data

backup = root / ("FXCALL-STUDIO-NAV-BACKUP-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.mkdir(parents=True, exist_ok=False)
for path in paths:
    target = backup / path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / path, target)
print("BACKUP:", backup, flush=True)

restart_started = False
try:
    for path, data in payload.items():
        (root / path).write_bytes(data)
        print("UPDATED:", path, flush=True)

    print("CHECK: TYPESCRIPT", flush=True)
    cmd("./node_modules/.bin/tsc", "--noEmit", cwd=root / "frontend")
    print("TYPESCRIPT PASS", flush=True)

    restart_started = True
    print("RESTARTING EXPO", flush=True)
    cmd("supervisorctl", "restart", "expo")
    cmd("supervisorctl", "status", "expo")
    print("STUDIO NAVIGATION FIX READY", flush=True)
except BaseException:
    print("FAILED: RESTORING PREVIOUS STUDIO AND NAVIGATION", flush=True)
    for path in paths:
        shutil.copy2(backup / path, root / path)
    print("ROLLBACK COMPLETED", flush=True)
    if restart_started:
        try:
            cmd("supervisorctl", "restart", "expo")
        except Exception as error:
            print("EXPO RESTART AFTER ROLLBACK FAILED:", error, flush=True)
    raise
PY

python3 -u /tmp/fxcall-studio-nav-fix.py 2>&1 | tee /tmp/fxcall-studio-nav-fix.log
