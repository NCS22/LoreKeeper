import { describe, expect, it } from "vitest";
import {
  chooseVisibleLabels,
  type LabelCandidate,
  type ScreenRectangle,
} from "@/components/graph/label-visibility";

function rectangle(left: number, top: number, width: number, height: number): ScreenRectangle {
  return { left, top, right: left + width, bottom: top + height };
}

// A small dot at (x, y) with a name of 60 x 12 pixels right below it.
function candidate(nodeId: string, x: number, y: number, priority: number): LabelCandidate {
  return {
    nodeId,
    priority,
    dot: rectangle(x - 5, y - 5, 10, 10),
    label: rectangle(x - 30, y + 8, 60, 12),
  };
}

function overlapsAny(first: ScreenRectangle, second: ScreenRectangle): boolean {
  return first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom;
}

describe("chooseVisibleLabels", () => {
  it("shows every name when there is room for all of them", () => {
    const visible = chooseVisibleLabels([candidate("a", 0, 0, 1), candidate("b", 200, 0, 1), candidate("c", 0, 200, 1)]);

    expect([...visible].sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps the name of the most connected node when two names would overlap", () => {
    const visible = chooseVisibleLabels([candidate("minor", 0, 0, 1), candidate("hub", 20, 0, 9)]);

    expect([...visible]).toEqual(["hub"]);
  });

  it("hides a name that would cover another node's dot", () => {
    const crowded = candidate("covering", 0, 0, 5);
    const dotUnderName = { ...candidate("below", 0, 12, 1), label: rectangle(500, 500, 60, 12) };

    const visible = chooseVisibleLabels([crowded, dotUnderName]);

    expect(visible.has("covering")).toBe(false);
    expect(visible.has("below")).toBe(true);
  });

  it("never leaves two visible names on top of each other", () => {
    const candidates = Array.from({ length: 200 }, (_value, index) =>
      candidate(`node-${index}`, (index * 37) % 400, (index * 53) % 300, index % 7),
    );

    const visible = chooseVisibleLabels(candidates);
    const shown = candidates.filter((entry) => visible.has(entry.nodeId));

    expect(shown.length).toBeGreaterThan(0);
    for (let first = 0; first < shown.length; first += 1) {
      for (let second = first + 1; second < shown.length; second += 1) {
        expect(overlapsAny(shown[first].label, shown[second].label)).toBe(false);
      }
    }
  });

  it("decides the same way for the same input, whatever its order", () => {
    const candidates = [candidate("a", 0, 0, 3), candidate("b", 20, 0, 3), candidate("c", 40, 0, 3)];

    const forward = chooseVisibleLabels(candidates);
    const backward = chooseVisibleLabels([...candidates].reverse());

    expect([...forward].sort()).toEqual([...backward].sort());
  });

  it("returns nothing for an empty graph", () => {
    expect(chooseVisibleLabels([]).size).toBe(0);
  });
});
