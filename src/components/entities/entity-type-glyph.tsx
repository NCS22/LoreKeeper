import { ENTITY_TYPE_CONFIG } from "@/components/entities/entity-type-config";
import type { EntityTypeDto } from "@/mocks/dto/entity";

type NodeShape = (typeof ENTITY_TYPE_CONFIG)[EntityTypeDto]["nodeShape"];

// Same silhouettes the graph draws for its nodes, in a 24 x 24 box.
function NodeShapeOutline({ shape }: { shape: NodeShape }) {
  switch (shape) {
    case "ellipse":
      return <circle cx="12" cy="12" r="10" />;
    case "round-rectangle":
      return <rect x="2" y="4" width="20" height="16" rx="5" />;
    case "rectangle":
      return <rect x="2" y="4" width="20" height="16" />;
    case "hexagon":
      return <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />;
    case "diamond":
      return <polygon points="12,2 22,12 12,22 2,12" />;
    case "star":
      return <polygon points="12,2 14.9,8.9 22,9.3 16.5,14 18.2,21 12,17.3 5.8,21 7.5,14 2,9.3 9.1,8.9" />;
    case "round-triangle":
      return <polygon points="12,3 22,20 2,20" strokeLinejoin="round" />;
    case "octagon":
      return <polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8" />;
  }
}

// An entity type as the graph shows it: its shape, colored, with its icon inside. Decorative.
export function EntityTypeGlyph({ type }: { type: EntityTypeDto }) {
  const { icon: Icon, nodeShape, colorVariable, tintVariable } = ENTITY_TYPE_CONFIG[type];

  return (
    <span aria-hidden className="relative inline-grid size-6 shrink-0 place-items-center">
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-full" strokeWidth="1.5">
        <g style={{ fill: `var(${tintVariable})`, stroke: `var(${colorVariable})` }}>
          <NodeShapeOutline shape={nodeShape} />
        </g>
      </svg>
      <Icon className="relative size-3" style={{ color: `var(${colorVariable})` }} />
    </span>
  );
}
