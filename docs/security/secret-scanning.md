# Secret Scanning

OpenClaw implements layered secret detection to prevent accidental commits of sensitive credentials (API keys, tokens, passwords, etc.).

## Architecture

### 1. Pre-Commit Hook (`git-hooks/pre-commit`)

Automatically runs on every `git commit` and blocks commits if secrets are detected.

- Runs before code formatting to catch secrets early
- Executes `scripts/check-secrets.sh` to scan staged files
- Falls back to code formatting if no secrets are found

**Hook Installation:**
The `prepare` script in `package.json` automatically configures git to use the `git-hooks/` directory:

```bash
pnpm install  # This runs 'prepare' script
# Equivalent to: git config core.hooksPath git-hooks
```

### 2. Secret Patterns (`.secretscanrc`)

Configuration file defining detection patterns for common secret types:

- **Critical Severity:**
  - AWS Access Keys (AKIA...)
  - AWS Secret Access Keys
  - Private Keys (RSA, DSA, EC)
  - GitHub Tokens
  - Discord Bot Tokens
  - Slack Tokens
  - Database Connection Strings
  - Stripe API Keys
  - Azure Connection Strings

- **High Severity:**
  - Generic API Keys
  - Passwords (assignments)
  - OAuth Tokens
  - JWT Tokens
  - Telegram Bot Tokens
  - Google API Keys

### 3. Check Script (`scripts/check-secrets.sh`)

Bash script that scans staged files using regex patterns defined in `.secretscanrc`.

**Features:**

- Scans only staged files (not entire repository)
- Skips binary files and known lock files
- Ignores test/example/placeholder content
- Returns exit code 1 if secrets found (blocks commit)
- Provides clear error messages and remediation steps

**Manual Usage:**

```bash
bash scripts/check-secrets.sh
```

### 4. Detect-Secrets Baseline (`.secrets.baseline`)

The repository also uses the `detect-secrets` library (installed via dependencies) for additional entropy-based detection.

This baseline file tracks known/allowed secrets and integrates with CI pipelines.

## Usage

### Normal Workflow

Just commit normally—the pre-commit hook runs automatically:

```bash
git add src/myfeature.ts
git commit -m "feat: my change"
# Hook runs → checks for secrets → allows commit if clean
```

### If Secrets Are Detected

If the hook blocks a commit:

1. **Review the error message** to see what pattern matched
2. **Unstage the file:**
   ```bash
   git reset HEAD <file>
   ```
3. **Edit the file** to remove the secret:
   - Replace with placeholder/example if needed
   - Use environment variables for runtime secrets
4. **Re-stage and commit:**
   ```bash
   git add <file>
   git commit -m "fix: message"
   ```

### Bypassing the Hook (Emergency Only)

**Not recommended**, but if absolutely necessary:

```bash
git commit --no-verify
```

This disables all pre-commit hooks. Use only in emergencies and immediately notify the team if you commit a real secret—it should be rotated immediately.

## Adding New Patterns

To add detection for a new secret type:

1. **Edit `.secretscanrc`:** Add pattern to the `patterns` array:

   ```json
   {
     "name": "New Service Token",
     "pattern": "newservice_[A-Za-z0-9]{40}",
     "severity": "critical"
   }
   ```

2. **Update `scripts/check-secrets.sh`:** Add the pattern to the `PATTERNS` associative array:

   ```bash
   declare -A PATTERNS=(
     ...
     ["NEW_SERVICE"]="newservice_[A-Za-z0-9]{40}"
   )
   ```

3. **Test locally:**

   ```bash
   bash scripts/check-secrets.sh
   ```

4. **Commit the changes** (if they don't contain the pattern you're testing):
   ```bash
   git add .secretscanrc scripts/check-secrets.sh
   git commit -m "security: add detection for new service tokens"
   ```

## Handling False Positives

If a pattern is matching legitimate test data or examples:

1. **In `.secretscanrc`:** Update the `allowed_patterns` array to include keywords that should be ignored:

   ```json
   "allowed_patterns": [
     "example",
     "test",
     "fake",
     "dummy",
     "myservice_test_token"  // specific placeholder
   ]
   ```

2. **In `scripts/check-secrets.sh`:** The script already checks for these keywords before raising an alarm.

3. **Commit the allowlist update:**
   ```bash
   git add .secretscanrc
   git commit -m "security: allowlist test tokens for new service"
   ```

## CI/CD Integration

Secret scanning also runs in GitHub Actions (if configured). The pre-commit hook catches issues locally first, preventing them from reaching CI.

## Best Practices

1. **Never commit real secrets** into any branch, even private repos
2. **Use environment variables** for API keys and tokens in code
3. **Use `.env.example`** to document required env vars (without values)
4. **Rotate immediately** if a secret is accidentally committed
5. **Document placeholders** in code comments (e.g., `// Replace with real token`)

## Troubleshooting

### Hook Not Running

Ensure hooks are configured:

```bash
git config core.hooksPath
# Should output: git-hooks
```

If not set, run:

```bash
pnpm install  # Re-runs 'prepare' script
```

### False Negatives

If a secret type isn't being detected:

1. Check if the pattern exists in `.secretscanrc`
2. Test the regex pattern:
   ```bash
   echo "your-secret-here" | grep -EP "pattern"
   ```
3. Add the pattern if missing (see "Adding New Patterns" above)

### Script Permission Errors

If `check-secrets.sh` fails with "Permission denied":

```bash
chmod +x scripts/check-secrets.sh
```

## References

- `.secretscanrc` – Pattern definitions
- `scripts/check-secrets.sh` – Scanning implementation
- `git-hooks/pre-commit` – Hook entry point
- `.secrets.baseline` – Detect-secrets configuration
