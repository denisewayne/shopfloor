#!/usr/bin/env bash
# Copy compiled AMD modules from build/ into the SuiteCloud project so
# `suitecloud project:deploy` uploads them to the File Cabinet.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="suitecloud/src/FileCabinet/SuiteScripts/netsuite-ts-framework"
[ -d build ] || { echo "build/ missing. Run npm run build first." >&2; exit 1; }
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R build/. "$DEST/"
echo "Staged $(find "$DEST" -name '*.js' | wc -l | tr -d ' ') files into $DEST"
