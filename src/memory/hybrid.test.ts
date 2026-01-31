import { describe, expect, it } from "vitest";

import {
  bm25RankToScore,
  buildFtsQuery,
  mergeHybridResults,
  mergeHybridResultsRRF,
  mergeHybridResultsNormalized,
  normalizeBm25Score,
  normalizeBm25Batch,
} from "./hybrid.js";

describe("memory hybrid helpers", () => {
  it("buildFtsQuery tokenizes and AND-joins", () => {
    expect(buildFtsQuery("hello world")).toBe('"hello" AND "world"');
    expect(buildFtsQuery("FOO_bar baz-1")).toBe('"FOO_bar" AND "baz" AND "1"');
    expect(buildFtsQuery("   ")).toBeNull();
  });

  it("bm25RankToScore is monotonic and clamped", () => {
    expect(bm25RankToScore(0)).toBeCloseTo(1);
    expect(bm25RankToScore(1)).toBeCloseTo(0.5);
    expect(bm25RankToScore(10)).toBeLessThan(bm25RankToScore(1));
    expect(bm25RankToScore(-100)).toBeCloseTo(1);
  });

  it("mergeHybridResults unions by id and combines weighted scores", () => {
    const merged = mergeHybridResults({
      vectorWeight: 0.7,
      textWeight: 0.3,
      vector: [
        {
          id: "a",
          path: "memory/a.md",
          startLine: 1,
          endLine: 2,
          source: "memory",
          snippet: "vec-a",
          vectorScore: 0.9,
        },
      ],
      keyword: [
        {
          id: "b",
          path: "memory/b.md",
          startLine: 3,
          endLine: 4,
          source: "memory",
          snippet: "kw-b",
          textScore: 1.0,
        },
      ],
    });

    expect(merged).toHaveLength(2);
    const a = merged.find((r) => r.path === "memory/a.md");
    const b = merged.find((r) => r.path === "memory/b.md");
    expect(a?.score).toBeCloseTo(0.7 * 0.9);
    expect(b?.score).toBeCloseTo(0.3 * 1.0);
  });

  it("mergeHybridResults prefers keyword snippet when ids overlap", () => {
    const merged = mergeHybridResults({
      vectorWeight: 0.5,
      textWeight: 0.5,
      vector: [
        {
          id: "a",
          path: "memory/a.md",
          startLine: 1,
          endLine: 2,
          source: "memory",
          snippet: "vec-a",
          vectorScore: 0.2,
        },
      ],
      keyword: [
        {
          id: "a",
          path: "memory/a.md",
          startLine: 1,
          endLine: 2,
          source: "memory",
          snippet: "kw-a",
          textScore: 1.0,
        },
      ],
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.snippet).toBe("kw-a");
    expect(merged[0]?.score).toBeCloseTo(0.5 * 0.2 + 0.5 * 1.0);
  });

  it("normalizeBm25Score converts negative bm25 to [0,1] range", () => {
    expect(normalizeBm25Score(0)).toBe(0);
    expect(normalizeBm25Score(-4)).toBeGreaterThan(normalizeBm25Score(-2));
    expect(normalizeBm25Score(-10)).toBeGreaterThan(normalizeBm25Score(-5));
    expect(normalizeBm25Score(-1)).toBeGreaterThan(0);
    expect(normalizeBm25Score(-1)).toBeLessThan(1);
  });

  it("normalizeBm25Batch uses min-max normalization", () => {
    const scores = [-4, -2, -1];
    const normalized = normalizeBm25Batch(scores);
    expect(normalized).toHaveLength(3);
    expect(normalized[0]).toBeCloseTo(1);
    expect(normalized[2]).toBeCloseTo(0);
    expect(normalized[1]).toBeGreaterThan(0);
    expect(normalized[1]).toBeLessThan(1);
  });

  it("normalizeBm25Batch handles single item", () => {
    expect(normalizeBm25Batch([-5])).toEqual([1]);
  });

  it("normalizeBm25Batch handles empty array", () => {
    expect(normalizeBm25Batch([])).toEqual([]);
  });

  it("mergeHybridResultsRRF combines by rank", () => {
    const merged = mergeHybridResultsRRF({
      vector: [
        { id: "a", path: "a.md", startLine: 1, endLine: 2, source: "memory", snippet: "a", vectorScore: 0.9 },
        { id: "b", path: "b.md", startLine: 1, endLine: 2, source: "memory", snippet: "b", vectorScore: 0.8 },
      ],
      keyword: [
        { id: "b", path: "b.md", startLine: 1, endLine: 2, source: "memory", snippet: "b-kw", textScore: 1.0 },
        { id: "c", path: "c.md", startLine: 1, endLine: 2, source: "memory", snippet: "c", textScore: 0.5 },
      ],
      k: 60,
    });

    expect(merged).toHaveLength(3);
    const b = merged.find((r) => r.path === "b.md");
    const a = merged.find((r) => r.path === "a.md");
    const c = merged.find((r) => r.path === "c.md");
    expect(b?.score).toBeGreaterThan(a?.score ?? 0);
    expect(b?.score).toBeGreaterThan(c?.score ?? 0);
    expect(b?.snippet).toBe("b-kw");
  });

  it("mergeHybridResultsNormalized uses normalized BM25 scores", () => {
    const rawBm25Scores = new Map([
      ["a", -4],
      ["b", -2],
    ]);
    const merged = mergeHybridResultsNormalized({
      vector: [
        { id: "a", path: "a.md", startLine: 1, endLine: 2, source: "memory", snippet: "a", vectorScore: 0.5 },
      ],
      keyword: [
        { id: "a", path: "a.md", startLine: 1, endLine: 2, source: "memory", snippet: "a-kw", textScore: 0.8 },
        { id: "b", path: "b.md", startLine: 1, endLine: 2, source: "memory", snippet: "b", textScore: 0.5 },
      ],
      vectorWeight: 0.5,
      textWeight: 0.5,
      rawBm25Scores,
    });

    expect(merged).toHaveLength(2);
    const a = merged.find((r) => r.path === "a.md");
    const b = merged.find((r) => r.path === "b.md");
    expect(a?.score).toBeGreaterThan(b?.score ?? 0);
  });
});
