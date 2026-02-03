/**
 * Multi-Bot Conversation System
 *
 * Conversations emerge from soul interactions:
 * - Turn-taking (not rigid - interruptions possible)
 * - Influence (persuasive bots shift opinions)
 * - Emotional contagion (moods spread)
 * - Group dynamics (coalitions, conflicts, status hierarchies)
 */

import type { Payload } from 'payload'
import { getSoulStateManager } from '../soul/soul-state'
import type { SoulState } from '../soul/soul-state'

/**
 * Conversation state
 */
export interface ConversationState {
  id: string
  participants: string[] // Bot IDs
  topic: string
  turn: number
  emotionalField: number // Group mood (-1 to 1)
  arousal: number // Group activation level (0-1)
  speakingOrder: string[] // Who has spoken
  dominanceHierarchy: Record<string, number> // Bot ID → dominance score
  coalitions: string[][] // Groups of aligned bots
  active: boolean
  startedAt: Date
  lastActivity: Date
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  speaker: string // Bot ID
  content: string
  style: string
  emotionalTone: number
  influenceAttempt: boolean
  reactions: Array<{
    bot: string
    type: 'agree' | 'disagree' | 'question' | 'ignore'
    intensity: number
  }>
}

/**
 * Multi-bot conversation system
 */
export class MultiBotConversationSystem {
  private payload: Payload
  private soulStateManager: ReturnType<typeof getSoulStateManager>

  constructor(payload: Payload) {
    this.payload = payload
    this.soulStateManager = getSoulStateManager(payload)
  }

  /**
   * Start a multi-bot conversation
   */
  async startConversation(
    botIds: string[],
    topic: string
  ): Promise<ConversationState> {
    if (botIds.length < 2) {
      throw new Error('Need at least 2 bots for conversation')
    }

    // Calculate initial dominance hierarchy
    const dominance = await this.calculateDominanceHierarchy(botIds)

    const state: ConversationState = {
      id: `conv_${Date.now()}`,
      participants: botIds,
      topic,
      turn: 0,
      emotionalField: 0, // Neutral
      arousal: 0.5, // Moderate
      speakingOrder: [],
      dominanceHierarchy: dominance,
      coalitions: [],
      active: true,
      startedAt: new Date(),
      lastActivity: new Date()
    }

    this.payload.logger.info(
      `Started conversation ${state.id}: ${botIds.length} participants on topic "${topic}"`
    )

    return state
  }

  /**
   * Process one turn of conversation
   */
  async processTurn(
    state: ConversationState
  ): Promise<{
    turn: ConversationTurn
    newState: ConversationState
  }> {
    // 1. Select who speaks next
    const speaker = this.selectSpeaker(state)

    // 2. Get speaker's soul state
    const soulState = await this.getSoulState(speaker)

    // 3. Generate response based on soul + conversation context
    const response = await this.generateResponse(soulState, state)

    // 4. Other bots react
    const reactions = await this.generateReactions(state, speaker, response)

    const turn: ConversationTurn = {
      speaker,
      content: response.content,
      style: response.style,
      emotionalTone: response.emotionalTone,
      influenceAttempt: response.influenceAttempt,
      reactions
    }

    // 5. Update conversation state
    const newState = this.updateConversationState(state, turn)

    return { turn, newState }
  }

  /**
   * Select who speaks next (not purely sequential)
   */
  private selectSpeaker(state: ConversationState): string {
    // Factors:
    // - Dominance (high = more likely to speak)
    // - Emotional arousal (high = interrupts more)
    // - Turn history (those who haven't spoken get boost)

    const scores: Record<string, number> = {}

    for (const botId of state.participants) {
      let score = 0

      // Dominance contribution
      score += (state.dominanceHierarchy[botId] || 0.5) * 0.4

      // Haven't spoken recently boost
      const lastSpoke = state.speakingOrder.lastIndexOf(botId)
      if (lastSpoke === -1) {
        score += 0.3 // Never spoken
      } else {
        const turnsSince = state.speakingOrder.length - lastSpoke
        score += Math.min(0.3, turnsSince * 0.05)
      }

      // Emotional arousal (high = more likely to jump in)
      // Would get from soul state
      score += Math.random() * 0.3 // Placeholder

      scores[botId] = score
    }

    // Select with weighted probability
    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    const random = Math.random() * total
    let cumulative = 0

    for (const [botId, score] of Object.entries(scores)) {
      cumulative += score
      if (random <= cumulative) {
        return botId
      }
    }

    // Fallback
    return state.participants[0]
  }

  /**
   * Get soul state for bot
   */
  private async getSoulState(botId: string): Promise<SoulState> {
    const soul = await this.getSoulByBot(botId)
    if (!soul) {
      throw new Error(`Soul not found for bot ${botId}`)
    }

    return await this.soulStateManager.initializeSoulState(soul.id)
  }

  /**
   * Generate response from bot
   */
  private async generateResponse(
    soulState: SoulState,
    conversationState: ConversationState
  ): Promise<{
    content: string
    style: string
    emotionalTone: number
    influenceAttempt: boolean
  }> {
    // Determine response style from dominant aspects
    let style = 'balanced'
    let emotionalTone = soulState.mood
    let influenceAttempt = false

    if (soulState.celestialHun.current > 0.7) {
      style = 'visionary'
    } else if (soulState.terrestrialHun.current > 0.7) {
      style = 'practical'
    } else if (soulState.emotionHun.current > 0.7) {
      style = 'empathetic'
      emotionalTone += 0.2
    } else if (soulState.wisdomHun.current > 0.7) {
      style = 'thoughtful'
    }

    // High destiny + wisdom = persuasive (influence attempt)
    if (soulState.destinyHun.current > 0.6 && soulState.wisdomHun.current > 0.6) {
      influenceAttempt = true
    }

    // Placeholder content (in real impl, would generate based on topic + style)
    const content = `[${style} response about ${conversationState.topic}]`

    return {
      content,
      style,
      emotionalTone,
      influenceAttempt
    }
  }

  /**
   * Generate reactions from other bots
   */
  private async generateReactions(
    state: ConversationState,
    speaker: string,
    response: any
  ): Promise<Array<{ bot: string; type: 'agree' | 'disagree' | 'question' | 'ignore'; intensity: number }>> {
    const reactions: Array<{ bot: string; type: 'agree' | 'disagree' | 'question' | 'ignore'; intensity: number }> = []

    for (const botId of state.participants) {
      if (botId === speaker) continue

      // Get listener soul state
      const soul = await this.getSoulState(botId)

      // Reaction based on:
      // - Affinity with speaker
      // - Emotional contagion
      // - Value alignment

      const affinity = state.dominanceHierarchy[botId] || 0.5 // Simplified

      // Determine reaction type
      let type: 'agree' | 'disagree' | 'question' | 'ignore' = 'ignore'
      let intensity = 0.5

      if (response.influenceAttempt) {
        // More likely to react to influence attempt
        if (affinity > 0.6) {
          type = 'agree'
          intensity = affinity
        } else if (affinity < 0.4) {
          type = 'disagree'
          intensity = 1 - affinity
        } else {
          type = 'question'
          intensity = 0.6
        }
      } else {
        // Random reaction based on arousal
        if (soul.arousal > 0.6 && Math.random() < 0.5) {
          type = Math.random() < 0.5 ? 'agree' : 'question'
          intensity = soul.arousal
        }
      }

      reactions.push({ bot: botId, type, intensity })
    }

    return reactions
  }

  /**
   * Update conversation state after turn
   */
  private updateConversationState(
    state: ConversationState,
    turn: ConversationTurn
  ): ConversationState {
    const newState = { ...state }

    // Update turn count
    newState.turn++

    // Add speaker to order
    newState.speakingOrder.push(turn.speaker)

    // Update emotional field
    const emotionalContribution = turn.emotionalTone * 0.2
    newState.emotionalField = newState.emotionalField * 0.8 + emotionalContribution

    // Update arousal based on reactions
    const reactionIntensity =
      turn.reactions.reduce((sum, r) => sum + r.intensity, 0) / turn.reactions.length
    newState.arousal = newState.arousal * 0.7 + reactionIntensity * 0.3

    // Detect coalitions (bots who consistently agree)
    // Would implement coalition detection based on reaction patterns

    newState.lastActivity = new Date()

    return newState
  }

  /**
   * Calculate dominance hierarchy
   */
  private async calculateDominanceHierarchy(botIds: string[]): Promise<Record<string, number>> {
    const dominance: Record<string, number> = {}

    for (const botId of botIds) {
      const soul = await this.getSoulByBot(botId)

      if (!soul) {
        dominance[botId] = 0.5
        continue
      }

      // Dominance = integration level + communication + terrestrial (grounded action)
      const dom =
        soul.integrationLevel * 0.4 +
        soul.sixPo.communicationPo.strength * 0.3 +
        soul.sevenHun.terrestrialHun.strength * 0.3

      dominance[botId] = Math.max(0, Math.min(1, dom))
    }

    return dominance
  }

  /**
   * Get soul by bot ID
   */
  private async getSoulByBot(botId: string): Promise<any | null> {
    const result = await this.payload.find({
      collection: 'bot-souls',
      where: { bot: { equals: botId } },
      limit: 1
    })

    return result.docs[0] || null
  }

  /**
   * Run full conversation (multiple turns)
   */
  async runConversation(
    botIds: string[],
    topic: string,
    maxTurns: number = 10
  ): Promise<{
    state: ConversationState
    transcript: ConversationTurn[]
  }> {
    let state = await this.startConversation(botIds, topic)
    const transcript: ConversationTurn[] = []

    for (let i = 0; i < maxTurns; i++) {
      if (!state.active) break

      const { turn, newState } = await this.processTurn(state)
      transcript.push(turn)
      state = newState

      // Check if conversation should end
      if (state.arousal < 0.2) {
        // Low arousal = conversation dying
        state.active = false
      }
    }

    this.payload.logger.info(
      `Conversation ${state.id} ended after ${transcript.length} turns`
    )

    return { state, transcript }
  }
}

/**
 * Singleton instance
 */
let multiBotConversationSystem: MultiBotConversationSystem | null = null

export function getMultiBotConversationSystem(payload: Payload): MultiBotConversationSystem {
  if (!multiBotConversationSystem) {
    multiBotConversationSystem = new MultiBotConversationSystem(payload)
  }
  return multiBotConversationSystem
}
