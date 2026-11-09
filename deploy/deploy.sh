#!/usr/bin/env bash
# Puts davidlevine.dev online on Cloud Run, using EXACTLY the code that is on GitHub (branch main).
#   bash deploy/deploy.sh             check, then deploy
#   bash deploy/deploy.sh --dry-run   do every check and fetch the code, but don't deploy
#
# Why from GitHub: the live site is always a commit saved on GitHub, so nothing that exists
# only on this laptop (unsaved edits, stray files) can go live.
# Run deploy/setup.sh once first.
set -euo pipefail

PROJECT=davidlevine-site
REGION=us-central1
SERVICE=portfolio
BRANCH=main
SA_EMAIL="portfolio-run@$PROJECT.iam.gserviceaccount.com"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1
cd "$(dirname "$0")/.."

stop() { echo; echo "Not deploying: $1"; exit 1; }

# ---- 1. Everything must be committed and on GitHub ----------------------------------------
echo "Checking that this folder matches GitHub…"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || stop "you're on branch '$(git rev-parse --abbrev-ref HEAD)', not '$BRANCH'."
[ -z "$(git status --porcelain)" ] || { git status --short; stop "there are changes that aren't committed (listed above). Commit them first."; }
git fetch --quiet origin "$BRANCH" || stop "couldn't reach GitHub."
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" != "$REMOTE" ]; then
  AHEAD=$(git rev-list --count "origin/$BRANCH..HEAD")
  BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH")
  [ "$AHEAD" -gt 0 ] && stop "$AHEAD commit(s) here aren't on GitHub yet. Push first (git push)."
  stop "GitHub has $BEHIND commit(s) this folder doesn't. Pull first (git pull)."
fi
SHORT=$(git rev-parse --short HEAD)
echo "OK: deploying commit $SHORT, \"$(git log -1 --format=%s)\""

# ---- 2. A fresh copy of that commit, straight from GitHub ---------------------------------
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
echo "Downloading commit $SHORT from GitHub…"
git clone --quiet --branch "$BRANCH" "$(git remote get-url origin)" "$WORK/src"
git -C "$WORK/src" checkout --quiet "$LOCAL"
[ "$(git -C "$WORK/src" rev-parse HEAD)" = "$LOCAL" ] || stop "the copy from GitHub isn't commit $SHORT."

if [ "$DRY_RUN" = 1 ]; then
  echo; echo "Dry run: every check passed and the code came from GitHub. Nothing was deployed."
  exit 0
fi

# ---- 3. Build and deploy --------------------------------------------------------------------
# --max-instances 2 : a traffic flood can't start more than 2 copies, which caps the bill
# --min-instances 0 : scales to zero when nobody is visiting, so idle cost is about nothing
# --allow-unauthenticated : it's a public website, so anyone may open it
# --labels commit=… : each version in Cloud Run is tagged with the GitHub commit it came from
echo; echo "Deploying ${SERVICE}…"
gcloud run deploy "$SERVICE" --source "$WORK/src" --project "$PROJECT" --region "$REGION" \
  --allow-unauthenticated \
  --service-account "$SA_EMAIL" \
  --port 8080 \
  --min-instances 0 --max-instances 2 --memory 256Mi --cpu 1 \
  --labels "commit=$SHORT"

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')
echo; echo "Live at: $URL  (commit $SHORT)"
echo "Check: $(curl -s -o /dev/null -w '%{http_code}' "$URL/") (200 means OK)"
echo "First time? Next: bash deploy/map-domain.sh"

# To undo a bad deploy:
#   gcloud run revisions list --service portfolio --region us-central1 --project davidlevine-site
#   gcloud run services update-traffic portfolio --region us-central1 --project davidlevine-site --to-revisions <older-revision>=100
