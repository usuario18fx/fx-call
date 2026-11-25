#!/usr/bin/env bash
set -euo pipefail
cd /app

cat > /tmp/fxcall-nova-navigation-install.py <<'PY'
from pathlib import Path
from datetime import datetime
import shutil
import subprocess

root = Path('/app')
frontend = root / 'frontend'
branch = 'design/nova-unified-20261124'
files = (
    'frontend/app/(tabs)/account.tsx',
    'frontend/app/(tabs)/meetings.tsx',
    'frontend/app/host/[id].tsx',
    'frontend/src/components/host-panels.tsx',
    'backend/room_routes.py',
)

def cmd(*args, cwd=root, capture=False):
    return subprocess.run(args, cwd=cwd, check=True,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None)

origin = cmd('git', 'remote', 'get-url', 'origin', capture=True).stdout.decode().strip()
if 'usuario18fx/fx-call' not in origin.lower():
    raise SystemExit('STOPPED: Unexpected Git repository. No files modified.')

print('FETCHING VERIFIED NOVA BRANCH', flush=True)
cmd('git', 'fetch', 'origin', branch)
payload = {}
for file in files:
    if not (root / file).is_file():
        raise SystemExit(f'STOPPED: Missing local file: {file}. No files modified.')
    payload[file] = cmd('git', 'show', f'FETCH_HEAD:{file}', capture=True).stdout

checks = {
    'frontend/app/(tabs)/account.tsx': b'breadcrumb-profile',
    'frontend/app/(tabs)/meetings.tsx': b'new-room-settings-gear',
    'frontend/app/host/[id].tsx': b'breadcrumb-meetings',
    'frontend/src/components/host-panels.tsx': b'invite-custom-expiry',
    'backend/room_routes.py': b'async def rename_room(',
}
for file, marker in checks.items():
    if marker not in payload[file]:
        raise SystemExit(f'STOPPED: New version not found in {file}. No files modified.')

backup = root / ('FXCALL-NOVA-NAV-BACKUP-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True, exist_ok=False)
for file in files:
    saved = backup / file
    saved.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / file, saved)
print('BACKUP:', backup, flush=True)

services_restarted = False
try:
    for file, data in payload.items():
        (root / file).write_bytes(data)
        print('UPDATED:', file, flush=True)

    print('CHECK: PYTHON...', flush=True)
    cmd('python3', '-m', 'py_compile', 'backend/room_routes.py')
    print('PYTHON PASS', flush=True)

    print('CHECK: TYPESCRIPT...', flush=True)
    cmd('./node_modules/.bin/tsc', '--noEmit', cwd=frontend)
    print('TYPESCRIPT PASS', flush=True)

    print('RESTART SERVICES', flush=True)
    services_restarted = True
    cmd('supervisorctl', 'restart', 'backend')
    cmd('supervisorctl', 'restart', 'expo')
    cmd('supervisorctl', 'status', 'backend')
    cmd('supervisorctl', 'status', 'expo')
    print('NOVA NAVIGATION READY', flush=True)
except BaseException:
    print('FAILED: RESTORING ORIGINAL FILES...', flush=True)
    for file in files:
        shutil.copy2(backup / file, root / file)
    print('ROLLBACK COMPLETED', flush=True)
    if services_restarted:
        for service in ('backend', 'expo'):
            try:
                cmd('supervisorctl', 'restart', service)
            except Exception as err:
                print('Could not restart', service, err, flush=True)
    raise
PY

python3 -u /tmp/fxcall-nova-navigation-install.py 2>&1 | tee /tmp/fxcall-nova-navigation-result.log
