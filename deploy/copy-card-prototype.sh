#!/usr/bin/env bash
# Copy the card payment prototype from the card-payoff project into this site, so the two don't drift apart.
# Run it after the prototype changes, then commit. It only copies the three prototype files, nothing else.
set -euo pipefail
cd "$(dirname "$0")/.."
FROM="${1:-../card-payoff/prototype}"; TO=public/prototypes/card-payment
mkdir -p "$TO"
for f in index.html app.js styles.css; do cp "$FROM/$f" "$TO/$f"; done
echo "Copied from $FROM. Changes:"; git status --short "$TO"
