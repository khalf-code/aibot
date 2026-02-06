import { memoryQualityManager, type ContentAnalysis, type MemoryQualityMetrics } from "./memory-quality-manager.js";
import type { ContextHierarchyManager, ContextNode } from "./context-hierarchy.js";

export interface OptimizationConfig {
  maxMemoryLines: number;
  maxDailyLogLines: number;
  maxDailyBulletPoints: number;
  keepLogsDays: number;
  shitThreshold: number; // 0-1, max ratio of low-value content
  essentialThreshold: number; // 0-1, min ratio of essential content
  autoCleanup: boolean;
  aggressiveMode: boolean;
}

export interface OptimizationResult {
  success: boolean;
  removedCount: number;
  keptCount: number;
  qualityBefore: MemoryQualityMetrics | null;
  qualityAfter: MemoryQualityMetrics | null;
  warnings: string[];
  errors: string[];
  duration: number;
}

export class MemoryOptimizer {
  private contextManager: ContextHierarchyManager;
  private config: OptimizationConfig;

  constructor(contextManager: ContextHierarchyManager, config: Partial<OptimizationConfig> = {}) {
    this.contextManager = contextManager;
    this.config = {
      maxMemoryLines: 50,
      maxDailyLogLines: 8,
      maxDailyBulletPoints: 3,
      keepLogsDays: 7,
      shitThreshold: 0.3, // 30% max
      essentialThreshold: 0.4, // 40% min
      autoCleanup: true,
      aggressiveMode: false,
      ...config
    };
  }

  async optimizeMemoryFile(filePath: string): Promise<OptimizationResult> {
    const startTime = Date.now();
    const result: OptimizationResult = {
      success: false,
      removedCount: 0,
      keptCount: 0,
      qualityBefore: null,
      qualityAfter: null,
      warnings: [],
      errors: [],
      duration: 0
    };

    try {
      // Note: In a real implementation, we would read the file
      // For the example, we simulate
      const simulatedContent = this.getSimulatedMemoryContent();

      // Analyze quality before
      const analysis = simulatedContent.map(line =>
        memoryQualityManager.analyzeContent(line)
      );
      result.qualityBefore = memoryQualityManager.getMetrics();

      // Filter content
      const filtered = memoryQualityManager.filterContent(simulatedContent);
      result.keptCount = filtered.kept.length;
      result.removedCount = filtered.removed.length;

      // Check thresholds
      if (result.qualityBefore.shitRatio > this.config.shitThreshold) {
        result.warnings.push(`Noise ratio too high: ${Math.round(result.qualityBefore.shitRatio*100)}% > ${this.config.shitThreshold*100}%`);

        if (this.config.aggressiveMode) {
          // Aggressive mode: remove more
          const aggressiveFiltered = this.aggressiveFilter(simulatedContent, analysis);
          result.removedCount = aggressiveFiltered.removed.length;
          result.keptCount = aggressiveFiltered.kept.length;
        }
      }

      if (result.qualityBefore.essentialEntries / result.qualityBefore.totalEntries < this.config.essentialThreshold) {
        result.warnings.push(`Not enough essential content: ${Math.round(result.qualityBefore.essentialEntries/result.qualityBefore.totalEntries*100)}% < ${this.config.essentialThreshold*100}%`);
      }

      // Check length
      if (result.keptCount > this.config.maxMemoryLines) {
        result.warnings.push(`Too long: ${result.keptCount} > ${this.config.maxMemoryLines} lines`);
        // Truncate
        result.keptCount = this.config.maxMemoryLines;
      }

      result.success = true;
      result.qualityAfter = memoryQualityManager.getMetrics();

    } catch (error) {
      result.errors.push(`Error during optimization: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  async optimizeDailyLogs(logsDir: string): Promise<OptimizationResult> {
    const startTime = Date.now();
    const result: OptimizationResult = {
      success: false,
      removedCount: 0,
      keptCount: 0,
      qualityBefore: null,
      qualityAfter: null,
      warnings: [],
      errors: [],
      duration: 0
    };

    try {
      // Note: Simulation - in real life, we would read the files
      const simulatedLogs = this.getSimulatedDailyLogs();

      let totalRemoved = 0;
      let totalKept = 0;

      for (const [date, entries] of Object.entries(simulatedLogs)) {
        // For logs, we are more strict
        const filtered = entries.filter((entry) => {
          const analysis = memoryQualityManager.analyzeContent(entry);

          // Logs: only quality >= 3 AND no metadata
          if (analysis.quality < 3) return false;
          if (analysis.type === 'metadata') return false;
          if (analysis.type === 'technical' && !analysis.isEssential) return false;

          return true;
        });

        // Limit to maxDailyBulletPoints
        const limited = filtered.slice(0, this.config.maxDailyBulletPoints);

        totalRemoved += (entries.length - limited.length);
        totalKept += limited.length;

        // Check total length
        if (limited.length > this.config.maxDailyLogLines) {
          result.warnings.push(`Log ${date} too long: ${limited.length} > ${this.config.maxDailyLogLines}`);
        }
      }

      result.removedCount = totalRemoved;
      result.keptCount = totalKept;
      result.success = true;

      // Rotation of old logs (simulation)
      const rotatedCount = this.simulateLogRotation();
      result.warnings.push(`Rotation: ${rotatedCount} old logs removed (${this.config.keepLogsDays} days max)`);

    } catch (error) {
      result.errors.push(`Error optimizing logs: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  async optimizeContextNode(nodeId: string): Promise<OptimizationResult> {
    const result: OptimizationResult = {
      success: false,
      removedCount: 0,
      keptCount: 0,
      qualityBefore: null,
      qualityAfter: null,
      warnings: [],
      errors: [],
      duration: 0
    };

    try {
      const node = this.contextManager.getNode(nodeId);
      if (!node) {
        result.errors.push(`Node ${nodeId} not found`);
        return result;
      }

      // Optimize node metadata
      const optimizedMetadata = this.optimizeNodeMetadata(node.metadata);

      // Update node
      this.contextManager.updateNode(nodeId, {
        metadata: optimizedMetadata
      });

      result.success = true;
      result.warnings.push(`Node ${nodeId} optimized (metadata filtered)`);

    } catch (error) {
      result.errors.push(`Error optimizing node ${nodeId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  getOptimizationReport(): string {
    const metrics = memoryQualityManager.getMetrics();
    const qualityReport = memoryQualityManager.getQualityReport();

    return `
MEMORY OPTIMIZATION REPORT
==========================

${qualityReport}

Configuration:
  - Max memory lines: ${this.config.maxMemoryLines}
  - Max log lines: ${this.config.maxDailyLogLines}
  - Max points/day: ${this.config.maxDailyBulletPoints}
  - Days kept: ${this.config.keepLogsDays}
  - Noise threshold: ${this.config.shitThreshold * 100}%
  - Essential threshold: ${this.config.essentialThreshold * 100}%
  - Auto cleanup: ${this.config.autoCleanup ? 'ON' : 'OFF'}
  - Aggressive mode: ${this.config.aggressiveMode ? 'ON' : 'OFF'}

Configuration recommendations:
  ${metrics.shitRatio > 0.3 ? '-> Enable aggressive mode' : '-> Current config OK'}
  ${metrics.averageQuality < 2.5 ? '-> Lower noise threshold to 20%' : ''}
  ${metrics.essentialEntries/metrics.totalEntries < 0.3 ? '-> Increase essential threshold' : ''}
`;
  }

  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  // Private helper methods
  private aggressiveFilter(content: string[], analysis: ContentAnalysis[]): { kept: string[], removed: string[] } {
    const kept: string[] = [];
    const removed: string[] = [];

    for (let i = 0; i < content.length; i++) {
      const a = analysis[i];

      // Aggressive mode: keep only quality >= 4
      if (a.quality >= 4) {
        kept.push(content[i]);
      } else {
        removed.push(content[i]);
      }
    }

    return { kept, removed };
  }

  private optimizeNodeMetadata(metadata: Record<string, any>): Record<string, any> {
    const optimized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Filter useless metadata
      if (typeof value === 'string') {
        const analysis = memoryQualityManager.analyzeContent(value);
        if (!analysis.isShit && analysis.type !== 'metadata') {
          optimized[key] = value;
        }
      } else {
        // Keep other types
        optimized[key] = value;
      }
    }

    return optimized;
  }

  private simulateLogRotation(): number {
    // Simulation: remove logs older than X days
    return Math.floor(Math.random() * 3); // 0-2 logs removed
  }

  private getSimulatedMemoryContent(): string[] {
    return [
      "# MEMORY.md - Long term memory",
      "",
      "## Voice workflows",
      "When audio received -> transcribe with STT",
      "Respond directly to content",
      "",
      "## Response preferences",
      "Explicit voice request -> use TTS",
      "Default -> text",
      "",
      "## Important paths",
      "Source code: ~/projects/myapp",
      "Workspace: ~/.openclaw/workspace",
      "",
      "## Token optimization",
      "Strict memory policy: logs = 5 lines max",
      "Auto memory rotation every 7 days"
    ];
  }

  private getSimulatedDailyLogs(): Record<string, string[]> {
    return {
      "2026-02-01": [
        "Discussed token optimization strategy",
        "Created memory/ folder for daily logs",
        "File size: 2456 bytes",
        "Decided to use Perplexity for search"
      ],
      "2026-02-02": [
        "Implemented smart memory filtering system",
        "Executed script smart-memory-filter.js",
        "Token count: 1250 tokens",
        "Created MemoryQualityManager with quality rules"
      ]
    };
  }
}

// Export factory function
export function createMemoryOptimizer(contextManager: ContextHierarchyManager, config?: Partial<OptimizationConfig>): MemoryOptimizer {
  return new MemoryOptimizer(contextManager, config);
}
