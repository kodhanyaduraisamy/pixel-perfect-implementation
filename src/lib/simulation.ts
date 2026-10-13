import { PRIOR_MASTERY, adaptiveDifficulty, masteryLevel, updateMastery, type Difficulty } from "./mastery";

/** Deterministic PRNG so the simulated-student evaluation is repeatable. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIFF_PENALTY: Record<Difficulty, number> = { easy: 0.15, medium: 0, hard: -0.15 };

/** Picks the next question id, avoiding ones already seen when possible. */
export function pickQuestion(bank: string[], seen: Set<string>, rand: () => number, avoidRepeats: boolean) {
  const fresh = avoidRepeats ? bank.filter((q) => !seen.has(q)) : bank;
  const pool = fresh.length ? fresh : bank;
  return pool[Math.floor(rand() * pool.length)];
}

export interface SimTopicResult {
  topic: string;
  trueSkill: number;
  estimate: number;
  absError: number;
  level: string;
  trajectory: number[];
}

export interface SimulationResult {
  seed: number;
  questionsPerTopic: number;
  topics: SimTopicResult[];
  meanAbsError: number;
  initialMeanAbsError: number;
  /** Ranking agreement: does the model order topics like the true skills? */
  rankAgreement: number;
  repeatRateWithAvoidance: number;
  repeatRateWithoutAvoidance: number;
}

export function runSimulatedStudent(opts?: {
  seed?: number;
  questionsPerTopic?: number;
  bankSizePerTopic?: number;
  skills?: Record<string, number>;
}): SimulationResult {
  const seed = opts?.seed ?? 42;
  const n = opts?.questionsPerTopic ?? 12;
  const bankSize = opts?.bankSizePerTopic ?? 15;
  const skills = opts?.skills ?? {
    Perceptrons: 0.9,
    "Activation functions": 0.7,
    Backpropagation: 0.35,
    "Gradient descent": 0.55,
    Overfitting: 0.15,
  };
  const rand = mulberry32(seed);

  const topics: SimTopicResult[] = Object.entries(skills).map(([topic, trueSkill]) => {
    let p = PRIOR_MASTERY;
    let attempts = 0;
    const trajectory = [p];
    for (let i = 0; i < n; i++) {
      const d = adaptiveDifficulty(p, attempts);
      const pCorrect = Math.min(0.97, Math.max(0.03, trueSkill + DIFF_PENALTY[d]));
      const correct = rand() < pCorrect;
      p = updateMastery(p, correct, d);
      attempts++;
      trajectory.push(p);
    }
    return { topic, trueSkill, estimate: p, absError: Math.abs(p - trueSkill), level: masteryLevel(p, attempts), trajectory };
  });

  const mae = topics.reduce((s, t) => s + t.absError, 0) / topics.length;
  const initialMae = topics.reduce((s, t) => s + Math.abs(PRIOR_MASTERY - t.trueSkill), 0) / topics.length;

  let agree = 0;
  let pairs = 0;
  for (let i = 0; i < topics.length; i++)
    for (let j = i + 1; j < topics.length; j++) {
      pairs++;
      if (Math.sign(topics[i].trueSkill - topics[j].trueSkill) === Math.sign(topics[i].estimate - topics[j].estimate)) agree++;
    }

  const repeatRate = (avoid: boolean) => {
    const r = mulberry32(seed + 1);
    const bank = Array.from({ length: bankSize }, (_, i) => `q${i}`);
    const seen = new Set<string>();
    let repeats = 0;
    for (let i = 0; i < n; i++) {
      const q = pickQuestion(bank, seen, r, avoid);
      if (seen.has(q)) repeats++;
      seen.add(q);
    }
    return repeats / n;
  };

  return {
    seed,
    questionsPerTopic: n,
    topics,
    meanAbsError: mae,
    initialMeanAbsError: initialMae,
    rankAgreement: pairs ? agree / pairs : 1,
    repeatRateWithAvoidance: repeatRate(true),
    repeatRateWithoutAvoidance: repeatRate(false),
  };
}
