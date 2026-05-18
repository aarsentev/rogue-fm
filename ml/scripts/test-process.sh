#!/usr/bin/env bash
# Phase 2.2 smoke test: trigger processing for "Radio X.mp3" and poll status.
set -u

BASE="http://localhost:3000"
DB="$(cd "$(dirname "$0")/.." && pwd)/dev.db"

echo "== checking dev server =="
if ! curl -fsS "$BASE/api/stations" >/dev/null 2>&1; then
  echo "FAIL: $BASE/api/stations not reachable. Is 'npm run dev' running?"
  exit 1
fi
echo "ok"

RID="$(sqlite3 "$DB" "SELECT id FROM Recording WHERE filename='Radio X.mp3' LIMIT 1;")"
if [ -z "$RID" ]; then
  echo "FAIL: no recording for 'Radio X.mp3' in $DB"
  exit 1
fi
echo "recording id: $RID"

echo
echo "== POST /process =="
curl -s -X POST "$BASE/api/recordings/$RID/process"
echo

echo
echo "== polling (5s interval, max ~3min) =="
for i in $(seq 1 36); do
  sleep 5
  BODY="$(curl -s "$BASE/api/recordings/$RID")"
  STATUS="$(printf '%s' "$BODY" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["processingStatus"], d.get("processing"), len(d["segments"]))' 2>/dev/null || echo "PARSE_FAIL")"
  echo "[$i] $STATUS"
  case "$STATUS" in
    done*) break ;;
    failed*) echo "processing FAILED — check the npm run dev console for python stderr"; break ;;
    PARSE_FAIL) echo "raw response: ${BODY:0:200}" ;;
  esac
done

echo
echo "== first 12 segments =="
curl -s "$BASE/api/recordings/$RID" | python3 -c '
import sys, json
d = json.load(sys.stdin)
print("status:", d["processingStatus"], "segments:", len(d["segments"]))
for s in d["segments"][:12]:
    print("%8.1f - %8.1f  %s" % (s["startSec"], s["endSec"], s["type"]))
'
