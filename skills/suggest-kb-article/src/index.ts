/**
 * suggest-kb-article — Suggest relevant knowledge base articles for a ticket.
 *
 * BIZ-037 (#129) Skeleton
 * BIZ-038 (#130) Implementation
 * BIZ-039 (#131) Sandbox fixture
 * BIZ-040 (#132) Observability
 *
 * This skill takes a support ticket's subject and body, extracts key
 * topics, and returns a ranked list of knowledge base articles that
 * may help resolve the issue. It uses keyword extraction and
 * similarity scoring to match ticket content against article metadata.
 */

// ── Types ────────────────────────────────────────────────────────

/** A knowledge base article returned as a suggestion. */
export interface KbArticle {
  /** Unique article identifier. */
  articleId: string;
  /** Human-readable article title. */
  title: string;
  /** URL to the article in the knowledge base. */
  url: string;
  /** Short excerpt or summary of the article content. */
  excerpt: string;
  /** Tags or categories associated with the article. */
  tags: string[];
  /** Relevance score from 0.0 (no match) to 1.0 (perfect match). */
  relevanceScore: number;
}

/** Input payload for the suggest-kb-article skill. */
export interface SuggestKbInput {
  /** Support ticket subject line. */
  subject: string;
  /** Full ticket body or customer message. */
  body: string;
  /** Optional product or category to narrow the search. */
  product?: string;
  /** Maximum number of articles to return (default: 5). */
  maxResults?: number;
  /** Optional language code to filter articles (e.g. "en", "es"). */
  language?: string;
}

/** Output payload returned by the skill. */
export interface SuggestKbOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Error message when success is false. */
  error?: string;
  /** Keywords extracted from the ticket for matching. */
  extractedKeywords: string[];
  /** Ranked list of suggested articles, highest relevance first. */
  suggestions: KbArticle[];
  /** Total number of articles searched. */
  articlesSearched: number;
  /** ISO-8601 timestamp of when the suggestion was generated. */
  suggestedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Extract keywords from text by splitting on whitespace, lowering case,
 * removing common stop words, and deduplicating.
 *
 * This is a simplified extraction; a production implementation would use
 * TF-IDF or embedding-based similarity.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "need",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "out",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "and",
    "but",
    "or",
    "nor",
    "not",
    "so",
    "yet",
    "both",
    "either",
    "neither",
    "each",
    "every",
    "all",
    "any",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "only",
    "own",
    "same",
    "than",
    "too",
    "very",
    "just",
    "because",
    "if",
    "when",
    "where",
    "how",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "it",
    "its",
    "they",
    "them",
    "their",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return [...new Set(words)];
}

/**
 * Score an article against extracted keywords using simple
 * keyword overlap. Returns a value between 0.0 and 1.0.
 */
function scoreArticle(article: KbArticle, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const articleText = `${article.title} ${article.excerpt} ${article.tags.join(" ")}`.toLowerCase();
  const matches = keywords.filter((kw) => articleText.includes(kw));
  return matches.length / keywords.length;
}

// ── Stub KB corpus ───────────────────────────────────────────────

/**
 * Simulated knowledge base corpus for development/testing.
 * In production, this is replaced by an API call to the KB search endpoint.
 */
const STUB_ARTICLES: KbArticle[] = [
  {
    articleId: "KB-001",
    title: "How to reset your password",
    url: "https://kb.example.com/articles/KB-001",
    excerpt:
      "Step-by-step instructions for resetting your account password via email or SMS verification.",
    tags: ["password", "authentication", "account", "login"],
    relevanceScore: 0,
  },
  {
    articleId: "KB-002",
    title: "Troubleshooting billing errors",
    url: "https://kb.example.com/articles/KB-002",
    excerpt: "Common billing error codes, how to read your invoice, and steps to dispute a charge.",
    tags: ["billing", "invoice", "payment", "error", "charge"],
    relevanceScore: 0,
  },
  {
    articleId: "KB-003",
    title: "Setting up two-factor authentication",
    url: "https://kb.example.com/articles/KB-003",
    excerpt: "Enable 2FA on your account using an authenticator app or hardware security key.",
    tags: ["2fa", "security", "authentication", "mfa"],
    relevanceScore: 0,
  },
  {
    articleId: "KB-004",
    title: "API rate limits and throttling",
    url: "https://kb.example.com/articles/KB-004",
    excerpt:
      "Understanding API rate limits, HTTP 429 responses, and best practices for retry logic.",
    tags: ["api", "rate-limit", "throttling", "429", "retry"],
    relevanceScore: 0,
  },
  {
    articleId: "KB-005",
    title: "Data export and GDPR requests",
    url: "https://kb.example.com/articles/KB-005",
    excerpt:
      "How to request a full data export or submit a GDPR deletion request for your account.",
    tags: ["gdpr", "data-export", "privacy", "deletion", "compliance"],
    relevanceScore: 0,
  },
  {
    articleId: "KB-006",
    title: "Connecting third-party integrations",
    url: "https://kb.example.com/articles/KB-006",
    excerpt:
      "Guide to connecting Slack, Jira, Salesforce, and other integrations with your workspace.",
    tags: ["integration", "slack", "jira", "salesforce", "webhook"],
    relevanceScore: 0,
  },
  {
    articleId: "KB-007",
    title: "Understanding your invoice line items",
    url: "https://kb.example.com/articles/KB-007",
    excerpt:
      "Breakdown of each line item on your monthly invoice including seats, overages, and add-ons.",
    tags: ["invoice", "billing", "line-items", "seats", "overages"],
    relevanceScore: 0,
  },
  {
    articleId: "KB-008",
    title: "Mobile app installation and setup",
    url: "https://kb.example.com/articles/KB-008",
    excerpt: "Download and configure the mobile app on iOS and Android devices.",
    tags: ["mobile", "ios", "android", "setup", "installation"],
    relevanceScore: 0,
  },
];

// ── Implementation ───────────────────────────────────────────────

/**
 * Suggest knowledge base articles for a support ticket.
 *
 * @param input - Ticket subject, body, and optional filters.
 * @returns Ranked list of relevant KB articles.
 */
export async function execute(input: SuggestKbInput): Promise<SuggestKbOutput> {
  const now = new Date().toISOString();

  // Validate required fields
  if (!input.subject || typeof input.subject !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'subject' in input.",
      extractedKeywords: [],
      suggestions: [],
      articlesSearched: 0,
      suggestedAt: now,
    };
  }

  try {
    const maxResults = input.maxResults ?? 5;
    const combinedText = `${input.subject} ${input.body ?? ""}`;
    const keywords = extractKeywords(combinedText);

    // Score and rank articles
    const scored = STUB_ARTICLES.map((article) => ({
      ...article,
      relevanceScore: scoreArticle(article, keywords),
    }));

    // Filter articles with non-zero relevance and sort descending
    const ranked = scored
      .filter((a) => a.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    return {
      success: true,
      extractedKeywords: keywords,
      suggestions: ranked,
      articlesSearched: STUB_ARTICLES.length,
      suggestedAt: now,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      extractedKeywords: [],
      suggestions: [],
      articlesSearched: 0,
      suggestedAt: now,
    };
  }
}
