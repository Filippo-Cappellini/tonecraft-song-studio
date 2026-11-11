import { describe, expect, it } from "vitest";
import { CHORD_TYPES, GUITAR_CHORDS, NOTE_NAMES, chordMidis, parseKey, pc, tuningFor } from "@/lib/theory";

describe("teoria musicale", () => {
  it("ogni forma di accordo per chitarra contiene solo note della sua formula, compresa la fondamentale", () => {
    for (const c of GUITAR_CHORDS) {
      const formula = new Set(CHORD_TYPES[c.type]!.steps.map((s) => (c.root + s) % 12));
      const played = new Set(chordMidis(c).map(pc));
      for (const n of played) expect(formula, `${c.name}: ${NOTE_NAMES[n]} non è nell'accordo`).toContain(n);
      expect(played, `${c.name}: manca la fondamentale`).toContain(c.root);
      expect(c.frets).toHaveLength(6);
    }
  });

  it("la terza dell'accordo c'è sempre (maggiore o minore si sente)", () => {
    for (const c of GUITAR_CHORDS.filter((x) => ["maj", "min", "7", "maj7", "m7"].includes(x.type))) {
      const third = (c.root + CHORD_TYPES[c.type]!.steps[1]!) % 12;
      expect(chordMidis(c).map(pc), c.name).toContain(third);
    }
  });

  it("legge la tonalità scritta nei brani", () => {
    expect(parseKey("E minore")).toEqual({ root: 4, scale: "minore" });
    expect(parseKey("F# minore")).toEqual({ root: 6, scale: "minore" });
    expect(parseKey("Ab maggiore")).toEqual({ root: 8, scale: "maggiore" });
    expect(parseKey("Cb maggiore")).toEqual({ root: 11, scale: "maggiore" });
    expect(parseKey("—")).toBeNull();
  });

  it("sceglie l'accordatura giusta per chitarra e basso", () => {
    expect(tuningFor("Drop D (DADGBE)", "chitarra")).toBe("drop-d");
    expect(tuningFor("Mezzo tono sotto (Eb)", "basso")).toBe("bass-eb");
    expect(tuningFor("Standard (EADGBE)", "chitarra")).toBe("standard");
  });
});
