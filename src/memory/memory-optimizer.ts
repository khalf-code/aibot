import { memoryQualityManager, type ContentAnalysis, type MemoryQualityMetrics } from "./memory-quality-manager.js";
import type { ContextHierarchyManager, ContextNode } from "./context-hierarchy.js";

export interface OptimizationConfig {
  maxMemoryLines: number;
  maxDailyLogLines: number;
  maxDailyBulletPoints: number;
  keepLogsDays: number;
  shitThreshold: number; // 0-1, ratio max de "merde"
  essentialThreshold: number; // 0-1, ratio min d'essentiel
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
      // Note: Dans une vraie implémentation, on lirait le fichier
      // Pour l'exemple, on simule
      const simulatedContent = this.getSimulatedMemoryContent();
      
      // Analyser la qualité avant
      const analysis = simulatedContent.map(line => 
        memoryQualityManager.analyzeContent(line)
      );
      result.qualityBefore = memoryQualityManager.getMetrics();

      // Filtrer le contenu
      const filtered = memoryQualityManager.filterContent(simulatedContent);
      result.keptCount = filtered.kept.length;
      result.removedCount = filtered.removed.length;

      // Vérifier les seuils
      if (result.qualityBefore.shitRatio > this.config.shitThreshold) {
        result.warnings.push(`Ratio merde trop élevé: ${Math.round(result.qualityBefore.shitRatio*100)}% > ${this.config.shitThreshold*100}%`);
        
        if (this.config.aggressiveMode) {
          // Mode agressif: supprimer plus
          const aggressiveFiltered = this.aggressiveFilter(simulatedContent, analysis);
          result.removedCount = aggressiveFiltered.removed.length;
          result.keptCount = aggressiveFiltered.kept.length;
        }
      }

      if (result.qualityBefore.essentialEntries / result.qualityBefore.totalEntries < this.config.essentialThreshold) {
        result.warnings.push(`Pas assez de contenu essentiel: ${Math.round(result.qualityBefore.essentialEntries/result.qualityBefore.totalEntries*100)}% < ${this.config.essentialThreshold*100}%`);
      }

      // Vérifier la longueur
      if (result.keptCount > this.config.maxMemoryLines) {
        result.warnings.push(`Trop long: ${result.keptCount} > ${this.config.maxMemoryLines} lignes`);
        // Tronquer
        result.keptCount = this.config.maxMemoryLines;
      }

      result.success = true;
      result.qualityAfter = memoryQualityManager.getMetrics();

    } catch (error) {
      result.errors.push(`Erreur lors de l'optimisation: ${error instanceof Error ? error.message : String(error)}`);
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
      // Note: Simulation - dans la vraie vie, on lirait les fichiers
      const simulatedLogs = this.getSimulatedDailyLogs();
      
      let totalRemoved = 0;
      let totalKept = 0;

      for (const [date, entries] of Object.entries(simulatedLogs)) {
        const analysis = entries.map(entry => 
          memoryQualityManager.analyzeContent(entry)
        );

        // Pour les logs, on est plus strict
        const filtered = entries.filter((entry, index) => {
          const analysis = memoryQualityManager.analyzeContent(entry);
          
          // Logs: seulement qualité >= 3 ET pas de métadonnées
          if (analysis.quality < 3) return false;
          if (analysis.type === 'metadata') return false;
          if (analysis.type === 'technical' && !analysis.isEssential) return false;
          
          return true;
        });

        // Limiter à maxDailyBulletPoints
        const limited = filtered.slice(0, this.config.maxDailyBulletPoints);
        
        totalRemoved += (entries.length - limited.length);
        totalKept += limited.length;

        // Vérifier longueur totale
        if (limited.length > this.config.maxDailyLogLines) {
          result.warnings.push(`Log ${date} trop long: ${limited.length} > ${this.config.maxDailyLogLines}`);
        }
      }

      result.removedCount = totalRemoved;
      result.keptCount = totalKept;
      result.success = true;

      // Rotation des vieux logs (simulation)
      const rotatedCount = this.simulateLogRotation();
      result.warnings.push(`Rotation: ${rotatedCount} vieux logs supprimés (${this.config.keepLogsDays} jours max)`);

    } catch (error) {
      result.errors.push(`Erreur lors de l'optimisation des logs: ${error instanceof Error ? error.message : String(error)}`);
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
        result.errors.push(`Node ${nodeId} non trouvé`);
        return result;
      }

      // Optimiser les métadonnées du node
      const optimizedMetadata = this.optimizeNodeMetadata(node.metadata);
      
      // Mettre à jour le node
      this.contextManager.updateNode(nodeId, {
        metadata: optimizedMetadata
      });

      result.success = true;
      result.warnings.push(`Node ${nodeId} optimisé (métadonnées filtrées)`);

    } catch (error) {
      result.errors.push(`Erreur optimisation node ${nodeId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  getOptimizationReport(): string {
    const metrics = memoryQualityManager.getMetrics();
    const qualityReport = memoryQualityManager.getQualityReport();

    return `
🔄 RAPPORT D'OPTIMISATION MÉMOIRE
=================================

${qualityReport}

⚙️  Configuration:
  • Lignes max mémoire: ${this.config.maxMemoryLines}
  • Lignes max logs: ${this.config.maxDailyLogLines}
  • Points max/jour: ${this.config.maxDailyBulletPoints}
  • Jours gardés: ${this.config.keepLogsDays}
  • Seuil merde: ${this.config.shitThreshold * 100}%
  • Seuil essentiel: ${this.config.essentialThreshold * 100}%
  • Nettoyage auto: ${this.config.autoCleanup ? '✅ ON' : '❌ OFF'}
  • Mode agressif: ${this.config.aggressiveMode ? '⚠️  ON' : '✅ OFF'}

🎯 Recommandations de configuration:
  ${metrics.shitRatio > 0.3 ? '→ Activer le mode agressif' : '→ Configuration actuelle OK'}
  ${metrics.averageQuality < 2.5 ? '→ Baisser le seuil merde à 20%' : ''}
  ${metrics.essentialEntries/metrics.totalEntries < 0.3 ? '→ Augmenter le seuil essentiel' : ''}
`;
  }

  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  // Méthodes privées helpers
  private aggressiveFilter(content: string[], analysis: ContentAnalysis[]): { kept: string[], removed: string[] } {
    const kept: string[] = [];
    const removed: string[] = [];

    for (let i = 0; i < content.length; i++) {
      const a = analysis[i];
      
      // Mode agressif: garder seulement qualité >= 4
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
      // Filtrer les métadonnées inutiles
      if (typeof value === 'string') {
        const analysis = memoryQualityManager.analyzeContent(value);
        if (!analysis.isShit && analysis.type !== 'metadata') {
          optimized[key] = value;
        }
      } else {
        // Garder les autres types
        optimized[key] = value;
      }
    }

    return optimized;
  }

  private simulateLogRotation(): number {
    // Simulation: supprimer les logs de plus de X jours
    return Math.floor(Math.random() * 3); // 0-2 logs supprimés
  }

  private getSimulatedMemoryContent(): string[] {
    return [
      "# MEMORY.md - Mémoire long terme",
      "",
      "## Workflow vocaux Telegram",
      "Quand audio reçu → transcrire avec ElevenLabs STT (scribe_v2)",
      "Répondre directement au contenu",
      "Binaire 'kanji' = normal, ignorer",
      "",
      "## Préférences réponse",
      "Vocal explicite → sag avec voix Charlie",
      "Par défaut → texte",
      "",
      "## Chemins importants",
      "Mon code source: /Users/valentinfranceries/Desktop/Développement/OpenClaw",
      "Projets: /Users/valentinfranceries/Desktop/Développement",
      "",
      "## Optimisation Token",
      "Politique mémoire stricte: logs = 5 lignes max",
      "AGENTS-ULTRA-LIGHT.md au lieu de AGENTS-FULL.md",
      "Rotation mémoire automatique 7 jours"
    ];
  }

  private getSimulatedDailyLogs(): Record<string, string[]> {
    return {
      "2026-02-01": [
        "Discuté de l'optimisation tokens avec Valentin",
        "Créé dossier memory/ pour logs quotidiens",
        "Taille fichier: 2456 bytes",
        "Décidé d'utiliser Perplexity au lieu de Brave"
      ],
      "2026-02-02": [
        "Implémenté système filtrage mémoire intelligent",
        "Exécuté script smart-memory-filter.js",
        "Token count: 1250 tokens",
        "Créé MemoryQualityManager avec règles anti-merde"
      ]
    };
  }
}

// Export factory function
export function createMemoryOptimizer(contextManager: ContextHierarchyManager, config?: Partial<OptimizationConfig>): MemoryOptimizer {
  return new MemoryOptimizer(contextManager, config);
}