import { en } from "@messages/en";
import { EntityTypeGlyph } from "@/components/entities/entity-type-glyph";
import { ENTITY_TYPE_ORDER } from "@/components/entities/entity-type-config";

export function InspectorEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div aria-hidden className="grid grid-cols-4 gap-x-4 gap-y-3 opacity-60">
        {ENTITY_TYPE_ORDER.map((type) => (
          <EntityTypeGlyph key={type} type={type} />
        ))}
      </div>
      <h3 className="font-serif text-xl">{en.inspector.emptyTitle}</h3>
      <p className="text-ink-muted max-w-64">{en.inspector.emptyText}</p>
    </div>
  );
}
