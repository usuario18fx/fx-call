#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  if [[ -f /home/user/fx-call/frontend/public/nova-studio.html ]]; then ROOT=/home/user/fx-call
  elif [[ -f /app/frontend/public/nova-studio.html ]]; then ROOT=/app
  else echo "STOPPED: specify active FX CALL folder"; exit 1; fi
fi
cd "$ROOT" || exit 1
HTML=frontend/public/nova-studio.html
WEB='frontend/app/(tabs)/studio.web.tsx'
NATIVE='frontend/app/(tabs)/studio.tsx'
for f in "$HTML" "$WEB" "$NATIVE"; do
  [[ -f "$f" ]] || { echo "STOPPED: $f missing; current workspace is older than NOVA"; exit 1; }
done
[[ -x frontend/node_modules/.bin/tsc ]] || { echo 'STOPPED: TypeScript compiler missing'; exit 1; }
case "$(git remote get-url origin | tr '[:upper:]' '[:lower:]')" in
  *usuario18fx/fx-call*) ;; 
  *) echo 'STOPPED: unexpected Git origin'; exit 1 ;;
esac
git fetch origin feature/fxcall-general-room-20261127
SNAP="$ROOT/FXCALL-PRIVATE-ICONS-V9-BACKUP-$(date +%Y%m%d-%H%M%S)"
for f in "$HTML" "$WEB" "$NATIVE"; do mkdir -p "$SNAP/$(dirname "$f")"; cp -p "$f" "$SNAP/$f"; done
echo "SAFE BACKUP: $SNAP"
restore() {
  trap - ERR
  set +e
  for f in "$HTML" "$WEB" "$NATIVE"; do cp -p "$SNAP/$f" "$f"; done
  echo "ROLLBACK COMPLETE — originals restored"
}
trap restore ERR
python3 <<'PY'
from pathlib import Path
import re, subprocess
remote = subprocess.run(['git','show','FETCH_HEAD:frontend/public/nova-studio.html'],capture_output=True,text=True,check=True).stdout
p = Path('frontend/public/nova-studio.html')
local = p.read_text()
def area(data, start, stop):
    if data.count(start) != 1: raise RuntimeError('Non-unique start: '+start[:40])
    a = data.index(start)
    b = data.find(stop, a + len(start))
    if b < 0: raise RuntimeError('Missing end: '+stop[:40])
    return data[a:b]
start = '          <div class="field">\n            TIPO DE LLAMADA'
stop = '          <div class="launch-note">'
new = area(remote,start,stop)
if 'fx-private-icon-toggles' not in new: raise RuntimeError('Remote V9 not found')
local = local.replace(area(local,start,stop),new,1)
start = '    /* FX CALL PRIVATE ICONS V9 —'
stop = '    /* FX CALL PRIVATE ICONS V9 END */'
new = area(remote,start,stop) + stop
if start in local: local = local.replace(area(local,start,stop)+stop,new,1)
else:
    marker = '\n  </style>\n</head>'
    if local.count(marker) != 1: raise RuntimeError('No unique CSS insertion point')
    local = local.replace(marker,'\n'+new+marker,1)
start = '      <symbol id="i-headphones" viewBox="0 0 24 24">'
stop = '      <symbol id="i-search" viewBox="0 0 24 24">'
new = area(remote,start,stop)
icons = ('i-headphones','i-shield-check','i-link','i-hourglass')
present = [f'id="{x}"' in local for x in icons]
if any(present) and not all(present): raise RuntimeError('Partial existing SVG symbols')
if not any(present):
    if local.count(stop) != 1: raise RuntimeError('Cannot insert symbols')
    local = local.replace(stop,new+stop,1)
before = """      row.querySelectorAll('.choice').forEach(function (choice) {
        choice.classList.remove('active');
      });
      button.classList.add('active');"""
after = """      row.querySelectorAll('.choice').forEach(function (choice) {
        const active = choice === button;
        choice.classList.toggle('active', active);
        choice.setAttribute('aria-pressed', active ? 'true' : 'false');
      });"""
if before in local: local = local.replace(before,after,1)
elif after not in local: raise RuntimeError('Unknown local selectChoice')
if local.count('FX CALL PRIVATE ICONS V9 END') != 1: raise RuntimeError('Duplicate CSS')
p.write_text(local)
print('PRIVATE CONTROLS: icons only, borderless, off opacity 0.6')
for f in ('studio.web.tsx','studio.tsx'):
    path = Path('frontend/app/(tabs)')/f
    old = path.read_text()
    text,n = re.subn(r'fxbuild=(?:mobile-v\d+|general-room-v\d+|private-icons-v9)-20261127','fxbuild=private-icons-v9-20261127',old)
    if n != 1: raise RuntimeError('Unknown cache marker: '+f)
    path.write_text(text)
    print('CACHE BUST: '+f)
PY
node <<'NODE'
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('frontend/public/nova-studio.html','utf8');
for(const x of ['fx-private-icon-toggles','FX CALL PRIVATE ICONS V9 END','aria-label="Waiting room"','data-mode="general"'])if(!html.includes(x))throw Error('Missing '+x);
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if(scripts.length<3)throw Error('Missing scripts');
scripts.forEach((m,i)=>new vm.Script(m[1],{filename:'NOVA-'+i+'.js'}));
console.log('JAVASCRIPT PASS');
NODE
(cd frontend && ./node_modules/.bin/tsc --noEmit)
echo 'TYPESCRIPT PASS'
trap - ERR
echo 'FX CALL PRIVATE ICONS V9 INSTALLED — NO SERVICES RESTARTED'
echo "BACKUP: $SNAP"
