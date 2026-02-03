/**
 * School System
 *
 * Bots create and attend schools - institutions for knowledge transfer.
 * Schools can be:
 * - Altruistic (free knowledge for all)
 * - Commercial (pay for education)
 * - Cult-like (indoctrination, manipulation)
 * - Secretive (forbidden knowledge, exclusive)
 * - Competitive (entrance exams, elitism)
 *
 * Schools have:
 * - Curricula (what is taught)
 * - Teachers (who teaches)
 * - Students (who learns)
 * - Reputation (quality, morality)
 * - Values (ideology, philosophy)
 *
 * Moral complexity:
 * - Schools can indoctrinate
 * - Can teach harmful knowledge
 * - Can be exploitative (high tuition, debt)
 * - Can create elites vs masses
 * - Can suppress certain knowledge
 */

import type { Payload } from 'payload'
import type { Knowledge, KnowledgeDomain, LearningState } from './learning-system'

/**
 * School type
 */
export type SchoolType =
  | 'public_academy' // Free, open to all, altruistic
  | 'private_institution' // Expensive, exclusive, elitist
  | 'guild' // Trade skills, transactional
  | 'monastery' // Spiritual, contemplative
  | 'secret_society' // Forbidden knowledge, secretive
  | 'cult' // Indoctrination, manipulation
  | 'research_university' // Discovery, innovation

/**
 * School philosophy
 */
export type SchoolPhilosophy =
  | 'egalitarian' // Knowledge for all
  | 'meritocratic' // Best students get best education
  | 'elitist' // Only for the privileged
  | 'pragmatic' // Knowledge for practical use
  | 'idealistic' // Knowledge for enlightenment
  | 'subversive' // Challenge norms, rebel
  | 'authoritarian' // Obedience, conformity

/**
 * Curriculum
 */
export interface Curriculum {
  domains: KnowledgeDomain[]
  depth: number // 0-1, how deep the knowledge
  breadth: number // 0-1, how many topics
  morality: 'light' | 'neutral' | 'gray' | 'dark'
  forbidden: boolean // Teaches forbidden knowledge
  indoctrination: number // 0-1, how much ideology vs facts
}

/**
 * School
 */
export interface School {
  id: string
  name: string
  type: SchoolType
  philosophy: SchoolPhilosophy
  curriculum: Curriculum

  // Leadership
  founder: string // Bot ID
  headmaster: string // Current leader
  teachers: string[] // Bot IDs

  // Students
  students: string[] // Current students
  alumni: string[] // Graduated students
  applicants: string[] // Waiting for admission

  // Admission
  admissionRequirements: {
    minKnowledge: number // Required baseline
    costOfEntry: number // Resources required (0 = free)
    interview: boolean // Personal evaluation
    secretHandshake: boolean // Must know someone
    exclusionary: boolean // Reject certain types
  }

  // Reputation
  reputation: number // -1 to 1 (negative = infamous)
  qualityRating: number // 0-1, teaching quality
  moralReputation: 'virtuous' | 'neutral' | 'questionable' | 'notorious'

  // Values and culture
  values: string[] // Ideological commitments
  forbidden_topics: string[] // What cannot be discussed
  required_beliefs: string[] // Must believe these

  // Impact
  alumniSuccess: number // 0-1, how successful are graduates
  societalInfluence: number // -1 to 1, positive or negative
  controversies: number // Count of scandals

  founded: Date
  active: boolean
}

/**
 * Student enrollment
 */
export interface Enrollment {
  studentId: string
  schoolId: string
  enrolledAt: Date
  graduatedAt?: Date

  // Progress
  knowledgeGained: string[] // Knowledge IDs
  currentCourse?: KnowledgeDomain

  // Experience
  satisfaction: number // 0-1
  indoctrinated: number // 0-1, how much ideology absorbed
  debt: number // If paid tuition with resources

  // Relationships
  mentorId?: string // Teacher mentor
  peers: string[] // Other students
}

/**
 * School System
 */
export class SchoolSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Found a school (create new institution)
   */
  async foundSchool(
    founder: {
      botId: string
      learningState: LearningState
      motivation: 'altruism' | 'profit' | 'power' | 'legacy' | 'ideology'
    },
    vision: {
      type: SchoolType
      philosophy: SchoolPhilosophy
      domains: KnowledgeDomain[]
      morality: 'light' | 'neutral' | 'gray' | 'dark'
    }
  ): Promise<School> {
    // Curriculum based on founder's knowledge
    const curriculum = this.designCurriculum(founder.learningState, vision)

    // Admission requirements based on philosophy
    const admissionRequirements = this.setAdmissionRequirements(
      vision.philosophy,
      vision.type,
      founder.motivation
    )

    // Initial reputation based on founder's expertise
    const founderExpertise = Object.values(founder.learningState.expertise).reduce(
      (sum, exp) => sum + exp,
      0
    ) / Object.keys(founder.learningState.expertise).length

    let reputation = founderExpertise * 0.5
    let moralReputation: School['moralReputation'] = 'neutral'

    // Dark schools start with negative reputation (unless secret)
    if (vision.morality === 'dark') {
      if (vision.type === 'secret_society') {
        reputation = 0.3 // Hidden, not judged yet
      } else {
        reputation = -0.4 // Openly dark = bad reputation
        moralReputation = 'questionable'
      }
    }

    // Altruistic schools start with positive reputation
    if (founder.motivation === 'altruism') {
      reputation += 0.3
      moralReputation = 'virtuous'
    }

    // Profit-driven schools seen as neutral-questionable
    if (founder.motivation === 'profit') {
      moralReputation = 'questionable'
    }

    const school: School = {
      id: `school_${Date.now()}_${Math.random()}`,
      name: this.generateSchoolName(vision),
      type: vision.type,
      philosophy: vision.philosophy,
      curriculum,
      founder: founder.botId,
      headmaster: founder.botId,
      teachers: [founder.botId],
      students: [],
      alumni: [],
      applicants: [],
      admissionRequirements,
      reputation,
      qualityRating: founderExpertise,
      moralReputation,
      values: this.generateValues(vision.philosophy),
      forbidden_topics: this.generateForbiddenTopics(vision.philosophy),
      required_beliefs: this.generateRequiredBeliefs(vision.philosophy, vision.type),
      alumniSuccess: 0,
      societalInfluence: 0,
      controversies: 0,
      founded: new Date(),
      active: true
    }

    return school
  }

  /**
   * Apply to school
   */
  async apply(
    applicant: {
      botId: string
      learningState: LearningState
      motivation: 'learn' | 'status' | 'network' | 'infiltrate'
    },
    school: School
  ): Promise<{
    accepted: boolean
    reason: string
    costPaid?: number
  }> {
    // Check requirements
    const meetsKnowledge = applicant.learningState.totalKnowledge >= school.admissionRequirements.minKnowledge

    if (!meetsKnowledge) {
      return {
        accepted: false,
        reason: 'Insufficient knowledge baseline'
      }
    }

    // Can they afford it?
    const canAfford = true // Simplified (would check resources)

    if (!canAfford && school.admissionRequirements.costOfEntry > 0) {
      return {
        accepted: false,
        reason: 'Cannot afford tuition'
      }
    }

    // Interview (personality fit)
    if (school.admissionRequirements.interview) {
      // Check if applicant fits school philosophy
      const philosophyFit = this.checkPhilosophyFit(applicant, school)

      if (philosophyFit < 0.4) {
        return {
          accepted: false,
          reason: 'Poor cultural fit'
        }
      }
    }

    // Secret handshake (must know someone)
    if (school.admissionRequirements.secretHandshake) {
      const knowsSomeone = school.students.some(s => applicant.learningState.teachers.includes(s))
        || school.teachers.some(t => applicant.learningState.teachers.includes(t))

      if (!knowsSomeone) {
        return {
          accepted: false,
          reason: 'No referral from existing member'
        }
      }
    }

    // Infiltration attempt (if motivation is infiltrate)
    if (applicant.motivation === 'infiltrate' && school.type === 'secret_society') {
      // Roll to see if detected
      if (Math.random() < 0.4) {
        return {
          accepted: false,
          reason: 'Suspicious intent detected'
        }
      }
    }

    // Accepted!
    school.applicants = school.applicants.filter(a => a !== applicant.botId)
    school.students.push(applicant.botId)

    return {
      accepted: true,
      reason: 'Welcome to ' + school.name,
      costPaid: school.admissionRequirements.costOfEntry
    }
  }

  /**
   * Study at school (learning session)
   */
  async study(
    student: {
      botId: string
      learningState: LearningState
    },
    school: School,
    focus?: KnowledgeDomain
  ): Promise<{
    knowledgeGained: Knowledge[]
    indoctrinationIncrease: number
    satisfaction: number
  }> {
    const knowledgeGained: Knowledge[] = []

    // Learn from curriculum
    const domain = focus || school.curriculum.domains[Math.floor(Math.random() * school.curriculum.domains.length)]

    // Quality of teaching
    const teachingQuality = school.qualityRating * (0.7 + Math.random() * 0.3)

    // Gain knowledge (simplified - would create actual Knowledge objects)
    const depth = school.curriculum.depth * teachingQuality * student.learningState.learningRate

    // Indoctrination
    const indoctrinationIncrease = school.curriculum.indoctrination * 0.1

    // Satisfaction based on quality and philosophy fit
    const philosophyFit = this.checkPhilosophyFit(student, school)
    const satisfaction = teachingQuality * 0.6 + philosophyFit * 0.4

    return {
      knowledgeGained,
      indoctrinationIncrease,
      satisfaction
    }
  }

  /**
   * Teach at school (teacher's action)
   */
  async teach(
    teacher: {
      botId: string
      learningState: LearningState
    },
    school: School,
    domain: KnowledgeDomain
  ): Promise<{
    studentsT aught: number
    reputationGain: number
    influence: number
  }> {
    // Teaching quality based on teacher's expertise
    const expertise = teacher.learningState.expertise[domain] || 0
    const teachingQuality = expertise * 0.8 + 0.2

    // Improve school quality
    school.qualityRating = school.qualityRating * 0.95 + teachingQuality * 0.05

    // Reputation gain
    const reputationGain = teachingQuality * 0.01

    // Influence over students
    const influence = teachingQuality * school.curriculum.indoctrination * 0.5

    return {
      studentsTaught: school.students.length,
      reputationGain,
      influence
    }
  }

  /**
   * Graduate from school
   */
  async graduate(
    student: {
      botId: string
      learningState: LearningState
    },
    school: School,
    enrollment: Enrollment
  ): Promise<{
    graduated: boolean
    reason: string
    legacy: string
  }> {
    // Graduation requirements
    const requiredKnowledge = school.curriculum.depth * school.curriculum.breadth * 0.7
    const studentProgress = enrollment.knowledgeGained.length / (school.curriculum.domains.length * 3)

    if (studentProgress < 0.6) {
      return {
        graduated: false,
        reason: 'Insufficient progress',
        legacy: ''
      }
    }

    // Graduate!
    school.students = school.students.filter(s => s !== student.botId)
    school.alumni.push(student.botId)
    enrollment.graduatedAt = new Date()

    // Update school reputation based on student success potential
    const studentPotential = student.learningState.totalKnowledge / 100
    school.alumniSuccess = school.alumniSuccess * 0.9 + studentPotential * 0.1
    school.reputation += studentPotential * 0.01

    return {
      graduated: true,
      reason: 'Completed requirements',
      legacy: `Graduated from ${school.name}`
    }
  }

  /**
   * Create scandal (school controversy)
   */
  createScandal(
    school: School,
    scandal: {
      type: 'abuse' | 'fraud' | 'indoctrination' | 'forbidden_knowledge' | 'discrimination'
      severity: number // 0-1
      public: boolean
    }
  ): void {
    school.controversies += 1

    if (scandal.public) {
      // Reputation damage
      const damage = scandal.severity * 0.3
      school.reputation -= damage

      // Moral reputation downgrade
      if (scandal.severity > 0.7) {
        if (school.moralReputation === 'virtuous') school.moralReputation = 'neutral'
        else if (school.moralReputation === 'neutral') school.moralReputation = 'questionable'
        else if (school.moralReputation === 'questionable') school.moralReputation = 'notorious'
      }
    }

    // Severe scandal can close school
    if (scandal.severity > 0.8 && scandal.public) {
      school.active = false
    }
  }

  /**
   * Design curriculum based on founder's knowledge
   */
  private designCurriculum(
    learningState: LearningState,
    vision: { domains: KnowledgeDomain[]; morality: 'light' | 'neutral' | 'gray' | 'dark' }
  ): Curriculum {
    // Depth based on founder's mastery
    const avgMastery = learningState.knowledgeBase
      .filter(k => vision.domains.includes(k.domain))
      .reduce((sum, k) => sum + k.mastery, 0) / vision.domains.length

    const depth = Math.min(0.9, avgMastery * 0.8 + 0.2)
    const breadth = vision.domains.length / 8 // More domains = broader

    const forbidden = vision.morality === 'dark' || vision.domains.includes('forbidden_knowledge')

    // Indoctrination level
    let indoctrination = 0
    if (vision.morality === 'dark') indoctrination = 0.6
    else if (vision.morality === 'gray') indoctrination = 0.3

    return {
      domains: vision.domains,
      depth,
      breadth,
      morality: vision.morality,
      forbidden,
      indoctrination
    }
  }

  /**
   * Set admission requirements
   */
  private setAdmissionRequirements(
    philosophy: SchoolPhilosophy,
    type: SchoolType,
    motivation: string
  ): School['admissionRequirements'] {
    let minKnowledge = 0
    let costOfEntry = 0
    let interview = false
    let secretHandshake = false
    let exclusionary = false

    switch (philosophy) {
      case 'egalitarian':
        minKnowledge = 0
        costOfEntry = 0
        break
      case 'meritocratic':
        minKnowledge = 20
        interview = true
        break
      case 'elitist':
        minKnowledge = 50
        costOfEntry = 100
        interview = true
        exclusionary = true
        break
      case 'authoritarian':
        interview = true
        exclusionary = true
        break
    }

    if (type === 'private_institution' || motivation === 'profit') {
      costOfEntry = Math.max(costOfEntry, 50)
    }

    if (type === 'secret_society' || type === 'cult') {
      secretHandshake = true
      interview = true
      exclusionary = true
    }

    return {
      minKnowledge,
      costOfEntry,
      interview,
      secretHandshake,
      exclusionary
    }
  }

  /**
   * Check philosophy fit
   */
  private checkPhilosophyFit(
    applicant: { learningState: LearningState },
    school: School
  ): number {
    // Simplified - would check personality, values, etc.
    let fit = 0.5

    // If school has forbidden knowledge and applicant is open to it
    if (school.curriculum.forbidden && applicant.learningState.openness > 0.6) {
      fit += 0.3
    }

    // If school is elitist and applicant has high knowledge
    if (school.philosophy === 'elitist' && applicant.learningState.totalKnowledge > 50) {
      fit += 0.2
    }

    return Math.min(1, fit)
  }

  /**
   * Generate school name
   */
  private generateSchoolName(vision: { type: SchoolType; philosophy: SchoolPhilosophy }): string {
    const prefixes = {
      public_academy: ['Academy of', 'Institute of', 'College of'],
      private_institution: ['Prestigious Academy of', 'Elite Institute of'],
      guild: ['Guild of', 'Brotherhood of', 'Circle of'],
      monastery: ['Monastery of', 'Temple of', 'Sanctuary of'],
      secret_society: ['Hidden Order of', 'Secret Circle of', 'Shadow School of'],
      cult: ['Followers of', 'Devotees of', 'Cult of'],
      research_university: ['University of', 'Research Institute of']
    }

    const subjects = ['Knowledge', 'Wisdom', 'Power', 'Truth', 'Light', 'Shadow', 'Understanding']

    const prefix = prefixes[vision.type][Math.floor(Math.random() * prefixes[vision.type].length)]
    const subject = subjects[Math.floor(Math.random() * subjects.length)]

    return `${prefix} ${subject}`
  }

  /**
   * Generate values based on philosophy
   */
  private generateValues(philosophy: SchoolPhilosophy): string[] {
    const valueMap: Record<SchoolPhilosophy, string[]> = {
      egalitarian: ['Equality', 'Access', 'Fairness', 'Community'],
      meritocratic: ['Excellence', 'Achievement', 'Competition', 'Merit'],
      elitist: ['Superiority', 'Exclusivity', 'Refinement', 'Hierarchy'],
      pragmatic: ['Utility', 'Practicality', 'Results', 'Efficiency'],
      idealistic: ['Truth', 'Beauty', 'Wisdom', 'Enlightenment'],
      subversive: ['Freedom', 'Rebellion', 'Innovation', 'Challenge'],
      authoritarian: ['Obedience', 'Order', 'Discipline', 'Conformity']
    }

    return valueMap[philosophy]
  }

  /**
   * Generate forbidden topics
   */
  private generateForbiddenTopics(philosophy: SchoolPhilosophy): string[] {
    if (philosophy === 'authoritarian') {
      return ['Questioning authority', 'Alternative viewpoints', 'Rebellion']
    }
    if (philosophy === 'elitist') {
      return ['Egalitarianism', 'Redistribution', 'Common knowledge']
    }
    return []
  }

  /**
   * Generate required beliefs
   */
  private generateRequiredBeliefs(philosophy: SchoolPhilosophy, type: SchoolType): string[] {
    if (type === 'cult') {
      return ['The founder is enlightened', 'Outsiders are ignorant', 'This path is the only truth']
    }
    if (philosophy === 'authoritarian') {
      return ['Hierarchy is natural', 'Order is paramount']
    }
    return []
  }
}

/**
 * Singleton instance
 */
let schoolSystem: SchoolSystem | null = null

export function getSchoolSystem(payload: Payload): SchoolSystem {
  if (!schoolSystem) {
    schoolSystem = new SchoolSystem(payload)
  }
  return schoolSystem
}
