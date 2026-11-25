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

// A layout that counts its `onTick` notifications, so a test waits for an amount of simulation
// work instead of wall-clock time. The count starts again on every wait.
function createLayoutCountingTicks(nodes: ForceNodeInput[], links: ForceLinkInput[], settings: ForceLayoutSettings) {
  let notifiedTicks = 0;
  let pendingWait: { tickCount: number; resolve: () => void } | undefined;
  const layout = createForceLayout({
    nodes,
    links,
    settings,
    onTick: () => {
      notifiedTicks += 1;
      if (pendingWait !== undefined && notifiedTicks >= pendingWait.tickCount) {
        const { resolve } = pendingWait;
        pendingWait = undefined;
        resolve();
      }
    },
    onSettled: () => {},
  });
  const waitForTicks = (tickCount: number) =>
    new Promise<void>((resolve) => {
      notifiedTicks = 0;
      pendingWait = { tickCount, resolve };
    });
  return { layout, waitForTicks };
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

  it("spreads 300 nodes without overlaps", () => {
    const nodes = createRingNodes(300, 600);
    const links: ForceLinkInput[] = nodes.slice(1).map((node, index) => ({ sourceId: nodes[Math.floor(index / 3)].id, targetId: node.id }));

    const layout = createLayout(nodes, links);

    expect(minimumDistanceBetweenAnyTwo(layout.readPositions())).toBeGreaterThan(NODE_RADIUS * 1.5);
    layout.stop();
  });
});

describe.each([
  ["default", FORCE_SETTINGS],
  ["reduced motion", REDUCED_MOTION_FORCE_SETTINGS],
])("dragging a node with the %s settings", (_name, settings) => {
  it("pulls its neighbours along more than the nodes it is not linked to", async () => {
    const { nodes, links, hubId, neighbourIds, unconnectedIds } = createHubGraph(6, 3);
    const { layout, waitForTicks } = createLayoutCountingTicks(nodes, links, settings);
    const before = layout.readPositions();

    const hubStart = positionOf(before, hubId);
    layout.dragNodeTo(hubId, hubStart.x + 400, hubStart.y);
    // Let the simulation run on its own timer for a number of ticks.
    await waitForTicks(20);
    const after = layout.readPositions();
    const averageDisplacement = (ids: string[]) =>
      ids.reduce((total, id) => total + distanceBetween(positionOf(before, id), positionOf(after, id)), 0) / ids.length;

    expect(positionOf(after, hubId).x).toBeCloseTo(hubStart.x + 400, 5);
    expect(averageDisplacement(neighbourIds)).toBeGreaterThan(averageDisplacement(unconnectedIds));
    layout.stop();
  });

  it("holds the dragged node in place until it is released", async () => {
    const { nodes, links, hubId } = createHubGraph(6, 0);
    const { layout, waitForTicks } = createLayoutCountingTicks(nodes, links, settings);

    layout.dragNodeTo(hubId, 123, -45);
    await waitForTicks(6);

    expect(positionOf(layout.readPositions(), hubId)).toMatchObject({ x: 123, y: -45 });
    layout.releaseNode(hubId);
    layout.stop();
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
