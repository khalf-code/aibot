import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

// Simple health stats
type HealthStats = {
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastFailure?: number;
  lastSuccess?: number;
  avgLatency?: number; // moving average
};

type HealthStore = Record<string, HealthStats>;

function resolveHealthFile(): string {
  const base = process.env.OPENCLAW_HOME || path.join(homedir(), ".openclaw");
  return path.join(base, "health-stats.json");
}

export class HealthManager {
  private static instance: HealthManager;
  private stats: HealthStore = {};
  private saveTimer: NodeJS.Timeout | null = null;
  private healthFile: string;

  private constructor() {
    this.healthFile = resolveHealthFile();
    this.load();
  }

  static getInstance(): HealthManager {
    if (!HealthManager.instance) {
      HealthManager.instance = new HealthManager();
    }
    return HealthManager.instance;
  }

  private load() {
    try {
      if (fs.existsSync(this.healthFile)) {
        this.stats = JSON.parse(fs.readFileSync(this.healthFile, "utf-8"));
      }
    } catch {
      // ignore
    }
  }

  private save() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(async () => {
      try {
        await fsPromises.mkdir(path.dirname(this.healthFile), { recursive: true });
        await fsPromises.writeFile(this.healthFile, JSON.stringify(this.stats, null, 2));
      } catch {
        // ignore
      } finally {
        this.saveTimer = null;
      }
    }, 5000); // Debounce 5s
  }

  private getKey(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  recordSuccess(provider: string, model: string, latencyMs: number) {
    const key = this.getKey(provider, model);
    if (!this.stats[key]) {
      this.stats[key] = { successes: 0, failures: 0, consecutiveFailures: 0 };
    }
    const s = this.stats[key];
    s.successes++;
    s.consecutiveFailures = 0;
    s.lastSuccess = Date.now();

    // Simple moving average for latency
    if (s.avgLatency === undefined) {
      s.avgLatency = latencyMs;
    } else {
      s.avgLatency = s.avgLatency * 0.9 + latencyMs * 0.1;
    }

    this.save();
  }

  recordFailure(provider: string, model: string) {
    const key = this.getKey(provider, model);
    if (!this.stats[key]) {
      this.stats[key] = { successes: 0, failures: 0, consecutiveFailures: 0 };
    }
    const s = this.stats[key];
    s.failures++;
    s.consecutiveFailures++;
    s.lastFailure = Date.now();
    this.save();
  }

  getScore(provider: string, model: string): number {
    const key = this.getKey(provider, model);
    const s = this.stats[key];
    if (!s) {
      return 100; // Default score
    }

    // Check for recovery based on time
    if (s.lastFailure && s.consecutiveFailures > 0) {
      const minutesSinceFailure = (Date.now() - s.lastFailure) / 60000;
      if (minutesSinceFailure > 60) {
        // Full reset after 1 hour
        s.consecutiveFailures = 0;
      } else if (minutesSinceFailure > 10) {
        // Partial recovery: reduce consecutive failure count effectively for scoring
        // We don't mutate state here to avoid flapping, just adjust calculation
      }
    }

    // Penalize consecutive failures heavily
    let score = 100;
    // Effective failures decay over time for scoring purposes
    let effectiveFailures = s.consecutiveFailures;
    if (s.lastFailure) {
      const minutesSinceFailure = (Date.now() - s.lastFailure) / 60000;
      // Reduce effective failures by 1 for every 5 minutes passed
      const recovery = Math.floor(minutesSinceFailure / 5);
      effectiveFailures = Math.max(0, effectiveFailures - recovery);
    }

    score -= effectiveFailures * 20;

    // Bonus for high success rate / low latency could go here

    return Math.max(0, score);
  }

  sortCandidates(
    candidates: { provider: string; model: string }[],
  ): { provider: string; model: string }[] {
    return candidates.toSorted((a, b) => {
      const scoreA = this.getScore(a.provider, a.model);
      const scoreB = this.getScore(b.provider, b.model);
      return scoreB - scoreA; // Descending score
    });
  }
}
