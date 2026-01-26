#!/usr/bin/env bash
# Quick test script for Ollama integration

set -euo pipefail

echo "=== Testing Ollama Integration ==="
echo ""

# 1. Check Ollama is running
echo "1. Checking Ollama is running..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "   ✓ Ollama is running"
else
  echo "   ✗ Ollama is not running. Start with: ollama serve"
  exit 1
fi

# 2. Check baseUrl
echo "2. Checking baseUrl configuration..."
BASE_URL=$(pnpm clawdbot config get models.providers.ollama.baseUrl 2>/dev/null | grep -v "punycode\|DEP0040\|Use node\|trace-deprecation" | tail -1 | xargs)
if [[ "$BASE_URL" == *"/v1"* ]]; then
  echo "   ✓ baseUrl is correct: $BASE_URL"
else
  echo "   ✗ baseUrl is missing /v1: $BASE_URL"
  echo "   Fix with: pnpm clawdbot config set models.providers.ollama.baseUrl 'http://localhost:11434/v1'"
  exit 1
fi

# 3. Test API directly
echo "3. Testing Ollama API directly..."
API_TEST=$(curl -s http://localhost:11434/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:latest","prompt":"test","max_tokens":2}' 2>/dev/null \
  | jq -r 'if .choices then "ok" else "error" end' 2>/dev/null || echo "error")
if [ "$API_TEST" = "ok" ]; then
  echo "   ✓ Ollama API is working"
else
  echo "   ✗ Ollama API test failed"
  echo "   Make sure Ollama is running and llama3.2:latest is installed"
  exit 1
fi

# 4. Check models are discovered
echo "4. Checking model discovery..."
MODEL_COUNT=$(pnpm clawdbot models list 2>/dev/null | grep -c "ollama/" || echo "0")
if [ "$MODEL_COUNT" -gt 0 ]; then
  echo "   ✓ Found $MODEL_COUNT Ollama model(s)"
  pnpm clawdbot models list 2>/dev/null | grep "ollama/" | head -3 | sed 's/^/      /'
else
  echo "   ✗ No Ollama models found"
  echo "   Make sure OLLAMA_API_KEY is set or configured"
  exit 1
fi

# 5. Test model execution (optional, can be slow)
if [ "${TEST_EXECUTION:-}" = "1" ]; then
  echo "5. Testing model execution..."
  SESSION_ID="test-ollama-$(date +%s)"
  if timeout 30 pnpm clawdbot agent \
    --message "Say hello in one word" \
    --local \
    --session-id "$SESSION_ID" \
    --thinking low > /tmp/ollama-test-output.log 2>&1; then
    echo "   ✓ Model execution successful"
    echo "   Response preview:"
    tail -5 /tmp/ollama-test-output.log | sed 's/^/      /'
  else
    echo "   ⚠ Model execution had issues (check /tmp/ollama-test-output.log)"
    echo "   This might be normal if the model is slow or requires more setup"
  fi
else
  echo "5. Skipping model execution test (set TEST_EXECUTION=1 to enable)"
fi

echo ""
echo "=== Basic tests passed! ==="
echo ""
echo "To test model execution, run:"
echo "  TEST_EXECUTION=1 ./scripts/test-ollama.sh"
echo ""
echo "Or test manually:"
echo "  pnpm clawdbot agent --message 'Hello' --local --session-id test-$(date +%s)"
