import fs from "node:fs";
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

const HEALTH_FILE = path.join(homedir(), ".openclaw", "health-stats.json");

export class HealthManager {
  private static instance: HealthManager;
  private stats: HealthStore = {};

  private constructor() {
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
      if (fs.existsSync(HEALTH_FILE)) {
        this.stats = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf-8"));
      }
    } catch {
      // ignore
    }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(HEALTH_FILE), { recursive: true });
      fs.writeFileSync(HEALTH_FILE, JSON.stringify(this.stats, null, 2));
    } catch {
      // ignore
    }
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

    // Penalize consecutive failures heavily
    let score = 100;
    score -= s.consecutiveFailures * 20;

    // Decay penalty over time for failures (recovery)
    if (s.lastFailure) {
      const minutesSinceFailure = (Date.now() - s.lastFailure) / 60000;
      if (minutesSinceFailure > 30) {
        // Recover score if it's been a while
        score += Math.min(20, minutesSinceFailure);
      }
    }

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
