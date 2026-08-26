#!/usr/bin/env bash
# Automates the exact checks run by hand during Phase 10's security audit,
# so a future change can't silently reintroduce something that audit
# confirmed was clean. Exits non-zero (failing CI) on any finding.
set -euo pipefail

FAILED=0

check() {
  local description="$1"
  local pattern="$2"
  local path="$3"
  local extra_grep_args="${4:-}"

  # shellcheck disable=SC2086
  if grep -rn $extra_grep_args -E "$pattern" "$path" 2>/dev/null | grep -v '\.test\.'; then
    echo "FAIL: $description"
    FAILED=1
  else
    echo "OK:   $description"
  fi
}

echo "Running security regression checks (see Phase 10 in the project spec for context)..."
echo

check "no dangerouslySetInnerHTML" "dangerouslySetInnerHTML" "src/"
check "no eval() or new Function()" "eval\(|new Function\(" "src/"
check "no interpolated SQL (queries using \${} instead of ? placeholders)" \
  '(SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{' "src/db/"
check "no hardcoded secret-looking literals" \
  "(api_?key|secret|password|token)\s*[:=]\s*['\"][a-zA-Z0-9]{10,}" "src/" "-i"

echo
NON_HTTPS=$(grep -rohE "http://[a-zA-Z0-9./_-]+" src/ src-tauri/ 2>/dev/null \
  | grep -v "test" | grep -v "localhost" || true)
if [ -n "$NON_HTTPS" ]; then
  echo "FAIL: non-HTTPS external URLs found:"
  echo "$NON_HTTPS"
  FAILED=1
else
  echo "OK:   no non-HTTPS external URLs (excluding localhost/test fixtures)"
fi

echo
if [ "$FAILED" -ne 0 ]; then
  echo "Security regression check FAILED."
  exit 1
fi
echo "All security regression checks passed."
