import { Flag, Gem, Landmark, Lightbulb, MapPin, PawPrint, User, Zap, type LucideIcon } from "lucide-react";
import type { EntityTypeDto } from "@/mocks/dto/entity";

// One place that says how each entity type looks. Lists and sheets pair the color with an icon;
// the graph shows plain dots, so there the color and the legend carry the type.
//
// Tailwind only generates classes it can find as complete strings, so they are spelled out.
type EntityTypeConfig = {
  icon: LucideIcon;
  nodeShape: "ellipse" | "round-rectangle" | "rectangle" | "hexagon" | "diamond" | "star" | "round-triangle" | "octagon";
  colorVariable: string;
  tintVariable: string;
  textClassName: string;
  badgeClassName: string;
};

export const ENTITY_TYPE_ORDER: readonly EntityTypeDto[] = [
  "CHARACTER",
  "LOCATION",
  "ORGANIZATION",
  "FACTION",
  "OBJECT",
  "ABILITY",
  "SPECIES",
  "CONCEPT",
];

export const ENTITY_TYPE_CONFIG: Record<EntityTypeDto, EntityTypeConfig> = {
  CHARACTER: {
    icon: User,
    nodeShape: "ellipse",
    colorVariable: "--entity-character",
    tintVariable: "--entity-character-tint",
    textClassName: "text-entity-character",
    badgeClassName: "bg-entity-character-tint text-entity-character",
  },
  LOCATION: {
    icon: MapPin,
    nodeShape: "round-rectangle",
    colorVariable: "--entity-location",
    tintVariable: "--entity-location-tint",
    textClassName: "text-entity-location",
    badgeClassName: "bg-entity-location-tint text-entity-location",
  },
  ORGANIZATION: {
    icon: Landmark,
    nodeShape: "rectangle",
    colorVariable: "--entity-organization",
    tintVariable: "--entity-organization-tint",
    textClassName: "text-entity-organization",
    badgeClassName: "bg-entity-organization-tint text-entity-organization",
  },
  FACTION: {
    icon: Flag,
    nodeShape: "hexagon",
    colorVariable: "--entity-faction",
    tintVariable: "--entity-faction-tint",
    textClassName: "text-entity-faction",
    badgeClassName: "bg-entity-faction-tint text-entity-faction",
  },
  OBJECT: {
    icon: Gem,
    nodeShape: "diamond",
    colorVariable: "--entity-object",
    tintVariable: "--entity-object-tint",
    textClassName: "text-entity-object",
    badgeClassName: "bg-entity-object-tint text-entity-object",
  },
  ABILITY: {
    icon: Zap,
    nodeShape: "star",
    colorVariable: "--entity-ability",
    tintVariable: "--entity-ability-tint",
    textClassName: "text-entity-ability",
    badgeClassName: "bg-entity-ability-tint text-entity-ability",
  },
  SPECIES: {
    icon: PawPrint,
    nodeShape: "round-triangle",
    colorVariable: "--entity-species",
    tintVariable: "--entity-species-tint",
    textClassName: "text-entity-species",
    badgeClassName: "bg-entity-species-tint text-entity-species",
  },
  CONCEPT: {
    icon: Lightbulb,
    nodeShape: "octagon",
    colorVariable: "--entity-concept",
    tintVariable: "--entity-concept-tint",
    textClassName: "text-entity-concept",
    badgeClassName: "bg-entity-concept-tint text-entity-concept",
  },
};
