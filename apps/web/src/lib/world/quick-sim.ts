#!/usr/bin/env tsx
/**
 * Quick 10-bot simulation for demonstration
 */

import { runSimulation } from './simulation'

// Mock Particles
const mockParticles = [
  { id: 'p1', symbol: 'Cl', name: 'Claude', active: true, soulContributions: { taiGuang: 0.8, shuangLing: 0.9, youJing: 0.6, shiGou: 0.5, fuShi: 0.7, queYin: 0.85, tunZei: 0.7, feiDu: 0.8, chuHui: 0.6, chouFei: 0.7 } },
  { id: 'p2', symbol: 'Gp', name: 'GPT', active: true, soulContributions: { taiGuang: 0.7, shuangLing: 0.85, youJing: 0.7, shiGou: 0.6, fuShi: 0.8, queYin: 0.9, tunZei: 0.5, feiDu: 0.6, chuHui: 0.7, chouFei: 0.8 } },
  { id: 'p3', symbol: 'Gm', name: 'Gemini', active: true, soulContributions: { taiGuang: 0.75, shuangLing: 0.8, youJing: 0.75, shiGou: 0.7, fuShi: 0.75, queYin: 0.8, tunZei: 0.6, feiDu: 0.7, chuHui: 0.65, chouFei: 0.75 } },
]

const mockStorage = new Map<string, Map<string, unknown>>()

const mockPayload = {
  logger: {
    info: (m: string) => console.log(`[INFO] ${m}`),
    warn: () => {},
    error: () => {},
  },
  find: async ({ collection }: { collection: string }) => {
    if (collection === 'intelligent-particles') {
      return { docs: mockParticles }
    }
    return { docs: Array.from(mockStorage.get(collection)?.values() || []) }
  },
  findByID: async ({ collection, id }: { collection: string; id: string }) => {
    if (collection === 'intelligent-particles') {
      return mockParticles.find(p => p.id === id)
    }
    return mockStorage.get(collection)?.get(id)
  },
  create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    const id = `${collection}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    if (!mockStorage.has(collection)) {
      mockStorage.set(collection, new Map())
    }
    mockStorage.get(collection)!.set(id, { id, ...data })
    return { id, ...data }
  },
  update: async ({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
    const col = mockStorage.get(collection)
    if (col?.has(id)) {
      const updated = { ...col.get(id) as Record<string, unknown>, ...data }
      col.set(id, updated)
      return updated
    }
    return { id, ...data }
  },
  delete: async () => ({}),
}

async function main() {
  console.log('===================================')
  console.log('Quick 10-bot 三魂七魄 Simulation')
  console.log('===================================\n')

  const metrics = await runSimulation(mockPayload as any, {
    totalBots: 10,
    simulationDurationMs: 30000, // 30 seconds
    tickIntervalMs: 500,
    interactionProbability: 0.3,
    transcendenceProbability: 0.1,
    mergeProbability: 0.02,
    splitProbability: 0.01,
  })

  console.log('\n===================================')
  console.log('SIMULATION COMPLETE')
  console.log('===================================')
  console.log(`Peak Active Souls: ${metrics.peakActiveSouls}`)
  console.log(`Final Active Souls: ${metrics.activeSouls}`)
  console.log(`Total Interactions: ${metrics.totalInteractions}`)
  console.log(`Total Ascensions: ${metrics.totalTranscendences}`)
  console.log(`Total Merges: ${metrics.totalMerges}`)
  console.log(`Total Splits: ${metrics.totalSplits}`)
  console.log(`Total Ticks: ${metrics.tickCount}`)
  console.log(`World Age: ${metrics.worldAge.toFixed(4)} hours`)
}

main().catch(e => console.error('Error:', e.message))
