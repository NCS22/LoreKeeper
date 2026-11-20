import { describe, expect, it } from "vitest";
import { chooseInitialUniverseId } from "@/modules/universes/domain/initial-universe-selection";

const ownUniverses = [{ id: "oldest" }, { id: "middle" }, { id: "newest" }];

describe("chooseInitialUniverseId", () => {
  it("selects the remembered universe when it is among the own universes", () => {
    expect(chooseInitialUniverseId(ownUniverses, "middle")).toBe("middle");
  });

  it("selects the first universe when nothing is remembered", () => {
    expect(chooseInitialUniverseId(ownUniverses, null)).toBe("oldest");
  });

  it("selects the first universe when the remembered one is not available", () => {
    expect(chooseInitialUniverseId(ownUniverses, "someone-elses")).toBe("oldest");
  });

  it("selects nothing when there are no universes, remembered or not", () => {
    expect(chooseInitialUniverseId([], null)).toBeNull();
    expect(chooseInitialUniverseId([], "middle")).toBeNull();
  });
});
