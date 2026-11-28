import { describe, expect, it } from "vitest";
import { applyEditedUniverse } from "@/components/universes/apply-edited-universe";
import type { UniverseDto } from "@/modules/universes";

function buildUniverse(id: string, name: string, updatedAt: string): UniverseDto {
  return { id, name, description: null, mode: "READER", createdAt: "2026-11-17T10:00:00.000Z", updatedAt };
}

const FIRST = buildUniverse("00000000-0000-4000-8000-000000000001", "First", "2026-11-17T10:00:00.000Z");
const SECOND = buildUniverse("00000000-0000-4000-8000-000000000002", "Second", "2026-11-17T10:00:05.000Z");
const THIRD = buildUniverse("00000000-0000-4000-8000-000000000003", "Third", "2026-11-17T10:00:10.000Z");

function editSecond(name: string, description: string | null, updatedAt: string): UniverseDto {
  return { ...SECOND, name, description, updatedAt };
}

describe("applyEditedUniverse", () => {
  it("replaces the entry with the same identifier by the edited universe (FR-5)", () => {
    const editedSecond = editSecond("Second, renamed", "Now described", "2026-11-28T09:00:00.000Z");

    expect(applyEditedUniverse([FIRST, SECOND, THIRD], editedSecond)[1]).toEqual(editedSecond);
  });

  it("keeps the position of the edited universe and leaves the other universes untouched (FR-5)", () => {
    const editedSecond = editSecond("Aaa, now first by name", null, "2026-11-28T09:00:00.000Z");

    expect(applyEditedUniverse([FIRST, SECOND, THIRD], editedSecond)).toEqual([FIRST, editedSecond, THIRD]);
  });

  it("keeps a listed entry with a later update time instead of an older answer (FR-12)", () => {
    const newerSecond = editSecond("Newer", null, "2026-11-28T09:00:10.000Z");
    const olderSecond = editSecond("Older", "Older description", "2026-11-28T09:00:00.000Z");

    expect(applyEditedUniverse([FIRST, newerSecond, THIRD], olderSecond)).toEqual([FIRST, newerSecond, THIRD]);
  });

  it("applies an answer with the same update time as the listed entry, as a save with no real change answers", () => {
    const sameTimeSecond = editSecond("Second", "Same instant", SECOND.updatedAt);

    expect(applyEditedUniverse([FIRST, SECOND, THIRD], sameTimeSecond)).toEqual([FIRST, sameTimeSecond, THIRD]);
  });

  it.each(["earlier", "later"] as const)("ends with the later update time when the %s of two answers arrives first (FR-12)", (firstToArrive) => {
    const earlierAnswer = editSecond("Earlier save", "Earlier", "2026-11-28T09:00:00.000Z");
    const laterAnswer = editSecond("Later save", "Later", "2026-11-28T09:00:10.000Z");
    const answersInArrivalOrder =
      firstToArrive === "earlier" ? [earlierAnswer, laterAnswer] : [laterAnswer, earlierAnswer];

    const finalUniverses = answersInArrivalOrder.reduce<readonly UniverseDto[]>(
      (universes, answer) => applyEditedUniverse(universes, answer),
      [FIRST, SECOND, THIRD],
    );

    expect(finalUniverses).toEqual([FIRST, laterAnswer, THIRD]);
  });

  it("ignores an edited universe whose identifier is not in the list", () => {
    const unknownUniverse = buildUniverse("00000000-0000-4000-8000-0000000000ff", "Unknown", "2026-11-28T09:00:00.000Z");
    const listed = [FIRST, SECOND, THIRD];

    expect(applyEditedUniverse(listed, unknownUniverse)).toEqual([FIRST, SECOND, THIRD]);
  });

  it("does not change the list it was given", () => {
    const listed = [FIRST, SECOND, THIRD];

    applyEditedUniverse(listed, editSecond("Second, renamed", null, "2026-11-28T09:00:00.000Z"));

    expect(listed).toEqual([FIRST, SECOND, THIRD]);
  });
});
