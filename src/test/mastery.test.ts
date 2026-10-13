import { describe, expect, it } from "vitest";
import { adaptiveDifficulty, masteryLevel, updateMastery } from "@/lib/mastery";
import { runSimulatedStudent } from "@/lib/simulation";

describe("mastery model", () => {
  it("raises mastery after a correct answer and lowers it after a wrong one", () => {
    expect(updateMastery(0.3, true, "medium")).toBeGreaterThan(0.3);
    expect(updateMastery(0.6, false, "medium")).toBeLessThan(0.6);
  });

  it("rewards a correct hard answer more than a correct easy answer", () => {
    expect(updateMastery(0.3, true, "hard")).toBeGreaterThan(updateMastery(0.3, true, "easy"));
  });

  it("penalises a wrong easy answer more than a wrong hard answer", () => {
    expect(updateMastery(0.6, false, "easy")).toBeLessThan(updateMastery(0.6, false, "hard"));
  });

  it("starts new learners as unassessed", () => {
    expect(masteryLevel(0.3, 0)).toBe("unassessed");
    expect(adaptiveDifficulty(0.3, 0)).toBe("easy");
  });
});

describe("simulated student", () => {
  it("is repeatable for the same seed", () => {
    expect(runSimulatedStudent({ seed: 7 }).meanAbsError).toBe(runSimulatedStudent({ seed: 7 }).meanAbsError);
  });

  it("never repeats a question while unseen ones remain", () => {
    const r = runSimulatedStudent({ questionsPerTopic: 10, bankSizePerTopic: 15 });
    expect(r.repeatRateWithAvoidance).toBe(0);
  });
});
