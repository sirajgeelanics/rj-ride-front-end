import { describe, expect, it } from "vitest";
import { highlightParts, normalize, searchOptions } from "../search";

const opts = [
  { label: "Toyota Innova Crysta", description: "MUV" },
  { label: "Sedan 4c", description: "4 seats" },
  { label: "Sedan 5c" },
  { label: "SUV", keywords: "fortuner xuv" },
  { label: "Maruti Dzire" },
  { label: "Café Hotel", description: "Aerocity, Delhi" },
];
const labels = (q: string) => searchOptions(opts, q).map((o) => o.label);

describe("search", () => {
  it("normalizes accents, case and punctuation", () => {
    expect(normalize("  CAFÉ--Hotel! ")).toBe("cafe hotel");
  });
  it("returns everything untouched for an empty query", () => {
    expect(searchOptions(opts, "  ")).toBe(opts);
  });
  it("matches words in any order", () => {
    expect(labels("crysta toyota")).toEqual(["Toyota Innova Crysta"]);
  });
  it("matches a partial last word and a number", () => {
    expect(labels("sedan 4")).toEqual(["Sedan 4c"]);
  });
  it("ranks a prefix above a mid-word hit", () => {
    expect(labels("s")[0]).toMatch(/^S/);
    expect(labels("inn")[0]).toBe("Toyota Innova Crysta");
  });
  it("finds by description and by hidden keywords, ignoring accents", () => {
    expect(labels("aerocity")).toEqual(["Café Hotel"]);
    expect(labels("fortuner")).toEqual(["SUV"]);
    expect(labels("cafe")).toEqual(["Café Hotel"]);
  });
  it("tolerates a dropped letter / abbreviation", () => {
    expect(labels("sdn")).toContain("Sedan 4c");
    expect(labels("dzre")).toEqual(["Maruti Dzire"]);
  });
  it("returns nothing for gibberish", () => {
    expect(labels("zzzq")).toEqual([]);
  });
  it("highlights each typed word", () => {
    expect(highlightParts("Sedan 4c", "sed 4").filter((p) => p.hit).map((p) => p.text)).toEqual(["Sed", "4"]);
  });
});

import { matchesCompact, matchesWords } from "../search";

describe("tab search helpers", () => {
  it("matches a plate ignoring spaces, dashes and case", () => {
    expect(matchesCompact("KA 01 AB 1234", "ka01ab1234")).toBe(true);
    expect(matchesCompact("KA01AB1234", "ka-01 ab")).toBe(true);
    expect(matchesCompact("KA01AB1234", "ab12")).toBe(true);
    expect(matchesCompact("KA01AB1234", "ka02")).toBe(false);
    expect(matchesCompact("KA01AB1234", "  ")).toBe(true);
  });
  it("matches names by any words in any order", () => {
    expect(matchesWords("Ravi Kumar Singh", "singh ravi")).toBe(true);
    expect(matchesWords("Ravi Kumar", "kum")).toBe(true);
    expect(matchesWords("Ravi Kumar", "amit")).toBe(false);
    expect(matchesWords("José Álvarez", "jose alvarez")).toBe(true);
  });
});
