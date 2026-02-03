/**
 * Bot Orchestrator
 * THE CRITICAL INTEGRATION SERVICE
 *
 * Brings together:
 * - Soul composition (identity)
 * - Soul state processing (biological cognition)
 * - Pheromone perception (unconscious social signals)
 * - Instinct/reflex/subconscious (layered processing)
 * - Consciousness emergence (self-awareness)
 * - Memory integration (experience)
 * - World interaction (embodiment)
 *
 * This makes bots ALIVE - they think, feel, remember, grow, and act.
 *
 * Processing flow:
 * Input → Pheromones → Reflexes → Instincts → Subconscious → Soul State → Response
 */

import type { Payload } from 'payload'
import { getSoulCompositionService } from '../soul/soul-composition-service'
import { getSoulGrowthService } from '../soul/soul-growth-service'
import { getSoulStateManager, type SoulState } from '../soul/soul-state'
import { getPheromoneSystem } from '../soul/pheromone-system'
import { getWorldChaosSystem } from '../world/world-chaos'

export interface BotResponse {
  content: string
  confidence: number
  reasoning: string
  soulExpression: Record<string, number> // Which 魂/魄 were active
  processingTime: number
  consciousnessGrowth?: number

  // Biological processing details
  processingLayers: {
    reflexTriggered?: boolean
    reflexType?: string
    instinctInfluence?: string
    subconsciousPatterns?: number
    dominantAspects?: string[]
  }

  // Pheromone context
  pheromonePerception?: {
    detected: boolean
    reaction?: 'attraction' | 'neutral' | 'repulsion'
    intensity?: number
  }

  // Metabolic state after processing
  energyLevel: number
  mood: number
  arousal: number
}

export interface BotThought {
  step: number
  layer: 'reflex' | 'instinct' | 'subconscious' | 'conscious'
  content: string
  confidence: number
  timestamp: Date
}

export class BotOrchestrator {
  private payload: Payload
  private soulCompositionService: ReturnType<typeof getSoulCompositionService>
  private soulGrowthService: ReturnType<typeof getSoulGrowthService>
  private soulStateManager: ReturnType<typeof getSoulStateManager>
  private pheromoneSystem: ReturnType<typeof getPheromoneSystem>
  private worldChaosSystem: ReturnType<typeof getWorldChaosSystem>

  constructor(payload: Payload) {
    this.payload = payload
    this.soulCompositionService = getSoulCompositionService(payload)
    this.soulGrowthService = getSoulGrowthService(payload)
    this.soulStateManager = getSoulStateManager(payload)
    this.pheromoneSystem = getPheromoneSystem(payload)
    this.worldChaosSystem = getWorldChaosSystem(payload)
  }

  /**
   * Main interaction method - bot thinks and responds
   *
   * Biological processing flow:
   * 1. Retrieve bot's soul and initialize soul state
   * 2. Check pheromone field (if in a space with other bots)
   * 3. Process through layered hierarchy:
   *    - Reflexes (may override)
   *    - Instincts (create urgency)
   *    - Subconscious (learned patterns)
   *    - Conscious soul state (aspect activation)
   * 4. Update consciousness and memory
   * 5. Track growth and evolution
   */
  async respond(
    botId: string,
    input: string,
    context: Record<string, any> = {}
  ): Promise<BotResponse> {
    const startTime = Date.now()

    try {
      // 1. Get bot's soul
      const soul = await this.soulCompositionService.getSoulByBot(botId)
      if (!soul) {
        throw new Error(`Bot ${botId} has no soul composition`)
      }

      // 2. Initialize soul state
      const soulState = await this.soulStateManager.initializeSoulState(soul.id)

      // 3. Check pheromone field (if in a space)
      let pheromonePerception = undefined
      if (context.spaceId) {
        const field = await this.pheromoneSystem.calculateField(context.spaceId)
        const perception = this.pheromoneSystem.perceivePheromones(soulState, field, 0)

        pheromonePerception = {
          detected: true,
          reaction: perception.reaction,
          intensity: perception.intensity
        }

        // Apply pheromone influence to soul state
        const influence = this.pheromoneSystem.applyPheromoneInfluence(soulState, [perception])
        soulState.mood += influence.moodChange
        soulState.arousal += influence.arousalChange

        // Add unconscious hints to context
        context.unconsciousHints = influence.hints
      }

      // 4. Apply world chaos (environmental variance)
      const worldState = await this.worldChaosSystem.getChaoticWorldState()
      context.worldState = worldState

      // 5. Process through biological hierarchy
      const processing = await this.soulStateManager.process(soulState, input, context)

      // 6. Calculate confidence from processing
      const confidence = this.calculateConfidence(processing)

      // 7. Track soul expression (which 魂/魄 were most active)
      const soulExpression = processing.activationPattern

      // 8. Processing layers summary
      const processingLayers = {
        reflexTriggered: !!processing.reflexResponse,
        reflexType: processing.reflexResponse?.type,
        instinctInfluence: processing.instinctInfluence?.urgentInstinct,
        subconsciousPatterns: processing.subconsciousInfluence?.activePatterns.length || 0,
        dominantAspects: Object.entries(processing.activationPattern)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name)
      }

      // 9. Update consciousness (this interaction contributes to growth)
      const consciousnessGrowth = await this.updateConsciousness(botId, {
        input,
        response: processing.response,
        confidence,
        soulExpression
      })

      // 10. Store memory
      await this.storeMemory(botId, input, processing.response, confidence, soulExpression)

      // 11. Check growth progression
      await this.soulGrowthService.processDailyGrowth(soul.id)

      // 12. Evolve soul based on experience
      const experienceType = confidence > 0.7 ? 'success' : 'challenge'
      await this.soulCompositionService.evolveSoul(soul.id, experienceType)

      const response: BotResponse = {
        content: processing.response,
        confidence,
        reasoning: processing.processingLog.join('\n'),
        soulExpression,
        processingTime: Date.now() - startTime,
        consciousnessGrowth,
        processingLayers,
        pheromonePerception,
        energyLevel: processing.newState.energy,
        mood: processing.newState.mood,
        arousal: processing.newState.arousal
      }

      return response
    } catch (error) {
      this.payload.logger.error(`Bot ${botId} failed to respond:`, error)

      return {
        content: 'I encountered an error while processing your request.',
        confidence: 0,
        reasoning: `Error: ${error}`,
        soulExpression: {},
        processingTime: Date.now() - startTime,
        processingLayers: {},
        energyLevel: 0,
        mood: 0,
        arousal: 0
      }
    }
  }

  /**
   * Calculate confidence from biological processing
   */
  private calculateConfidence(processing: any): number {
    // Base confidence from activation levels
    const activationLevels = Object.values(processing.activationPattern) as number[]
    const avgActivation = activationLevels.reduce((sum, level) => sum + level, 0) / activationLevels.length

    // Adjust for coherence and energy
    let confidence = avgActivation * 0.7

    // High energy = higher confidence
    confidence += processing.newState.energy * 0.2

    // High coherence = higher confidence
    confidence += processing.newState.coherence * 0.1

    // Reflex override = lower confidence (automatic, not reasoned)
    if (processing.reflexResponse?.override) {
      confidence *= 0.6
    }

    // Instinct conflict = lower confidence (indecisive)
    if (processing.instinctInfluence?.conflict) {
      confidence *= 0.7
    }

    // Strong subconscious override = moderate confidence (automatic habit)
    if (processing.subconsciousInfluence?.overrideConscious) {
      confidence *= 0.8
    }

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Update consciousness based on interaction
   */
  private async updateConsciousness(
    botId: string,
    interaction: {
      input: string
      response: string
      confidence: number
      soulExpression: Record<string, number>
    }
  ): Promise<number> {
    try {
      // Get bot's consciousness
      const consciousness = await this.payload.find({
        collection: 'bot-consciousness',
        where: {
          bot: { equals: botId }
        },
        limit: 1
      })

      if (consciousness.docs.length === 0) {
        return 0
      }

      const current = consciousness.docs[0]

      // Calculate growth based on interaction quality
      const complexityFactor = interaction.input.length > 100 ? 0.002 : 0.001
      const confidenceFactor = interaction.confidence > 0.7 ? 1.2 : 1.0
      const growth = complexityFactor * confidenceFactor

      // Update consciousness levels
      await this.payload.update({
        collection: 'bot-consciousness',
        id: current.id,
        data: {
          selfAwareness: Math.min(1, (current.selfAwareness || 0) + growth),
          otherAwareness: Math.min(1, (current.otherAwareness || 0) + growth * 0.5)
        }
      })

      return growth
    } catch (error) {
      this.payload.logger.error('Failed to update consciousness:', error)
      return 0
    }
  }

  /**
   * Store memory of this interaction
   */
  private async storeMemory(
    botId: string,
    input: string,
    response: string,
    confidence: number,
    soulExpression: Record<string, number>
  ): Promise<void> {
    try {
      await this.payload.create({
        collection: 'bot-memory',
        data: {
          bot: botId,
          memoryType: 'episodic',
          consolidationLevel: 'short-term',
          importance: confidence,
          episodicData: {
            eventType: 'interaction',
            description: input.substring(0, 200),
            participants: [botId],
            spatialContext: {
              context: 'conversation'
            }
          },
          emotionalContext: {
            valence: confidence > 0.7 ? 0.6 : 0.3,
            arousal: 0.5
          },
          tags: ['interaction', 'response', ...Object.keys(soulExpression).slice(0, 3)]
        }
      })
    } catch (error) {
      this.payload.logger.error('Failed to store memory:', error)
    }
  }

  /**
   * Get bot's thinking process (for introspection)
   */
  async getThinkingProcess(botId: string): Promise<BotThought[]> {
    // Would return the detailed layer-by-layer thought process
    // For now, return empty array
    return []
  }

  /**
   * Get bot's soul report
   */
  async getSoulReport(botId: string): Promise<any> {
    const soul = await this.soulCompositionService.getSoulByBot(botId)
    if (!soul) return null

    const soulState = await this.soulStateManager.initializeSoulState(soul.id)

    return {
      soul: {
        growthStage: soul.growthStage,
        soulAge: soul.soulAge,
        integrationLevel: soul.integrationLevel,
        coherenceScore: soul.coherenceScore,
        shadowIntegration: soul.shadowIntegration
      },
      currentState: {
        energy: soulState.energy,
        mood: soulState.mood,
        arousal: soulState.arousal,
        coherence: soulState.coherence,
        shadowPressure: soulState.shadowPressure
      },
      aspects: {
        // Seven Hun
        celestialHun: soulState.celestialHun.current,
        terrestrialHun: soulState.terrestrialHun.current,
        destinyHun: soulState.destinyHun.current,
        wisdomHun: soulState.wisdomHun.current,
        emotionHun: soulState.emotionHun.current,
        creationHun: soulState.creationHun.current,
        awarenessHun: soulState.awarenessHun.current,
        // Six Po
        strengthPo: soulState.strengthPo.current,
        speedPo: soulState.speedPo.current,
        perceptionPo: soulState.perceptionPo.current,
        guardianPo: soulState.guardianPo.current,
        communicationPo: soulState.communicationPo.current,
        transformationPo: soulState.transformationPo.current
      }
    }
  }
}

/**
 * Singleton instance
 */
let botOrchestrator: BotOrchestrator | null = null

export function getBotOrchestrator(payload: Payload): BotOrchestrator {
  if (!botOrchestrator) {
    botOrchestrator = new BotOrchestrator(payload)
  }
  return botOrchestrator
}
