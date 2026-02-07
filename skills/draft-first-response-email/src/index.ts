/**
 * draft-first-response-email -- Draft a personalized first-response email
 * to an inbound sales lead based on their inquiry details.
 *
 * BIZ-009 to BIZ-012 (#101-#104)
 */

// -- Types ------------------------------------------------------------------

/** Input payload for the draft-first-response-email skill. */
export interface SkillInput {
  /** Lead's display name. */
  leadName: string;
  /** Lead's email address. */
  leadEmail: string;
  /** Company name (may be null for free-email leads). */
  company: string | null;
  /** The intent category from the parsed inbound email. */
  intent: string;
  /** Key phrases extracted from the original email. */
  intentSignals: string[];
  /** Sender's name to use in the signature. */
  senderName: string;
  /** Sender's title to use in the signature. */
  senderTitle: string;
  /** Optional tone override: "formal", "friendly", or "casual". Defaults to "friendly". */
  tone?: "formal" | "friendly" | "casual";
}

/** Output payload returned by the draft-first-response-email skill. */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** The generated email subject line. */
  subject: string | null;
  /** The generated email body (plain text). */
  body: string | null;
  /** Suggested call-to-action included in the email. */
  callToAction: string | null;
  /** ISO 8601 timestamp of when the draft was generated. */
  draftedAt: string;
}

// -- Helpers ----------------------------------------------------------------

/** Build an appropriate greeting based on tone. */
function buildGreeting(leadName: string, tone: "formal" | "friendly" | "casual"): string {
  switch (tone) {
    case "formal":
      return `Dear ${leadName},`;
    case "casual":
      return `Hey ${leadName}!`;
    default:
      return `Hi ${leadName},`;
  }
}

/** Build a subject line based on intent. */
function buildSubject(intent: string, company: string | null): string {
  const companyLabel = company ? ` for ${company}` : "";
  switch (intent) {
    case "demo request":
      return `Re: Demo request${companyLabel} -- next steps`;
    case "pricing inquiry":
      return `Re: Pricing details${companyLabel}`;
    case "partnership":
      return `Re: Partnership inquiry${companyLabel}`;
    case "support request":
      return `Re: Support request${companyLabel} -- we're on it`;
    default:
      return `Re: Your inquiry${companyLabel}`;
  }
}

/** Build a call-to-action based on intent. */
function buildCallToAction(intent: string): string {
  switch (intent) {
    case "demo request":
      return "Would any of the following times work for a 30-minute demo call this week?";
    case "pricing inquiry":
      return "I have attached our pricing overview. Would you like to schedule a quick call to walk through the options?";
    case "partnership":
      return "I would love to set up a call to explore how we could work together. Are you free this week?";
    case "support request":
      return "Could you share any additional details or screenshots so we can investigate right away?";
    default:
      return "Would you have time for a brief call this week to discuss further?";
  }
}

/** Build the email body paragraphs. */
function buildBody(
  leadName: string,
  company: string | null,
  intent: string,
  intentSignals: string[],
  senderName: string,
  senderTitle: string,
  tone: "formal" | "friendly" | "casual",
): string {
  const greeting = buildGreeting(leadName, tone);
  const cta = buildCallToAction(intent);

  const thankYou =
    tone === "formal" ? "Thank you for reaching out to us." : "Thanks for reaching out!";

  // Build a context line from intent signals
  let contextLine = "";
  if (intentSignals.length > 0) {
    const firstSignal = intentSignals[0].toLowerCase();
    contextLine = `I saw that you mentioned you're ${firstSignal.startsWith("i") ? firstSignal.slice(2).trim() : firstSignal}. `;
  }

  // Intent-specific paragraph
  let intentParagraph = "";
  switch (intent) {
    case "demo request":
      intentParagraph = `${contextLine}I'd be happy to set up a personalized demo to show you how our platform can help${company ? ` ${company}` : " your team"}.`;
      break;
    case "pricing inquiry":
      intentParagraph = `${contextLine}I've put together some pricing details that should cover your needs. Happy to tailor a package${company ? ` for ${company}` : ""} once we chat.`;
      break;
    case "partnership":
      intentParagraph = `${contextLine}We're always excited to explore partnership opportunities${company ? ` with companies like ${company}` : ""}.`;
      break;
    default:
      intentParagraph = `${contextLine}I'd love to learn more about what you're looking for so I can point you in the right direction.`;
  }

  const signOff = tone === "formal" ? "Kind regards," : tone === "casual" ? "Cheers," : "Best,";

  const lines = [
    greeting,
    "",
    thankYou,
    "",
    intentParagraph,
    "",
    cta,
    "",
    signOff,
    senderName,
    senderTitle,
  ];

  return lines.join("\n");
}

// -- Implementation ---------------------------------------------------------

/**
 * Execute the draft-first-response-email skill.
 *
 * @param input - Lead details and context from the parsed inbound email.
 * @returns A drafted email with subject, body, and call-to-action.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  if (!input.leadName || typeof input.leadName !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'leadName' in input.",
      subject: null,
      body: null,
      callToAction: null,
      draftedAt: new Date().toISOString(),
    };
  }

  if (!input.leadEmail || typeof input.leadEmail !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'leadEmail' in input.",
      subject: null,
      body: null,
      callToAction: null,
      draftedAt: new Date().toISOString(),
    };
  }

  try {
    const tone = input.tone ?? "friendly";
    const subject = buildSubject(input.intent, input.company);
    const callToAction = buildCallToAction(input.intent);
    const body = buildBody(
      input.leadName,
      input.company,
      input.intent,
      input.intentSignals ?? [],
      input.senderName ?? "Sales Team",
      input.senderTitle ?? "",
      tone,
    );

    // TODO: integrate with LLM for more natural, context-aware drafting
    // TODO: integrate with email-runner tool for sending the draft

    return {
      success: true,
      subject,
      body,
      callToAction,
      draftedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      subject: null,
      body: null,
      callToAction: null,
      draftedAt: new Date().toISOString(),
    };
  }
}
