export type HybridSource = string;

export type HybridFusionMethod = "weighted" | "rrf" | "normalized";

export type HybridMergeResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: HybridSource;
};

export type HybridVectorResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: HybridSource;
  snippet: string;
  vectorScore: number;
};

export type HybridKeywordResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: HybridSource;
  snippet: string;
  textScore: number;
};

export function buildFtsQuery(raw: string): string | null {
  const tokens =
    raw
      .match(/[A-Za-z0-9_]+/g)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"`);
  return quoted.join(" AND ");
}

export function bm25RankToScore(rank: number): number {
  const normalized = Number.isFinite(rank) ? Math.max(0, rank) : 999;
  return 1 / (1 + normalized);
}

/**
 * Convert SQLite FTS5 bm25() score to a normalized [0,1] range.
 *
 * FTS5 bm25() returns negative values where more negative = better match.
 * For example: -4.2 is better than -2.1
 *
 * This function converts to positive and applies sigmoid normalization
 * to bring values into [0,1] range compatible with cosine similarity.
 *
 * @param bm25Score - Raw bm25() score from FTS5 (negative, more negative = better)
 * @param k - Sigmoid steepness factor (default 0.5, tune based on score distribution)
 */
export function normalizeBm25Score(bm25Score: number, k = 0.5): number {
  if (!Number.isFinite(bm25Score)) return 0;
  const positive = -bm25Score;
  if (positive <= 0) return 0;
  return 1 - 1 / (1 + k * positive);
}

/**
 * Normalize a batch of BM25 scores using min-max normalization.
 * This ensures scores are in [0,1] range relative to the result set.
 *
 * @param scores - Array of raw bm25() scores (negative values)
 * @returns Array of normalized scores in [0,1] range
 */
export function normalizeBm25Batch(scores: number[]): number[] {
  if (scores.length === 0) return [];
  if (scores.length === 1) return [1];

  const positives = scores.map((s) => (Number.isFinite(s) ? -s : 0));
  const min = Math.min(...positives);
  const max = Math.max(...positives);
  const range = max - min;

  if (range === 0) return scores.map(() => 1);

  return positives.map((p) => (p - min) / range);
}

export function mergeHybridResults(params: {
  vector: HybridVectorResult[];
  keyword: HybridKeywordResult[];
  vectorWeight: number;
  textWeight: number;
}): Array<{
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: HybridSource;
}> {
  const byId = new Map<
    string,
    {
      id: string;
      path: string;
      startLine: number;
      endLine: number;
      source: HybridSource;
      snippet: string;
      vectorScore: number;
      textScore: number;
    }
  >();

  for (const r of params.vector) {
    byId.set(r.id, {
      id: r.id,
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      source: r.source,
      snippet: r.snippet,
      vectorScore: r.vectorScore,
      textScore: 0,
    });
  }

  for (const r of params.keyword) {
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = r.textScore;
      if (r.snippet && r.snippet.length > 0) existing.snippet = r.snippet;
    } else {
      byId.set(r.id, {
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        vectorScore: 0,
        textScore: r.textScore,
      });
    }
  }

  const merged = Array.from(byId.values()).map((entry) => {
    const score = params.vectorWeight * entry.vectorScore + params.textWeight * entry.textScore;
    return {
      path: entry.path,
      startLine: entry.startLine,
      endLine: entry.endLine,
      score,
      snippet: entry.snippet,
      source: entry.source,
    };
  });

  return merged.sort((a, b) => b.score - a.score);
}

/**
 * Merge hybrid results using Reciprocal Rank Fusion (RRF).
 *
 * RRF is rank-based and doesn't require score normalization.
 * Formula: RRF(d) = sum(1 / (k + rank_i(d))) for each retriever i
 *
 * @param k - RRF constant (typically 60)
 */
export function mergeHybridResultsRRF(params: {
  vector: HybridVectorResult[];
  keyword: HybridKeywordResult[];
  k?: number;
}): HybridMergeResult[] {
  const k = params.k ?? 60;

  const vectorRanks = new Map<string, number>();
  params.vector.forEach((r, i) => vectorRanks.set(r.id, i + 1));

  const keywordRanks = new Map<string, number>();
  params.keyword.forEach((r, i) => keywordRanks.set(r.id, i + 1));

  const byId = new Map<
    string,
    {
      id: string;
      path: string;
      startLine: number;
      endLine: number;
      source: HybridSource;
      snippet: string;
      vectorRank: number | null;
      keywordRank: number | null;
    }
  >();

  for (const r of params.vector) {
    byId.set(r.id, {
      id: r.id,
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      source: r.source,
      snippet: r.snippet,
      vectorRank: vectorRanks.get(r.id) ?? null,
      keywordRank: null,
    });
  }

  for (const r of params.keyword) {
    const existing = byId.get(r.id);
    if (existing) {
      existing.keywordRank = keywordRanks.get(r.id) ?? null;
      if (r.snippet && r.snippet.length > 0) existing.snippet = r.snippet;
    } else {
      byId.set(r.id, {
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        vectorRank: null,
        keywordRank: keywordRanks.get(r.id) ?? null,
      });
    }
  }

  const merged = Array.from(byId.values()).map((entry) => {
    let score = 0;
    if (entry.vectorRank !== null) {
      score += 1 / (k + entry.vectorRank);
    }
    if (entry.keywordRank !== null) {
      score += 1 / (k + entry.keywordRank);
    }
    return {
      path: entry.path,
      startLine: entry.startLine,
      endLine: entry.endLine,
      score,
      snippet: entry.snippet,
      source: entry.source,
    };
  });

  return merged.sort((a, b) => b.score - a.score);
}

/**
 * Merge hybrid results with normalized BM25 scores for true score fusion.
 *
 * This method normalizes BM25 scores to [0,1] range using min-max normalization
 * within the result set, making them comparable to cosine similarity scores.
 *
 * @param rawBm25Scores - Map of id -> raw bm25() score for normalization
 */
export function mergeHybridResultsNormalized(params: {
  vector: HybridVectorResult[];
  keyword: HybridKeywordResult[];
  vectorWeight: number;
  textWeight: number;
  rawBm25Scores: Map<string, number>;
}): HybridMergeResult[] {
  const rawScores = Array.from(params.rawBm25Scores.values());
  const normalizedBm25 = normalizeBm25Batch(rawScores);
  const scoreById = new Map<string, number>();
  let i = 0;
  for (const id of params.rawBm25Scores.keys()) {
    scoreById.set(id, normalizedBm25[i] ?? 0);
    i++;
  }

  const byId = new Map<
    string,
    {
      id: string;
      path: string;
      startLine: number;
      endLine: number;
      source: HybridSource;
      snippet: string;
      vectorScore: number;
      textScore: number;
    }
  >();

  for (const r of params.vector) {
    byId.set(r.id, {
      id: r.id,
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      source: r.source,
      snippet: r.snippet,
      vectorScore: r.vectorScore,
      textScore: 0,
    });
  }

  for (const r of params.keyword) {
    const normalizedScore = scoreById.get(r.id) ?? 0;
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = normalizedScore;
      if (r.snippet && r.snippet.length > 0) existing.snippet = r.snippet;
    } else {
      byId.set(r.id, {
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        vectorScore: 0,
        textScore: normalizedScore,
      });
    }
  }

  const merged = Array.from(byId.values()).map((entry) => {
    const score = params.vectorWeight * entry.vectorScore + params.textWeight * entry.textScore;
    return {
      path: entry.path,
      startLine: entry.startLine,
      endLine: entry.endLine,
      score,
      snippet: entry.snippet,
      source: entry.source,
    };
  });

  return merged.sort((a, b) => b.score - a.score);
}
