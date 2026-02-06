import type { ContextNode } from "./context-hierarchy.js";

export type ContentType = 'rule' | 'preference' | 'decision' | 'technical' | 'conversation' | 'metadata' | 'unknown';
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5; // 0 = noise/junk, 5 = essential

export interface ContentAnalysis {
  text: string;
  type: ContentType;
  quality: QualityScore;
  isEssential: boolean;
  isShit: boolean;
  patterns: string[];
  suggestions: string[];
}

export interface MemoryQualityMetrics {
  totalEntries: number;
  essentialEntries: number;
  shitEntries: number;
  averageQuality: number;
  shitRatio: number;
  lastAnalysis: Date;
}

export interface QualityRule {
  name: string;
  pattern: RegExp;
  weight: number; // -1 to 1, negative = junk, positive = important
  type: ContentType;
}

export class MemoryQualityManager {
  private static instance: MemoryQualityManager;
  private rules: QualityRule[] = [];
  private metrics: MemoryQualityMetrics = {
    totalEntries: 0,
    essentialEntries: 0,
    shitEntries: 0,
    averageQuality: 0,
    shitRatio: 0,
    lastAnalysis: new Date()
  };

  private constructor() {
    this.initializeRules();
  }

  static getInstance(): MemoryQualityManager {
    if (!MemoryQualityManager.instance) {
      MemoryQualityManager.instance = new MemoryQualityManager();
    }
    return MemoryQualityManager.instance;
  }

  private initializeRules(): void {
    // LOW-VALUE patterns (negative weight) - these indicate noise/junk
    this.rules.push(
      // Superfluous technical details
      { name: 'technical_detail', pattern: /(?:created|modified|deleted|updated) (?:file|folder|directory) .*\.(?:md|js|json|ts)/i, weight: -0.8, type: 'technical' },
      { name: 'execution_detail', pattern: /(?:executed|ran|running) (?:script|command|node) .*/i, weight: -0.7, type: 'technical' },
      { name: 'size_detail', pattern: /(?:size|weight|length) .* (?:bytes|KB|MB|GB)/i, weight: -0.9, type: 'metadata' },
      { name: 'token_detail', pattern: /(?:token|tokens) .* (?:count|estimation|usage)/i, weight: -0.6, type: 'metadata' },

      // Repetitive conversation details
      { name: 'conversation_detail', pattern: /(?:discussed|talked|mentioned) (?:about )?.*/i, weight: -0.5, type: 'conversation' },
      { name: 'suggestion_detail', pattern: /(?:asked|suggested|proposed) .*/i, weight: -0.4, type: 'conversation' },

      // Temporary state
      { name: 'temporary_state', pattern: /(?:in progress|currently|ongoing) .*/i, weight: -0.3, type: 'metadata' },
      { name: 'verification_detail', pattern: /(?:verified|checked|tested) .*/i, weight: -0.4, type: 'technical' },

      // Useless metadata
      { name: 'time_detail', pattern: /time:.*|date:.*|timestamp:.*/i, weight: -0.9, type: 'metadata' },
      { name: 'session_detail', pattern: /session .* (?:start|end|id)/i, weight: -0.7, type: 'metadata' },
    );

    // HIGH-VALUE patterns (positive weight) - these indicate essential content
    this.rules.push(
      // Rules and workflows
      { name: 'rule_definition', pattern: /(?:when|if|whenever) .* (?:then|do|use)/i, weight: 0.9, type: 'rule' },
      { name: 'mandatory_rule', pattern: /(?:always|never|must|required) .*/i, weight: 1.0, type: 'rule' },
      { name: 'preference_definition', pattern: /(?:prefer|preference|like|dislike) .*/i, weight: 0.8, type: 'preference' },

      // Strategic decisions
      { name: 'decision_made', pattern: /(?:decided|chose|opted|selected) (?:to|for) .*/i, weight: 0.9, type: 'decision' },
      { name: 'strategic_change', pattern: /(?:change|evolution|migration|transition|switch) .*/i, weight: 0.8, type: 'decision' },
      { name: 'project_goal', pattern: /(?:project|objective|mission|goal|initiative) .*/i, weight: 0.7, type: 'decision' },

      // Critical paths and configurations
      { name: 'critical_path', pattern: /(?:~\/|\/home\/|\/opt\/|workspace|projects?\/) .*/i, weight: 0.9, type: 'rule' },
      { name: 'path_definition', pattern: /(?:path|directory|folder|location) .*/i, weight: 0.6, type: 'rule' },
      { name: 'config_definition', pattern: /(?:config|configuration|parameter|setting|api|key) .*/i, weight: 0.7, type: 'rule' },

      // Importance keywords
      { name: 'importance_keyword', pattern: /(?:important|critical|essential|priority|key)/i, weight: 0.8, type: 'decision' },
      { name: 'security_keyword', pattern: /(?:security|private|confidential|secret)/i, weight: 1.0, type: 'rule' },
    );
  }

  analyzeContent(text: string): ContentAnalysis {
    const patterns: string[] = [];
    let totalWeight = 0;
    let ruleCount = 0;
    let maxPositiveWeight = 0;
    let maxNegativeWeight = 0;

    // Analyze with each rule
    for (const rule of this.rules) {
      if (rule.pattern.test(text)) {
        patterns.push(rule.name);
        totalWeight += rule.weight;
        ruleCount++;

        if (rule.weight > 0) {
          maxPositiveWeight = Math.max(maxPositiveWeight, rule.weight);
        } else {
          maxNegativeWeight = Math.min(maxNegativeWeight, rule.weight);
        }
      }
    }

    // Determine content type
    let type: ContentType = 'unknown';
    if (patterns.some(p => p.includes('rule'))) type = 'rule';
    else if (patterns.some(p => p.includes('preference'))) type = 'preference';
    else if (patterns.some(p => p.includes('decision'))) type = 'decision';
    else if (patterns.some(p => p.includes('technical'))) type = 'technical';
    else if (patterns.some(p => p.includes('conversation'))) type = 'conversation';
    else if (patterns.some(p => p.includes('metadata'))) type = 'metadata';

    // Calculate quality score (0-5)
    let quality: QualityScore = 3; // Neutral by default

    if (ruleCount > 0) {
      const averageWeight = totalWeight / ruleCount;

      if (averageWeight >= 0.7) quality = 5;
      else if (averageWeight >= 0.4) quality = 4;
      else if (averageWeight >= 0.1) quality = 3;
      else if (averageWeight >= -0.3) quality = 2;
      else if (averageWeight >= -0.6) quality = 1;
      else quality = 0;
    }

    const isEssential = quality >= 4;
    const isShit = quality <= 1;

    // Improvement suggestions
    const suggestions: string[] = [];
    if (isShit) {
      suggestions.push('Consider removing - low-value content');
    }
    if (type === 'technical' || type === 'metadata') {
      suggestions.push('Avoid technical details/metadata');
    }
    if (quality === 3 && type === 'unknown') {
      suggestions.push('Make more specific or add context');
    }

    return {
      text,
      type,
      quality,
      isEssential,
      isShit,
      patterns,
      suggestions
    };
  }

  shouldKeepInMemory(analysis: ContentAnalysis): boolean {
    // Keep only if:
    // 1. Essential (quality >= 4) OR
    // 2. Not junk (quality >= 2) AND not too much metadata
    return analysis.isEssential || (analysis.quality >= 2 && analysis.type !== 'metadata');
  }

  filterContent(content: string[]): { kept: string[], removed: string[], analysis: ContentAnalysis[] } {
    const kept: string[] = [];
    const removed: string[] = [];
    const analysis: ContentAnalysis[] = [];

    for (const line of content) {
      const lineAnalysis = this.analyzeContent(line);
      analysis.push(lineAnalysis);

      if (this.shouldKeepInMemory(lineAnalysis)) {
        kept.push(line);
      } else {
        removed.push(`${line} [${lineAnalysis.type}:${lineAnalysis.quality}]`);
      }
    }

    // Update metrics
    this.updateMetrics(analysis);

    return { kept, removed, analysis };
  }

  private updateMetrics(analysis: ContentAnalysis[]): void {
    const total = analysis.length;
    const essential = analysis.filter(a => a.isEssential).length;
    const shit = analysis.filter(a => a.isShit).length;
    const avgQuality = analysis.reduce((sum, a) => sum + a.quality, 0) / total;

    this.metrics = {
      totalEntries: total,
      essentialEntries: essential,
      shitEntries: shit,
      averageQuality: avgQuality,
      shitRatio: shit / total,
      lastAnalysis: new Date()
    };
  }

  getMetrics(): MemoryQualityMetrics {
    return { ...this.metrics };
  }

  getQualityReport(): string {
    const m = this.metrics;
    return `
MEMORY QUALITY REPORT
=====================
Statistics:
  - Total entries: ${m.totalEntries}
  - Essential entries: ${m.essentialEntries} (${Math.round(m.essentialEntries/m.totalEntries*100)}%)
  - Low-value entries: ${m.shitEntries} (${Math.round(m.shitRatio*100)}%)
  - Average quality: ${m.averageQuality.toFixed(1)}/5
  - Last analysis: ${m.lastAnalysis.toLocaleString()}

Recommendations:
  ${m.shitRatio > 0.3 ? '⚠️  TOO MUCH NOISE (>30%) - Clean up immediately!' : '✅ Noise ratio acceptable'}
  ${m.averageQuality < 2.5 ? '⚠️  Quality too low - Improve content' : '✅ Quality acceptable'}
  ${m.essentialEntries/m.totalEntries < 0.4 ? '⚠️  Not enough essential content - Focus on rules/decisions' : '✅ Good essential ratio'}
`;
  }

  addCustomRule(rule: QualityRule): void {
    this.rules.push(rule);
  }

  clearRules(): void {
    this.rules = [];
    this.initializeRules();
  }
}

// Export singleton instance
export const memoryQualityManager = MemoryQualityManager.getInstance();
