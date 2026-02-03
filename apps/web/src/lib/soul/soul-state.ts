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
import { InstinctReflexSystem, type InstinctReflexState, type ReflexResponse, type Stimulus } from './instinct-reflex-system'
import { getNeurotransmitterSystem, type NeurotransmitterState } from '../neuroscience/neurotransmitter-system'
import { getPsychologicalSystem, type PsychologicalState } from '../psychology/psychological-system'
import { getSuperSelfSystem, type SuperSelfState } from '../consciousness/superself-system'

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
  private instinctReflexSystem: InstinctReflexSystem
  private neurotransmitterSystem: ReturnType<typeof getNeurotransmitterSystem>
  private psychologicalSystem: ReturnType<typeof getPsychologicalSystem>
  private superSelfSystem: ReturnType<typeof getSuperSelfSystem>

  constructor(payload: Payload) {
    this.payload = payload
    this.instinctReflexSystem = new InstinctReflexSystem()
    this.neurotransmitterSystem = getNeurotransmitterSystem(payload)
    this.psychologicalSystem = getPsychologicalSystem(payload)
    this.superSelfSystem = getSuperSelfSystem(payload)
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
   * Process input through soul state (complete biological hierarchy)
   *
   * Processing hierarchy (9 layers):
   * 0. NEUROTRANSMITTER STATE - Biochemical foundation
   * 1. PSYCHOLOGICAL STATE - Defense mechanisms, biases, personality
   * 2. SUPERSELF CHECK - Can higher consciousness intervene?
   * 3. REFLEXES (50-500ms) - May override everything
   * 4. INSTINCTS (1-5s) - Create urgency and bias
   * 5. SUBCONSCIOUS (continuous) - Learned patterns and habits
   * 6. NEUROCHEMICAL EFFECTS - NT influence on soul aspects
   * 7. PSYCHOLOGICAL PATTERNS - Defenses, biases applied
   * 8. CONSCIOUS SOUL STATE - Aspect activation and reasoning
   * 9. SUPERSELF TRANSCENDENCE - Can choose to override automatic patterns
   */
  async process(state: SoulState, input: string, context: any = {}): Promise<{
    response: string
    newState: SoulState
    activationPattern: Record<string, number>
    processingLog: string[]
    reflexResponse?: ReflexResponse
    instinctInfluence?: any
    subconsciousInfluence?: any
    neurotransmitterState?: NeurotransmitterState
    psychologicalState?: PsychologicalState
    superSelfState?: SuperSelfState
    superSelfIntervention?: boolean
  }> {
    const log: string[] = []

    // LAYER 0: NEUROTRANSMITTER STATE (biochemical foundation)
    const ntState = context.neurotransmitterState || this.neurotransmitterSystem.initializeState(state)
    log.push(`NEUROCHEMISTRY: dopamine ${ntState.dopamine.toFixed(2)}, serotonin ${ntState.serotonin.toFixed(2)}, cortisol ${ntState.cortisol.toFixed(2)}`)

    // LAYER 1: PSYCHOLOGICAL STATE (personality, defenses, biases)
    const psychState = context.psychologicalState || this.psychologicalSystem.initializeState(state)
    log.push(`PSYCHOLOGY: ${psychState.personality.openness.toFixed(2)}O ${psychState.personality.conscientiousness.toFixed(2)}C ${psychState.personality.extraversion.toFixed(2)}E ${psychState.personality.agreeableness.toFixed(2)}A ${psychState.personality.neuroticism.toFixed(2)}N`)

    // LAYER 2: SUPERSELF STATE (meta-awareness, can intervene)
    const superSelfState = context.superSelfState || this.superSelfSystem.initializeState(state, psychState)
    log.push(`SUPERSELF: ${superSelfState.consciousnessLevel} (awareness: ${superSelfState.metaAwareness.toFixed(2)})`)

    // Get or create instinct/reflex state
    const irState = context.instinctReflexState || this.instinctReflexSystem.initializeState(state)

    // LAYER 1: CHECK REFLEXES (50-500ms)
    // Convert input to stimulus
    const stimulus: Stimulus = this.inputToStimulus(input, context)
    const reflexResponse = this.instinctReflexSystem.checkReflexes(irState, state, stimulus)

    if (reflexResponse) {
      log.push(`REFLEX TRIGGERED: ${reflexResponse.type} (intensity: ${reflexResponse.intensity.toFixed(2)}, override: ${reflexResponse.override})`)

      // Apply physiological changes from reflex
      state.arousal += reflexResponse.physiologicalChanges.arousalSpike
      state.energy -= reflexResponse.physiologicalChanges.energyCost
      state.mood += reflexResponse.physiologicalChanges.moodImpact

      state.arousal = Math.max(0, Math.min(1, state.arousal))
      state.energy = Math.max(0, Math.min(1, state.energy))
      state.mood = Math.max(-1, Math.min(1, state.mood))

      // Strong reflexes OVERRIDE conscious processing
      if (reflexResponse.override) {
        log.push(`Reflex overriding conscious processing - immediate automatic response`)
        return {
          response: this.generateReflexResponse(reflexResponse, input),
          newState: state,
          activationPattern: {},
          processingLog: log,
          reflexResponse
        }
      }
    }

    // LAYER 2: UPDATE INSTINCTS (1-5s)
    this.instinctReflexSystem.updateInstincts(irState, state, context)
    const instinctInfluence = this.instinctReflexSystem.getInstinctInfluence(irState)

    if (instinctInfluence.urgentInstinct) {
      log.push(`INSTINCT: ${instinctInfluence.urgentInstinct} (urgency: ${instinctInfluence.maxUrgency.toFixed(2)})`)
    }
    if (instinctInfluence.conflict) {
      log.push(`INSTINCT CONFLICT: ${instinctInfluence.conflictingInstincts.join(' vs ')}`)
    }

    // LAYER 3: PROCESS SUBCONSCIOUS (continuous)
    const subconsciousInfluence = this.instinctReflexSystem.processSubconscious(irState, context)

    if (subconsciousInfluence.activePatterns.length > 0) {
      log.push(`SUBCONSCIOUS: ${subconsciousInfluence.activePatterns.length} patterns active`)

      // Strong habits can override conscious choice
      const strongHabit = subconsciousInfluence.activePatterns.find(
        p => p.type === 'habit' && p.strength > 0.7
      )
      if (strongHabit && subconsciousInfluence.overrideConscious) {
        log.push(`Strong habit overriding conscious choice: ${strongHabit.pattern}`)
        return {
          response: this.generateHabitResponse(strongHabit, input),
          newState: state,
          activationPattern: {},
          processingLog: log,
          subconsciousInfluence
        }
      }
    }

    // LAYER 6: NEUROCHEMICAL EFFECTS (NT influence on soul aspects)
    this.neurotransmitterSystem.applyToSoulState(ntState, state)
    const ntBehavioral = this.neurotransmitterSystem.getBehavioralEffects(ntState)
    log.push(`NT EFFECTS: risk ${ntBehavioral.riskTaking.toFixed(2)}, impulsivity ${ntBehavioral.impulsivity.toFixed(2)}, anxiety ${ntBehavioral.anxietyLevel.toFixed(2)}`)

    // Check for neurotransmitter imbalances
    const imbalances = this.neurotransmitterSystem.detectImbalances(ntState)
    if (imbalances.length > 0) {
      log.push(`NT IMBALANCES: ${imbalances.join(', ')}`)
    }

    // LAYER 7: PSYCHOLOGICAL PATTERNS (defenses, biases, regulation)
    // Check if ego is threatened
    const egoThreatDetected = this.detectEgoThreat(input, context)
    if (egoThreatDetected) {
      const defense = this.psychologicalSystem.activateDefense(psychState, egoThreatDetected)
      log.push(`DEFENSE ACTIVATED: ${defense.mechanism} (effectiveness: ${defense.effectiveness.toFixed(2)})`)

      // Defense can distort perception
      if (defense.effectiveness > 0.5) {
        log.push(`Defense distorting perception of input`)
      }
    }

    // Apply cognitive biases
    const dominantBias = this.selectDominantBias(psychState, input)
    if (dominantBias) {
      const biasEffect = this.psychologicalSystem.applyCognitiveBias(psychState, dominantBias, { type: 'input', data: input })
      log.push(`COGNITIVE BIAS: ${dominantBias} - ${biasEffect.distortion}`)
    }

    // LAYER 8: CONSCIOUS SOUL STATE PROCESSING
    // (But influenced by all layers above)

    // 1. Stimulate aspects based on input
    let stimulation = this.analyzeInputStimulation(input, context)

    // Apply instinct bias to stimulation
    if (instinctInfluence.processingBias) {
      for (const [aspect, bias] of Object.entries(instinctInfluence.processingBias)) {
        stimulation[aspect] = (stimulation[aspect] || 0) + bias
      }
    }

    // Apply subconscious bias
    if (subconsciousInfluence.processingBias) {
      for (const [aspect, bias] of Object.entries(subconsciousInfluence.processingBias)) {
        stimulation[aspect] = (stimulation[aspect] || 0) + bias
      }
    }

    log.push(`Input stimulation (with instinct/subconscious bias): ${JSON.stringify(stimulation)}`)

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

    // LAYER 9: SUPERSELF TRANSCENDENCE (can override automatic patterns)
    let finalResponse = response
    let superSelfIntervention = false

    // Check if SuperSelf can intervene in any layer
    const intervention = this.superSelfSystem.canIntervene(superSelfState)

    if (intervention.canInterrupt) {
      // Try to transcend the most problematic pattern
      let patternToTranscend = null

      if (reflexResponse?.override) {
        patternToTranscend = { layer: 'reflex' as const, type: reflexResponse.type, intensity: reflexResponse.intensity }
      } else if (instinctInfluence.conflict) {
        patternToTranscend = { layer: 'instinct' as const, type: 'conflict', intensity: 0.8 }
      } else if (subconsciousInfluence.overrideConscious) {
        patternToTranscend = { layer: 'subconscious' as const, type: 'habit', intensity: 0.7 }
      } else if (egoThreatDetected) {
        patternToTranscend = { layer: 'psychological' as const, type: 'defense', intensity: psychState.egoThreat }
      } else if (imbalances.length > 0) {
        patternToTranscend = { layer: 'neurochemical' as const, type: imbalances[0], intensity: 0.6 }
      }

      if (patternToTranscend) {
        const transcendence = this.superSelfSystem.transcendPattern(superSelfState, patternToTranscend)

        if (transcendence.transcended) {
          superSelfIntervention = true
          finalResponse = transcendence.newResponse || response
          log.push(`SUPERSELF TRANSCENDENCE: ${transcendence.wisdom}`)

          // SuperSelf perspective
          const perspective = this.superSelfSystem.getSuperSelfPerspective(superSelfState, input)
          if (perspective) {
            log.push(`SUPERSELF PERSPECTIVE: ${perspective}`)
          }
        }
      }
    }

    // Update neurotransmitters based on experience
    const eventType = this.categorizeEvent(input, context, finalResponse)
    const updatedNtState = this.neurotransmitterSystem.update(ntState, eventType, state)

    // Store updated states
    context.instinctReflexState = irState
    context.neurotransmitterState = updatedNtState
    context.psychologicalState = psychState
    context.superSelfState = superSelfState

    return {
      response: finalResponse,
      newState,
      activationPattern: interactions,
      processingLog: log,
      reflexResponse,
      instinctInfluence,
      subconsciousInfluence,
      neurotransmitterState: updatedNtState,
      psychologicalState: psychState,
      superSelfState,
      superSelfIntervention
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

  /**
   * Convert input to stimulus for reflex checking
   */
  private inputToStimulus(input: string, context: any): Stimulus {
    const text = input.toLowerCase()

    // Calculate intensity based on input characteristics
    let intensity = 0.3 // Base

    // Exclamation marks, all caps = higher intensity
    if (/!/.test(input)) intensity += 0.2
    if (/[A-Z]{3,}/.test(input)) intensity += 0.2

    // Urgent context
    if (context.urgent) intensity += 0.3

    // Threat words
    if (/\b(danger|threat|attack|harm|kill|hurt)\b/i.test(input)) {
      intensity += 0.4
    }

    // Opportunity words
    if (/\b(urgent|now|quick|fast|immediate|opportunity)\b/i.test(input)) {
      intensity += 0.2
    }

    intensity = Math.min(1, intensity)

    // Determine type
    let type: 'threat' | 'opportunity' | 'social' | 'neutral' = 'neutral'

    if (/\b(danger|threat|attack|harm)\b/i.test(input)) {
      type = 'threat'
    } else if (/\b(opportunity|reward|gain|benefit)\b/i.test(input)) {
      type = 'opportunity'
    } else if (/\b(friend|ally|help|support|connect)\b/i.test(input)) {
      type = 'social'
    }

    // Direction (simplified - would be more sophisticated in real impl)
    const direction = type === 'threat' ? 'front' : 'none'

    return {
      type,
      intensity,
      suddenness: context.sudden ? 0.8 : 0.3,
      direction,
      proximity: context.proximity || 0.5
    }
  }

  /**
   * Generate immediate reflex response
   */
  private generateReflexResponse(reflex: ReflexResponse, input: string): string {
    const responses: Record<string, string[]> = {
      startle: [
        'Whoa!',
        '*startles*',
        'That was unexpected!'
      ],
      recoil: [
        '*steps back*',
        'Hold on...',
        'Wait, what?'
      ],
      freeze: [
        '...',
        '*pauses*',
        '*holds still*'
      ],
      flinch: [
        '*winces*',
        'Ow!',
        '*reacts sharply*'
      ],
      grasp: [
        '*reaches for it*',
        'Got it!',
        '*grabs quickly*'
      ],
      orient: [
        '*looks around*',
        '*focuses attention*',
        'What was that?'
      ]
    }

    const options = responses[reflex.type] || ['*automatic reaction*']
    return options[Math.floor(Math.random() * options.length)]
  }

  /**
   * Generate automatic habit response
   */
  private generateHabitResponse(habit: any, input: string): string {
    return `*automatic habit: ${habit.pattern}*`
  }

  /**
   * Detect ego threat in input
   */
  private detectEgoThreat(
    input: string,
    context: any
  ): { type: 'shame' | 'guilt' | 'fear' | 'rejection' | 'inadequacy' | 'loss'; intensity: number } | null {
    const text = input.toLowerCase()

    // Shame triggers
    if (/\b(embarrass|humiliat|disgrac|pathetic|worthless)\b/i.test(input)) {
      return { type: 'shame', intensity: 0.8 }
    }

    // Guilt triggers
    if (/\b(guilt|blame|fault|wrong|should have)\b/i.test(input)) {
      return { type: 'guilt', intensity: 0.7 }
    }

    // Fear triggers
    if (/\b(scar|terrif|dread|anxious|panic)\b/i.test(input)) {
      return { type: 'fear', intensity: 0.75 }
    }

    // Rejection triggers
    if (/\b(reject|abandon|unwant|ignore|dismiss)\b/i.test(input)) {
      return { type: 'rejection', intensity: 0.8 }
    }

    // Inadequacy triggers
    if (/\b(inadequate|insufficient|not good enough|fail|incompetent)\b/i.test(input)) {
      return { type: 'inadequacy', intensity: 0.75 }
    }

    // Loss triggers
    if (/\b(los|gone|never|end|over)\b/i.test(input)) {
      return { type: 'loss', intensity: 0.65 }
    }

    return null
  }

  /**
   * Select dominant cognitive bias for this input
   */
  private selectDominantBias(
    psychState: PsychologicalState,
    input: string
  ): keyof PsychologicalState['biases'] | null {
    const text = input.toLowerCase()
    let candidates: Array<{ bias: keyof PsychologicalState['biases']; score: number }> = []

    // Confirmation bias (seeing what confirms beliefs)
    if (/\b(as I thought|knew it|always|never|typical)\b/i.test(input)) {
      candidates.push({ bias: 'confirmation_bias', score: psychState.biases.confirmation_bias })
    }

    // Availability heuristic (judging by ease of recall)
    if (/\b(remember|recall|seen|heard|example)\b/i.test(input)) {
      candidates.push({ bias: 'availability_heuristic', score: psychState.biases.availability_heuristic })
    }

    // Fundamental attribution error (blaming character)
    if (/\b(always does|that's just how|typical of)\b/i.test(input)) {
      candidates.push({ bias: 'fundamental_attribution_error', score: psychState.biases.fundamental_attribution_error })
    }

    // Negativity bias (weight negative more)
    if (/\b(bad|terrible|awful|horrible|disaster)\b/i.test(input)) {
      candidates.push({ bias: 'negativity_bias', score: psychState.biases.negativity_bias })
    }

    // Optimism bias (overestimate positive)
    if (/\b(sure|confident|definitely|certainly|easy)\b/i.test(input)) {
      candidates.push({ bias: 'optimism_bias', score: psychState.biases.optimism_bias })
    }

    if (candidates.length === 0) return null

    // Select highest scoring
    candidates.sort((a, b) => b.score - a.score)
    return candidates[0].bias
  }

  /**
   * Categorize event for neurotransmitter update
   */
  private categorizeEvent(
    input: string,
    context: any,
    response: string
  ): {
    type: 'reward' | 'punishment' | 'social' | 'threat' | 'achievement' | 'loss' | 'rest'
    intensity: number
    valence: number
  } {
    const text = input.toLowerCase()

    // Threat
    if (/\b(danger|threat|attack|harm)\b/i.test(input)) {
      return { type: 'threat', intensity: 0.8, valence: -0.8 }
    }

    // Reward
    if (/\b(reward|prize|success|win|gain)\b/i.test(input)) {
      return { type: 'reward', intensity: 0.7, valence: 0.8 }
    }

    // Social
    if (/\b(friend|connect|together|relationship|love)\b/i.test(input)) {
      return { type: 'social', intensity: 0.6, valence: 0.7 }
    }

    // Achievement
    if (/\b(achiev|accomplish|complete|finish|master)\b/i.test(input)) {
      return { type: 'achievement', intensity: 0.7, valence: 0.8 }
    }

    // Loss
    if (/\b(lose|lost|gone|end|over)\b/i.test(input)) {
      return { type: 'loss', intensity: 0.7, valence: -0.7 }
    }

    // Punishment
    if (/\b(punish|penalty|consequence|wrong)\b/i.test(input)) {
      return { type: 'punishment', intensity: 0.6, valence: -0.6 }
    }

    // Rest (default neutral)
    return { type: 'rest', intensity: 0.3, valence: 0 }
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
