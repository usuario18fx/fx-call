#!/usr/bin/env bash
set -Eeuo pipefail
cd /app || exit 1

echo "=== FX CALL NOVA / MOBILE ONLY V8 ==="
HTML='frontend/public/nova-studio.html'
WEB='frontend/app/(tabs)/studio.web.tsx'
IOS='frontend/app/(tabs)/studio.tsx'
SNAP="/app/FXCALL-MOBILE-V8-BACKUP-$(date +%Y%m%d-%H%M%S)"

for file in "$HTML" "$WEB" "$IOS"; do
  if [[ ! -f "$file" ]]; then
    echo "STOPPED: missing $file"
    exit 1
  fi
done
if [[ ! -x frontend/node_modules/.bin/tsc ]]; then
  echo "STOPPED: missing TypeScript compiler"
  exit 1
fi

mkdir -p "$SNAP"
for file in "$HTML" "$WEB" "$IOS"; do
  mkdir -p "$SNAP/$(dirname "$file")"
  cp -p "$file" "$SNAP/$file"
done
echo "SAFE BACKUP: $SNAP"

rollback() {
  trap - ERR
  set +e
  for file in "$HTML" "$WEB" "$IOS"; do
    cp -p "$SNAP/$file" "$file"
  done
  echo "ROLLBACK COMPLETED: original three files restored"
}
trap rollback ERR

git fetch origin feature/fxcall-general-room-20261127

python3 <<'PY'
import re
import subprocess
from pathlib import Path

remote_html = subprocess.run(
    ["git", "show", "FETCH_HEAD:frontend/public/nova-studio.html"],
    check=True, capture_output=True, text=True
).stdout
pattern = r"    /\* FX CALL MOBILE V8: BEGIN[\s\S]*?/\* FX CALL MOBILE V8: END \*/"
mobile_blocks = re.findall(pattern, remote_html)
if len(mobile_blocks) != 1:
    raise SystemExit("STOPPED: official V8 mobile styles not found")
mobile_css = mobile_blocks[0]

html_path = Path("frontend/public/nova-studio.html")
html = html_path.read_text()
if 'data-mode="general"' not in html or 'id="screen-command"' not in html:
    raise SystemExit("STOPPED: existing Studio/Command Center layout is incomplete")
if "FX CALL MOBILE V8: BEGIN" in html:
    html, count = re.subn(pattern, mobile_css, html)
    if count != 1:
        raise SystemExit("STOPPED: cannot safely replace old V8 style block")
else:
    end_style = "\n  </style>\n</head>"
    if html.count(end_style) != 1:
        raise SystemExit("STOPPED: expected one stylesheet closing tag")
    html = html.replace(end_style, "\n" + mobile_css + end_style, 1)
html_path.write_text(html)
print("MOBILE CSS APPLIED — DESKTOP STYLE RULES LEFT UNCHANGED")

for name in ("studio.web.tsx", "studio.tsx"):
    path = Path("frontend/app/(tabs)") / name
    value = path.read_text()
    value, count = re.subn(
        r"fxbuild=(?:general-room-v\d+|mobile-v8)-20261127",
        "fxbuild=mobile-v8-20261127",
        value
    )
    if count != 1:
        raise SystemExit(f"STOPPED: unexpected cache-bust marker in {name}")
    path.write_text(value)
    print(f"REFRESH ENABLED: {name}")
PY

node <<'NODE'
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("frontend/public/nova-studio.html", "utf8");
const required = ['FX CALL MOBILE V8: BEGIN', 'FX CALL MOBILE V8: END', 'data-mode="general"', 'id="screen-command"'];
for(const marker of required) if(!html.includes(marker)) throw Error("Missing marker " + marker);
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if(scripts.length < 3) throw Error("Not enough HTML scripts");
scripts.forEach((m, i) => new vm.Script(m[1], { filename: 'nova-inline-' + i + '.js' }));
console.log("HTML AND JAVASCRIPT PASS");
NODE

(cd frontend && ./node_modules/.bin/tsc --noEmit)
echo "TYPESCRIPT PASS"
trap - ERR
echo "FX CALL MOBILE V8 INSTALLED — DESKTOP PRESERVED"
echo "BACKUP: $SNAP"
echo "No backend, Expo or video functionality was restarted."
echo "Reload mobile Safari / Expo Go to load the new design."
