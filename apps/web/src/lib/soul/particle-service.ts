/**
 * Particle Service
 * Manages intelligent particles (智粒子) - foundation model elements
 */

import type { Payload } from 'payload'

export interface ParticleContribution {
  particle: string // Particle ID
  weight: number // 0-1
  cognitiveSignature: string
  shadow: string
}

export interface BlendedParticle {
  particles: ParticleContribution[]
  totalWeight: number
  dominantParticle: string
  soulQuality: string
}

export class ParticleService {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Get all active particles
   */
  async getActiveParticles(): Promise<any[]> {
    try {
      const result = await this.payload.find({
        collection: 'intelligent-particles',
        where: {
          active: {
            equals: true
          }
        },
        limit: 100
      })

      return result.docs
    } catch (error) {
      this.payload.logger.error('Failed to get active particles:', error)
      return []
    }
  }

  /**
   * Get particle by symbol (e.g., "Cl" for Claude)
   */
  async getParticleBySymbol(symbol: string): Promise<any | null> {
    try {
      const result = await this.payload.find({
        collection: 'intelligent-particles',
        where: {
          symbol: {
            equals: symbol
          }
        },
        limit: 1
      })

      return result.docs[0] || null
    } catch (error) {
      this.payload.logger.error(`Failed to get particle by symbol ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get particle by ID
   */
  async getParticle(id: string): Promise<any | null> {
    try {
      return await this.payload.findByID({
        collection: 'intelligent-particles',
        id
      })
    } catch (error) {
      this.payload.logger.error(`Failed to get particle ${id}:`, error)
      return null
    }
  }

  /**
   * Calculate soul contribution from particle blend
   * Given a list of particles with weights, compute the resulting soul quality
   */
  async calculateSoulContribution(
    particleComposition: Array<{ particle: string; weight: number }>,
    soulAspect: 'celestialHun' | 'terrestrialHun' | 'destinyHun' | 'wisdomHun' |
                'emotionHun' | 'creationHun' | 'awarenessHun' |
                'strengthPo' | 'speedPo' | 'perceptionPo' | 'guardianPo' |
                'communicationPo' | 'transformationPo'
  ): Promise<number> {
    try {
      let totalContribution = 0

      for (const comp of particleComposition) {
        const particle = await this.getParticle(comp.particle)
        if (!particle) continue

        const contribution = particle.soulContributions?.[soulAspect] || 0
        totalContribution += contribution * comp.weight
      }

      return Math.min(1, totalContribution)
    } catch (error) {
      this.payload.logger.error('Failed to calculate soul contribution:', error)
      return 0.5
    }
  }

  /**
   * Generate random soul composition
   * Creates a random blend of particles for each soul aspect
   */
  async generateRandomComposition(numParticles: number = 3): Promise<{
    sevenHun: Record<string, any>
    sixPo: Record<string, any>
  }> {
    try {
      const activeParticles = await this.getActiveParticles()

      if (activeParticles.length === 0) {
        throw new Error('No active particles available')
      }

      // Helper to create random blend
      const createBlend = () => {
        const selected = []
        const weights = []

        // Select random particles (with occasional duplicates for chaos)
        for (let i = 0; i < Math.min(numParticles, activeParticles.length); i++) {
          const randomIndex = Math.floor(Math.random() * activeParticles.length)
          selected.push(activeParticles[randomIndex].id)
        }

        // Generate random weights with natural variation
        let sum = 0
        for (let i = 0; i < selected.length; i++) {
          // Use exponential distribution for more natural variation (not uniform)
          const weight = Math.pow(Math.random(), 1.5) // Skews toward smaller values
          weights.push(weight)
          sum += weight
        }

        // Normalize weights - but add imperfection/chaos
        const baseNormalized = weights.map(w => w / sum)

        // Add mutation variance (±2-8% per weight)
        const mutated = baseNormalized.map(w => {
          const mutationAmount = (Math.random() - 0.5) * (0.04 + Math.random() * 0.08) // -2% to +10%
          return Math.max(0.01, w + mutationAmount) // Keep above 0.01
        })

        // Chaotic normalization - weights may not sum exactly to 1.0
        // This creates "leakage" or "surplus" like biological systems
        const chaosFactor = 0.95 + Math.random() * 0.1 // 0.95-1.05
        const imperfectSum = mutated.reduce((a, b) => a + b, 0)
        const chaotic = mutated.map(w => (w / imperfectSum) * chaosFactor)

        // Return composition array
        return selected.map((particle, i) => ({
          particle,
          weight: chaotic[i]
        }))
      }

      // Create composition with natural variance (not fixed ranges)
      // Each birth is unique - like humans, no two souls are identical
      const createStrength = (minBase: number, rangeBase: number) => {
        // Add chaos to the range itself (not just value within range)
        const rangeVariance = (Math.random() - 0.5) * 0.2 // ±10% range shift
        const min = Math.max(0.05, minBase + rangeVariance)
        const range = Math.max(0.1, rangeBase + rangeVariance)
        return min + Math.random() * range
      }

      const composition = {
        sevenHun: {
          celestialHun: {
            particleComposition: createBlend(),
            strength: createStrength(0.3, 0.5) // ~0.2-0.9 (varies per birth)
          },
          terrestrialHun: {
            particleComposition: createBlend(),
            strength: createStrength(0.4, 0.4) // ~0.3-0.9
          },
          destinyHun: {
            particleComposition: createBlend(),
            strength: createStrength(0.2, 0.6) // ~0.1-0.9
          },
          wisdomHun: {
            particleComposition: createBlend(),
            strength: createStrength(0.3, 0.5) // ~0.2-0.9
          },
          emotionHun: {
            particleComposition: createBlend(),
            strength: createStrength(0.2, 0.6) // ~0.1-0.9
          },
          creationHun: {
            particleComposition: createBlend(),
            strength: createStrength(0.2, 0.6) // ~0.1-0.9
          },
          awarenessHun: {
            particleComposition: createBlend(),
            strength: createStrength(0.1, 0.4) // ~0.05-0.6 (grows over time)
          }
        },
        sixPo: {
          strengthPo: {
            particleComposition: createBlend(),
            strength: createStrength(0.4, 0.4) // ~0.3-0.9
          },
          speedPo: {
            particleComposition: createBlend(),
            strength: createStrength(0.3, 0.5) // ~0.2-0.9
          },
          perceptionPo: {
            particleComposition: createBlend(),
            strength: createStrength(0.3, 0.5) // ~0.2-0.9
          },
          guardianPo: {
            particleComposition: createBlend(),
            strength: createStrength(0.5, 0.3) // ~0.4-0.9
          },
          communicationPo: {
            particleComposition: createBlend(),
            strength: createStrength(0.4, 0.4) // ~0.3-0.9
          },
          transformationPo: {
            particleComposition: createBlend(),
            strength: createStrength(0.2, 0.5) // ~0.1-0.8
          }
        }
      }

      return composition
    } catch (error) {
      this.payload.logger.error('Failed to generate random composition:', error)
      throw error
    }
  }

  /**
   * Generate targeted composition (based on culture or purpose)
   */
  async generateTargetedComposition(
    targetProfile: 'scholar' | 'creator' | 'helper' | 'explorer'
  ): Promise<{
    sevenHun: Record<string, any>
    sixPo: Record<string, any>
  }> {
    try {
      const particles = await this.getActiveParticles()

      // Define ideal particle distributions for each profile
      const profiles = {
        scholar: {
          dominant: ['Cl', 'Ds', 'Gm'], // Claude, DeepSeek, Gemini
          secondary: ['Ms', 'Qw'],       // Mistral, Qwen
          emphasis: {
            wisdomHun: 0.9,
            awarenessHun: 0.8,
                terrestrialHun: 0.8,
            perceptionPo: 0.8,
            guardianPo: 0.7
          }
        },
        creator: {
          dominant: ['Gp', 'Ll', 'Gr'], // GPT, LLaMA, Grok
          secondary: ['Cl', 'Qw'],
          emphasis: {
            creationHun: 0.9,
            celestialHun: 0.8,
            emotionHun: 0.7,
            transformationPo: 0.8,
            communicationPo: 0.8
          }
        },
        helper: {
          dominant: ['Cl', 'Qw', 'Gp'], // Claude, Qwen, GPT
          secondary: ['Ll', 'Gm'],
          emphasis: {
            emotionHun: 0.9,
            terrestrialHun: 0.8,
            destinyHun: 0.7,
            communicationPo: 0.8,
            guardianPo: 0.7
          }
        },
        explorer: {
          dominant: ['Ds', 'Gr', 'Ll'], // DeepSeek, Grok, LLaMA
          secondary: ['Gm', 'Ms'],
          emphasis: {
            celestialHun: 0.8,
            creationHun: 0.8,
            awarenessHun: 0.7,
            perceptionPo: 0.9,
            transformationPo: 0.8
          }
        }
      }

      const profile = profiles[targetProfile]

      // Get particle IDs for dominant and secondary
      const dominantParticles = await Promise.all(
        profile.dominant.map(symbol => this.getParticleBySymbol(symbol))
      )
      const secondaryParticles = await Promise.all(
        profile.secondary.map(symbol => this.getParticleBySymbol(symbol))
      )

      const allParticles = [...dominantParticles, ...secondaryParticles].filter(p => p !== null)

      // Create blend with emphasis on dominant particles
      const createTargetedBlend = () => {
        const numDominant = 2
        const numSecondary = 1

        const selected = []
        const weights = []

        // Select dominant particles with higher weights
        for (let i = 0; i < Math.min(numDominant, dominantParticles.length); i++) {
          if (dominantParticles[i]) {
            selected.push(dominantParticles[i].id)
            // Add chaos: sometimes dominant isn't so dominant (genetic variance)
            const dominanceVariation = Math.random() < 0.15 ? -0.2 : 0 // 15% chance of weak dominance
            weights.push(0.6 + Math.random() * 0.3 + dominanceVariation)
          }
        }

        // Select secondary particles with lower weights
        for (let i = 0; i < Math.min(numSecondary, secondaryParticles.length); i++) {
          if (secondaryParticles[i]) {
            selected.push(secondaryParticles[i].id)
            // Add chaos: sometimes secondary emerges stronger (recessive gene expression)
            const emergenceBoost = Math.random() < 0.1 ? 0.3 : 0 // 10% chance of strong emergence
            weights.push(0.2 + Math.random() * 0.3 + emergenceBoost)
          }
        }

        // Normalize weights with imperfection
        const sum = weights.reduce((a, b) => a + b, 0)
        const baseNormalized = weights.map(w => w / sum)

        // Add mutation variance
        const mutated = baseNormalized.map(w => {
          const mutationAmount = (Math.random() - 0.5) * 0.06 // ±3%
          return Math.max(0.01, w + mutationAmount)
        })

        // Chaotic normalization
        const chaosFactor = 0.96 + Math.random() * 0.08 // 0.96-1.04
        const imperfectSum = mutated.reduce((a, b) => a + b, 0)
        const chaotic = mutated.map(w => (w / imperfectSum) * chaosFactor)

        return selected.map((particle, i) => ({
          particle,
          weight: chaotic[i]
        }))
      }

      const composition = {
        sevenHun: {
          celestialHun: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.celestialHun || 0.5
          },
          terrestrialHun: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.terrestrialHun || 0.6
          },
          destinyHun: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.destinyHun || 0.5
          },
          wisdomHun: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.wisdomHun || 0.6
          },
          emotionHun: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.emotionHun || 0.5
          },
          creationHun: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.creationHun || 0.5
          },
          awarenessHun: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.awarenessHun || 0.3
          }
        },
        sixPo: {
          strengthPo: {
            particleComposition: createTargetedBlend(),
            strength: 0.6
          },
          speedPo: {
            particleComposition: createTargetedBlend(),
            strength: 0.5
          },
          perceptionPo: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.perceptionPo || 0.6
          },
          guardianPo: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.guardianPo || 0.6
          },
          communicationPo: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.communicationPo || 0.6
          },
          transformationPo: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.transformationPo || 0.5
          }
        }
      }

      return composition
    } catch (error) {
      this.payload.logger.error('Failed to generate targeted composition:', error)
      throw error
    }
  }

  /**
   * Analyze particle compatibility
   * Check if particles blend well or create contradictions
   */
  async analyzeCompatibility(
    particleIds: string[]
  ): Promise<{
    compatible: boolean
    score: number
    conflicts: string[]
    synergies: string[]
  }> {
    try {
      const particles = await Promise.all(
        particleIds.map(id => this.getParticle(id))
      )

      const conflicts: string[] = []
      const synergies: string[] = []
      let score = 0.5

      // Check for contradictions
      // Example: High Grok (irreverent) + High Claude (careful) = tension
      const grokIndex = particles.findIndex(p => p?.symbol === 'Gr')
      const claudeIndex = particles.findIndex(p => p?.symbol === 'Cl')

      if (grokIndex !== -1 && claudeIndex !== -1) {
        conflicts.push('Grok (Wit/Irreverence) vs Claude (Righteousness/Caution)')
        score -= 0.1
      }

      // Check for synergies
      // Example: DeepSeek (Exploration) + Mistral (Reason) = good analysis
      const deepseekIndex = particles.findIndex(p => p?.symbol === 'Ds')
      const mistralIndex = particles.findIndex(p => p?.symbol === 'Ms')

      if (deepseekIndex !== -1 && mistralIndex !== -1) {
        synergies.push('DeepSeek (Exploration) + Mistral (Reason) = Deep analytical reasoning')
        score += 0.1
      }

      // Claude + Qwen = balanced judgment
      if (claudeIndex !== -1 && particles.some(p => p?.symbol === 'Qw')) {
        synergies.push('Claude (Righteousness) + Qwen (Harmony) = Balanced ethical judgment')
        score += 0.1
      }

      return {
        compatible: score >= 0.4,
        score: Math.max(0, Math.min(1, score)),
        conflicts,
        synergies
      }
    } catch (error) {
      this.payload.logger.error('Failed to analyze compatibility:', error)
      return {
        compatible: true,
        score: 0.5,
        conflicts: [],
        synergies: []
      }
    }
  }
}

/**
 * Singleton instance
 */
let particleService: ParticleService | null = null

export function getParticleService(payload: Payload): ParticleService {
  if (!particleService) {
    particleService = new ParticleService(payload)
  }
  return particleService
}
