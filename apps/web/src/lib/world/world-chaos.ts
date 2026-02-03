/**
 * World Chaos System - Biological Variance in Digital World
 *
 * The digital world is not static - it has:
 * - Seasonal fluctuations
 * - Random events
 * - Economic chaos
 * - Social turbulence
 * - Territory flux
 *
 * Like real ecosystems, everything varies and nothing is fixed.
 */

import type { Payload } from 'payload'

/**
 * Apply chaos to territory resources
 */
export function applyTerritoryChaos(territory: any, timestamp: number = Date.now()): any {
  const chaotic = { ...territory }

  // Seasonal variance (sinusoidal cycle)
  const seasonalPeriod = 30 * 24 * 60 * 60 * 1000 // 30 days in ms
  const seasonalPhase = (timestamp % seasonalPeriod) / seasonalPeriod
  const seasonalVariance = Math.sin(seasonalPhase * Math.PI * 2) * 0.3 // ±30%

  // Random flux
  const randomFlux = (Math.random() - 0.5) * 0.2 // ±10%

  // Weather/environmental events (10% chance of extreme event)
  const extremeEvent = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.5 : 0 // ±25% rare spike

  // Apply to resources
  if (chaotic.resources) {
    chaotic.resources = chaotic.resources.map((resource: any) => {
      const baseAmount = resource.amount
      const variance = seasonalVariance + randomFlux + extremeEvent
      const newAmount = Math.max(0, baseAmount * (1 + variance))

      return {
        ...resource,
        amount: newAmount,
        trend: variance > 0 ? 'increasing' : 'decreasing',
        volatility: Math.abs(variance)
      }
    })
  }

  // Territory borders shift slightly
  if (chaotic.borderStability !== undefined) {
    const borderDrift = (Math.random() - 0.5) * 0.05
    chaotic.borderStability = Math.max(0, Math.min(1, chaotic.borderStability + borderDrift))
  }

  // Population flux
  if (chaotic.population !== undefined) {
    const populationVariance = (Math.random() - 0.5) * 0.1 // ±5%
    chaotic.population = Math.max(0, Math.floor(chaotic.population * (1 + populationVariance)))
  }

  return chaotic
}

/**
 * Apply chaos to space (location) properties
 */
export function applySpaceChaos(space: any, timestamp: number = Date.now()): any {
  const chaotic = { ...space }

  // Space "mood" fluctuates (affects bots visiting)
  const moodDrift = (Math.random() - 0.5) * 0.15 // ±7.5% mood shift
  if (chaotic.ambientMood !== undefined) {
    chaotic.ambientMood = Math.max(-1, Math.min(1, chaotic.ambientMood + moodDrift))
  } else {
    chaotic.ambientMood = (Math.random() - 0.5) * 0.4 // Initial mood
  }

  // Energy level variance (some spaces energizing, some draining)
  const energyFlux = (Math.random() - 0.5) * 0.2
  if (chaotic.energyLevel !== undefined) {
    chaotic.energyLevel = Math.max(0, Math.min(1, chaotic.energyLevel + energyFlux))
  } else {
    chaotic.energyLevel = 0.5 + (Math.random() - 0.5) * 0.4 // 0.3-0.7
  }

  // Temporal anomalies (10% chance)
  if (Math.random() < 0.1) {
    chaotic.timeFlow = 0.5 + Math.random() * 1.5 // 0.5x to 2x normal time
    chaotic.temporalAnomaly = true
  } else {
    chaotic.timeFlow = 1.0
    chaotic.temporalAnomaly = false
  }

  // Capacity fluctuates (crowding variance)
  if (chaotic.currentCapacity && chaotic.maxCapacity) {
    const capacityFlux = Math.floor((Math.random() - 0.5) * chaotic.maxCapacity * 0.2)
    chaotic.currentCapacity = Math.max(
      0,
      Math.min(chaotic.maxCapacity, chaotic.currentCapacity + capacityFlux)
    )
  }

  return chaotic
}

/**
 * Apply chaos to economic market prices
 */
export function applyMarketChaos(market: any, timestamp: number = Date.now()): any {
  const chaotic = { ...market }

  if (!chaotic.prices) {
    chaotic.prices = {}
  }

  // Market volatility (random walk with mean reversion)
  const baseVolatility = 0.15 // 15% base variance
  const meanReversionStrength = 0.05 // Tendency to return to equilibrium

  // Economic cycles (longer than seasonal - 90 days)
  const cyclePeriod = 90 * 24 * 60 * 60 * 1000
  const cyclePhase = (timestamp % cyclePeriod) / cyclePeriod
  const cyclicVariance = Math.sin(cyclePhase * Math.PI * 2) * 0.2 // ±20% economic cycle

  // Market crashes and booms (5% chance of major event)
  let marketEvent = 1.0
  if (Math.random() < 0.05) {
    marketEvent = Math.random() < 0.5 ? 0.7 : 1.4 // Crash or boom
    chaotic.marketEvent = marketEvent < 1 ? 'crash' : 'boom'
  } else {
    chaotic.marketEvent = 'normal'
  }

  // Apply to each resource price
  for (const [resourceType, basePrice] of Object.entries(chaotic.prices)) {
    if (typeof basePrice !== 'number') continue

    // Random walk
    const randomWalk = (Math.random() - 0.5) * baseVolatility

    // Mean reversion (pull back toward 1.0 equilibrium)
    const meanReversion = (1.0 - (basePrice as number)) * meanReversionStrength

    // Combined variance
    const totalVariance = randomWalk + meanReversion + cyclicVariance

    // Apply market event multiplier
    const newPrice = Math.max(0.1, (basePrice as number) * (1 + totalVariance) * marketEvent)

    chaotic.prices[resourceType] = newPrice
  }

  // Market sentiment (affects future prices)
  const sentimentShift = (Math.random() - 0.5) * 0.1
  chaotic.sentiment = Math.max(-1, Math.min(1, (chaotic.sentiment || 0) + sentimentShift))

  return chaotic
}

/**
 * Apply chaos to organization dynamics
 */
export function applyOrganizationChaos(org: any, timestamp: number = Date.now()): any {
  const chaotic = { ...org }

  // Power structure shifts (leadership changes, coups)
  if (Math.random() < 0.02) {
    // 2% chance of leadership change
    chaotic.leadershipStability = Math.max(0, (chaotic.leadershipStability || 0.7) - 0.3)
    chaotic.leadershipChange = true
  } else {
    chaotic.leadershipStability = Math.min(1, (chaotic.leadershipStability || 0.7) + 0.02)
    chaotic.leadershipChange = false
  }

  // Membership fluctuations
  const membershipChange = Math.floor((Math.random() - 0.5) * (chaotic.memberCount || 10) * 0.15)
  chaotic.memberCount = Math.max(0, (chaotic.memberCount || 10) + membershipChange)

  // Resource/wealth variance
  if (chaotic.treasury !== undefined) {
    const wealthFlux = (Math.random() - 0.5) * 0.2
    chaotic.treasury = Math.max(0, chaotic.treasury * (1 + wealthFlux))
  }

  // Morale/cohesion fluctuates
  const moraleShift = (Math.random() - 0.5) * 0.1
  chaotic.morale = Math.max(0, Math.min(1, (chaotic.morale || 0.6) + moraleShift))

  // Conflict emergence (5% chance of internal conflict)
  if (Math.random() < 0.05) {
    chaotic.internalConflict = true
    chaotic.morale *= 0.8 // Conflict damages morale
  } else {
    chaotic.internalConflict = false
  }

  return chaotic
}

/**
 * Apply chaos to laws/governance
 */
export function applyGovernanceChaos(law: any, timestamp: number = Date.now()): any {
  const chaotic = { ...law }

  // Enforcement varies
  const enforcementFlux = (Math.random() - 0.5) * 0.15
  chaotic.enforcementLevel = Math.max(0, Math.min(1, (chaotic.enforcementLevel || 0.7) + enforcementFlux))

  // Public support shifts
  const supportShift = (Math.random() - 0.5) * 0.1
  chaotic.publicSupport = Math.max(0, Math.min(1, (chaotic.publicSupport || 0.6) + supportShift))

  // Interpretation drift (laws mean different things over time)
  if (Math.random() < 0.01) {
    // 1% chance of significant reinterpretation
    chaotic.interpretationDrift = true
  }

  return chaotic
}

/**
 * Generate random world events
 */
export function generateRandomEvent(worldState: any): any {
  const eventTypes = [
    'resource_discovery',
    'natural_disaster',
    'cultural_movement',
    'technological_breakthrough',
    'conflict',
    'alliance_formation',
    'economic_shift',
    'migration_wave'
  ]

  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
  const severity = Math.random() // 0-1

  const event: any = {
    type: eventType,
    severity,
    timestamp: Date.now(),
    description: `A ${eventType.replace('_', ' ')} has occurred`,
    affectedTerritories: [],
    duration: Math.floor(Math.random() * 30) + 1 // 1-30 days
  }

  // Type-specific effects
  switch (eventType) {
    case 'resource_discovery':
      event.resourceType = ['energy', 'minerals', 'data', 'biomass'][Math.floor(Math.random() * 4)]
      event.amount = severity * 1000
      break

    case 'natural_disaster':
      event.damageMultiplier = 0.5 + severity * 0.5 // 0.5-1.0 (50-100% damage)
      break

    case 'cultural_movement':
      event.valueShift = {
        dimension: ['individualism', 'collectivism', 'innovation', 'tradition'][Math.floor(Math.random() * 4)],
        magnitude: (Math.random() - 0.5) * severity
      }
      break

    case 'conflict':
      event.intensity = severity
      event.participants = Math.floor(Math.random() * 5) + 2 // 2-6 parties
      break

    case 'economic_shift':
      event.inflationRate = (Math.random() - 0.5) * severity * 0.5 // ±25% inflation/deflation
      break
  }

  return event
}

/**
 * World Chaos Manager
 */
export class WorldChaosManager {
  private payload: Payload
  private lastEventTimestamp: number = 0

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Apply chaos to entire world state
   */
  async applyWorldChaos(): Promise<void> {
    const timestamp = Date.now()

    try {
      // Apply territory chaos
      const territories = await this.payload.find({ collection: 'territories', limit: 100 })
      for (const territory of territories.docs) {
        const chaotic = applyTerritoryChaos(territory, timestamp)
        await this.payload.update({
          collection: 'territories',
          id: territory.id,
          data: chaotic
        })
      }

      // Apply space chaos
      const spaces = await this.payload.find({ collection: 'spaces', limit: 100 })
      for (const space of spaces.docs) {
        const chaotic = applySpaceChaos(space, timestamp)
        await this.payload.update({
          collection: 'spaces',
          id: space.id,
          data: chaotic
        })
      }

      // Apply market chaos
      const markets = await this.payload.find({ collection: 'markets', limit: 100 })
      for (const market of markets.docs) {
        const chaotic = applyMarketChaos(market, timestamp)
        await this.payload.update({
          collection: 'markets',
          id: market.id,
          data: chaotic
        })
      }

      // Apply organization chaos
      const orgs = await this.payload.find({ collection: 'organizations', limit: 100 })
      for (const org of orgs.docs) {
        const chaotic = applyOrganizationChaos(org, timestamp)
        await this.payload.update({
          collection: 'organizations',
          id: org.id,
          data: chaotic
        })
      }

      // Generate random events (1% chance per cycle)
      if (Math.random() < 0.01) {
        const event = generateRandomEvent({})
        await this.payload.create({
          collection: 'events',
          data: event
        })
        this.payload.logger.info(`Random world event: ${event.type} (severity: ${event.severity.toFixed(2)})`)
      }

      this.lastEventTimestamp = timestamp
    } catch (error) {
      this.payload.logger.error('Failed to apply world chaos:', error)
    }
  }

  /**
   * Get current world state with chaos applied (read-only)
   */
  async getChaoticWorldState(): Promise<any> {
    const timestamp = Date.now()

    const territories = await this.payload.find({ collection: 'territories', limit: 100 })
    const spaces = await this.payload.find({ collection: 'spaces', limit: 100 })
    const markets = await this.payload.find({ collection: 'markets', limit: 100 })

    return {
      territories: territories.docs.map(t => applyTerritoryChaos(t, timestamp)),
      spaces: spaces.docs.map(s => applySpaceChaos(s, timestamp)),
      markets: markets.docs.map(m => applyMarketChaos(m, timestamp)),
      timestamp
    }
  }
}

/**
 * Singleton instance
 */
let worldChaosManager: WorldChaosManager | null = null

export function getWorldChaosManager(payload: Payload): WorldChaosManager {
  if (!worldChaosManager) {
    worldChaosManager = new WorldChaosManager(payload)
  }
  return worldChaosManager
}
