/**
 * Deep Research keyword detection
 * @see docs/sdd/deep-research/keyword-detection.md
 */

const DEEP_RESEARCH_PATTERNS = [
  // Group 1: Russian "депресерч"
  "сделай депресерч",
  "сделать депресерч",
  "сделайте депресерч",
  "запусти депресерч",
  "нужен депресерч",
  "депресерч по",
  "депресерч на тему",
  "депресерч про",
  // Group 2: Russian phonetic
  "сделай дип рисерч",
  "дип рисерч",
  // Group 3: English
  "deep research",
  "deepresearch",
  "do deep research",
  "run deep research",
  "start deep research",
  // Group 4: Mixed
  "сделай deep research",
  "сделать deep research",
  "запусти deep research",
  // Group 5: Standalone
  "депресерч",
  "дипресерч",
] as const;

/**
 * Detect if message contains deep research intent
 * @param message - User message text
 * @param customPatterns - Optional custom patterns from config
 * @returns true if deep research intent detected
 */
export function detectDeepResearchIntent(
  message: string,
  customPatterns?: readonly string[],
): boolean {
  const patterns = customPatterns ?? DEEP_RESEARCH_PATTERNS;
  const normalized = message.toLowerCase();
  return patterns.some((pattern) =>
    normalized.includes(pattern.toLowerCase()),
  );
}

/**
 * Extract topic from message by removing trigger keywords
 * @param message - Original user message
 * @param customPatterns - Optional custom patterns from config
 * @returns Extracted topic or original message
 */
export function extractTopicFromMessage(
  message: string,
  customPatterns?: readonly string[],
): string {
  const normalized = message.toLowerCase();
  const patterns = customPatterns ?? DEEP_RESEARCH_PATTERNS;

  // Find the latest matching pattern (prefer longer at same index)
  let matchStart = -1;
  let matchLength = 0;
  for (const pattern of patterns) {
    const patternLower = pattern.toLowerCase();
    const index = normalized.indexOf(patternLower);
    if (index === -1) continue;
    if (index > matchStart || (index === matchStart && pattern.length > matchLength)) {
      matchStart = index;
      matchLength = pattern.length;
    }
  }

  if (matchStart === -1) return message;

  let topic = `${message.slice(0, matchStart)}${message.slice(
    matchStart + matchLength,
  )}`;

  topic = topic.replace(/\s+/g, " ").trim();
  topic = topic.replace(/^[\s:,\.\-—]+/, "").trim();

  const commandPrefixes = ["сделай", "сделать", "сделайте", "запусти"];
  const prepositionPrefixes = ["про", "по", "на тему"];

  const loweredTopic = topic.toLowerCase();
  for (const prefix of commandPrefixes) {
    if (loweredTopic.startsWith(`${prefix} `)) {
      topic = topic.slice(prefix.length).trim();
      break;
    }
  }

  const loweredAfterCommand = topic.toLowerCase();
  for (const prefix of prepositionPrefixes) {
    if (loweredAfterCommand.startsWith(`${prefix} `)) {
      topic = topic.slice(prefix.length).trim();
      break;
    }
  }

  return topic || message;
}

/**
 * Get all default patterns (for testing/config)
 */
export function getDefaultPatterns(): readonly string[] {
  return DEEP_RESEARCH_PATTERNS;
}
