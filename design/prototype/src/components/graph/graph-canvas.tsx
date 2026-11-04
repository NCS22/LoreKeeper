"use client";

// The only file in the app that imports Cytoscape: it turns entity and relationship DTOs into
// graph elements and reports node taps back as plain entity ids.
import { createElement, useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import cytoscape, { type Core, type ElementDefinition, type Layouts, type StylesheetJson } from "cytoscape";
import { Maximize, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { en } from "@messages/en";
import { useAccessibilityPreferences } from "@/accessibility/use-accessibility-preferences";
import { ENTITY_TYPE_CONFIG, ENTITY_TYPE_ORDER } from "@/components/entities/entity-type-config";
import { readGraphTheme, type GraphTheme } from "@/components/graph/graph-theme";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EntitySummaryDto } from "@/dto/entity";
import type { RelationshipDto } from "@/dto/relationship";

const ZOOM_STEP_FACTOR = 1.3;
const ANIMATION_MILLISECONDS = 200;

type GraphCanvasProps = {
  entities: readonly EntitySummaryDto[];
  relationships: readonly RelationshipDto[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function toElements(entities: readonly EntitySummaryDto[], relationships: readonly RelationshipDto[]): ElementDefinition[] {
  // Starting from a ring keeps the force layout stable between runs.
  const ordered = [...entities].sort(
    (first, second) => ENTITY_TYPE_ORDER.indexOf(first.type) - ENTITY_TYPE_ORDER.indexOf(second.type),
  );
  const nodes = ordered.map((entity, index) => {
    const angle = (index / ordered.length) * 2 * Math.PI;
    return {
      group: "nodes" as const,
      data: { id: entity.id, name: entity.name, type: entity.type },
      position: { x: Math.cos(angle) * 220, y: Math.sin(angle) * 220 },
    };
  });
  const edges = relationships.map((relationship) => ({
    group: "edges" as const,
    data: {
      id: relationship.id,
      source: relationship.sourceEntityId,
      target: relationship.targetEntityId,
      label: relationship.type.label,
      status: relationship.status,
      symmetric: relationship.type.isSymmetric,
    },
  }));
  return [...nodes, ...edges];
}

function iconDataUri(icon: LucideIcon, color: string): string {
  const markup = renderToStaticMarkup(createElement(icon, { color, size: 24, strokeWidth: 2 }));
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}

function buildStylesheet(theme: GraphTheme): StylesheetJson {
  const rootSize = theme.rootFontSizePixels;
  const nodeSize = rootSize * 2.5;

  return [
    {
      selector: "node",
      style: {
        width: nodeSize,
        height: nodeSize,
        "border-width": 2,
        "background-fit": "contain",
        "background-width": "56%",
        "background-height": "56%",
        label: "data(name)",
        color: theme.ink,
        "font-family": theme.fontFamily,
        "font-size": rootSize * 0.8125,
        "text-valign": "bottom",
        "text-halign": "center",
        "text-margin-y": 5,
        "text-wrap": "wrap",
        "text-max-width": `${rootSize * 6.5}px`,
        "text-outline-color": theme.canvas,
        "text-outline-width": 3,
        "overlay-opacity": 0,
      },
    },
    ...ENTITY_TYPE_ORDER.map((type) => ({
      selector: `node[type = "${type}"]`,
      style: {
        shape: ENTITY_TYPE_CONFIG[type].nodeShape,
        "background-color": theme.entityColors[type].tint,
        "border-color": theme.entityColors[type].color,
        "background-image": iconDataUri(ENTITY_TYPE_CONFIG[type].icon, theme.entityColors[type].color),
      },
    })),
    {
      selector: "node:selected",
      style: { "border-width": 5, "border-color": theme.accent },
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "curve-style": "bezier",
        "line-color": theme.lineControl,
        "target-arrow-shape": "triangle",
        "target-arrow-color": theme.lineControl,
        "arrow-scale": 1,
        label: "data(label)",
        color: theme.inkMuted,
        "font-family": theme.fontFamily,
        "font-size": rootSize * 0.6875,
        "text-rotation": "autorotate",
        "text-background-color": theme.canvas,
        "text-background-opacity": 1,
        "text-background-padding": "2px",
        "overlay-opacity": 0,
      },
    },
    { selector: "edge[?symmetric]", style: { "target-arrow-shape": "none" } },
    { selector: 'edge[status = "USER_NOTE"]', style: { "line-style": "dotted", width: 2 } },
    { selector: 'edge[status = "SPECULATION"]', style: { "line-style": "dashed" } },
    {
      selector: "edge.connected",
      style: { "line-color": theme.accent, "target-arrow-color": theme.accent, width: 2.5, color: theme.ink },
    },
  ];
}

export function GraphCanvas({ entities, relationships, selectedEntityId, onSelectEntity }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const layoutRef = useRef<Layouts | null>(null);
  const onSelectEntityRef = useRef(onSelectEntity);
  const { preferences } = useAccessibilityPreferences();

  useEffect(() => {
    onSelectEntityRef.current = onSelectEntity;
  }, [onSelectEntity]);

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
    graph.on("tap", "node", (event) => onSelectEntityRef.current(event.target.id()));
    const resizeObserver = new ResizeObserver(() => graph.resize());
    resizeObserver.observe(container);
    graphRef.current = graph;

    return () => {
      resizeObserver.disconnect();
      layoutRef.current?.stop();
      graph.stop(true, true);
      graph.destroy();
      graphRef.current = null;
    };
  }, []);

  // Replace the content and lay it out whenever the selection of the workspace changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (graph === null) return;
    layoutRef.current?.stop();
    graph.elements().remove();
    graph.add(toElements(entities, relationships));
    graph.style(buildStylesheet(readGraphTheme()));
    const layout = graph.layout({
      name: "cose",
      // "end" computes the layout at once and then glides the nodes into place with Cytoscape's own
      // animations, which are cancelled cleanly when the graph is destroyed. The typings only list
      // booleans for this option although cose accepts "end", hence the assertion.
      animate: (prefersReducedMotion() ? false : "end") as boolean,
      animationDuration: ANIMATION_MILLISECONDS + 100,
      fit: true,
      padding: 48,
      randomize: false,
      nodeRepulsion: () => 70000,
      idealEdgeLength: () => 120,
      nodeOverlap: 40,
      gravity: 0.7,
      componentSpacing: 100,
      numIter: 2500,
    });
    layoutRef.current = layout;
    layout.run();
  }, [entities, relationships]);

  // Colors and sizes come from tokens, so the graph is redrawn when a preset or text size changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (graph === null) return;
    graph.style(buildStylesheet(readGraphTheme()));
  }, [preferences]);

  useEffect(() => {
    const graph = graphRef.current;
    if (graph === null) return;
    graph.nodes().unselect();
    graph.edges().removeClass("connected");
    if (selectedEntityId === null) return;
    const selectedNode = graph.getElementById(selectedEntityId);
    if (selectedNode.nonempty()) {
      selectedNode.select();
      selectedNode.connectedEdges().addClass("connected");
    }
  }, [selectedEntityId, entities, relationships]);

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
    if (prefersReducedMotion()) graph.fit(undefined, 48);
    else graph.animate({ fit: { eles: graph.elements(), padding: 48 } }, { duration: ANIMATION_MILLISECONDS });
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
