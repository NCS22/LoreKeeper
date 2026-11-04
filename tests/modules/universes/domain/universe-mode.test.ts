import { describe, expect, it } from "vitest";
import {
  DEFAULT_UNIVERSE_MODE,
  UNIVERSE_MODES,
  parseUniverseMode,
} from "@/modules/universes/domain/universe-mode";

describe("universe mode", () => {
  it("defaults to READER", () => {
    expect(DEFAULT_UNIVERSE_MODE).toBe("READER");
  });

  it("knows exactly the READER and AUTHOR modes", () => {
    expect([...UNIVERSE_MODES]).toEqual(["READER", "AUTHOR"]);
  });

  it.each(["READER", "AUTHOR"])("accepts %s", (mode) => {
    expect(parseUniverseMode(mode)).toBe(mode);
  });

  it.each([
    ["an empty string", ""],
    ["a lowercase mode", "reader"],
    ["a mode with surrounding spaces", " READER "],
    ["an unknown word", "EDITOR"],
    ["undefined", undefined],
    ["null", null],
    ["a number", 1],
  ])("rejects %s", (_description, value) => {
    expect(parseUniverseMode(value)).toBeNull();
  });
});
