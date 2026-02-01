/**
 * Exec Denylist - Defense-in-depth against dangerous command execution
 * 
 * This module provides a configurable denylist of commands that should never
 * be executed, even if they pass other safety checks. This is a defense-in-depth
 * measure to protect against potential command injection vulnerabilities.
 */

// Commands that should never be executed directly
const DANGEROUS_COMMANDS = new Set([
  // System destruction
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf ~/*',
  'dd if=/dev/zero',
  'dd if=/dev/random',
  'mkfs',
  'mkfs.ext4',
  'mkfs.xfs',
  ':(){:|:&};:',  // Fork bomb
  
  // Credential theft
  'cat /etc/shadow',
  'cat /etc/passwd',
  
  // Network attacks
  'nc -e',
  'ncat -e',
  'bash -i >& /dev/tcp',
  'python -c "import socket',
  
  // Privilege escalation attempts
  'chmod 777 /',
  'chmod -R 777',
  'chown root',
  
  // Crypto mining
  'xmrig',
  'minerd',
  'cpuminer',
]);

// Patterns that indicate potentially dangerous commands
const DANGEROUS_PATTERNS = [
  // Reverse shells
  /bash\s+-i\s+>&\s*\/dev\/tcp/i,
  /nc\s+(-e|--exec)/i,
  /ncat\s+(-e|--exec)/i,
  /python[23]?\s+-c\s+["']import\s+(socket|pty)/i,
  /perl\s+-e\s+["'].*socket/i,
  /ruby\s+-rsocket/i,
  /php\s+-r\s+["'].*fsockopen/i,
  
  // Data exfiltration
  /curl\s+.*\|\s*sh/i,
  /wget\s+.*\|\s*sh/i,
  /curl\s+.*-o\s*-\s*\|\s*bash/i,
  
  // Fork bombs
  /:\(\)\{.*:\|:.*\};:/,
  /\$\(.*\)\{.*\$\(.*\)\|.*\$\(.*\)/,
  
  // Recursive deletion from root
  /rm\s+(-rf|-fr|--recursive)\s+\/(?!\w)/,
  
  // Format commands on system drives
  /mkfs\.\w+\s+\/dev\/(sd[a-z]|nvme|hd[a-z])/i,
];

// Commands that require elevated scrutiny (warn but don't block by default)
const SENSITIVE_PATTERNS = [
  /sudo\s+/i,
  /su\s+-/i,
  /chmod\s+[0-7]{3,4}/i,
  /chown\s+/i,
  /iptables\s+/i,
  /systemctl\s+(stop|disable|mask)/i,
];

export type DenylistCheckResult = {
  blocked: boolean;
  reason?: string;
  sensitive?: boolean;
  sensitiveReason?: string;
};

/**
 * Check if a command is on the denylist
 */
export function checkCommandDenylist(command: string): DenylistCheckResult {
  const trimmed = command.trim();
  
  // Check exact matches first
  if (DANGEROUS_COMMANDS.has(trimmed)) {
    return {
      blocked: true,
      reason: `Command "${trimmed}" is on the security denylist`,
    };
  }
  
  // Check dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        reason: `Command matches dangerous pattern: ${pattern.source}`,
      };
    }
  }
  
  // Check sensitive patterns (warn but don't block)
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: false,
        sensitive: true,
        sensitiveReason: `Command matches sensitive pattern: ${pattern.source}`,
      };
    }
  }
  
  return { blocked: false };
}

/**
 * Check if a command contains any blocked subcommands
 * (for compound commands with ; | && ||)
 */
export function checkCompoundCommandDenylist(command: string): DenylistCheckResult {
  // Split on common command separators
  const subcommands = command.split(/[;&|]+/).map(s => s.trim()).filter(Boolean);
  
  for (const sub of subcommands) {
    const result = checkCommandDenylist(sub);
    if (result.blocked) {
      return result;
    }
  }
  
  // Also check the full command
  return checkCommandDenylist(command);
}

/**
 * Add a custom pattern to the denylist at runtime
 */
export function addDenylistPattern(pattern: RegExp): void {
  DANGEROUS_PATTERNS.push(pattern);
}

/**
 * Add a custom command to the denylist at runtime
 */
export function addDenylistCommand(command: string): void {
  DANGEROUS_COMMANDS.add(command.trim());
}
