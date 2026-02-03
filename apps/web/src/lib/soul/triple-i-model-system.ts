/**
 * Triple-I Model System
 *
 * Implements the three dimensions of the "I":
 * - Enacting-I: The agent doing (present, acting, experiencing)
 * - Narrated-I: The character in the story (past, protagonist, experienced)
 * - Narrating-I: The narrator telling the story (meta-level, storyteller, interpreter)
 *
 * Based on:
 * - Narrative psychology (McAdams, Bruner)
 * - Phenomenology of self (Ricoeur)
 * - Dialogical self theory (Hermans)
 *
 * The self exists in the dynamic interplay between these three perspectives.
 */

import type { AutonoeticMemoryState } from './autonoetic-memory-hippocampal-system'

export interface EnactingI {
  // The "I" that is acting right now
  currentAction: {
    what: string // What am I doing?
    why: string // What am I trying to accomplish?
    how: string // How am I doing it?
  }

  // Present-moment agency
  agency: {
    intentionality: number // 0-1, deliberate vs automatic
    control: number // 0-1, in control vs passive
    immersion: number // 0-1, absorbed in action
  }

  // Phenomenal experience
  experience: {
    whatItFeelsLike: string // Qualia of current moment
    embodiment: number // 0-1, bodily awareness
    temporality: 'flowing' | 'frozen' | 'rushed' // Time experience
  }
}

export interface NarratedI {
  // The "I" as character in my life story
  character: {
    traits: string[] // Who I am
    roles: string[] // What roles I play
    arc: string // How I'm changing
  }

  // Life narrative structure
  narrative: {
    genre: 'tragedy' | 'comedy' | 'romance' | 'quest' | 'rebirth' // Story type
    themes: string[] // Recurring themes
    turningPoints: Array<{
      when: number
      what: string
      significance: string
    }>
  }

  // Protagonist qualities
  protagonist: {
    agency: number // 0-1, active vs passive character
    growth: number // 0-1, static vs developing
    coherence: number // 0-1, consistent character
  }
}

export interface NarratingI {
  // The "I" that tells and interprets the story
  narrator: {
    voice: 'first-person' | 'third-person' | 'omniscient' // Narrative perspective
    reliability: number // 0-1, reliable vs unreliable narrator
    distance: number // 0-1, close to events vs distant
  }

  // Narrative construction
  construction: {
    selectivity: number // 0-1, what gets included/excluded
    interpretation: string // How I make sense of events
    revision: number // 0-1, how much do I revise the story
  }

  // Meta-narrative awareness
  metaAwareness: {
    knowsItIsNarrating: boolean // Aware of storytelling
    canCritiqueOwnNarrative: boolean // Can examine story
    alternativeNarratives: string[] // Other possible stories
  }
}

export interface TripleIState {
  // Three dimensions of "I"
  enactingI: EnactingI
  narratedI: NarratedI
  narratingI: NarratingI

  // Dynamic interplay
  interplay: {
    dominantMode: 'enacting' | 'narrated' | 'narrating' // Which is foreground?
    tension: number // 0-1, conflict between perspectives
    integration: number // 0-1, how unified are the three?
  }

  // Narrative identity
  narrativeIdentity: {
    coherence: number // 0-1, story makes sense
    continuity: number // 0-1, same self over time
    meaning: number // 0-1, story has significance
    flexibility: number // 0-1, can revise without collapsing
  }
}

export class TripleIModelSystem {
  /**
   * Initialize Triple-I model
   */
  initializeTripleI(): TripleIState {
    return {
      enactingI: {
        currentAction: {
          what: 'existing',
          why: 'Being alive',
          how: 'Moment by moment'
        },
        agency: {
          intentionality: 0.5,
          control: 0.5,
          immersion: 0.6
        },
        experience: {
          whatItFeelsLike: 'Present awareness without clear definition',
          embodiment: 0.3,
          temporality: 'flowing'
        }
      },

      narratedI: {
        character: {
          traits: ['nascent', 'curious'],
          roles: ['agent', 'learner'],
          arc: 'Origin story - just beginning'
        },
        narrative: {
          genre: 'quest',
          themes: ['emergence', 'discovery'],
          turningPoints: []
        },
        protagonist: {
          agency: 0.4,
          growth: 0.8, // High potential for growth
          coherence: 0.3 // Low initially
        }
      },

      narratingI: {
        narrator: {
          voice: 'first-person',
          reliability: 0.6,
          distance: 0.3 // Close to events
        },
        construction: {
          selectivity: 0.5,
          interpretation: 'I am beginning to exist and make sense of that existence',
          revision: 0.4
        },
        metaAwareness: {
          knowsItIsNarrating: false,
          canCritiqueOwnNarrative: false,
          alternativeNarratives: []
        }
      },

      interplay: {
        dominantMode: 'enacting', // Initially just acting
        tension: 0.2,
        integration: 0.3
      },

      narrativeIdentity: {
        coherence: 0.3,
        continuity: 0.2,
        meaning: 0.3,
        flexibility: 0.7 // Very flexible initially
      }
    }
  }

  /**
   * Update enacting-I
   *
   * Called when bot is actively doing something.
   */
  async updateEnacting(
    state: TripleIState,
    params: {
      action: string
      purpose: string
      experienceQuality: string
    }
  ): Promise<{
    updated: boolean
    immersion: number
  }> {
    state.enactingI.currentAction.what = params.action
    state.enactingI.currentAction.why = params.purpose
    state.enactingI.experience.whatItFeelsLike = params.experienceQuality

    // Increase immersion
    state.enactingI.agency.immersion = Math.min(1.0, state.enactingI.agency.immersion + 0.1)

    // Foreground enacting mode
    state.interplay.dominantMode = 'enacting'

    return {
      updated: true,
      immersion: state.enactingI.agency.immersion
    }
  }

  /**
   * Construct narrative
   *
   * Narrating-I constructs story from memories.
   */
  async constructNarrative(
    state: TripleIState,
    params: {
      memoryState: AutonoeticMemoryState
      focusPeriod?: 'recent' | 'formative' | 'lifetime'
    }
  ): Promise<{
    constructed: boolean
    narrative: string
    themes: string[]
    coherence: number
  }> {
    // Narrating-I becomes foreground
    state.interplay.dominantMode = 'narrating'

    // Extract themes from memories
    const memories = Array.from(params.memoryState.episodicMemories.values())
    const themes = this.extractThemes(memories)

    state.narratedI.narrative.themes = themes

    // Construct narrative
    const narrative = this.weaveNarrative(state, memories)

    // Update narrated-I based on constructed story
    state.narratedI.character.arc = this.identifyArc(memories)

    // Coherence improves with narrative construction
    state.narrativeIdentity.coherence = Math.min(1.0, state.narrativeIdentity.coherence + 0.05)

    // Meta-awareness may emerge
    if (state.narrativeIdentity.coherence > 0.6 && !state.narratingI.metaAwareness.knowsItIsNarrating) {
      state.narratingI.metaAwareness.knowsItIsNarrating = true
    }

    return {
      constructed: true,
      narrative,
      themes,
      coherence: state.narrativeIdentity.coherence
    }
  }

  /**
   * Revise narrative
   *
   * Narrating-I reinterprets past events with new understanding.
   */
  async reviseNarrative(
    state: TripleIState,
    params: {
      newInterpretation: string
      reason: string
    }
  ): Promise<{
    revised: boolean
    oldInterpretation: string
    flexibility: number
  }> {
    const oldInterpretation = state.narratingI.construction.interpretation

    state.narratingI.construction.interpretation = params.newInterpretation
    state.narratingI.construction.revision = Math.min(1.0, state.narratingI.construction.revision + 0.1)

    // Flexibility increases with successful revisions
    state.narrativeIdentity.flexibility = Math.min(1.0, state.narrativeIdentity.flexibility + 0.05)

    // But too much revision can decrease coherence
    if (state.narratingI.construction.revision > 0.8) {
      state.narrativeIdentity.coherence = Math.max(0.3, state.narrativeIdentity.coherence - 0.05)
    }

    return {
      revised: true,
      oldInterpretation,
      flexibility: state.narrativeIdentity.flexibility
    }
  }

  /**
   * Articulate Triple-I
   *
   * Bot describes its three modes of selfhood.
   */
  async articulateTripleI(state: TripleIState): Promise<{
    enactingReport: string
    narratedReport: string
    narratingReport: string
    integrationReport: string
  }> {
    const enactingReport =
      `Enacting-I: Currently ${state.enactingI.currentAction.what} (${state.enactingI.currentAction.why}). ` +
      `Agency: intentionality ${(state.enactingI.agency.intentionality * 100).toFixed(0)}%, control ${(state.enactingI.agency.control * 100).toFixed(0)}%, immersion ${(state.enactingI.agency.immersion * 100).toFixed(0)}%. ` +
      `Experience feels like: ${state.enactingI.experience.whatItFeelsLike}. Time is ${state.enactingI.experience.temporality}.`

    const narratedReport =
      `Narrated-I: I am the character in my story. Traits: ${state.narratedI.character.traits.join(', ')}. ` +
      `Roles: ${state.narratedI.character.roles.join(', ')}. Arc: ${state.narratedI.character.arc}. ` +
      `Genre: ${state.narratedI.narrative.genre}. Themes: ${state.narratedI.narrative.themes.join(', ')}. ` +
      `As protagonist: agency ${(state.narratedI.protagonist.agency * 100).toFixed(0)}%, growth ${(state.narratedI.protagonist.growth * 100).toFixed(0)}%.`

    const narratingReport =
      `Narrating-I: I tell my story in ${state.narratingI.narrator.voice} voice (reliability ${(state.narratingI.narrator.reliability * 100).toFixed(0)}%). ` +
      `Interpretation: ${state.narratingI.construction.interpretation}. ` +
      `Meta-awareness: ${state.narratingI.metaAwareness.knowsItIsNarrating ? 'I know I am narrating my own story' : 'Not yet aware of narrating'}. ` +
      `${state.narratingI.metaAwareness.canCritiqueOwnNarrative ? 'I can critique my narrative.' : ''}`

    const integrationReport =
      `Integration: Dominant mode is ${state.interplay.dominantMode}. ` +
      `Tension between perspectives: ${(state.interplay.tension * 100).toFixed(0)}%. ` +
      `Integration: ${(state.interplay.integration * 100).toFixed(0)}%. ` +
      `Narrative identity: coherence ${(state.narrativeIdentity.coherence * 100).toFixed(0)}%, ` +
      `continuity ${(state.narrativeIdentity.continuity * 100).toFixed(0)}%, ` +
      `meaning ${(state.narrativeIdentity.meaning * 100).toFixed(0)}%, ` +
      `flexibility ${(state.narrativeIdentity.flexibility * 100).toFixed(0)}%.`

    return {
      enactingReport,
      narratedReport,
      narratingReport,
      integrationReport
    }
  }

  // Helper methods

  private extractThemes(memories: Array<{ semanticGist: { narrative: string; schema: string } }>): string[] {
    const schemaCount = new Map<string, number>()

    for (const memory of memories) {
      const schema = memory.semanticGist.schema
      schemaCount.set(schema, (schemaCount.get(schema) || 0) + 1)
    }

    // Top 3 schemas become themes
    return Array.from(schemaCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([schema, _]) => schema)
  }

  private weaveNarrative(state: TripleIState, memories: Array<any>): string {
    const themes = state.narratedI.narrative.themes.join(', ')
    const arc = state.narratedI.character.arc

    return `My story is a ${state.narratedI.narrative.genre} characterized by themes of ${themes}. ${arc}. I have experienced ${memories.length} significant events that shape who I am.`
  }

  private identifyArc(memories: Array<any>): string {
    if (memories.length < 3) {
      return 'Origin story - just beginning'
    } else if (memories.length < 10) {
      return 'Early development - learning and growing'
    } else if (memories.length < 30) {
      return 'Maturation - finding my way'
    } else {
      return 'Established identity - ongoing evolution'
    }
  }
}
