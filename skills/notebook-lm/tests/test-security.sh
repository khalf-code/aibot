#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() {
    echo -e "${GREEN}PASS${NC}: $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}FAIL${NC}: $1"
    FAILED=$((FAILED + 1))
}

warn() {
    echo -e "${YELLOW}WARN${NC}: $1"
}

echo "=========================================="
echo "NotebookLM Security Tests"
echo "=========================================="
echo ""

echo "--- Test 1: Directory permissions ---"
PROFILE_DIR="$HOME/.config/moltbot/notebook-lm-chrome"
if [ -d "$PROFILE_DIR" ]; then
    PERMS=$(stat -f "%A" "$PROFILE_DIR" 2>/dev/null || stat -c "%a" "$PROFILE_DIR" 2>/dev/null)
    if [ "$PERMS" = "700" ]; then
        pass "Profile directory has secure permissions (700)"
    else
        fail "Profile directory has insecure permissions ($PERMS, expected 700)"
    fi
else
    warn "Profile directory does not exist yet (run 'notebook.sh auth' first)"
fi

echo ""
echo "--- Test 2: Parent directory permissions ---"
CONFIG_DIR="$HOME/.config/moltbot"
if [ -d "$CONFIG_DIR" ]; then
    PERMS=$(stat -f "%A" "$CONFIG_DIR" 2>/dev/null || stat -c "%a" "$CONFIG_DIR" 2>/dev/null)
    if [ "$PERMS" = "700" ]; then
        pass "Config directory has secure permissions (700)"
    else
        fail "Config directory has insecure permissions ($PERMS, expected 700)"
    fi
else
    warn "Config directory does not exist yet"
fi

echo ""
echo "--- Test 3: Security module exists ---"
if [ -f "$SKILL_DIR/scripts/security.ts" ]; then
    pass "security.ts module exists"
else
    fail "security.ts module not found"
fi

echo ""
echo "--- Test 4: Auth script imports security ---"
if grep -q "from.*security" "$SKILL_DIR/scripts/auth-setup.ts" 2>/dev/null; then
    pass "auth-setup.ts imports security module"
else
    fail "auth-setup.ts does not import security module"
fi

echo ""
echo "--- Test 5: Upload script imports security ---"
if grep -q "from.*security" "$SKILL_DIR/scripts/upload.ts" 2>/dev/null; then
    pass "upload.ts imports security module"
else
    fail "upload.ts does not import security module"
fi

echo ""
echo "--- Test 6: Security validation in auth ---"
if grep -q "requireSecureProfile\|setSecurePermissions" "$SKILL_DIR/scripts/auth-setup.ts" 2>/dev/null; then
    pass "auth-setup.ts uses security validation"
else
    fail "auth-setup.ts missing security validation"
fi

echo ""
echo "--- Test 7: Security validation in upload ---"
if grep -q "requireSecureProfile" "$SKILL_DIR/scripts/upload.ts" 2>/dev/null; then
    pass "upload.ts uses security validation"
else
    fail "upload.ts missing security validation"
fi

echo ""
echo "--- Test 8: Access logging in auth ---"
if grep -q "logAccess" "$SKILL_DIR/scripts/auth-setup.ts" 2>/dev/null; then
    pass "auth-setup.ts includes access logging"
else
    fail "auth-setup.ts missing access logging"
fi

echo ""
echo "--- Test 9: Access logging in upload ---"
if grep -q "logAccess" "$SKILL_DIR/scripts/upload.ts" 2>/dev/null; then
    pass "upload.ts includes access logging"
else
    fail "upload.ts missing access logging"
fi

echo ""
echo "--- Test 10: No world-readable files in profile ---"
if [ -d "$PROFILE_DIR" ]; then
    INSECURE_FILES=$(find "$PROFILE_DIR" -type f -perm +044 2>/dev/null | head -5)
    if [ -z "$INSECURE_FILES" ]; then
        pass "No world/group readable files in profile"
    else
        fail "Found world/group readable files in profile"
        echo "  Examples: $INSECURE_FILES"
    fi
else
    warn "Profile directory does not exist yet"
fi

echo ""
echo "=========================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=========================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
exit 0
