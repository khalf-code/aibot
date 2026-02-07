/**
 * generate-support-response -- Generate a draft support response based on
 * triage classification and knowledge base context.
 *
 * BIZ-029 to BIZ-032 (#121-#124)
 */

// -- Types ------------------------------------------------------------------

/** A suggested knowledge-base article to reference. */
export interface KBArticle {
  /** Article title. */
  title: string;
  /** Article URL. */
  url: string;
}

/** Input payload for the generate-support-response skill. */
export interface SkillInput {
  /** Customer's display name. */
  customerName: string;
  /** Customer's email address. */
  customerEmail: string;
  /** Original email subject. */
  originalSubject: string;
  /** Original email body (for context). */
  originalBody: string;
  /** Triage category (from triage-support-email). */
  category: string;
  /** Triage sub-category. */
  subCategory: string;
  /** Triage priority. */
  priority: "low" | "medium" | "high" | "critical";
  /** Triage sentiment. */
  sentiment: "positive" | "neutral" | "negative" | "angry";
  /** Support agent name for the signature. */
  agentName: string;
  /** Optional tone override: "empathetic", "professional", or "concise". Defaults to "empathetic". */
  tone?: "empathetic" | "professional" | "concise";
  /** Optional ticket/case ID to reference. */
  ticketId?: string;
}

/** Output payload returned by the generate-support-response skill. */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** Generated email subject line. */
  subject: string | null;
  /** Generated email body (plain text). */
  body: string | null;
  /** Internal note for the support agent (not sent to customer). */
  internalNote: string | null;
  /** Suggested KB articles to include or reference. */
  suggestedArticles: KBArticle[];
  /** Whether the response recommends escalation. */
  shouldEscalate: boolean;
  /** ISO 8601 timestamp of when the response was generated. */
  generatedAt: string;
}

// -- Helpers ----------------------------------------------------------------

/** Build an appropriate greeting based on sentiment and tone. */
function buildGreeting(
  customerName: string,
  sentiment: string,
  tone: "empathetic" | "professional" | "concise",
): string {
  if (tone === "concise") {
    return `Hi ${customerName},`;
  }
  if (sentiment === "angry" || sentiment === "negative") {
    return `Hi ${customerName},`;
  }
  return `Hi ${customerName},`;
}

/** Build an empathy/acknowledgment line based on sentiment. */
function buildAcknowledgment(
  sentiment: string,
  tone: "empathetic" | "professional" | "concise",
): string {
  if (tone === "concise") {
    return "Thank you for reaching out.";
  }

  switch (sentiment) {
    case "angry":
      return "I completely understand your frustration, and I sincerely apologize for the inconvenience. This is not the experience we want for our customers.";
    case "negative":
      return "I'm sorry to hear you're experiencing this issue. I understand how frustrating this must be, and I want to help resolve it as quickly as possible.";
    case "positive":
      return "Thank you so much for reaching out! I'm happy to help.";
    default:
      return "Thank you for contacting our support team. I'm here to help.";
  }
}

/** Build category-specific response content. */
function buildCategoryResponse(category: string, subCategory: string, priority: string): string {
  switch (category) {
    case "billing":
      switch (subCategory) {
        case "refund":
          return "I've reviewed your account and I'm looking into the refund request. I'll need to verify a few details before processing this.";
        case "subscription":
          return "I've pulled up your subscription details. Let me walk you through the available options.";
        default:
          return "I've checked your billing records and am ready to assist with your inquiry.";
      }
    case "technical":
      if (priority === "critical") {
        return "I've flagged this as a critical issue and our engineering team has been notified. We're actively investigating and will provide updates as we learn more.";
      }
      switch (subCategory) {
        case "bug":
          return "I've been able to reproduce the issue you described and have filed it with our engineering team. Here's what we know so far:";
        case "integration":
          return "I've checked our API status and reviewed the integration configuration. Here are some steps that should help resolve this:";
        case "performance":
          return "I've reviewed your account's performance metrics. Here are some recommendations:";
        default:
          return "I've looked into the technical details of your request. Here's what I found:";
      }
    case "account":
      return "I've reviewed your account status. For security purposes, I'll need to verify your identity before making any changes. Here are the next steps:";
    case "feature-request":
      return "Thank you for the suggestion! I've logged your feature request with our product team. We really value this kind of feedback from our users.";
    default:
      return "I've reviewed your inquiry and I'm happy to provide some guidance:";
  }
}

/** Determine whether escalation is recommended. */
function shouldEscalate(priority: string, sentiment: string, category: string): boolean {
  if (priority === "critical") return true;
  if (sentiment === "angry" && priority === "high") return true;
  if (category === "billing" && sentiment === "angry") return true;
  return false;
}

/** Generate relevant KB article suggestions based on category. */
function suggestArticles(category: string, subCategory: string): KBArticle[] {
  // Stub KB articles -- production would search a real knowledge base
  const articleMap: Record<string, KBArticle[]> = {
    "technical:bug": [
      {
        title: "Troubleshooting Common Errors",
        url: "https://docs.openclaw.ai/support/troubleshooting",
      },
      {
        title: "Known Issues and Workarounds",
        url: "https://docs.openclaw.ai/support/known-issues",
      },
    ],
    "technical:integration": [
      {
        title: "API Integration Guide",
        url: "https://docs.openclaw.ai/api/integration-guide",
      },
      {
        title: "Webhook Configuration",
        url: "https://docs.openclaw.ai/api/webhooks",
      },
    ],
    "technical:performance": [
      {
        title: "Performance Best Practices",
        url: "https://docs.openclaw.ai/guides/performance",
      },
    ],
    "billing:subscription": [
      {
        title: "Managing Your Subscription",
        url: "https://docs.openclaw.ai/billing/subscriptions",
      },
    ],
    "billing:refund": [
      {
        title: "Refund Policy",
        url: "https://docs.openclaw.ai/billing/refund-policy",
      },
    ],
    "account:access": [
      {
        title: "Account Recovery Guide",
        url: "https://docs.openclaw.ai/account/recovery",
      },
      {
        title: "Two-Factor Authentication",
        url: "https://docs.openclaw.ai/account/2fa",
      },
    ],
  };

  const key = `${category}:${subCategory}`;
  return (
    articleMap[key] ?? [
      {
        title: "Help Center",
        url: "https://docs.openclaw.ai/support",
      },
    ]
  );
}

/** Build an internal note for the agent. */
function buildInternalNote(
  priority: string,
  sentiment: string,
  category: string,
  escalate: boolean,
): string {
  const lines: string[] = [];

  if (escalate) {
    lines.push(
      "ESCALATION RECOMMENDED: This ticket should be escalated to a senior agent or team lead.",
    );
  }

  lines.push(`Category: ${category} | Priority: ${priority} | Sentiment: ${sentiment}`);

  if (sentiment === "angry") {
    lines.push("Note: Customer is expressing strong frustration. Use extra care in communication.");
  }

  if (priority === "critical") {
    lines.push("Note: Critical priority. Aim for response within 1 hour.");
  } else if (priority === "high") {
    lines.push("Note: High priority. Aim for response within 4 hours.");
  }

  return lines.join("\n");
}

// -- Implementation ---------------------------------------------------------

/**
 * Execute the generate-support-response skill.
 *
 * @param input - Triage data and customer context.
 * @returns A drafted support response with internal notes and KB suggestions.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  if (!input.customerName || typeof input.customerName !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'customerName' in input.",
      subject: null,
      body: null,
      internalNote: null,
      suggestedArticles: [],
      shouldEscalate: false,
      generatedAt: new Date().toISOString(),
    };
  }

  if (!input.originalBody || typeof input.originalBody !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'originalBody' in input.",
      subject: null,
      body: null,
      internalNote: null,
      suggestedArticles: [],
      shouldEscalate: false,
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const tone = input.tone ?? "empathetic";
    const greeting = buildGreeting(input.customerName, input.sentiment, tone);
    const acknowledgment = buildAcknowledgment(input.sentiment, tone);
    const categoryResponse = buildCategoryResponse(
      input.category,
      input.subCategory,
      input.priority,
    );
    const escalate = shouldEscalate(input.priority, input.sentiment, input.category);
    const articles = suggestArticles(input.category, input.subCategory);
    const internalNote = buildInternalNote(
      input.priority,
      input.sentiment,
      input.category,
      escalate,
    );

    // Build subject
    const ticketRef = input.ticketId ? ` [${input.ticketId}]` : "";
    const subject = `Re: ${input.originalSubject}${ticketRef}`;

    // Build body
    const signOff =
      tone === "concise"
        ? "Best,"
        : "Please don't hesitate to reach out if you have any other questions.\n\nBest regards,";

    const articleSection =
      articles.length > 0
        ? `\nYou might also find these resources helpful:\n${articles.map((a) => `- ${a.title}: ${a.url}`).join("\n")}\n`
        : "";

    const body = [
      greeting,
      "",
      acknowledgment,
      "",
      categoryResponse,
      articleSection,
      signOff,
      input.agentName,
      "Support Team",
    ].join("\n");

    // TODO: integrate with LLM for more context-aware, personalized responses
    // TODO: integrate with knowledge base search for relevant articles
    // TODO: integrate with email-runner for sending the response

    return {
      success: true,
      subject,
      body,
      internalNote,
      suggestedArticles: articles,
      shouldEscalate: escalate,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      subject: null,
      body: null,
      internalNote: null,
      suggestedArticles: [],
      shouldEscalate: false,
      generatedAt: new Date().toISOString(),
    };
  }
}
