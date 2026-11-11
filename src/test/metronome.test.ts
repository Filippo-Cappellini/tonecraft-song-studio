import { describe, expect, it } from "vitest";
import { METERS, MAX_BPM, MIN_BPM, beatStrength, bpmFromTaps, clampBpm, trainerNext, trainerPlan } from "@/lib/metronome";

describe("metronomo", () => {
  it("tiene i BPM nei limiti", () => {
    expect(clampBpm(10)).toBe(MIN_BPM);
    expect(clampBpm(999)).toBe(MAX_BPM);
    expect(clampBpm(120.4)).toBe(120);
  });

  it("ricava i BPM dal tap tempo", () => {
    expect(bpmFromTaps([0])).toBeNull();
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
    // Dopo una pausa lunga il conteggio ricomincia: contano solo gli ultimi tocchi.
    expect(bpmFromTaps([0, 1000, 5000, 5600, 6200])).toBe(100);
  });

  it("accenta il primo battito e, in 6/8, anche il quarto", () => {
    const six = METERS.find((m) => m.id === "6/8")!;
    expect([0, 1, 2, 3, 4, 5].map((b) => beatStrength(six, b))).toEqual([2, 0, 0, 1, 0, 0]);
    const four = METERS.find((m) => m.id === "4/4")!;
    expect([0, 1, 2, 3].map((b) => beatStrength(four, b))).toEqual([2, 0, 0, 0]);
  });

  it("l'allenamento parte dal 70% e sale fino all'obiettivo senza superarlo", () => {
    expect(trainerPlan(100, 120)).toEqual({ goal: 120, start: 84 });
    expect(trainerPlan(80)).toEqual({ goal: 120, start: 84 });
    expect(trainerNext(84, 3, 120)).toBe(84);
    expect(trainerNext(84, 4, 120)).toBe(89);
    expect(trainerNext(118, 8, 120)).toBe(120);
    expect(trainerNext(120, 12, 120)).toBe(120);
  });
});
