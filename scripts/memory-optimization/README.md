# 🧠 Optimisation Mémoire OpenClaw

**Branche**: `feat/homard-optimizations`  
**Chemin**: `/Users/valentinfranceries/Desktop/Développement/OpenClaw`

Système complet pour éviter la "merde" dans la mémoire OpenClaw. Implémenté dans le cadre du projet d'optimisation tokens avec Valentin.

## 📁 Structure

**Code source OpenClaw**: `/Users/valentinfranceries/Desktop/Développement/OpenClaw`

```
scripts/memory-optimization/          # Scripts CLI (usage manuel)
├── smart-memory-filter.js            # Filtrage intelligent anti-merde
├── memory-writer.js                  # Écriture filtrée (CLI)
├── memory-guardian.js                # Surveillance active
├── daily-memory-maintenance.sh       # Maintenance automatique (cron)
└── README.md                         # Ce fichier

src/memory/                           # Intégration TypeScript (core)
├── memory-quality-manager.ts         # Détection qualité contenu
├── memory-optimizer.ts               # Optimisation intégrée
└── index.ts                          # Exports publics

scripts/
├── memory-cli.ts                     # Interface CLI unifiée
└── test-memory-integration.ts        # Tests d'intégration
```

## 🎯 Objectif

Éviter que l'outil ne mette de la "merde" dans la mémoire :
- **Détails techniques superflus** (exécution scripts, tailles fichiers)
- **Conversations répétitives** (discuté de..., suggéré...)
- **Métadonnées inutiles** (timestamps, IDs de session)
- **État temporaire** (en cours, vérifié, testé)

## 🔧 Utilisation

### Scripts CLI (usage manuel)

```bash
# Analyser la qualité d'un fichier
node scripts/memory-optimization/smart-memory-filter.js

# Écrire dans la mémoire (filtré)
node scripts/memory-optimization/memory-writer.js memory "Section" "Contenu"

# Surveiller et nettoyer
node scripts/memory-optimization/memory-guardian.js
```

### Maintenance automatique

```bash
# Configurer le cron (une fois)
sh scripts/memory-optimization/daily-memory-maintenance.sh --install

# Exécuter manuellement
sh scripts/memory-optimization/daily-memory-maintenance.sh
```

### Intégration TypeScript (dans le code)

```typescript
import { memoryQualityManager, createMemoryOptimizer } from '../src/memory/index.js';

// Analyser du contenu
const analysis = memoryQualityManager.analyzeContent("Quand audio → transcrire avec STT");
console.log(analysis.quality); // 5/5
console.log(analysis.isEssential); // true

// Optimiser un fichier
const optimizer = createMemoryOptimizer(contextManager);
const result = await optimizer.optimizeMemoryFile('MEMORY.md');
```

## 📊 Règles de qualité

### MEMORY.md (mémoire long terme)
- **Max 50 lignes**
- **Max 30% de "merde"**
- **Min 40% d'essentiel**
- **Seulement**: règles, préférences, décisions importantes

### Logs quotidiens
- **Max 8 lignes par fichier**
- **Max 3 bullet points par jour**
- **Rotation automatique**: 7 jours max gardés
- **Format**: titre + points essentiels (style tweet)

## 🚫 Ce qui est considéré comme "merde"

### Détails techniques (poids: -0.8)
```
❌ "Créé fichier memory-optimizer.js"
❌ "Exécuté node smart-memory-filter.js"  
❌ "Taille: 2456 bytes"
❌ "Token count: 1250 tokens"
```

### Conversations (poids: -0.5)
```
❌ "Discuté de l'optimisation tokens"
❌ "Suggéré d'utiliser Perplexity"
❌ "Demandé confirmation"
```

### Métadonnées (poids: -0.9)
```
❌ "Heure: 20:45"
❌ "Date: 2026-02-02"
❌ "Session ID: abc123"
❌ "Timestamp: 1738526700000"
```

## ✅ Ce qui est considéré comme "important"

### Règles (poids: +0.9)
```
✅ "Quand audio reçu → transcrire avec STT"
✅ "Toujours utiliser Perplexity pour search"
✅ "Jamais stocker données privées"
```

### Préférences (poids: +0.8)
```
✅ "Préfère répondre en texte sauf demande vocal"
✅ "Aime les réponses concises"
✅ "N'aime pas les détails techniques"
```

### Décisions (poids: +0.9)
```
✅ "Décidé d'utiliser Gemini 3 Pro"
✅ "Changement: migration vers nouvelle API"
✅ "Projet: optimisation tokens >30%"
```

### Chemins critiques (poids: +0.9)
```
✅ "/Users/valentinfranceries/Desktop/Développement/OpenClaw"
✅ "Chemin workspace: ~/.openclaw/workspace"
✅ "Configuration: utiliser embedding cache"
```

## 📈 Monitoring

### Rapport qualité
```bash
npm run memory:report
```

Exemple de sortie:
```
🧠 RAPPORT QUALITÉ MÉMOIRE
==========================
📊 Statistiques:
  • Entrées totales: 42
  • Entrées essentielles: 18 (43%)
  • Entrées "merde": 8 (19%)
  • Qualité moyenne: 3.7/5
  • Dernière analyse: 02/02/2026 20:45

🎯 Recommandations:
  ✅ Ratio merde acceptable (19% < 30%)
  ✅ Qualité acceptable (3.7 > 2.5)
  ⚠️  Pas assez d'essentiel (43% < 60% cible)
```

### Alertes automatiques
Le système alerte quand:
- **Ratio merde > 30%** → Nettoyage urgent
- **Qualité moyenne < 2.5** → Révision nécessaire
- **Essentiel < 40%** → Focus sur contenu important

## 🔄 Intégration avec le système existant

### Avec Context Hierarchy
```typescript
import { getContextManager } from '../src/memory/index.js';
import { createMemoryOptimizer } from '../src/memory/index.js';

const contextManager = getContextManager();
const optimizer = createMemoryOptimizer(contextManager);

// Optimiser les métadonnées d'un node
await optimizer.optimizeContextNode('agent:main:session');
```

### Avec Cache Manager
Le système fonctionne avec le cache existant pour:
- **Mettre en cache** les analyses de qualité
- **Optimiser** le stockage des métadonnées
- **Surveiller** la qualité au fil du temps

## 🛠️ Développement

### Ajouter une règle personnalisée
```typescript
memoryQualityManager.addCustomRule({
  name: 'my_rule',
  pattern: /mon pattern/i,
  weight: 0.8, // -1 à 1
  type: 'rule'
});
```

### Configurer l'optimiseur
```typescript
const optimizer = createMemoryOptimizer(contextManager, {
  maxMemoryLines: 100,           // Augmenter la limite
  shitThreshold: 0.2,           // Être plus strict (20% max)
  aggressiveMode: true,         // Nettoyage plus agressif
  autoCleanup: false           // Désactiver nettoyage auto
});
```

## 📋 Checklist déploiement

- [ ] Tester: `npm run memory:analyze MEMORY.md`
- [ ] Configurer cron: `sh daily-memory-maintenance.sh --install`
- [ ] Vérifier rapport: `npm run memory:report`
- [ ] Intégrer dans le workflow existant
- [ ] Former les contributeurs aux règles de qualité

## 🎯 Résultats attendus

### Avant
- MEMORY.md: 100+ lignes, 40% merde
- Logs: 10+ lignes/jour, détails superflus
- Accumulation: 3k tokens inutiles/mois

### Après  
- MEMORY.md: 20 lignes max, 0% merde
- Logs: 3 points/jour, format ultra-concis
- Économie: ~2.5k tokens/mois
- **Qualité >>> Quantité**

---

**💡 Conseil**: Exécutez `npm run memory:report` chaque semaine pour surveiller la qualité de la mémoire.