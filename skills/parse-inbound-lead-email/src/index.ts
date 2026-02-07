/**
 * parse-inbound-lead-email -- Parse an inbound lead email and extract
 * sender details, company info, intent signals, and urgency.
 *
 * BIZ-001 to BIZ-004 (#93-#96)
 */

// -- Types ------------------------------------------------------------------

/** Input payload for the parse-inbound-lead-email skill. */
export interface SkillInput {
  /** Raw email sender address (e.g. "Jane Doe <jane@acme.com>"). */
  from: string;
  /** Email subject line. */
  subject: string;
  /** Plain-text body of the inbound email. */
  body: string;
  /** Optional RFC 2822 Date header value. */
  receivedAt?: string;
}

/** Structured data extracted from the inbound lead email. */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** Sender's display name, if extractable. */
  senderName: string | null;
  /** Sender's email address. */
  senderEmail: string | null;
  /** Company or organization name detected in the email. */
  company: string | null;
  /** Inferred intent category (e.g. "pricing inquiry", "demo request", "partnership"). */
  intent: string | null;
  /** Urgency level: low, medium, or high. */
  urgency: "low" | "medium" | "high";
  /** Key phrases or sentences that signal buying intent. */
  intentSignals: string[];
  /** ISO 8601 timestamp of when the parsing ran. */
  parsedAt: string;
}

// -- Helpers ----------------------------------------------------------------

/**
 * Extract display name and email from a "Name <email>" string.
 * Falls back to treating the whole string as an email if no angle brackets.
 */
function parseFromHeader(from: string): {
  name: string | null;
  email: string | null;
} {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  }
  // Bare email address
  const emailMatch = from.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return { name: null, email: emailMatch ? emailMatch[0].toLowerCase() : null };
}

/**
 * Derive a company name from the email domain.
 * Strips common providers (gmail, yahoo, outlook, hotmail).
 */
function companyFromDomain(email: string | null): string | null {
  if (!email) return null;
  const domain = email.split("@")[1];
  if (!domain) return null;
  const freeProviders = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "protonmail.com",
  ];
  if (freeProviders.includes(domain)) return null;
  // Use the second-level domain label as a rough company name
  const parts = domain.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

/** Simple urgency heuristic based on keyword presence. */
function detectUrgency(subject: string, body: string): "low" | "medium" | "high" {
  const text = `${subject} ${body}`.toLowerCase();
  const highKeywords = ["urgent", "asap", "immediately", "critical", "deadline today"];
  const mediumKeywords = ["soon", "this week", "priority", "time-sensitive", "next steps"];
  if (highKeywords.some((kw) => text.includes(kw))) return "high";
  if (mediumKeywords.some((kw) => text.includes(kw))) return "medium";
  return "low";
}

/** Detect intent category from subject + body text. */
function detectIntent(subject: string, body: string): string | null {
  const text = `${subject} ${body}`.toLowerCase();
  if (text.includes("demo") || text.includes("trial")) return "demo request";
  if (text.includes("pricing") || text.includes("cost") || text.includes("quote"))
    return "pricing inquiry";
  if (text.includes("partner") || text.includes("integration")) return "partnership";
  if (text.includes("support") || text.includes("help") || text.includes("issue"))
    return "support request";
  return "general inquiry";
}

/** Extract sentences that look like buying signals. */
function extractIntentSignals(body: string): string[] {
  const signals: string[] = [];
  const sentences = body
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords = [
    "interested",
    "looking for",
    "need",
    "budget",
    "timeline",
    "demo",
    "pricing",
    "evaluate",
    "decision",
    "purchase",
    "buy",
    "subscribe",
    "upgrade",
    "contract",
    "proposal",
  ];
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      signals.push(sentence);
    }
  }
  return signals;
}

// -- Implementation ---------------------------------------------------------

/**
 * Execute the parse-inbound-lead-email skill.
 *
 * @param input - The raw email fields (from, subject, body).
 * @returns Structured lead data extracted from the email.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  if (!input.from || typeof input.from !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'from' field in input.",
      senderName: null,
      senderEmail: null,
      company: null,
      intent: null,
      urgency: "low",
      intentSignals: [],
      parsedAt: new Date().toISOString(),
    };
  }

  if (!input.body || typeof input.body !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'body' field in input.",
      senderName: null,
      senderEmail: null,
      company: null,
      intent: null,
      urgency: "low",
      intentSignals: [],
      parsedAt: new Date().toISOString(),
    };
  }

  try {
    const { name, email } = parseFromHeader(input.from);
    const company = companyFromDomain(email);
    const urgency = detectUrgency(input.subject ?? "", input.body);
    const intent = detectIntent(input.subject ?? "", input.body);
    const intentSignals = extractIntentSignals(input.body);

    // TODO: integrate with email-runner tool for fetching raw email if needed
    // TODO: use NLP/LLM for more sophisticated intent and entity extraction

    return {
      success: true,
      senderName: name,
      senderEmail: email,
      company,
      intent,
      urgency,
      intentSignals,
      parsedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      senderName: null,
      senderEmail: null,
      company: null,
      intent: null,
      urgency: "low",
      intentSignals: [],
      parsedAt: new Date().toISOString(),
    };
  }
}
