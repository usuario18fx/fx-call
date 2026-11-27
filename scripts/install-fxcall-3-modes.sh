#!/usr/bin/env bash
set -Eeuo pipefail
cd /app || exit 1

SOURCE_BRANCH="feature/fxcall-general-room-20261127"
BACKUP_BRANCH="backup/fxcall-ui-20261127-003212"

echo "=== FX CALL / NOVA THREE MODES - SAFE MERGE V2 ==="
ORIGIN="$(git remote get-url origin)"
case "${ORIGIN,,}" in
  *usuario18fx/fx-call*) ;;
  *) echo "STOPPED: Unexpected Git origin: $ORIGIN"; exit 1 ;;
esac

EXISTING=(
  'frontend/public/nova-studio.html'
  'frontend/app/(tabs)/studio.web.tsx'
  'frontend/app/(tabs)/studio.tsx'
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
  if [[ ! -f "$file" ]]; then
    echo "STOPPED: Missing required file: $file"
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

if ! git merge-base --is-ancestor "refs/remotes/origin/$BACKUP_BRANCH" HEAD; then
  echo "STOPPED: Local branch does not descend from the pushed backup."
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
for file in "${EXISTING[@]}" "${NEW_FILES[@]}"; do
  if [[ -f "$file" ]]; then
    mkdir -p "$SNAP/$(dirname "$file")"
    cp -p "$file" "$SNAP/$file"
  fi
done
git status --short -- "${EXISTING[@]}" "${NEW_FILES[@]}" > "$SNAP/git-status-before.txt"
echo "BACKUP OF LOCAL MODIFICATIONS SAVED: $SNAP"

restore() {
  echo "CHECK FAILED — RESTORING ORIGINAL FILES"
  for file in "${EXISTING[@]}" "${NEW_FILES[@]}"; do
    if [[ -f "$SNAP/$file" ]]; then cp -p "$SNAP/$file" "$file"; else rm -f "$file"; fi
  done
  supervisorctl restart expo >/dev/null 2>&1 || true
  echo "ROLLBACK COMPLETED"
}
trap restore ERR

WORK="$(mktemp -d /tmp/fxcall-nova-merge-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
for file in "${EXISTING[@]}"; do
  mkdir -p "$WORK/base/$(dirname "$file")" "$WORK/new/$(dirname "$file")"
  git show "refs/remotes/origin/$BACKUP_BRANCH:$file" > "$WORK/base/$file"
  git show "refs/remotes/origin/$SOURCE_BRANCH:$file" > "$WORK/new/$file"
  if cmp -s "$file" "$WORK/base/$file"; then
    cp "$WORK/new/$file" "$file"
    echo "APPLIED NEW: $file"
  elif cmp -s "$file" "$WORK/new/$file"; then
    echo "ALREADY INSTALLED: $file"
  elif git merge-file -p "$file" "$WORK/base/$file" "$WORK/new/$file" > "$WORK/candidate" ; then
    cp "$WORK/candidate" "$file"
    echo "MERGED LOCAL CHANGES: $file"
  else
    cp "$WORK/new/$file" "$file"
    echo "OVERLAPPING EDITS: $file"
    echo "Original retained at $SNAP/$file; new NOVA preview version applied."
  fi
done
for file in "${NEW_FILES[@]}"; do
  mkdir -p "$(dirname "$file")"
  git show "refs/remotes/origin/$SOURCE_BRANCH:$file" > "$file"
  echo "DEPENDENCY INSTALLED: $file"
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

echo "=== CACHE-BUSTED STUDIO ROUTES ==="
grep -n -m1 "fxbuild=general-room-v3-20261127" 'frontend/app/(tabs)/studio.web.tsx'
grep -n -m1 "fxbuild=general-room-v3-20261127" 'frontend/app/(tabs)/studio.tsx'

supervisorctl restart expo
supervisorctl status expo
trap - ERR

echo "FX CALL NOVA THREE MODES READY"
echo "LOCAL BACKUP: $SNAP"
echo "Public camera is LOCAL preview only; group rooms are invitation-only."
echo "LiveKit, Resend, backend and deployment remain unchanged."
