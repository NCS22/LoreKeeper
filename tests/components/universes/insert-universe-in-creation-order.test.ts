import { describe, expect, it } from "vitest";
import { insertUniverseInCreationOrder } from "@/components/universes/insert-universe-in-creation-order";
import type { UniverseDto } from "@/modules/universes";

function buildUniverse(id: string, createdAt: string): UniverseDto {
  return { id, name: `Universe ${id}`, description: null, mode: "READER", createdAt, updatedAt: createdAt };
}

const FIRST = buildUniverse("00000000-0000-4000-8000-000000000001", "2026-11-17T10:00:00.000Z");
const SECOND = buildUniverse("00000000-0000-4000-8000-000000000002", "2026-11-17T10:00:05.000Z");

describe("insertUniverseInCreationOrder", () => {
  it("puts a newer universe last", () => {
    expect(insertUniverseInCreationOrder([FIRST], SECOND)).toEqual([FIRST, SECOND]);
  });

  it("puts a universe whose answer arrived late before the newer one already listed", () => {
    expect(insertUniverseInCreationOrder([SECOND], FIRST)).toEqual([FIRST, SECOND]);
  });

  it("orders universes created at the same instant by identifier", () => {
    const sameInstantSmallerId = buildUniverse("00000000-0000-4000-8000-0000000000aa", SECOND.createdAt);

    expect(insertUniverseInCreationOrder([SECOND], sameInstantSmallerId)).toEqual([SECOND, sameInstantSmallerId]);
    expect(insertUniverseInCreationOrder([sameInstantSmallerId], SECOND)).toEqual([SECOND, sameInstantSmallerId]);
  });

  it("does not add a universe that is already listed, and does not change the list it was given", () => {
    const listed = [FIRST, SECOND];

    expect(insertUniverseInCreationOrder(listed, FIRST)).toBe(listed);
    expect(listed).toEqual([FIRST, SECOND]);
  });
});
