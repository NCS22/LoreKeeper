import { describe, expect, it } from "vitest";
import {
  FORCE_SETTINGS,
  REDUCED_MOTION_FORCE_SETTINGS,
  createForceLayout,
  type ForceLayoutSettings,
  type ForceLinkInput,
  type ForceNodeInput,
  type NodePosition,
} from "@/components/graph/force-layout";

const NODE_RADIUS = 10;

function createRingNodes(count: number, ringRadius = 220): ForceNodeInput[] {
  return Array.from({ length: count }, (_value, index) => {
    const angle = (index / count) * 2 * Math.PI;
    return { id: `node-${index}`, x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius, radius: NODE_RADIUS };
  });
}

// A hub linked to `neighbourCount` nodes, plus a few nodes that have no links at all.
function createHubGraph(neighbourCount: number, unconnectedCount: number) {
  const nodes = createRingNodes(1 + neighbourCount + unconnectedCount);
  const links: ForceLinkInput[] = nodes
    .slice(1, 1 + neighbourCount)
    .map((neighbour) => ({ sourceId: nodes[0].id, targetId: neighbour.id }));
  return { nodes, links, hubId: nodes[0].id, neighbourIds: links.map((link) => link.targetId), unconnectedIds: nodes.slice(1 + neighbourCount).map((node) => node.id) };
}

function createLayout(nodes: ForceNodeInput[], links: ForceLinkInput[], settings: ForceLayoutSettings = FORCE_SETTINGS) {
  return createForceLayout({ nodes, links, settings, onTick: () => {}, onSettled: () => {} });
}

function distanceBetween(first: NodePosition, second: NodePosition): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function positionOf(positions: NodePosition[], nodeId: string): NodePosition {
  const position = positions.find((candidate) => candidate.id === nodeId);
  if (position === undefined) throw new Error(`Missing node ${nodeId}`);
  return position;
}

function minimumDistanceBetweenAnyTwo(positions: NodePosition[]): number {
  let minimum = Infinity;
  for (let first = 0; first < positions.length; first += 1) {
    for (let second = first + 1; second < positions.length; second += 1) {
      minimum = Math.min(minimum, distanceBetween(positions[first], positions[second]));
    }
  }
  return minimum;
}

describe("a settled layout", () => {
  it("keeps nodes apart, so no two dots overlap", () => {
    const { nodes, links } = createHubGraph(12, 4);
    const layout = createLayout(nodes, links);

    expect(minimumDistanceBetweenAnyTwo(layout.readPositions())).toBeGreaterThanOrEqual(NODE_RADIUS * 2);
    layout.stop();
  });

  it("keeps nodes without links near the rest instead of drifting away", () => {
    const { nodes, links, unconnectedIds } = createHubGraph(8, 3);
    const layout = createLayout(nodes, links);

    const positions = layout.readPositions();
    const hubPosition = positionOf(positions, nodes[0].id);
    for (const unconnectedId of unconnectedIds) {
      expect(distanceBetween(positionOf(positions, unconnectedId), hubPosition)).toBeLessThan(600);
    }
    layout.stop();
  });

  it("is the same on every run, so the graph does not rearrange itself between visits", () => {
    const { nodes, links } = createHubGraph(8, 2);
    const firstLayout = createLayout(nodes, links);
    const secondLayout = createLayout(nodes, links);

    expect(secondLayout.readPositions()).toEqual(firstLayout.readPositions());
    firstLayout.stop();
    secondLayout.stop();
  });

  it("spreads 300 nodes without overlaps, and a tick stays cheap", () => {
    const nodes = createRingNodes(300, 600);
    const links: ForceLinkInput[] = nodes.slice(1).map((node, index) => ({ sourceId: nodes[Math.floor(index / 3)].id, targetId: node.id }));

    const startTime = performance.now();
    const layout = createLayout(nodes, links);
    const elapsedPerTick = (performance.now() - startTime) / FORCE_SETTINGS.presettleTicks;

    expect(minimumDistanceBetweenAnyTwo(layout.readPositions())).toBeGreaterThan(NODE_RADIUS * 1.5);
    expect(elapsedPerTick).toBeLessThan(16);
    layout.stop();
  });
});

describe.each([
  ["default", FORCE_SETTINGS],
  ["reduced motion", REDUCED_MOTION_FORCE_SETTINGS],
])("dragging a node with the %s settings", (_name, settings) => {
  it("pulls its neighbours along more than the nodes it is not linked to", () => {
    const { nodes, links, hubId, neighbourIds, unconnectedIds } = createHubGraph(6, 3);
    const layout = createLayout(nodes, links, settings);
    const before = layout.readPositions();

    const hubStart = positionOf(before, hubId);
    layout.dragNodeTo(hubId, hubStart.x + 400, hubStart.y);
    // Let the simulation run on its own timer for a moment.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const after = layout.readPositions();
        const averageDisplacement = (ids: string[]) =>
          ids.reduce((total, id) => total + distanceBetween(positionOf(before, id), positionOf(after, id)), 0) / ids.length;

        expect(positionOf(after, hubId).x).toBeCloseTo(hubStart.x + 400, 5);
        expect(averageDisplacement(neighbourIds)).toBeGreaterThan(averageDisplacement(unconnectedIds));
        layout.stop();
        resolve();
      }, 600);
    });
  });

  it("holds the dragged node in place until it is released", () => {
    const { nodes, links, hubId } = createHubGraph(6, 0);
    const layout = createLayout(nodes, links, settings);

    layout.dragNodeTo(hubId, 123, -45);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(positionOf(layout.readPositions(), hubId)).toMatchObject({ x: 123, y: -45 });
        layout.releaseNode(hubId);
        layout.stop();
        resolve();
      }, 200);
    });
  });
});

describe("updateRadii", () => {
  it("makes room for bigger nodes", () => {
    const { nodes, links } = createHubGraph(10, 0);
    const layout = createLayout(nodes, links);

    layout.updateRadii(new Map(nodes.map((node) => [node.id, 30])));
    layout.dragNodeTo(nodes[1].id, 0, 0);
    layout.releaseNode(nodes[1].id);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(minimumDistanceBetweenAnyTwo(layout.readPositions())).toBeGreaterThan(40);
        layout.stop();
        resolve();
      }, 1500);
    });
  });
});
