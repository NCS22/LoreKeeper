// Force-directed layout behind the graph, in the style of Obsidian: every node repels the others,
// every relationship is a spring, a soft pull toward the centre keeps unconnected groups close, and
// nodes never overlap. Pure and independent of Cytoscape: the canvas copies positions in and out.
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

export type ForceNodeInput = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

export type ForceLinkInput = {
  sourceId: string;
  targetId: string;
};

export type NodePosition = {
  id: string;
  x: number;
  y: number;
};

export type ForceLayoutSettings = {
  // Strength with which every node pushes the others away.
  repulsion: number;
  // Distance a relationship tries to keep between its two nodes.
  linkDistance: number;
  // Pull toward the centre of the graph, as a fraction of the distance per tick.
  gravity: number;
  // Free space kept around each node on top of its radius.
  collisionPadding: number;
  // Share of the velocity lost on every tick: higher values mean less inertia and no bounce.
  velocityDecay: number;
  // How fast the simulation cools down after a drag: higher values settle sooner.
  alphaDecay: number;
  // How awake the simulation stays while a node is being dragged (0 lets it cool down).
  dragAlphaTarget: number;
  // Ticks computed at once before the first paint, so the graph appears already spread out.
  presettleTicks: number;
};

// Lively, like the graph view of Obsidian.
export const FORCE_SETTINGS: ForceLayoutSettings = {
  repulsion: 350,
  linkDistance: 90,
  gravity: 0.06,
  collisionPadding: 6,
  velocityDecay: 0.4,
  alphaDecay: 0.035,
  dragAlphaTarget: 0.3,
  presettleTicks: 300,
};

// Neighbours still follow a dragged node, but they glide into place without overshooting.
export const REDUCED_MOTION_FORCE_SETTINGS: ForceLayoutSettings = {
  ...FORCE_SETTINGS,
  velocityDecay: 0.75,
};

type ForceNode = SimulationNodeDatum & { id: string; radius: number };

export type ForceLayout = {
  // Holds a node under the pointer and wakes the simulation so its neighbours follow.
  dragNodeTo: (nodeId: string, x: number, y: number) => void;
  // Lets go of a dragged node; the simulation then cools down on its own.
  releaseNode: (nodeId: string) => void;
  // Applies new radii, for when the text size (and so the node size) changes.
  updateRadii: (radiusByNodeId: ReadonlyMap<string, number>) => void;
  readPositions: () => NodePosition[];
  stop: () => void;
};

type CreateForceLayoutOptions = {
  nodes: readonly ForceNodeInput[];
  links: readonly ForceLinkInput[];
  settings: ForceLayoutSettings;
  // Called after every tick while the simulation is running.
  onTick: (positions: NodePosition[]) => void;
  // Called once the simulation has cooled down completely.
  onSettled: () => void;
};

export function createForceLayout({ nodes, links, settings, onTick, onSettled }: CreateForceLayoutOptions): ForceLayout {
  const forceNodes: ForceNode[] = nodes.map((node) => ({ ...node }));
  const forceNodesById = new Map(forceNodes.map((forceNode) => [forceNode.id, forceNode]));
  const forceLinks: SimulationLinkDatum<ForceNode>[] = links
    .filter((link) => forceNodesById.has(link.sourceId) && forceNodesById.has(link.targetId))
    .map((link) => ({ source: link.sourceId, target: link.targetId }));

  const collisionForce = forceCollide<ForceNode>().radius((forceNode) => forceNode.radius + settings.collisionPadding);
  const simulation: Simulation<ForceNode, SimulationLinkDatum<ForceNode>> = forceSimulation(forceNodes)
    .velocityDecay(settings.velocityDecay)
    .alphaDecay(settings.alphaDecay)
    .force("charge", forceManyBody<ForceNode>().strength(-settings.repulsion))
    .force(
      "links",
      forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(forceLinks)
        .id((forceNode) => forceNode.id)
        .distance(settings.linkDistance),
    )
    .force("gravityX", forceX<ForceNode>(0).strength(settings.gravity))
    .force("gravityY", forceY<ForceNode>(0).strength(settings.gravity))
    .force("collision", collisionForce);

  const readPositions = () =>
    forceNodes.map((forceNode) => ({ id: forceNode.id, x: forceNode.x ?? 0, y: forceNode.y ?? 0 }));

  // The simulation starts running on its own; it is computed by hand first so nothing is animated
  // before the graph has settled, and only wakes up again when the user drags a node.
  simulation.stop();
  simulation.tick(settings.presettleTicks);
  simulation.on("tick", () => onTick(readPositions()));
  simulation.on("end", onSettled);

  return {
    dragNodeTo: (nodeId, x, y) => {
      const forceNode = forceNodesById.get(nodeId);
      if (forceNode === undefined) return;
      forceNode.fx = x;
      forceNode.fy = y;
      simulation.alphaTarget(settings.dragAlphaTarget).restart();
    },
    releaseNode: (nodeId) => {
      const forceNode = forceNodesById.get(nodeId);
      if (forceNode === undefined) return;
      forceNode.fx = null;
      forceNode.fy = null;
      simulation.alphaTarget(0);
    },
    updateRadii: (radiusByNodeId) => {
      for (const forceNode of forceNodes) forceNode.radius = radiusByNodeId.get(forceNode.id) ?? forceNode.radius;
      // The collision force reads the radii once, so it is initialised again with the new ones.
      collisionForce.initialize(forceNodes, simulation.randomSource());
    },
    readPositions,
    stop: () => {
      simulation.stop();
    },
  };
}
