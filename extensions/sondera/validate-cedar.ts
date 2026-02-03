/**
 * Cedar Policy Validator
 *
 * Validates that all Cedar policy files are syntactically correct.
 */

import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import fs from "fs";
import path from "path";

const extensionDir = path.dirname(new URL(import.meta.url).pathname);

interface ValidationResult {
  file: string;
  valid: boolean;
  policyCount: number;
  errors: string[];
  warnings: string[];
}

function validatePolicyFile(filePath: string): ValidationResult {
  const fileName = path.basename(filePath);
  const result: ValidationResult = {
    file: fileName,
    valid: true,
    policyCount: 0,
    errors: [],
    warnings: [],
  };

  try {
    const policyText = fs.readFileSync(filePath, "utf-8");

    // Count policies by looking for permit/forbid statements
    const policyMatches = policyText.match(/(permit|forbid)\s*\(\s*principal/g);
    result.policyCount = policyMatches?.length ?? 0;

    // Extract @id annotations for better error reporting
    const idMatches = policyText.match(/@id\s*\(\s*"([^"]+)"\s*\)/g);
    const policyIds = idMatches?.map(m => m.match(/"([^"]+)"/)?.[1]) ?? [];

    // Try to parse each policy individually for better error reporting
    const policyRegex = /(?:@id\s*\(\s*"([^"]+)"\s*\)\s*)?(permit|forbid)\s*\(\s*principal\s*,\s*action\s*,\s*resource\s*\)\s*(?:when\s*\{[^}]*\})?\s*;/g;

    let match;
    let policyIndex = 0;
    while ((match = policyRegex.exec(policyText)) !== null) {
      const policyId = match[1] || `policy${policyIndex}`;
      const policyBody = match[0].replace(/@id\s*\([^)]*\)\s*/, '').trim();

      // Try to use Cedar to validate this single policy
      try {
        const testResult = cedar.isAuthorized({
          principal: { type: "User", id: "test" },
          action: { type: "Sondera::Action", id: "test" },
          resource: { type: "Resource", id: "test" },
          context: { params: { command: "test" } },
          policies: {
            staticPolicies: { [policyId]: policyBody },
          },
          entities: [],
        });

        if (testResult.type === "failure") {
          result.valid = false;
          const errorMsgs = testResult.errors?.map((e: { message: string }) => e.message) || ["Unknown error"];
          result.errors.push(`Policy "${policyId}": ${errorMsgs.join("; ")}`);
        }
      } catch (err) {
        result.valid = false;
        result.errors.push(`Policy "${policyId}": ${err instanceof Error ? err.message : String(err)}`);
      }

      policyIndex++;
    }

    // Check for common issues (skip comments)
    const nonCommentLines = policyText.split('\n').filter(line => !line.trim().startsWith('//'));
    const nonCommentText = nonCommentLines.join('\n');
    if (nonCommentText.includes(":(){ :|:& };:")) {
      result.warnings.push("Fork bomb pattern contains special characters that may not parse correctly");
    }

    if (result.policyCount === 0) {
      result.warnings.push("No policies found in file");
    }

  } catch (err) {
    result.valid = false;
    result.errors.push(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

// Main validation
console.log("═══════════════════════════════════════════════════════════════");
console.log("                    Cedar Policy Validator");
console.log("═══════════════════════════════════════════════════════════════\n");

const policyFiles = [
  path.resolve(extensionDir, "policy-sondera-base.cedar"),
  path.resolve(extensionDir, "policy-openclaw-system.cedar"),
  path.resolve(extensionDir, "policy-owasp-agentic.cedar"),
];

let allValid = true;
const results: ValidationResult[] = [];

for (const file of policyFiles) {
  if (fs.existsSync(file)) {
    const result = validatePolicyFile(file);
    results.push(result);
    if (!result.valid) {
      allValid = false;
    }
  } else {
    console.log(`⚠️  File not found: ${path.basename(file)}`);
  }
}

// Print results
for (const result of results) {
  const status = result.valid ? "✅" : "❌";
  console.log(`${status} ${result.file}`);
  console.log(`   Policies: ${result.policyCount}`);

  if (result.errors.length > 0) {
    console.log("   Errors:");
    for (const error of result.errors) {
      console.log(`     ❌ ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("   Warnings:");
    for (const warning of result.warnings) {
      console.log(`     ⚠️  ${warning}`);
    }
  }

  console.log("");
}

// Summary
console.log("═══════════════════════════════════════════════════════════════");
if (allValid) {
  const totalPolicies = results.reduce((sum, r) => sum + r.policyCount, 0);
  console.log(`✅ All policies valid! (${totalPolicies} total policies)`);
} else {
  console.log("❌ Some policies have errors. Please fix them before use.");
  process.exit(1);
}
console.log("═══════════════════════════════════════════════════════════════");
