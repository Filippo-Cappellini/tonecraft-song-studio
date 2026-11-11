import { afterEach, describe, expect, it, vi } from "vitest";
import { dayKey, lessonLogId, makeBackup, normalizeProgress, parseBackup, streak } from "@/lib/progress";

describe("progressi", () => {
  afterEach(() => vi.useRealTimers());

  it("scarta dati rovinati invece di rompersi", () => {
    expect(normalizeProgress(null)).toEqual({ favorites: [], learning: [], artists: [], lessons: [], log: {} });
    const p = normalizeProgress({
      favorites: ["a", 3, "a", null],
      lessons: "non è una lista",
      log: { "2026-11-01": [{ id: "g-spider", minutes: 10 }, { id: 5 }, { id: "x", minutes: -3 }], "domani": [{ id: "y", minutes: 5 }] },
    });
    expect(p.favorites).toEqual(["a"]);
    expect(p.lessons).toEqual([]);
    expect(p.log).toEqual({ "2026-11-01": [{ id: "g-spider", minutes: 10 }] });
  });

  it("conta la serie di giorni anche se oggi non hai ancora suonato", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 18));
    const day = (d: number) => dayKey(new Date(2026, 10, d));
    const e = [{ id: lessonLogId("cz-1"), minutes: 10 }];
    expect(streak(normalizeProgress({ log: { [day(4)]: e, [day(3)]: e, [day(1)]: e } }))).toBe(2);
    expect(streak(normalizeProgress({ log: { [day(3)]: e, [day(2)]: e } }))).toBe(2);
    expect(streak(normalizeProgress({ log: { [day(1)]: e } }))).toBe(0);
  });

  it("un backup esportato si reimporta uguale", () => {
    const progress = normalizeProgress({ favorites: ["zombie"], learning: ["zombie"], lessons: ["cz-1", "cz-2"], log: { "2026-11-03": [{ id: "g-chords", minutes: 15 }] } });
    const setup = { instrument: "chitarra", brand: "fender", model: "fender-strat" };
    const back = parseBackup(JSON.stringify(makeBackup(progress, setup)));
    expect(back).toEqual({ progress, setup });
  });

  it("rifiuta file che non sono backup", () => {
    expect(() => parseBackup("ciao")).toThrow(/non è un backup/);
    expect(() => parseBackup(JSON.stringify({ app: "altro", progress: {} }))).toThrow(/non è un backup/);
    expect(() => parseBackup(JSON.stringify({ app: "tono", version: 9, progress: {} }))).toThrow(/più recente/);
  });
});
