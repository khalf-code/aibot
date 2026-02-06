#!/bin/bash

# 🧹 MAINTENANCE QUOTIDIENNE DE LA MÉMOIRE
# Exécuté automatiquement chaque jour

echo "$(date) - Début maintenance mémoire"

cd "/Users/valentinfranceries/.openclaw/workspace"

# 1. Nettoyage avec le gardien
echo "🛡️  Exécution du gardien de mémoire..."
node memory-guardian.js >> memory/maintenance.log 2>&1

# 2. Filtrage intelligent
echo "🧠 Filtrage mémoire anti-merde..."
node smart-memory-filter.js >> memory/maintenance.log 2>&1

# 3. Rotation des logs (garder 7 jours)
echo "📅 Rotation logs..."
node rotate-memory.js >> memory/maintenance.log 2>&1

echo "$(date) - Maintenance terminée"
echo "---" >> memory/maintenance.log
