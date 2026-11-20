import { describe, expect, it } from "vitest";
import {
  fmt,
  mergeDrinks,
  metrics,
  promilleFor,
  rankDeltas,
  relativeScore,
  sanitizeProfile,
  sanitizeRaw,
  sortDrinks,
  type RawDrink,
} from "../src/lib/drinks.ts";

const raw = (over: Partial<RawDrink>): RawDrink => ({
  name: "Jupiler",
  category: "bier",
  serving: "25cl",
  priceEur: 2.8,
  volumeMl: 250,
  abv: 5.2,
  volumeSource: "menu",
  abvSource: "estimated",
  note: "",
  ...over,
});

describe("metrics", () => {
  it("computes grams of alcohol and the blood alcohol rise (Widmark)", () => {
    const m = metrics({ volumeMl: 330, abv: 8.5, priceEur: 4.9 }); // Duvel, default man of 75 kg
    expect(m.pureMl).toBeCloseTo(28.05, 2);
    expect(m.grams).toBeCloseTo(22.13, 2);
    expect(m.promille).toBeCloseTo(22.13 / (75 * 0.7), 3); // 0.42 ‰
    expect(m.eurPerPromille).toBeCloseTo(4.9 / m.promille, 6); // ≈ €11.62
  });
  it("depends on weight and sex: a pintje gives a 60 kg woman more promille", () => {
    const pint = { volumeMl: 250, abv: 5.2, priceEur: 3 };
    const man = metrics(pint, { sex: "man", weightKg: 75 });
    const woman = metrics(pint, { sex: "vrouw", weightKg: 60 });
    expect(man.promille).toBeCloseTo(0.195, 3);
    expect(woman.promille).toBeCloseTo(0.285, 3);
    expect(woman.eurPerPromille).toBeLessThan(man.eurPerPromille);
    expect(promilleFor(52.5, { sex: "man", weightKg: 75 })).toBeCloseTo(1, 9);
  });
  it("returns Infinity price-per-promille for 0% drinks", () => {
    expect(metrics({ volumeMl: 330, abv: 0, priceEur: 3 }).eurPerPromille).toBe(Infinity);
  });
});

describe("sanitizeProfile", () => {
  it("accepts valid profiles and clamps the weight", () => {
    expect(sanitizeProfile({ sex: "vrouw", weightKg: "61.6" })).toEqual({ sex: "vrouw", weightKg: 62 });
    expect(sanitizeProfile({ sex: "man", weightKg: 900 })).toEqual({ sex: "man", weightKg: 200 });
    expect(sanitizeProfile({ sex: "x", weightKg: 70 })).toBeNull();
    expect(sanitizeProfile(null)).toBeNull();
  });
});

describe("sanitizeRaw", () => {
  it("accepts strings with decimal commas and clamps values", () => {
    const d = sanitizeRaw({ ...raw({}), priceEur: "4,50", volumeMl: "330", abv: "8,5" });
    expect(d).toMatchObject({ priceEur: 4.5, volumeMl: 330, abv: 8.5 });
  });
  it("drops alcohol-free, priceless or broken entries", () => {
    expect(sanitizeRaw(raw({ abv: 0 }))).toBeNull();
    expect(sanitizeRaw(raw({ priceEur: 0 }))).toBeNull();
    expect(sanitizeRaw({ name: "" })).toBeNull();
    expect(sanitizeRaw(null)).toBeNull();
  });
  it("drops alcohol-free drinks the model let through", () => {
    for (const printed of ["Jupiler 0,0% ..... 3,00", "Leffe Blond 0.0 4,20", "Hoegaarden 0% 3,50", "Wijn alcoholvrij 5,00", "Heineken 0.0"]) {
      expect(sanitizeRaw({ ...raw({}), printed }), printed).toBeNull();
    }
    expect(sanitizeRaw({ ...raw({}), name: "Mocktail Mojito" })).toBeNull();
  });
  it("keeps normal drinks whose line contains zeros", () => {
    for (const printed of ["Tripel 8,0% ..... 5,00", "Pitcher 1,5L ..... 15,00", "Fles wijn 75cl € 20,00", "Bush 10% 6,00", "Duvel 0,33L 4,90", "Jupiler 25cl 3,00"]) {
      expect(sanitizeRaw({ ...raw({}), printed }), printed).not.toBeNull();
    }
  });
  it("falls back to 'overig' for unknown categories", () => {
    expect(sanitizeRaw({ ...raw({}), category: "mead" })?.category).toBe("overig");
  });
});

describe("mergeDrinks", () => {
  it("keeps one entry for the same drink seen on two photos", () => {
    let list = mergeDrinks([], [raw({}), raw({ name: "Duvel", volumeMl: 330, priceEur: 4.9, abv: 8.5 })], "p1");
    list = mergeDrinks(list, [raw({ name: "JUPILER" }), raw({ name: "Jupiler", volumeMl: 500, priceEur: 5.2 })], "p2");
    expect(list).toHaveLength(3);
    expect(list[0].photoIds).toEqual(["p1", "p2"]);
  });
});

describe("sortDrinks", () => {
  const list = mergeDrinks(
    [],
    [
      raw({ name: "Jupiler 25", priceEur: 2.8, volumeMl: 250, abv: 5.2 }),
      raw({ name: "Pitcher", priceEur: 15, volumeMl: 1500, abv: 5.2 }),
      raw({ name: "Kasteel", priceEur: 5.4, volumeMl: 330, abv: 11 }),
      raw({ name: "Whisky", priceEur: 8, volumeMl: 40, abv: 40, category: "sterk" }),
    ],
    "p",
  );
  it("deal: cheapest alcohol first", () => {
    expect(sortDrinks(list, "deal").map((d) => d.name)).toEqual(["Kasteel", "Pitcher", "Jupiler 25", "Whisky"]);
  });
  it("cheap / strong / most", () => {
    expect(sortDrinks(list, "cheap")[0].name).toBe("Jupiler 25");
    expect(sortDrinks(list, "strong")[0].name).toBe("Whisky");
    expect(sortDrinks(list, "most")[0].name).toBe("Pitcher");
  });
  it("relative score is 1 for the leader and lower for the rest", () => {
    const sorted = sortDrinks(list, "deal");
    expect(relativeScore(sorted[0], sorted[0], "deal")).toBe(1);
    expect(relativeScore(sorted[3], sorted[0], "deal")).toBeLessThan(0.5);
  });
});

describe("rankDeltas", () => {
  it("reports moves up, down and new entries", () => {
    const prev = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
    const d = rankDeltas(prev, ["c", "a", "x", "b"]);
    expect(d.get("c")).toBe(2);
    expect(d.get("a")).toBe(-1);
    expect(d.get("b")).toBe(-2);
    expect(d.get("x")).toBe("new");
  });
});

describe("fmt", () => {
  it("formats Belgian style", () => {
    expect(fmt.eur(2.8).replace(/\s/g, " ")).toBe("€ 2,80");
    expect(fmt.volume(330)).toBe("33 cl");
    expect(fmt.volume(1500)).toBe("1,5 L");
    expect(fmt.pct(8.5)).toBe("8,5%");
    expect(fmt.eurTight(1.89)).toBe("€1,89");
    expect(fmt.eurTight(Infinity)).toBe("–");
    expect(fmt.promille(0.1954)).toBe("0,20‰");
  });
});
