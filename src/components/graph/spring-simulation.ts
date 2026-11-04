// Small spring simulation behind the "drag a node and its neighbours follow" behaviour.
// Pure and independent of Cytoscape: the canvas copies positions in, steps it, and copies them out.
//
// Every link is a spring that wants to keep the distance the two nodes had when the drag began, so
// the layout keeps its shape and only reacts to the node being moved. Nodes that are too close push
// each other apart so a pulled neighbour does not end up on top of another one.

export type SimulationNode = {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  // A fixed node is held by the user: it exerts forces but never moves on its own.
  isFixed: boolean;
};

export type SimulationLink = {
  sourceId: string;
  targetId: string;
  restLength: number;
};

export type SimulationSettings = {
  springStiffness: number;
  // Share of the velocity kept after one 60 fps frame. Lower values stop the motion sooner.
  velocityRetention: number;
  collisionDistance: number;
  collisionStrength: number;
  // Below this speed (px per frame) a node counts as at rest.
  restSpeed: number;
};

// Bouncy, like the graph view of Obsidian.
export const SPRING_SETTINGS: SimulationSettings = {
  springStiffness: 0.04,
  velocityRetention: 0.85,
  collisionDistance: 28,
  collisionStrength: 0.1,
  restSpeed: 0.02,
};

// Neighbours still follow, but they glide to their place without overshooting.
export const REDUCED_MOTION_SPRING_SETTINGS: SimulationSettings = {
  ...SPRING_SETTINGS,
  springStiffness: 0.15,
  velocityRetention: 0.4,
};

const REFERENCE_FRAME_MILLISECONDS = 1000 / 60;
const MAXIMUM_FRAME_SCALE = 2;
const MAXIMUM_SPEED = 60;

export function measureRestLengths(
  nodes: readonly SimulationNode[],
  links: readonly { sourceId: string; targetId: string }[],
): SimulationLink[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return links.flatMap((link) => {
    const source = nodesById.get(link.sourceId);
    const target = nodesById.get(link.targetId);
    if (source === undefined || target === undefined) return [];
    return [{ ...link, restLength: Math.hypot(target.x - source.x, target.y - source.y) }];
  });
}

// Advances the simulation by one frame, updating the nodes in place (it runs on every animation
// frame, so allocating new arrays each time would only add garbage). Returns true once every node
// that can move is at rest.
export function stepSpringSimulation(
  nodes: SimulationNode[],
  links: readonly SimulationLink[],
  settings: SimulationSettings,
  elapsedMilliseconds: number = REFERENCE_FRAME_MILLISECONDS,
): boolean {
  // A slow frame advances the simulation further instead of slowing it down; capped for stability.
  const frameScale = Math.min(MAXIMUM_FRAME_SCALE, elapsedMilliseconds / REFERENCE_FRAME_MILLISECONDS);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  for (const link of links) {
    const source = nodesById.get(link.sourceId);
    const target = nodesById.get(link.targetId);
    if (source === undefined || target === undefined) continue;
    const deltaX = target.x - source.x;
    const deltaY = target.y - source.y;
    const distance = Math.hypot(deltaX, deltaY) || 1e-6;
    const pull = (settings.springStiffness * (distance - link.restLength) * frameScale) / distance;
    if (!source.isFixed) {
      source.velocityX += deltaX * pull;
      source.velocityY += deltaY * pull;
    }
    if (!target.isFixed) {
      target.velocityX -= deltaX * pull;
      target.velocityY -= deltaY * pull;
    }
  }

  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      const first = nodes[firstIndex];
      const second = nodes[secondIndex];
      const deltaX = second.x - first.x;
      const deltaY = second.y - first.y;
      const distance = Math.hypot(deltaX, deltaY) || 1e-6;
      if (distance >= settings.collisionDistance) continue;
      const push = (settings.collisionStrength * (settings.collisionDistance - distance) * frameScale) / distance;
      if (!first.isFixed) {
        first.velocityX -= deltaX * push;
        first.velocityY -= deltaY * push;
      }
      if (!second.isFixed) {
        second.velocityX += deltaX * push;
        second.velocityY += deltaY * push;
      }
    }
  }

  const retention = settings.velocityRetention ** frameScale;
  let isAtRest = true;
  for (const node of nodes) {
    if (node.isFixed) {
      node.velocityX = 0;
      node.velocityY = 0;
      continue;
    }
    node.velocityX *= retention;
    node.velocityY *= retention;
    const speed = Math.hypot(node.velocityX, node.velocityY);
    if (speed > MAXIMUM_SPEED) {
      node.velocityX *= MAXIMUM_SPEED / speed;
      node.velocityY *= MAXIMUM_SPEED / speed;
    }
    node.x += node.velocityX * frameScale;
    node.y += node.velocityY * frameScale;
    if (speed > settings.restSpeed) isAtRest = false;
  }
  return isAtRest;
}
