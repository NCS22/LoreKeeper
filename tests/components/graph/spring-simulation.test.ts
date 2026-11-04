import { describe, expect, it } from "vitest";
import {
  REDUCED_MOTION_SPRING_SETTINGS,
  SPRING_SETTINGS,
  measureRestLengths,
  stepSpringSimulation,
  type SimulationNode,
  type SimulationSettings,
} from "@/components/graph/spring-simulation";

const MAXIMUM_FRAMES = 3000;

function createNode(id: string, x: number, y: number, isFixed = false): SimulationNode {
  return { id, x, y, velocityX: 0, velocityY: 0, isFixed };
}

// Steps until the simulation reports rest and returns how many frames that took.
function runUntilAtRest(nodes: SimulationNode[], links: ReturnType<typeof measureRestLengths>, settings: SimulationSettings) {
  for (let frame = 1; frame <= MAXIMUM_FRAMES; frame += 1) {
    if (stepSpringSimulation(nodes, links, settings)) return frame;
  }
  return MAXIMUM_FRAMES;
}

describe("measureRestLengths", () => {
  it("uses the current distance between the two nodes of each link", () => {
    const nodes = [createNode("a", 0, 0), createNode("b", 30, 40)];
    expect(measureRestLengths(nodes, [{ sourceId: "a", targetId: "b" }])).toEqual([
      { sourceId: "a", targetId: "b", restLength: 50 },
    ]);
  });

  it("skips links whose nodes are not in the graph", () => {
    expect(measureRestLengths([createNode("a", 0, 0)], [{ sourceId: "a", targetId: "missing" }])).toEqual([]);
  });
});

describe.each([
  ["default", SPRING_SETTINGS],
  ["reduced motion", REDUCED_MOTION_SPRING_SETTINGS],
])("dragging a node with the %s settings", (_name, settings) => {
  it("pulls connected nodes along and keeps their distances", () => {
    const nodes = [createNode("held", 0, 0, true), createNode("near", 100, 0), createNode("far", 200, 0)];
    const links = measureRestLengths(nodes, [
      { sourceId: "held", targetId: "near" },
      { sourceId: "near", targetId: "far" },
    ]);

    nodes[0].x = 0;
    nodes[0].y = 150;
    runUntilAtRest(nodes, links, settings);

    const [held, near, far] = nodes;
    expect(Math.hypot(near.x - held.x, near.y - held.y)).toBeCloseTo(100, 0);
    expect(Math.hypot(far.x - near.x, far.y - near.y)).toBeCloseTo(100, 0);
    expect(near.y).toBeGreaterThan(50);
  });

  it("leaves nodes that are not connected to the dragged one where they are", () => {
    const nodes = [createNode("held", 0, 0, true), createNode("near", 100, 0), createNode("alone", 500, 500)];
    const links = measureRestLengths(nodes, [{ sourceId: "held", targetId: "near" }]);

    nodes[0].y = 150;
    runUntilAtRest(nodes, links, settings);

    expect(nodes[2].x).toBe(500);
    expect(nodes[2].y).toBe(500);
  });

  it("never moves a fixed node by itself", () => {
    const nodes = [createNode("held", 0, 150, true), createNode("near", 100, 0)];
    const links = measureRestLengths([createNode("held", 0, 0), createNode("near", 100, 0)], [
      { sourceId: "held", targetId: "near" },
    ]);

    runUntilAtRest(nodes, links, settings);

    expect(nodes[0].x).toBe(0);
    expect(nodes[0].y).toBe(150);
  });

  it("stays stable and comes to rest for a node with many neighbours", () => {
    const hub = createNode("hub", 0, 0, true);
    const spokes = Array.from({ length: 12 }, (_value, index) => {
      const angle = (index / 12) * 2 * Math.PI;
      return createNode(`spoke-${index}`, Math.cos(angle) * 120, Math.sin(angle) * 120);
    });
    const nodes = [hub, ...spokes];
    const links = measureRestLengths(
      nodes,
      spokes.map((spoke) => ({ sourceId: "hub", targetId: spoke.id })),
    );

    hub.x = 300;
    hub.y = -200;
    const framesToRest = runUntilAtRest(nodes, links, settings);

    expect(framesToRest).toBeLessThan(MAXIMUM_FRAMES);
    for (const node of nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
    }
  });
});

describe("collisions", () => {
  it("push overlapping nodes apart", () => {
    const nodes = [createNode("first", 0, 0), createNode("second", 5, 0)];

    runUntilAtRest(nodes, [], SPRING_SETTINGS);

    expect(Math.hypot(nodes[1].x - nodes[0].x, nodes[1].y - nodes[0].y)).toBeGreaterThan(
      SPRING_SETTINGS.collisionDistance - 1,
    );
  });
});
