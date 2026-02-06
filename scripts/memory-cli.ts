#!/usr/bin/env node

/**
 * 🧠 CLI pour l'optimisation mémoire OpenClaw
 * 
 * Usage:
 *   npx tsx scripts/memory-cli.ts analyze <file>
 *   npx tsx scripts/memory-cli.ts optimize <file>
 *   npx tsx scripts/memory-cli.ts report
 *   npx tsx scripts/memory-cli.ts clean-logs
 */

import { memoryQualityManager, createMemoryOptimizer } from "../src/memory/index.js";
import { getContextManager } from "../src/memory/index.js";
import fs from 'fs';
import path from 'path';

type Command = 'analyze' | 'optimize' | 'report' | 'clean-logs' | 'help';

class MemoryCLI {
  private optimizer: ReturnType<typeof createMemoryOptimizer>;

  constructor() {
    const contextManager = getContextManager();
    this.optimizer = createMemoryOptimizer(contextManager, {
      maxMemoryLines: 50,
      maxDailyLogLines: 8,
      maxDailyBulletPoints: 3,
      keepLogsDays: 7,
      shitThreshold: 0.2,  // Baissé de 30% à 20% comme recommandé
      essentialThreshold: 0.4,
      autoCleanup: true,
      aggressiveMode: false
    });
  }

  async run() {
    const args = process.argv.slice(2);
    const command = (args[0] as Command) || 'help';
    const target = args[1];

    switch (command) {
      case 'analyze':
        await this.analyze(target);
        break;
      case 'optimize':
        await this.optimize(target);
        break;
      case 'report':
        await this.report();
        break;
      case 'clean-logs':
        await this.cleanLogs();
        break;
      case 'help':
      default:
        this.showHelp();
        break;
    }
  }

  private async analyze(filePath?: string) {
    console.log('🔍 Analyse qualité mémoire\n');
    
    if (filePath) {
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Fichier non trouvé: ${filePath}`);
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      console.log(`📄 Analyse de: ${filePath}`);
      console.log(`   Lignes: ${lines.length}`);
      console.log('');
      
      let shitCount = 0;
      let essentialCount = 0;

      for (const line of lines) {
        const analysis = memoryQualityManager.analyzeContent(line);
        
        const icon = analysis.isShit ? '🗑️ ' : analysis.isEssential ? '⭐ ' : '   ';
        const type = analysis.type.padEnd(12);
        const quality = '★'.repeat(analysis.quality) + '☆'.repeat(5 - analysis.quality);
        
        console.log(`${icon} ${type} ${quality} ${line.substring(0, 60)}${line.length > 60 ? '...' : ''}`);
        
        if (analysis.isShit) shitCount++;
        if (analysis.isEssential) essentialCount++;
      }

      console.log('');
      console.log('📊 Résumé:');
      console.log(`   • Lignes totales: ${lines.length}`);
      console.log(`   • Lignes essentielles: ${essentialCount} (${Math.round(essentialCount/lines.length*100)}%)`);
      console.log(`   • Lignes "merde": ${shitCount} (${Math.round(shitCount/lines.length*100)}%)`);
      
      if (shitCount / lines.length > 0.3) {
        console.log('   ⚠️  ALERTE: Plus de 30% de merde !');
      }
    } else {
      // Analyse globale
      const metrics = memoryQualityManager.getMetrics();
      console.log(memoryQualityManager.getQualityReport());
    }
  }

  private async optimize(filePath?: string) {
    console.log('🔄 Optimisation mémoire\n');
    
    if (filePath) {
      console.log(`⚙️  Optimisation de: ${filePath}`);
      const result = await this.optimizer.optimizeMemoryFile(filePath);
      
      console.log('');
      console.log('📈 Résultats:');
      console.log(`   • Succès: ${result.success ? '✅' : '❌'}`);
      console.log(`   • Lignes gardées: ${result.keptCount}`);
      console.log(`   • Lignes supprimées: ${result.removedCount}`);
      console.log(`   • Durée: ${result.duration}ms`);
      
      if (result.warnings.length > 0) {
        console.log('');
        console.log('⚠️  Avertissements:');
        result.warnings.forEach(w => console.log(`   • ${w}`));
      }
      
      if (result.errors.length > 0) {
        console.log('');
        console.log('❌ Erreurs:');
        result.errors.forEach(e => console.log(`   • ${e}`));
      }
    } else {
      console.log('⚙️  Optimisation complète du système...');
      
      // Simulation d'optimisation
      const memoryResult = await this.optimizer.optimizeMemoryFile('/fake/path/MEMORY.md');
      const logsResult = await this.optimizer.optimizeDailyLogs('/fake/path/memory/');
      
      console.log('');
      console.log('📊 Résultats optimisation:');
      console.log(`   • Mémoire: ${memoryResult.keptCount} gardées, ${memoryResult.removedCount} supprimées`);
      console.log(`   • Logs: ${logsResult.keptCount} gardées, ${logsResult.removedCount} supprimées`);
      console.log(`   • Total supprimé: ${memoryResult.removedCount + logsResult.removedCount} lignes`);
      
      console.log('');
      console.log(this.optimizer.getOptimizationReport());
    }
  }

  private async report() {
    console.log('📊 Rapport complet optimisation mémoire\n');
    
    const metrics = memoryQualityManager.getMetrics();
    console.log(memoryQualityManager.getQualityReport());
    
    console.log('');
    console.log(this.optimizer.getOptimizationReport());
    
    console.log('');
    console.log('🎯 Actions recommandées:');
    
    if (metrics.shitRatio > 0.3) {
      console.log('   1. Exécuter: npx tsx scripts/memory-cli.ts optimize --aggressive');
    }
    if (metrics.averageQuality < 2.5) {
      console.log('   2. Réviser le contenu mémoire pour plus de qualité');
    }
    if (metrics.essentialEntries / metrics.totalEntries < 0.4) {
      console.log('   3. Focus sur règles, préférences, décisions importantes');
    }
    
    console.log('');
    console.log('🔧 Commandes utiles:');
    console.log('   • npx tsx scripts/memory-cli.ts analyze MEMORY.md');
    console.log('   • npx tsx scripts/memory-cli.ts optimize --aggressive');
    console.log('   • npx tsx scripts/memory-cli.ts clean-logs');
  }

  private async cleanLogs() {
    console.log('🧹 Nettoyage des logs quotidiens\n');
    
    const result = await this.optimizer.optimizeDailyLogs('/fake/path/memory/');
    
    console.log('📊 Résultats:');
    console.log(`   • Logs gardés: ${result.keptCount}`);
    console.log(`   • Logs supprimés: ${result.removedCount}`);
    console.log(`   • Rotation: ${result.warnings.find(w => w.includes('Rotation')) || '0 jours'}`);
    
    if (result.success) {
      console.log('✅ Nettoyage terminé avec succès');
    } else {
      console.log('❌ Erreurs lors du nettoyage');
      result.errors.forEach(e => console.log(`   • ${e}`));
    }
  }

  private showHelp() {
    console.log(`
🧠 CLI OPTIMISATION MÉMOIRE OPENCLAW
=====================================

Usage: npx tsx scripts/memory-cli.ts <command> [options]

Commandes:
  analyze <file>    Analyse la qualité d'un fichier mémoire
  optimize <file>   Optimise un fichier mémoire (supprime la "merde")
  report            Affiche un rapport complet de qualité
  clean-logs        Nettoie les logs quotidiens (rotation 7 jours)
  help              Affiche cette aide

Exemples:
  npx tsx scripts/memory-cli.ts analyze MEMORY.md
  npx tsx scripts/memory-cli.ts optimize memory/2026-02-02.md
  npx tsx scripts/memory-cli.ts report
  npx tsx scripts/memory-cli.ts clean-logs

Règles de qualité:
  • "Merde" = détails techniques, conversations, métadonnées
  • Essentiel = règles, préférences, décisions importantes
  • Seuil merde: 30% max
  • Seuil essentiel: 40% min

📝 Conseil: Exécutez "report" régulièrement pour surveiller la qualité.
    `);
  }
}

// Exécution
const cli = new MemoryCLI();
cli.run().catch(console.error);