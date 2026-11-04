"use client";

// The only file in the app that imports Cytoscape: it turns entity and relationship DTOs into
// graph elements and reports node taps back as plain entity ids. Cytoscape only draws; where the
// nodes sit comes from force-layout.ts, and which names are shown from label-visibility.ts.
import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition, type StylesheetJson } from "cytoscape";
import { Maximize, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { en } from "@/messages/en";
import { useAccessibilityPreferences } from "@/components/accessibility/use-accessibility-preferences";
import { ENTITY_TYPE_ORDER } from "@/components/entities/entity-type-config";
import {
  FORCE_SETTINGS,
  REDUCED_MOTION_FORCE_SETTINGS,
  createForceLayout,
  type ForceLayout,
} from "@/components/graph/force-layout";
import { readGraphTheme, type GraphTheme } from "@/components/graph/graph-theme";
import { chooseVisibleLabels, type LabelCandidate } from "@/components/graph/label-visibility";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EntitySummaryDto } from "@/mocks/dto/entity";
import type { RelationshipDto } from "@/mocks/dto/relationship";

const ZOOM_STEP_FACTOR = 1.3;
const ANIMATION_MILLISECONDS = 200;
const HIGHLIGHT_TRANSITION_MILLISECONDS = 150;
const LABEL_REFRESH_INTERVAL_MILLISECONDS = 300;
const FIT_PADDING_PIXELS = 48;
// The most connected node is drawn this many times bigger than the least connected one.
const LARGEST_DOT_RATIO = 2.2;
// Below this on-screen font size a name is not worth drawing.
const SMALLEST_READABLE_FONT_PIXELS = 7;
const LABEL_FONT_REM = 0.8125;
const LABEL_MAX_WIDTH_REM = 6.5;
const LABEL_OUTLINE_PIXELS = 3;
// Names grow with the zoom raised to (1 - this value): zooming in grows the graph faster than its
// names, so crowded names separate. At 1 the names would keep a constant size on screen.
const LABEL_ZOOM_COMPENSATION = 0.6;
const DIMMED_NODE_OPACITY = 0.18;
const DIMMED_EDGE_OPACITY = 0.06;

type GraphCanvasProps = {
  entities: readonly EntitySummaryDto[];
  relationships: readonly RelationshipDto[];
  // The node shown selected and whose neighbourhood is highlighted; null leaves the graph neutral.
  highlightedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  // The user clicked away from the nodes. The details already shown elsewhere stay as they are.
  onClearHighlight: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Relationships that point at an entity outside the graph cannot be drawn.
function drawableRelationships(entities: readonly EntitySummaryDto[], relationships: readonly RelationshipDto[]) {
  const entityIds = new Set(entities.map((entity) => entity.id));
  return relationships.filter(
    (relationship) => entityIds.has(relationship.sourceEntityId) && entityIds.has(relationship.targetEntityId),
  );
}

function toElements(entities: readonly EntitySummaryDto[], relationships: readonly RelationshipDto[]): ElementDefinition[] {
  const connectionCountByEntityId = new Map<string, number>();
  for (const relationship of relationships) {
    for (const entityId of [relationship.sourceEntityId, relationship.targetEntityId]) {
      connectionCountByEntityId.set(entityId, (connectionCountByEntityId.get(entityId) ?? 0) + 1);
    }
  }
  // Starting from a ring keeps the layout the same on every visit.
  const ordered = [...entities].sort(
    (first, second) => ENTITY_TYPE_ORDER.indexOf(first.type) - ENTITY_TYPE_ORDER.indexOf(second.type),
  );
  const nodes = ordered.map((entity, index) => {
    const angle = (index / ordered.length) * 2 * Math.PI;
    return {
      group: "nodes" as const,
      data: { id: entity.id, name: entity.name, type: entity.type, connections: connectionCountByEntityId.get(entity.id) ?? 0 },
      position: { x: Math.cos(angle) * 220, y: Math.sin(angle) * 220 },
    };
  });
  const edges = relationships.map((relationship) => ({
    group: "edges" as const,
    // Lines are not selectable: only nodes are, so a tap on a line cannot replace the node selection.
    selectable: false,
    data: {
      id: relationship.id,
      source: relationship.sourceEntityId,
      target: relationship.targetEntityId,
      status: relationship.status,
      symmetric: relationship.type.isSymmetric,
    },
  }));
  return [...nodes, ...edges];
}

// Nodes are plain dots, like in Obsidian: the entity type is told by their color and the legend,
// the number of connections by their size. Relationships carry no text; hovering a node
// highlights it, its neighbours and its lines, and dims everything else.
function buildStylesheet(theme: GraphTheme, mostConnections: number): StylesheetJson {
  const rootSize = theme.rootFontSizePixels;
  const smallestDot = rootSize * 1.125;
  const transitionDuration = prefersReducedMotion() ? 0 : HIGHLIGHT_TRANSITION_MILLISECONDS;

  return [
    {
      selector: "node",
      style: {
        shape: "ellipse",
        // The scale needs two different bounds, so a graph without any connection still has a range.
        width: `mapData(connections, 0, ${Math.max(1, mostConnections)}, ${smallestDot}, ${smallestDot * LARGEST_DOT_RATIO})`,
        height: `mapData(connections, 0, ${Math.max(1, mostConnections)}, ${smallestDot}, ${smallestDot * LARGEST_DOT_RATIO})`,
        "border-width": 0,
        label: "data(name)",
        color: theme.ink,
        "font-family": theme.fontFamily,
        // Size, wrapping width and outline of the names are rescaled to the zoom in scaleNamesToZoom.
        "font-size": rootSize * LABEL_FONT_REM,
        "min-zoomed-font-size": SMALLEST_READABLE_FONT_PIXELS,
        "text-valign": "bottom",
        "text-halign": "center",
        "text-margin-y": 5,
        "text-wrap": "wrap",
        "text-max-width": `${rootSize * LABEL_MAX_WIDTH_REM}px`,
        "text-outline-color": theme.canvas,
        "text-outline-width": LABEL_OUTLINE_PIXELS,
        "overlay-opacity": 0,
        "transition-property": "opacity",
        "transition-duration": transitionDuration,
      },
    },
    ...ENTITY_TYPE_ORDER.map((type) => ({
      selector: `node[type = "${type}"]`,
      style: { "background-color": theme.entityColors[type] },
    })),
    { selector: "node.label-hidden", style: { "text-opacity": 0, "text-outline-opacity": 0 } },
    { selector: "node.dimmed", style: { opacity: DIMMED_NODE_OPACITY } },
    {
      // The names of the highlighted group are always drawn, whatever the zoom or the crowding.
      selector: "node.focused, node.neighbour",
      style: { "text-opacity": 1, "text-outline-opacity": 1, "min-zoomed-font-size": 0 },
    },
    { selector: "node:selected", style: { "border-width": 3, "border-color": theme.accent } },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "curve-style": "bezier",
        "line-color": theme.lineControl,
        "target-arrow-shape": "none",
        "target-arrow-color": theme.accent,
        "arrow-scale": 1,
        "overlay-opacity": 0,
        "transition-property": "opacity",
        "transition-duration": transitionDuration,
      },
    },
    { selector: 'edge[status = "USER_NOTE"]', style: { "line-style": "dotted", width: 2 } },
    { selector: 'edge[status = "SPECULATION"]', style: { "line-style": "dashed" } },
    { selector: "edge.dimmed", style: { opacity: DIMMED_EDGE_OPACITY } },
    {
      selector: "edge.incident",
      style: { "line-color": theme.accent, width: 2.5, "target-arrow-shape": "triangle", "z-index": 10 },
    },
    // A symmetric relationship has no direction to show.
    { selector: "edge.incident[?symmetric]", style: { "target-arrow-shape": "none" } },
  ];
}

// Highlights what is connected to the focused node and dims the rest. Without focus, nothing is dimmed.
function applyFocus(graph: Core, focusedEntityId: string | null) {
  graph.batch(() => {
    graph.elements().removeClass("focused neighbour incident dimmed");
    if (focusedEntityId === null) return;
    const focusedNode = graph.getElementById(focusedEntityId);
    if (focusedNode.empty()) return;
    const neighbourhood = focusedNode.closedNeighborhood();
    graph.elements().difference(neighbourhood).addClass("dimmed");
    focusedNode.addClass("focused");
    focusedNode.neighborhood().nodes().addClass("neighbour");
    focusedNode.connectedEdges().addClass("incident");
  });
}

// Cytoscape scales names together with the graph, so zooming in would never pull them apart. Their
// size is set in graph units, countering part of the zoom, so on screen they grow more slowly.
function scaleNamesToZoom(graph: Core) {
  const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const compensation = graph.zoom() ** -LABEL_ZOOM_COMPENSATION;
  graph.nodes().style({
    "font-size": rootSize * LABEL_FONT_REM * compensation,
    "text-max-width": `${rootSize * LABEL_MAX_WIDTH_REM * compensation}px`,
    "text-outline-width": LABEL_OUTLINE_PIXELS * compensation,
  });
}

// Names are drawn from the most connected node down and skipped where they would cover a dot or
// another name, so zooming in shows more of them and a crowded area never turns into a smear.
function refreshLabels(graph: Core) {
  scaleNamesToZoom(graph);
  const nodes = graph.nodes().toArray();
  // Measured with every name present: a hidden name has no size to measure.
  graph.batch(() => graph.nodes().removeClass("label-hidden"));

  const candidates = nodes.flatMap((node): LabelCandidate[] => {
    const labelBox = node.renderedBoundingBox({
      includeNodes: false,
      includeEdges: false,
      includeLabels: true,
      includeOverlays: false,
    });
    const center = node.renderedPosition();
    const dotRadius = node.renderedWidth() / 2;
    const measurements = [labelBox.x1, labelBox.y1, labelBox.x2, labelBox.y2, center.x, center.y, dotRadius];
    if (!measurements.every(Number.isFinite)) return [];
    return [
      {
        nodeId: node.id(),
        priority: node.data("connections") as number,
        dot: { left: center.x - dotRadius, top: center.y - dotRadius, right: center.x + dotRadius, bottom: center.y + dotRadius },
        label: { left: labelBox.x1, top: labelBox.y1, right: labelBox.x2, bottom: labelBox.y2 },
      },
    ];
  });
  const visibleNodeIds = chooseVisibleLabels(candidates);
  graph.batch(() => {
    for (const node of nodes) node.toggleClass("label-hidden", !visibleNodeIds.has(node.id()));
  });
}

function readRadii(graph: Core): Map<string, number> {
  return new Map(graph.nodes().map((node) => [node.id(), node.width() / 2]));
}

export function GraphCanvas({
  entities,
  relationships,
  highlightedEntityId,
  onSelectEntity,
  onClearHighlight,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const forceLayoutRef = useRef<ForceLayout | null>(null);
  const labelRefreshFrameRef = useRef<number | null>(null);
  const onSelectEntityRef = useRef(onSelectEntity);
  const onClearHighlightRef = useRef(onClearHighlight);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const { preferences } = useAccessibilityPreferences();

  useEffect(() => {
    onSelectEntityRef.current = onSelectEntity;
    onClearHighlightRef.current = onClearHighlight;
  }, [onSelectEntity, onClearHighlight]);

  // Create the graph once and keep it in step with its container.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const graph = cytoscape({
      container,
      minZoom: 0.25,
      maxZoom: 3,
      boxSelectionEnabled: false,
    });

    // Labels are only re-evaluated once per frame, and not while nodes are being dragged, so they
    // do not blink on and off as the graph moves.
    const scheduleLabelRefresh = () => {
      if (labelRefreshFrameRef.current !== null) return;
      labelRefreshFrameRef.current = requestAnimationFrame(() => {
        labelRefreshFrameRef.current = null;
        refreshLabels(graph);
      });
    };
    // While nodes move, names are re-evaluated a few times per second rather than on every frame.
    let lastLabelRefreshTime = 0;
    const scheduleLabelRefreshWhileMoving = () => {
      const now = performance.now();
      if (now - lastLabelRefreshTime < LABEL_REFRESH_INTERVAL_MILLISECONDS) return;
      lastLabelRefreshTime = now;
      scheduleLabelRefresh();
    };
    graph.on("zoom pan", scheduleLabelRefresh);
    graph.on("nodesmoved", scheduleLabelRefreshWhileMoving);
    graph.on("tap", "node", (event) => onSelectEntityRef.current(event.target.id()));
    // A tap on the empty canvas or on a line (not the end of a pan) clears the highlight.
    graph.on("tap", (event) => {
      if (event.target === graph || event.target.isEdge()) onClearHighlightRef.current();
    });
    // Pressing anywhere else on the screen clears it too. Presses inside the canvas are left to
    // Cytoscape, which tells a tap on a node from a tap on the background or the start of a drag.
    const clearHighlightOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.contains(event.target)) onClearHighlightRef.current();
    };
    document.addEventListener("pointerdown", clearHighlightOnOutsidePress, true);
    graph.on("mouseover", "node", (event) => setHoveredEntityId(event.target.id()));
    graph.on("mouseout", "node", () => setHoveredEntityId(null));
    // Cytoscape does not report a pointer that leaves the canvas in a single quick move.
    const clearHover = () => setHoveredEntityId(null);
    container.addEventListener("mouseleave", clearHover);
    graph.on("drag", "node", (event) => {
      const position = event.target.position();
      forceLayoutRef.current?.dragNodeTo(event.target.id(), position.x, position.y);
    });
    graph.on("free", "node", (event) => forceLayoutRef.current?.releaseNode(event.target.id()));
    graph.on("settled", scheduleLabelRefresh);

    const resizeObserver = new ResizeObserver(() => graph.resize());
    resizeObserver.observe(container);
    graphRef.current = graph;

    return () => {
      container.removeEventListener("mouseleave", clearHover);
      document.removeEventListener("pointerdown", clearHighlightOnOutsidePress, true);
      if (labelRefreshFrameRef.current !== null) cancelAnimationFrame(labelRefreshFrameRef.current);
      labelRefreshFrameRef.current = null;
      resizeObserver.disconnect();
      graph.stop(true, true);
      graph.destroy();
      graphRef.current = null;
    };
  }, []);

  // Replace the content and lay it out whenever the selection of the workspace changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (graph === null) return;
    const drawable = drawableRelationships(entities, relationships);
    const elements = toElements(entities, drawable);
    graph.elements().remove();
    graph.add(elements);
    const mostConnections = Math.max(0, ...graph.nodes().map((node) => node.data("connections") as number));
    graph.style(buildStylesheet(readGraphTheme(), mostConnections));

    const moveNodes = (positions: { id: string; x: number; y: number }[]) => {
      graph.batch(() => {
        for (const { id, x, y } of positions) graph.getElementById(id).position({ x, y });
      });
      graph.emit("nodesmoved");
    };
    const forceLayout = createForceLayout({
      nodes: graph.nodes().map((node) => ({
        id: node.id(),
        x: node.position("x"),
        y: node.position("y"),
        radius: node.width() / 2,
      })),
      links: drawable.map((relationship) => ({
        sourceId: relationship.sourceEntityId,
        targetId: relationship.targetEntityId,
      })),
      settings: prefersReducedMotion() ? REDUCED_MOTION_FORCE_SETTINGS : FORCE_SETTINGS,
      onTick: moveNodes,
      onSettled: () => graph.emit("settled"),
    });
    forceLayoutRef.current = forceLayout;
    // The layout is already spread out when it is created, so the graph is shown in its final place.
    moveNodes(forceLayout.readPositions());
    graph.fit(undefined, FIT_PADDING_PIXELS);
    refreshLabels(graph);

    return () => {
      forceLayout.stop();
      forceLayoutRef.current = null;
    };
  }, [entities, relationships]);

  // Colors and sizes come from tokens, so the graph is redrawn when a preset or text size changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (graph === null) return;
    const mostConnections = Math.max(0, ...graph.nodes().map((node) => node.data("connections") as number));
    graph.style(buildStylesheet(readGraphTheme(), mostConnections));
    forceLayoutRef.current?.updateRadii(readRadii(graph));
    refreshLabels(graph);
  }, [preferences]);

  // The pointer wins over the selection, so hovering previews what clicking would show.
  useEffect(() => {
    const graph = graphRef.current;
    if (graph === null) return;
    graph.nodes().unselect();
    if (highlightedEntityId !== null) {
      const highlightedNode = graph.getElementById(highlightedEntityId);
      if (highlightedNode.nonempty()) highlightedNode.select();
    }
    applyFocus(graph, hoveredEntityId ?? highlightedEntityId);
  }, [hoveredEntityId, highlightedEntityId, entities, relationships]);

  function zoomBy(factor: number) {
    const graph = graphRef.current;
    if (graph === null) return;
    const center = { x: graph.width() / 2, y: graph.height() / 2 };
    const level = Math.min(graph.maxZoom(), Math.max(graph.minZoom(), graph.zoom() * factor));
    if (prefersReducedMotion()) graph.zoom({ level, renderedPosition: center });
    else graph.animate({ zoom: { level, renderedPosition: center } }, { duration: ANIMATION_MILLISECONDS });
  }

  function fitToView() {
    const graph = graphRef.current;
    if (graph === null) return;
    if (prefersReducedMotion()) graph.fit(undefined, FIT_PADDING_PIXELS);
    else graph.animate({ fit: { eles: graph.elements(), padding: FIT_PADDING_PIXELS } }, { duration: ANIMATION_MILLISECONDS });
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        role="img"
        aria-label={en.graph.canvasLabel(entities.length, relationships.length)}
        // Cytoscape forces position: relative on its container, so the size is explicit.
        className="h-full w-full"
      />
      <div className="absolute right-3 bottom-3 flex flex-col gap-1">
        <ControlButton label={en.graph.zoomIn} Icon={ZoomIn} onClick={() => zoomBy(ZOOM_STEP_FACTOR)} />
        <ControlButton label={en.graph.zoomOut} Icon={ZoomOut} onClick={() => zoomBy(1 / ZOOM_STEP_FACTOR)} />
        <ControlButton label={en.graph.fitToView} Icon={Maximize} onClick={fitToView} />
      </div>
    </div>
  );
}

type ControlButtonProps = { label: string; Icon: LucideIcon; onClick: () => void };

function ControlButton({ label, Icon, onClick }: ControlButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={label} onClick={onClick} className="bg-raised">
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
