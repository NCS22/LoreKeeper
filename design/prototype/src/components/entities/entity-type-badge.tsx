import { en } from "@messages/en";
import { ENTITY_TYPE_CONFIG } from "@/components/entities/entity-type-config";
import { cn } from "@/components/ui/cn";
import type { EntityTypeDto } from "@/dto/entity";

export function EntityTypeBadge({ type }: { type: EntityTypeDto }) {
  const { icon: Icon, badgeClassName } = ENTITY_TYPE_CONFIG[type];
  return (
    <span className={cn("rounded-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium", badgeClassName)}>
      <Icon aria-hidden className="size-3.5" />
      {en.entityTypes[type]}
    </span>
  );
}
