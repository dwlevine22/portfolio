#!/usr/bin/env bash
# One-time: connects davidlevine.dev and www.davidlevine.dev to the portfolio on Cloud Run.
#   bash deploy/map-domain.sh            create the mappings (if missing), then show their status
#   bash deploy/map-domain.sh --status   only show the status
#
# Run it after the first deploy.sh. Both addresses need their own mapping: without the www one,
# Google answers www visitors with "not found". (The site then redirects www to the bare domain.)
#
# The DNS records Google asks for are already in Cloudflare, all set to "DNS only" (grey cloud):
#   davidlevine.dev      A    216.239.32.21  216.239.34.21  216.239.36.21  216.239.38.21
#   davidlevine.dev      AAAA 2001:4860:4802:32::15  …:34::15  …:36::15  …:38::15
#   www.davidlevine.dev  CNAME ghs.googlehosted.com
# Google's HTTPS certificate usually arrives 15 minutes to a few hours after the mapping is made.
set -euo pipefail

PROJECT=davidlevine-site
REGION=us-central1
SERVICE=portfolio
DOMAINS="davidlevine.dev www.davidlevine.dev"

# Domain mappings are a "beta" command, which needs an extra gcloud component.
# (Checked via the component list: a plain `gcloud beta` would silently wait for a Y/n answer.)
if [ -z "$(CLOUDSDK_CORE_DISABLE_PROMPTS=1 gcloud components list --only-local-state --filter='id=beta' --format='value(id)' 2>/dev/null)" ]; then
  echo "Installing the gcloud 'beta' component (one time, takes a minute)…"
  gcloud components install beta --quiet
fi
echo "Working… (each step can take up to a minute)"

if [ "${1:-}" != "--status" ]; then
  for D in $DOMAINS; do
    if gcloud beta run domain-mappings describe --domain "$D" --project "$PROJECT" --region "$REGION" >/dev/null 2>&1; then
      echo "$D: mapping already exists"
    else
      echo "$D: creating mapping to the '$SERVICE' service…"
      gcloud beta run domain-mappings create --service "$SERVICE" --domain "$D" --project "$PROJECT" --region "$REGION"
    fi
  done
fi

echo
for D in $DOMAINS; do
  echo "== $D =="
  echo "DNS records Google expects (should match Cloudflare):"
  gcloud beta run domain-mappings describe --domain "$D" --project "$PROJECT" --region "$REGION" \
    --format='yaml(status.resourceRecords)' || true
  echo "Status (Ready: 'True' means the certificate is issued and the address works):"
  gcloud beta run domain-mappings describe --domain "$D" --project "$PROJECT" --region "$REGION" \
    --format='yaml(status.conditions)' || true
  echo
done
echo "Not ready yet? That's normal for the first few hours. Run: bash deploy/map-domain.sh --status"
