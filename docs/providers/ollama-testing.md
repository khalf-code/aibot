# Testing Ollama Integration

This guide covers how to test that Ollama models work correctly with Clawdbot.

## Prerequisites

1. **Ollama is running:**
   ```bash
   ollama serve
   # Or check if it's already running:
   curl http://localhost:11434/api/tags
   ```

2. **Ollama models are installed:**
   ```bash
   ollama list
   # Pull a model if needed:
   ollama pull llama3.2
   ```

3. **Ollama is configured in Clawdbot:**
   ```bash
   # Set API key (any value works for local Ollama)
   export OLLAMA_API_KEY="ollama-local"
   # Or configure in config file:
   clawdbot config set models.providers.ollama.apiKey "ollama-local"
   ```

## Step 1: Verify Configuration

### Check baseUrl is correct
```bash
clawdbot config get models.providers.ollama.baseUrl
# Should output: http://localhost:11434/v1
# (or http://127.0.0.1:11434/v1)
```

### Verify models.json has correct baseUrl
```bash
cat ~/.clawdbot/agents/main/agent/models.json | jq '.providers.ollama.baseUrl'
# Should output: "http://localhost:11434/v1"
```

### Test Ollama API directly
```bash
curl -s http://localhost:11434/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:latest","prompt":"test","max_tokens":5}' \
  | jq -r '.choices[0].text // .error.message'
# Should return text, not an error
```

## Step 2: Verify Model Discovery

### List available Ollama models
```bash
clawdbot models list | grep ollama
# Should show your Ollama models, e.g.:
# ollama/llama3.2:latest    text    195k    yes    yes    default,configured
```

### Check model details
```bash
clawdbot models list --json | jq '.[] | select(.id | startswith("ollama/"))'
```

## Step 3: Test Model Execution

### Test via CLI (local/embedded mode)
```bash
# Simple test
clawdbot agent \
  --message "Say hello in one word" \
  --local \
  --session-id test-ollama-$(date +%s) \
  --thinking low

# With specific model
clawdbot agent \
  --message "What is 2+2?" \
  --local \
  --model ollama/llama3.2:latest \
  --session-id test-ollama-$(date +%s)
```

### Test via Gateway (if gateway is running)
```bash
# Check gateway status
./scripts/gateway-status.sh

# Send message via gateway
clawdbot agent \
  --message "Hello from Ollama" \
  --session-id test-gateway-$(date +%s)
```

### Test with default model set
```bash
# Set Ollama as default
clawdbot config set agents.defaults.model.primary "ollama/llama3.2:latest"

# Test (will use default)
clawdbot agent \
  --message "Count to 3" \
  --local \
  --session-id test-default-$(date +%s)
```

## Step 4: Verify Logs

### Check for successful model initialization
```bash
tail -100 /tmp/clawdbot/clawdbot-*.log | grep -i "ollama\|llama3.2"
# Should see:
# - "agent model: ollama/llama3.2:latest"
# - "embedded run start: ... provider=ollama model=llama3.2:latest"
```

### Check for API errors
```bash
tail -100 /tmp/clawdbot/clawdbot-*.log | grep -i "error\|fail" | grep -i "ollama\|11434"
# Should NOT see connection errors or 404 errors
```

## Step 5: Test Different Models

### Test multiple Ollama models
```bash
# Test different models
for model in llama3.2:latest qwen2.5:7b deepseek-r1:32b; do
  echo "Testing $model..."
  clawdbot agent \
    --message "Say hi" \
    --local \
    --model "ollama/$model" \
    --session-id "test-$model-$(date +%s)" \
    --thinking low
done
```

## Step 6: Test Tool Calling (if model supports it)

### Test with tools enabled
```bash
clawdbot agent \
  --message "What's the weather like?" \
  --local \
  --model ollama/llama3.2:latest \
  --session-id test-tools-$(date +%s)
# Models with tool support should attempt to use tools
```

## Troubleshooting

### Issue: Models not listed
- **Check:** `OLLAMA_API_KEY` is set or configured
- **Check:** Ollama is running: `curl http://localhost:11434/api/tags`
- **Check:** Models are installed: `ollama list`

### Issue: baseUrl error
- **Check:** baseUrl includes `/v1`: `clawdbot config get models.providers.ollama.baseUrl`
- **Fix:** `clawdbot config set models.providers.ollama.baseUrl "http://localhost:11434/v1"`

### Issue: Connection refused
- **Check:** Ollama is running: `ps aux | grep ollama`
- **Check:** Port is correct: `lsof -iTCP:11434 -sTCP:LISTEN`
- **Restart:** `ollama serve`

### Issue: Model not found
- **Check:** Model exists: `ollama list | grep <model-name>`
- **Pull model:** `ollama pull <model-name>`
- **Verify:** `clawdbot models list | grep ollama`

### Issue: Timeout or slow response
- **Check:** Model size and system resources
- **Try:** Smaller model or increase timeout
- **Check logs:** Look for timeout errors

## Expected Results

✅ **Success indicators:**
- Models appear in `clawdbot models list`
- baseUrl is `http://localhost:11434/v1` (with `/v1`)
- API test returns text, not errors
- Logs show "provider=ollama model=..." without errors
- Agent commands complete successfully
- Responses are generated from Ollama models

❌ **Failure indicators:**
- baseUrl missing `/v1` → 404 errors
- Connection refused → Ollama not running
- Model not found → Model not installed
- Timeout → Model too slow or system overloaded

## Quick Test Script

```bash
#!/bin/bash
# Quick Ollama integration test

echo "=== Testing Ollama Integration ==="

# 1. Check Ollama is running
echo "1. Checking Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
  echo "   ✓ Ollama is running"
else
  echo "   ✗ Ollama is not running. Start with: ollama serve"
  exit 1
fi

# 2. Check baseUrl
echo "2. Checking baseUrl..."
BASE_URL=$(clawdbot config get models.providers.ollama.baseUrl 2>/dev/null | grep -v "punycode\|DEP0040\|Use node" | tail -1)
if [[ "$BASE_URL" == *"/v1"* ]]; then
  echo "   ✓ baseUrl is correct: $BASE_URL"
else
  echo "   ✗ baseUrl is missing /v1: $BASE_URL"
  echo "   Fix with: clawdbot config set models.providers.ollama.baseUrl 'http://localhost:11434/v1'"
  exit 1
fi

# 3. Test API
echo "3. Testing Ollama API..."
API_TEST=$(curl -s http://localhost:11434/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:latest","prompt":"test","max_tokens":2}' \
  | jq -r 'if .choices then "ok" else "error" end')
if [ "$API_TEST" = "ok" ]; then
  echo "   ✓ Ollama API is working"
else
  echo "   ✗ Ollama API test failed"
  exit 1
fi

# 4. Check models are listed
echo "4. Checking model discovery..."
MODEL_COUNT=$(clawdbot models list 2>/dev/null | grep -c "ollama/" || echo "0")
if [ "$MODEL_COUNT" -gt 0 ]; then
  echo "   ✓ Found $MODEL_COUNT Ollama model(s)"
else
  echo "   ✗ No Ollama models found"
  exit 1
fi

# 5. Test model execution
echo "5. Testing model execution..."
SESSION_ID="test-$(date +%s)"
RESULT=$(timeout 30 clawdbot agent \
  --message "Say hello" \
  --local \
  --session-id "$SESSION_ID" \
  --thinking low 2>&1)

if echo "$RESULT" | grep -q "error\|Error\|ERROR"; then
  echo "   ✗ Model execution failed"
  echo "$RESULT" | tail -5
  exit 1
else
  echo "   ✓ Model execution successful"
fi

echo ""
echo "=== All tests passed! ==="
```
