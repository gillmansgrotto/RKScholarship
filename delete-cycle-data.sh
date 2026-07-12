#!/usr/bin/env bash
# End-of-cycle cleanup: permanently deletes ALL submitted applications from
# Firestore, keeping the site's privacy promise ("materials are deleted after
# each cycle"). Run only after the cycle is fully complete and the award paid.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ID="$(cat .project-id 2>/dev/null || true)"
if [ -z "$PROJECT_ID" ]; then
  echo "No .project-id file found — run setup-firebase.sh first." >&2
  exit 1
fi

COUNT_NOTE="every document in the 'applications' collection of project $PROJECT_ID"
echo "This PERMANENTLY deletes $COUNT_NOTE."
read -r -p "Type DELETE to confirm: " CONFIRM
if [ "$CONFIRM" != "DELETE" ]; then
  echo "Aborted — nothing was deleted."
  exit 1
fi

firebase firestore:delete applications --recursive --force --project "$PROJECT_ID"
echo "Done. All application data has been deleted."
