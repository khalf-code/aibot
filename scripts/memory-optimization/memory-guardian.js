#!/usr/bin/env node

/**
 * 🛡️ GARDIEN DE LA MÉMOIRE
 * 
 * S'exécute automatiquement pour:
 * 1. Surveiller ce qui est écrit
 * 2. Nettoyer la merde en temps réel
 * 3. Appliquer les règles strictes
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const workspace = '/Users/valentinfranceries/.openclaw/workspace';
const memoryPath = path.join(workspace, 'MEMORY.md');
const memoryDir = path.join(workspace, 'memory');

class MemoryGuardian {
  constructor() {
    console.log('🛡️  GARDIEN DE LA MÉMOIRE - Surveillance active\n');
    
    this.rules = {
      maxMemoryLines: 50,           // MEMORY.md max 50 lignes
      maxDailyLogLines: 8,          // Log quotidien max 8 lignes
      maxDailyBulletPoints: 3,      // Max 3 points par jour
      keepLogsDays: 7,              // Garde 7 jours max
      shitThreshold: 0.3,           // 30% max de merde
    };

    this.stats = {
      shitRemoved: 0,
      linesOptimized: 0,
      filesCleaned: 0,
    };
  }

  // Analyse la qualité du contenu
  analyzeQuality(content) {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return { score: 0, shitRatio: 0 };

    let shitCount = 0;
    let importantCount = 0;

    const shitPatterns = [
      /(?:créé|modifié|supprimé) (?:fichier|dossier) .*/i,
      /(?:exécuté|lancé) (?:script|commande) .*/i,
      /(?:taille|poids) .* (?:bytes|KB|MB)/i,
      /(?:token|tokens) .* (?:count|estimation)/i,
      /(?:discuté|parlé|évoqué) de .*/i,
    ];

    const importantPatterns = [
      /(?:quand|si|lorsque) .* (?:alors|faire|utiliser)/i,
      /(?:toujours|jamais|obligatoire) .*/i,
      /(?:préfère|préférence|aime) .*/i,
      /(?:important|critique|essentiel|priorité)/i,
      /(?:décidé|choisi|opté) pour .*/i,
    ];

    for (const line of lines) {
      if (shitPatterns.some(p => p.test(line))) shitCount++;
      if (importantPatterns.some(p => p.test(line))) importantCount++;
    }

    const shitRatio = shitCount / lines.length;
    const importantRatio = importantCount / lines.length;
    const score = importantRatio - shitRatio;

    return { score, shitRatio, importantRatio, lines: lines.length };
  }

  // Nettoie MEMORY.md si nécessaire
  cleanMemoryIfNeeded() {
    if (!fs.existsSync(memoryPath)) return;

    const content = fs.readFileSync(memoryPath, 'utf8');
    const analysis = this.analyzeQuality(content);

    console.log(`📊 Analyse MEMORY.md:`);
    console.log(`   Lignes: ${analysis.lines}/${this.rules.maxMemoryLines}`);
    console.log(`   Ratio merde: ${Math.round(analysis.shitRatio * 100)}% (max: ${this.rules.shitThreshold * 100}%)`);
    console.log(`   Score qualité: ${analysis.score.toFixed(2)}`);

    let needsCleaning = false;

    // Vérifier les règles
    if (analysis.lines > this.rules.maxMemoryLines) {
      console.log(`   ⚠️  Trop long (${analysis.lines} > ${this.rules.maxMemoryLines})`);
      needsCleaning = true;
    }

    if (analysis.shitRatio > this.rules.shitThreshold) {
      console.log(`   ⚠️  Trop de merde (${Math.round(analysis.shitRatio * 100)}% > ${this.rules.shitThreshold * 100}%)`);
      needsCleaning = true;
    }

    if (analysis.score < 0) {
      console.log(`   ⚠️  Score négatif (plus de merde que d'important)`);
      needsCleaning = true;
    }

    if (needsCleaning) {
      console.log(`   🧹 Nettoyage en cours...`);
      execSync(`node ${path.join(workspace, 'smart-memory-filter.js')}`, { stdio: 'inherit' });
      this.stats.filesCleaned++;
    } else {
      console.log(`   ✅ MEMORY.md est propre`);
    }
  }

  // Nettoie les logs quotidiens
  cleanDailyLogs() {
    if (!fs.existsSync(memoryDir)) return;

    const files = fs.readdirSync(memoryDir)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort();

    console.log(`\n📅 Analyse logs quotidiens (${files.length} fichiers):`);

    // Rotation : garder 7 jours max
    if (files.length > this.rules.keepLogsDays) {
      const toDelete = files.slice(0, files.length - this.rules.keepLogsDays);
      console.log(`   🗑️  Rotation: suppression ${toDelete.length} vieux fichiers`);
      
      for (const file of toDelete) {
        fs.unlinkSync(path.join(memoryDir, file));
        console.log(`     Supprimé: ${file}`);
      }
    }

    // Optimiser chaque fichier restant
    const remainingFiles = files.slice(-this.rules.keepLogsDays);
    for (const file of remainingFiles) {
      const filePath = path.join(memoryDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);

      if (lines.length > this.rules.maxDailyLogLines) {
        console.log(`   ✂️  ${file}: ${lines.length} → ${this.rules.maxDailyLogLines} lignes`);
        
        // Garder titre + max bullet points
        const title = lines.find(l => l.startsWith('#'));
        const bullets = lines
          .filter(l => l.startsWith('-') || l.startsWith('•') || l.startsWith('🎯'))
          .slice(0, this.rules.maxDailyBulletPoints);

        const optimized = [title, '', ...bullets].join('\n');
        fs.writeFileSync(filePath, optimized);
        
        this.stats.linesOptimized += (lines.length - (bullets.length + 2));
      }
    }
  }

  // Vérifie les fichiers récemment modifiés
  checkRecentActivity() {
    console.log(`\n🔍 Activité récente:`);
    
    // Vérifier MEMORY.md
    if (fs.existsSync(memoryPath)) {
      const stats = fs.statSync(memoryPath);
      const hoursAgo = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      
      if (hoursAgo < 24) {
        console.log(`   MEMORY.md modifié il y a ${Math.round(hoursAgo)}h`);
        this.cleanMemoryIfNeeded();
      }
    }

    // Vérifier logs récents
    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
        .sort()
        .reverse()
        .slice(0, 3);

      for (const file of files) {
        const filePath = path.join(memoryDir, file);
        const stats = fs.statSync(filePath);
        const hoursAgo = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        
        if (hoursAgo < 24) {
          const content = fs.readFileSync(filePath, 'utf8');
          const analysis = this.analyzeQuality(content);
          
          console.log(`   ${file}: ${analysis.lines} lignes, merde: ${Math.round(analysis.shitRatio * 100)}%`);
          
          if (analysis.shitRatio > this.rules.shitThreshold) {
            console.log(`     ⚠️  Trop de merde, optimisation...`);
            execSync(`node ${path.join(workspace, 'smart-memory-filter.js')}`, { stdio: 'inherit' });
          }
        }
      }
    }
  }

  // Rapport final
  generateReport() {
    console.log(`\n📈 RAPPORT DU GARDIEN:`);
    console.log(`   Fichiers nettoyés: ${this.stats.filesCleaned}`);
    console.log(`   Lignes optimisées: ${this.stats.linesOptimized}`);
    console.log(`   Merde supprimée: ${this.stats.shitRemoved} lignes`);
    
    console.log(`\n🎯 RÈGLES APPLIQUÉES:`);
    console.log(`   • MEMORY.md max ${this.rules.maxMemoryLines} lignes`);
    console.log(`   • Logs max ${this.rules.maxDailyLogLines} lignes`);
    console.log(`   • Max ${this.rules.maxDailyBulletPoints} points/jour`);
    console.log(`   • Garde ${this.rules.keepLogsDays} jours max`);
    console.log(`   • Max ${this.rules.shitThreshold * 100}% de merde`);
    
    console.log(`\n💡 Conseil: Exécute ce script quotidiennement via cron.`);
  }

  run() {
    this.cleanMemoryIfNeeded();
    this.cleanDailyLogs();
    this.checkRecentActivity();
    this.generateReport();
  }
}

// Exécution
const guardian = new MemoryGuardian();
guardian.run();