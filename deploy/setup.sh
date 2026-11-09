#!/usr/bin/env bash
# One-time setup of the Google Cloud project for davidlevine.dev. Safe to run again.
#   bash deploy/setup.sh
#
# What it does, in plain terms:
#   1. turns on the Google services Cloud Run needs
#   2. makes a "service account" for the running site, with no permissions at all
#      (a static website doesn't need to touch anything else in Google Cloud)
#   3. lets Google's build service build the site
set -euo pipefail

PROJECT=davidlevine-site
SA=portfolio-run
SA_EMAIL="$SA@$PROJECT.iam.gserviceaccount.com"

echo "Project: $PROJECT (signed in as $(gcloud config get-value account 2>/dev/null))"

echo; echo "1/3  Turning on the Google services Cloud Run needs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROJECT"

echo; echo "2/3  Creating a service account for the running site (no permissions)"
gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA" --project "$PROJECT" --display-name "Portfolio on Cloud Run"

echo; echo "3/3  Letting Google's build service build the site"
NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
for ROLE in roles/cloudbuild.builds.builder roles/storage.objectViewer roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$NUM-compute@developer.gserviceaccount.com" \
    --role "$ROLE" --condition=None >/dev/null
done

echo; echo "Setup done. Next: bash deploy/deploy.sh"
