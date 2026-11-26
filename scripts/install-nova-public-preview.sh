#!/usr/bin/env bash
set -euo pipefail

cd /app || exit 1
SOURCE="frontend/public/nova-studio.html"
DEST="/app/$SOURCE"
BRANCH="design/nova-unified-20261124"
LOG="/tmp/fxcall-public-preview-install.log"

if [ ! -f "$DEST" ]; then
  echo "STOPPED: missing $DEST"
  exit 1
fi

ORIGIN="$(git remote get-url origin)"
case "${ORIGIN,,}" in
  *usuario18fx/fx-call*) ;;
  *) echo "STOPPED: unexpected Git origin"; exit 1 ;;
esac

echo "=== FX CALL PUBLIC CAMERA PREVIEW ==="
git fetch origin "$BRANCH"

TMP="$(mktemp /tmp/fxcall-nova-public-XXXXXX.html)"
trap 'rm -f "$TMP"' EXIT
git show "FETCH_HEAD:$SOURCE" > "$TMP"

node - "$TMP" <<'NODE'
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(process.argv[2], 'utf8');
for(const marker of [
  'id="fxPublicVideo"',
  'id="fxPublicPlaceholder"',
  'id="fxPublicStatus"',
  'fxnova:public-open',
  'fxnova:public-close',
  'data-public-control="stop"',
  '● GO LIVE · NOT CONNECTED',
  'post(\'create-room\''
]){
 if(!html.includes(marker))throw Error('Missing expected marker: '+marker);
}
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if(scripts.length < 3)throw Error('Unexpected number of scripts');
scripts.forEach((match,index)=>new vm.Script(match[1],{filename:'nova-script-'+index+'.js'}));
console.log('JAVASCRIPT SYNTAX PASS ('+scripts.length+' scripts)');
NODE

BACKUP="/app/FXCALL-PUBLIC-PREVIEW-$(date +%Y%m%d-%H%M%S).html.bak"
cp -p "$DEST" "$BACKUP"
echo "BACKUP: $BACKUP"

restore() {
  echo "INSTALLATION FAILED - ROLLING BACK"
  cp -p "$BACKUP" "$DEST"
  supervisorctl restart expo || true
  echo "ROLLBACK COMPLETED"
}
trap restore ERR

cp "$TMP" "$DEST"
echo "UPDATED: $SOURCE"
supervisorctl restart expo
supervisorctl status expo

trap - ERR
echo "NOVA PUBLIC PREVIEW READY"
