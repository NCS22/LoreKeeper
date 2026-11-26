import { describe, expect, it } from "vitest";
import { readRelationshipFromSide } from "@/modules/knowledge/domain/relationship-reading";

const FRODO = { id: "00000000-0000-4000-8000-0000000000d1", name: "Frodo" };
const FELLOWSHIP = { id: "00000000-0000-4000-8000-0000000000d2", name: "The Fellowship" };

const MEMBER_OF = { label: "member of", inverseLabel: "has member", isSymmetric: false };
const ALLY_OF = { label: "ally of", inverseLabel: "ally of", isSymmetric: true };

describe("readRelationshipFromSide", () => {
  const frodoMemberOfFellowship = { source: FRODO, target: FELLOWSHIP };

  it("reads from the source entity with the label, towards the target", () => {
    expect(readRelationshipFromSide(frodoMemberOfFellowship, MEMBER_OF, "SOURCE")).toEqual({
      subjectName: "Frodo",
      label: "member of",
      otherName: "The Fellowship",
    });
  });

  it("reads from the target entity with the inverse label, towards the source", () => {
    expect(readRelationshipFromSide(frodoMemberOfFellowship, MEMBER_OF, "TARGET")).toEqual({
      subjectName: "The Fellowship",
      label: "has member",
      otherName: "Frodo",
    });
  });

  it("reads a symmetric type with the same label from both entities", () => {
    const fromSource = readRelationshipFromSide(frodoMemberOfFellowship, ALLY_OF, "SOURCE");
    const fromTarget = readRelationshipFromSide(frodoMemberOfFellowship, ALLY_OF, "TARGET");

    expect(fromSource).toEqual({ subjectName: "Frodo", label: "ally of", otherName: "The Fellowship" });
    expect(fromTarget).toEqual({ subjectName: "The Fellowship", label: "ally of", otherName: "Frodo" });
  });

  it("uses the label of a symmetric type from the target even if its inverse label were different", () => {
    const symmetricWithOtherInverse = { label: "sibling of", inverseLabel: "something else", isSymmetric: true };

    expect(readRelationshipFromSide(frodoMemberOfFellowship, symmetricWithOtherInverse, "TARGET").label).toBe(
      "sibling of",
    );
  });
});
