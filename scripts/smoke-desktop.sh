#!/usr/bin/env bash
# Starts a packaged desktop app for a short while and checks that its main process came up and ran its update check.
# CI runs it on the macOS runner; it opens a real window.
#
# Usage: scripts/smoke-desktop.sh <packaged executable> [seconds]
set -euo pipefail

binary=${1:?usage: smoke-desktop.sh <packaged executable> [seconds]}
seconds=${2:-20}
log=$(mktemp)
trap 'rm -f "$log"' EXIT

fail() {
    echo "Smoke test failed: $1" >&2
    exit 1
}

"$binary" >"$log" 2>&1 &
pid=$!
sleep "$seconds"

running=true
kill -0 "$pid" 2>/dev/null || running=false
kill "$pid" 2>/dev/null || true
sleep 2
kill -9 "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true
cat "$log"

if grep -q 'A JavaScript error occurred in the main process' "$log"; then fail 'the main process threw'; fi
if [[ $running != true ]]; then fail 'the app exited on its own'; fi
# A failed check passes too: with no release published yet, or no network, that is the expected outcome.
if ! grep -Eq '\[updates\] (checked|failed):' "$log"; then fail 'the update check reported no outcome'; fi

echo 'Smoke test passed.'
