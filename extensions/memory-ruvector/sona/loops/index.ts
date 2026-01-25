/**
 * SONA Adaptive Loops - P2 ruvLLM Features
 *
 * Provides background and instant learning loops for continuous
 * memory system adaptation.
 */

export { BackgroundLoop } from "./background.js";
export type {
  Trajectory,
  PatternCluster,
  LearningCycleStats,
} from "./background.js";

export { InstantLoop } from "./instant.js";
export type {
  ImmediateFeedback,
  PatternBoost,
  InstantLearningStats,
} from "./instant.js";
