/**
 * sentiment-check-reply — Check tone of a drafted support reply.
 *
 * BIZ-041 (#133) Skeleton
 * BIZ-042 (#134) Implementation
 * BIZ-043 (#135) Sandbox fixture
 * BIZ-044 (#136) Observability
 *
 * This skill evaluates a drafted support reply for sentiment, formality,
 * empathy signals, and potential tone issues. It returns a sentiment
 * score, a list of flags for problematic phrases, and a recommended
 * action (send, revise, or escalate to a reviewer).
 */

// ── Types ────────────────────────────────────────────────────────

/** Overall sentiment classification. */
export type SentimentLabel = "positive" | "neutral" | "negative";

/** Tone aspect being evaluated. */
export type ToneAspect = "empathy" | "formality" | "clarity" | "urgency" | "frustration";

/** Recommended action based on sentiment analysis. */
export type ReplyAction = "send" | "revise" | "escalate_to_reviewer";

/** A flagged phrase that may need attention. */
export interface ToneFlag {
  /** The problematic phrase or pattern found in the reply. */
  phrase: string;
  /** Why this phrase was flagged. */
  reason: string;
  /** Which tone aspect this relates to. */
  aspect: ToneAspect;
  /** Severity: "info" for minor, "warning" for should-fix, "error" for must-fix. */
  severity: "info" | "warning" | "error";
  /** Suggested replacement or fix, if applicable. */
  suggestion?: string;
}

/** Input payload for the sentiment-check-reply skill. */
export interface SentimentCheckInput {
  /** The drafted reply text to analyze. */
  replyText: string;
  /** The original customer message (for context). */
  customerMessage?: string;
  /** The ticket priority (affects tone expectations). */
  ticketPriority?: "low" | "medium" | "high" | "critical";
  /** Whether the customer previously expressed frustration. */
  customerFrustrated?: boolean;
}

/** Output payload returned by the skill. */
export interface SentimentCheckOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Error message when success is false. */
  error?: string;
  /** Overall sentiment label. */
  sentiment: SentimentLabel;
  /** Sentiment score from -1.0 (very negative) to 1.0 (very positive). */
  sentimentScore: number;
  /** Tone aspect scores (0.0 to 1.0 for each). */
  toneScores: Record<ToneAspect, number>;
  /** Flagged phrases requiring attention. */
  flags: ToneFlag[];
  /** Recommended action before sending. */
  recommendedAction: ReplyAction;
  /** Human-readable summary of the analysis. */
  summary: string;
  /** ISO-8601 timestamp of when the analysis ran. */
  analyzedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Word lists for simple rule-based sentiment detection. */
const POSITIVE_SIGNALS = [
  "happy to help",
  "glad",
  "appreciate",
  "thank you",
  "certainly",
  "absolutely",
  "pleasure",
  "delighted",
  "great news",
  "welcome",
];

const NEGATIVE_SIGNALS = [
  "unfortunately",
  "regret",
  "sorry to hear",
  "cannot",
  "unable",
  "impossible",
  "denied",
  "rejected",
  "failure",
  "fault",
];

const EMPATHY_SIGNALS = [
  "understand",
  "frustrating",
  "appreciate your patience",
  "sorry for the inconvenience",
  "i can see",
  "that must be",
];

const PROBLEMATIC_PHRASES: Array<{
  pattern: string;
  reason: string;
  aspect: ToneAspect;
  severity: "info" | "warning" | "error";
  suggestion?: string;
}> = [
  {
    pattern: "you should have",
    reason: "Blaming language directed at the customer.",
    aspect: "empathy",
    severity: "error",
    suggestion: "Consider rephrasing to avoid blaming the customer.",
  },
  {
    pattern: "that's not our problem",
    reason: "Dismissive language.",
    aspect: "empathy",
    severity: "error",
    suggestion: "Acknowledge the issue and explain what can be done.",
  },
  {
    pattern: "as i already said",
    reason: "Condescending tone.",
    aspect: "empathy",
    severity: "warning",
    suggestion:
      "Rephrase to restate information without implying the customer should already know.",
  },
  {
    pattern: "per our policy",
    reason: "Overly formal/bureaucratic; may feel impersonal.",
    aspect: "formality",
    severity: "info",
    suggestion: "Consider explaining the reasoning behind the policy.",
  },
  {
    pattern: "please be advised",
    reason: "Stiff corporate language.",
    aspect: "formality",
    severity: "info",
    suggestion: "Use a more conversational tone.",
  },
  {
    pattern: "asap",
    reason: "Vague urgency without commitment.",
    aspect: "clarity",
    severity: "warning",
    suggestion: "Provide a specific time estimate instead.",
  },
  {
    pattern: "!!!",
    reason: "Excessive punctuation may seem unprofessional.",
    aspect: "formality",
    severity: "warning",
  },
  {
    pattern: "calm down",
    reason: "Can escalate customer frustration.",
    aspect: "empathy",
    severity: "error",
    suggestion: "Acknowledge the frustration instead.",
  },
];

/**
 * Count occurrences of patterns in text (case-insensitive).
 */
function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length;
}

/**
 * Compute a basic sentiment score from -1.0 to 1.0 based on
 * positive/negative signal density.
 */
function computeSentimentScore(text: string): number {
  const posCount = countSignals(text, POSITIVE_SIGNALS);
  const negCount = countSignals(text, NEGATIVE_SIGNALS);
  const total = posCount + negCount;
  if (total === 0) return 0;
  return (posCount - negCount) / total;
}

/**
 * Classify a numeric sentiment score into a label.
 */
function classifySentiment(score: number): SentimentLabel {
  if (score > 0.1) return "positive";
  if (score < -0.1) return "negative";
  return "neutral";
}

/**
 * Compute empathy score based on the presence of empathy signals
 * and absence of problematic phrases.
 */
function computeEmpathyScore(text: string): number {
  const empathyCount = countSignals(text, EMPATHY_SIGNALS);
  // Normalize: 3+ signals = 1.0
  return Math.min(empathyCount / 3, 1.0);
}

// ── Implementation ───────────────────────────────────────────────

/**
 * Analyze the sentiment and tone of a drafted support reply.
 *
 * @param input - The reply text and optional context.
 * @returns Sentiment score, tone flags, and recommended action.
 */
export async function execute(input: SentimentCheckInput): Promise<SentimentCheckOutput> {
  const now = new Date().toISOString();

  // Validate required fields
  if (!input.replyText || typeof input.replyText !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'replyText' in input.",
      sentiment: "neutral",
      sentimentScore: 0,
      toneScores: { empathy: 0, formality: 0, clarity: 0, urgency: 0, frustration: 0 },
      flags: [],
      recommendedAction: "revise",
      summary: "",
      analyzedAt: now,
    };
  }

  try {
    const text = input.replyText;
    const lower = text.toLowerCase();

    // Compute sentiment
    const sentimentScore = computeSentimentScore(text);
    const sentiment = classifySentiment(sentimentScore);

    // Compute tone aspect scores
    const empathy = computeEmpathyScore(text);
    const formality =
      lower.includes("dear") || lower.includes("sincerely") || lower.includes("regards")
        ? 0.8
        : 0.5;
    const clarity = text.split(/[.!?]+/).filter((s) => s.trim()).length >= 2 ? 0.7 : 0.4;
    const urgency =
      lower.includes("urgent") || lower.includes("immediately") || lower.includes("asap")
        ? 0.8
        : 0.2;
    const frustration =
      countSignals(text, ["frustrated", "annoyed", "angry", "upset"]) > 0 ? 0.6 : 0.1;

    const toneScores: Record<ToneAspect, number> = {
      empathy,
      formality,
      clarity,
      urgency,
      frustration,
    };

    // Detect problematic phrases
    const flags: ToneFlag[] = [];
    for (const rule of PROBLEMATIC_PHRASES) {
      if (lower.includes(rule.pattern.toLowerCase())) {
        flags.push({
          phrase: rule.pattern,
          reason: rule.reason,
          aspect: rule.aspect,
          severity: rule.severity,
          suggestion: rule.suggestion,
        });
      }
    }

    // Extra check: frustrated customer but no empathy signals
    if (input.customerFrustrated && empathy < 0.3) {
      flags.push({
        phrase: "(missing empathy)",
        reason: "Customer is frustrated but the reply lacks empathy signals.",
        aspect: "empathy",
        severity: "warning",
        suggestion: "Add an acknowledgment of the customer's frustration.",
      });
    }

    // Determine recommended action
    let recommendedAction: ReplyAction = "send";
    const hasErrors = flags.some((f) => f.severity === "error");
    const hasWarnings = flags.some((f) => f.severity === "warning");

    if (hasErrors) {
      recommendedAction = "escalate_to_reviewer";
    } else if (hasWarnings || sentiment === "negative") {
      recommendedAction = "revise";
    }

    // Build summary
    const flagSummary =
      flags.length > 0
        ? `Found ${flags.length} tone flag(s): ${flags.map((f) => f.aspect).join(", ")}.`
        : "No tone issues detected.";
    const summary = `Sentiment: ${sentiment} (${sentimentScore.toFixed(2)}). ${flagSummary} Recommendation: ${recommendedAction}.`;

    return {
      success: true,
      sentiment,
      sentimentScore,
      toneScores,
      flags,
      recommendedAction,
      summary,
      analyzedAt: now,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      sentiment: "neutral",
      sentimentScore: 0,
      toneScores: { empathy: 0, formality: 0, clarity: 0, urgency: 0, frustration: 0 },
      flags: [],
      recommendedAction: "revise",
      summary: "",
      analyzedAt: now,
    };
  }
}
