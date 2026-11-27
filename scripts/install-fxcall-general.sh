#!/usr/bin/env bash
set -Eeuo pipefail
cd /app || exit 1

SOURCE_BRANCH="design/fxcall-general-from-backup-20261127"
BACKUP_BRANCH="backup/fxcall-ui-20261127-003212"
EXPECTED_REPO="usuario18fx/fx-call"

echo "=== FX CALL / NOVA GENERAL + UNIFIED GRAPHITE UI ==="
ORIGIN="$(git remote get-url origin)"
case "${ORIGIN,,}" in
  *usuario18fx/fx-call*) ;;
  *) echo "STOPPED: Unexpected Git repository: $ORIGIN"; exit 1 ;;
esac

EXISTING=(
  'frontend/app/(tabs)/account.tsx'
  'frontend/app/(tabs)/meetings.tsx'
  'frontend/app/index.tsx'
  'frontend/src/theme.ts'
  'frontend/src/components/SettingsHub.tsx'
  'frontend/src/nova/useNovaActions.ts'
  'frontend/public/nova-studio.html'
)
ADDED=(
  'frontend/src/nova/designTokens.ts'
  'frontend/src/generalPreferences.ts'
  'frontend/src/i18n.ts'
  'frontend/src/components/GeneralPanel.tsx'
)

# Do not overwrite local work or unrelated branches.
CURRENT="$(git branch --show-current)"
if [[ "$CURRENT" != "$BACKUP_BRANCH" ]]; then
  echo "STOPPED: You are on $CURRENT, not the backed-up FX CALL branch."
  exit 1
fi

for file in "${EXISTING[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "STOPPED: Existing source file is missing: $file"
    exit 1
  fi
  if [[ -n "$(git status --porcelain -- "$file")" ]]; then
    echo "STOPPED: Unsaved local modifications in $file"
    exit 1
  fi
done
for file in "${ADDED[@]}"; do
  if [[ -e "$file" ]]; then
    echo "STOPPED: New dependency already exists locally: $file"
    exit 1
  fi
done

if [[ ! -x /app/frontend/node_modules/.bin/tsc ]]; then
  echo "STOPPED: Install frontend dependencies before running this installer."
  exit 1
fi

git fetch origin \
  "refs/heads/$SOURCE_BRANCH:refs/remotes/origin/$SOURCE_BRANCH" \
  "refs/heads/$BACKUP_BRANCH:refs/remotes/origin/$BACKUP_BRANCH"

if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "refs/remotes/origin/$BACKUP_BRANCH")" ]]; then
  echo "STOPPED: Your checked-out branch differs from the saved backup. No files modified."
  exit 1
fi

for file in "${EXISTING[@]}" "${ADDED[@]}"; do
  git cat-file -e "refs/remotes/origin/$SOURCE_BRANCH:$file" || {
    echo "STOPPED: Remote design branch is missing $file"
    exit 1
  }
done

BACKUP_DIR="/app/FXCALL-BEFORE-GENERAL-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
for file in "${EXISTING[@]}"; do
  mkdir -p "$BACKUP_DIR/$(dirname "$file")"
  cp -p "$file" "$BACKUP_DIR/$file"
done
echo "BACKUP: $BACKUP_DIR"

restore() {
  echo "CHECK FAILED — RESTORING ORIGINAL FX CALL UI"
  for file in "${EXISTING[@]}"; do
    cp -p "$BACKUP_DIR/$file" "$file"
  done
  for file in "${ADDED[@]}"; do
    rm -f "$file"
  done
  supervisorctl restart expo >/dev/null 2>&1 || true
  echo "ROLLBACK COMPLETED"
}
trap restore ERR

for file in "${EXISTING[@]}" "${ADDED[@]}"; do
  mkdir -p "$(dirname "$file")"
  git show "refs/remotes/origin/$SOURCE_BRANCH:$file" > "$file"
  echo "APPLIED: $file"
done

echo "CHECKING JAVASCRIPT IN NOVA STUDIO..."
node <<'NODE'
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('/app/frontend/public/nova-studio.html', 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if (source.length < 2 || !html.includes("id: 'general'") || !html.includes("post('open-general')")) {
  throw new Error('NOVA General bridge or expected scripts missing');
}
source.forEach((script, n) => new vm.Script(script[1], {filename: 'fx-nova-' + n + '.js'}));
console.log("JAVASCRIPT PASS");
NODE

echo "CHECKING TYPESCRIPT..."
(cd /app/frontend && ./node_modules/.bin/tsc --noEmit)
echo "TYPESCRIPT PASS"

supervisorctl restart expo
supervisorctl status expo

trap - ERR
echo "FX CALL NOVA GENERAL READY"
echo "No backend, LiveKit, Resend, accounts, or production deployment modified."
