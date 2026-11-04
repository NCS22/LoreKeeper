import { cn } from "@/components/ui/cn";
import { ENTITY_TYPE_CONFIG } from "@/components/entities/entity-type-config";
import type { EntityTypeDto } from "@/mocks/dto/entity";

// Decorative: the type is always named in text next to it.
export function EntityTypeIcon({ type, className }: { type: EntityTypeDto; className?: string }) {
  const { icon: Icon, textClassName } = ENTITY_TYPE_CONFIG[type];
  return <Icon aria-hidden className={cn("size-4 shrink-0", textClassName, className)} />;
}
