/**
 * Explainable Bayesian Knowledge Tracing (BKT) mastery model.
 *
 * Each topic holds P(mastered). After an answer we apply Bayes' rule using a
 * guess probability (lucky correct answer when not mastered) and a slip
 * probability (careless mistake when mastered), then a small learning
 * transition. Harder questions are harder to guess and easier to slip on, so a
 * correct hard answer raises mastery more and a wrong hard answer costs less.
 */
export type Difficulty = "easy" | "medium" | "hard";

export const BKT_PARAMS: Record<Difficulty, { guess: number; slip: number }> = {
  easy: { guess: 0.3, slip: 0.05 },
  medium: { guess: 0.2, slip: 0.1 },
  hard: { guess: 0.12, slip: 0.15 },
};
export const PRIOR_MASTERY = 0.3;
export const LEARN_RATE = 0.1;

const clamp = (v: number) => Math.min(0.99, Math.max(0.01, v));

export function updateMastery(p: number, correct: boolean, difficulty: Difficulty): number {
  const { guess, slip } = BKT_PARAMS[difficulty];
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  return clamp(posterior + (1 - posterior) * LEARN_RATE);
}

export type MasteryLevel = "unassessed" | "needs-work" | "developing" | "mastered";

export function masteryLevel(p: number, attempts: number): MasteryLevel {
  if (attempts === 0) return "unassessed";
  if (p < 0.4) return "needs-work";
  if (p < 0.75) return "developing";
  return "mastered";
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  unassessed: "Not assessed",
  "needs-work": "Needs revision",
  developing: "Developing",
  mastered: "Mastered",
};

/** Adaptive difficulty: pick the band just above the learner's current estimate. */
export function adaptiveDifficulty(p: number, attempts: number): Difficulty {
  if (attempts === 0 || p < 0.4) return "easy";
  if (p < 0.75) return "medium";
  return "hard";
}
