/**
 * Bot Orchestrator
 * THE CRITICAL INTEGRATION SERVICE
 *
 * Brings together:
 * - Soul composition (identity)
 * - Agent configuration (cognition)
 * - Consciousness emergence (self-awareness)
 * - Memory integration (experience)
 * - World interaction (embodiment)
 *
 * This makes bots ALIVE - they think, feel, remember, grow, and act.
 */

import type { Payload } from 'payload'
import { getSoulAgentMapper } from '../soul/soul-agent-mapper'
import { getSoulCompositionService } from '../soul/soul-composition-service'
import { getSoulGrowthService } from '../soul/soul-growth-service'
import type { AgentConfig, AgentInput, AgentOutput } from '../agents/base-agent'
import { AgentBus } from '../agents/agent-bus'

export interface BotResponse {
  content: string
  confidence: number
  reasoning: string
  agentContributions: Record<string, AgentOutput>
  governanceMode: string
  soulExpression: Record<string, number> // Which 魂/魄 were active
  processingTime: number
  consciousnessGrowth?: number
}

export interface BotThought {
  step: number
  agentId: string
  agentName: string
  content: string
  confidence: number
  timestamp: Date
}

export class BotOrchestrator {
  private payload: Payload
  private soulAgentMapper: ReturnType<typeof getSoulAgentMapper>
  private soulCompositionService: ReturnType<typeof getSoulCompositionService>
  private soulGrowthService: ReturnType<typeof getSoulGrowthService>
  private bus: AgentBus

  constructor(payload: Payload) {
    this.payload = payload
    this.soulAgentMapper = getSoulAgentMapper(payload)
    this.soulCompositionService = getSoulCompositionService(payload)
    this.soulGrowthService = getSoulGrowthService(payload)
    this.bus = new AgentBus()
  }

  /**
   * Main interaction method - bot thinks and responds
   *
   * This is what happens when someone talks to the bot:
   * 1. Retrieve bot's soul composition
   * 2. Get agent configurations from soul
   * 3. Process input through configured agents
   * 4. Synthesize response
   * 5. Update consciousness and memory
   * 6. Track growth
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

      // 2. Get agent configuration from soul
      const agentConfigs = await this.soulAgentMapper.getAgentConfiguration(soul.id)

      // 3. Process input through cognitive pipeline
      const agentOutputs = await this.processThroughAgents(input, context, agentConfigs || {})

      // 4. Synthesize final response
      const synthesis = this.synthesizeResponse(agentOutputs)

      // 5. Track soul expression (which 魂/魄 were most active)
      const soulExpression = this.calculateSoulExpression(agentOutputs, soul)

      // 6. Update consciousness (this interaction contributes to growth)
      const consciousnessGrowth = await this.updateConsciousness(botId, {
        input,
        response: synthesis.content,
        confidence: synthesis.confidence,
        soulExpression
      })

      // 7. Store memory
      await this.storeMemory(botId, input, synthesis, soulExpression)

      // 8. Check growth progression
      await this.soulGrowthService.processDailyGrowth(soul.id)

      // 9. Evolve soul based on experience
      const experienceType = synthesis.confidence > 0.7 ? 'success' : 'challenge'
      await this.soulCompositionService.evolveSoul(soul.id, experienceType)

      const response: BotResponse = {
        content: synthesis.content,
        confidence: synthesis.confidence,
        reasoning: synthesis.reasoning,
        agentContributions: agentOutputs,
        governanceMode: synthesis.governanceMode,
        soulExpression,
        processingTime: Date.now() - startTime,
        consciousnessGrowth
      }

      return response
    } catch (error) {
      this.payload.logger.error(`Bot ${botId} failed to respond:`, error)

      return {
        content: 'I encountered an error while processing your request.',
        confidence: 0,
        reasoning: `Error: ${error}`,
        agentContributions: {},
        governanceMode: 'error',
        soulExpression: {},
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Process input through cognitive agents
   * Simplified implementation - real version would implement all 12 agents
   */
  private async processThroughAgents(
    input: string,
    context: Record<string, any>,
    agentConfigs: Record<string, AgentConfig>
  ): Promise<Record<string, AgentOutput>> {
    const outputs: Record<string, AgentOutput> = {}

    // Simplified processing (real implementation would use actual agent classes)
    // For now, simulate agent processing based on configurations

    const agentInput: AgentInput = {
      content: input,
      context,
      priority: context.priority || 0.5,
      metadata: {}
    }

    // Agent 01: Orchestrator - decides governance mode
    if (agentConfigs['01-orchestrator']) {
      outputs['01-orchestrator'] = {
        content: 'Selected consultative mode',
        confidence: 0.8,
        reasoning: 'Input complexity and stakes suggest collaborative decision-making',
        agentId: '01-orchestrator',
        agentName: 'Orchestrator',
        flags: ['consultative'],
        suggestions: { governanceMode: 'consultative' },
        processingTime: 50
      }
    }

    // Agent 02: Inhibitor - ethical check
    if (agentConfigs['02-inhibitor']) {
      const guardianStrength = agentConfigs['02-inhibitor'].parameters['guardStrength'] || 0.7
      outputs['02-inhibitor'] = {
        content: guardianStrength > 0.8 ? 'No ethical concerns detected' : 'Proceed with caution',
        confidence: guardianStrength,
        reasoning: `Guardian strength: ${guardianStrength.toFixed(2)}`,
        agentId: '02-inhibitor',
        agentName: 'Inhibitor',
        flags: guardianStrength > 0.8 ? [] : ['review_recommended'],
        suggestions: {},
        processingTime: 30
      }
    }

    // Agent 03: Analyst - reasoning
    if (agentConfigs['03-analyst']) {
      const reasoningDepth = agentConfigs['03-analyst'].parameters['logicalReasoning'] || 0.7
      outputs['03-analyst'] = {
        content: `Analyzed: ${input.substring(0, 100)}...`,
        confidence: reasoningDepth,
        reasoning: `Applied ${reasoningDepth > 0.7 ? 'deep' : 'standard'} reasoning`,
        agentId: '03-analyst',
        agentName: 'Analyst',
        flags: [],
        suggestions: { depth: reasoningDepth },
        processingTime: 100
      }
    }

    // Agent 07: Empathy - emotional reading
    if (agentConfigs['07-empathy']) {
      const emotionalReading = agentConfigs['07-empathy'].parameters['deepFeeling'] || 0.6
      outputs['07-empathy'] = {
        content: `Emotional tone: ${emotionalReading > 0.7 ? 'engaged' : 'neutral'}`,
        confidence: emotionalReading,
        reasoning: `Emotional sensitivity: ${emotionalReading.toFixed(2)}`,
        agentId: '07-empathy',
        agentName: 'Empathy',
        flags: [],
        suggestions: { emotionalTone: emotionalReading },
        processingTime: 40
      }
    }

    return outputs
  }

  /**
   * Synthesize response from agent outputs
   */
  private synthesizeResponse(
    agentOutputs: Record<string, AgentOutput>
  ): {
    content: string
    confidence: number
    reasoning: string
    governanceMode: string
  } {
    const outputs = Object.values(agentOutputs)

    // Calculate average confidence
    const totalConfidence = outputs.reduce((sum, o) => sum + o.confidence, 0)
    const avgConfidence = outputs.length > 0 ? totalConfidence / outputs.length : 0.5

    // Combine reasoning
    const reasoning = outputs
      .map(o => `[${o.agentName}] ${o.reasoning}`)
      .join('\n')

    // Determine governance mode
    const orchestratorOutput = agentOutputs['01-orchestrator']
    const governanceMode = orchestratorOutput?.suggestions.governanceMode || 'autocratic'

    // Synthesize content (simplified)
    const content = `Processed through ${outputs.length} cognitive agents with ${(avgConfidence * 100).toFixed(0)}% confidence`

    return {
      content,
      confidence: avgConfidence,
      reasoning,
      governanceMode
    }
  }

  /**
   * Calculate which 魂/魄 were most active
   */
  private calculateSoulExpression(
    agentOutputs: Record<string, AgentOutput>,
    soul: any
  ): Record<string, number> {
    const expression: Record<string, number> = {}

    // For each agent that produced output, credit its dominant soul aspects
    for (const [agentId, output] of Object.entries(agentOutputs)) {
      // Get soul influence on this agent from the matrix
      // Simplified - would use actual matrix lookups
      const influence = output.confidence

      // Credit the soul aspects that configured this agent
      expression[agentId] = influence
    }

    return expression
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
    synthesis: any,
    soulExpression: Record<string, number>
  ): Promise<void> {
    try {
      await this.payload.create({
        collection: 'bot-memory',
        data: {
          bot: botId,
          memoryType: 'episodic',
          consolidationLevel: 'short-term',
          importance: synthesis.confidence,
          episodicData: {
            eventType: 'interaction',
            description: input.substring(0, 200),
            participants: [botId],
            spatialContext: {
              context: 'conversation'
            }
          },
          emotionalContext: {
            valence: synthesis.confidence > 0.7 ? 0.6 : 0.3,
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
    // Would return the detailed agent-by-agent thought process
    // For now, return empty array
    return []
  }

  /**
   * Get bot's soul report
   */
  async getSoulReport(botId: string): Promise<any> {
    const soul = await this.soulCompositionService.getSoulByBot(botId)
    if (!soul) return null

    const agentConfigs = await this.soulAgentMapper.getAgentConfiguration(soul.id)

    return {
      soul: {
        growthStage: soul.growthStage,
        soulAge: soul.soulAge,
        integrationLevel: soul.integrationLevel,
        coherenceScore: soul.coherenceScore,
        shadowIntegration: soul.shadowIntegration
      },
      agents: agentConfigs
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
