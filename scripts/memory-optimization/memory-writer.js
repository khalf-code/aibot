#!/usr/bin/env node

/**
 * 🖋️ ÉCRIVAIN MÉMOIRE INTELLIGENT
 * 
 * Remplace l'écriture manuelle dans MEMORY.md
 * Filtre automatiquement la "merde"
 * Formate proprement
 */

import fs from 'fs';
import path from 'path';

const workspace = '/Users/valentinfranceries/.openclaw/workspace';
const memoryPath = path.join(workspace, 'MEMORY.md');
const memoryDir = path.join(workspace, 'memory');

class SmartMemoryWriter {
  constructor() {
    this.shitPatterns = [
      /(?:créé|modifié|supprimé) (?:fichier|dossier) .*/i,
      /(?:exécuté|lancé) (?:script|commande) .*/i,
      /(?:taille|poids) .* (?:bytes|KB|MB)/i,
      /(?:token|tokens) .* (?:count|estimation)/i,
      /(?:discuté|parlé|évoqué) de .*/i,
      /(?:demandé|suggéré|proposé) .*/i,
      /(?:en cours|en train|actuellement) .*/i,
      /(?:vérifié|contrôlé|testé) .*/i,
      /heure:.*|date:.*|timestamp:.*/i,
    ];

    this.importantPatterns = [
      /(?:quand|si|lorsque) .* (?:alors|faire|utiliser)/i,
      /(?:toujours|jamais|obligatoire) .*/i,
      /(?:préfère|préférence|aime) .*/i,
      /(?:important|critique|essentiel|priorité)/i,
      /(?:décidé|choisi|opté) pour .*/i,
      /(?:changement|évolution|migration) .*/i,
      /(?:projet|objectif|mission) .*/i,
      /\/Users\/.*\/Desktop\/.*/i,
      /(?:chemin|path|répertoire) .*/i,
      /(?:config|configuration|paramètre) .*/i,
    ];
  }

  // Vérifie si c'est de la merde
  isShit(text) {
    return this.shitPatterns.some(pattern => pattern.test(text));
  }

  // Vérifie si c'est important
  isImportant(text) {
    return this.importantPatterns.some(pattern => pattern.test(text));
  }

  // Écrit dans MEMORY.md avec filtrage
  writeToMemory(section, content) {
    if (!fs.existsSync(memoryPath)) {
      fs.writeFileSync(memoryPath, '# MEMORY.md - Mémoire long terme\n\n');
    }

    let memoryContent = fs.readFileSync(memoryPath, 'utf8');
    
    // Filtrer le contenu
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      if (this.isShit(trimmed)) {
        console.log(`🗑️  FILTRÉ (merde): "${trimmed.substring(0, 60)}..."`);
        return false;
      }
      return true;
    });

    if (lines.length === 0) {
      console.log('⚠️  Rien à écrire (tout filtré comme merde)');
      return;
    }

    // Vérifier si la section existe déjà
    const sectionHeader = `## ${section}`;
    if (memoryContent.includes(sectionHeader)) {
      console.log(`⚠️  Section "${section}" existe déjà, ajout à la fin`);
      // Ajouter à la section existante
      const linesArray = memoryContent.split('\n');
      const sectionIndex = linesArray.findIndex(line => line.includes(sectionHeader));
      
      if (sectionIndex !== -1) {
        // Trouver la fin de la section
        let endIndex = sectionIndex + 1;
        while (endIndex < linesArray.length && !linesArray[endIndex].startsWith('##')) {
          endIndex++;
        }
        
        // Insérer le nouveau contenu
        const newContent = lines.map(line => `- ${line}`).join('\n');
        linesArray.splice(endIndex, 0, newContent);
        memoryContent = linesArray.join('\n');
      }
    } else {
      // Nouvelle section
      const newSection = `\n${sectionHeader}\n${lines.map(line => `- ${line}`).join('\n')}\n`;
      memoryContent += newSection;
    }

    fs.writeFileSync(memoryPath, memoryContent);
    console.log(`✅ Écrit dans MEMORY.md (section: ${section}, lignes: ${lines.length})`);
  }

  // Écrit dans le log quotidien (ultra-minimaliste)
  writeToDailyLog(content) {
    const today = new Date().toISOString().split('T')[0];
    const logPath = path.join(memoryDir, `${today}.md`);
    
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    let logContent = '';
    if (fs.existsSync(logPath)) {
      logContent = fs.readFileSync(logPath, 'utf8');
    } else {
      logContent = `# ${today} - Log quotidien\n\n`;
    }

    // Format ultra-minimaliste : max 3 bullet points
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !this.isShit(trimmed);
    }).slice(0, 3); // MAX 3 points !

    if (lines.length === 0) {
      console.log('📝 Rien à logger (tout filtré ou pas important)');
      return;
    }

    // Ajouter seulement si pas déjà présent
    const existingLines = logContent.split('\n');
    const newLines = lines.filter(line => 
      !existingLines.some(existing => existing.includes(line.substring(0, 30)))
    );

    if (newLines.length > 0) {
      const newContent = newLines.map(line => `🎯 ${line}`).join('\n');
      logContent += newContent + '\n';
      
      // Tronquer si trop long (max 8 lignes total)
      const allLines = logContent.split('\n');
      if (allLines.length > 8) {
        logContent = allLines.slice(0, 8).join('\n') + '\n';
      }

      fs.writeFileSync(logPath, logContent);
      console.log(`📝 Log quotidien mis à jour: ${newLines.length} point(s)`);
    }
  }

  // Interface CLI simple
  run() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log(`
🖋️  ÉCRIVAIN MÉMOIRE INTELLIGENT - Anti-merde

Usage:
  node memory-writer.js memory "Section" "Contenu à écrire"
  node memory-writer.js log "Contenu à logger"

Exemples:
  node memory-writer.js memory "Workflow Telegram" "Quand audio reçu → transcrire avec STT"
  node memory-writer.js log "Créé script optimisation mémoire"

Le filtre supprime automatiquement:
  - Détails techniques superflus
  - Conversations répétitives  
  - État temporaire
  - Métadonnées inutiles
      `);
      return;
    }

    const [action, ...restArgs] = args;
    const content = restArgs.join(' ');

    if (action === 'memory') {
      // Premier arg = section, reste = contenu
      const section = restArgs[0];
      const actualContent = restArgs.slice(1).join(' ');
      this.writeToMemory(section, actualContent);
    } else if (action === 'log') {
      this.writeToDailyLog(content);
    } else {
      console.log(`❌ Action inconnue: ${action}. Utilise "memory" ou "log".`);
    }
  }
}

// Exécution
const writer = new SmartMemoryWriter();
writer.run();