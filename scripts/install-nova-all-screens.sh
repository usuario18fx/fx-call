#!/usr/bin/env bash
set -Eeuo pipefail

cd /app || { echo "STOPPED: project root /app was not found"; return 1 2>/dev/null || exit 1; }
ORIGIN="$(git remote get-url origin)"
case "${ORIGIN,,}" in
  *usuario18fx/fx-call*) ;;
  *) echo "STOPPED: this is not usuario18fx/fx-call"; exit 1 ;;
esac

echo "=== FX CALL / NOVA UNIFIED UI ==="
FILES=(
  'frontend/src/nova/designTokens.ts'
  'frontend/src/components/Screen.tsx'
  'frontend/src/components/ui.tsx'
  'frontend/src/components/AuthShell.tsx'
  'frontend/app/(tabs)/account.tsx'
  'frontend/app/(tabs)/meetings.tsx'
)

for file in "${FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "STOPPED: existing project file not found: $file"
    exit 1
  fi
  if [[ -n "$(git status --porcelain -- "$file")" ]]; then
    echo "STOPPED: uncommitted local changes detected in $file"
    echo "Commit or back up your local changes before using this installer."
    exit 1
  fi
done

if [[ ! -x /app/frontend/node_modules/.bin/tsc ]]; then
  echo "STOPPED: TypeScript dependencies are not installed at /app/frontend/node_modules"
  exit 1
fi

git fetch origin design/nova-all-screens-20261126
for file in "${FILES[@]}"; do
  git cat-file -e "FETCH_HEAD:$file" || { echo "STOPPED: branch missing $file"; exit 1; }
done

BACKUP="/app/FXCALL-NOVA-UI-BACKUP-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
for file in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp -p "$file" "$BACKUP/$file"
done
echo "BACKUP: $BACKUP"

restore() {
  echo "CHECK FAILED: reverting modified UI files"
  for file in "${FILES[@]}"; do
    cp -p "$BACKUP/$file" "$file"
  done
  supervisorctl restart expo || true
  echo "ROLLBACK COMPLETE"
}
trap restore ERR

for file in "${FILES[@]}"; do
  git show "FETCH_HEAD:$file" > "$file"
  echo "UPDATED: $file"
done

echo "CHECKING TYPESCRIPT..."
(cd /app/frontend && ./node_modules/.bin/tsc --noEmit)
echo "TYPESCRIPT PASS"
supervisorctl restart expo
supervisorctl status expo
trap - ERR
echo "NOVA UI READY — STUDIO, MEETINGS, PROFILE, SETTINGS, LOGIN"
echo "Your backend, LiveKit, Resend, database and production deployment were not changed."
