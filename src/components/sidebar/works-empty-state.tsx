import { useId } from "react";
import { en } from "@/messages/en";

// The works area of the navigation. Works do not exist yet, so it says so and offers nothing to do.
export function WorksEmptyState() {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-line border-t px-3 py-2">
      <h3 id={headingId} className="font-serif text-sm">
        {en.sidebar.worksHeading}
      </h3>
      <p className="text-ink-muted text-sm">{en.sidebar.noWorks}</p>
    </section>
  );
}
