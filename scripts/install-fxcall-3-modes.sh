#!/usr/bin/env bash
set -Eeuo pipefail
cd /app || exit 1

SOURCE_BRANCH="feature/fxcall-general-room-20261127"
BACKUP_BRANCH="backup/fxcall-ui-20261127-003212"

echo "=== FX CALL / NOVA THREE MODES ==="
ORIGIN="$(git remote get-url origin)"
case "${ORIGIN,,}" in
  *usuario18fx/fx-call*) ;;
  *) echo "STOPPED: Unexpected Git origin: $ORIGIN"; exit 1 ;;
esac

EXISTING=(
  'frontend/public/nova-studio.html'
  'frontend/src/nova/useNovaActions.ts'
  'frontend/src/theme.ts'
  'frontend/src/components/SettingsHub.tsx'
  'frontend/app/(tabs)/meetings.tsx'
  'frontend/app/(tabs)/account.tsx'
)
NEW_FILES=(
  'frontend/src/nova/designTokens.ts'
  'frontend/src/i18n.ts'
)

if [[ "$(git branch --show-current)" != "$BACKUP_BRANCH" ]]; then
  echo "STOPPED: Switch to the backed-up FX CALL branch before installing."
  exit 1
fi

for file in "${EXISTING[@]}"; do
  if [[ ! -f "$file" || -n "$(git status --porcelain -- "$file")" ]]; then
    echo "STOPPED: Missing file or uncommitted changes: $file"
    exit 1
  fi
done
for file in "${NEW_FILES[@]}"; do
  if [[ -e "$file" ]]; then
    echo "STOPPED: $file already exists locally; refusing to overwrite."
    exit 1
  fi
done
if [[ ! -x /app/frontend/node_modules/.bin/tsc ]]; then
  echo "STOPPED: TypeScript dependencies unavailable. Install frontend dependencies first."
  exit 1
fi

git fetch origin \
  "refs/heads/$SOURCE_BRANCH:refs/remotes/origin/$SOURCE_BRANCH" \
  "refs/heads/$BACKUP_BRANCH:refs/remotes/origin/$BACKUP_BRANCH"

if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "refs/remotes/origin/$BACKUP_BRANCH")" ]]; then
  echo "STOPPED: Local backup branch differs from the pushed backup."
  exit 1
fi

for file in "${EXISTING[@]}" "${NEW_FILES[@]}"; do
  git cat-file -e "refs/remotes/origin/$SOURCE_BRANCH:$file" || {
    echo "STOPPED: $file missing from design branch"
    exit 1
  }
done

SNAP="/app/FXCALL-BEFORE-THREE-MODES-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SNAP"
for file in "${EXISTING[@]}"; do
  mkdir -p "$SNAP/$(dirname "$file")"
  cp -p "$file" "$SNAP/$file"
done
echo "BACKUP SAVED: $SNAP"

restore() {
  echo "CHECK FAILED — RESTORING ORIGINAL FILES"
  for file in "${EXISTING[@]}"; do cp -p "$SNAP/$file" "$file"; done
  for file in "${NEW_FILES[@]}"; do rm -f "$file"; done
  supervisorctl restart expo >/dev/null 2>&1 || true
  echo "ROLLBACK COMPLETED"
}
trap restore ERR

for file in "${EXISTING[@]}" "${NEW_FILES[@]}"; do
  mkdir -p "$(dirname "$file")"
  git show "refs/remotes/origin/$SOURCE_BRANCH:$file" > "$file"
  echo "APPLIED: $file"
done

node <<'NODE'
const fs=require('fs');
const vm=require('vm');
const html=fs.readFileSync('/app/frontend/public/nova-studio.html','utf8');
const expected=['id="launch-general"','id="launch-private"','id="launch-live"','id="fxPublicVideo"','id="privateWaitingEdit"',"mode:'general'"];
for(const marker of expected){if(!html.includes(marker))throw Error('Missing feature marker '+marker);}
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if(scripts.length<3)throw Error('Missing HTML integration scripts');
scripts.forEach((m,i)=>new vm.Script(m[1],{filename:'nova-inline-'+i+'.js'}));
console.log("JAVASCRIPT PASS");
NODE

echo "CHECKING TYPESCRIPT..."
(cd /app/frontend && ./node_modules/.bin/tsc --noEmit)
echo "TYPESCRIPT PASS"

supervisorctl restart expo
supervisorctl status expo
trap - ERR

echo "FX CALL NOVA THREE MODES READY"
echo "Public camera is LOCAL preview only; group rooms are invitation-only."
echo "LiveKit, Resend, backend and deployment remain unchanged."
