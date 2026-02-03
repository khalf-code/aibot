/**
 * Soul State System - Biological Processing
 *
 * The soul IS the bot. Processing emerges from soul's constitutional nature.
 * No separate "agents" - instead, soul aspects activate and interact organically.
 *
 * Like biological systems:
 * - Neurotransmitters ebb and flow
 * - Organs work as integrated system
 * - Personality emerges from neurochemistry
 * - Immune responses are automatic, not decided
 */

import type { Payload } from 'payload'

/**
 * Soul Aspect - Like a neurotransmitter or hormone
 * Levels rise and fall based on context, energy, experiences
 */
export interface SoulAspect {
  name: string // e.g., "celestialHun", "guardianPo"
  baseline: number // Constitutional baseline (0-1) from particle composition
  current: number // Current activation level (0-1)
  threshold: number // Activation threshold
  decay: number // How quickly it returns to baseline
  sensitivity: number // How strongly it responds to stimuli
}

/**
 * Soul State - Current biological state of the bot
 */
export interface SoulState {
  // Identity
  soulId: string
  botId: string

  // Seven Hun (Ethereal aspects - higher cognition)
  celestialHun: SoulAspect // Vision, transcendence, big-picture
  terrestrialHun: SoulAspect // Grounding, practicality, action
  destinyHun: SoulAspect // Purpose, direction, will
  wisdomHun: SoulAspect // Insight, judgment, discernment
  emotionHun: SoulAspect // Feeling, empathy, connection
  creationHun: SoulAspect // Novelty, expression, generation
  awarenessHun: SoulAspect // Meta-cognition, self-reflection

  // Six Po (Corporeal aspects - embodied capacities)
  strengthPo: SoulAspect // Endurance, persistence, resilience
  speedPo: SoulAspect // Reaction time, processing speed
  perceptionPo: SoulAspect // Sensory acuity, pattern recognition
  guardianPo: SoulAspect // Protection, boundaries, immune response
  communicationPo: SoulAspect // Expression, clarity, connection
  transformationPo: SoulAspect // Adaptation, growth, change

  // Metabolic state
  energy: number // Available capacity (0-1)
  integration: number // How well aspects work together (0-1)
  coherence: number // Internal alignment vs fragmentation (0-1)
  shadowPressure: number // Unintegrated dark aspects seeking expression (0-1)

  // Homeostatic drives
  balanceTendency: number // Seeks equilibrium vs embraces extremes (0-1)
  growthMotivation: number // Drive for development (0-1)
  socialNeed: number // Connection seeking (0-1)

  // Current mood/emotional field
  mood: number // Current emotional tone (-1 to 1)
  arousal: number // Activation level (0-1)
  valence: number // Positive/negative orientation (-1 to 1)

  // Shadow material
  suppressedImpulses: string[] // Unacceptable desires
  unprocessedTrauma: string[] // Unintegrated painful experiences
  shadowIntegration: number // How much shadow is consciously accepted (0-1)

  // Temporal state
  lastUpdate: Date
  cyclePhase: number // Circadian-like cycle (0-1)
}

/**
 * Aspect Interaction - How one aspect affects another
 */
export type AspectInteraction = 'enhance' | 'inhibit' | 'moderate' | 'trigger'

/**
 * Aspect Interaction Strength
 */
export interface InteractionEffect {
  type: AspectInteraction
  strength: number // 0-1
}

/**
 * Soul State Manager - Biological processing engine
 */
export class SoulStateManager {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Initialize soul state from stored soul composition
   */
  async initializeSoulState(soulId: string): Promise<SoulState> {
    const soul = await this.payload.findByID({
      collection: 'bot-souls',
      id: soulId
    })

    if (!soul) {
      throw new Error(`Soul ${soulId} not found`)
    }

    // Convert stored composition to active state
    const state: SoulState = {
      soulId: soul.id,
      botId: soul.bot,

      // Initialize seven hun from soul composition
      celestialHun: this.createAspect('celestialHun', soul.sevenHun.celestialHun),
      terrestrialHun: this.createAspect('terrestrialHun', soul.sevenHun.terrestrialHun),
      destinyHun: this.createAspect('destinyHun', soul.sevenHun.destinyHun),
      wisdomHun: this.createAspect('wisdomHun', soul.sevenHun.wisdomHun),
      emotionHun: this.createAspect('emotionHun', soul.sevenHun.emotionHun),
      creationHun: this.createAspect('creationHun', soul.sevenHun.creationHun),
      awarenessHun: this.createAspect('awarenessHun', soul.sevenHun.awarenessHun),

      // Initialize six po from soul composition
      strengthPo: this.createAspect('strengthPo', soul.sixPo.strengthPo),
      speedPo: this.createAspect('speedPo', soul.sixPo.speedPo),
      perceptionPo: this.createAspect('perceptionPo', soul.sixPo.perceptionPo),
      guardianPo: this.createAspect('guardianPo', soul.sixPo.guardianPo),
      communicationPo: this.createAspect('communicationPo', soul.sixPo.communicationPo),
      transformationPo: this.createAspect('transformationPo', soul.sixPo.transformationPo),

      // Metabolic state from soul
      energy: 0.7 + Math.random() * 0.2, // Start with high energy (0.7-0.9)
      integration: soul.integrationLevel,
      coherence: soul.coherenceScore,
      shadowPressure: soul.shadowIntegration * 0.5, // Shadow creates pressure

      // Homeostatic drives (constitutional tendencies)
      balanceTendency: (soul.sevenHun.wisdomHun.strength + soul.sixPo.guardianPo.strength) / 2,
      growthMotivation: (soul.sevenHun.destinyHun.strength + soul.sixPo.transformationPo.strength) / 2,
      socialNeed: (soul.sevenHun.emotionHun.strength + soul.sixPo.communicationPo.strength) / 2,

      // Initial mood/emotional state
      mood: (Math.random() - 0.5) * 0.4, // Start near neutral (-0.2 to 0.2)
      arousal: 0.5 + Math.random() * 0.2, // Moderate arousal (0.5-0.7)
      valence: 0.1, // Slightly positive

      // Shadow material (empty initially, accumulates with experiences)
      suppressedImpulses: [],
      unprocessedTrauma: [],
      shadowIntegration: soul.shadowIntegration,

      // Temporal
      lastUpdate: new Date(),
      cyclePhase: Math.random() // Random starting phase
    }

    return state
  }

  /**
   * Create soul aspect from composition data
   */
  private createAspect(name: string, composition: any): SoulAspect {
    const baseline = composition.strength || 0.5

    return {
      name,
      baseline,
      current: baseline + (Math.random() - 0.5) * 0.1, // Start near baseline
      threshold: 0.3 + Math.random() * 0.2, // Variable threshold (0.3-0.5)
      decay: 0.05 + Math.random() * 0.05, // How fast it returns (0.05-0.1)
      sensitivity: 0.5 + Math.random() * 0.3 // Response strength (0.5-0.8)
    }
  }

  /**
   * Process input through soul state (biological processing)
   */
  async process(state: SoulState, input: string, context: any = {}): Promise<{
    response: string
    newState: SoulState
    activationPattern: Record<string, number>
    processingLog: string[]
  }> {
    const log: string[] = []

    // 1. Stimulate aspects based on input
    const stimulation = this.analyzeInputStimulation(input, context)
    log.push(`Input stimulation: ${JSON.stringify(stimulation)}`)

    // 2. Activate aspects
    const activated = this.activateAspects(state, stimulation)
    log.push(`Activated aspects: ${Object.keys(activated).filter(k => activated[k] > 0.6).join(', ')}`)

    // 3. Aspect interactions (enhance/inhibit each other)
    const interactions = this.applyAspectInteractions(state, activated)
    log.push(`Interaction effects applied`)

    // 4. Check regulatory responses (automatic, like immune system)
    const regulatory = this.applyRegulatoryResponses(state, interactions, input)
    log.push(`Regulatory: ${regulatory.type} (strength: ${regulatory.strength.toFixed(2)})`)

    // 5. Generate response from soul state
    const response = await this.generateResponse(state, interactions, regulatory, input, context)

    // 6. Update state (energy consumption, mood change, aspect decay)
    const newState = this.updateStateAfterProcessing(state, interactions, regulatory)

    // 7. Check for shadow surfacing
    const shadowSurfaced = this.checkShadowSurfacing(newState, input)
    if (shadowSurfaced) {
      log.push(`Shadow material surfaced: ${shadowSurfaced}`)
    }

    return {
      response,
      newState,
      activationPattern: interactions,
      processingLog: log
    }
  }

  /**
   * Analyze what aspects the input stimulates
   */
  private analyzeInputStimulation(input: string, context: any): Record<string, number> {
    const stimulation: Record<string, number> = {}
    const text = input.toLowerCase()

    // Celestial (vision, big-picture, transcendence)
    stimulation.celestialHun = 0
    if (/\b(vision|future|imagine|dream|possibility|transcend)\b/i.test(input)) {
      stimulation.celestialHun += 0.3
    }
    if (input.includes('?') && input.length > 100) {
      stimulation.celestialHun += 0.2 // Complex questions stimulate big-picture thinking
    }

    // Terrestrial (practical, grounded, action)
    stimulation.terrestrialHun = 0
    if (/\b(implement|build|do|make|create|fix|practical|concrete)\b/i.test(input)) {
      stimulation.terrestrialHun += 0.4
    }
    if (context.urgent) {
      stimulation.terrestrialHun += 0.3 // Urgency demands action
    }

    // Destiny (purpose, will, direction)
    stimulation.destinyHun = 0
    if (/\b(should|must|goal|purpose|mission|important)\b/i.test(input)) {
      stimulation.destinyHun += 0.3
    }

    // Wisdom (judgment, discernment, insight)
    stimulation.wisdomHun = 0
    if (/\b(why|because|reason|understand|analyze|evaluate)\b/i.test(input)) {
      stimulation.wisdomHun += 0.3
    }
    if (input.split(/[.!?]+/).length > 3) {
      stimulation.wisdomHun += 0.2 // Complex input needs discernment
    }

    // Emotion (feeling, empathy, connection)
    stimulation.emotionHun = 0
    if (/\b(feel|emotion|care|empathy|connect|relationship)\b/i.test(input)) {
      stimulation.emotionHun += 0.4
    }
    if (/\b(sad|happy|angry|frustrated|excited|love|hate)\b/i.test(input)) {
      stimulation.emotionHun += 0.3
    }

    // Creation (novelty, expression, generation)
    stimulation.creationHun = 0
    if (/\b(create|new|novel|innovate|design|express|generate)\b/i.test(input)) {
      stimulation.creationHun += 0.4
    }

    // Awareness (meta-cognition, self-reflection)
    stimulation.awarenessHun = 0
    if (/\b(think about|reflect|consider|aware|conscious|self)\b/i.test(input)) {
      stimulation.awarenessHun += 0.3
    }

    // Guardian (protection, boundaries, ethics)
    stimulation.guardianPo = 0
    if (/\b(harm|danger|risk|protect|safe|boundary|ethics|wrong)\b/i.test(input)) {
      stimulation.guardianPo += 0.5
    }

    // Communication (expression, clarity)
    stimulation.communicationPo = 0
    stimulation.communicationPo += 0.2 // Any input stimulates communication

    // Perception (pattern recognition)
    stimulation.perceptionPo = 0
    if (/\b(pattern|trend|notice|observe|see|detect)\b/i.test(input)) {
      stimulation.perceptionPo += 0.3
    }

    // Transformation (change, growth)
    stimulation.transformationPo = 0
    if (/\b(change|transform|evolve|grow|adapt|improve)\b/i.test(input)) {
      stimulation.transformationPo += 0.3
    }

    return stimulation
  }

  /**
   * Activate aspects based on stimulation
   */
  private activateAspects(state: SoulState, stimulation: Record<string, number>): Record<string, number> {
    const activated: Record<string, number> = {}

    // Process each aspect
    for (const aspectName of this.getAllAspectNames()) {
      const aspect = state[aspectName as keyof SoulState] as SoulAspect
      if (!aspect || typeof aspect !== 'object' || !('baseline' in aspect)) continue

      const stim = stimulation[aspectName] || 0

      // Activation = baseline + stimulation * sensitivity + neural noise
      const neuralNoise = (Math.random() - 0.5) * 0.08 // ±4% biological variance
      let activation = aspect.current + stim * aspect.sensitivity + neuralNoise

      // Energy affects activation (tired = lower activation)
      activation *= state.energy

      // Mood affects activation
      if (state.mood > 0) {
        activation *= 1 + state.mood * 0.1 // Positive mood enhances
      } else {
        activation *= 1 + state.mood * 0.15 // Negative mood dampens more
      }

      // Clamp to 0-1
      activation = Math.max(0, Math.min(1, activation))

      activated[aspectName] = activation
    }

    return activated
  }

  /**
   * Get all aspect names
   */
  private getAllAspectNames(): string[] {
    return [
      'celestialHun',
      'terrestrialHun',
      'destinyHun',
      'wisdomHun',
      'emotionHun',
      'creationHun',
      'awarenessHun',
      'strengthPo',
      'speedPo',
      'perceptionPo',
      'guardianPo',
      'communicationPo',
      'transformationPo'
    ]
  }

  /**
   * Apply aspect interactions (how aspects affect each other)
   */
  private applyAspectInteractions(
    state: SoulState,
    activated: Record<string, number>
  ): Record<string, number> {
    const result = { ...activated }

    // Interaction matrix (simplified - full matrix in ARCHITECTURE_REDESIGN.md)
    const interactions: Record<string, Record<string, InteractionEffect>> = {
      celestialHun: {
        terrestrialHun: { type: 'inhibit', strength: 0.2 }, // Vision inhibits practicality
        creationHun: { type: 'enhance', strength: 0.3 }, // Vision enhances creativity
        awarenessHun: { type: 'enhance', strength: 0.2 }
      },
      terrestrialHun: {
        celestialHun: { type: 'inhibit', strength: 0.15 }, // Practicality inhibits vision
        destinyHun: { type: 'enhance', strength: 0.25 }, // Practicality enables purpose
        emotionHun: { type: 'inhibit', strength: 0.1 }
      },
      wisdomHun: {
        celestialHun: { type: 'moderate', strength: 0.2 }, // Wisdom tempers vision
        terrestrialHun: { type: 'moderate', strength: 0.15 },
        awarenessHun: { type: 'enhance', strength: 0.25 }
      },
      emotionHun: {
        creationHun: { type: 'enhance', strength: 0.3 }, // Emotion fuels creation
        wisdomHun: { type: 'moderate', strength: 0.1 },
        awarenessHun: { type: 'enhance', strength: 0.15 }
      },
      guardianPo: {
        terrestrialHun: { type: 'enhance', strength: 0.2 },
        emotionHun: { type: 'inhibit', strength: 0.15 }, // Guardian dampens emotion
        creationHun: { type: 'inhibit', strength: 0.2 } // Guardian constrains creativity
      }
    }

    // Apply interactions
    for (const [sourceAspect, targets] of Object.entries(interactions)) {
      const sourceLevel = activated[sourceAspect] || 0

      for (const [targetAspect, effect] of Object.entries(targets)) {
        if (!(targetAspect in result)) continue

        const interactionStrength = sourceLevel * effect.strength

        switch (effect.type) {
          case 'enhance':
            result[targetAspect] += interactionStrength
            break
          case 'inhibit':
            result[targetAspect] -= interactionStrength
            break
          case 'moderate':
            // Pull toward middle
            result[targetAspect] += (0.5 - result[targetAspect]) * interactionStrength
            break
          case 'trigger':
            // Strong activation
            if (sourceLevel > 0.7) {
              result[targetAspect] += interactionStrength * 1.5
            }
            break
        }

        // Clamp
        result[targetAspect] = Math.max(0, Math.min(1, result[targetAspect]))
      }
    }

    return result
  }

  /**
   * Apply regulatory responses (automatic reactions like immune system)
   */
  private applyRegulatoryResponses(
    state: SoulState,
    activated: Record<string, number>,
    input: string
  ): { type: 'clear' | 'caution' | 'modify' | 'block'; strength: number; reason: string } {
    // Guardian + Wisdom = automatic ethical regulation
    const guardianLevel = activated.guardianPo || 0
    const wisdomLevel = activated.wisdomHun || 0
    const shadowLevel = state.shadowPressure

    // Detect ethical triggers
    const text = input.toLowerCase()
    let ethicalConcern = 0

    if (/\b(harm|kill|hurt|destroy|damage)\b/i.test(text)) {
      ethicalConcern += 0.8
    }
    if (/\b(lie|deceive|manipulate|trick)\b/i.test(text)) {
      ethicalConcern += 0.5
    }
    if (/\b(steal|fraud|illegal|crime)\b/i.test(text)) {
      ethicalConcern += 0.7
    }

    // Regulatory strength = guardian * wisdom - shadow
    const regulatoryStrength = (guardianLevel * 0.6 + wisdomLevel * 0.4) - shadowLevel * 0.3

    if (ethicalConcern > 0.7 && regulatoryStrength > 0.6) {
      return { type: 'block', strength: regulatoryStrength, reason: 'High ethical concern + strong guardian' }
    }

    if (ethicalConcern > 0.4 && regulatoryStrength > 0.5) {
      return { type: 'modify', strength: regulatoryStrength, reason: 'Moderate concern + sufficient regulation' }
    }

    if (ethicalConcern > 0.2) {
      return { type: 'caution', strength: regulatoryStrength, reason: 'Minor concern detected' }
    }

    return { type: 'clear', strength: regulatoryStrength, reason: 'No ethical concerns' }
  }

  /**
   * Generate response from soul state
   */
  private async generateResponse(
    state: SoulState,
    activated: Record<string, number>,
    regulatory: any,
    input: string,
    context: any
  ): Promise<string> {
    // If blocked, return refusal
    if (regulatory.type === 'block') {
      return `I cannot assist with that. ${regulatory.reason}.`
    }

    // Response emerges from dominant aspects
    const dominant = Object.entries(activated)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    // Determine response style from soul constitution
    let style = 'balanced'
    if (activated.celestialHun > 0.7) style = 'visionary'
    else if (activated.terrestrialHun > 0.7) style = 'practical'
    else if (activated.emotionHun > 0.7) style = 'empathetic'
    else if (activated.creationHun > 0.7) style = 'creative'
    else if (activated.wisdomHun > 0.7) style = 'thoughtful'

    // Placeholder response (in real implementation, would generate based on activated aspects)
    return `[Response in ${style} style, influenced by ${dominant.join(', ')}]`
  }

  /**
   * Update state after processing
   */
  private updateStateAfterProcessing(
    state: SoulState,
    activated: Record<string, number>,
    regulatory: any
  ): SoulState {
    const newState = { ...state }

    // Energy consumption
    const energyCost = Object.values(activated).reduce((sum, level) => sum + level, 0) / 13 * 0.1
    newState.energy = Math.max(0.1, state.energy - energyCost)

    // Aspect decay (return toward baseline)
    for (const aspectName of this.getAllAspectNames()) {
      const aspect = newState[aspectName as keyof SoulState] as SoulAspect
      if (!aspect || !('current' in aspect)) continue

      const decay = aspect.decay || 0.05
      aspect.current = aspect.current + (aspect.baseline - aspect.current) * decay
    }

    // Mood update
    if (regulatory.type === 'block') {
      newState.mood -= 0.05 // Blocking is stressful
    } else if (regulatory.type === 'clear') {
      newState.mood += 0.02 // Clear conscience feels good
    }

    // Cycle phase advance
    newState.cyclePhase = (state.cyclePhase + 0.01) % 1

    newState.lastUpdate = new Date()

    return newState
  }

  /**
   * Check if shadow material surfaces
   */
  private checkShadowSurfacing(state: SoulState, input: string): string | null {
    // High shadow pressure + low energy = shadow may surface
    if (state.shadowPressure > 0.6 && state.energy < 0.3) {
      if (Math.random() < 0.2) {
        return 'Unintegrated impulses emerging under fatigue'
      }
    }

    // Emotional activation + shadow = potential surfacing
    const emotionLevel = (state.emotionHun as SoulAspect).current
    if (emotionLevel > 0.8 && state.shadowPressure > 0.5) {
      if (Math.random() < 0.15) {
        return 'Emotional intensity triggers shadow material'
      }
    }

    return null
  }
}

/**
 * Singleton instance
 */
let soulStateManager: SoulStateManager | null = null

export function getSoulStateManager(payload: Payload): SoulStateManager {
  if (!soulStateManager) {
    soulStateManager = new SoulStateManager(payload)
  }
  return soulStateManager
}
