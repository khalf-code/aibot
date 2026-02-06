import type { ContextNode } from "./context-hierarchy.js";

export type ContentType = 'rule' | 'preference' | 'decision' | 'technical' | 'conversation' | 'metadata' | 'unknown';
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5; // 0 = merde pure, 5 = essentiel

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
  weight: number; // -1 to 1, negative = merde, positive = important
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
    // 🔴 RÈGLES "MERDE" (poids négatif)
    this.rules.push(
      // Détails techniques superflus
      { name: 'technical_detail', pattern: /(?:créé|modifié|supprimé) (?:fichier|dossier) .*\.(?:md|js|json|ts)/i, weight: -0.8, type: 'technical' },
      { name: 'execution_detail', pattern: /(?:exécuté|lancé) (?:script|commande|node) .*/i, weight: -0.7, type: 'technical' },
      { name: 'size_detail', pattern: /(?:taille|poids) .* (?:bytes|KB|MB|Go)/i, weight: -0.9, type: 'metadata' },
      { name: 'token_detail', pattern: /(?:token|tokens) .* (?:count|estimation|usage)/i, weight: -0.6, type: 'metadata' },
      
      // Conversations répétitives
      { name: 'conversation_detail', pattern: /(?:discuté|parlé|évoqué) de .*/i, weight: -0.5, type: 'conversation' },
      { name: 'suggestion_detail', pattern: /(?:demandé|suggéré|proposé) .*/i, weight: -0.4, type: 'conversation' },
      
      // État temporaire
      { name: 'temporary_state', pattern: /(?:en cours|en train|actuellement) .*/i, weight: -0.3, type: 'metadata' },
      { name: 'verification_detail', pattern: /(?:vérifié|contrôlé|testé) .*/i, weight: -0.4, type: 'technical' },
      
      // Métadonnées inutiles
      { name: 'time_detail', pattern: /heure:.*|date:.*|timestamp:.*/i, weight: -0.9, type: 'metadata' },
      { name: 'session_detail', pattern: /session .* (?:début|fin|id)/i, weight: -0.7, type: 'metadata' },
    );

    // 🟢 RÈGLES "IMPORTANT" (poids positif)
    this.rules.push(
      // Règles et workflows
      { name: 'rule_definition', pattern: /(?:quand|si|lorsque) .* (?:alors|faire|utiliser)/i, weight: 0.9, type: 'rule' },
      { name: 'mandatory_rule', pattern: /(?:toujours|jamais|obligatoire|requis) .*/i, weight: 1.0, type: 'rule' },
      { name: 'preference_definition', pattern: /(?:préfère|préférence|aime|n'aime pas) .*/i, weight: 0.8, type: 'preference' },
      
      // Décisions stratégiques
      { name: 'decision_made', pattern: /(?:décidé|choisi|opté|sélectionné) (?:pour|d'utiliser|de) .*/i, weight: 0.9, type: 'decision' },
      { name: 'strategic_change', pattern: /(?:changement|évolution|migration|transition|passage) .*/i, weight: 0.8, type: 'decision' },
      { name: 'project_goal', pattern: /(?:projet|objectif|mission|but|initiative) .*/i, weight: 0.7, type: 'decision' },
      
      // Chemins et configurations critiques
      { name: 'critical_path', pattern: /\/Users\/.*\/Desktop\/.*/i, weight: 0.9, type: 'rule' },
      { name: 'path_definition', pattern: /(?:chemin|path|répertoire|dossier) .*/i, weight: 0.6, type: 'rule' },
      { name: 'config_definition', pattern: /(?:config|configuration|paramètre|setting|api|clé) .*/i, weight: 0.7, type: 'rule' },
      
      // Mots-clés d'importance
      { name: 'importance_keyword', pattern: /(?:important|critique|essentiel|priorité|clé)/i, weight: 0.8, type: 'decision' },
      { name: 'security_keyword', pattern: /(?:sécurité|privé|confidentiel|secret)/i, weight: 1.0, type: 'rule' },
    );
  }

  analyzeContent(text: string): ContentAnalysis {
    const patterns: string[] = [];
    let totalWeight = 0;
    let ruleCount = 0;
    let maxPositiveWeight = 0;
    let maxNegativeWeight = 0;

    // Analyser avec chaque règle
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

    // Déterminer le type de contenu
    let type: ContentType = 'unknown';
    if (patterns.some(p => p.includes('rule'))) type = 'rule';
    else if (patterns.some(p => p.includes('preference'))) type = 'preference';
    else if (patterns.some(p => p.includes('decision'))) type = 'decision';
    else if (patterns.some(p => p.includes('technical'))) type = 'technical';
    else if (patterns.some(p => p.includes('conversation'))) type = 'conversation';
    else if (patterns.some(p => p.includes('metadata'))) type = 'metadata';

    // Calculer le score de qualité (0-5)
    let quality: QualityScore = 3; // Neutre par défaut
    
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

    // Suggestions d'amélioration
    const suggestions: string[] = [];
    if (isShit) {
      suggestions.push('Considérer supprimer - contenu peu utile');
    }
    if (type === 'technical' || type === 'metadata') {
      suggestions.push('Éviter les détails techniques/métadonnées');
    }
    if (quality === 3 && type === 'unknown') {
      suggestions.push('Rendre plus spécifique ou ajouter contexte');
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
    // Garder seulement si:
    // 1. Essentiel (qualité >= 4) OU
    // 2. Pas de la merde (qualité >= 2) ET pas trop de métadonnées
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

    // Mettre à jour les métriques
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
🧠 RAPPORT QUALITÉ MÉMOIRE
==========================
📊 Statistiques:
  • Entrées totales: ${m.totalEntries}
  • Entrées essentielles: ${m.essentialEntries} (${Math.round(m.essentialEntries/m.totalEntries*100)}%)
  • Entrées "merde": ${m.shitEntries} (${Math.round(m.shitRatio*100)}%)
  • Qualité moyenne: ${m.averageQuality.toFixed(1)}/5
  • Dernière analyse: ${m.lastAnalysis.toLocaleString()}

🎯 Recommandations:
  ${m.shitRatio > 0.3 ? '⚠️  TROP DE MERDE (>30%) - Nettoyer immédiatement!' : '✅ Ratio merde acceptable'}
  ${m.averageQuality < 2.5 ? '⚠️  Qualité trop basse - Améliorer le contenu' : '✅ Qualité acceptable'}
  ${m.essentialEntries/m.totalEntries < 0.4 ? '⚠️  Pas assez d\'essentiel - Focus sur règles/décisions' : '✅ Bon ratio d\'essentiel'}
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