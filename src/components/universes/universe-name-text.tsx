import { cn } from "@/components/ui/cn";

type UniverseNameTextProps = {
  // The name or the description of a universe, exactly as stored.
  text: string;
  className?: string;
};

// Text of the person (FR-19): always a text node, never markup. It is isolated, so direction-control
// characters cannot reorder what is around it, and it wraps anywhere, so a long name with no spaces
// stays inside its area and is read in full: it is never cut with an ellipsis.
export function UniverseNameText({ text, className }: UniverseNameTextProps) {
  return <bdi className={cn("[overflow-wrap:anywhere] [unicode-bidi:isolate]", className)}>{text}</bdi>;
}
