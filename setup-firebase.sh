#!/usr/bin/env bash
# One-time Firebase setup + deploy for the Rose Kelley Scholarship site.
# Prereq: `firebase login` has been run. Safe to re-run; each step skips
# what already exists.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID="rose-kelley-$(openssl rand -hex 3)"
fi

echo "==> Using project id: $PROJECT_ID"

if ! firebase projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
  echo "==> Creating Firebase project"
  firebase projects:create "$PROJECT_ID" --display-name "Rose Kelley Scholarship"
fi

echo "$PROJECT_ID" > .project-id
cat > .firebaserc <<EOF
{
  "projects": { "default": "$PROJECT_ID" }
}
EOF

echo "==> Creating Firestore database (nam5 / US multi-region)"
firebase firestore:databases:create "(default)" --location=nam5 --project "$PROJECT_ID" 2>/dev/null \
  || echo "    (database already exists — ok)"

echo "==> Registering web app"
APP_ID=$(firebase apps:list WEB --project "$PROJECT_ID" --json 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d).result||[];console.log(r.length?r[0].appId:'')})")
if [ -z "$APP_ID" ]; then
  APP_ID=$(firebase apps:create WEB "Rose Kelley Site" --project "$PROJECT_ID" --json \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).result.appId)})")
fi
echo "    App ID: $APP_ID"

echo "==> Fetching web SDK config and injecting into public/index.html"
CONFIG_JSON=$(firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" --json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d).result.sdkConfig))})")
node -e "
const fs = require('fs');
const f = 'public/index.html';
let html = fs.readFileSync(f, 'utf8');
html = html.replace(/const FIREBASE_CONFIG = .*?; \/\* @FIREBASE_CONFIG@ \*\//,
  'const FIREBASE_CONFIG = ' + process.argv[1] + '; /* @FIREBASE_CONFIG@ */');
fs.writeFileSync(f, html);
console.log('    Config injected.');
" "$CONFIG_JSON"

echo "==> Setting social-share URLs to the live host"
sed -i '' "s/__SITE_HOST__/$PROJECT_ID.web.app/g" public/index.html

echo "==> Deploying Firestore rules and hosting"
firebase deploy --only firestore:rules,hosting --project "$PROJECT_ID"

echo
echo "==> DONE. Site is live at: https://$PROJECT_ID.web.app"
echo "    Applications will appear in Firestore under the 'applications' collection:"
echo "    https://console.firebase.google.com/project/$PROJECT_ID/firestore"
