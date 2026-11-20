import { describe, expect, it } from "vitest";
import { chooseTabbableUniverseId, findUniverseIdToFocus } from "@/components/sidebar/universe-tree-navigation";

const universeIds = ["universe-a", "universe-b", "universe-c"];

describe("findUniverseIdToFocus", () => {
  it("ArrowDown goes to the next universe", () => {
    expect(findUniverseIdToFocus(universeIds, "universe-a", "ArrowDown")).toBe("universe-b");
  });

  it("ArrowUp goes to the previous universe", () => {
    expect(findUniverseIdToFocus(universeIds, "universe-c", "ArrowUp")).toBe("universe-b");
  });

  it("ArrowUp on the first and ArrowDown on the last move nothing", () => {
    expect(findUniverseIdToFocus(universeIds, "universe-a", "ArrowUp")).toBeNull();
    expect(findUniverseIdToFocus(universeIds, "universe-c", "ArrowDown")).toBeNull();
  });

  it("Home goes to the first universe and End to the last", () => {
    expect(findUniverseIdToFocus(universeIds, "universe-b", "Home")).toBe("universe-a");
    expect(findUniverseIdToFocus(universeIds, "universe-b", "End")).toBe("universe-c");
  });

  it("ArrowLeft and ArrowRight move nothing: the tree has a single level", () => {
    expect(findUniverseIdToFocus(universeIds, "universe-b", "ArrowLeft")).toBeNull();
    expect(findUniverseIdToFocus(universeIds, "universe-b", "ArrowRight")).toBeNull();
  });

  it("other keys move nothing", () => {
    expect(findUniverseIdToFocus(universeIds, "universe-b", "a")).toBeNull();
    expect(findUniverseIdToFocus(universeIds, "universe-b", "Tab")).toBeNull();
  });

  it("moves nothing when the current universe is not in the list", () => {
    expect(findUniverseIdToFocus(universeIds, "universe-gone", "ArrowDown")).toBeNull();
  });

  it("moves nothing in an empty list", () => {
    expect(findUniverseIdToFocus([], "universe-a", "Home")).toBeNull();
  });
});

describe("chooseTabbableUniverseId", () => {
  it("is the universe focused last when it is in the list", () => {
    expect(chooseTabbableUniverseId(universeIds, "universe-c", "universe-a")).toBe("universe-c");
  });

  it("is the selected universe when nothing was focused yet", () => {
    expect(chooseTabbableUniverseId(universeIds, null, "universe-b")).toBe("universe-b");
  });

  it("is the first universe when neither the focused nor the selected one is in the list", () => {
    expect(chooseTabbableUniverseId(universeIds, "universe-gone", "universe-also-gone")).toBe("universe-a");
    expect(chooseTabbableUniverseId(universeIds, null, null)).toBe("universe-a");
  });

  it("is none when the list is empty", () => {
    expect(chooseTabbableUniverseId([], "universe-a", "universe-a")).toBeNull();
  });
});
