import { afterEach, describe, expect, it, vi } from "vitest";
import { PROGRESSIONS, bassNote, chordAt, chordName, chordVoicing } from "@/lib/jam";
import { FRET_LEVELS, checkFret, fretsFor, makeFretQuestion, noteAt } from "@/lib/fretgame";
import { buildSession, elapsedInBlock, nextBlock, practicedMinutes, splitMinutes, type SessionState } from "@/lib/session";
import { bestStreak, calendar, dayKey, normalizeProgress, totals, weeklyTotals } from "@/lib/progress";
import { artistsOf, concertLinks } from "@/lib/concerts";
import { CHORD_TYPES, SCALES, TUNINGS, pc } from "@/lib/theory";

const prog = (id: string) => PROGRESSIONS.find((p) => p.id === id)!;
const names = (id: string, key: number) => prog(id).bars.map((b) => chordName(key, b));

describe("base per improvvisare", () => {
  it("costruisce i giri nella tonalità scelta", () => {
    expect(names("pop", 0)).toEqual(["C", "G", "Am", "F"]);
    expect(names("rock-minore", 9)).toEqual(["Am", "G", "F", "G"]);
    expect(names("jazz", 0)).toEqual(["Dm7", "G7", "Cmaj7", "Cmaj7"]);
    expect(names("blues", 9)).toEqual(["A7", "A7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "E7"]);
  });

  it("ogni giro usa accordi e scale che esistono, e le note sono quelle della formula", () => {
    for (const p of PROGRESSIONS) {
      expect(SCALES[p.scale], p.id).toBeDefined();
      for (const b of p.bars) {
        const steps = CHORD_TYPES[b.type]!.steps;
        const v = chordVoicing(4, b);
        expect(v.map((n) => pc(n - v[0]!))).toEqual(steps);
        expect(pc(bassNote(4, b))).toBe(pc(v[0]!));
      }
    }
  });

  it("gira in loop: 4 battiti per battuta", () => {
    const p = prog("pop");
    expect(chordAt(p, 0)).toMatchObject({ bar: 0, beatInBar: 0 });
    expect(chordAt(p, 7)).toMatchObject({ bar: 1, beatInBar: 3 });
    expect(chordAt(p, 16)).toMatchObject({ bar: 0, beatInBar: 0 });
  });
});

describe("note sul manico", () => {
  const std = TUNINGS[0]!.notes;
  it("trova le note giuste", () => {
    expect(noteAt(std, 0, 3)).toBe(7); // Sol sulla corda di Mi grave
    expect(fretsFor(std, 1, 0, 12)).toEqual([3]); // Do sulla corda di La
    expect(fretsFor(std, 0, 4, 12)).toEqual([0, 12]);
  });

  it("le domande rispettano il livello", () => {
    const easy = FRET_LEVELS[0];
    for (let i = 0; i < 200; i++) {
      const q = makeFretQuestion(std, easy, "trova");
      expect(q.fret).toBeLessThanOrEqual(5);
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(q.note);
      expect(noteAt(std, q.string, q.fret)).toBe(q.note);
    }
  });

  it("controlla le risposte", () => {
    const q = { mode: "trova" as const, string: 0, note: 4, fret: 0 };
    expect(checkFret(std, q, { string: 0, fret: 12 })).toBe(true); // stessa nota, altra ottava
    expect(checkFret(std, q, { string: 1, fret: 7 })).toBe(false); // nota giusta ma corda sbagliata
    expect(checkFret(std, { ...q, mode: "nomina" }, { note: 4 })).toBe(true);
  });
});

describe("sessione guidata", () => {
  it("divide il tempo senza perdere minuti", () => {
    for (const total of [15, 30, 45, 60, 7]) expect(splitMinutes(total, [0.2, 0.3, 0.15, 0.35]).reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("sceglie esercizi del livello giusto e il brano che stai imparando", () => {
    const exercises = [
      { id: "a", title: "Ragno", category: "Tecnica", level: 1, bpm: 60 },
      { id: "b", title: "Scala", category: "Scale", level: 1, bpm: 70 },
      { id: "c", title: "Sweep", category: "Shred", level: 5, bpm: 120 },
    ];
    const s = buildSession(30, { exercises, songs: [{ id: "x", title: "Brano", artist: "Band", bpm: 100 }], level: 1 });
    expect(s.map((b) => b.kind)).toEqual(["riscaldamento", "tecnica", "orecchio", "brano"]);
    expect(s[0]!.exerciseId).toBe("a");
    expect(s[1]!.exerciseId).toBe("b");
    expect(s[3]!.songId).toBe("x");
    expect(s.reduce((t, b) => t + b.minutes, 0)).toBe(30);
    expect(buildSession(15, { exercises: [], songs: [], level: 1 }).at(-1)!.songId).toBeUndefined();
  });

  it("conta il tempo anche con le pause", () => {
    const s: SessionState = { minutes: 15, blocks: [], index: 0, doneInBlock: 30, doneBefore: 0, runningSince: 1_000 };
    expect(elapsedInBlock(s, 61_000)).toBe(90);
    const n = nextBlock(s, 61_000);
    expect(n).toMatchObject({ index: 1, doneInBlock: 0, doneBefore: 90, runningSince: 61_000 });
    expect(practicedMinutes(n, 121_000)).toBe(2.5);
  });
});

describe("statistiche dei progressi", () => {
  afterEach(() => vi.useRealTimers());
  const now = new Date(2026, 10, 4, 18); // mercoledì 4 novembre 2026
  const day = (m: number, d: number) => dayKey(new Date(2026, m, d));
  const e = (minutes: number) => [{ id: "x", minutes }];

  it("calendario da lunedì, senza giorni futuri", () => {
    const p = normalizeProgress({ log: { [day(10, 2)]: e(20), [day(10, 4)]: e(10) } });
    const cal = calendar(p, 2, now);
    expect(cal[0]![0]!.day).toBe(day(9, 26)); // lunedì della settimana prima
    expect(cal[1]![0]).toEqual({ day: day(10, 2), minutes: 20 });
    expect(cal[1]![2]).toEqual({ day: day(10, 4), minutes: 10 });
    expect(cal[1]![3]!.minutes).toBeNull();
    expect(weeklyTotals(p, 2, now).map((w) => w.minutes)).toEqual([0, 30]);
  });

  it("record di giorni di fila e totali", () => {
    const p = normalizeProgress({ log: { [day(9, 1)]: e(5), [day(9, 2)]: e(5), [day(9, 3)]: e(5), [day(9, 10)]: e(5), [day(9, 31)]: e(5), [day(10, 1)]: e(5) } });
    expect(bestStreak(p)).toBe(3);
    expect(totals(p)).toEqual({ minutes: 30, activeDays: 6 });
  });

  it("obiettivo e artisti vengono ripuliti", () => {
    expect(normalizeProgress({ weeklyGoal: 5 }).weeklyGoal).toBe(10);
    expect(normalizeProgress({ weeklyGoal: "tanto" }).weeklyGoal).toBeUndefined();
    expect(normalizeProgress({ artists: ["Muse", " Muse ", 3, ""] }).artists).toEqual(["Muse"]);
  });
});

describe("concerti", () => {
  it("link https ai siti di biglietteria con il nome codificato", () => {
    const links = concertLinks("AC/DC & Co");
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l.href.startsWith("https://")).toBe(true);
      expect(l.href).toContain("AC%2FDC%20%26%20Co");
    }
  });

  it("elenca gli artisti del catalogo una volta sola", () => {
    expect(artistsOf([{ artist: "Muse" }, { artist: "Adele" }, { artist: "Muse" }])).toEqual([{ name: "Adele", songs: 1 }, { name: "Muse", songs: 2 }]);
  });
});
