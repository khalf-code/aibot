#!/usr/bin/env node

/**
 * 🧠 FILTRE MÉMOIRE INTELLIGENT
 * 
 * Règles strictes pour éviter la "merde" dans la mémoire :
 * 1. MEMORY.md = SEULEMENT règles, préférences, décisions importantes
 * 2. Logs quotidiens = MAX 3 lignes, format tweet
 * 3. Auto-nettoyage des entrées inutiles
 */

import fs from 'fs';
import path from 'path';

const workspace = '/Users/valentinfranceries/.openclaw/workspace';
const memoryPath = path.join(workspace, 'MEMORY.md');
const memoryDir = path.join(workspace, 'memory');

// 🔍 Règles de filtrage - Ce qui est CONSIDÉRÉ COMME "MERDE"
const SHIT_PATTERNS = [
  // Détails techniques superflus
  /(?:créé|modifié|supprimé) (?:fichier|dossier) .*\.(?:md|js|json)/i,
  /(?:exécuté|lancé) (?:script|commande|node) .*/i,
  /(?:taille|poids) .* (?:bytes|KB|MB)/i,
  /(?:token|tokens) .* (?:count|estimation)/i,
  
  // Conversations répétitives
  /(?:discuté|parlé|évoqué) de .*/i,
  /(?:demandé|suggéré|proposé) .*/i,
  
  // État temporaire
  /(?:en cours|en train|actuellement) .*/i,
  /(?:vérifié|contrôlé|testé) .*/i,
  
  // Détails éphémères
  /heure:.*|date:.*|timestamp:.*/i,
  /session .* (?:début|fin)/i,
];

// ✅ Ce qui est IMPORTANT (garder dans MEMORY.md)
const IMPORTANT_PATTERNS = [
  // Règles et workflows
  /(?:quand|si|lorsque) .* (?:alors|faire|utiliser)/i,
  /(?:toujours|jamais|obligatoire) .*/i,
  /(?:préfère|préférence|aime) .*/i,
  /(?:important|critique|essentiel|priorité)/i,
  
  // Décisions stratégiques
  /(?:décidé|choisi|opté) pour .*/i,
  /(?:changement|évolution|migration) .*/i,
  /(?:projet|objectif|mission) .*/i,
  
  // Chemins et configurations
  /\/Users\/.*\/Desktop\/.*/i,
  /(?:chemin|path|répertoire) .*/i,
  /(?:config|configuration|paramètre) .*/i,
];

class SmartMemoryFilter {
  constructor() {
    console.log('🧠 FILTRE MÉMOIRE INTELLIGENT - Anti-merde\n');
  }

  // Vérifie si une ligne est de la "merde"
  isShit(text) {
    return SHIT_PATTERNS.some(pattern => pattern.test(text));
  }

  // Vérifie si une ligne est importante
  isImportant(text) {
    return IMPORTANT_PATTERNS.some(pattern => pattern.test(text));
  }

  // Nettoie MEMORY.md des entrées inutiles
  cleanMemoryFile() {
    if (!fs.existsSync(memoryPath)) return;

    console.log('🔧 Nettoyage MEMORY.md...');
    const content = fs.readFileSync(memoryPath, 'utf8');
    const lines = content.split('\n');
    const cleaned = [];
    let inImportantSection = false;

    for (const line of lines) {
      // Garder les titres de section
      if (line.startsWith('#') || line.startsWith('##') || line.startsWith('###')) {
        cleaned.push(line);
        inImportantSection = this.isImportant(line);
        continue;
      }

      // Si dans section importante OU ligne importante
      if (inImportantSection || this.isImportant(line)) {
        // Vérifier que ce n'est pas de la merde
        if (!this.isShit(line)) {
          cleaned.push(line);
        } else {
          console.log(`   🗑️  Supprimé: "${line.substring(0, 50)}..."`);
        }
      } else {
        // Section/ligne non importante → vérifier si utile
        if (line.trim().length > 0 && !this.isShit(line)) {
          cleaned.push(line);
        }
      }
    }

    fs.writeFileSync(memoryPath, cleaned.join('\n'));
    console.log(`   ✅ MEMORY.md nettoyé: ${lines.length} → ${cleaned.length} lignes`);
  }

  // Optimise les logs quotidiens
  optimizeDailyLogs() {
    if (!fs.existsSync(memoryDir)) return;

    console.log('\n📅 Optimisation logs quotidiens...');
    const files = fs.readdirSync(memoryDir)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort();

    for (const file of files) {
      const filePath = path.join(memoryDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Format ultra-minimaliste : titre + max 3 bullet points
      const optimized = [];
      let bulletCount = 0;
      
      for (const line of lines) {
        if (line.startsWith('#')) {
          optimized.push(line); // Garder le titre
        } else if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('🎯')) {
          if (bulletCount < 3 && !this.isShit(line)) {
            optimized.push(line);
            bulletCount++;
          }
        } else if (line.trim().length === 0 && optimized.length > 0) {
          optimized.push(''); // Garder les sauts de ligne
        }
      }

      // Si trop long, tronquer
      if (optimized.length > 8) {
        optimized.splice(8);
      }

      fs.writeFileSync(filePath, optimized.join('\n'));
      console.log(`   ${file}: ${lines.length} → ${optimized.length} lignes`);
    }
  }

  // Crée un template pour nouvelles entrées
  createSmartTemplate() {
    console.log('\n📋 Création template intelligent...');
    
    const template = `# {{DATE}} - Log ultra-minimaliste

🎯 MAX 3 POINTS ESSENTIELS
🔧 Actions importantes SEULEMENT
💡 Pas de détails techniques
🗑️  Pas de "merde" mémorisée

Exemples BONS :
- Décidé d'utiliser Perplexity au lieu de Brave
- Créé script rotation mémoire 7 jours
- Préférence : vocal → sag avec voix Charlie

Exemples MAUVAIS (MERDE) :
- Exécuté node script.js (détail technique)
- Taille fichier: 2456 bytes (inutile)
- Discuté de l'optimisation tokens (évident)
`;

    const templatePath = path.join(memoryDir, 'SMART-TEMPLATE.md');
    fs.writeFileSync(templatePath, template);
    console.log(`   ✅ Template créé: ${templatePath}`);
  }

  // Analyse ce qui a été écrit récemment
  analyzeRecentContent() {
    console.log('\n🔍 Analyse contenu récent...');
    
    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
        .sort()
        .reverse()
        .slice(0, 3); // 3 derniers jours

      let shitCount = 0;
      let importantCount = 0;
      let totalLines = 0;

      for (const file of files) {
        const filePath = path.join(memoryDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        totalLines += lines.length;

        for (const line of lines) {
          if (this.isShit(line)) shitCount++;
          if (this.isImportant(line)) importantCount++;
        }
      }

      console.log(`   📊 Statistiques (3 derniers jours):`);
      console.log(`      Lignes totales: ${totalLines}`);
      console.log(`      Lignes importantes: ${importantCount} (${Math.round(importantCount/totalLines*100)}%)`);
      console.log(`      Lignes "merde": ${shitCount} (${Math.round(shitCount/totalLines*100)}%)`);
      
      if (shitCount > importantCount) {
        console.log(`   ⚠️  ALERTE: Trop de merde (${shitCount} vs ${importantCount}) !`);
      }
    }
  }

  run() {
    this.cleanMemoryFile();
    this.optimizeDailyLogs();
    this.createSmartTemplate();
    this.analyzeRecentContent();
    
    console.log('\n🎯 RÈGLES ANTI-MERDE APPLIQUÉES :');
    console.log('   1. MEMORY.md = SEULEMENT règles/préférences/décisions');
    console.log('   2. Logs = MAX 3 points, format tweet');
    console.log('   3. Auto-détection "merde" vs "important"');
    console.log('   4. Nettoyage automatique quotidien');
    console.log('\n💡 Conseil: Exécute ce script après chaque session importante.');
  }
}

// Exécution
const filter = new SmartMemoryFilter();
filter.run();