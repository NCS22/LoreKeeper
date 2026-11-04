// Decides which node names are drawn when the graph is crowded: names are accepted from the most
// connected node down, and a name is skipped if it would cover a dot or another accepted name.
// Pure: the canvas measures the rectangles on screen and applies the result.

export type ScreenRectangle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type LabelCandidate = {
  nodeId: string;
  // Higher priorities are considered first (the number of connections).
  priority: number;
  dot: ScreenRectangle;
  label: ScreenRectangle;
};

const LABEL_MARGIN_PIXELS = 2;
const GRID_CELL_PIXELS = 64;

function overlaps(first: ScreenRectangle, second: ScreenRectangle): boolean {
  return (
    first.left < second.right + LABEL_MARGIN_PIXELS &&
    second.left < first.right + LABEL_MARGIN_PIXELS &&
    first.top < second.bottom + LABEL_MARGIN_PIXELS &&
    second.top < first.bottom + LABEL_MARGIN_PIXELS
  );
}

type RectangleGrid = {
  add: (ownerId: string, rectangle: ScreenRectangle) => void;
  // True when the rectangle overlaps anything stored that belongs to a different owner.
  hasOverlap: (ownerId: string, rectangle: ScreenRectangle) => boolean;
};

function cellKeysOf(rectangle: ScreenRectangle): string[] {
  const firstColumn = Math.floor((rectangle.left - LABEL_MARGIN_PIXELS) / GRID_CELL_PIXELS);
  const lastColumn = Math.floor((rectangle.right + LABEL_MARGIN_PIXELS) / GRID_CELL_PIXELS);
  const firstRow = Math.floor((rectangle.top - LABEL_MARGIN_PIXELS) / GRID_CELL_PIXELS);
  const lastRow = Math.floor((rectangle.bottom + LABEL_MARGIN_PIXELS) / GRID_CELL_PIXELS);
  const cellKeys: string[] = [];
  for (let column = firstColumn; column <= lastColumn; column += 1) {
    for (let row = firstRow; row <= lastRow; row += 1) cellKeys.push(`${column},${row}`);
  }
  return cellKeys;
}

// Buckets rectangles into square cells so a new name is only compared with its neighbours.
function createRectangleGrid(): RectangleGrid {
  const cells = new Map<string, { ownerId: string; rectangle: ScreenRectangle }[]>();
  return {
    add: (ownerId, rectangle) => {
      for (const cellKey of cellKeysOf(rectangle)) {
        const entries = cells.get(cellKey) ?? [];
        entries.push({ ownerId, rectangle });
        cells.set(cellKey, entries);
      }
    },
    hasOverlap: (ownerId, rectangle) =>
      cellKeysOf(rectangle).some((cellKey) =>
        (cells.get(cellKey) ?? []).some((entry) => entry.ownerId !== ownerId && overlaps(entry.rectangle, rectangle)),
      ),
  };
}

export function chooseVisibleLabels(candidates: readonly LabelCandidate[]): Set<string> {
  const dots = createRectangleGrid();
  for (const candidate of candidates) dots.add(candidate.nodeId, candidate.dot);

  const acceptedLabels = createRectangleGrid();
  const visibleNodeIds = new Set<string>();
  const byPriority = [...candidates].sort(
    (first, second) => second.priority - first.priority || first.nodeId.localeCompare(second.nodeId),
  );
  for (const candidate of byPriority) {
    const coversDotOrName =
      dots.hasOverlap(candidate.nodeId, candidate.label) || acceptedLabels.hasOverlap(candidate.nodeId, candidate.label);
    if (coversDotOrName) continue;
    acceptedLabels.add(candidate.nodeId, candidate.label);
    visibleNodeIds.add(candidate.nodeId);
  }
  return visibleNodeIds;
}
