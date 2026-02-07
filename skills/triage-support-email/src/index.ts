/**
 * triage-support-email -- Triage an inbound support email by classifying
 * category, priority, sentiment, and suggested routing.
 *
 * BIZ-025 to BIZ-028 (#117-#120)
 */

// -- Types ------------------------------------------------------------------

/** Input payload for the triage-support-email skill. */
export interface SkillInput {
  /** Raw email sender address (e.g. "John Smith <john@acme.com>"). */
  from: string;
  /** Email subject line. */
  subject: string;
  /** Plain-text body of the support email. */
  body: string;
  /** Optional existing ticket/case ID if this is a reply. */
  existingTicketId?: string;
  /** Optional customer tier: "free", "pro", "enterprise". */
  customerTier?: "free" | "pro" | "enterprise";
}

/** Output payload returned by the triage-support-email skill. */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** Support category classification. */
  category: string | null;
  /** Sub-category for more granular routing. */
  subCategory: string | null;
  /** Priority level: low, medium, high, or critical. */
  priority: "low" | "medium" | "high" | "critical";
  /** Detected sentiment: positive, neutral, negative, or angry. */
  sentiment: "positive" | "neutral" | "negative" | "angry";
  /** Suggested team/queue to route the ticket to. */
  suggestedRoute: string | null;
  /** Whether this appears to be an existing ticket reply. */
  isReply: boolean;
  /** Key topics/keywords extracted from the email. */
  topics: string[];
  /** Whether the email mentions a potential churn/cancellation signal. */
  churnRisk: boolean;
  /** ISO 8601 timestamp of when the triage ran. */
  triagedAt: string;
}

// -- Helpers ----------------------------------------------------------------

/** Categories and their keyword signals. */
const CATEGORY_RULES: Array<{
  category: string;
  subCategory: string;
  keywords: string[];
}> = [
  {
    category: "billing",
    subCategory: "invoice",
    keywords: ["invoice", "receipt", "charge", "payment"],
  },
  {
    category: "billing",
    subCategory: "subscription",
    keywords: ["subscription", "plan", "upgrade", "downgrade", "cancel"],
  },
  {
    category: "billing",
    subCategory: "refund",
    keywords: ["refund", "money back", "credit"],
  },
  {
    category: "technical",
    subCategory: "bug",
    keywords: ["bug", "error", "crash", "broken", "not working", "fails"],
  },
  {
    category: "technical",
    subCategory: "integration",
    keywords: ["api", "integration", "webhook", "connect", "oauth"],
  },
  {
    category: "technical",
    subCategory: "performance",
    keywords: ["slow", "timeout", "latency", "performance", "speed"],
  },
  {
    category: "account",
    subCategory: "access",
    keywords: ["login", "password", "access", "locked out", "2fa", "mfa"],
  },
  {
    category: "account",
    subCategory: "settings",
    keywords: ["settings", "configure", "setup", "preferences"],
  },
  {
    category: "feature-request",
    subCategory: "enhancement",
    keywords: ["feature", "request", "wish", "would be nice", "suggestion"],
  },
  {
    category: "general",
    subCategory: "question",
    keywords: ["how do i", "how to", "can i", "is it possible", "question"],
  },
];

/** Detect category and sub-category from text. */
function classifyCategory(
  subject: string,
  body: string,
): { category: string; subCategory: string } {
  const text = `${subject} ${body}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return { category: rule.category, subCategory: rule.subCategory };
    }
  }

  return { category: "general", subCategory: "other" };
}

/** Detect sentiment from text. */
function detectSentiment(text: string): "positive" | "neutral" | "negative" | "angry" {
  const lower = text.toLowerCase();
  const angryKeywords = [
    "furious",
    "unacceptable",
    "terrible",
    "worst",
    "outrage",
    "ridiculous",
    "scam",
    "lawsuit",
    "awful",
  ];
  const negativeKeywords = [
    "frustrated",
    "disappointed",
    "annoyed",
    "unhappy",
    "problem",
    "issue",
    "complaint",
    "dissatisfied",
  ];
  const positiveKeywords = [
    "thank",
    "great",
    "love",
    "excellent",
    "amazing",
    "happy",
    "appreciate",
    "wonderful",
  ];

  if (angryKeywords.some((kw) => lower.includes(kw))) return "angry";
  if (negativeKeywords.some((kw) => lower.includes(kw))) return "negative";
  if (positiveKeywords.some((kw) => lower.includes(kw))) return "positive";
  return "neutral";
}

/** Determine priority based on category, sentiment, and customer tier. */
function determinePriority(
  category: string,
  sentiment: "positive" | "neutral" | "negative" | "angry",
  customerTier: string | undefined,
  text: string,
): "low" | "medium" | "high" | "critical" {
  const lower = text.toLowerCase();

  // Critical: enterprise customer with angry sentiment or service-down language
  if (
    customerTier === "enterprise" &&
    (sentiment === "angry" || lower.includes("down") || lower.includes("outage"))
  ) {
    return "critical";
  }

  // High: angry sentiment, billing issues, or enterprise customers
  if (sentiment === "angry") return "high";
  if (customerTier === "enterprise") return "high";
  if (category === "billing" && sentiment === "negative") return "high";

  // Medium: negative sentiment, technical bugs, or pro customers
  if (sentiment === "negative") return "medium";
  if (category === "technical") return "medium";
  if (customerTier === "pro") return "medium";

  return "low";
}

/** Suggest a routing queue based on category. */
function suggestRoute(category: string, subCategory: string): string {
  switch (category) {
    case "billing":
      return "billing-team";
    case "technical":
      return subCategory === "integration" ? "integrations-team" : "engineering-support";
    case "account":
      return "account-team";
    case "feature-request":
      return "product-team";
    default:
      return "general-support";
  }
}

/** Extract topic keywords from the text. */
function extractTopics(subject: string, body: string): string[] {
  const text = `${subject} ${body}`.toLowerCase();
  const allKeywords = CATEGORY_RULES.flatMap((r) => r.keywords);
  return [...new Set(allKeywords.filter((kw) => text.includes(kw)))];
}

/** Detect churn risk signals. */
function detectChurnRisk(text: string): boolean {
  const lower = text.toLowerCase();
  const churnKeywords = [
    "cancel",
    "cancellation",
    "leave",
    "switch",
    "competitor",
    "alternative",
    "unsubscribe",
    "close my account",
    "delete my account",
    "not renewing",
  ];
  return churnKeywords.some((kw) => lower.includes(kw));
}

// -- Implementation ---------------------------------------------------------

/**
 * Execute the triage-support-email skill.
 *
 * @param input - The raw support email fields.
 * @returns Triage classification with category, priority, sentiment, and routing.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  if (!input.from || typeof input.from !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'from' field in input.",
      category: null,
      subCategory: null,
      priority: "low",
      sentiment: "neutral",
      suggestedRoute: null,
      isReply: false,
      topics: [],
      churnRisk: false,
      triagedAt: new Date().toISOString(),
    };
  }

  if (!input.body || typeof input.body !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'body' field in input.",
      category: null,
      subCategory: null,
      priority: "low",
      sentiment: "neutral",
      suggestedRoute: null,
      isReply: false,
      topics: [],
      churnRisk: false,
      triagedAt: new Date().toISOString(),
    };
  }

  try {
    const fullText = `${input.subject ?? ""} ${input.body}`;
    const { category, subCategory } = classifyCategory(input.subject ?? "", input.body);
    const sentiment = detectSentiment(fullText);
    const priority = determinePriority(category, sentiment, input.customerTier, fullText);
    const suggestedRoute = suggestRoute(category, subCategory);
    const topics = extractTopics(input.subject ?? "", input.body);
    const churnRisk = detectChurnRisk(fullText);
    const isReply = !!input.existingTicketId;

    // TODO: integrate with LLM for more nuanced classification
    // TODO: integrate with ticketing system (Zendesk, Freshdesk, etc.)
    // TODO: auto-assign based on agent availability and skills

    return {
      success: true,
      category,
      subCategory,
      priority,
      sentiment,
      suggestedRoute,
      isReply,
      topics,
      churnRisk,
      triagedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      category: null,
      subCategory: null,
      priority: "low",
      sentiment: "neutral",
      suggestedRoute: null,
      isReply: false,
      topics: [],
      churnRisk: false,
      triagedAt: new Date().toISOString(),
    };
  }
}
